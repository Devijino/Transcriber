import { NextResponse } from 'next/server';

// Maximum chunk size for Google Translate API
const MAX_CHUNK_SIZE = 5000; // Increased from 1000 to 5000 for larger texts

/**
 * מפצל טקסט ארוך לחלקים קטנים יותר תוך שמירה על שלמות משפטים
 */
function splitText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  // מנסה לפצל בגבולות של משפטים
  const parts = [];
  let currentPart = '';
  
  // פיצול לפי משפטים (נקודה, סימן שאלה, סימן קריאה עם רווח אחריהם)
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  for (const sentence of sentences) {
    // אם המשפט עצמו ארוך מדי, נפצל אותו לחלקים בצורה חכמה
    if (sentence.length > maxLength) {
      if (currentPart) {
        parts.push(currentPart);
        currentPart = '';
      }
      
      // חלוקה לפי סימני פיסוק נוספים כמו פסיקים או נקודה-פסיק
      const subSentences = sentence.split(/(?<=[,;])\s+/);
      
      let subPart = '';
      for (const subSentence of subSentences) {
        if (subSentence.length > maxLength) {
          // אם אפילו החלק הקטן ארוך מדי, נחלק לגודל קבוע
          if (subPart) {
            parts.push(subPart);
            subPart = '';
          }
          
          // חלוקה לחלקים קבועים שיישארו מיושרים
          for (let i = 0; i < subSentence.length; i += maxLength) {
            parts.push(subSentence.slice(i, i + maxLength));
          }
        } else if (subPart.length + subSentence.length + 1 > maxLength) {
          parts.push(subPart);
          subPart = subSentence;
        } else {
          subPart += (subPart ? ' ' : '') + subSentence;
        }
      }
      
      if (subPart) {
        parts.push(subPart);
      }
    } 
    // אם הוספת המשפט תחרוג מהגודל המקסימלי
    else if (currentPart.length + sentence.length + 1 > maxLength) {
      parts.push(currentPart);
      currentPart = sentence;
    } 
    // אחרת, נוסיף את המשפט לחלק הנוכחי
    else {
      currentPart += (currentPart ? ' ' : '') + sentence;
    }
  }
  
  // הוספת החלק האחרון אם יש
  if (currentPart) {
    parts.push(currentPart);
  }
  
  return parts;
}

/**
 * מוסיף סימני פיסוק בסיסיים (נקודה, פסיק) לטקסט עברי
 * הפונקציה אינה מוסיפה ניקוד מלא
 */
function addHebrewPunctuation(text: string): string {
  if (!text) return text;
  
  // Check if the text is in Hebrew
  const hebrewRegex = /[\u0590-\u05FF]/;
  if (!hebrewRegex.test(text)) return text;
  
  // וידוא שיש נקודה בסוף כל משפט
  let result = text.replace(/([^\.\?!]\s*)$/gm, "$1.");
  
  // וידוא שאין יותר מדי רווחים
  result = result.replace(/\s{2,}/g, " ");
  
  // וידוא סימני פיסוק נכונים לאחר מילים מסוימות
  const commonPhrases = {
    "לדוגמה": "לדוגמה,",
    "כמו כן": "כמו כן,",
    "בנוסף": "בנוסף,",
    "לסיכום": "לסיכום,",
    "לכן": "לכן,",
    "כגון": "כגון,",
    "למשל": "למשל,",
    "כלומר": "כלומר,",
    "אולם": "אולם,",
    "אבל": "אבל,"
  };
  
  for (const [phrase, replacement] of Object.entries(commonPhrases)) {
    const regex = new RegExp(`${phrase}\\s`, 'g');
    result = result.replace(regex, `${replacement} `);
  }
  
  return result;
}

/**
 * הגדרת כיוון טקסט מימין לשמאל לעברית
 */
function setTextDirection(text: string, targetLang: string): { text: string, direction: string } {
  if (targetLang === 'he' || targetLang === 'ar') {
    // הוספת תווים מיוחדים ליישור מימין לשמאל
    // RLM (Right-to-Left Mark) בתחילת כל פסקה
    const paragraphs = text.split('\n');
    const rtlParagraphs = paragraphs.map(p => {
      // אם הפסקה לא ריקה, מוסיפים RLM בתחילת הפסקה
      if (p.trim()) {
        return '\u200F' + p;
      }
      return p;
    });
    const rtlText = rtlParagraphs.join('\n');
    return { text: rtlText, direction: 'rtl' };
  }
  return { text, direction: 'ltr' };
}

/**
 * ממיר קוד שפה רגיל לקוד שפה של Google
 */
function getGoogleLanguageCode(langCode: string): string {
  const languageMap: Record<string, string> = {
    'en': 'en',
    'he': 'iw',  // Google משתמש ב-iw במקום he לעברית
    'ar': 'ar',
    'ru': 'ru',
    'fr': 'fr',
    'es': 'es',
    'de': 'de',
    'it': 'it',
    'zh': 'zh-CN',
    'ja': 'ja',
    'ko': 'ko',
    'pt': 'pt',
    'hi': 'hi',
    'tr': 'tr',
    'nl': 'nl'
  };
  
  return languageMap[langCode] || langCode;
}

/**
 * ביצוע תרגום באמצעות Google Translate
 * משתמש בממשק חלופי במקרה של כישלון
 */
async function translateWithGoogle(text: string, sourceLang: string, targetLang: string): Promise<{ translation: string, direction: string }> {
  try {
    // פיצול הטקסט לחלקים קטנים יותר
    const chunks = splitText(text, MAX_CHUNK_SIZE);
    const translatedChunks: string[] = [];
    
    // המרה לקודי שפה בפורמט Google
    const googleSourceLang = getGoogleLanguageCode(sourceLang);
    const googleTargetLang = getGoogleLanguageCode(targetLang);
    
    console.log(`Translating with Google from ${googleSourceLang} to ${googleTargetLang} in ${chunks.length} chunks`);
    
    // עיבוד כל חלק בנפרד
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // ניסיון ראשון - שימוש ב-API החינמי הרשמי
        let translatedText = await translateUsingOfficialAPI(chunk, googleSourceLang, googleTargetLang);
        translatedChunks.push(translatedText);
      } catch (error) {
        console.log(`Failed with official API, trying alternative for chunk ${i+1}/${chunks.length}`);
        
        // ניסיון שני - שימוש בממשק חלופי
        try {
          let translatedText = await translateUsingAlternativeAPI(chunk, googleSourceLang, googleTargetLang);
          translatedChunks.push(translatedText);
        } catch (secondError) {
          console.error(`Both translation methods failed for chunk ${i+1}`);
          // במקרה שגם השיטה החלופית נכשלה, נוסיף את הטקסט המקורי
          translatedChunks.push(chunk);
        }
      }
      
      // המתנה קצרה בין בקשות כדי לא לעבור על מגבלת קצב
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // איחוד כל החלקים המתורגמים
    let mergedTranslation = translatedChunks.join(' ');
    
    // הוספת סימני פיסוק ותיקון יישור עבור עברית
    if (targetLang === 'he') {
      mergedTranslation = addHebrewPunctuation(mergedTranslation);
    }
    
    // הגדרת כיוון הטקסט
    const { text: formattedText, direction } = setTextDirection(mergedTranslation, targetLang);
    
    return { translation: formattedText, direction };
  } catch (error) {
    console.error('Google Translate error:', error);
    throw error;
  }
}

/**
 * שימוש ב-API הרשמי של Google
 */
async function translateUsingOfficialAPI(text: string, sourceLang: string, targetLang: string): Promise<string> {
  try {
    // הכנת פרמטרים ל-URL
    const params = new URLSearchParams({
      client: 'gtx',
      sl: sourceLang,
      tl: targetLang,
      dt: 't',
      q: text
    });
    
    // ביצוע הבקשה לשרת של Google
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Google Translate API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // עיבוד התשובה - Google מחזיר מערך מורכב
    let translatedText = '';
    if (data && data[0]) {
      for (const translationPart of data[0]) {
        if (translationPart[0]) {
          translatedText += translationPart[0];
        }
      }
    }
    
    return translatedText;
  } catch (error) {
    console.error('Official API error:', error);
    throw error;
  }
}

/**
 * שימוש בממשק חלופי של Google Translate
 */
async function translateUsingAlternativeAPI(text: string, sourceLang: string, targetLang: string): Promise<string> {
  try {
    // פרמטרים לממשק החלופי
    const params = new URLSearchParams({
      sl: sourceLang,
      tl: targetLang,
      q: text
    });
    
    // שימוש בכתובת חלופית - ממשק לא רשמי
    const response = await fetch(`https://clients5.google.com/translate_a/t?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Alternative API responded with status: ${response.status}`);
    }
    
    // הממשק החלופי מחזיר פורמט אחר
    const data = await response.json();
    
    // מבנה התשובה שונה בממשק זה
    if (Array.isArray(data)) {
      return data[0];
    } else if (typeof data === 'object' && data.sentences) {
      return data.sentences.map((s: any) => s.trans).join(' ');
    }
    
    return String(data);
  } catch (error) {
    console.error('Alternative API error:', error);
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    const { text, sourceLang = 'en', targetLang = 'he', requestId = Date.now().toString() } = await req.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    console.log(`Google Translation request: ${sourceLang} → ${targetLang} (RequestID: ${requestId})`);
    console.log(`Text length: ${text.length} characters, will be split into chunks of ${MAX_CHUNK_SIZE}`);

    try {
      // תרגום באמצעות Google עם ניסיונות חוזרים
      const { translation, direction } = await translateWithGoogle(text, sourceLang, targetLang);
      
      // תשובה חיובית
      console.log(`Translation completed successfully for requestId: ${requestId}`);
      return NextResponse.json({
        success: true,
        original: text,
        translation,
        direction,
        sourceLang,
        targetLang,
        usedGoogle: true
      });
      
    } catch (error) {
      console.error('Translation failed:', error);
      
      // שגיאה - חזרה למקור במקרה כישלון
      return NextResponse.json({ 
        success: false,
        error: 'Translation failed', 
        details: error instanceof Error ? error.message : String(error),
        translation: `שגיאה בתרגום Google. התרגום לא הצליח: ${error instanceof Error ? error.message : String(error)}`
      }, { status: 200 }); // מחזירים 200 כדי שהלקוח יציג את הודעת השגיאה
    }
  } catch (error) {
    console.error('Google Translation API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 