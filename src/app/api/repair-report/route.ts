import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { readdirSync } from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

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

    // Write uploaded file to temporary location
    const bytes = await file.arrayBuffer();
    await writeFile(tempInputPath, Buffer.from(bytes));

    // Get the path to the Python script
    const scriptPath = path.join(process.cwd(), 'tools', 'sas_va_xml_repair.py');

    // Execute the Python script
    const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" "${tempInputPath}"`, {
      cwd: path.dirname(scriptPath),
      timeout: 30000 // 30 second timeout
    });

    // Check if the script executed successfully
    if (stderr && !stderr.includes('INFO')) {
      console.error('Python script stderr:', stderr);
      return NextResponse.json({ error: 'Failed to process XML file' }, { status: 500 });
    }

    // Read the repaired file
    let repairedContent: string;
    let repairedFileName: string = file.name;
    let repairedFilePath: string;

    if (file.name.endsWith('.json')) {
      // For JSON input, the script creates repaired files in the project root directory
      // The script extracts reports and creates {report_name}_repaired.xml files
      const projectRoot = process.cwd();
      const files = readdirSync(projectRoot);
      
      // Look for files ending with _repaired.xml in the project root
      const repairedXmls = files.filter((f: string) => f.endsWith('_repaired.xml'));
      
      if (repairedXmls.length === 0) {
        return NextResponse.json({ error: 'No repaired XML file generated from JSON' }, { status: 500 });
      }
      
      // Use the first repaired XML file
      repairedFileName = repairedXmls[0];
      repairedFilePath = path.join(projectRoot, repairedFileName);
      repairedContent = await readFile(repairedFilePath, 'utf-8');
    } else {
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