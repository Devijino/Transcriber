import { promises as fs } from 'fs';
import { NextResponse } from 'next/server';
import path from 'path';
import os from 'os';

/**
 * API endpoint for cleaning up temporary files
 * This is a server-side operation that can't be done directly in client components
 */
export async function POST(req: Request) {
  try {
    // Extract request details
    const { requestId } = await req.json();
    
    if (!requestId) {
      return NextResponse.json({
        error: 'Missing requestId parameter'
      }, { status: 400 });
    }
    
    console.log(`Server cleanup requested for request ID: ${requestId}`);
    
    // Initialize result
    const result = {
      deletedFiles: 0,
      freedSpace: 0
    };
    
    // Clean up temp directory
    const videoTempDir = path.join(os.tmpdir(), 'video_transcriptions');
    
    try {
      // Make sure directory exists
      if (!await dirExists(videoTempDir)) {
        return NextResponse.json(result);
      }
      
      const files = await fs.readdir(videoTempDir);
      
      // Find files related to this request
      for (const file of files) {
        try {
          // Check if file is related to this request or is a media file
          if (file.includes(requestId) || isTemporaryMediaFile(file)) {
            const filePath = path.join(videoTempDir, file);
            const stats = await fs.stat(filePath);
            
            // Make sure it's a file, not a directory
            if (!stats.isDirectory()) {
              const fileSize = stats.size;
              await fs.unlink(filePath);
              result.deletedFiles++;
              result.freedSpace += fileSize;
            }
          }
        } catch (fileError) {
          console.error(`Error processing file ${file}:`, fileError);
        }
      }
    } catch (dirError) {
      console.error(`Error accessing directory ${videoTempDir}:`, dirError);
    }
    
    // Also clean up app temp directory
    const appTempDir = path.join(process.cwd(), 'src', 'data', 'temp');
    
    try {
      if (await dirExists(appTempDir)) {
        const tempFiles = await fs.readdir(appTempDir);
        
        for (const file of tempFiles) {
          // Only delete files older than 1 hour
          try {
            const filePath = path.join(appTempDir, file);
            const stats = await fs.stat(filePath);
            
            // Check if file is older than 1 hour
            const fileAge = Date.now() - stats.mtimeMs;
            if (fileAge > 60 * 60 * 1000) {
              const fileSize = stats.size;
              await fs.unlink(filePath);
              result.deletedFiles++;
              result.freedSpace += fileSize;
            }
          } catch (fileError) {
            console.error(`Error processing temp file ${file}:`, fileError);
          }
        }
      }
    } catch (dirError) {
      console.error(`Error accessing app temp directory:`, dirError);
    }
    
    console.log(`Cleanup complete: Removed ${result.deletedFiles} files (${(result.freedSpace / 1024 / 1024).toFixed(2)}MB)`);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in cleanup API:', error);
    return NextResponse.json({
      error: 'Server error during cleanup',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Helper to check if directory exists
 */
async function dirExists(dir: string): Promise<boolean> {
  try {
    await fs.access(dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file is a temporary media file that can be cleaned up
 */
function isTemporaryMediaFile(filename: string): boolean {
  // Check file extensions for media files that can be safely deleted
  const mediaExtensions = ['.mp3', '.mp4', '.wav', '.webm', '.m4a', '.ogg', '.flac', '.txt', '.vtt', '.srt', '.json'];
  
  // Check if file has any of the media extensions
  return mediaExtensions.some(ext => filename.endsWith(ext));
} 