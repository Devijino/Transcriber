'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
// Use dynamic import for resourceManager to avoid client-side import issues
import dynamic from 'next/dynamic';

// Create a placeholder resourceManager for client-side
const resourceManagerPlaceholder = {
  cleanupAfterTranslation: async (requestId: string) => ({ deletedFiles: 0, freedSpace: 0 }),
  isMemoryUsageHigh: () => false,
  optimizeMemory: () => false
};

// Dynamic import with SSR disabled to prevent server module loading in client
const resourceManagerPromise = typeof window !== 'undefined'
  ? import('../utils/resourceManager').catch(() => ({ default: resourceManagerPlaceholder }))
  : Promise.resolve({ default: resourceManagerPlaceholder });

// Data structure for transcript
export interface Transcript {
  id: string; // Unique identifier (YouTube ID)
  url: string; // Full URL of the video
  title?: string; // Video title
  transcript: string; // The transcribed text
  translation?: string; // The translation
  sourceLang: string; // Source language
  targetLang: string; // Target language
  createdAt: number; // Creation date (timestamp)
  quality?: number; // Optional quality score (0-100)
  usedForTraining?: boolean; // Whether this transcript was used for model training
  trainingDate?: number; // When the transcript was used for training (timestamp)
  cleanedText?: boolean; // Whether the text has been cleaned
}

interface TranscriptContextType {
  transcripts: Transcript[]; // Transcript repository
  transcriptCount: number; // Number of transcripts in the system
  trainedTranscriptCount: number; // Number of transcripts used for training
  addTranscript: (transcript: Transcript) => Promise<boolean>; // Add new transcript - now asynchronous
  getTranscript: (id: string) => Transcript | undefined; // Get transcript by ID
  getStatistics: () => { 
    count: number, 
    languages: Record<string, number>,
    qualityDistribution: number[],   // Distribution of quality scores
    trainingUsage: number,           // How many were used for training
    averageQuality: number,          // Average quality
    totalTrainingRuns: number,       // Number of training runs performed
    lastTrainingDate: Date | null    // Last training date
  }; // Get statistics
  improveModel: () => Promise<boolean>; // Function to improve the model
  lastImprovement: Date | null; // When the last improvement was made
  trainingHistory: Array<{           // Training history
    date: Date,
    transcriptsUsed: number,
    success: boolean
  }>;
}

// Create context with default value
export const TranscriptContext = createContext<TranscriptContextType>({
  transcripts: [],
  transcriptCount: 0,
  trainedTranscriptCount: 0,
  addTranscript: async () => false,
  getTranscript: () => undefined,
  getStatistics: () => ({ count: 0, languages: {}, qualityDistribution: [], trainingUsage: 0, averageQuality: 0, totalTrainingRuns: 0, lastTrainingDate: null }),
  improveModel: async () => false,
  lastImprovement: null,
  trainingHistory: []
});

// Hook for using the context
export const useTranscripts = () => useContext(TranscriptContext);

export const TranscriptProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [lastImprovement, setLastImprovement] = useState<Date | null>(null);
  const [trainingHistory, setTrainingHistory] = useState<Array<{ date: Date, transcriptsUsed: number, success: boolean }>>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  // Load transcripts from local storage and server on page load
  useEffect(() => {
    const loadTranscripts = async () => {
      try {
        // Load from localStorage (local storage)
        const savedTranscripts = localStorage.getItem('transcripts');
        let localTranscripts: Transcript[] = [];
        
        if (savedTranscripts) {
          localTranscripts = JSON.parse(savedTranscripts);
          console.log(`Loaded ${localTranscripts.length} transcripts from localStorage`);
        }
        
        // Load from server (main source of truth)
        try {
          const response = await fetch('/api/model/save-transcript');
          if (response.ok) {
            const serverData = await response.json();
            if (serverData.transcripts && Array.isArray(serverData.transcripts)) {
              console.log(`Loaded ${serverData.transcripts.length} transcripts from server`);
              
              // Merge server transcripts with local transcripts (server takes precedence)
              const mergedTranscripts: Record<string, Transcript> = {};
              
              // First local transcripts
              localTranscripts.forEach(transcript => {
                mergedTranscripts[transcript.id] = transcript;
              });
              
              // Then server transcripts (will overwrite local ones in case of conflict)
              serverData.transcripts.forEach((transcript: Transcript) => {
                mergedTranscripts[transcript.id] = transcript;
              });
              
              // Convert back to array
              const finalTranscripts = Object.values(mergedTranscripts);
              setTranscripts(finalTranscripts);
              
              // Save to localStorage for synchronization
              localStorage.setItem('transcripts', JSON.stringify(finalTranscripts));
              
              console.log(`Using ${finalTranscripts.length} merged transcripts`);
            }
          } else {
            console.warn('Failed to load transcripts from server, using localStorage only');
          }
        } catch (serverError) {
          console.error('Error loading transcripts from server:', serverError);
          if (localTranscripts.length > 0) {
            setTranscripts(localTranscripts);
          }
        }
        
        // Load training history from localStorage on page load
        const lastImprovementTime = localStorage.getItem('lastModelImprovement');
        if (lastImprovementTime) {
          setLastImprovement(new Date(parseInt(lastImprovementTime)));
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Error loading transcripts:', error);
        setIsInitialized(true);
      }
    };
    
    loadTranscripts();
  }, []);
  
  // Load training history from localStorage on page load
  useEffect(() => {
    try {
      const savedTrainingHistory = localStorage.getItem('trainingHistory');
      if (savedTrainingHistory) {
        setTrainingHistory(JSON.parse(savedTrainingHistory).map((h: any) => ({
          date: new Date(h.date),
          transcriptsUsed: h.transcriptsUsed,
          success: h.success
        })));
      }
    } catch (error) {
      console.error('Error loading training history from localStorage:', error);
    }
  }, []);
  
  // Save transcripts to localStorage on every change
  useEffect(() => {
    // Only if initialization is complete (to prevent deletion of existing data)
    if (!isInitialized) return;
    
    try {
      localStorage.setItem('transcripts', JSON.stringify(transcripts));
    } catch (error) {
      console.error('Error saving transcripts to localStorage:', error);
    }
  }, [transcripts, isInitialized]);
  
  // Save training history to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem('trainingHistory', JSON.stringify(
        trainingHistory.map(h => ({
          date: h.date.getTime(),
          transcriptsUsed: h.transcriptsUsed,
          success: h.success
        }))
      ));
    } catch (error) {
      console.error('Error saving training history to localStorage:', error);
    }
  }, [trainingHistory]);
  
  // Calculate transcript count as needed
  const transcriptCount = useMemo(() => transcripts.length, [transcripts]);
  
  // Calculate trained transcript count as needed
  const trainedTranscriptCount = useMemo(() => 
    transcripts.filter(t => t.usedForTraining).length, 
  [transcripts]);
  
  // Function to add new transcript
  const addTranscript = async (transcript: Transcript) => {
    // Check if transcript already exists by ID
    const exists = transcripts.findIndex(t => t.id === transcript.id) !== -1;
    
    let updatedTranscripts: Transcript[];
    
    if (exists) {
      // Update existing transcript
      updatedTranscripts = transcripts.map(t => 
        t.id === transcript.id ? { ...t, ...transcript } : t
      );
      setTranscripts(updatedTranscripts);
    } else {
      // Add new transcript
      updatedTranscripts = [...transcripts, transcript];
      setTranscripts(updatedTranscripts);
    }
    
    // Save to local storage block
    try {
      localStorage.setItem('transcripts', JSON.stringify(updatedTranscripts));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
    
    // Save transcript to server as fixed JSON file
    try {
      await fetch('/api/model/save-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcript
        })
      });
      console.log(`Transcript ${transcript.id} saved to server`);
    } catch (error) {
      console.error('Error saving transcript to server:', error);
    }
    
    // Automatic training only on the current transcript (fast training)
    // Only if this is a new transcript and its quality is good enough or not set
    if (!exists && (transcript.quality === undefined || transcript.quality > 50)) {
      console.log(`Auto-improving model with new transcript: ${transcript.id}`);
      
      try {
        // Train on the new transcript only
        const response = await fetch('/api/model/improve-single', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            transcript
          })
        });
        
        if (response.ok) {
          // Update improvement date
          const now = new Date();
          setLastImprovement(now);
          localStorage.setItem('lastModelImprovement', now.getTime().toString());
          
          // Update transcript as "used for training"
          const finalTranscripts = updatedTranscripts.map(t => {
            if (t.id === transcript.id) {
              return { ...t, usedForTraining: true, trainingDate: now.getTime() };
            }
            return t;
          });
          setTranscripts(finalTranscripts);
          
          // Update training history
          const newHistoryItem = { 
            date: now, 
            transcriptsUsed: 1, 
            success: true 
          };
          
          const updatedHistory = [...trainingHistory, newHistoryItem];
          setTrainingHistory(updatedHistory);
          
          console.log('Auto-improvement successful');
        } else {
          console.error('Auto-improvement failed:', await response.text());
        }
      } catch (error) {
        console.error('Error during auto-improvement:', error);
      }
    }
    
    return true;
  };
  
  // Get transcript by ID
  const getTranscript = (id: string) => {
    return transcripts.find(t => t.id === id);
  };
  
  // Get statistics about transcripts
  const getStatistics = () => {
    const languages: Record<string, number> = {};
    const qualityDistribution = Array(10).fill(0); // Ten slots for scores 0-10, 11-20, ..., 91-100
    let totalQuality = 0;
    let trainingUsage = 0;
    
    // Count transcripts by language and calculate quality distribution
    transcripts.forEach(t => {
      // Languages
      if (languages[t.sourceLang]) {
        languages[t.sourceLang]++;
      } else {
        languages[t.sourceLang] = 1;
      }
      
      // Quality
      if (t.quality !== undefined) {
        const bucketIndex = Math.min(Math.floor(t.quality / 10), 9);
        qualityDistribution[bucketIndex]++;
        totalQuality += t.quality;
      }
      
      // Count training usage
      if (t.usedForTraining) {
        trainingUsage++;
      }
    });
    
    return {
      count: transcripts.length,
      languages,
      qualityDistribution,
      trainingUsage,
      averageQuality: transcripts.length > 0 ? totalQuality / transcripts.length : 0,
      totalTrainingRuns: trainingHistory.length,
      lastTrainingDate: lastImprovement
    };
  };
  
  // Function to improve the model using the data gathered
  const improveModel = async (): Promise<boolean> => {
    try {
      // Filter transcripts by quality and source
      // 1. We want high quality transcripts (above 80 for NLLB translations)
      // 2. We only learn from NLLB translations (marked as quality 85) and not from Google (75)
      const highQualityTranscripts = transcripts.filter(t => {
        // Filter by quality: only local transcripts (without quality mark) or high quality above 80
        const hasHighQuality = t.quality === undefined || t.quality >= 80;
        
        // Google translations marked as quality 75, NLLB marked as 85
        const isNotGoogleTranslate = t.quality !== 75;
        
        return hasHighQuality && isNotGoogleTranslate;
      });
      
      console.log(`Filtered ${highQualityTranscripts.length} high quality transcripts for model training out of ${transcripts.length} total`);
      
      // Get request ID for tracking
      const requestId = Date.now().toString();
      
      // Send data to API for model improvement
      const response = await fetch('/api/model/improve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcripts: highQualityTranscripts,
          requestId
        })
      });
      
      if (response.ok) {
        // Update improvement date
        const now = new Date();
        setLastImprovement(now);
        localStorage.setItem('lastModelImprovement', now.getTime().toString());
        
        // Update training history
        const updatedTranscripts = transcripts.map(t => {
          if (highQualityTranscripts.some(ht => ht.id === t.id)) {
            return { ...t, usedForTraining: true, trainingDate: now.getTime() };
          }
          return t;
        });
        setTranscripts(updatedTranscripts);
        
        // Update training history
        const newHistoryItem = { 
          date: now, 
          transcriptsUsed: highQualityTranscripts.length, 
          success: true 
        };
        
        const updatedHistory = [...trainingHistory, newHistoryItem];
        setTrainingHistory(updatedHistory);
        
        // Save to localStorage
        localStorage.setItem('trainingHistory', JSON.stringify(updatedHistory.map(item => ({
          date: item.date.getTime(),
          transcriptsUsed: item.transcriptsUsed,
          success: item.success
        }))));
        
        // Save updated transcript state to server
        try {
          for (const transcript of updatedTranscripts) {
            if (highQualityTranscripts.some(ht => ht.id === transcript.id)) {
              // Save only transcripts that were used for training
              await fetch('/api/model/save-transcript', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ transcript })
              });
            }
          }
        } catch (saveError) {
          console.error('Error saving training state to server:', saveError);
        }
        
        // Perform smart cleanup after successful training
        try {
          // Load resourceManager dynamically to avoid SSR issues
          const { default: resourceManager } = await resourceManagerPromise;
          
          // First attempt to clean up temporary files associated with the request
          const cleanupResult = await resourceManager.cleanupAfterTranslation(requestId);
          console.log(`Post-training cleanup: Removed ${cleanupResult.deletedFiles} temporary files (${(cleanupResult.freedSpace / 1024 / 1024).toFixed(2)}MB)`);
          
          // Then check if memory usage is high and optimize if needed
          if (resourceManager.isMemoryUsageHigh()) {
            const didOptimize = resourceManager.optimizeMemory();
            console.log(`Memory optimization performed: ${didOptimize ? 'Yes' : 'No'}`);
          }
        } catch (cleanupError) {
          console.error('Error during post-training cleanup:', cleanupError);
          // Non-critical error, don't affect the training result
        }
        
        return true;
      } else {
        // Add failed training to history
        const newHistoryItem = { 
          date: new Date(), 
          transcriptsUsed: highQualityTranscripts.length, 
          success: false 
        };
        
        const updatedHistory = [...trainingHistory, newHistoryItem];
        setTrainingHistory(updatedHistory);
        
        console.error('Model improvement API returned:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('Error during model improvement:', error);
      return false;
    }
  };
  
  return (
    <TranscriptContext.Provider value={{
      transcripts,
      transcriptCount,
      trainedTranscriptCount,
      addTranscript,
      getTranscript,
      getStatistics,
      improveModel,
      lastImprovement,
      trainingHistory
    }}>
      {children}
    </TranscriptContext.Provider>
  );
}; 