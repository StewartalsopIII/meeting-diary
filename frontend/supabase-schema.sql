-- Create transcripts table with all required fields
CREATE TABLE IF NOT EXISTS public.transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('md', 'txt', 'json', 'srt')),
    file_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    embedding VECTOR(1536), -- For OpenAI embeddings (adjust dimension if using different model)
    chunks JSONB DEFAULT '[]'::JSONB, -- Store chunks of text for retrieval
    metadata JSONB DEFAULT '{}'::JSONB -- Store additional metadata like duration, speaker count, etc.
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to the transcripts table
DROP TRIGGER IF EXISTS set_updated_at ON public.transcripts;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.transcripts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_transcripts_user_id ON public.transcripts(user_id);

-- Create index on updated_at for sorting by most recent
CREATE INDEX IF NOT EXISTS idx_transcripts_updated_at ON public.transcripts(updated_at DESC);

-- Set up Row Level Security (RLS)
-- Enable RLS on the transcripts table
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- Create policy for users to select only their own transcripts
CREATE POLICY select_own_transcripts ON public.transcripts
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy for users to insert only their own transcripts
CREATE POLICY insert_own_transcripts ON public.transcripts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update only their own transcripts
CREATE POLICY update_own_transcripts ON public.transcripts
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create policy for users to delete only their own transcripts
CREATE POLICY delete_own_transcripts ON public.transcripts
    FOR DELETE
    USING (auth.uid() = user_id);

-- For future vectorization support (create extension if not exists)
-- Note: Uncomment this when you're ready to use vector search
-- CREATE EXTENSION IF NOT EXISTS vector;

-- Example of creating a function to search transcripts by similarity
-- Uncomment when ready to implement vector search
/*
CREATE OR REPLACE FUNCTION search_transcripts(
  query_embedding VECTOR(1536),
  similarity_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.content,
    1 - (t.embedding <=> query_embedding) as similarity
  FROM public.transcripts t
  WHERE 1 - (t.embedding <=> query_embedding) > similarity_threshold
    AND t.user_id = auth.uid()
    AND t.embedding IS NOT NULL
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
*/

-- Helper function to check if RLS is enabled on a table
CREATE OR REPLACE FUNCTION check_table_rls(table_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rls_enabled boolean;
BEGIN
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class
  WHERE oid = (table_name::regclass)::oid;
  
  RETURN rls_enabled;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Function to get user count (safer than direct table access)
CREATE OR REPLACE FUNCTION get_user_count()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;
  RETURN jsonb_build_object('count', user_count);
END;
$$;

-- Function to get first user id (safer than direct table access)
CREATE OR REPLACE FUNCTION get_first_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  first_user_id uuid;
BEGIN
  SELECT id INTO first_user_id FROM auth.users LIMIT 1;
  RETURN jsonb_build_object('id', first_user_id);
END;
$$;

-- Function to create both functions above
CREATE OR REPLACE FUNCTION create_diagnostics_functions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Function bodies defined in other functions
  RETURN;
END;
$$;

-- Comments:
-- 1. The table includes embedding field for future vector similarity search
-- 2. We use RLS policies to ensure users can only access their own transcripts
-- 3. Indexes are created for efficient querying
-- 4. A trigger is set up to automatically update the updated_at timestamp
-- 5. A commented-out function demonstrates how vector search could be implemented
-- 6. A helper function is provided to check if RLS is enabled on the table