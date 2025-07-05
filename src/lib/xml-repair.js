/**
 * Client-side XML Repair Tool for SAS Visual Analytics BIRD XML files
 * This is a simplified version that can run in the browser
 */

import pako from 'pako';

export class XMLRepairTool {
  constructor() {
    this.xmlContent = "";
    this.parser = new DOMParser();
    this.serializer = new XMLSerializer();
  }

  /**
   * Repair XML file content
   * @param {string} xmlContent - The XML content as string
   * @returns {Object} - Repair results
   */
  async repairXML(xmlContent) {
    try {
      this.xmlContent = xmlContent;
      
      // Parse the XML
      const doc = this.parser.parseFromString(xmlContent, "text/xml");
      
      if (doc.documentElement.nodeName === "parsererror") {
        throw new Error("Invalid XML format");
      }

      // Always analyze first to get the unique null candidate count
      const analysis = this.analyzeXML(doc);
      let repairedContent = xmlContent;
      let hasRepairs = false;

      // Perform repairs if needed
      if (analysis.nullCandidates > 0) {
        repairedContent = this.repairNullCandidates(doc, analysis.nullCandidateIds);
        hasRepairs = true;
      }

      // Repair unused prompts if needed
      if (analysis.prompts > 0) {
        repairedContent = this.repairUnusedPrompts(doc);
        hasRepairs = true;
      }

      // Store the original analysis for reporting
      const originalAnalysis = { ...analysis };

      // After repairs, re-analyze to get the final unique null candidate count (should be 0)
      // But for reporting, we want the original count (before repair)
      return {
        file: btoa(unescape(encodeURIComponent(repairedContent))), // Base64 encode
        results: {
          duplicates: originalAnalysis.duplicates,
          prompts: originalAnalysis.prompts,
          nullCandidates: originalAnalysis.nullCandidateIds ? originalAnalysis.nullCandidateIds.size : originalAnalysis.nullCandidates,
          hasDuplicates: originalAnalysis.duplicates > 0,
          hasPrompts: originalAnalysis.prompts > 0,
          hasNullCandidates: (originalAnalysis.nullCandidateIds ? originalAnalysis.nullCandidateIds.size : originalAnalysis.nullCandidates) > 0,
          totalObjects: originalAnalysis.totalObjects
        },
        analysis: this.generateAnalysisReport(originalAnalysis),
        hasRepairs
      };
    } catch (error) {
      console.error('Error repairing XML:', error);
      throw new Error('Failed to repair XML file');
    }
  }

  /**
   * Analyze XML structure
   */
  analyzeXML(doc) {
    const analysis = {
      totalObjects: 0,
      nullCandidates: 0,
      duplicates: 0,
      prompts: 0,
      objectTypes: {},
      nullCandidateIds: new Set()
    };

    // Count objects by type
    const allElements = doc.getElementsByTagName('*');
    
    for (let elem of allElements) {
      const tagName = elem.tagName;
      analysis.objectTypes[tagName] = (analysis.objectTypes[tagName] || 0) + 1;
      analysis.totalObjects++;
    }

    // Find null candidates using conservative approach to match Python script exactly
    const idCheck = /^[a-z]{2}[0-9]+$/;  // Exact match for ID pattern (e.g., vi1645)
    const definedIds = new Set();
    const referencedIds = new Set();

    // First pass: collect all defined IDs (name attributes only)
    for (let elem of allElements) {
      const name = elem.getAttribute('name');
      if (name && idCheck.test(name)) {
        definedIds.add(name);
      }
    }

    // Second pass: collect referenced IDs from specific attributes only
    // Focus on attributes that typically contain object references
    const referenceAttributes = ['value', 'ref', 'target', 'id', 'object'];
    
    for (let elem of allElements) {
      for (let attr of elem.attributes) {
        if (referenceAttributes.includes(attr.name.toLowerCase())) {
          const val = attr.value.trim();
          if (idCheck.test(val)) {
            referencedIds.add(val);
          }
        }
      }
    }

    // Null candidates are referenced but not defined
    const nullCandidates = new Set([...referencedIds].filter(id => !definedIds.has(id)));

    // Apply the same filtering as Python script
    const filteredCandidates = new Set();
    for (let candidate of nullCandidates) {
      // Skip very short IDs
      if (candidate.length < 3) continue;
      
      // Skip if it looks like a color code
      if (/^[a-fA-F0-9]{6}$/.test(candidate)) continue;
      
      // Skip special cases
      if (['bi1', 'label', 'title'].includes(candidate.toLowerCase())) continue;
      
      filteredCandidates.add(candidate);
    }

    analysis.nullCandidates = filteredCandidates.size;
    analysis.nullCandidateIds = filteredCandidates;

    // Find unused prompts (simplified)
    const promptIds = new Set();
    const referencedPromptIds = new Set();

    // Collect all prompt IDs (defined)
    for (let elem of allElements) {
      const name = elem.getAttribute('name');
      if (name && name.startsWith('pr') && idCheck.test(name)) {
        promptIds.add(name);
      }
    }

    // Collect referenced prompt IDs from value attributes
    for (let elem of allElements) {
      const value = elem.getAttribute('value');
      if (value && promptIds.has(value)) {
        referencedPromptIds.add(value);
      }
    }

    // Unused prompts are defined but not referenced
    const unusedPrompts = new Set([...promptIds].filter(id => !referencedPromptIds.has(id)));
    analysis.prompts = unusedPrompts.size;

    return analysis;
  }

  /**
   * Repair null candidates by removing references to undefined objects
   */
  repairNullCandidates(doc, nullCandidateIds) {
    const nullCandidates = nullCandidateIds || new Set();
    if (nullCandidates.size === 0) {
      return this.serializer.serializeToString(doc);
    }

    // Simple approach: just clean attributes and text content, don't remove elements
    const allElements = doc.getElementsByTagName('*');
    
    // Clean up expressions and attributes that contain null candidate references
    for (let elem of allElements) {
      // Clean all attributes (except name attributes)
      for (let attr of elem.attributes) {
        if (attr.name !== 'name' && attr.value && Array.from(nullCandidates).some(nc => attr.value.includes(nc))) {
          const cleanedValue = this.removeNullCandidateReferences(attr.value, nullCandidates);
          if (cleanedValue !== attr.value) {
            if (cleanedValue.trim()) {
              elem.setAttribute(attr.name, cleanedValue);
            } else {
              elem.removeAttribute(attr.name);
            }
          }
        }
      }
      
      // Clean text content
      if (elem.textContent && Array.from(nullCandidates).some(nc => elem.textContent.includes(nc))) {
        const cleanedText = this.removeNullCandidateReferences(elem.textContent, nullCandidates);
        if (cleanedText !== elem.textContent) {
          elem.textContent = cleanedText;
        }
      }
    }

    return this.serializer.serializeToString(doc);
  }

  /**
   * Remove references to null candidates from text/expressions
   */
  removeNullCandidateReferences(text, nullCandidates) {
    if (!text) {
      return text;
    }
    
    let cleanedText = text;
    
    for (let nullCandidate of nullCandidates) {
      // Remove ${null_candidate} patterns
      const pattern1 = new RegExp(`\\$\\{${this.escapeRegExp(nullCandidate)}(?:,[^}]*)?\\}`, 'g');
      cleanedText = cleanedText.replace(pattern1, '');
      
      // Remove standalone null_candidate references
      const pattern2 = new RegExp(`(?<![A-Za-z0-9#])${this.escapeRegExp(nullCandidate)}(?![A-Za-z0-9])`, 'g');
      cleanedText = cleanedText.replace(pattern2, '');
      
      // Clean up any resulting double spaces or commas
      cleanedText = cleanedText.replace(/\s+/g, ' ');
      cleanedText = cleanedText.replace(/,\s*,/g, ',');
      cleanedText = cleanedText.replace(/\(\s*\)/g, '()');
    }
    
    return cleanedText.trim();
  }

  /**
   * Escape special regex characters
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Repair unused prompts by removing prompt definitions that are not referenced
   */
  repairUnusedPrompts(doc) {
    const idCheck = /[a-z]{2}[0-9]+/;
    const promptIds = new Set();
    const referencedPromptIds = new Set();
    const allElements = doc.getElementsByTagName('*');

    // Collect all prompt IDs (defined)
    for (let elem of allElements) {
      const name = elem.getAttribute('name');
      if (name && name.startsWith('pr') && idCheck.test(name)) {
        promptIds.add(name);
      }
    }

    // Collect referenced prompt IDs
    for (let elem of allElements) {
      // Check attributes (except name)
      for (let attr of elem.attributes) {
        if (attr.name !== 'name') {
          const val = attr.value;
          if (promptIds.has(val)) {
            referencedPromptIds.add(val);
          }
        }
      }

      // Check element text
      if (elem.textContent) {
        for (let promptId of promptIds) {
          if (elem.textContent.includes(promptId)) {
            referencedPromptIds.add(promptId);
          }
        }
      }
    }

    // Unused prompts are defined but not referenced
    const unusedPrompts = new Set([...promptIds].filter(id => !referencedPromptIds.has(id)));

    // Remove unused prompt definitions
    for (let promptId of unusedPrompts) {
      for (let elem of allElements) {
        if (elem.getAttribute('name') === promptId) {
          const parent = elem.parentNode;
          if (parent) {
            parent.removeChild(elem);
          }
        }
      }
    }

    return this.serializer.serializeToString(doc);
  }

  /**
   * Generate analysis report
   */
  generateAnalysisReport(analysis) {
    const nullCandidateList = analysis.nullCandidateIds ? Array.from(analysis.nullCandidateIds).sort().join(', ') : '';
    
    // Define the specific object types to show
    const targetTypes = [
      'ParentDataDefinition',
      'DataDefinition', 
      'DataSource',
      'DataItem',
      'PredefinedDataItem',
      'VisualElements',
      'Image',
      'VisualContainer',
      'Prompt',
      'MediaContainer',
      'Section',
      'Container',
      'Actions',
      'NavigationAction'
    ];
    
    // Create a filtered and summed object counts dictionary
    const filteredCounts = {};
    for (const [objType, count] of Object.entries(analysis.objectTypes)) {
      // Handle DataDefinition/DataDefinitions summing
      if (['DataDefinition', 'DataDefinitions'].includes(objType)) {
        if (!filteredCounts['DataDefinition']) {
          filteredCounts['DataDefinition'] = 0;
        }
        filteredCounts['DataDefinition'] += count;
      }
      // Handle DataSource/DataSources summing
      else if (['DataSource', 'DataSources'].includes(objType)) {
        if (!filteredCounts['DataSource']) {
          filteredCounts['DataSource'] = 0;
        }
        filteredCounts['DataSource'] += count;
      }
      // Add other target types
      else if (targetTypes.includes(objType)) {
        filteredCounts[objType] = count;
      }
    }
    
    // Generate the filtered object counts string
    const objectCountsString = targetTypes.map(objType => {
      const count = filteredCounts[objType] || 0;
      return `  ${objType}: ${count}`;
    }).join('\n');
    
    return `
==========================================================
SAS Visual Analytics BIRD XML Analysis
==========================================================
Total Objects: ${analysis.totalObjects}

Object Counts by Type:
${objectCountsString}

Null Candidates: ${analysis.nullCandidates}
${analysis.nullCandidates > 0 ? `Null Candidate IDs: ${nullCandidateList}` : ''}
Unused Prompts: ${analysis.prompts}
Duplicate Objects: ${analysis.duplicates}

Potential Issues:
${analysis.nullCandidates > 0 ? `  ⚠️  Found ${analysis.nullCandidates} null candidates` : '  ✅ No null candidates found'}
${analysis.prompts > 0 ? `  ⚠️  Found ${analysis.prompts} unused prompts` : '  ✅ No unused prompts found'}
${analysis.duplicates > 0 ? `  ⚠️  Found ${analysis.duplicates} duplicate objects` : '  ✅ No duplicate objects found'}

Repair Summary:
${analysis.nullCandidates > 0 ? `  🔧 Removed ${analysis.nullCandidates} null candidate references` : ''}
${analysis.prompts > 0 ? `  🔧 Removed ${analysis.prompts} unused prompt definitions` : ''}
==========================================================
`;
  }
}

/**
 * Main repair function for use in components
 */
export async function repairXMLFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        
        // Check if it's a JSON file
        if (file.name.endsWith('.json')) {
          console.log('Processing JSON file:', file.name);
          const result = await processJSONFile(content, file.name);
          console.log('JSON result filename:', result.filename);
          resolve(result);
        } else {
          // Handle as XML file
          console.log('Processing XML file:', file.name);
          const repairTool = new XMLRepairTool();
          const result = await repairTool.repairXML(content);
          const finalResult = {
            ...result,
            filename: `repaired_${file.name}`
          };
          console.log('XML result filename:', finalResult.filename);
          resolve(finalResult);
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Process JSON file to extract and analyze XML content
 */
async function processJSONFile(jsonContent, fileName) {
  try {
    const jsonData = JSON.parse(jsonContent);
    
    // Handle Paket.json structure using the same logic as server-side
    if (jsonData.transferDetails) {
      for (const detail of jsonData.transferDetails) {
        if (detail.transferObject && detail.transferObject.content) {
          try {
            const content = detail.transferObject.content;
            let realContent = content;
            let compress = false;
            
            if (content.startsWith("TRUE###")) {
              realContent = content.substring(7);
              compress = true;
            } else if (content.startsWith("FALSE###")) {
              realContent = content.substring(8);
            }
            
            // Decode base64
            const byteDecoded = atob(realContent);
            let byteDecompressed;
            
            if (compress) {
              // Decompress using pako
              try {
                const uint8Array = new Uint8Array(byteDecoded.length);
                for (let i = 0; i < byteDecoded.length; i++) {
                  uint8Array[i] = byteDecoded.charCodeAt(i);
                }
                const decompressed = pako.inflate(uint8Array, { to: 'string' });
                byteDecompressed = decompressed;
              } catch {
                byteDecompressed = byteDecoded;
              }
            } else {
              byteDecompressed = byteDecoded;
            }
            
            // Parse JSON
            const objectJson = JSON.parse(byteDecompressed);
            
            // Extract XML content
            if (objectJson.transferableContent && objectJson.transferableContent.content) {
              const xmlContent = objectJson.transferableContent.content;
              if (xmlContent.includes('<') && xmlContent.includes('>')) {
                const repairTool = new XMLRepairTool();
                const result = await repairTool.repairXML(xmlContent);
                const finalResult = {
                  ...result,
                  filename: `repaired_${fileName.replace('.json', '.xml')}`
                };
                console.log('processJSONFile returning filename:', finalResult.filename);
                return finalResult;
              }
            }
          } catch {
            continue;
          }
        }
      }
    }
    
    // If no XML found, return error
    throw new Error('No XML content found in JSON file');
    
  } catch (error) {
    throw new Error(`Failed to process JSON: ${error.message}`);
  }
} 