#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkSupabaseSetup() {
  console.log('Checking Supabase setup...');
  
  // Check environment variables
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in your .env file');
    process.exit(1);
  }
  
  console.log('Supabase environment variables found');
  
  // Initialize Supabase client
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized');
    
    // Check if the transcripts table exists
    console.log('Checking if transcripts table exists...');
    const { data, error } = await supabase
      .from('transcripts')
      .select('id')
      .limit(1);
    
    if (error) {
      if (error.message.includes('relation "transcripts" does not exist')) {
        console.error('Error: Transcripts table does not exist!');
        console.error('Please run the SQL script from supabase-schema.sql to create the table.');
        console.error('Instructions:');
        console.error('1. Log in to your Supabase dashboard');
        console.error('2. Go to the SQL Editor');
        console.error('3. Create a new query');
        console.error('4. Copy and paste the contents of supabase-schema.sql');
        console.error('5. Run the query');
        process.exit(1);
      } else {
        console.error('Error checking transcripts table:', error);
        process.exit(1);
      }
    }
    
    console.log('Transcripts table exists');
    
    // Check if Row Level Security is enabled
    console.log('Checking Row Level Security policies...');
    const { data: rlsData, error: rlsError } = await supabase
      .rpc('check_table_rls', { table_name: 'transcripts' })
      .single();
    
    if (rlsError) {
      console.log('Error checking RLS, this may be normal if the function does not exist');
      console.log('RLS status could not be determined automatically');
    } else if (rlsData) {
      console.log('Row Level Security is enabled for transcripts table');
    } else {
      console.warn('WARNING: Row Level Security might not be enabled for the transcripts table');
      console.warn('Please ensure RLS is enabled for data protection');
    }
    
    // Create a test transcript (if table exists)
    console.log('Attempting to create a test transcript...');
    const testTranscript = {
      user_id: '00000000-0000-0000-0000-000000000000', // Dummy user ID
      title: 'Test Transcript',
      content: 'This is a test transcript content',
      format: 'txt',
      file_name: 'test.txt',
      metadata: {
        speakers: ['Test Speaker'],
        duration: 60000,
        processedAt: new Date().toISOString()
      },
      chunks: [{ text: 'This is a test transcript content', position: 0 }]
    };
    
    try {
      const { data: insertData, error: insertError } = await supabase
        .from('transcripts')
        .insert(testTranscript)
        .select()
        .single();
      
      if (insertError) {
        if (insertError.message.includes('violates row-level security policy')) {
          console.log('Row Level Security prevented test transcript insertion (this is good)');
          console.log('This confirms RLS is working correctly');
        } else {
          console.error('Error creating test transcript:', insertError);
        }
      } else {
        console.log('Test transcript created successfully with ID:', insertData.id);
        console.warn('WARNING: Row Level Security might not be properly configured!');
        console.warn('The test was able to insert a transcript without a valid user ID');
        
        // Clean up the test transcript
        console.log('Cleaning up test transcript...');
        const { error: deleteError } = await supabase
          .from('transcripts')
          .delete()
          .eq('id', insertData.id);
        
        if (deleteError) {
          console.error('Error deleting test transcript:', deleteError);
        } else {
          console.log('Test transcript deleted successfully');
        }
      }
    } catch (e) {
      console.error('Unexpected error during test transcript insertion:', e);
    }
    
    console.log('Supabase setup check completed');
    console.log('If all checks passed, your setup should be working correctly');
    
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
    process.exit(1);
  }
}

// Run the check
checkSupabaseSetup().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});