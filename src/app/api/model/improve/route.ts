import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PythonShell } from 'python-shell';

// Helper function to check if a file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Execute command asynchronously
function execAsync(command: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${command}`, error);
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function POST(req: Request) {
  try {
    // Get data from request
    const { transcripts } = await req.json();
    
    if (!Array.isArray(transcripts) || transcripts.length === 0) {
      return NextResponse.json(
        { error: 'No valid transcripts provided' }, 
        { status: 400 }
      );
    }
    
    console.log(`Received ${transcripts.length} transcripts for model improvement`);
    
    // Path for training data file
    const modelsDir = path.join(process.cwd(), 'src', 'models');
    const trainingDataDir = path.join(modelsDir, 'training_data');
    
    // Create training directory if it doesn't exist
    await fs.mkdir(trainingDataDir, { recursive: true });
    
    // Save data to JSON file - both raw and cleaned
    const timestamp = Date.now();
    const rawDataFile = path.join(trainingDataDir, `raw_data_${timestamp}.json`);
    const trainingDataFile = path.join(trainingDataDir, `training_data_${timestamp}.json`);
    
    // Prepare data in training format
    const trainingData = transcripts.map((t: any) => ({
      id: t.id,
      source_language: t.sourceLang,
      target_language: t.targetLang,
      source_text: t.transcript,
      target_text: t.translation,
      url: t.url,
      title: t.title
    }));
    
    // Save raw data to file
    await fs.writeFile(rawDataFile, JSON.stringify(trainingData, null, 2));
    console.log(`Saved raw data to ${rawDataFile}`);
    
    // Clean data using text_cleaner.py
    const textCleanerPath = path.join(process.cwd(), 'src', 'lib', 'python', 'text_cleaner.py');
    
    // Check if text_cleaner.py exists
    const cleanerExists = await fileExists(textCleanerPath);
    if (!cleanerExists) {
      console.log('Text cleaner script not found. Using raw data for training.');
      await fs.copyFile(rawDataFile, trainingDataFile);
    } else {
      // Check if Python virtual environment exists
      const venvPath = path.join(process.cwd(), 'venv');
      const venvExists = await fileExists(venvPath);
      
      // Run text_cleaner.py
      try {
        console.log('Cleaning and preparing data with text_cleaner.py...');
        
        let cleanCommand;
        if (venvExists) {
          cleanCommand = `${path.join(venvPath, 'bin', 'python')} ${textCleanerPath} ${rawDataFile} ${trainingDataFile}`;
        } else {
          cleanCommand = `python ${textCleanerPath} ${rawDataFile} ${trainingDataFile}`;
        }
        
        const { stdout, stderr } = await execAsync(cleanCommand);
        console.log('Data cleaning output:', stdout);
        if (stderr) console.error('Data cleaning errors:', stderr);
        
      } catch (cleanErr) {
        console.error('Error cleaning data:', cleanErr);
        // If cleaning fails, use raw data
        await fs.copyFile(rawDataFile, trainingDataFile);
      }
    }
    
    // Check if Python virtual environment exists
    const venvPath = path.join(process.cwd(), 'venv');
    const venvExists = await fileExists(venvPath);
    
    // Check if model directory exists
    const modelDir = path.join(modelsDir, 'nllb_model');
    const modelExists = await fileExists(modelDir);
    
    if (!modelExists) {
      console.log('NLLB model directory not found. Cannot improve model.');
      return NextResponse.json(
        { success: false, message: 'Model directory not found' }, 
        { status: 400 }
      );
    }
    
    // Run Python script for model improvement
    console.log('Starting model improvement process...');
    
    try {
      // Create improvement log file
      const modelImprovementLog = path.join(trainingDataDir, `improvement_log_${timestamp}.txt`);
      
      // Start model improvement process (runs in background and doesn't block response)
      const pythonScript = path.join(process.cwd(), 'src', 'lib', 'python', 'improve_model.py');
      
      let options = {};
      
      if (venvExists) {
        console.log('Using virtual environment for model improvement');
        options = {
          pythonPath: path.join(venvPath, 'bin', 'python'),
          args: [
            trainingDataFile, 
            modelDir, 
            modelImprovementLog,
            '--all-languages'  // Support all languages, not just Hebrew
          ]
        };
      } else {
        console.log('Using system Python for model improvement');
        options = {
          args: [
            trainingDataFile, 
            modelDir, 
            modelImprovementLog,
            '--all-languages'  // Support all languages, not just Hebrew
          ]
        };
      }
      
      // Run script asynchronously
      PythonShell.run(pythonScript, options as any)
        .then(() => {
          console.log('Model improvement completed successfully');
        })
        .catch((err) => {
          console.error('Error during model improvement:', err);
        });
      
      // Return positive response immediately, process runs in background
      return NextResponse.json({
        success: true,
        message: 'Model improvement process started',
        trainingDataSize: transcripts.length,
        timestamp: timestamp
      });
    } catch (err) {
      console.error('Error starting model improvement process:', err);
      return NextResponse.json(
        { error: 'Failed to start model improvement process' }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Server error during model improvement:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// Get model improvement status
export async function GET(req: Request) {
  try {
    const trainingDataDir = path.join(process.cwd(), 'src', 'models', 'training_data');
    await fs.mkdir(trainingDataDir, { recursive: true });
    
    // Read all log files from training directory
    const files = await fs.readdir(trainingDataDir);
    const logFiles = files.filter(f => f.startsWith('improvement_log_'));
    
    // Sort by date (from newest to oldest)
    logFiles.sort().reverse();
    
    // Get the latest log if exists
    let latestLog = null;
    if (logFiles.length > 0) {
      const latestLogContent = await fs.readFile(path.join(trainingDataDir, logFiles[0]), 'utf-8');
      latestLog = {
        filename: logFiles[0],
        content: latestLogContent,
        timestamp: parseInt(logFiles[0].replace('improvement_log_', '').replace('.txt', ''))
      };
    }
    
    // Get all training files
    const trainingFiles = files.filter(f => f.startsWith('training_data_'));
    
    // Calculate total number of transcripts including duplicates
    let totalTranscripts = 0;
    for (const file of trainingFiles.slice(0, 5)) { // Check only the last 5 files for potential overlap
      try {
        const content = await fs.readFile(path.join(trainingDataDir, file), 'utf-8');
        const data = JSON.parse(content);
        totalTranscripts += data.length;
      } catch (e) {
        console.error(`Error reading training file ${file}:`, e);
      }
    }
    
    return NextResponse.json({
      success: true,
      totalImprovementRuns: logFiles.length,
      totalTrainingFiles: trainingFiles.length,
      totalTranscriptsUsed: totalTranscripts,
      latestImprovement: latestLog
    });
  } catch (error) {
    console.error('Error getting model improvement status:', error);
    return NextResponse.json(
      { error: 'Failed to get model improvement status' }, 
      { status: 500 }
    );
  }
} 