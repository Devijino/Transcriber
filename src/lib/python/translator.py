from googletrans import Translator
import sys
import json

def translate_text(text, target_language="he"):
    """
    Translates text to the target language using Google Translate
    """
    try:
        translator = Translator()
        translation = translator.translate(text, dest=target_language)
        
        return json.dumps({
            "success": True,
            "original": text,
            "translation": translation.text,
            "source_language": translation.src,
            "target_language": target_language
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
            "error": "Missing arguments. Usage: python translator.py <text> <target_language>"
        }))
        sys.exit(1)
        
    text = sys.argv[1]
    target_language = sys.argv[2]
    print(translate_text(text, target_language)) 