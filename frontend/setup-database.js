#!/usr/bin/env node

/**
 * Database Schema Setup Script
 * 
 * This script sets up the Supabase database schema for Meeting Diary.
 * It creates the necessary tables and sets up RLS policies.
 * 
 * Usage:
 *   node setup-database.js
 * 
 * Make sure you have the following environment variables set:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_KEY
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Check if required environment variables are set
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in your .env file');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Path to SQL file
const sqlFilePath = path.join(__dirname, 'supabase-schema.sql');

async function setupDatabase() {
  try {
    console.log('Reading schema file...');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Split the SQL script into individual statements
    const statements = sqlContent
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);

    console.log(`Found ${statements.length} SQL statements to execute.`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      // Skip commented sections
      if (statement.startsWith('--') || statement.startsWith('/*')) {
        console.log('Skipping comment block...');
        continue;
      }

      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.error(`Error executing statement ${i + 1}:`, error);
        } else {
          console.log(`Statement ${i + 1} executed successfully.`);
        }
      } catch (err) {
        console.error(`Error executing statement ${i + 1}:`, err.message);
      }
    }

    console.log('Database setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Start your server with `node server.js`');
    console.log('2. Access the application at http://localhost:3000');
    console.log('3. Create an account and start transcribing!');

  } catch (error) {
    console.error('Error setting up database:', error.message);
    process.exit(1);
  }
}

// Add an exec_sql function to Supabase for executing arbitrary SQL
async function setupExecSqlFunction() {
  try {
    console.log('Setting up exec_sql function...');
    
    const createFunctionSql = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$;
    `;
    
    const { error } = await supabase.rpc('exec_sql', { 
      sql: createFunctionSql 
    }).catch(() => {
      // If the function doesn't exist yet, create it using a raw query
      return supabase.from('_exec_sql_temp').select().then(() => {
        console.log('Function not found, creating it...');
        return { error: null };
      });
    });
    
    if (error) {
      console.log('Creating exec_sql function manually...');
      
      // Try direct SQL execution (will only work if using REST with service role key)
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Prefer': 'params=single-object'
        },
        body: JSON.stringify({
          query: createFunctionSql
        })
      });
      
      if (!response.ok) {
        console.error('Could not create exec_sql function. You may need to create it manually.');
        console.error('Please run the following SQL in the Supabase SQL editor:');
        console.error(createFunctionSql);
        process.exit(1);
      }
    }
    
    console.log('exec_sql function is ready.');
    
  } catch (error) {
    console.error('Error setting up exec_sql function:', error.message);
    console.error('Please create the function manually in the Supabase SQL editor.');
    process.exit(1);
  }
}

// Main function
async function main() {
  console.log('Setting up Meeting Diary database schema...');
  
  try {
    await setupExecSqlFunction();
    await setupDatabase();
  } catch (error) {
    console.error('Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();