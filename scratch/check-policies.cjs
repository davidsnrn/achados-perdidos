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
  console.log('Fetching policies...');
  // We can query pg_policies using custom rpc or query if allowed, or we can just try updating a user.
  // Let's try updating a test user to see if it works and what the response is.
  const { data: updateData, error: updateError } = await supabase
    .from('users')
    .update({ reset_token: 'test-token-123', reset_token_expires: new Date().toISOString() })
    .eq('matricula', '123456') // Test user
    .select();

  console.log('Update result:', { updateData, updateError });
}

run();
