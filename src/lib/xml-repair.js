/**
 * Client-side XML Repair Tool for SAS Visual Analytics BIRD XML files
 * This is a simplified version that can run in the browser
 */

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

      const analysis = this.analyzeXML(doc);
      let repairedContent = xmlContent;
      let hasRepairs = false;

      // Perform repairs if needed
      if (analysis.nullCandidates > 0) {
        repairedContent = this.repairNullCandidates(doc);
        hasRepairs = true;
      }

      // Repair unused prompts if needed
      if (analysis.prompts > 0) {
        repairedContent = this.repairUnusedPrompts(doc);
        hasRepairs = true;
      }

      return {
        file: btoa(unescape(encodeURIComponent(repairedContent))), // Base64 encode
        results: {
          duplicates: analysis.duplicates,
          prompts: analysis.prompts,
          nullCandidates: analysis.nullCandidates,
          hasDuplicates: analysis.duplicates > 0,
          hasPrompts: analysis.prompts > 0,
          hasNullCandidates: analysis.nullCandidates > 0,
          totalObjects: analysis.totalObjects
        },
        analysis: this.generateAnalysisReport(analysis),
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

    // Find null candidates using the same logic as the Python script
    const idCheck = /[a-z]{2}[0-9]+/;
    const idInText = /(?<![A-Za-z0-9#])[a-z]{2}[0-9]+/g;
    const definedIds = new Set();
    const referencedIds = new Set();

    // First pass: collect all defined IDs (name attributes)
    for (let elem of allElements) {
      const name = elem.getAttribute('name');
      if (name && idCheck.test(name)) {
        definedIds.add(name);
      }
    }

    // Second pass: collect all referenced IDs
    for (let elem of allElements) {
      // Check attributes (except name attributes)
      for (let attr of elem.attributes) {
        if (attr.name !== 'name') {
          const words = attr.value.split(/\s+/);
          for (let word of words) {
            if (idCheck.test(word)) {
              referencedIds.add(word);
            }
          }
        }
      }

      // Check element text content
      if (elem.textContent) {
        const results = elem.textContent.match(idInText);
        if (results) {
          results.forEach(id => referencedIds.add(id));
        }
      }
    }

    // Null candidates are referenced but not defined
    const nullCandidates = new Set([...referencedIds].filter(id => !definedIds.has(id)));

    // Filter out known false positives (like HTML colors, labels)
    const falsePositives = new Set();
    for (let candidate of nullCandidates) {
      // Skip if it looks like an HTML color code
      if (/^[a-fA-F0-9]{6}$/.test(candidate)) {
        falsePositives.add(candidate);
      }
      // Skip if it's a common label pattern
      else if (['label', 'title', 'name', 'id'].includes(candidate.toLowerCase())) {
        falsePositives.add(candidate);
      }
      // Skip if it's 'bi1' (special case to ignore)
      else if (candidate === 'bi1') {
        falsePositives.add(candidate);
      }
    }

    // Remove false positives
    for (let falsePositive of falsePositives) {
      nullCandidates.delete(falsePositive);
    }

    analysis.nullCandidates = nullCandidates.size;
    analysis.nullCandidateIds = nullCandidates;

    // Find unused prompts (prompts that are defined but not referenced)
    const promptIds = new Set();
    const referencedPromptIds = new Set();

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

      // Check element tail
      if (elem.tail) {
        for (let promptId of promptIds) {
          if (elem.tail.includes(promptId)) {
            referencedPromptIds.add(promptId);
          }
        }
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
  repairNullCandidates(doc) {
    const analysis = this.analyzeXML(doc);
    const nullCandidates = analysis.nullCandidateIds;
    
    if (nullCandidates.size === 0) {
      return this.serializer.serializeToString(doc);
    }

    // Phase 1: Remove elements that directly reference null candidates
    const elementsToRemove = [];
    const allElements = doc.getElementsByTagName('*');
    
    for (let elem of allElements) {
      let shouldRemove = false;
      
      // Check all attributes for null candidate references
      for (let attr of elem.attributes) {
        if (nullCandidates.has(attr.value)) {
          shouldRemove = true;
          break;
        }
      }
      
      // Check text content for null candidate references
      if (elem.textContent && Array.from(nullCandidates).some(nc => elem.textContent.includes(nc))) {
        shouldRemove = true;
      }
      
      if (shouldRemove) {
        elementsToRemove.push(elem);
      }
    }
    
    // Remove marked elements
    for (let elem of elementsToRemove) {
      const parent = elem.parentNode;
      if (parent) {
        parent.removeChild(elem);
      }
    }
    
    // Phase 2: Clean up expressions and attributes that contain null candidate references
    for (let elem of allElements) {
      // Clean all attributes
      for (let attr of elem.attributes) {
        if (attr.value && Array.from(nullCandidates).some(nc => attr.value.includes(nc))) {
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
    
    // Phase 3: Remove empty or invalid expressions
    for (let elem of allElements) {
      const expression = elem.getAttribute('expression');
      if (expression && ['', '()', '${}'].includes(expression)) {
        const parent = elem.parentNode;
        if (parent) {
          parent.removeChild(elem);
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
    const analysis = this.analyzeXML(doc);
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
    
    return `
==========================================================
SAS Visual Analytics BIRD XML Analysis
==========================================================
Total Objects: ${analysis.totalObjects}

Object Counts by Type:
${Object.entries(analysis.objectTypes).map(([type, count]) => `  ${type}: ${count}`).join('\n')}

Null Candidates: ${analysis.nullCandidates}
${analysis.nullCandidates > 0 ? `Null Candidate IDs: ${nullCandidateList}` : ''}
Unused Prompts: ${analysis.prompts}
Duplicate Objects: ${analysis.duplicates}

Potential Issues:
${analysis.nullCandidates > 0 ? `  ⚠️  Found ${analysis.nullCandidates} null candidates` : '  ✅ No null candidates found'}
${analysis.prompts > 0 ? `  ⚠️  Found ${analysis.prompts} unused prompts` : '  ✅ No unused prompts found'}
${analysis.duplicates > 0 ? `  ⚠️  Found ${analysis.duplicates} duplicate objects` : '  ✅ No duplicate objects found'}
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
        const xmlContent = e.target.result;
        const repairTool = new XMLRepairTool();
        const result = await repairTool.repairXML(xmlContent);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
} 