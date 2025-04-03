# Supabase Transcript Storage Setup

This guide will walk you through setting up and verifying the Supabase database for storing transcripts with user authentication in the Meeting Diary application.

## Prerequisites

1. A Supabase account and project already set up
2. Authentication configured as per the `SUPABASE_SETUP.md` guide
3. Environment variables set in your `.env` file:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`

## Database Setup

### Step 1: Create the Transcripts Table and RLS Policies

The `supabase-schema.sql` file contains the necessary SQL to create the transcripts table and set up Row Level Security (RLS) policies. You can apply this schema in two ways:

#### Option 1: Using the Supabase Dashboard

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Create a new query
4. Copy and paste the contents of `supabase-schema.sql`
5. Run the query

#### Option 2: Using the Supabase CLI

If you have the Supabase CLI installed, you can run:

```
supabase db reset --db-url your_db_connection_string
```

### Step 2: Create the RPC Helper Function

This function helps diagnose RLS policy issues and is used by the verification script:

1. Go to the Supabase SQL Editor
2. Create a new query
3. Paste the following SQL:

```sql
CREATE OR REPLACE FUNCTION get_policies_info(table_name text)
RETURNS TABLE (
  policyname text,
  permissive text,
  cmd text,
  qual text,
  with_check text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.policyname,
    p.permissive,
    p.cmd,
    p.qual::text,
    p.with_check::text
  FROM
    pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE
    c.relname = table_name
    AND n.nspname = 'public';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

4. Run the query

## Verification

You can verify your Supabase setup using the included verification script:

```bash
node check-supabase.js
```

This script will:
1. Test the connection to your Supabase instance
2. Check that the auth.users table is accessible
3. Verify the transcripts table exists
4. Check that RLS policies are correctly configured
5. Test transcript retrieval by user

## Common Issues and Solutions

### Table Doesn't Exist

If you see "relation 'transcripts' does not exist", you need to run the database setup script:

```
Error: relation "transcripts" does not exist
```

**Solution**: Run the SQL setup script from `supabase-schema.sql`.

### JWT Verification Failed

If you see JWT verification errors, the authentication configuration might be incorrect:

```
Error: JWT verification failed
```

**Solution**: Check that your `SUPABASE_URL` environment variable matches your project URL and that your service key is correctly set.

### Permission Denied for Table

If you see permission errors, RLS policies might not be set up correctly:

```
Error: permission denied for table transcripts
```

**Solution**: Verify RLS policies are in place and that they are correctly based on the user's ID.

### Foreign Key Constraint Violation

If you see errors about foreign key constraints:

```
Error: insert or update on table "transcripts" violates foreign key constraint
```

**Solution**: Ensure the user exists in the auth.users table and that you're using the correct user_id.

## Integration with Frontend

The application is now integrated with Supabase for transcript storage:

1. The `/api/transcribe` endpoint saves transcripts to the Supabase database
2. The `/api/transcripts` endpoint retrieves all transcripts for the authenticated user
3. Individual transcripts can be accessed via `/api/transcripts/:id`
4. Transcripts can be updated with `/api/transcripts/:id` (PUT method)
5. Transcripts can be deleted with `/api/transcripts/:id` (DELETE method)

The `transcripts.html` page provides a user interface for managing transcripts, including:
- Viewing a list of all transcripts
- Reading transcript content
- Renaming transcripts
- Downloading transcripts
- Deleting transcripts

## Manual Testing

After setup, you should test:

1. Creating a new transcript by uploading and processing a file
2. Verifying the transcript appears on the "My Transcripts" page
3. Testing transcript editing functionality
4. Testing transcript deletion
5. Verifying that users can only see their own transcripts

## Next Steps

You may want to consider:

1. Adding full-text search for transcripts
2. Implementing pagination for users with many transcripts
3. Adding transcript sharing functionality
4. Implementing sorting and filtering options
5. Adding transcript categories or tags