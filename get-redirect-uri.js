const { makeRedirectUri } = require('expo-auth-session');

console.log('\n=== EXPO AUTH REDIRECT URIs ===\n');

// With proxy (for development)
const proxyUri = makeRedirectUri({ useProxy: true });
console.log('📱 Development (with proxy):');
console.log('   ', proxyUri);

// Without proxy (for production)
const nativeUri = makeRedirectUri({ 
  scheme: 'cms',
  path: 'redirect'
});
console.log('\n📦 Production (native):');
console.log('   ', nativeUri);

console.log('\n=== ADD THESE URLs TO SUPABASE ===');
console.log('\n1. Go to: https://supabase.com/dashboard/project/tqajsfkofgpncufkghvk/auth/url-configuration');
console.log('2. Add both URLs above to "Redirect URLs"');
console.log('3. Click "Save"\n');
