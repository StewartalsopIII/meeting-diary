require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing from environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSupabaseSetup() {
  console.log('Supabase Verification Tool');
  console.log('=========================');
  console.log('Testing Supabase connection and configuration...\n');

  try {
    // 1. Check connection
    console.log('1. Testing connection to Supabase...');
    const { data: versionData, error: versionError } = await supabase.rpc('version');
    
    if (versionError) {
      console.error('❌ Connection error:', versionError.message);
    } else {
      console.log('✅ Successfully connected to Supabase');
      console.log(`   PostgreSQL version: ${versionData || 'unknown'}`);
    }
    
    // 2. Check if auth.users table exists and is accessible
    console.log('\n2. Checking auth.users table...');
    const { data: userData, error: userError } = await supabase
      .from('user_info')
      .select('id, email, created_at')
      .limit(5);
    
    if (userError) {
      console.error('❌ Error accessing user_info view:', userError.message);
      console.log('   Possible causes:');
      console.log('   - The view might not exist');
      console.log('   - Your service role may not have access to the auth schema');
      console.log('   - Run the SQL setup script to create required views and tables');
    } else {
      console.log('✅ Successfully accessed user_info view');
      console.log(`   Found ${userData.length} users in the database`);
      
      if (userData.length > 0) {
        console.log('   Sample user (ID only):');
        userData.forEach(user => {
          console.log(`   - ${user.id.substring(0, 8)}... (created: ${new Date(user.created_at).toLocaleDateString()})`);
        });
      }
    }
    
    // 3. Check transcripts table
    console.log('\n3. Checking transcripts table...');
    const { data: tableInfo, error: tableError } = await supabase
      .from('transcripts')
      .select('*')
      .limit(1);
      
    if (tableError && tableError.code === '42P01') {
      console.error('❌ Error: transcripts table does not exist');
      console.log('   Run the supabase-schema.sql script to create the table');
    } else if (tableError) {
      console.error('❌ Error accessing transcripts table:', tableError.message);
    } else {
      console.log('✅ transcripts table exists and is accessible');

      // Check RLS policies
      console.log('\n4. Checking Row Level Security policies...');
      const { data: policiesData, error: policiesError } = await supabase
        .rpc('get_policies_info', { table_name: 'transcripts' });
        
      if (policiesError) {
        console.error('❌ Error checking RLS policies:', policiesError.message);
        console.log('   Create an RPC function or check policies manually in Supabase dashboard');
      } else if (!policiesData || policiesData.length === 0) {
        console.log('❌ No RLS policies found for transcripts table');
        console.log('   Run the supabase-schema.sql script to set up RLS policies');
      } else {
        console.log('✅ RLS policies are in place for transcripts table');
        console.log(`   Found ${policiesData.length} policies`);
        policiesData.forEach(policy => {
          console.log(`   - ${policy.policyname}: ${policy.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'} (${policy.cmd})`);
        });
      }
      
      // Count transcripts
      const { data: countData, error: countError } = await supabase
        .from('transcripts')
        .select('*', { count: 'exact' });
        
      if (countError) {
        console.error('\n❌ Error counting transcripts:', countError.message);
      } else {
        console.log(`\n✅ Found ${countData.length} transcripts in the database`);
        
        if (countData.length > 0) {
          console.log('\n5. Testing transcript retrieval by user...');

          // Group transcripts by user
          const transcriptsByUser = {};
          countData.forEach(transcript => {
            if (!transcriptsByUser[transcript.user_id]) {
              transcriptsByUser[transcript.user_id] = [];
            }
            transcriptsByUser[transcript.user_id].push(transcript);
          });
          
          console.log(`   Found transcripts for ${Object.keys(transcriptsByUser).length} different users`);
          
          // Sample output for first user
          const firstUserId = Object.keys(transcriptsByUser)[0];
          if (firstUserId) {
            console.log(`   User ${firstUserId.substring(0, 8)}... has ${transcriptsByUser[firstUserId].length} transcripts`);
            
            // Check if we can query by user_id
            const { data: userTranscripts, error: userTranscriptError } = await supabase
              .from('transcripts')
              .select('id, title, format, created_at')
              .eq('user_id', firstUserId)
              .limit(3);
              
            if (userTranscriptError) {
              console.error('❌ Error retrieving transcripts by user_id:', userTranscriptError.message);
            } else {
              console.log('✅ Successfully retrieved transcripts filtered by user_id');
              console.log('   Sample transcripts:');
              userTranscripts.forEach(t => {
                console.log(`   - ${t.title} (${t.format}) - ${new Date(t.created_at).toLocaleDateString()}`);
              });
            }
          }
        }
      }
    }
    
    // Overall assessment
    console.log('\n=========================');
    console.log('Supabase Configuration Summary:');
    
    if (!versionError && !userError && !tableError) {
      console.log('✅ Your Supabase setup appears to be properly configured');
      console.log('   You can now store and retrieve transcripts for authenticated users');
    } else {
      console.log('❌ Your Supabase setup needs attention');
      console.log('   Please address the issues above before proceeding');
    }
    
  } catch (error) {
    console.error('Unexpected error during verification:', error);
  }
}

// Run the verification
checkSupabaseSetup().catch(console.error);

// Helper RPC function to create in Supabase SQL Editor:
/*
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
*/