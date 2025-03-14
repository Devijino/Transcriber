import { NextResponse } from 'next/server';
import { PythonShell } from 'python-shell';
import fs from 'fs';
import path from 'path';
import os from 'os';

// מערך גלובלי לאחסון התקדמות התרגום
const translationProgress: Record<string, number> = {};

export async function POST(req: Request) {
  try {
    const { text, sourceLang = 'en', targetLang = 'he', requestId = Date.now().toString() } = await req.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    console.log(`NLLB Translation request: ${sourceLang} → ${targetLang} (RequestID: ${requestId})`);
    console.log(`Text length: ${text.length} characters`);

    // Ensure the models directory exists
    const modelsDir = path.join(process.cwd(), 'src', 'models');
    fs.mkdirSync(modelsDir, { recursive: true });

    // Check if we have a virtual environment
    const venvExists = fs.existsSync(path.join(process.cwd(), 'venv'));
    const useVenv = venvExists && fs.existsSync(path.join(process.cwd(), 'run_venv_python.sh'));

    // Call the Python script for AI translation
    const pythonScriptPath = path.join(process.cwd(), 'src', 'lib', 'python', 'nllb_translator.py');
    
    // Check if script exists
    if (!fs.existsSync(pythonScriptPath)) {
      return NextResponse.json({ 
        error: 'Translation script not found', 
        scriptPath: pythonScriptPath 
      }, { status: 500 });
    }

    // עדכון ערך התחלתי במערך ההתקדמות
    translationProgress[requestId] = 1; // התחלנו עם 1% לפחות

    // Configure options based on whether we have a virtual environment
    let options;
    
    if (useVenv) {
      // Use the virtual environment script
      console.log(`Using virtual environment for Python execution`);
      options = {
        mode: 'text' as const,
        pythonPath: './run_venv_python.sh',
        args: [text, targetLang, sourceLang],
        stderrParser: true as any // שימוש ב-stderrParser במקום stderr
      };
    } else {
      // Use system Python
      console.log(`Using system Python (no virtual environment found)`);
      options = {
        mode: 'text' as const,
        pythonPath: 'python3',
        args: [text, targetLang, sourceLang],
        stderrParser: true as any // שימוש ב-stderrParser במקום stderr
      };
    }

    // Using promise to handle async operation
    return new Promise((resolve, reject) => {
      try {
        // Always run the Python script directly, not through run_venv_python.sh
        const pyshell = new PythonShell(pythonScriptPath, options);
        
        let result = '';
        
        // האזנה לפלט של התהליך
        pyshell.on('stderr', (stderr) => {
          // Check if output contains information about translation progress
          const progressMatch = stderr.match(/Translation progress: (\d+)%/);
          if (progressMatch && progressMatch[1]) {
            const progress = parseInt(progressMatch[1], 10);
            
            // עדכון ההתקדמות במערך הגלובלי
            translationProgress[requestId] = progress;
            
            console.log(`Translation progress: ${progress}%`);
          }
        });
        
        pyshell.on('message', (message) => {
          result = message;
        });
        
        pyshell.on('error', (err) => {
          console.error('Python script error:', err);
          delete translationProgress[requestId];
          resolve(NextResponse.json({ 
            error: 'Translation failed', 
            details: err.message 
          }, { status: 500 }));
        });
        
        pyshell.on('close', () => {
          try {
            // Parse the JSON output from the Python script
            const parsedResult = JSON.parse(result || '{"success": false, "error": "No result"}');
            
            if (parsedResult.success === false) {
              delete translationProgress[requestId];
              resolve(NextResponse.json({ 
                error: parsedResult.error || 'Translation failed' 
              }, { status: 500 }));
              return;
            }
            
            // Success response
            delete translationProgress[requestId];
            resolve(NextResponse.json({
              success: true,
              original: parsedResult.original,
              translation: parsedResult.translation,
              sourceLang: parsedResult.source_language,
              targetLang: parsedResult.target_language,
              nllbSourceLang: parsedResult.source_language_nllb,
              nllbTargetLang: parsedResult.target_language_nllb,
              usedNLLB: parsedResult.used_nllb
            }));
          } catch (parseError) {
            console.error('Error parsing Python output:', parseError);
            console.log('Raw output:', result);
            delete translationProgress[requestId];
            resolve(NextResponse.json({ 
              error: 'Failed to parse translation result',
              rawOutput: result
            }, { status: 500 }));
          }
        });
      } catch (error) {
        console.error('Translation API error:', error);
        resolve(NextResponse.json({ 
          error: 'Internal server error',
          details: error instanceof Error ? error.message : String(error)
        }, { status: 500 }));
      }
    });
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// נקודת קצה חדשה לבדיקת התקדמות התרגום
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestId = url.searchParams.get('requestId');
    
    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }
    
    const progress = translationProgress[requestId] || 0;
    
    return NextResponse.json({ progress });
  } catch (error) {
    console.error('Progress check error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 