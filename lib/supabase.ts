import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

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

// Helper function to clear all cached session data (for testing)
export const clearAllSessionData = async () => {
  console.log('🧹 Clearing all session data...');
  try {
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Clear all AsyncStorage keys related to Supabase
    const keys = await AsyncStorage.getAllKeys();
    const supabaseKeys = keys.filter(key => key.includes('supabase'));
    if (supabaseKeys.length > 0) {
      await AsyncStorage.multiRemove(supabaseKeys);
      console.log('✅ Cleared session keys:', supabaseKeys);
    }
    
    console.log('✅ All session data cleared');
    return true;
  } catch (error) {
    console.error('❌ Error clearing session data:', error);
    return false;
  }
};