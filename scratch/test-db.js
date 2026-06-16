const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching users...');
  const { data: users, error } = await supabase.from('users').select('id, matricula, name, reset_token, reset_token_expires');
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Users:', users);
  }
}

run();
