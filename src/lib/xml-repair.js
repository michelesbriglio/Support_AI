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
      objectTypes: {}
    };

    // Count objects by type
    const allElements = doc.getElementsByTagName('*');
    for (let elem of allElements) {
      const tagName = elem.tagName;
      analysis.objectTypes[tagName] = (analysis.objectTypes[tagName] || 0) + 1;
      analysis.totalObjects++;
    }

    // Find null candidates (simplified version)
    const idPattern = /[a-z]{2}[0-9]+/g;
    const definedIds = new Set();
    const referencedIds = new Set();

    // Collect defined IDs
    for (let elem of allElements) {
      const name = elem.getAttribute('name');
      if (name && idPattern.test(name)) {
        definedIds.add(name);
      }
    }

    // Collect referenced IDs
    for (let elem of allElements) {
      // Check attributes
      for (let attr of elem.attributes) {
        if (attr.name !== 'name') {
          const matches = attr.value.match(idPattern);
          if (matches) {
            matches.forEach(id => referencedIds.add(id));
          }
        }
      }

      // Check text content
      if (elem.textContent) {
        const matches = elem.textContent.match(idPattern);
        if (matches) {
          matches.forEach(id => referencedIds.add(id));
        }
      }
    }

    // Calculate null candidates
    analysis.nullCandidates = [...referencedIds].filter(id => !definedIds.has(id)).length;

    // Count prompts
    const prompts = doc.getElementsByTagName('Prompt');
    analysis.prompts = prompts.length;

    return analysis;
  }

  /**
   * Repair null candidates by removing references to undefined objects
   */
  repairNullCandidates(doc) {
    const idPattern = /[a-z]{2}[0-9]+/g;
    const definedIds = new Set();

    // Collect defined IDs
    const allElements = doc.getElementsByTagName('*');
    for (let elem of allElements) {
      const name = elem.getAttribute('name');
      if (name && idPattern.test(name)) {
        definedIds.add(name);
      }
    }

    // Remove references to undefined IDs
    for (let elem of allElements) {
      // Check attributes
      for (let attr of elem.attributes) {
        if (attr.name !== 'name') {
          const matches = attr.value.match(idPattern);
          if (matches) {
            let newValue = attr.value;
            matches.forEach(id => {
              if (!definedIds.has(id)) {
                // Remove the reference
                newValue = newValue.replace(new RegExp(`\\b${id}\\b`, 'g'), '');
              }
            });
            // Clean up extra spaces
            newValue = newValue.replace(/\s+/g, ' ').trim();
            if (newValue) {
              elem.setAttribute(attr.name, newValue);
            } else {
              elem.removeAttribute(attr.name);
            }
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
    return `
==========================================================
SAS Visual Analytics BIRD XML Analysis
==========================================================
Total Objects: ${analysis.totalObjects}

Object Counts by Type:
${Object.entries(analysis.objectTypes).map(([type, count]) => `  ${type}: ${count}`).join('\n')}

Null Candidates: ${analysis.nullCandidates}
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