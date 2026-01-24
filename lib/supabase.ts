import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace with YOUR values from Step 4!
const SUPABASE_URL = 'https://tqajsfkofgpncufkghvk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxYWpzZmtvZmdwbmN1ZmtnaHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxNDA1NzEsImV4cCI6MjA4MzcxNjU3MX0.ablqNqda0jRH78vGT4Vftrkjny-Cb3_A1IZRKV2J7jE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit', // Use implicit flow for mobile OAuth
  },
});