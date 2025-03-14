import os
import sys
import json
import time

# Create directory for storing models if it doesn't exist
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

class NLLBTranslator:
    """
    NLLB (No Language Left Behind) translator from Meta AI
    Supports 200 different languages
    """
    def __init__(self, src_lang="eng_Latn", tgt_lang="heb_Hebr"):
        """
        Initialize the translator with source and target languages
        
        In NLLB, language codes are different from the usual. For example:
        - English: eng_Latn
        - Hebrew: heb_Hebr
        - Arabic: arb_Arab
        - Russian: rus_Cyrl
        - Spanish: spa_Latn
        - French: fra_Latn
        - German: deu_Latn
        """
        self.src_lang = src_lang
        self.tgt_lang = tgt_lang
        self.supported_langs = self._get_supported_languages()
        
        # Helper dictionary for simple translation in case of model load failure
        self.simple_dictionary = {
            # Basic words
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
            
            # Additional words
            "the": "ה",
            "and": "ו",
            "in": "ב",
            "of": "של",
            "to": "ל",
            "for": "בשביל",
            "with": "עם",
            "this": "זה",
            "that": "זה",
            "is": "הוא",
            "are": "הם",
            "was": "היה",
            "were": "היו",
            "be": "להיות",
            "have": "יש",
            "has": "יש",
            "a": "",
            "an": "",
            "on": "על",
            "at": "ב",
            "from": "מ",
            "by": "על ידי",
            "about": "על",
            "like": "כמו",
            "as": "כ",
            "or": "או",
            "but": "אבל",
            "not": "לא",
            "no": "לא",
            "yes": "כן",
            "good": "טוב",
            "bad": "רע",
            "new": "חדש",
            "old": "ישן",
            "big": "גדול",
            "small": "קטן",
            "high": "גבוה",
            "low": "נמוך",
            "more": "יותר",
            "less": "פחות",
            "many": "הרבה",
            "few": "מעט",
            "very": "מאוד",
            "much": "הרבה",
            "time": "זמן",
            "day": "יום",
            "night": "לילה",
            "year": "שנה",
            "month": "חודש",
            "week": "שבוע",
            "today": "היום",
            "tomorrow": "מחר",
            "yesterday": "אתמול",
            "now": "עכשיו",
            "then": "אז",
            "here": "כאן",
            "there": "שם",
            "work": "עבודה",
            "job": "עבודה",
            "money": "כסף",
            "home": "בית",
            "house": "בית",
            "family": "משפחה",
            "friend": "חבר",
            "people": "אנשים",
            "person": "אדם",
            "man": "איש",
            "woman": "אישה",
            "child": "ילד",
            "children": "ילדים",
            "boy": "ילד",
            "girl": "ילדה",
            "country": "מדינה",
            "city": "עיר",
            "street": "רחוב",
            "water": "מים",
            "food": "אוכל",
            "book": "ספר",
            "movie": "סרט",
            "song": "שיר",
            "music": "מוזיקה",
            "computer": "מחשב",
            "phone": "טלפון",
            "internet": "אינטרנט",
            "happy": "שמח",
            "sad": "עצוב",
            "love": "אהבה",
            "help": "עזרה",
            "start": "התחלה",
            "end": "סוף",
            "first": "ראשון",
            "last": "אחרון",
            "top": "למעלה",
            "bottom": "למטה",
            "right": "ימין",
            "left": "שמאל",
            "important": "חשוב",
            "learn": "ללמוד",
            "teach": "ללמד",
            "student": "תלמיד",
            "teacher": "מורה",
            "school": "בית ספר",
            "university": "אוניברסיטה",
            "hello": "שלום",
            "goodbye": "להתראות",
            "thanks": "תודה",
            "please": "בבקשה",
            "sorry": "סליחה",
            "excuse": "סליחה",
            "how": "איך",
            "why": "למה",
            "what": "מה",
            "when": "מתי",
            "where": "איפה",
            "who": "מי",
            "which": "איזה",
            "youtube": "יוטיוב",
            "video": "וידאו",
            "watch": "לצפות",
            "view": "צפייה",
            "can": "יכול",
            "can't": "לא יכול",
            "do": "לעשות",
            "does": "עושה",
            "don't": "לא",
            "make": "לעשות",
            "get": "לקבל",
            "go": "ללכת",
            "see": "לראות",
            "look": "להסתכל",
            "take": "לקחת",
            "come": "לבוא",
            "find": "למצוא",
            "give": "לתת",
            "use": "להשתמש",
            "tell": "לספר",
            "ask": "לשאול",
            "say": "לומר",
            "show": "להראות",
            "try": "לנסות",
            "need": "צריך",
            "want": "רוצה",
            "think": "לחשוב",
            "know": "לדעת",
            "feel": "להרגיש",
            "live": "לחיות",
            "run": "לרוץ",
            "walk": "ללכת",
            "write": "לכתוב",
            "read": "לקרוא",
            "listen": "להקשיב",
            "hear": "לשמוע",
            "speak": "לדבר",
            "talk": "לדבר",
            "call": "לקרוא",
            "play": "לשחק",
            "stop": "לעצור",
            "wait": "לחכות",
            "let": "לתת",
            "let's": "בואו",
            "leave": "לעזוב",
            "keep": "לשמור",
            "follow": "לעקוב"
        }
        
        try:
            print(f"Initializing NLLB translator for {self.src_lang} to {self.tgt_lang}...", file=sys.stderr)
            
            try:
                # Load the model and tokenizer
                from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
                
                # Define model name - use the smaller version for memory savings
                self.model_name = "./src/models/nllb_model"
                
                print(f"Loading model: {self.model_name}", file=sys.stderr)
                
                # Load the model and tokenizer with local cache
                # Add src_lang as a parameter
                try:
                    # Try to add src_lang and tgt_lang as parameters to the tokenizer
                    self.tokenizer = AutoTokenizer.from_pretrained(
                        self.model_name, 
                        cache_dir=MODELS_DIR, 
                        src_lang=self.src_lang,
                        tgt_lang=self.tgt_lang
                    )
                except Exception as tokenizer_error:
                    print(f"Error loading tokenizer with src_lang and tgt_lang: {str(tokenizer_error)}", file=sys.stderr)
                    print("Trying to load tokenizer without language parameters...", file=sys.stderr)
                    # If that fails, load the tokenizer without language parameters
                    self.tokenizer = AutoTokenizer.from_pretrained(self.model_name, cache_dir=MODELS_DIR)
                
                # Load the model
                self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_name, cache_dir=MODELS_DIR)
                
                # Alternative method to get the BOS token ID for the target language
                # In newer versions of the library, the lang_code_to_id feature might not exist
                # Or there might be a different usage in the src_lang and tgt_lang variables
                self.tgt_token = f"__{self.tgt_lang}__"
                print(f"Setting target language token to: {self.tgt_token}", file=sys.stderr)
                
                print("NLLB model loaded successfully!", file=sys.stderr)
                self.model_loaded = True
                
            except Exception as import_error:
                print(f"Failed to load NLLB model: {str(import_error)}", file=sys.stderr)
                print("Will use simple dictionary translation", file=sys.stderr)
                self.model_loaded = False
            
        except Exception as e:
            print(f"Failed to initialize translator: {str(e)}", file=sys.stderr)
            self.model_loaded = False
    
    def translate(self, text):
        """Translate the text using the loaded model"""
        try:
            if not text or not text.strip():
                return ""
            
            start_time = time.time()
            
            if self.model_loaded:
                # Translate using NLLB
                print(f"Translating with NLLB model...", file=sys.stderr)
                
                # Split the text into smaller chunks to prevent memory issues
                sentences = self._split_text(text)
                translated_sentences = []
                total_sentences = len(sentences)
                
                for i, sentence in enumerate(sentences):
                    # Report translation progress in percentages
                    progress_percent = int((i / total_sentences) * 100)
                    print(f"Translation progress: {progress_percent}% ({i+1}/{total_sentences})", file=sys.stderr)
                    
                    if i % 5 == 0:
                        print(f"Translating batch {i+1}/{len(sentences)}...", file=sys.stderr)
                    
                    # Convert the text to tokens
                    inputs = self.tokenizer(sentence, return_tensors="pt", padding=True, truncation=True, max_length=512)
                    
                    # Translate
                    try:
                        # First attempt - using the newer method (newer versions of transformers)
                        if hasattr(self.tokenizer, 'lang_code_to_id'):
                            print(f"Using lang_code_to_id method with {self.tgt_lang}", file=sys.stderr)
                            forced_bos_token_id = self.tokenizer.lang_code_to_id[self.tgt_lang]
                        else:
                            # Alternative method to handle target language
                            print(f"Using tgt_token method with {self.tgt_token}", file=sys.stderr)
                            forced_bos_token_id = self.tokenizer.convert_tokens_to_ids(self.tgt_token)
                            
                        translated = self.model.generate(
                            **inputs,
                            forced_bos_token_id=forced_bos_token_id,
                            max_length=512
                        )
                    except (KeyError, AttributeError) as e:
                        # Second attempt - pass target language to generate
                        print(f"First generation attempt failed: {str(e)}", file=sys.stderr)
                        print("Trying alternative method...", file=sys.stderr)
                        
                        try:
                            # Reload the tokenizer with target language
                            self.tokenizer = AutoTokenizer.from_pretrained(
                                self.model_name, 
                                cache_dir=MODELS_DIR,
                                src_lang=self.src_lang, 
                                tgt_lang=self.tgt_lang
                            )
                            
                            # Add target language to translation dictionary - attempt a'
                            if hasattr(self.tokenizer, '_convert_token_to_id_with_added_voc'):
                                inputs.update({"forced_bos_token_id": self.tokenizer._convert_token_to_id_with_added_voc(self.tgt_lang)})
                            # Attempt b'
                            elif hasattr(self.tokenizer, 'convert_tokens_to_ids'):
                                token_id = self.tokenizer.convert_tokens_to_ids(f"__{self.tgt_lang}__")
                                if token_id != self.tokenizer.unk_token_id:  # If it's not the unknown token
                                    inputs.update({"forced_bos_token_id": token_id})
                            
                            translated = self.model.generate(
                                **inputs,
                                max_length=512
                            )
                        except Exception as gen_error:
                            # Final attempt - reload the model
                            print(f"Second generation attempt failed: {str(gen_error)}", file=sys.stderr)
                            print("Trying final method...", file=sys.stderr)
                            
                            # Reload the model
                            inputs = self.tokenizer(sentence, return_tensors="pt", padding=True, truncation=True, max_length=512)
                            translated = self.model.generate(
                                **inputs,
                                max_length=512,
                                tgt_lang=self.tgt_lang  # Final attempt - use direct parameter
                            )
                    
                    # Convert back to text
                    translated_text = self.tokenizer.batch_decode(translated, skip_special_tokens=True)[0]
                    translated_sentences.append(translated_text)
                
                print(f"Translation progress: 100% ({total_sentences}/{total_sentences})", file=sys.stderr)
                
                full_translation = " ".join(translated_sentences)
                
                # Hebrew fixes as needed
                if self.tgt_lang == "heb_Hebr":
                    full_translation = self._fix_hebrew_text(full_translation)
                
                print(f"Translation completed in {time.time() - start_time:.2f} seconds", file=sys.stderr)
                return full_translation
            
            # If the model didn't load, use simple dictionary translation
            print("Using simple dictionary translation...", file=sys.stderr)
            result = self._simple_translate(text)
            print(f"Simple translation completed in {time.time() - start_time:.2f} seconds", file=sys.stderr)
            return result
            
        except Exception as e:
            print(f"Translation error: {str(e)}", file=sys.stderr)
            return f"[Translation error: {str(e)}]"
    
    def _split_text(self, text, max_length=400):
        """Split the text into sentences or smaller chunks"""
        # Find good places to split (sentence end)
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
                # If a single sentence is too long, split it into parts
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
        """Simple translation using a dictionary of known words"""
        words = text.split()
        translated_words = []
        
        for word in words:
            # Handle punctuation
            punctuation = ""
            if word and word[-1] in ".,:;!?":
                punctuation = word[-1]
                word = word[:-1]
            
            # Search for the word in the dictionary
            lower_word = word.lower()
            if lower_word in self.simple_dictionary:
                translated_words.append(self.simple_dictionary[lower_word] + punctuation)
            else:
                # If the word is not in the dictionary, keep it as is
                translated_words.append(word + punctuation)
        
        # In Hebrew, word order is reversed
        if self.tgt_lang == "heb_Hebr":
            # Don't reverse the entire text as it might cause issues with sentence order
            # Just add a note explaining this is a limited translation
            result = " ".join(translated_words)
            result += "\n\n(This is a limited translation using a simple dictionary. The full model hasn't been trained yet.)"
            return result
            
        return " ".join(translated_words)
    
    def _fix_hebrew_text(self, text):
        """Fix common issues in Hebrew text translated from Hebrew"""
        # Fix extra spaces before punctuation
        text = text.replace(" .", ".")
        text = text.replace(" ,", ",")
        text = text.replace(" :", ":")
        text = text.replace(" ;", ";")
        text = text.replace(" !", "!")
        text = text.replace(" ?", "?")
        
        return text
    
    def _get_supported_languages(self):
        """Return a dictionary of all supported languages in NLLB"""
        return {
            'en': 'eng_Latn',   # English
            'he': 'heb_Hebr',   # Hebrew
            'ar': 'arb_Arab',   # Arabic
            'ru': 'rus_Cyrl',   # Russian
            'es': 'spa_Latn',   # Spanish
            'fr': 'fra_Latn',   # French
            'de': 'deu_Latn',   # German
            # And many more languages...
        }
    
    def convert_lang_code(self, standard_code):
        """Convert a standard language code (ISO) to NLLB language code"""
        if standard_code in self.supported_langs:
            return self.supported_langs[standard_code]
        # If the code is already in NLLB format, return it as is
        if "_" in standard_code:
            return standard_code
        # Default - English
        return 'eng_Latn'


def process_translation_request(text, source_lang="en", target_lang="he"):
    """Process a translation request and return a response in JSON"""
    try:
        print(f"Starting NLLB translation from {source_lang} to {target_lang}...", file=sys.stderr)
        print(f"Text length: {len(text)} characters", file=sys.stderr)
        
        # Create a translator instance with automatic language code conversion
        translator = NLLBTranslator()
        src_lang_nllb = translator.convert_lang_code(source_lang)
        tgt_lang_nllb = translator.convert_lang_code(target_lang)
        
        print(f"NLLB language codes: {src_lang_nllb} -> {tgt_lang_nllb}", file=sys.stderr)
        
        translator = NLLBTranslator(src_lang=src_lang_nllb, tgt_lang=tgt_lang_nllb)
        
        # Check if model loaded successfully
        if translator.model_loaded:
            print("NLLB model loaded successfully, starting translation...", file=sys.stderr)
        else:
            print("NLLB model failed to load, using simple dictionary translation...", file=sys.stderr)
            
        translation = translator.translate(text)
        
        if translation and translation.strip():
            print("Translation completed successfully", file=sys.stderr)
            return json.dumps({
                "success": True,
                "original": text,
                "translation": translation,
                "source_language": source_lang,
                "target_language": target_lang,
                "source_language_nllb": src_lang_nllb,
                "target_language_nllb": tgt_lang_nllb,
                "used_nllb": translator.model_loaded
            })
        else:
            print("Translation failed - empty result", file=sys.stderr)
            return json.dumps({
                "success": False,
                "error": "Translation resulted in empty text. The model might not be properly loaded or configured."
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
            "error": "Missing arguments. Usage: python nllb_translator.py <text> <target_language> [source_language]"
        }))
        sys.exit(1)
        
    text = sys.argv[1]
    target_language = sys.argv[2]
    source_language = sys.argv[3] if len(sys.argv) > 3 else "en"
    
    print(process_translation_request(text, source_language, target_language)) 