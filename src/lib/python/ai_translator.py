import os
import sys
import json
import time

# Create directory for storing models
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

class AITranslator:
    def __init__(self, src_lang="en", tgt_lang="he"):
        """Initialize the AI translator with source and target languages."""
        self.src_lang = src_lang
        self.tgt_lang = tgt_lang
        
        # מילון עזר לתרגום פשוט במקרה של כשל בטעינת המודל
        self.simple_dictionary = {
            "hello": "שלום",
            "world": "עולם",
            "app": "אפליקציה",
            "development": "פיתוח",
            "great": "מעולה",
            "android": "אנדרואיד",
            "studio": "סטודיו",
            "programming": "תכנות",
            "application": "יישום",
            "video": "וידאו",
            "language": "שפה",
            "project": "פרויקט",
            "translator": "מתרגם",
            "translation": "תרגום",
            "artificial": "מלאכותי",
            "intelligence": "בינה",
            "AI": "בינה מלאכותית",
            "file": "קובץ",
            "computer": "מחשב",
            "technology": "טכנולוגיה",
            "download": "הורדה",
            "install": "התקנה",
            "setup": "הגדרה",
            "model": "מודל",
            "local": "מקומי",
            "private": "פרטי",
            "code": "קוד",
            "python": "פייתון",
            "javascript": "ג'אווהסקריפט",
            "html": "HTML",
            "css": "CSS",
            "web": "רשת",
            "internet": "אינטרנט",
            "youtube": "יוטיוב",
            "audio": "שמע",
            "transcript": "תמליל",
            "subtitles": "כתוביות",
            "music": "מוזיקה",
            "error": "שגיאה",
            "success": "הצלחה",
            "software": "תוכנה",
            "button": "כפתור",
            "click": "לחיצה",
            "user": "משתמש",
            "interface": "ממשק",
            "options": "אפשרויות",
            "settings": "הגדרות"
        }
        
        try:
            print(f"Initializing translator for {self.src_lang} to {self.tgt_lang}...", file=sys.stderr)
            
            try:
                # ניסיון לייבא את הספריות הנדרשות
                import torch
                from transformers import MarianMTModel, MarianTokenizer
                
                # הגדרת שם המודל לפי זוג השפות
                if self.src_lang == "en" and self.tgt_lang == "he":
                    self.model_name = "Helsinki-NLP/opus-mt-en-he"
                elif self.src_lang == "he" and self.tgt_lang == "en":
                    self.model_name = "Helsinki-NLP/opus-mt-he-en"
                else:
                    # לשפות אחרות ננסה למצוא מודל מתאים
                    self.model_name = f"Helsinki-NLP/opus-mt-{self.src_lang}-{self.tgt_lang}"
                
                print(f"Loading model: {self.model_name}", file=sys.stderr)
                
                # טעינת המודל והטוקנייזר עם cache מקומי
                self.tokenizer = MarianTokenizer.from_pretrained(self.model_name, cache_dir=MODELS_DIR)
                self.model = MarianMTModel.from_pretrained(self.model_name, cache_dir=MODELS_DIR)
                
                print("Model loaded successfully!", file=sys.stderr)
                self.model_loaded = True
                self.use_transformers = True
                
            except Exception as import_error:
                print(f"Failed to load transformers model: {str(import_error)}", file=sys.stderr)
                print("Trying to use googletrans as fallback...", file=sys.stderr)
                
                # ניסיון לטעון את googletrans כגיבוי
                try:
                    from googletrans import Translator
                    self.translator = Translator()
                    print("Googletrans initialized successfully!", file=sys.stderr)
                    self.model_loaded = True
                    self.use_transformers = False
                except Exception as googletrans_error:
                    print(f"Failed to initialize googletrans: {str(googletrans_error)}", file=sys.stderr)
                    print("Will use simple dictionary translation", file=sys.stderr)
                    self.model_loaded = False
                    self.use_transformers = False
            
        except Exception as e:
            print(f"Failed to initialize translator: {str(e)}", file=sys.stderr)
            self.model_loaded = False
            self.use_transformers = False
    
    def translate(self, text):
        """תרגום הטקסט באמצעות המודל הטעון"""
        try:
            if not text or not text.strip():
                return ""
            
            start_time = time.time()
            
            if self.model_loaded:
                if self.use_transformers:
                    # תרגום באמצעות MarianMT
                    print(f"Translating with MarianMT model...", file=sys.stderr)
                    
                    # פיצול הטקסט לחלקים קטנים כדי למנוע חריגות זיכרון
                    # MarianMT מוגבל בכמות המילים שהוא יכול לתרגם בבת אחת
                    sentences = self._split_text(text)
                    translated_sentences = []
                    
                    for i, sentence in enumerate(sentences):
                        if i % 10 == 0:
                            print(f"Translating batch {i+1}/{len(sentences)}...", file=sys.stderr)
                        
                        # המרת הטקסט לטוקנים
                        inputs = self.tokenizer(sentence, return_tensors="pt", padding=True, truncation=True, max_length=512)
                        
                        # תרגום
                        translated = self.model.generate(**inputs)
                        
                        # המרה חזרה לטקסט
                        translated_text = self.tokenizer.batch_decode(translated, skip_special_tokens=True)[0]
                        translated_sentences.append(translated_text)
                    
                    full_translation = " ".join(translated_sentences)
                    
                    # התאמות לעברית במידת הצורך
                    if self.tgt_lang == "he":
                        full_translation = self._fix_hebrew_text(full_translation)
                    
                    print(f"Translation completed in {time.time() - start_time:.2f} seconds", file=sys.stderr)
                    return full_translation
                    
                else:
                    # תרגום באמצעות googletrans
                    print("Using googletrans for translation...", file=sys.stderr)
                    
                    # פיצול לחלקים כדי להתמודד עם מגבלות אורך
                    max_chunk_size = 5000
                    chunks = [text[i:i+max_chunk_size] for i in range(0, len(text), max_chunk_size)]
                    translations = []
                    
                    for i, chunk in enumerate(chunks):
                        print(f"Translating chunk {i+1}/{len(chunks)}...", file=sys.stderr)
                        try:
                            result = self.translator.translate(chunk, dest=self.tgt_lang, src=self.src_lang)
                            translations.append(result.text)
                        except Exception as e:
                            print(f"Error translating chunk {i+1}: {str(e)}", file=sys.stderr)
                            # במקרה של שגיאה, ננסה לתרגם באמצעות המילון הפשוט
                            translations.append(self._simple_translate(chunk))
                    
                    full_translation = " ".join(translations)
                    print(f"Translation completed in {time.time() - start_time:.2f} seconds", file=sys.stderr)
                    return full_translation
            
            # אם המודל לא הוטען, נשתמש בתרגום מילון פשוט
            print("Using simple dictionary translation...", file=sys.stderr)
            result = self._simple_translate(text)
            print(f"Simple translation completed in {time.time() - start_time:.2f} seconds", file=sys.stderr)
            return result
            
        except Exception as e:
            print(f"Translation error: {str(e)}", file=sys.stderr)
            return f"[שגיאה בתרגום: {str(e)}]"
    
    def _split_text(self, text, max_length=400):
        """פיצול הטקסט למשפטים או חלקים קטנים יותר"""
        # חיפוש נקודות טובות לפיצול (סוף משפט)
        import re
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        result = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) < max_length:
                current_chunk += " " + sentence if current_chunk else sentence
            else:
                if current_chunk:
                    result.append(current_chunk)
                # אם המשפט הבודד ארוך מדי, נפצל אותו לחלקים
                if len(sentence) > max_length:
                    sentence_parts = [sentence[i:i+max_length] for i in range(0, len(sentence), max_length)]
                    result.extend(sentence_parts)
                    current_chunk = ""
                else:
                    current_chunk = sentence
        
        if current_chunk:
            result.append(current_chunk)
            
        return result
    
    def _simple_translate(self, text):
        """תרגום פשוט באמצעות מילון"""
        words = text.split()
        translated_words = []
        
        for word in words:
            # הסרת סימני פיסוק לפני החיפוש במילון
            clean_word = word.strip('.,!?;:"\'()[]{}').lower()
            
            if clean_word in self.simple_dictionary:
                # שמירה על סימני הפיסוק בתוצאה
                punctuation = word[len(clean_word):] if len(clean_word) < len(word) else ""
                prefix = word[:len(word)-len(clean_word)-len(punctuation)] if len(clean_word) + len(punctuation) < len(word) else ""
                translated_words.append(prefix + self.simple_dictionary[clean_word] + punctuation)
            else:
                # אם המילה לא נמצאת במילון, נשאיר אותה כפי שהיא
                translated_words.append(word)
        
        # עבור עברית צריך להפוך את סדר המילים
        if self.tgt_lang == "he":
            return " ".join(reversed(translated_words))
        else:
            return " ".join(translated_words)
    
    def _fix_hebrew_text(self, text):
        """תיקון בעיות נפוצות בטקסט עברי מתורגם"""
        # תיקון רווחים מיותרים לפני סימני פיסוק
        text = text.replace(" .", ".")
        text = text.replace(" ,", ",")
        text = text.replace(" :", ":")
        text = text.replace(" ;", ";")
        text = text.replace(" !", "!")
        text = text.replace(" ?", "?")
        
        return text

def process_translation_request(text, source_lang="en", target_lang="he"):
    """מעבד בקשת תרגום ומחזיר תשובה ב-JSON"""
    try:
        print(f"Starting translation from {source_lang} to {target_lang}...", file=sys.stderr)
        print(f"Text length: {len(text)} characters", file=sys.stderr)
        
        translator = AITranslator(src_lang=source_lang, tgt_lang=target_lang)
        translation = translator.translate(text)
        
        print("Translation completed successfully", file=sys.stderr)
        
        return json.dumps({
            "success": True,
            "original": text,
            "translation": translation,
            "source_language": source_lang,
            "target_language": target_lang,
            "used_transformers": getattr(translator, "use_transformers", False)
        })
    except Exception as e:
        error_message = str(e)
        print(f"Error: {error_message}", file=sys.stderr)
        return json.dumps({
            "success": False,
            "error": error_message
        })

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False, 
            "error": "Missing arguments. Usage: python ai_translator.py <text> <target_language> [source_language]"
        }))
        sys.exit(1)
        
    text = sys.argv[1]
    target_language = sys.argv[2]
    source_language = sys.argv[3] if len(sys.argv) > 3 else "en"
    
    print(process_translation_request(text, source_language, target_language)) 