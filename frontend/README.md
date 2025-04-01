# Meeting Diary - Frontend

A web interface for Meeting Diary, allowing you to transcribe and manage your meeting recordings with Supabase integration.

## Prerequisites

- Node.js installed
- meeting-diary command available (install globally with `npm install -g meeting-diary` or use a local path)
- AssemblyAI API key
- Existing Supabase project with authentication set up

## Setup Instructions

Follow these steps to integrate transcript storage with your existing Supabase project:

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the frontend directory by copying the example:

```bash
cp .env.example .env
```

Edit the file to add your API keys and configuration:

```
# AssemblyAI API Key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# Meeting Diary CLI path
MEETING_DIARY_PATH=meeting-diary

# Server Port
PORT=3000

# Supabase Configuration (use your existing project credentials)
SUPABASE_URL=https://your-project-url.supabase.co
SUPABASE_ANON_KEY=your_public_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

### 3. Create the Transcripts Table in Supabase

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Create a new query
4. Copy and paste the SQL from `supabase-schema.sql` into the editor
5. Execute the query to create the transcripts table and set up Row Level Security

This will:
- Create a new `transcripts` table
- Set up proper Row Level Security (RLS) policies
- Create necessary indexes
- Add support for future vector search

### 4. Start the Server

```bash
npm start
```

The server will be available at http://localhost:3000 (or the port specified in .env).

## Features

- **User authentication** with your existing Supabase project
- **Transcript storage** in your Supabase database
- **Multiple output formats**: Markdown, Text, SRT, and JSON
- **Speaker identification** and metadata extraction
- **Search and manage** your transcripts with pagination and sorting
- **Future-proof** data structure for semantic search with vector embeddings
- **Row Level Security** ensures users can only access their own transcripts

## Using the Application

1. Log in with your Supabase user account
2. Navigate between "New Transcript" and "My Transcripts" tabs
3. Upload and process audio/video files
4. View, edit, and manage your stored transcripts
5. Search and filter your transcript collection

## Transcript API

The application provides the following API endpoints for managing transcripts:

- `POST /api/transcribe` - Create a new transcript
- `GET /api/transcripts` - List all transcripts with pagination
- `GET /api/transcripts/:id` - Get a specific transcript
- `PUT /api/transcripts/:id` - Update a transcript
- `DELETE /api/transcripts/:id` - Delete a transcript

For detailed API documentation, see [TRANSCRIPT_STORAGE.md](TRANSCRIPT_STORAGE.md).

## Troubleshooting

If you encounter issues with the transcripts table:

1. Check Supabase console logs for any SQL errors
2. Make sure Row Level Security is enabled on the transcripts table
3. Verify that the SUPABASE_SERVICE_KEY has the necessary permissions
4. Check that your user account is properly authenticated

For more information, see the main [README.md](../README.md) file.