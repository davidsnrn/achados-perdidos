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
  const matricula = '123456';
  console.log('1. Finding user by matricula:', matricula);
  const { data: user, error: findError } = await supabase
    .from('users')
    .select('*')
    .eq('matricula', matricula)
    .single();
  
  if (findError || !user) {
    console.error('User not found:', findError);
    return;
  }
  console.log('User found:', user.name, 'ID:', user.id);

  const token = 'test-token-uuid-12345';
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  console.log('2. Trying to update user with reset token...');
  const { data: updateData, error: updateError } = await supabase
    .from('users')
    .update({ reset_token: token, reset_token_expires: expires })
    .eq('id', user.id)
    .select();

  console.log('Update result:', { updateData, updateError });

  console.log('3. Trying to query user by reset token...');
  const { data: foundUser, error: queryError } = await supabase
    .from('users')
    .select('*')
    .eq('reset_token', token)
    .maybeSingle();

  console.log('Query by reset token result:', { foundUser, queryError });
}

run();
