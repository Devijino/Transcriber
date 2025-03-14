import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

// Function to check if a file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * API that trains the model on a single transcript, allowing for very quick training.
 * The function takes a single transcript and saves it in a temporary JSON file before training.
 */
export async function POST(req: Request) {
  try {
    const { transcript } = await req.json();
    
    if (!transcript || !transcript.id) {
      return NextResponse.json(
        { error: 'Transcript data is required' },
        { status: 400 }
      );
    }
    
    // Create required directories if they don't exist
    const dataDir = path.join(process.cwd(), 'data');
    const tempDir = path.join(dataDir, 'temp');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Save the single transcript in a temporary file
    const tempFilePath = path.join(tempDir, `single_transcript_${Date.now()}.json`);
    
    // Add identifying information to the transcript
    const enhancedTranscript = {
      ...transcript,
      processedAt: Date.now(),
      source: 'single-training'
    };
    
    fs.writeFileSync(tempFilePath, JSON.stringify([enhancedTranscript], null, 2));
    
    console.log(`Single transcript saved to ${tempFilePath}`);
    
    // Check if data cleaning script exists
    const textCleanerScript = path.join(process.cwd(), 'src', 'lib', 'python', 'text_cleaner.py');
    const hasTextCleaner = await fileExists(textCleanerScript);
    
    // Prepare cleaned file if data cleaning script exists
    let cleanedFilePath = tempFilePath;
    
    if (hasTextCleaner) {
      cleanedFilePath = tempFilePath.replace('.json', '_cleaned.json');
      
      // Run data cleaning script
      try {
        const { stdout, stderr } = await execAsync(
          `python3 ${textCleanerScript} --input ${tempFilePath} --output ${cleanedFilePath}`
        );
        
        console.log('Text cleaner output:', stdout);
        
        if (stderr) {
          console.error('Text cleaner error:', stderr);
        }
      } catch (error) {
        console.error('Failed to run text cleaner:', error);
        // Proceed with original file if cleaning fails
        cleanedFilePath = tempFilePath;
      }
    }
    
    // Run the script to improve the model
    const modelImproveScript = path.join(process.cwd(), 'src', 'lib', 'python', 'improve_model.py');
    const modelDir = path.join(process.cwd(), 'src', 'models');
    
    // Create models directory if it doesn't exist
    if (!fs.existsSync(modelDir)) {
      fs.mkdirSync(modelDir, { recursive: true });
    }
    
    try {
      const { stdout, stderr } = await execAsync(
        `python3 ${modelImproveScript} --data ${cleanedFilePath} --model-dir ${modelDir} --short-training --all-languages`
      );
      
      console.log('Model improvement output:', stdout);
      
      if (stderr && !stderr.includes('INFO') && !stderr.includes('WARNING')) {
        console.error('Model improvement warning:', stderr);
      }
      
      // Save model improvement information for documentation
      const improvementLogDir = path.join(dataDir, 'improvement_logs');
      
      if (!fs.existsSync(improvementLogDir)) {
        fs.mkdirSync(improvementLogDir, { recursive: true });
      }
      
      const logFilePath = path.join(
        improvementLogDir,
        `single_improvement_${Date.now()}.json`
      );
      
      fs.writeFileSync(
        logFilePath,
        JSON.stringify({
          timestamp: Date.now(),
          transcript: enhancedTranscript.id,
          success: true,
          output: stdout,
          warnings: stderr
        }, null, 2)
      );
      
      // Clean up temporary files after use
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      
      if (cleanedFilePath !== tempFilePath && fs.existsSync(cleanedFilePath)) {
        fs.unlinkSync(cleanedFilePath);
      }
      
      return NextResponse.json({ success: true, message: 'Model improved successfully with single transcript' });
      
    } catch (error) {
      console.error('Failed to improve model:', error);
      
      return NextResponse.json(
        { error: 'Failed to improve model', details: error },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error in improve-single API:', error);
    
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
} 