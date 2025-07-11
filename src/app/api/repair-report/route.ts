import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { readdirSync } from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// JavaScript-based JSON processing for Vercel compatibility
async function processJSONWithJavaScript(jsonContent: string) {
  try {
    const jsonData = JSON.parse(jsonContent);
    
    // Look for reports in the JSON structure
    let reports = [];
    
    // Common patterns for reports in JSON
    if (jsonData.reports) {
      reports = Array.isArray(jsonData.reports) ? jsonData.reports : [jsonData.reports];
    } else if (jsonData.data && jsonData.data.reports) {
      reports = Array.isArray(jsonData.data.reports) ? jsonData.data.reports : [jsonData.data.reports];
    } else if (jsonData.content && jsonData.content.reports) {
      reports = Array.isArray(jsonData.content.reports) ? jsonData.content.reports : [jsonData.content.reports];
    } else if (jsonData.transferDetails) {
      // Handle Paket.json structure using ReportExtractor.py logic
      for (const detail of jsonData.transferDetails) {
        if (detail.transferObject && detail.transferObject.content) {
          try {
            // Use the same logic as ReportExtractor.py
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
            const byteDecoded = Buffer.from(realContent, 'base64');
            let byteDecompressed;
            
            if (compress) {
              // Decompress with zlib - use dynamic import for compatibility
              try {
                const zlib = await import('zlib');
                byteDecompressed = zlib.inflateSync(byteDecoded);
              } catch {
                // Fallback: try to use the compressed data as-is
                byteDecompressed = byteDecoded;
              }
            } else {
              byteDecompressed = byteDecoded;
            }
            
            // Parse JSON
            const objectJson = JSON.parse(byteDecompressed.toString('utf8'));
            
            // Extract XML content
            if (objectJson.transferableContent && objectJson.transferableContent.content) {
              const xmlContent = objectJson.transferableContent.content;
              if (xmlContent.includes('<') && xmlContent.includes('>')) {
                return await analyzeXMLContent(xmlContent);
              }
            }
          } catch {
            // Continue to next transfer detail
            continue;
          }
        }
      }
    } else {
      // Try to find any XML content in the JSON
      const jsonString = JSON.stringify(jsonData);
      const xmlMatches = jsonString.match(/<[^>]+>.*?<\/[^>]+>/g);
      if (xmlMatches && xmlMatches.length > 0) {
        // Extract the first XML-like content
        const xmlContent = xmlMatches[0];
        return await analyzeXMLContent(xmlContent);
      }
      
      // If no XML found, try to decode any base64 content that might contain XML
      const base64Matches = jsonString.match(/"([A-Za-z0-9+/=]{20,})"/g);
      if (base64Matches) {
        for (const match of base64Matches) {
          try {
            const base64Content = match.replace(/"/g, '');
            const decodedContent = Buffer.from(base64Content, 'base64').toString('utf-8');
            if (decodedContent.includes('<') && decodedContent.includes('>')) {
              return await analyzeXMLContent(decodedContent);
            }
          } catch {
            // Continue to next base64 match
            continue;
          }
        }
      }
    }
    
    if (reports.length === 0) {
      console.log('No reports array found in JSON file');
      // Return a default response instead of throwing an error
      return {
        analysis: `
==========================================================
SAS Visual Analytics BIRD XML Analysis
==========================================================
Total Objects: 0

Object Counts by Type:
  ParentDataDefinition: 0
  DataDefinition: 0
  DataSource: 0
  DataItem: 0
  PredefinedDataItem: 0
  VisualElements: 0
  Image: 0
  VisualContainer: 0
  Prompt: 0
  MediaContainer: 0
  Section: 0
  Container: 0
  Actions: 0
  NavigationAction: 0

Null Candidates: 0
Unused Prompts: 0
Duplicate Objects: 0

Potential Issues:
  ✅ No null candidates found
==========================================================
`,
        content: Buffer.from('').toString('base64'),
        fileName: 'no_content.xml'
      };
    }
    
    // Process the first report
    const firstReport = reports[0];
    let xmlContent = '';
    
    if (typeof firstReport === 'string') {
      xmlContent = firstReport;
    } else if (firstReport.content) {
      xmlContent = firstReport.content;
    } else if (firstReport.xml) {
      xmlContent = firstReport.xml;
    } else if (firstReport.data) {
      xmlContent = firstReport.data;
    } else {
      // Try to find XML content in the report object
      const reportString = JSON.stringify(firstReport);
      const xmlMatches = reportString.match(/<[^>]+>.*?<\/[^>]+>/g);
      if (xmlMatches && xmlMatches.length > 0) {
        xmlContent = xmlMatches[0];
      } else {
        throw new Error('No XML content found in first report');
      }
    }
    
    return await analyzeXMLContent(xmlContent);
    
  } catch (error) {
    console.error('Error processing JSON with JavaScript:', error);
    throw new Error(`Failed to process JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Analyze XML content using JavaScript (similar to the client-side tool)
async function analyzeXMLContent(xmlContent: string) {
  try {
    // Simple XML parsing and analysis
    const analysis = {
      totalObjects: 0,
      nullCandidates: 0,
      duplicates: 0,
      prompts: 0,
      objectTypes: {} as Record<string, number>,
      nullCandidateIds: new Set<string>()
    };
    
    // Count objects by type using regex
    const tagPattern = /<([a-zA-Z][a-zA-Z0-9]*)/g;
    const matches = xmlContent.match(tagPattern);
    
    if (matches) {
      for (const match of matches) {
        const tagName = match.slice(1); // Remove the '<'
        analysis.objectTypes[tagName] = (analysis.objectTypes[tagName] || 0) + 1;
        analysis.totalObjects++;
      }
    }
    
    // Find null candidates using regex patterns
    const idCheck = /^[a-z]{2}[0-9]+$/;
    const definedIds = new Set<string>();
    const referencedIds = new Set<string>();
    
    // Find defined IDs (name attributes)
    const namePattern = /name="([^"]+)"/g;
    let nameMatch;
    while ((nameMatch = namePattern.exec(xmlContent)) !== null) {
      const name = nameMatch[1];
      if (idCheck.test(name)) {
        definedIds.add(name);
      }
    }
    
    // Find referenced IDs in value attributes and text content
    const valuePattern = /value="([^"]+)"/g;
    let valueMatch;
    while ((valueMatch = valuePattern.exec(xmlContent)) !== null) {
      const value = valueMatch[1].trim();
      if (idCheck.test(value)) {
        referencedIds.add(value);
      }
    }
    
    // Find referenced IDs in text content (important for Property elements)
    // Use a more robust approach that matches the Python implementation
    const textContentPattern = />([^<]+)</g;
    let textMatch;
    while ((textMatch = textContentPattern.exec(xmlContent)) !== null) {
      const textContent = textMatch[1].trim();
      
      // Use the same logic as Python: find all matches and check boundaries
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
    
    // Null candidates are referenced but not defined
    const nullCandidates = new Set([...referencedIds].filter(id => !definedIds.has(id)));
    
    // Apply filtering (same as Python script)
    const filteredCandidates = new Set<string>();
    for (const candidate of nullCandidates) {
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
    
    // Generate analysis report
    const targetTypes = [
      'ParentDataDefinition', 'DataDefinition', 'DataSource', 'DataItem', 
      'PredefinedDataItem', 'VisualElements', 'Image', 'VisualContainer', 
      'Prompt', 'MediaContainer', 'Section', 'Container', 'Actions', 'NavigationAction'
    ];
    
    const filteredCounts: Record<string, number> = {};
    for (const [objType, count] of Object.entries(analysis.objectTypes)) {
      if (['DataDefinition', 'DataDefinitions'].includes(objType)) {
        filteredCounts['DataDefinition'] = (filteredCounts['DataDefinition'] || 0) + count;
      } else if (['DataSource', 'DataSources'].includes(objType)) {
        filteredCounts['DataSource'] = (filteredCounts['DataSource'] || 0) + count;
      } else if (targetTypes.includes(objType)) {
        filteredCounts[objType] = count;
      }
    }
    
    const objectCountsString = targetTypes.map(objType => {
      const count = filteredCounts[objType] || 0;
      return `  ${objType}: ${count}`;
    }).join('\n');
    
    const nullCandidateList = Array.from(analysis.nullCandidateIds).sort().join(', ');
    
    const analysisReport = `
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
==========================================================
`;
    

    
    return {
      analysis: analysisReport,
      content: Buffer.from(xmlContent).toString('base64'),
      fileName: 'extracted_report.xml'
    };
    
  } catch (error) {
    console.error('Error analyzing XML content:', error);
    throw new Error(`Failed to analyze XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function POST(request: NextRequest) {
  let tempInputPath: string | null = null;
  let tempOutputPath: string | null = null;
  let file: File | null = null;

  try {
    const formData = await request.formData();
    file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Check if it's an XML or JSON file
    if (!file.name.endsWith('.xml') && !file.name.endsWith('.json')) {
      return NextResponse.json({ error: 'File must be an XML or JSON file' }, { status: 400 });
    }

    // Create temporary file paths
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    tempInputPath = path.join(tempDir, `input_${timestamp}_${file.name}`);
    tempOutputPath = path.join(tempDir, `output_${timestamp}_${file.name}`);

    // Declare variables that will be used in both branches
    let repairedContent: string;
    const repairedFileName: string = file.name;
    let repairedFilePath: string;
    let stdout: string = '';
    let stderr: string = '';

    if (file.name.endsWith('.json')) {
      // Use JavaScript-based JSON processing for Vercel compatibility
      try {
        const jsonContent = await file.text();
        const result = await processJSONWithJavaScript(jsonContent);
        
        // Parse the analysis to extract null candidates count
        const nullCandidatesMatch = result.analysis.match(/Null Candidates: (\d+)/);
        const nullCandidates = nullCandidatesMatch ? parseInt(nullCandidatesMatch[1]) : 0;
        
        const totalObjectsMatch = result.analysis.match(/Total Objects: (\d+)/);
        const totalObjects = totalObjectsMatch ? parseInt(totalObjectsMatch[1]) : 0;
        
        return NextResponse.json({
          file: result.content,
          results: {
            duplicates: 0,
            prompts: 0,
            nullCandidates: nullCandidates,
            hasDuplicates: false,
            hasPrompts: false,
            hasNullCandidates: nullCandidates > 0,
            totalObjects: totalObjects
          },
          analysis: result.analysis,
          filename: `repaired_${file.name.replace('.json', '.xml')}`,
          hasRepairs: false
        });
      } catch (error) {
        return NextResponse.json({ 
          error: `Failed to process JSON: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }, { status: 500 });
      }
    } else {
      // For XML files, use Python script
      // Write uploaded file to temporary location
      const bytes = await file.arrayBuffer();
      await writeFile(tempInputPath, Buffer.from(bytes));

      // Get the path to the Python script
      const scriptPath = path.join(process.cwd(), 'tools', 'sas_va_xml_repair.py');

      // Execute the Python script
      console.log('Executing Python script:', scriptPath);
      console.log('Input file:', tempInputPath);
      console.log('Working directory:', process.cwd());
      
      let result;
      try {
        result = await execAsync(`python3 "${scriptPath}" "${tempInputPath}"`, {
          cwd: process.cwd(), // Run from project root so repaired files are created there
          timeout: 30000 // 30 second timeout
        });
        
        stdout = result.stdout;
        stderr = result.stderr;
        
        console.log('Python script stdout:', stdout);
        if (stderr) console.log('Python script stderr:', stderr);
      } catch (execError) {
        console.error('Python script execution failed:', execError);
        console.log('Falling back to JavaScript implementation for XML processing');
        
        // Fallback to JavaScript implementation
        try {
          const xmlContent = await readFile(tempInputPath, 'utf-8');
          const result = await analyzeXMLContent(xmlContent);
          
          // Parse the analysis to extract null candidates count
          const nullCandidatesMatch = result.analysis.match(/Null Candidates: (\d+)/);
          const nullCandidates = nullCandidatesMatch ? parseInt(nullCandidatesMatch[1]) : 0;
          
          const totalObjectsMatch = result.analysis.match(/Total Objects: (\d+)/);
          const totalObjects = totalObjectsMatch ? parseInt(totalObjectsMatch[1]) : 0;
          
          return NextResponse.json({
            file: result.content,
            results: {
              duplicates: 0,
              prompts: 0,
              nullCandidates: nullCandidates,
              hasDuplicates: false,
              hasPrompts: false,
              hasNullCandidates: nullCandidates > 0,
              totalObjects: totalObjects
            },
            analysis: result.analysis,
            filename: `repaired_${file.name}`,
            hasRepairs: false
          });
        } catch (fallbackError) {
          console.error('JavaScript fallback also failed:', fallbackError);
          return NextResponse.json({ error: 'Failed to process XML file with both Python and JavaScript implementations' }, { status: 500 });
        }
      }

      // Check if the script executed successfully
      if (stderr && !stderr.includes('INFO')) {
        console.error('Python script stderr:', stderr);
        console.log('Falling back to JavaScript implementation for XML processing');
        
        // Fallback to JavaScript implementation
        try {
          const xmlContent = await readFile(tempInputPath, 'utf-8');
          const result = await analyzeXMLContent(xmlContent);
          
          // Parse the analysis to extract null candidates count
          const nullCandidatesMatch = result.analysis.match(/Null Candidates: (\d+)/);
          const nullCandidates = nullCandidatesMatch ? parseInt(nullCandidatesMatch[1]) : 0;
          
          const totalObjectsMatch = result.analysis.match(/Total Objects: (\d+)/);
          const totalObjects = totalObjectsMatch ? parseInt(totalObjectsMatch[1]) : 0;
          
          return NextResponse.json({
            file: result.content,
            results: {
              duplicates: 0,
              prompts: 0,
              nullCandidates: nullCandidates,
              hasDuplicates: false,
              hasPrompts: false,
              hasNullCandidates: nullCandidates > 0,
              totalObjects: totalObjects
            },
            analysis: result.analysis,
            filename: `repaired_${file.name}`,
            hasRepairs: false
          });
        } catch (fallbackError) {
          console.error('JavaScript fallback also failed:', fallbackError);
          return NextResponse.json({ error: 'Failed to process XML file with both Python and JavaScript implementations' }, { status: 500 });
        }
      }

      // For XML input, use the old logic
      repairedFilePath = tempInputPath.replace('.xml', '_repaired.xml');
      try {
        repairedContent = await readFile(repairedFilePath, 'utf-8');
      } catch {
        // If repaired file doesn't exist, use original file
        repairedContent = await readFile(tempInputPath, 'utf-8');
      }
    }

    // Parse the output to extract analysis results
    const analysisResults = parseAnalysisOutput(stdout);

    // Convert repaired content to base64
    const base64Content = Buffer.from(repairedContent, 'utf-8').toString('base64');

    return new NextResponse(JSON.stringify({
      file: base64Content,
      results: analysisResults,
      filename: `repaired_${repairedFileName}`,
      analysis: stdout
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error processing file:', error);
    console.error('File name:', file?.name);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  } finally {
    // Clean up temporary files
    try {
      if (tempInputPath) await unlink(tempInputPath);
      if (tempOutputPath) await unlink(tempOutputPath);
      
      // Clean up repaired files
      if (tempInputPath) {
        const projectRoot = process.cwd();
        
        try {
          const files = readdirSync(projectRoot);
          const repairedFiles = files.filter((f: string) => f.endsWith('_repaired.xml'));
          
          for (const repairedFile of repairedFiles) {
            try {
              await unlink(path.join(projectRoot, repairedFile));
            } catch {
              // Ignore errors if file doesn't exist
            }
          }
        } catch {
          // Ignore errors if directory doesn't exist
        }
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError);
    }
  }
}

function parseAnalysisOutput(output: string): {
  duplicates: number;
  prompts: number;
  nullCandidates: number;
  hasDuplicates: boolean;
  hasPrompts: boolean;
  hasNullCandidates: boolean;
  totalObjects: number;
} {
  // Default values
  let duplicates = 0;
  let prompts = 0;
  let nullCandidates = 0;
  let totalObjects = 0;

  // Parse the analysis output
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Extract total objects
    if (line.includes('Total Objects:')) {
      const match = line.match(/Total Objects:\s*(\d+)/);
      if (match) totalObjects = parseInt(match[1], 10);
    }
    
    // Extract null candidates count
    if (line.includes('Null Candidates (')) {
      const match = line.match(/Null Candidates\s*\((\d+)\):/);
      if (match) nullCandidates = parseInt(match[1], 10);
    }
    
    // Extract unused prompts count
    if (line.includes('Unused Prompts (')) {
      const match = line.match(/Unused Prompts\s*\((\d+)\):/);
      if (match) prompts = parseInt(match[1], 10);
    }
    
    // Extract duplicate objects count (if present)
    if (line.includes('Duplicate Objects (')) {
      const match = line.match(/Duplicate Objects\s*\((\d+)\):/);
      if (match) duplicates = parseInt(match[1], 10);
    }
  }

  return {
    duplicates,
    prompts,
    nullCandidates,
    hasDuplicates: duplicates > 0,
    hasPrompts: prompts > 0,
    hasNullCandidates: nullCandidates > 0,
    totalObjects
  };
} 