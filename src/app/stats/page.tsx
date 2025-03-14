'use client';

import React, { useState, useEffect } from 'react';
import { useTranscripts } from '@/lib/contexts/TranscriptContext';
import Link from 'next/link';

interface ModelStats {
  totalImprovementRuns: number;
  totalTrainingFiles: number;
  totalTranscriptsUsed: number;
  lastImprovement: {
    timestamp: number;
    filename: string;
    content: string;
  } | null;
}

export default function StatsPage() {
  const { transcripts, transcriptCount, getStatistics, improveModel, lastImprovement } = useTranscripts();
  const [isLoading, setIsLoading] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // פונקציה לטעינת סטטיסטיקות המודל מהשרת
  const loadModelStats = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/model/improve');
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      setModelStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model statistics');
      console.error('Error loading model stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // הפעלת תהליך שיפור המודל
  const handleImproveModel = async () => {
    try {
      setIsImproving(true);
      const success = await improveModel();
      
      if (success) {
        alert('Model improvement process started successfully!');
        // רענון הסטטיסטיקות לאחר הצלחה
        loadModelStats();
      } else {
        alert('Failed to start model improvement process. Please check the logs.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to improve model');
      console.error('Error improving model:', err);
    } finally {
      setIsImproving(false);
    }
  };

  // טעינת נתונים בטעינת הדף
  useEffect(() => {
    loadModelStats();
  }, []);

  // חישוב סטטיסטיקות נוספות
  const stats = getStatistics();
  const mostCommonLanguage = Object.entries(stats.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => ({ lang, count }))[0];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">AI Learning Statistics</h1>
          <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Back to Main Page
          </Link>
        </div>
        
        {error && (
          <div className="p-4 mb-6 bg-red-100 text-red-700 border border-red-300 rounded">
            {error}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Basic Stats */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Transcript Database</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded">
                <div className="text-3xl font-bold text-blue-600">{transcriptCount}</div>
                <div className="text-sm text-gray-600">Total Transcripts</div>
              </div>
              
              <div className="p-4 bg-green-50 rounded">
                <div className="text-3xl font-bold text-green-600">
                  {mostCommonLanguage ? mostCommonLanguage.count : 0}
                </div>
                <div className="text-sm text-gray-600">
                  Most Common Language: {mostCommonLanguage ? mostCommonLanguage.lang : 'None'}
                </div>
              </div>
              
              <div className="p-4 bg-purple-50 rounded">
                <div className="text-3xl font-bold text-purple-600">
                  {lastImprovement ? new Date(lastImprovement).toLocaleDateString() : 'Never'}
                </div>
                <div className="text-sm text-gray-600">Last Model Update</div>
              </div>
              
              <div className="p-4 bg-yellow-50 rounded">
                <div className="text-3xl font-bold text-yellow-600">
                  {Object.keys(stats.languages).length}
                </div>
                <div className="text-sm text-gray-600">Supported Languages</div>
              </div>
            </div>
            
            {/* מד התקדמות ליעד האיסוף */}
            <div className="mt-6">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">קצב איסוף תמלולים</span>
                <span className="text-sm font-semibold">{Math.min(100, Math.round(transcriptCount / 10))}%</span>
              </div>
              <div className="w-full h-6 bg-gray-200 rounded-full">
                <div
                  className="h-6 rounded-full transition-all duration-500 ease-out flex items-center justify-end px-3 text-xs font-semibold text-white"
                  style={{
                    width: `${Math.min(100, Math.round(transcriptCount / 10))}%`,
                    background: "linear-gradient(90deg, #3B82F6 0%, #10B981 100%)"
                  }}
                >
                  {transcriptCount >= 100 ? "יעד הושג! 🎉" : `${transcriptCount}/1000`}
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                היעד הוא להגיע ל-1000 תמלולים לאימון מודל משופר. כל תמלול חדש תורם לשיפור איכות התרגום.
              </p>
            </div>
          </div>
          
          {/* Model Training Stats */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">AI Model Training</h2>
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded">
                  <div className="text-3xl font-bold text-blue-600">
                    {modelStats?.totalImprovementRuns || 0}
                  </div>
                  <div className="text-sm text-gray-600">Training Runs</div>
                </div>
                
                <div className="p-4 bg-green-50 rounded">
                  <div className="text-3xl font-bold text-green-600">
                    {modelStats?.totalTranscriptsUsed || 0}
                  </div>
                  <div className="text-sm text-gray-600">Transcripts Used</div>
                </div>
                
                <div className="p-4 bg-purple-50 rounded">
                  <div className="text-3xl font-bold text-purple-600">
                    {modelStats?.lastImprovement ? 
                      new Date(modelStats.lastImprovement.timestamp).toLocaleDateString() : 
                      'Never'}
                  </div>
                  <div className="text-sm text-gray-600">Last Training</div>
                </div>
                
                <div className="p-4 bg-yellow-50 rounded">
                  <div className="text-3xl font-bold text-yellow-600">
                    {modelStats?.totalTrainingFiles || 0}
                  </div>
                  <div className="text-sm text-gray-600">Training Files</div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Latest Transcripts */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Latest Transcripts</h2>
          {transcripts.length === 0 ? (
            <p className="text-gray-500 italic">No transcripts available yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 text-left">ID</th>
                    <th className="px-4 py-2 text-left">Title</th>
                    <th className="px-4 py-2 text-left">Language</th>
                    <th className="px-4 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transcripts.slice(-5).reverse().map((transcript) => (
                    <tr key={transcript.id} className="border-t">
                      <td className="px-4 py-2 font-mono text-sm">{transcript.id}</td>
                      <td className="px-4 py-2">{transcript.title || 'Untitled'}</td>
                      <td className="px-4 py-2">{transcript.sourceLang} → {transcript.targetLang}</td>
                      <td className="px-4 py-2">
                        {new Date(transcript.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Model Improvement Controls */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">AI Model Management</h2>
          <p className="mb-4 text-gray-700">
            Improve the translation model by using the collected transcripts. This process will run in the 
            background and may take several minutes to complete.
          </p>
          
          <div className="flex items-center justify-between">
            <button
              onClick={handleImproveModel}
              disabled={isImproving || transcriptCount === 0}
              className={`px-4 py-2 rounded text-white ${
                isImproving || transcriptCount === 0 ? 
                'bg-gray-400 cursor-not-allowed' : 
                'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isImproving ? 'Improving Model...' : 'Improve Translation Model'}
            </button>
            
            <button
              onClick={loadModelStats}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Loading...' : 'Refresh Stats'}
            </button>
          </div>
          
          {modelStats?.lastImprovement && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Latest Training Log:</h3>
              <div className="bg-gray-100 p-4 rounded font-mono text-sm max-h-40 overflow-y-auto">
                <pre>{modelStats.lastImprovement.content}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}