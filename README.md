# YouTube Transcriber & Translator

An application that allows you to transcribe YouTube videos from English and translate them to Hebrew.

## Features

- Modern user interface built with Next.js and TailwindCSS
- Enter any YouTube URL and see a demo of the transcription process
- Mock responses demonstrate English transcription and Hebrew translation
- Ready to be extended with real processing capabilities

## Demo Mode

This application currently runs in "Demo Mode" which simulates the transcription and translation of YouTube videos without actually processing them. It demonstrates the user interface and workflow.

## Setup Instructions

### Prerequisites

- Node.js and npm

### Installation

1. **Clone the repository**

```bash
git clone <repository-url>
cd <repository-name>
```

2. **Install Node.js dependencies**

```bash
npm install
```

3. **Start the development server**

```bash
npm run dev
```

4. **Access the application**

Open your browser and navigate to: `http://localhost:3000`

## Using the Application

1. Enter a YouTube URL in the input field
2. Click "Transcribe"
3. View the English transcript and Hebrew translation

## Extending with Real Processing

To implement actual YouTube transcription and translation, you would need to:

1. Install Python dependencies:
   - yt-dlp (for downloading YouTube videos)
   - openai-whisper (for transcription)
   - googletrans (for translation)
   - ffmpeg-python (for audio processing)

2. Modify the `src/app/api/transcribe/route.ts` file to use the Python script

3. Set up appropriate error handling and user feedback

## Future Improvements

- Implement actual video processing with Python
- Add history of transcribed videos
- Allow downloading transcriptions
- Support for multiple languages