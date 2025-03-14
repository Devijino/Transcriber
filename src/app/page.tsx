'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useTranscripts } from '@/lib/contexts/TranscriptContext';
import ReactMarkdown from 'react-markdown';

// Target language options
const TARGET_LANGUAGES = {
  ENGLISH: 'en',
  HEBREW: 'he',
  ARABIC: 'ar',
  RUSSIAN: 'ru',
  SPANISH: 'es',
  FRENCH: 'fr',
  GERMAN: 'de',
};

// Platform types supported by the application
export enum PlatformType {
  YOUTUBE = 'youtube',
  FACEBOOK = 'facebook',
  TIKTOK = 'tiktok',
  INSTAGRAM = 'instagram',
  VIMEO = 'vimeo',
  OTHER = 'other'
}

// Icons and configuration for platforms
const PLATFORMS = {
  [PlatformType.YOUTUBE]: { 
    name: 'YouTube', 
    icon: '🎬',
    placeholder: 'Enter YouTube URL...',
    color: 'bg-red-600' 
  },
  [PlatformType.FACEBOOK]: { 
    name: 'Facebook', 
    icon: '📘',
    placeholder: 'Enter Facebook Watch URL...',
    color: 'bg-blue-600' 
  },
  [PlatformType.TIKTOK]: { 
    name: 'TikTok', 
    icon: '🎵',
    placeholder: 'Enter TikTok URL...',
    color: 'bg-black' 
  },
  [PlatformType.INSTAGRAM]: { 
    name: 'Instagram', 
    icon: '📷',
    placeholder: 'Enter Instagram URL...',
    color: 'bg-pink-600' 
  },
  [PlatformType.VIMEO]: { 
    name: 'Vimeo', 
    icon: '🎥',
    placeholder: 'Enter Vimeo URL...',
    color: 'bg-teal-600' 
  },
  [PlatformType.OTHER]: { 
    name: 'Other URL', 
    icon: '🔗',
    placeholder: 'Enter video or audio URL...',
    color: 'bg-gray-600' 
  }
};

// Error boundary component with proper typing
interface ErrorDisplayProps {
  children: React.ReactNode;
}

interface ErrorDisplayState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorDisplay extends React.Component<ErrorDisplayProps, ErrorDisplayState> {
  constructor(props: ErrorDisplayProps) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorDisplayState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({
      hasError: true,
      error,
      errorInfo
    });
    console.error("Error caught by ErrorDisplay:", error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 m-4 bg-red-100 border-2 border-red-300 text-red-800 rounded-lg">
          <h2 className="text-lg font-bold mb-2">Application Error</h2>
          <p className="mb-2">
            {this.state.error?.toString() || "An unknown error occurred"}
          </p>
          {this.state.error?.stack && (
            <pre className="text-xs whitespace-pre-wrap bg-red-50 p-2 rounded border border-red-200 mt-2">
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Error display component
const ErrorMessage = ({ error, onClose }: { error: string; onClose?: () => void }) => {
  if (!error) return null;
  
  return (
    <div className="w-full mt-4 p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg relative">
      <div className="font-bold mb-1">Error:</div>
      <div>{error}</div>
      {onClose && (
        <button 
          className="absolute top-2 right-2 text-red-600 hover:text-red-800"
          onClick={onClose}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string>(TARGET_LANGUAGES.HEBREW);
  const [translationProgress, setTranslationProgress] = useState<number>(0);
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [platformType, setPlatformType] = useState<PlatformType>(PlatformType.YOUTUBE);
  const [translationSource, setTranslationSource] = useState<'google' | 'facebook'>('google');
  const [result, setResult] = useState<{
    transcript?: string;
    translation?: string;
    error?: string;
    url?: string;
    title?: string;
    message?: string;
    audioFile?: string;
    audioPath?: string;
    fileExists?: boolean;
    detectedLanguage?: string;
    textDirection?: string;
  } | null>(null);

  const { 
    addTranscript, 
    transcriptCount, 
    trainedTranscriptCount,
    lastImprovement
  } = useTranscripts();
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Add transcription cache at the top of the file near other state declarations
  const [transcriptionCache, setTranscriptionCache] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add state for translation tracking (near your other useState declarations)
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedTranslator, setSelectedTranslator] = useState<'google' | 'nllb' | null>(null);
  const [translationProgressText, setTranslationProgressText] = useState('Starting...');

  // Add error state
  const [error, setError] = useState<string | null>(null);

  // Add state for videoId error
  const [videoIdError, setVideoIdError] = useState<string | null>(null);

  // Print transcript count on page load
  useEffect(() => {
    console.log("TranscriptContext loaded with transcript count:", transcriptCount);
    if (transcriptCount === 0) {
      console.log("Warning: Transcript count is 0. Check if localStorage is working properly.");
      // Check if localStorage is working
      try {
        localStorage.setItem('test', 'test');
        const test = localStorage.getItem('test');
        if (test === 'test') {
          console.log("localStorage is working properly");
          localStorage.removeItem('test');
        } else {
          console.error("localStorage test failed");
        }
      } catch (error) {
        console.error("localStorage not available:", error);
      }
    }
  }, [transcriptCount]);

  // Get human-readable language name
  const getLanguageName = (langCode: string = 'en'): string => {
    const languageNames: Record<string, string> = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'ru': 'Russian',
      'ar': 'Arabic',
      'he': 'Hebrew',
      'it': 'Italian',
      'default': 'Unknown'
    };
    
    return languageNames[langCode] || languageNames['default'];
  };

  // Get target language display name
  const getTargetLanguageName = (langCode: string): string => {
    return getLanguageName(langCode);
  };

  // Automatically detect platform type from URL
  const detectPlatformType = (url: string): PlatformType => {
    if (!url) return PlatformType.YOUTUBE;
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return PlatformType.YOUTUBE;
    } else if (url.includes('facebook.com') || url.includes('fb.watch')) {
      return PlatformType.FACEBOOK;
    } else if (url.includes('tiktok.com')) {
      return PlatformType.TIKTOK;
    } else if (url.includes('instagram.com')) {
      return PlatformType.INSTAGRAM;
    } else if (url.includes('vimeo.com')) {
      return PlatformType.VIMEO;
    } else {
      return PlatformType.OTHER;
    }
  };
  
  // Update platform type when URL changes
  useEffect(() => {
    setPlatformType(detectPlatformType(url));
  }, [url]);

  // Add debounce function
  const debounce = (func: Function, delay: number) => {
    let timer: NodeJS.Timeout;
    return (...args: any) => {
      clearTimeout(timer);
      timer = setTimeout(() => func(...args), delay);
    };
  };

  // Add this utility function early in the component to handle videoId errors
  const handleVideoIdError = (error: any, context: string = '') => {
    const errorMessage = `VideoId error${context ? ` (${context})` : ''}: ${error}`;
    console.error(errorMessage);
    setVideoIdError(errorMessage);
    
    // Also capture the error for debugging
    captureError(() => { throw new Error(errorMessage); }, null);
    
    return 'unknown-video-' + Date.now(); // Always return a fallback ID
  };

  /**
   * פונקציה בטוחה לחילוץ מזהה וידאו - תמיד מחזירה מחרוזת תקינה, לעולם לא undefined או null
   * @param url כתובת הסרטון
   * @param prefix תחילית אופציונלית למזהה הברירת מחדל (למטרות debugging)
   * @returns מזהה וידאו תקין תמיד
   */
  const getVideoId = (url: string | undefined | null, prefix: string = 'video'): string => {
    if (!url) return `${prefix}-${Date.now()}`;
    
    try {
      // Try to extract YouTube ID
      const youtubeRegExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
      const youtubeMatch = url.match(youtubeRegExp);
      if (youtubeMatch && youtubeMatch[1]) {
        return `youtube-${youtubeMatch[1]}`;
      }

      // Try to extract Facebook ID
      const facebookRegExp = /facebook\.com\/[^\/]+\/videos\/(\d+)/i;
      const facebookMatch = url.match(facebookRegExp);
      if (facebookMatch && facebookMatch[1]) {
        return `facebook-${facebookMatch[1]}`;
      }

      // Try to extract TikTok ID
      const tiktokRegExp = /@[\w.-]+\/video\/(\d+)/i;
      const tiktokMatch = url.match(tiktokRegExp);
      if (tiktokMatch && tiktokMatch[1]) {
        return `tiktok-${tiktokMatch[1]}`;
      }

      // Try to extract Instagram ID
      const instagramRegExp = /instagram\.com\/(?:p|reel)\/([^\/\?#]+)/i;
      const instagramMatch = url.match(instagramRegExp);
      if (instagramMatch && instagramMatch[1]) {
        return `instagram-${instagramMatch[1]}`;
      }

      // Try to extract Vimeo ID
      const vimeoRegExp = /vimeo\.com\/([0-9]+)/;
      const vimeoMatch = url.match(vimeoRegExp);
      if (vimeoMatch && vimeoMatch[1]) {
        return `vimeo-${vimeoMatch[1]}`;
      }
      
      // If we got here, we couldn't extract an ID - return default ID
      return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    } catch (error) {
      console.error("Error extracting video ID:", error);
      // In case of error, return default ID with timestamp
      return `${prefix}-error-${Date.now()}`;
    }
  };

  // Safe function to store videoId globally
  const storeVideoId = (id: string) => {
    if (typeof window !== 'undefined') {
      // @ts-ignore - Adding a property to window for debugging
      window.__lastVideoId = id;
      console.log("Stored video ID:", id);
    }
  };

  // Safe function to retrieve videoId globally
  const getStoredVideoId = (): string | undefined => {
    if (typeof window !== 'undefined') {
      // @ts-ignore - Retrieving property from window
      return window.__lastVideoId;
    }
    return undefined;
  };

  // Update the handleSubmit function to include debugging and proper error handling
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url) {
      setError('Please enter a YouTube URL');
      return;
    }
    
    setError(null);
    setVideoIdError(null);
    setLoading(true);
    setResult(null);
    setTranslationProgress(0);
    setTranslationProgressText('');
    setIsTranslating(false);
    
    // Generate a unique request ID for this transcription
    const requestId = Date.now().toString();
    
    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          options: {
            targetLanguage: targetLanguage,
            platformType: detectPlatformType(url),
            requestId
          }
        }),
      });
      
      const data = await response.json();
      
      console.log('Transcription response:', data);
      
      if (!response.ok) {
        setError(data.error || 'Failed to transcribe the video');
        setLoading(false);
        return;
      }
      
      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      
      // Check if we need to track progress
      if (requestId && data.asyncProcessing) {
        // Start polling for progress
        const progressInterval = setInterval(async () => {
          try {
            const progressResponse = await fetch(`/api/progress?requestId=${requestId}`);
            const progressData = await progressResponse.json();
            
            if (progressData.progress !== undefined) {
              setTranscriptionProgress(progressData.progress);
              
              // If complete (progress is 100), fetch the final result
              if (progressData.progress >= 100) {
                clearInterval(progressInterval);
                
                // Fetch the final result
                const finalResponse = await fetch(`/api/transcribe/result?requestId=${requestId}`);
                const finalData = await finalResponse.json();
                
                if (finalData.success) {
                  setResult(finalData);
                  // Store the successful result in history if we have the transcript
                  if (finalData.transcript) {
                    await safeAddTranscript({
                      url: url,
                      title: finalData.title || 'Untitled Video',
                      transcript: finalData.transcript,
                      translation: finalData.translation,
                      sourceLang: finalData.detectedLanguage || 'en',
                      targetLang: targetLanguage,
                      quality: 85,
                      cleanedText: true
                    });
                  }
                } else {
                  setError(finalData.error || 'Failed to transcribe the video');
                }
                
                setLoading(false);
              }
            }
          } catch (progressError) {
            console.error('Error checking progress:', progressError);
          }
        }, 2000); // Check every 2 seconds
        
        // Set a timeout to stop checking after 5 minutes
        setTimeout(() => {
          clearInterval(progressInterval);
          if (loading) {
            setLoading(false);
            setError('Transcription timed out. Please try again.');
          }
        }, 5 * 60 * 1000);
      } else {
        // Handle synchronous result
        setResult(data);
        setLoading(false);
        
        // Store the successful result in history if we have the transcript
        if (data.transcript) {
          await safeAddTranscript({
            url: url,
            title: data.title || 'Untitled Video',
            transcript: data.transcript,
            translation: data.translation,
            sourceLang: data.detectedLanguage || 'en',
            targetLang: targetLanguage,
            quality: 85,
            cleanedText: true
          });
        }
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setError('Failed to transcribe the video. Please try again.');
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result?.audioPath) {
      alert('No audio file available to download');
      return;
    }
    
    try {
      // Show download in progress
      const downloadButton = document.querySelector('.download-audio-btn');
      if (downloadButton) {
        downloadButton.innerHTML = '<svg class="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Downloading...';
        downloadButton.classList.add('opacity-70', 'cursor-not-allowed');
      }
      
      // Create direct download link with proper filename
      const audioFileName = result.audioPath.split('/').pop() || 'audio.mp3';
      const audioUrl = `/api/download?path=${encodeURIComponent(result.audioPath)}&filename=${encodeURIComponent(audioFileName)}`;
      
      // Try to open in new window
      const newWindow = window.open(audioUrl, '_blank');
      
      // If popup blocked, create and click a download link
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = audioFileName;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      
      // Reset button state after 1 second
      setTimeout(() => {
        if (downloadButton) {
          downloadButton.innerHTML = '<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Download Audio';
          downloadButton.classList.remove('opacity-70', 'cursor-not-allowed');
        }
      }, 1000);
    } catch (error) {
      console.error('Download error:', error);
      alert(`Failed to download audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Reset button state
      const downloadButton = document.querySelector('.download-audio-btn');
      if (downloadButton) {
        downloadButton.innerHTML = '<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Download Audio';
        downloadButton.classList.remove('opacity-70', 'cursor-not-allowed');
      }
    }
  };

  // Translation using Google Translate
  const translateWithGoogleTranslate = async () => {
    try {
      // Always recover videoId if missing
      const currentUrl = (url || '').trim();
      let videoId = getStoredVideoId() || getVideoId(currentUrl);
      
      if (!videoId) {
        videoId = `google-translate-${Date.now()}`;
        console.warn("Generated fallback videoId for Google Translate");
        storeVideoId(videoId);
      }
      
      setLoading(true);
      setTranslationProgress(5);
      setTranslationSource('google');
      
      // Safety check for result
      if (!result) {
        console.warn("No transcript available for translation");
        setTranslationProgress(0);
        setLoading(false);
        alert("Please transcribe a video first");
        return;
      }
      
      // Create unique request ID
      const requestId = Date.now().toString();
      
      // Translation request
      const requestBody = {
        text: result.transcript,
        sourceLang: result.detectedLanguage || 'en',
        targetLang: targetLanguage || 'en'
      };
      
      console.log("Sending Google Translate request:", requestBody);
      
      // Translation request
      const response = await fetch('/api/google-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      // Validate response
      if (!response.ok) {
        throw new Error(`Translation failed with status: ${response.status}`);
      }
      
      // Parse response safely
      const translationResult = await response.json();
      
      // Update result safely
      if (translationResult && translationResult.translation) {
        setResult(prev => ({
          ...prev,
          translation: translationResult.translation
        }));
      }
      
      // Add transcript safely
      await safeAddTranscript({
        url: result?.url || '',
        title: result?.title || 'Untitled',
        transcript: result?.transcript || '',
        translation: translationResult.translation,
        sourceLang: result?.detectedLanguage || 'en',
        targetLang: targetLanguage || 'en'
      });
      
      // עדכון התקדמות
      setTranslationProgress(100);
      setTimeout(() => setTranslationProgress(0), 500);
    } catch (error) {
      console.error("Error in Google Translation:", error);
      reportError(error, "Google Translate failed");
      setLoading(false);
      setTranslationProgress(0);
    }
  };
  
  // Translation using local NLLB model - with full protection
  const translateWithLocalAI = async () => {
    let intervalId: NodeJS.Timeout | null = null;
    const requestId = `nllb-${Date.now()}`;

    // Define progress check function
    const checkProgress = async () => {
      try {
        const progressResponse = await fetch(`/api/translate?requestId=${requestId}`);
        if (progressResponse.ok) {
          const data = await progressResponse.json();
          setTranslationProgress(data.progress || 0);
        }
      } catch (error) {
        console.error("Error checking translation progress:", error);
      }
    };

    try {
      // Start periodic progress check
      intervalId = setInterval(checkProgress, 1000);

      if (!result) {
        throw new Error("No transcript available for translation");
      }

      // Prepare translation request
      const requestBody = {
        text: result.transcript,
        sourceLang: result.detectedLanguage || 'en',
        targetLang: targetLanguage || 'en',
        requestId
      };

      // Send translation request
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      // Clear periodic check
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }

      // Validate response
      if (!response.ok) {
        throw new Error(`Translation failed with status: ${response.status}`);
      }

      // Parse response safely
      const translationResult = await response.json();

      // Update result safely
      if (translationResult && translationResult.translation) {
        setResult(prev => ({
          ...prev,
          translation: translationResult.translation
        }));
      }

      // Save translation safely
      await safeAddTranscript({
        url: result?.url || '',
        title: result?.title || 'Untitled',
        transcript: result?.transcript || '',
        translation: translationResult.translation,
        sourceLang: result?.detectedLanguage || 'en',
        targetLang: targetLanguage || 'en'
      });

    } catch (error) {
      console.error("Translation error:", error);
      if (intervalId) {
        clearInterval(intervalId);
      }
      throw error;
    }
  };

  /**
   * פונקציה בטוחה להוספת תמלול - מטפלת בכל השגיאות האפשריות ותמיד מייצרת מזהה תקין
   */
  const safeAddTranscript = async (
    transcriptData: {
      url: string;
      title?: string;
      transcript: string;
      translation?: string;
      sourceLang: string;
      targetLang: string;
      quality?: number;
      cleanedText?: boolean;
    }
  ): Promise<boolean> => {
    try {
      // Generate valid ID using the safe function
      const id = getVideoId(transcriptData.url);
      
      // Logging - helps with error tracking
      console.log(`Adding transcript with ID: ${id}, URL: ${transcriptData.url}`);
      
      // Build transcript object with safe ID
      const transcript: { 
        id: string;
        url: string;
        title?: string;
        transcript: string;
        translation?: string;
        sourceLang: string;
        targetLang: string;
        createdAt: number;
        quality?: number;
        cleanedText?: boolean;
      } = {
        id,
        url: transcriptData.url,
        title: transcriptData.title || "Video",
        transcript: transcriptData.transcript,
        translation: transcriptData.translation,
        sourceLang: transcriptData.sourceLang,
        targetLang: transcriptData.targetLang,
        createdAt: Date.now(),
        quality: transcriptData.quality,
        cleanedText: transcriptData.cleanedText || false
      };
      
      // הוספת התמלול באמצעות הפונקציה הקיימת
      await addTranscript(transcript);
      return true;
    } catch (error: any) {
      // טיפול בשגיאות
      console.error("Error adding transcript:", error);
      
      // הצגת שגיאה למשתמש (אם רלוונטי)
      if (setVideoIdError) {
        setVideoIdError(`Error adding transcript: ${error}`);
      }
      
      // תיעוד לצורכי ניפוי שגיאות
      if (typeof window !== 'undefined') {
        window.__capturedErrors = window.__capturedErrors || [];
        window.__capturedErrors.push({
          message: `Transcript addition error: ${error}`,
          stack: error?.stack,
          time: new Date().toISOString()
        });
      }
      
      return false;
    }
  };

  // Add global error reporting function
  const reportError = (error: any, context: string) => {
    console.error(`Error in ${context}:`, error);
    
    // Update UI with error
    if (setVideoIdError) {
      setVideoIdError(`Error in ${context}: ${error?.message || error}`);
    }
    
    // Capture for debug
    if (typeof window !== 'undefined') {
      window.__capturedErrors = window.__capturedErrors || [];
      window.__capturedErrors.push({
        message: `${context} error: ${error?.message || error}`,
        stack: error?.stack,
        time: new Date().toISOString()
      });
    }
    
    // Show alert for critical errors
    if (context.includes('critical')) {
      alert(`Critical error in ${context}: ${error?.message || error}`);
    }
  };

  return (
    <ErrorDisplay>
      <main className="min-h-screen flex flex-col items-center justify-start p-6 md:p-24 bg-black text-white">
        <div className="container mx-auto p-4">
          <h1 className="text-4xl font-bold text-center my-8 text-white">
            Video Transcription & Translation System
          </h1>
          
          {/* Statistics Counter */}
          <div className="w-full md:w-2/3 mx-auto bg-white/5 p-6 border border-white/10 rounded-xl mb-8">
            <h3 className="text-2xl font-bold mb-2 text-center text-white/90">Learning Statistics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 p-4 rounded-lg flex flex-col items-center">
                <span className="text-sm opacity-70">Collected Transcripts</span>
                <span className="text-3xl font-bold">{transcriptCount}</span>
              </div>
              <div className="bg-white/10 p-4 rounded-lg flex flex-col items-center">
                <span className="text-sm opacity-70">AI Trained On</span>
                <span className="text-3xl font-bold">{trainedTranscriptCount} transcripts</span>
              </div>
            </div>
            {lastImprovement && (
              <p className="text-center mt-2 text-sm opacity-70">
                Last training: {new Date(lastImprovement).toLocaleString()}
              </p>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="w-full md:w-2/3 mx-auto mb-8" dir="rtl">
            {/* Platform selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Platform:</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.entries(PLATFORMS).map(([type, { name, icon, color }]) => (
                  <button
                    key={type}
                    type="button"
                    className={`px-3 py-2 rounded-lg text-white transition-colors ${
                      platformType === type ? color : 'bg-gray-400'
                    }`}
                    onClick={() => setPlatformType(type as PlatformType)}
                  >
                    <span className="mr-1">{icon}</span>
                    {name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="mb-4">
              <input
                type="text"
                value={url}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                placeholder={PLATFORMS[platformType].placeholder}
                className="w-full p-3 border rounded-lg text-black"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Target Language:</label>
              <div className="flex flex-wrap gap-3">
                {Object.values(TARGET_LANGUAGES).map((lang) => (
                  <div key={lang} className="flex items-center">
                    <input
                      type="radio"
                      id={`lang-${lang}`}
                      name="targetLanguage"
                      value={lang}
                      checked={targetLanguage === lang}
                      onChange={() => setTargetLanguage(lang)}
                      className="mr-2"
                    />
                    <label htmlFor={`lang-${lang}`} className="text-sm">
                      {getTargetLanguageName(lang)}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-center">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                disabled={loading || !url}
              >
                {loading ? 'Processing...' : 'Transcribe Video'}
              </button>
            </div>
          </form>

          {/* Transcription progress bar */}
          {loading && transcriptionProgress > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-blue-700">Transcription Progress</span>
                <span className="text-sm font-bold text-blue-700">{transcriptionProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-4 rounded-full transition-all duration-300 ease-in-out" 
                  style={{ width: `${transcriptionProgress}%` }}
                >
                </div>
              </div>
              <div className="mt-1 text-xs text-gray-500 text-center">
                {transcriptionProgress < 15 ? 'Downloading video...' : 
                 transcriptionProgress < 30 ? 'Converting to audio...' :
                 transcriptionProgress < 45 ? 'Extracting subtitles...' :
                 transcriptionProgress < 60 ? 'Processing audio...' :
                 transcriptionProgress < 75 ? 'Transcribing content...' :
                 transcriptionProgress < 90 ? 'Translating...' :
                 'Finalizing results...'}
              </div>
            </div>
          )}

          {result?.error && (
            <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
              <p>{result.error}</p>
            </div>
          )}

          {/* Add this pink error banner directly after the form */}
          {videoIdError && <ErrorMessage error={videoIdError} onClose={() => setVideoIdError(null)} />}

          {result && (
            <>
              <div className="mt-4">
                <h2 className="text-xl font-semibold mb-2">Audio</h2>
                
                <div className="flex space-x-2 mb-4">
                  <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center download-audio-btn"
                    onClick={handleDownload}
                    disabled={!result?.audioPath || result?.audioPath === "No audio path"}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Audio
                  </button>
                </div>
                
                {/* Always show audio player if we have a result */}
                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg">
                  {result?.audioPath && result.audioPath !== "No audio path" ? (
                    <audio 
                      controls
                      className="w-full"
                      src={`/api/download?path=${encodeURIComponent(result.audioPath)}`}
                    >
                      Your browser does not support the audio element.
                    </audio>
                  ) : (
                    <div className="text-center p-4 text-gray-500">
                      <p>No audio file available</p>
                      <p className="text-xs">An AI-generated transcript is still available below</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {result?.transcript && (
            <div className="space-y-6">
              {result.title && (
                <div className="text-center p-2 border-b pb-4 mb-2">
                  <h2 className="text-xl font-semibold">{result.title}</h2>
                  {result.url && (
                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm break-all">
                      {result.url}
                    </a>
                  )}
                  {result.detectedLanguage && (
                    <div className="mt-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        Detected Language: {getLanguageName(result.detectedLanguage)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {result.message && (
                <div className="p-3 bg-yellow-100 text-yellow-800 rounded-lg text-sm mb-6">
                  {result.message}
                </div>
              )}

              {/* Update the transcript display area to show more helpful information when transcript is missing */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-semibold flex items-center">
                    <span>{result?.detectedLanguage ? getLanguageName(result.detectedLanguage) : 'English'} Transcription:</span>
                    <span className="ml-2 text-sm text-gray-500">(Transcription from audio)</span>
                  </h2>
                  
                  {/* Only show download transcript button if we have a transcript */}
                  {result?.transcript && (
                    <button
                      onClick={() => {
                        if (result?.transcript) {
                          const blob = new Blob([result.transcript], { type: 'text/plain' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `transcript_${result?.title || 'video'}.txt`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                        }
                      }}
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm flex items-center"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download
                    </button>
                  )}
                </div>
                
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4">
                  <ReactMarkdown className="whitespace-pre-wrap">
                    {result?.transcript && typeof result.transcript === 'string' && result.transcript.trim() !== '' 
                      ? result.transcript 
                      : "No transcription available. The transcription service could not extract text from the audio."}
                  </ReactMarkdown>
                  
                  {(!result?.transcript || (typeof result.transcript === 'string' && result.transcript.trim() === '')) && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
                      <p className="text-sm font-medium">No transcription available</p>
                      <p className="text-xs mt-1">
                        No transcription available. The audio file has been downloaded and can be played using the audio player above.
                      </p>
                      <div className="mt-2 bg-gray-100 p-2 rounded text-xs font-mono">
                        # To install the required package:<br/>
                        pip install openai-whisper<br/><br/>
                        # Or with a virtual environment:<br/>
                        python -m venv venv<br/>
                        source venv/bin/activate<br/>
                        pip install openai-whisper
                      </div>
                      <p className="text-xs mt-2">
                        After installation, restart the application and try again.
                      </p>
                      {result?.error && (
                        <p className="text-xs mt-2 text-red-600">
                          Error: {result.error}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Always show translation options */}
                <div className="mt-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Translation to Hebrew:</h2>
                    <div className="flex space-x-2">
                      <button
                        onClick={translateWithGoogleTranslate}
                        className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm flex items-center"
                        disabled={!result?.transcript || isTranslating}
                      >
                        {isTranslating && selectedTranslator === 'google' ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Translating...
                          </span>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20 5h-9.586L10 4.414V3a1 1 0 00-1-1H3a1 1 0 00-1 1v14a1 1 0 001 1h7.414L11 19.586V21a1 1 0 001 1h8a1 1 0 001-1V6a1 1 0 00-1-1zm-10 7.586V15H3V3h6v1.414l-2.293 2.293L6 7.414l1.707 1.707L10 11.414zM19 20h-6v-1.414l3.293-3.293L17 14.586l-1.707-1.707L12 9.586V7h8v13z" />
                            </svg>
                            Google Translate
                          </>
                        )}
                      </button>
                      <button
                        onClick={translateWithLocalAI}
                        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm flex items-center"
                        disabled={!result?.transcript || isTranslating}
                      >
                        {isTranslating && selectedTranslator === 'nllb' ? (
                          <span className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Translating...
                          </span>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-8.29 13.29a1 1 0 01-1.42 0l-3.29-3.29a1 1 0 011.41-1.41L10 14.17l6.88-6.88a1 1 0 011.41 1.41l-7.58 7.59z" />
                            </svg>
                            NLLB (Meta AI)
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {translationProgress > 0 && translationProgress < 100 && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 dark:bg-gray-700 mt-2">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${translationProgress}%` }}></div>
                      <p className="text-sm text-gray-500 mt-1">{translationProgress}% - {translationProgressText}</p>
                    </div>
                  )}
                  
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                    <div dir="rtl" className="whitespace-pre-wrap font-hebrew">
                      {result?.translation || "Click one of the translation buttons above to see the Hebrew translation."}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </ErrorDisplay>
  );
}

// Add this utility function before the error boundary to capture runtime errors
function captureError(fn: Function, fallback: any): any {
  try {
    return fn();
  } catch (error: any) {
    console.error("Captured error:", error);
    
    // Add the error to a global array accessible in the UI
    if (typeof window !== 'undefined') {
      window.__capturedErrors = window.__capturedErrors || [];
      window.__capturedErrors.push({
        message: error?.message || String(error),
        stack: error?.stack,
        time: new Date().toISOString()
      });
    }
    
    return fallback;
  }
}

// Add TypeScript declaration for the global variable
declare global {
  interface Window {
    __capturedErrors?: Array<{
      message: string;
      stack?: string;
      time: string;
    }>;
    __lastVideoId?: string;
  }
}




