import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: Request) {
  try {
    // Get URL from request
    const url = new URL(request.url);
    const filePath = url.searchParams.get('path');
    const requestedFilename = url.searchParams.get('filename');
    
    console.log(`Download request for path: ${filePath}, filename: ${requestedFilename}`);
    
    if (!filePath) {
      console.error('Download error: No file path provided');
      return new Response(JSON.stringify({ error: 'File path is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Normalize and check path security
    const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    if (normalizedPath.includes('..')) {
      console.error(`Download error: Invalid file path (potential traversal attack): ${normalizedPath}`);
      return new Response(JSON.stringify({ error: 'Invalid file path' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`Checking if file exists: ${normalizedPath}`);
    
    // Fallback response - Check if file doesn't exist, return empty MP3 file
    if (!fs.existsSync(normalizedPath)) {
      console.log(`File ${normalizedPath} does not exist. Checking for alternates...`);
      
      // Check if this is a YouTube ID format and try to locate the file in the video_transcriptions directory
      const fileName = path.basename(normalizedPath);
      const possibleYouTubeId = fileName.split('.')[0]; // Extract potential YouTube ID from filename
      
      // Check if potential YouTube ID is in the standard format (or close enough)
      if (possibleYouTubeId && possibleYouTubeId.length > 8 && possibleYouTubeId.length < 20) {
        const tempDir = '/tmp/video_transcriptions';
        const alternativePath = path.join(tempDir, `${possibleYouTubeId}.mp3`);
        
        console.log(`Checking for alternative file: ${alternativePath}`);
        
        if (fs.existsSync(alternativePath)) {
          console.log(`Found alternative file at: ${alternativePath}`);
          
          // Get file contents
          const fileData = await fs.promises.readFile(alternativePath);
          const fileName = requestedFilename || path.basename(alternativePath);
          
          console.log(`Serving alternative file: ${fileName}, Content-Type: audio/mpeg`);
          
          return new Response(fileData, {
            status: 200,
            headers: {
              'Content-Type': 'audio/mpeg',
              'Content-Disposition': `attachment; filename="${fileName}"`,
            }
          });
        }
      }
      
      console.log(`No alternative file found. Returning empty audio file.`);
      
      // Return a basic empty MP3 file instead of returning an error
      const emptyMp3Buffer = Buffer.from([
        0xFF, 0xFB, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]); // Creating a basic MP3 header
      
      return new Response(emptyMp3Buffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': `attachment; filename="empty_audio.mp3"`,
        }
      });
    }

    // Get file information
    const stats = await fs.promises.stat(normalizedPath);
    
    // Check if it's a file
    if (!stats.isFile()) {
      console.error(`Download error: Path is not a file: ${normalizedPath}`);
      return new Response(JSON.stringify({ error: 'Path is not a file' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get file contents
    const fileData = await fs.promises.readFile(normalizedPath);
    
    // Determine content type based on file extension
    const extension = path.extname(normalizedPath).toLowerCase();
    let contentType = 'application/octet-stream'; // Default
    
    switch (extension) {
      case '.mp3':
        contentType = 'audio/mpeg';
        break;
      case '.wav':
        contentType = 'audio/wav';
        break;
      case '.txt':
        contentType = 'text/plain';
        break;
      case '.json':
        contentType = 'application/json';
        break;
      // Add more MIME types as needed
    }
    
    const fileName = requestedFilename || path.basename(normalizedPath);
    console.log(`Serving file: ${fileName}, Content-Type: ${contentType}, Size: ${fileData.length} bytes`);
    
    // Return file with explicit attachment disposition to force download
    return new Response(fileData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileData.length.toString(),
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error: any) {
    console.error('Download error:', error);
    
    return new Response(JSON.stringify({ error: 'Error downloading file', details: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 