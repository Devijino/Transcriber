import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * API לשמירת תמלולים כקבצי JSON קבועים בשרת.
 * זה מאפשר לשמור את התמלולים גם כאשר יש רענון של הדפדפן או אתחול מחדש של השרת.
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
    
    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    const transcriptsDir = path.join(dataDir, 'transcripts');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(transcriptsDir)) {
      fs.mkdirSync(transcriptsDir, { recursive: true });
    }
    
    // שמירת התמלול בקובץ JSON עם מזהה ייחודי
    const filePath = path.join(transcriptsDir, `${transcript.id}.json`);
    
    // הוספת מידע מזהה לתמלול
    const enhancedTranscript = {
      ...transcript,
      savedAt: Date.now()
    };
    
    fs.writeFileSync(filePath, JSON.stringify(enhancedTranscript, null, 2));
    
    console.log(`Transcript ${transcript.id} saved to ${filePath}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Transcript saved successfully',
      filePath: filePath
    });
    
  } catch (error) {
    console.error('Error saving transcript:', error);
    
    return NextResponse.json(
      { error: 'Failed to save transcript', details: error },
      { status: 500 }
    );
  }
}

/**
 * מקבל את כל התמלולים השמורים מתיקיית הנתונים
 */
export async function GET(req: Request) {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const transcriptsDir = path.join(dataDir, 'transcripts');
    
    // אם התיקייה לא קיימת, מחזיר רשימה ריקה
    if (!fs.existsSync(transcriptsDir)) {
      return NextResponse.json({ transcripts: [] });
    }
    
    // קריאת כל קבצי ה-JSON מהתיקייה
    const files = fs.readdirSync(transcriptsDir);
    const transcripts = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(transcriptsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        try {
          const transcript = JSON.parse(content);
          transcripts.push(transcript);
        } catch (e) {
          console.error(`Error parsing transcript file ${file}:`, e);
        }
      }
    }
    
    return NextResponse.json({ 
      transcripts,
      count: transcripts.length
    });
    
  } catch (error) {
    console.error('Error loading transcripts:', error);
    
    return NextResponse.json(
      { error: 'Failed to load transcripts', details: error },
      { status: 500 }
    );
  }
} 