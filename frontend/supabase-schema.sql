-- Transcripts Table Schema
CREATE TABLE transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    format VARCHAR(10) NOT NULL CHECK (format IN ('md', 'txt', 'srt', 'json')),
    file_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_transcripts_updated_at
BEFORE UPDATE ON transcripts
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Row Level Security Policies
-- Enable Row Level Security on the transcripts table
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own transcripts
CREATE POLICY transcripts_select_policy 
ON transcripts 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Users can only insert their own transcripts
CREATE POLICY transcripts_insert_policy 
ON transcripts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own transcripts
CREATE POLICY transcripts_update_policy 
ON transcripts 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy: Users can only delete their own transcripts
CREATE POLICY transcripts_delete_policy 
ON transcripts 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create an index on user_id for faster queries
CREATE INDEX idx_transcripts_user_id ON transcripts(user_id);

-- Create a view to check the auth.users table structure
CREATE OR REPLACE VIEW user_info AS
SELECT id, email, created_at
FROM auth.users;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON transcripts TO authenticated;
GRANT SELECT ON user_info TO authenticated;