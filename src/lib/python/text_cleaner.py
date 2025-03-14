#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import json
import hashlib
import re
from collections import defaultdict
from typing import List, Dict, Set, Tuple

# התקנת חבילות נדרשות אם לא קיימות
try:
    import datasketch
except ImportError:
    print("Installing datasketch...")
    os.system("pip install datasketch")
    import datasketch

try:
    from trafilatura import extract
except ImportError:
    print("Installing trafilatura...")
    os.system("pip install trafilatura")
    from trafilatura import extract

class TextCleaner:
    """
    כלי לניקוי טקסט המשלב טכניקות מתקדמות מהמאמרים והכלים הרשומים:
    - הסרת טקסט משוכפל (datasketch)
    - ניקוי טקסט מהאינטרנט (trafilatura)
    - אנליזה סטטיסטית לזיהוי טקסט באיכות נמוכה
    """
    
    def __init__(self, min_quality_score: int = 60):
        self.min_quality_score = min_quality_score
        self.minhash = datasketch.MinHash(num_perm=128)
        self.fingerprints = defaultdict(set)
        
    def clean_dataset(self, transcripts: List[Dict]) -> List[Dict]:
        """ניקוי מערך תמלולים והסרת כפילויות"""
        cleaned_transcripts = []
        seen_hashes = set()
        
        for transcript in transcripts:
            # חישוב ציון איכות לתמלול
            quality_score = self.calculate_quality_score(transcript)
            transcript['quality'] = quality_score
            
            # סינון לפי ציון איכות
            if quality_score < self.min_quality_score:
                continue
                
            # ניקוי הטקסט
            if 'transcript' in transcript:
                transcript['transcript'] = self.clean_text(transcript['transcript'])
            if 'translation' in transcript:
                transcript['translation'] = self.clean_text(transcript['translation'])
                
            # בדיקת כפילויות
            content_hash = self._get_content_hash(transcript)
            if content_hash in seen_hashes:
                continue
                
            seen_hashes.add(content_hash)
            cleaned_transcripts.append(transcript)
            
        # איתור תוכן דומה (לא זהה) באמצעות MinHash
        return self._deduplicate_similar_content(cleaned_transcripts)
    
    def clean_text(self, text: str) -> str:
        """ניקוי טקסט בודד"""
        if not text:
            return ""
            
        # הסרת רווחים מיותרים
        text = re.sub(r'\s+', ' ', text).strip()
        
        # הסרת תווים מיוחדים ותווי בקרה
        text = re.sub(r'[\x00-\x1F\x7F-\x9F]', '', text)
        
        # הסרת תבניות דומות לHTML אם נותרו
        text = re.sub(r'<[^>]+>', '', text)
        
        return text
    
    def calculate_quality_score(self, transcript: Dict) -> int:
        """חישוב ציון איכות לתמלול בסולם 0-100"""
        score = 70  # ציון התחלתי סביר
        
        # בדיקת אורך הטקסט
        transcript_text = transcript.get('transcript', '')
        translation_text = transcript.get('translation', '')
        
        if not transcript_text or not translation_text:
            return 30  # ציון נמוך אם חסר טקסט
            
        # אורך טקסט מינימלי
        if len(transcript_text) < 100 or len(translation_text) < 100:
            score -= 20
            
        # אורך טקסט מקסימלי (להימנע מתוכן זבל)
        if len(transcript_text) > 50000 or len(translation_text) > 50000:
            score -= 10
            
        # בדיקת יחס תרגום-מקור (אמור להיות סביר)
        length_ratio = len(translation_text) / max(1, len(transcript_text))
        if length_ratio < 0.3 or length_ratio > 3.0:
            score -= 15
            
        # בדיקת מגוון אוצר מילים (עושר לשוני)
        unique_words_ratio = len(set(transcript_text.split())) / max(1, len(transcript_text.split()))
        if unique_words_ratio < 0.3:  # אוצר מילים דל
            score -= 10
            
        # בדיקת משפטים קצרים מדי (עלול להעיד על איכות ירודה)
        avg_sentence_length = len(transcript_text) / max(1, transcript_text.count('.') + transcript_text.count('!') + transcript_text.count('?'))
        if avg_sentence_length < 5:
            score -= 10
            
        # התאמה לכללים נוספים...
        
        # הגבלת הציון לטווח 0-100
        return max(0, min(100, score))
    
    def _get_content_hash(self, transcript: Dict) -> str:
        """Creating a unique signature for transcript content"""
        content = transcript.get('transcript', '') + transcript.get('translation', '')
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    def _deduplicate_similar_content(self, transcripts: List[Dict]) -> List[Dict]:
        """הסרת תוכן דומה (לא בהכרח זהה) באמצעות MinHash LSH"""
        if len(transcripts) <= 1:
            return transcripts
            
        # יצירת MinHash לכל תמלול
        minhashes = []
        for transcript in transcripts:
            content = transcript.get('transcript', '') + transcript.get('translation', '')
            minhash = datasketch.MinHash(num_perm=128)
            for shingle in self._get_shingles(content):
                minhash.update(shingle.encode('utf-8'))
            minhashes.append(minhash)
            
        # מציאת קבוצות של תמלולים דומים
        lsh = datasketch.MinHashLSH(threshold=0.7, num_perm=128)
        for i, minhash in enumerate(minhashes):
            lsh.insert(i, minhash)
            
        # זיהוי קבוצות ובחירת הנציג הטוב ביותר מכל קבוצה
        groups = defaultdict(list)
        for i, transcript in enumerate(transcripts):
            results = lsh.query(minhashes[i])
            group_id = min(results)  # שימוש בנציג עם האינדקס הנמוך ביותר כמזהה הקבוצה
            groups[group_id].append((i, transcript))
            
        # בחירת התמלול עם הציון הגבוה ביותר מכל קבוצה
        deduplicated = []
        for group in groups.values():
            best_transcript = max(group, key=lambda x: x[1].get('quality', 0))[1]
            deduplicated.append(best_transcript)
            
        return deduplicated
    
    def _get_shingles(self, text: str, k: int = 5) -> Set[str]:
        """Create k-shingles from text for similarity detection"""
        words = text.split()
        if len(words) < k:
            return {" ".join(words)}
        return {" ".join(words[i:i+k]) for i in range(len(words) - k + 1)}
    
    @staticmethod
    def extract_clean_text_from_url(url: str) -> str:
        """חילוץ טקסט נקי מכתובת URL באמצעות trafilatura"""
        try:
            downloaded = extract(url)
            return downloaded or ""
        except Exception as e:
            print(f"Error extracting text from URL {url}: {str(e)}")
            return ""

def main():
    """הרצת תהליך ניקוי על קובץ JSON עם תמלולים"""
    if len(sys.argv) < 2:
        print("Usage: python text_cleaner.py <transcripts_file.json> [output_file.json]")
        sys.exit(1)
        
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_file.replace('.json', '_cleaned.json')
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            transcripts = json.load(f)
            
        cleaner = TextCleaner()
        cleaned_transcripts = cleaner.clean_dataset(transcripts)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(cleaned_transcripts, f, ensure_ascii=False, indent=2)
            
        print(f"Original transcripts: {len(transcripts)}")
        print(f"Cleaned transcripts: {len(cleaned_transcripts)}")
        print(f"Removed: {len(transcripts) - len(cleaned_transcripts)} transcripts")
        print(f"Cleaned data saved to: {output_file}")
        
    except Exception as e:
        print(f"Error processing file: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 