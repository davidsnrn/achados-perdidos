const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching policies from pg_policies...');
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: "SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'users';"
  });

  if (error) {
    console.error('Error fetching policies via RPC execute_sql:', error);
    // If execute_sql RPC doesn't exist, we can try using standard query or check if we can select from pg_policies directly
    const { data: dataDirect, error: errorDirect } = await supabase
      .from('pg_policies')
      .select('*');
    console.log('Direct select pg_policies:', { dataDirect, errorDirect });
  } else {
    console.log('Policies for users:', data);
  }
}

run();
