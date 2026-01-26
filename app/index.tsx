import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

WebBrowser.maybeCompleteAuthSession();

export default function WelcomeScreen() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const appVersion = Constants.expoConfig?.version || 'dev';
  
  // Force native scheme
  const redirectTo = useMemo(() => 'cms://', []);

  useEffect(() => {
    // Listen for URL changes (deep linking)
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Check if app was opened with URL
    Linking.getInitialURL().then(url => {
      if (url) {
        handleUrl(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = ({ url }: { url: string }) => {
    handleUrl(url);
  };

  const handleUrl = async (url: string) => {
    console.log('Welcome screen - Received URL:', url);
    
    try {
      const urlObj = new URL(url);
      
      // Check for access token in query params (implicit flow)
      let accessToken = urlObj.searchParams.get('access_token');
      let refreshToken = urlObj.searchParams.get('refresh_token');
      
      // Check for tokens in hash fragment
      if (!accessToken) {
        const hashMatch = url.match(/#(.+)/);
        if (hashMatch) {
          const params = new URLSearchParams(hashMatch[1]);
          accessToken = params.get('access_token');
          refreshToken = params.get('refresh_token');
        }
      }

      console.log('Welcome screen - Tokens found:', { hasAccess: !!accessToken, hasRefresh: !!refreshToken });

      if (accessToken && refreshToken) {
        console.log('Welcome screen - Setting session with tokens...');
        setGoogleLoading(true);
        
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          console.error('Welcome screen - Session error:', error);
          Alert.alert('Error', error.message);
          setGoogleLoading(false);
          return;
        }

        console.log('Welcome screen - Session established, checking user role...');
        
        // Check user role
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: doctorData } = await supabase
            .from('doctors')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (doctorData) {
            router.replace('/doctor-dashboard');
          } else {
            router.replace('/(patient-tabs)/home');
          }
        }
      } else {
        console.log('Welcome screen - No tokens found in URL');
      }
    } catch (error: any) {
      console.error('Welcome screen - URL handling error:', error);
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      
      // Use Supabase callback URL for OAuth
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        console.error('Welcome screen - OAuth error:', error);
        Alert.alert('Google Sign-In Failed', error.message);
        setGoogleLoading(false);
        return;
      }

      if (!data?.url) {
        Alert.alert('Google Sign-In Failed', 'Could not start Google sign-in.');
        setGoogleLoading(false);
        return;
      }

      console.log('Welcome screen - Opening browser with URL:', data.url);

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        'com.cms.app://',
      );

      console.log('Welcome screen - Browser result:', result);
      
      if (result.type === 'success' && result.url) {
        await handleUrl(result.url);
      } else if (result.type === 'cancel') {
        console.log('Welcome screen - User canceled');
        Alert.alert('Cancelled', 'Sign-in was cancelled');
      }
      
      setGoogleLoading(false);
    } catch (err: any) {
      console.error('Welcome screen - Google sign-in error:', err);
      Alert.alert('Google Sign-In Failed', err.message || 'Unexpected error occurred.');
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Logo */}
      <Text style={styles.icon}>🏥</Text>
      
      {/* App Name */}
      <Text style={styles.title}>CMS App</Text>
      <Text style={styles.subtitle}>Clinic Management System</Text>
      <Text style={styles.tagline}>Connect with healthcare professionals</Text>
      
      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.signInButton}
          onPress={() => router.push('/sign-in')}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
        
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity 
          style={styles.signUpButton}
          onPress={() => router.push('/sign-up-patient')}
        >
          <Text style={styles.signUpButtonText}>Create Account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.googleButton, googleLoading && styles.googleButtonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color="#2563EB" />
          ) : (
            <View style={styles.googleButtonContent}>
              <Image 
                source={require('@/assets/images/google-g-logo.png')}
                style={styles.googleLogo}
              />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Footer */}
      <Text style={styles.footerText}>
        By continuing, you agree to our Terms & Privacy Policy
      </Text>
      <Text style={styles.versionText}>App version {appVersion}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  icon: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#BFDBFE',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#93C5FD',
    marginBottom: 60,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  signInButton: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  signInButtonText: {
    color: '#2563EB',
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#93C5FD',
  },
  dividerText: {
    color: '#BFDBFE',
    paddingHorizontal: 10,
    fontSize: 14,
  },
  signUpButton: {
    backgroundColor: '#1E40AF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  signUpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  googleLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  googleButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    marginTop: 30,
    color: '#93C5FD',
    fontSize: 12,
    textAlign: 'center',
  },
  versionText: {
    marginTop: 6,
    color: '#DBEAFE',
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.9,
  },
});
