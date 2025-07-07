import { XMLRepairTool } from './src/lib/xml-repair.js';
import fs from 'fs';

async function testNullCandidateDetection() {
  try {
    // Read the XML file
    const xmlContent = fs.readFileSync('SAS_9_CA_Profile_for_SAS_Stored_Processes.xml', 'utf8');
    
    // Create repair tool instance
    const repairTool = new XMLRepairTool();
    
    // Analyze the XML
    const doc = repairTool.parser.parseFromString(xmlContent, "text/xml");
    const analysis = repairTool.analyzeXML(doc);
    
    console.log('Analysis Results:');
    console.log(`Total Objects: ${analysis.totalObjects}`);
    console.log(`Null Candidates: ${analysis.nullCandidates}`);
    console.log(`Null Candidate IDs: ${Array.from(analysis.nullCandidateIds).join(', ')}`);
    
    // Check if vi90109 is detected
    if (analysis.nullCandidateIds.has('vi90109')) {
      console.log('✅ SUCCESS: vi90109 is correctly detected as a null candidate');
    } else {
      console.log('❌ FAILURE: vi90109 is NOT detected as a null candidate');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testNullCandidateDetection(); 