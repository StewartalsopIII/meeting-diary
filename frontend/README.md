# Meeting Diary Frontend

A simple drag-and-drop web interface for the meeting-diary CLI tool with Supabase authentication.

## Prerequisites

- Node.js installed
- meeting-diary installed globally (`npm install -g meeting-diary`)
- AssemblyAI API key
- Supabase account and project

## Setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Set up your environment variables:

```bash
# Copy the example .env file
cp .env.example .env

# Edit the .env file with your API keys
nano .env  # or use any text editor
```

You'll need to add the following environment variables:
- `ASSEMBLYAI_API_KEY`: Your AssemblyAI API key
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key (for client-side auth)
- `SUPABASE_SERVICE_KEY`: Your Supabase service role key (for server-side auth verification)

3. Start the server:

```bash
npm start
```

4. Open your browser and navigate to:

```
http://localhost:3000
```

## Usage

1. Sign up or log in with your email and password.
2. Drag and drop an audio or video file onto the designated area, or click to select a file.
3. Select your preferred output format (Markdown, Text, SRT, or JSON).
4. Optionally add speaker names to improve transcription readability.
5. Click "Process File" to start transcription.
6. Once processing is complete, the transcribed output will be displayed on the page.

## Features

- User authentication with Supabase
- Drag and drop file upload
- Multiple output formats
- Speaker identification
- Simple and intuitive interface
- Secure API key storage in .env file
- Protected API endpoints

## Environment Variables

- `ASSEMBLYAI_API_KEY`: Your AssemblyAI API key (required)
- `PORT`: Server port (default: 3000)
- `SUPABASE_URL`: Your Supabase project URL (required)
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key (required)
- `SUPABASE_SERVICE_KEY`: Your Supabase service role key (required)

## Setting Up Supabase

1. Create a new project on [Supabase](https://supabase.com/).
2. Enable email auth in Authentication → Providers → Email.
3. Copy your project URL and API keys from the project settings.
4. Add them to your .env file as described above.

## Deployment

When deploying to www.getcrazywisdom.com, ensure that all environment variables are properly set in your hosting environment.