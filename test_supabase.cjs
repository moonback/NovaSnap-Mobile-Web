const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const key = env.match(/VITE_SUPABASE_ANON_KEY=[\"']?(.*?)[\"']?$/m)[1];
const url = env.match(/VITE_SUPABASE_URL=[\"']?(.*?)[\"']?$/m)[1];
fetch(url + '/rest/v1/stories', {
  method: 'POST',
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    user_id: 'cf1d28fb-66e8-4ca4-8d71-c20c714b1636',
    media_type: 'IMAGE',
    media_url: 'test/path.jpg',
    expires_at: new Date().toISOString()
  })
}).then(async res => {
  console.log('Status:', res.status);
  console.log(await res.json());
}).catch(console.error);
