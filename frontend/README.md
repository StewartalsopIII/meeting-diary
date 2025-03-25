# Meeting Diary Frontend

A simple drag-and-drop web interface for the meeting-diary CLI tool.

## Prerequisites

- Node.js installed
- meeting-diary installed globally (`npm install -g meeting-diary`)
- AssemblyAI API key

## Setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Set up your API key:

```bash
# Copy the example .env file
cp .env.example .env

# Edit the .env file with your AssemblyAI API key
nano .env  # or use any text editor
```

3. Start the server:

```bash
npm start
```

4. Open your browser and navigate to:

```
http://localhost:3000
```

## Usage

1. Drag and drop an audio or video file onto the designated area, or click to select a file.
2. Select your preferred output format (Markdown, Text, SRT, or JSON).
3. Click "Process File" to start transcription.
4. Once processing is complete, the transcribed output will be displayed on the page.

## Features

- Drag and drop file upload
- Multiple output formats
- Simple and intuitive interface
- Secure API key storage in .env file

## Environment Variables

- `ASSEMBLYAI_API_KEY`: Your AssemblyAI API key (required)
- `PORT`: Server port (default: 3000)