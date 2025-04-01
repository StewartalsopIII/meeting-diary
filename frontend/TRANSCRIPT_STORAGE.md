# Transcript Storage with Supabase

This document explains how to set up and use the Supabase transcript storage functionality in Meeting Diary.

## Overview

Meeting Diary now stores all processed transcripts in a Supabase database, with the following features:

- **Secure storage**: All transcripts are protected with Row Level Security (RLS) so users can only access their own transcripts
- **Metadata extraction**: Speaker information, duration, and other metadata are automatically extracted and stored
- **Text chunking**: Transcripts are automatically chunked to support future semantic search capabilities
- **Full CRUD operations**: Complete API for creating, reading, updating, and deleting transcripts
- **Pagination and search**: List transcripts with pagination and search functionality
- **API versioning**: Versioned API endpoints (`/api/v1/...`) for better backward compatibility

## Database Setup

To set up the transcript storage in Supabase:

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Create a New Query
4. Copy and paste the SQL from `supabase-schema.sql`
5. Run the query to create the necessary tables and policies

## API Endpoints

The following API endpoints are available for working with transcripts. All endpoints are available in both legacy and versioned formats.

### API Versioning

All endpoints are available with the following prefixes:
- Legacy format: `/api/...` (for backward compatibility)
- Versioned format: `/api/v1/...` (recommended for new integrations)

For example, to list transcripts, you can use either:
- `/api/transcripts` (legacy)
- `/api/v1/transcripts` (versioned)

The versioned API ensures backward compatibility as new features are added in future versions.

### 1. Create a transcript

**Endpoints:** 
- `POST /api/transcribe` (legacy)
- `POST /api/v1/transcribe` (versioned)

This endpoint uploads an audio/video file, processes it with AssemblyAI, and stores the transcript in Supabase.

**Request:**
- Method: POST
- Authentication: Required
- Content-Type: multipart/form-data
- Body:
  - `file`: The audio/video file to transcribe (required)
  - `format`: Output format (md, txt, json, srt), defaults to 'md'
  - `speakers`: JSON array of speaker names (optional)
  - `title`: Custom title for the transcript (optional)

**Response:**
```json
{
  "id": "uuid",
  "title": "Transcript Title",
  "content": "Transcript content...",
  "format": "md",
  "created_at": "2025-03-20T15:30:00.000Z"
}
```

### 2. List transcripts

**Endpoints:**
- `GET /api/transcripts` (legacy)
- `GET /api/v1/transcripts` (versioned)

Retrieves a paginated list of the user's transcripts.

**Request:**
- Method: GET
- Authentication: Required
- Query Parameters:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
  - `order_by`: Field to sort by (created_at, updated_at, title) (default: updated_at)
  - `order_direction`: Sort direction (asc, desc) (default: desc)
  - `search`: Search term to filter results (optional)

**Response:**
```json
{
  "transcripts": [
    {
      "id": "uuid",
      "title": "Transcript Title",
      "format": "md",
      "file_name": "original.mp4",
      "created_at": "2025-03-20T15:30:00.000Z",
      "updated_at": "2025-03-20T15:30:00.000Z",
      "metadata": {
        "speakers": ["Speaker 1", "Speaker 2"],
        "duration": 300000,
        "processedAt": "2025-03-20T15:30:00.000Z"
      }
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "pages": 3
  }
}
```

### 3. Get a specific transcript

**Endpoints:**
- `GET /api/transcripts/:id` (legacy)
- `GET /api/v1/transcripts/:id` (versioned)

Retrieves a specific transcript by ID.

**Request:**
- Method: GET
- Authentication: Required
- Path Parameters:
  - `id`: UUID of the transcript

**Response:**
```json
{
  "id": "uuid",
  "user_id": "user-uuid",
  "title": "Transcript Title",
  "content": "Transcript content...",
  "format": "md",
  "file_name": "original.mp4",
  "created_at": "2025-03-20T15:30:00.000Z",
  "updated_at": "2025-03-20T15:30:00.000Z",
  "metadata": {
    "speakers": ["Speaker 1", "Speaker 2"],
    "duration": 300000,
    "processedAt": "2025-03-20T15:30:00.000Z"
  },
  "chunks": [
    {
      "text": "Chunk of text...",
      "position": 0
    }
  ]
}
```

### 4. Update a transcript

**Endpoints:**
- `PUT /api/transcripts/:id` (legacy)
- `PUT /api/v1/transcripts/:id` (versioned)

Updates a specific transcript by ID.

**Request:**
- Method: PUT
- Authentication: Required
- Path Parameters:
  - `id`: UUID of the transcript
- Body:
  - `title`: New title (optional)
  - `content`: New content (optional)
  - `metadata`: Updated metadata (optional)

**Response:**
```json
{
  "id": "uuid",
  "title": "Updated Title",
  "content": "Updated content...",
  "updated_at": "2025-03-20T16:30:00.000Z"
}
```

### 5. Delete a transcript

**Endpoints:**
- `DELETE /api/transcripts/:id` (legacy)
- `DELETE /api/v1/transcripts/:id` (versioned)

Deletes a specific transcript by ID.

**Request:**
- Method: DELETE
- Authentication: Required
- Path Parameters:
  - `id`: UUID of the transcript

**Response:**
```json
{
  "success": true,
  "message": "Transcript deleted successfully"
}
```

## Future Vectorization Support

The database schema includes fields for future vector embedding support:

- **embedding**: A vector column for storing embeddings (currently set to 1536 dimensions for OpenAI embeddings)
- **chunks**: A JSONB column that stores text chunks for retrieval and embedding

To enable vector search:

1. Uncomment the vector extension creation line in `supabase-schema.sql`
2. Uncomment the search function in `supabase-schema.sql`
3. Implement a background job to generate embeddings for each chunk
4. Create a new API endpoint for semantic search

## Security Considerations

- Row Level Security (RLS) policies ensure users can only access their own transcripts
- API endpoints validate user authentication and permission to access resources
- Input validation is performed on all endpoints
- SQL injection prevention is implemented for search and sorting parameters

## Error Handling

All API endpoints include comprehensive error handling with appropriate HTTP status codes:

- `400 Bad Request`: Invalid input or missing required fields
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side errors

Error responses include detailed error messages to help diagnose issues.