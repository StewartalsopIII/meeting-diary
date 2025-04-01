# Transcript Storage with Supabase

This document provides information on how Meeting Diary stores and manages transcripts using Supabase.

## Overview

Meeting Diary stores all transcripts in a Supabase PostgreSQL database, with the following features:

- Secure storage with Row Level Security (RLS) to ensure users can only access their own transcripts
- Full CRUD operations (Create, Read, Update, Delete)
- Support for different transcript formats (Markdown, JSON, TXT, SRT)
- Metadata storage including speaker information, duration, etc.
- Preparation for future vector search capabilities

## Setup Requirements

1. A Supabase project with authentication enabled
2. The transcripts table and associated functions created in your Supabase database
3. Environment variables properly configured

## Environment Variables

The following environment variables must be set in your `.env` file:

```
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Database Schema

The system uses a `transcripts` table with the following structure:

```sql
CREATE TABLE IF NOT EXISTS public.transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('md', 'txt', 'json', 'srt')),
    file_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    embedding VECTOR(1536), -- For future OpenAI embeddings
    chunks JSONB DEFAULT '[]'::JSONB, -- Store chunks of text for retrieval
    metadata JSONB DEFAULT '{}'::JSONB -- Store additional metadata
);
```

## Setting Up the Database

To set up the database tables and security policies:

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Create a new query
4. Copy and paste the contents of `supabase-schema.sql`
5. Run the query

## API Endpoints

The application provides the following API endpoints for transcript management:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/transcribe` | POST | Transcribe and store audio/video files |
| `/api/v1/transcripts` | GET | Get all transcripts for the authenticated user |
| `/api/v1/transcripts/:id` | GET | Get a specific transcript by ID |
| `/api/v1/transcripts/:id` | PUT | Update a specific transcript |
| `/api/v1/transcripts/:id` | DELETE | Delete a specific transcript |

All endpoints require authentication and respect Row Level Security policies.

## Troubleshooting

### Diagnostic Tools

We've included diagnostic tools to help you troubleshoot issues with Supabase integration:

#### 1. `check-supabase.js`

This script verifies that your Supabase setup is correct:

```bash
node check-supabase.js
```

It checks:
- Environment variables
- Database connection
- Table existence
- Row Level Security configuration

#### 2. `test-insert.js`

This script tests if transcript insertion is working correctly:

```bash
node test-insert.js
```

It attempts to:
- Connect to Supabase
- Find a valid user ID
- Insert a test transcript
- Verify the transcript was inserted correctly
- Delete the test transcript

### Common Issues and Solutions

#### "Cannot read properties of undefined (reading 'auth')"

This error occurs when the Supabase client isn't properly initialized before attempting to use its auth methods.

**Solution**:
1. Ensure the Supabase script is loaded with: `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
2. Check that your browser can access the CDN
3. Verify that your environment variables are set correctly
4. Make sure the `/api/supabase-config` endpoint returns valid configuration

#### "Error: relation 'transcripts' does not exist"

This error indicates that the transcripts table hasn't been created in your Supabase database.

**Solution**:
1. Run the SQL from `supabase-schema.sql` in your Supabase SQL Editor
2. Verify that the table was created by checking the Table Editor

#### "Error: permission denied for table transcripts"

This error suggests Row Level Security is preventing access to the table.

**Solution**:
1. Check that RLS policies are configured correctly in `supabase-schema.sql`
2. Verify that the user is properly authenticated
3. Ensure you're using the correct Supabase key (anon key for client-side operations)

#### Browser Console Network Errors

If you see network errors in your browser console:

**Solution**:
1. Check that your Supabase URL is correct and accessible
2. Verify CORS is properly configured in your Supabase project
3. Make sure you're not mixing HTTP and HTTPS

## Security Considerations

The transcript storage system uses several security mechanisms:

1. **Authentication**: All transcript operations require a valid Supabase session
2. **Row Level Security**: Users can only access their own transcripts
3. **Foreign Key Constraints**: Transcripts are linked to valid users
4. **API Authorization**: All API endpoints verify the user's identity

## Future Enhancements

The system is prepared for future enhancements including:

1. **Vector Search**: The `embedding` column can store OpenAI embeddings for semantic search
2. **Chunking**: The `chunks` column already stores text segments for more precise retrieval
3. **Extended Metadata**: The `metadata` column can store additional information about transcripts