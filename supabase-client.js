// APPEARICH — Supabase client
// Project: https://supabase.com/dashboard/project/zudqubbglwphfxaviqsg

const SUPABASE_URL = 'https://zudqubbglwphfxaviqsg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1ZHF1YmJnbHdwaGZ4YXZpcXNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NjcyNTUsImV4cCI6MjA5ODA0MzI1NX0.7pRbRqz9-5gN8SG_ALn5ecHOWQofykPvhbrE2HQROCE';

// `supabase` here is the global from the CDN script (@supabase/supabase-js).
// We create our own client and expose it as `supabaseClient` so it never
// collides with that global name.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,      // keep the session in localStorage
    autoRefreshToken: true,    // silently refresh before the token expires
    detectSessionInUrl: true
  }
});
