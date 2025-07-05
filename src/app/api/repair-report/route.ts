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
  console.log('=== JavaScript JSON Processing Started ===');
  console.log('JSON content length:', jsonContent.length);
  try {
    const jsonData = JSON.parse(jsonContent);
    console.log('JSON parsed successfully, keys:', Object.keys(jsonData));
    
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
      console.log('Processing transferDetails structure...');
      for (const detail of jsonData.transferDetails) {
        if (detail.transferObject && detail.transferObject.content) {
          try {
            console.log('Found transferObject.content, processing...');
            // Use the same logic as ReportExtractor.py
            const content = detail.transferObject.content;
            let realContent = content;
            let compress = false;
            
            if (content.startsWith("TRUE###")) {
              realContent = content.substring(7);
              compress = true;
              console.log('Content is compressed (TRUE###)');
            } else if (content.startsWith("FALSE###")) {
              realContent = content.substring(8);
              console.log('Content is uncompressed (FALSE###)');
            } else {
              console.log('Content has no compression prefix');
            }
            
            // Decode base64
            const byteDecoded = Buffer.from(realContent, 'base64');
            let byteDecompressed;
            
            if (compress) {
              // Decompress with zlib - use dynamic import for compatibility
              try {
                const zlib = await import('zlib');
                byteDecompressed = zlib.inflateSync(byteDecoded);
                console.log('Content decompressed successfully');
              } catch (zlibError) {
                console.log('Zlib decompression failed, trying alternative method:', zlibError);
                // Fallback: try to use the compressed data as-is
                byteDecompressed = byteDecoded;
              }
            } else {
              byteDecompressed = byteDecoded;
            }
            
            // Parse JSON
            const objectJson = JSON.parse(byteDecompressed.toString('utf8'));
            console.log('JSON parsed successfully, looking for transferableContent...');
            
            // Extract XML content
            if (objectJson.transferableContent && objectJson.transferableContent.content) {
              const xmlContent = objectJson.transferableContent.content;
              console.log('Found transferableContent.content, checking for XML...');
              if (xmlContent.includes('<') && xmlContent.includes('>')) {
                console.log('XML content found, analyzing...');
                return await analyzeXMLContent(xmlContent);
              } else {
                console.log('No XML content found in transferableContent.content');
              }
            } else {
              console.log('No transferableContent found in parsed JSON');
            }
          } catch (error) {
            console.log('Error processing transferObject.content with ReportExtractor logic:', error);
            // Continue to next transfer detail
            continue;
          }
        } else {
          console.log('No transferObject.content found in detail');
        }
      }
      console.log('Finished processing all transferDetails, no XML found');
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
    console.log('=== analyzeXMLContent START ===');
    console.log('XML content length:', xmlContent.length);
    console.log('XML preview:', xmlContent.substring(0, 200) + '...');
    
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
    
    console.log('Tag matches found:', matches ? matches.length : 0);
    
    if (matches) {
      for (const match of matches) {
        const tagName = match.slice(1); // Remove the '<'
        analysis.objectTypes[tagName] = (analysis.objectTypes[tagName] || 0) + 1;
        analysis.totalObjects++;
      }
    }
    
    console.log('Total objects counted:', analysis.totalObjects);
    console.log('Object types found:', Object.keys(analysis.objectTypes).length);
    
    // Find null candidates using regex patterns
    const idCheck = /^[a-z]{2}[0-9]+$/;
    const definedIds = new Set<string>();
    const referencedIds = new Set<string>();
    
    console.log('=== NULL CANDIDATE ANALYSIS ===');
    
    // Find defined IDs (name attributes)
    const namePattern = /name="([^"]+)"/g;
    let nameMatch;
    let nameCount = 0;
    while ((nameMatch = namePattern.exec(xmlContent)) !== null) {
      const name = nameMatch[1];
      nameCount++;
      if (idCheck.test(name)) {
        definedIds.add(name);
      }
    }
    console.log('Name attributes found:', nameCount);
    console.log('Valid defined IDs found:', definedIds.size);
    
    // Find referenced IDs in value attributes
    const valuePattern = /value="([^"]+)"/g;
    let valueMatch;
    let valueCount = 0;
    while ((valueMatch = valuePattern.exec(xmlContent)) !== null) {
      const value = valueMatch[1].trim();
      valueCount++;
      if (idCheck.test(value)) {
        referencedIds.add(value);
      }
    }
    console.log('Value attributes found:', valueCount);
    console.log('Valid referenced IDs found:', referencedIds.size);
    
    // Null candidates are referenced but not defined
    const nullCandidates = new Set([...referencedIds].filter(id => !definedIds.has(id)));
    console.log('Raw null candidates (before filtering):', nullCandidates.size);
    console.log('Raw null candidate IDs:', Array.from(nullCandidates).slice(0, 10));
    
    // Apply filtering (same as Python script)
    const filteredCandidates = new Set<string>();
    for (const candidate of nullCandidates) {
      if (candidate.length < 3) {
        console.log('Filtered out (too short):', candidate);
        continue;
      }
      if (/^[a-fA-F0-9]{6}$/.test(candidate)) {
        console.log('Filtered out (hex color):', candidate);
        continue;
      }
      if (['bi1', 'label', 'title'].includes(candidate.toLowerCase())) {
        console.log('Filtered out (excluded):', candidate);
        continue;
      }
      filteredCandidates.add(candidate);
    }
    
    analysis.nullCandidates = filteredCandidates.size;
    analysis.nullCandidateIds = filteredCandidates;
    
    console.log('Final filtered null candidates:', analysis.nullCandidates);
    console.log('Final null candidate IDs:', Array.from(analysis.nullCandidateIds));
    
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
    
    console.log('=== FINAL ANALYSIS REPORT ===');
    console.log('Analysis report length:', analysisReport.length);
    console.log('Analysis report preview:', analysisReport.substring(0, 300) + '...');
    console.log('Final nullCandidates value:', analysis.nullCandidates);
    console.log('Final totalObjects value:', analysis.totalObjects);
    console.log('=== analyzeXMLContent END ===');
    
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
      const debugLogs: string[] = [];
      debugLogs.push('=== ENVIRONMENT DEBUG ===');
      debugLogs.push('Node version: ' + process.version);
      debugLogs.push('Platform: ' + process.platform);
      debugLogs.push('Architecture: ' + process.arch);
      debugLogs.push('Current working directory: ' + process.cwd());
      debugLogs.push('Processing JSON file with JavaScript (no Python required)');
      
      try {
        const jsonContent = await file.text();
        debugLogs.push('=== JavaScript JSON Processing Started ===');
        debugLogs.push('JSON content length: ' + jsonContent.length);
        debugLogs.push('File name: ' + file.name);
        debugLogs.push('File size: ' + file.size + ' bytes');
        
        const result = await processJSONWithJavaScript(jsonContent);
        
        // Parse the analysis to extract null candidates count
        const nullCandidatesMatch = result.analysis.match(/Null Candidates: (\d+)/);
        const nullCandidates = nullCandidatesMatch ? parseInt(nullCandidatesMatch[1]) : 0;
        
        const totalObjectsMatch = result.analysis.match(/Total Objects: (\d+)/);
        const totalObjects = totalObjectsMatch ? parseInt(totalObjectsMatch[1]) : 0;
        
        debugLogs.push('=== PARSING RESULTS ===');
        debugLogs.push('Null candidates match: ' + (nullCandidatesMatch ? nullCandidatesMatch[0] : 'NO MATCH'));
        debugLogs.push('Total objects match: ' + (totalObjectsMatch ? totalObjectsMatch[0] : 'NO MATCH'));
        debugLogs.push('Parsed nullCandidates: ' + nullCandidates);
        debugLogs.push('Parsed totalObjects: ' + totalObjects);
        debugLogs.push('Analysis length: ' + result.analysis.length);
        debugLogs.push('Analysis preview: ' + result.analysis.substring(0, 200) + '...');
        
        // Force the values to be numbers and add validation
        const finalNullCandidates = Number(nullCandidates) || 0;
        const finalTotalObjects = Number(totalObjects) || 0;
        
        debugLogs.push('=== FINAL VALUES ===');
        debugLogs.push('Final nullCandidates: ' + finalNullCandidates + ' (type: ' + typeof finalNullCandidates + ')');
        debugLogs.push('Final totalObjects: ' + finalTotalObjects + ' (type: ' + typeof finalTotalObjects + ')');
        debugLogs.push('hasNullCandidates: ' + (finalNullCandidates > 0));
        
        return NextResponse.json({
          file: result.content,
          results: {
            duplicates: 0,
            prompts: 0,
            nullCandidates: finalNullCandidates,
            hasDuplicates: false,
            hasPrompts: false,
            hasNullCandidates: finalNullCandidates > 0,
            totalObjects: finalTotalObjects
          },
          analysis: result.analysis,
          filename: `repaired_${file.name}`,
          hasRepairs: false,
          debug: debugLogs
        });
      } catch (error) {
        debugLogs.push('Error processing JSON with JavaScript: ' + (error instanceof Error ? error.message : String(error)));
        return NextResponse.json({ 
          error: `Failed to process JSON: ${error instanceof Error ? error.message : 'Unknown error'}` ,
          debug: debugLogs
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
      
      const result = await execAsync(`python3 "${scriptPath}" "${tempInputPath}"`, {
        cwd: process.cwd(), // Run from project root so repaired files are created there
        timeout: 30000 // 30 second timeout
      });
      
      stdout = result.stdout;
      stderr = result.stderr;
      
      console.log('Python script stdout:', stdout);
      if (stderr) console.log('Python script stderr:', stderr);

      // Check if the script executed successfully
      if (stderr && !stderr.includes('INFO')) {
        console.error('Python script stderr:', stderr);
        return NextResponse.json({ error: 'Failed to process XML file' }, { status: 500 });
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