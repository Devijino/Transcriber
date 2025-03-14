#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import json
import logging
import time
from datetime import datetime
import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

def setup_logger(log_file):
    """הגדרת מערכת הלוגים לתהליך שיפור המודל"""
    logger = logging.getLogger('model_improvement')
    logger.setLevel(logging.INFO)
    
    # הגדרת שני handlers - אחד לקובץ ואחד למסוף
    file_handler = logging.FileHandler(log_file)
    console_handler = logging.StreamHandler()
    
    # פורמט הלוגים
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)
    
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)
    
    return logger

def load_training_data(data_file):
    """טעינת נתוני האימון מקובץ JSON"""
    with open(data_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def load_model_and_tokenizer(model_dir):
    """טעינת המודל והטוקנייזר מהדיסק"""
    try:
        model = AutoModelForSeq2SeqLM.from_pretrained(model_dir)
        tokenizer = AutoTokenizer.from_pretrained(model_dir)
        return model, tokenizer
    except Exception as e:
        raise Exception(f"Failed to load model from {model_dir}: {str(e)}")

def prepare_training_pairs(data, tokenizer):
    """הכנת זוגות נתונים לאימון המודל"""
    source_texts = []
    target_texts = []
    for item in data:
        if not item.get('source_text') or not item.get('target_text'):
            continue
            
        src_lang = item.get('source_language', 'en')
        tgt_lang = item.get('target_language', 'he')
        
        # המרת קודי שפה סטנדרטיים לפורמט NLLB
        src_lang_code = convert_lang_code(src_lang)
        tgt_lang_code = convert_lang_code(tgt_lang)
        
        source_text = item['source_text']
        target_text = item['target_text']
        
        # הוספת תגיות שפה כנדרש במודל NLLB
        source_with_lang = f"{src_lang_code} {source_text}"
        
        source_texts.append(source_with_lang)
        target_texts.append(target_text)
    
    return source_texts, target_texts

def convert_lang_code(standard_code):
    """המרת קודי שפה סטנדרטיים לפורמט NLLB"""
    # מיפוי בין קודי שפה סטנדרטיים לקודי NLLB
    mapping = {
        'en': 'eng_Latn',
        'he': 'heb_Hebr',
        'ar': 'arb_Arab',
        'ru': 'rus_Cyrl',
        'es': 'spa_Latn',
        'fr': 'fra_Latn',
        'de': 'deu_Latn',
        'it': 'ita_Latn'
    }
    return mapping.get(standard_code, 'eng_Latn')  # ברירת מחדל לאנגלית

def improve_model(model, tokenizer, source_texts, target_texts, model_dir, logger):
    """שיפור המודל באמצעות fine-tuning"""
    logger.info(f"Starting model improvement with {len(source_texts)} examples")
    
    try:
        # Check if GPU is available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")
        
        model = model.to(device)
        
        # שימוש בהגדרות אימון בסיסיות עם שיעור למידה נמוך
        optimizer = torch.optim.AdamW(model.parameters(), lr=2e-5)
        
        # מספר מחזורי אימון
        epochs = 1
        
        # אימון פשוט על מדגמים בודדים
        model.train()
        
        # מעבר על כמות מוגבלת של דוגמאות כדי למנוע זמן עיבוד ארוך
        # במערכת אמיתית, היינו משתמשים ב-DataLoader ובתהליך אימון מתקדם יותר
        batch_size = 2
        total_batches = (len(source_texts) + batch_size - 1) // batch_size
        
        total_loss = 0
        for epoch in range(epochs):
            logger.info(f"Starting epoch {epoch+1}/{epochs}")
            epoch_loss = 0
            
            # עיבוד של מנות קטנות
            for i in range(0, len(source_texts), batch_size):
                batch_sources = source_texts[i:i+batch_size]
                batch_targets = target_texts[i:i+batch_size]
                
                # קידוד הטקסטים
                inputs = tokenizer(batch_sources, return_tensors="pt", padding=True, truncation=True, max_length=512).to(device)
                labels = tokenizer(batch_targets, return_tensors="pt", padding=True, truncation=True, max_length=512).to(device)
                
                # אתחול הגרדיאנטים לאפס
                optimizer.zero_grad()
                
                # ביצוע חישוב קדימה עם חישוב אובדן
                outputs = model(**inputs, labels=labels.input_ids)
                loss = outputs.loss
                
                # חישוב גרדיאנטים ועדכון משקולות
                loss.backward()
                optimizer.step()
                
                batch_loss = loss.item()
                epoch_loss += batch_loss
                total_loss += batch_loss
                
                # לוגים לכל 10 מנות
                current_batch = i // batch_size + 1
                if current_batch % 10 == 0 or current_batch == total_batches:
                    logger.info(f"Epoch {epoch+1}, Batch {current_batch}/{total_batches}, Loss: {batch_loss:.4f}")
            
            # סיכום אובדן לאפוכה
            avg_epoch_loss = epoch_loss / total_batches
            logger.info(f"Epoch {epoch+1} completed, Average Loss: {avg_epoch_loss:.4f}")
        
        # שמירת המודל המשופר
        logger.info("Saving improved model...")
        
        # שימוש בנתיב זמני למנוע בעיות הרשאות
        timestamp = int(time.time())
        improved_model_dir = os.path.join(os.path.dirname(model_dir), f"nllb_improved_{timestamp}")
        
        os.makedirs(improved_model_dir, exist_ok=True)
        model.save_pretrained(improved_model_dir)
        tokenizer.save_pretrained(improved_model_dir)
        
        # מעתיקים את המודל המשופר לנתיב הקבוע
        logger.info(f"Model saved to {improved_model_dir}")
        logger.info(f"Copying improved model to {model_dir}")
        
        # שמירה של המודל המקורי כגיבוי
        backup_dir = f"{model_dir}_backup_{timestamp}"
        if os.path.exists(model_dir):
            logger.info(f"Creating backup of original model to {backup_dir}")
            os.rename(model_dir, backup_dir)
        
        # קידום המודל החדש להיות המודל העיקרי
        os.rename(improved_model_dir, model_dir)
        
        logger.info("Model improvement completed successfully")
        return True
    
    except Exception as e:
        logger.error(f"Error during model improvement: {str(e)}")
        # במקרה של שגיאה, נשתמש במודל המקורי
        logger.info("Reverting to original model")
        return False

def main():
    """פונקציה ראשית לשיפור המודל"""
    if len(sys.argv) < 3:
        print("Usage: python improve_model.py <training_data_file> <model_dir> [log_file]")
        sys.exit(1)
    
    training_data_file = sys.argv[1]
    model_dir = sys.argv[2]
    log_file = sys.argv[3] if len(sys.argv) > 3 else f"model_improvement_{int(time.time())}.log"
    
    # הגדרת הלוגר
    logger = setup_logger(log_file)
    logger.info(f"Starting model improvement process")
    logger.info(f"Training data: {training_data_file}")
    logger.info(f"Model directory: {model_dir}")
    
    try:
        # טעינת נתוני האימון
        training_data = load_training_data(training_data_file)
        logger.info(f"Loaded {len(training_data)} training examples")
        
        # טעינת המודל והטוקנייזר
        logger.info("Loading model and tokenizer...")
        model, tokenizer = load_model_and_tokenizer(model_dir)
        logger.info("Model and tokenizer loaded successfully")
        
        # הכנת זוגות אימון
        logger.info("Preparing training pairs...")
        source_texts, target_texts = prepare_training_pairs(training_data, tokenizer)
        logger.info(f"Prepared {len(source_texts)} training pairs")
        
        if len(source_texts) == 0:
            logger.warning("No valid training pairs found. Aborting improvement.")
            return
        
        # שיפור המודל באמצעות fine-tuning
        success = improve_model(model, tokenizer, source_texts, target_texts, model_dir, logger)
        
        if success:
            logger.info("Model improvement process completed successfully")
        else:
            logger.error("Model improvement process failed")
    
    except Exception as e:
        logger.error(f"Error in model improvement process: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 