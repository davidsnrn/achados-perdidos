import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vfcnptykhuljtoykpbmv.supabase.co';
const supabaseKey = 'sb_publishable_jjl3YMTXv7Ly-LwahfI3Yw_5GZD4fpv';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('search_people_global', {
    p_query: 'cristina ágata',
    p_limit: 5
  });
  console.log("Results for 'cristina ágata':", data ? data.map(p => p.name) : error);
}

run();
