const fs = require('fs');
const { XMLRepairTool } = require('./src/lib/xml-repair.js');

async function testDetection() {
  try {
    // Read the test XML file
    const xmlContent = fs.readFileSync('SAS_9_CA_Profile_for_SAS_Stored_Processes.xml', 'utf8');
    
    // Create repair tool instance
    const repairTool = new XMLRepairTool();
    
    // Analyze the XML
    const doc = new DOMParser().parseFromString(xmlContent, "text/xml");
    const analysis = repairTool.analyzeXML(doc);
    
    console.log('=== JavaScript Detection Test ===');
    console.log(`Total Objects: ${analysis.totalObjects}`);
    console.log(`Null Candidates: ${analysis.nullCandidates}`);
    console.log(`Null Candidate IDs: ${Array.from(analysis.nullCandidateIds).sort().join(', ')}`);
    console.log(`Unused Prompts: ${analysis.prompts}`);
    console.log(`Duplicates: ${analysis.duplicates}`);
    
    // Test the repair
    const result = await repairTool.repairXML(xmlContent);
    console.log('\n=== Repair Result ===');
    console.log(`Has Repairs: ${result.hasRepairs}`);
    console.log(`Null Candidates: ${result.results.nullCandidates}`);
    console.log(`Analysis: ${result.analysis}`);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDetection(); 