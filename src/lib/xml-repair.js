/**
 * Client-side XML Repair Tool for SAS Visual Analytics BIRD XML files
 * This is a simplified version that can run in the browser
 * Version: 2025-01-07-v2 (Fixed null candidate detection)
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
      let doc = this.parser.parseFromString(xmlContent, "text/xml");
      
      if (doc.documentElement.nodeName === "parsererror") {
        throw new Error("Invalid XML format");
      }

      // Always analyze first to get the unique null candidate count
      let analysis = this.analyzeXML(doc);
      let repairedContent = xmlContent;
      let hasRepairs = false;

      // --- Iterative null candidate repair ---
      let nullCandidateLoopCount = 0;
      while (analysis.nullCandidates > 0 && nullCandidateLoopCount < 10) { // safety limit
        doc = this.parser.parseFromString(repairedContent, "text/xml");
        repairedContent = this.repairNullCandidates(doc, analysis.nullCandidateIds);
        doc = this.parser.parseFromString(repairedContent, "text/xml");
        analysis = this.analyzeXML(doc);
        hasRepairs = true;
        nullCandidateLoopCount++;
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
    // Note: JavaScript doesn't support lookbehind in all browsers, so we need a different approach
    const definedIds = new Set();
    const referencedIds = new Set();

    // First pass: collect all defined IDs (name attributes only)
    for (let elem of allElements) {
      const name = elem.getAttribute('name');
      if (name && idCheck.test(name)) {
        definedIds.add(name);
      }
    }

    // Second pass: collect referenced IDs from attributes and text content
    for (let elem of allElements) {
      // Check attributes (except name attributes) - match Python logic
      for (let attr of elem.attributes) {
        if (attr.name !== 'name') {
          const val = attr.value;
          // Split by whitespace and check each word
          const words = val.split(/\s+/);
          for (let word of words) {
            if (idCheck.test(word)) {
              referencedIds.add(word);
            }
          }
        }
      }
      
      // Check text content for references (match Python logic exactly)
      if (elem.textContent && elem.textContent.trim()) {
        const textContent = elem.textContent.trim();
        // Use the same regex as Python: (?<![A-Za-z0-9#])[a-z]{2}[0-9]+
        // Since JavaScript doesn't support lookbehind in all browsers, we'll use a different approach
        let match;
        const regex = /[a-z]{2}[0-9]+/g;
        while ((match = regex.exec(textContent)) !== null) {
          const matchText = match[0];
          const matchIndex = match.index;
          const beforeChar = matchIndex > 0 ? textContent[matchIndex - 1] : '';
          const afterChar = matchIndex + matchText.length < textContent.length ? textContent[matchIndex + matchText.length] : '';
          
          // Match Python logic: exclude alphanumeric and # characters
          const beforeValid = !beforeChar.match(/[A-Za-z0-9#]/);
          const afterValid = !afterChar.match(/[A-Za-z0-9#]/);
          
          if (beforeValid && afterValid) {
            referencedIds.add(matchText);
          }
        }
      }
    }

    // Null candidates are referenced but not defined
    const nullCandidates = new Set([...referencedIds].filter(id => !definedIds.has(id)));

    // Apply the same filtering as Python script
    const filteredCandidates = new Set();
    for (let candidate of nullCandidates) {
      // Skip if it looks like an HTML color code
      if (/^[a-fA-F0-9]{6}$/.test(candidate)) continue;
      
      // Skip if it's a common label pattern
      if (['label', 'title', 'name', 'id'].includes(candidate.toLowerCase())) continue;
      
      // Skip if it's 'bi1' (special case to ignore)
      if (candidate === 'bi1') continue;
      
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

    // Collect referenced prompt IDs from all attributes (except name) and text content
    for (let elem of allElements) {
      // Check all attributes except 'name'
      for (let attr of elem.attributes) {
        if (attr.name !== 'name') {
          const val = attr.value;
          if (promptIds.has(val)) {
            referencedPromptIds.add(val);
          }
        }
      }
      // Check text content for prompt references
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
    analysis.prompts = unusedPrompts.size;

    // Find duplicate objects (problematic duplicates only)
    const duplicateObjects = this.findDuplicateObjects(doc);
    analysis.duplicates = duplicateObjects.size;
    analysis.duplicateObjects = duplicateObjects;

    return analysis;
  }

  /**
   * Find problematic duplicate object IDs in the XML
   * Returns a Map of object IDs to their references
   */
  findDuplicateObjects(doc) {
    const duplicates = new Map();
    const allElements = doc.getElementsByTagName('*');
    
    // Find all name attributes in the XML
    for (let elem of allElements) {
      const name = elem.getAttribute('name');
      if (name) {
        if (!duplicates.has(name)) {
          duplicates.set(name, []);
        }
        
        // Determine object type based on element tag
        const objType = elem.tagName;
        const location = this.getElementLocation(elem);
        
        duplicates.get(name).push({
          objectType: objType,
          objectId: name,
          location: location,
          element: elem
        });
      }
    }
    
    // Filter to only include problematic duplicates
    const problematicDuplicates = new Map();
    for (const [objId, references] of duplicates) {
      if (references.length > 1) {
        // Check if these are legitimate duplicates (like DynVar with same name)
        // or problematic duplicates (like actual object IDs)
        
        // Skip if all references are DynVar elements with the same name
        // (these are legitimate dynamic variables used in different contexts)
        if (references.every(ref => ref.objectType === 'DynVar')) {
          console.log(`Skipping legitimate DynVar duplicates for ${objId}`);
          continue;
        }
        
        // Skip common legitimate duplicate names that appear in SAS BIRD XML
        // These are typically dynamic variables or CSS properties that are supposed to be duplicated
        const legitimateNames = new Set([
          'CATEGORY', 'RESPONSE', 'GROUP', 'COLUMN', 'ROW', 'TIP', 
          'KEY_FRAME', 'HIDDEN', 'X', 'Y'
        ]);
        if (legitimateNames.has(objId)) {
          console.log(`Skipping legitimate duplicate name: ${objId}`);
          continue;
        }
        
        // Skip if all references are Category elements in stylesheet
        // (these are legitimate CSS category definitions)
        if (references.every(ref => ref.objectType === 'Category')) {
          console.log(`Skipping legitimate Category duplicates for ${objId}`);
          continue;
        }
        
        // Skip if all references are Property elements with the same key
        // (these are legitimate property definitions)
        if (references.every(ref => ref.objectType === 'Property')) {
          console.log(`Skipping legitimate Property duplicates for ${objId}`);
          continue;
        }
        
        // Skip if all references are KeyValue elements with the same name
        // (these are legitimate key-value components used in different contexts)
        if (references.every(ref => ref.objectType === 'KeyValue')) {
          console.log(`Skipping legitimate KeyValue duplicates for ${objId}`);
          continue;
        }
        
        // Skip if all references are HistogramParm elements with the same name
        // (these are legitimate histogram parameter components used in different contexts)
        if (references.every(ref => ref.objectType === 'HistogramParm')) {
          console.log(`Skipping legitimate HistogramParm duplicates for ${objId}`);
          continue;
        }
        
        // Include other types of duplicates as problematic
        console.log(`Including problematic duplicates for ${objId}: ${references.map(ref => ref.objectType)}`);
        problematicDuplicates.set(objId, references);
      }
    }
    
    return problematicDuplicates;
  }

  /**
   * Get a human-readable location description for an element
   */
  getElementLocation(elem) {
    const path = [];
    let current = elem;
    while (current && current.parentNode) {
      if (current.tagName) {
        path.unshift(current.tagName);
      }
      current = current.parentNode;
    }
    return path.slice(0, 3).join(' > '); // Limit to first 3 levels
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
    const idCheck = /^[a-z]{2}[0-9]+$/;
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

    // Collect referenced prompt IDs from all attributes (except name) and text content
    for (let elem of allElements) {
      // Check all attributes except 'name'
      for (let attr of elem.attributes) {
        if (attr.name !== 'name') {
          const val = attr.value;
          if (promptIds.has(val)) {
            referencedPromptIds.add(val);
          }
        }
      }
      // Check text content for prompt references
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

    // Remove unused prompt definitions robustly
    for (let promptId of unusedPrompts) {
      // Collect elements to remove first (to avoid modifying the tree while iterating)
      const elementsToRemove = [];
      for (let elem of allElements) {
        if (elem.getAttribute('name') === promptId) {
          elementsToRemove.push(elem);
        }
      }
      // Remove each element from its parent
      for (let elem of elementsToRemove) {
        const parent = elem.parentNode;
        if (parent) {
          parent.removeChild(elem);
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

${analysis.nullCandidates > 0 ? `Null Candidates (${analysis.nullCandidates}):` : 'Null Candidates: 0'}
${analysis.nullCandidates > 0 ? nullCandidateList.split(', ').map(id => `  ${id}: Referenced but not defined`).join('\n') : ''}
Unused Prompts: ${analysis.prompts}
Duplicate Objects: ${analysis.duplicates}

Potential Issues:
${analysis.nullCandidates > 0 ? `  ⚠️  Found ${analysis.nullCandidates} null candidates` : ''}
${analysis.prompts > 0 ? `  ⚠️  Found ${analysis.prompts} unused prompts` : ''}
${analysis.duplicates > 0 ? `  ⚠️  Found ${analysis.duplicates} duplicate objects` : ''}
${!analysis.nullCandidates && !analysis.prompts && !analysis.duplicates ? '  ✅ No obvious issues detected' : ''}

Repair Summary:
${analysis.nullCandidates > 0 ? `  🔧 Repaired ${analysis.nullCandidates} null candidates` : ''}
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
          const result = await processJSONFile(content, file.name);
          resolve(result);
        } else {
          // Handle as XML file
          const repairTool = new XMLRepairTool();
          const result = await repairTool.repairXML(content);
          resolve({
            ...result,
            filename: `repaired_${file.name}`
          });
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
                return {
                  ...result,
                  filename: `repaired_${fileName.replace('.json', '.xml')}`
                };
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