#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function testTranscriptInsertion() {
  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in your .env file');
    process.exit(1);
  }
  
  console.log('✅ Supabase environment variables found');
  
  // Initialize Supabase client
  try {
    console.log(`📡 Connecting to Supabase at ${supabaseUrl.substring(0, 20)}...`);
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Supabase client initialized');
    
    // Check if the transcripts table exists
    console.log('🔍 Checking if transcripts table exists...');
    const { data, error } = await supabase
      .from('transcripts')
      .select('id')
      .limit(1);
    
    if (error) {
      if (error.message.includes('relation "transcripts" does not exist')) {
        console.error('❌ Error: Transcripts table does not exist!');
        console.error('⚠️ Please run the SQL script from supabase-schema.sql to create the table.');
        console.error('📋 Instructions:');
        console.error('  1. Log in to your Supabase dashboard');
        console.error('  2. Go to the SQL Editor');
        console.error('  3. Create a new query');
        console.error('  4. Copy and paste the contents of supabase-schema.sql');
        console.error('  5. Run the query');
        process.exit(1);
      } else {
        console.error('❌ Error checking transcripts table:', error);
        process.exit(1);
      }
    }
    
    console.log('✅ Transcripts table exists');

    // Check for any users in auth.users table
    console.log('🔍 Checking for users in auth.users...');
    
    // Use RPC instead as direct table access might be restricted
    const { data: userData, error: userError } = await supabase.rpc('get_user_count');
    
    let userCount = 0;
    if (userError) {
      console.error('❌ Error checking users:', userError);
      console.log('⚠️ Unable to check users. Will try to create a test transcript anyway.');
    } else if (userData) {
      userCount = userData.count;
      console.log(`✅ Found ${userCount} users in auth.users`);
    }
    
    // Try to get a real user ID
    let userId = null;
    if (userCount > 0) {
      const { data: firstUser, error: firstUserError } = await supabase.rpc('get_first_user');
      
      if (firstUserError) {
        console.error('❌ Error getting user ID:', firstUserError);
      } else if (firstUser) {
        userId = firstUser.id;
        console.log(`✅ Using real user ID for test: ${userId}`);
      }
    }
    
    // If no user ID found, use a dummy ID
    if (!userId) {
      userId = '00000000-0000-0000-0000-000000000000';
      console.log(`⚠️ Using dummy user ID for test: ${userId}`);
    }
    
    // Create a test transcript
    console.log('🧪 Creating test transcript...');
    const testTranscript = {
      user_id: userId,
      title: 'Test Transcript',
      content: 'This is a test transcript created by the diagnostic script.',
      format: 'txt',
      file_name: 'test.txt',
      metadata: {
        speakers: ['Test Speaker'],
        duration: 60000,
        processedAt: new Date().toISOString(),
        diagnostic: true
      },
      chunks: [{ 
        text: 'This is a test transcript created by the diagnostic script.', 
        position: 0 
      }]
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('transcripts')
      .insert(testTranscript)
      .select()
      .single();
    
    if (insertError) {
      console.error('❌ Error creating test transcript:', insertError);
      
      if (insertError.message.includes('violates row-level security policy')) {
        console.log('⚠️ Row Level Security prevented test transcript insertion.');
        console.log('ℹ️ This may be normal if you\'re trying to insert with a service role key.');
        console.log('💡 Try running the following SQL to temporarily disable RLS for this test:');
        console.log('   ALTER TABLE public.transcripts DISABLE ROW LEVEL SECURITY;');
        console.log('   -- Run your test --');
        console.log('   ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;');
      } else if (insertError.message.includes('violates foreign key constraint')) {
        console.log('⚠️ Foreign key constraint violation. The user_id doesn\'t exist in auth.users.');
        console.log('💡 Create a real user account before running this test.');
      } else {
        console.log('⚠️ Unknown error occurred during insertion.');
      }
    } else {
      console.log('✅ Test transcript created successfully with ID:', insertData.id);
      
      // Verify we can retrieve the transcript
      console.log('🔍 Verifying transcript retrieval...');
      const { data: retrieveData, error: retrieveError } = await supabase
        .from('transcripts')
        .select('*')
        .eq('id', insertData.id)
        .single();
      
      if (retrieveError) {
        console.error('❌ Error retrieving test transcript:', retrieveError);
      } else {
        console.log('✅ Test transcript retrieved successfully');
        
        // Clean up the test transcript
        console.log('🧹 Cleaning up test transcript...');
        const { error: deleteError } = await supabase
          .from('transcripts')
          .delete()
          .eq('id', insertData.id);
        
        if (deleteError) {
          console.error('❌ Error deleting test transcript:', deleteError);
        } else {
          console.log('✅ Test transcript deleted successfully');
        }
      }
    }
    
    // Create schema SQL file
    console.log('📝 Creating function for user count...');
    const { error: funcError } = await supabase.rpc('create_diagnostics_functions');
    
    if (funcError) {
      console.log('⚠️ Error creating diagnostics functions:', funcError.message);
      console.log('💡 You may need to run this SQL manually:');
      
      const sqlContent = `
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
  -- Function bodies defined above
END;
$$;`;
      
      console.log(sqlContent);
      
      // Write the SQL to a file
      fs.writeFileSync(path.join(__dirname, 'diagnostic-functions.sql'), sqlContent);
      console.log('📄 SQL written to diagnostic-functions.sql');
    } else {
      console.log('✅ Diagnostics functions created successfully');
    }
    
    console.log('✨ Diagnostics completed');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the test
testTranscriptInsertion().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});