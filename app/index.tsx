import { patientTheme } from '@/constants/patientTheme';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();
const theme = patientTheme;
type IconName = keyof typeof Ionicons.glyphMap;

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage, isRTL } = useI18n();
  const [googleLoading, setGoogleLoading] = useState(false);
  const appVersion = Constants.expoConfig?.version || 'dev';
  const heroHighlights = useMemo(
    () => [
      { icon: 'person-outline' as IconName, label: t.welcome.highlightOne },
      { icon: 'chatbubbles-outline' as IconName, label: t.welcome.highlightTwo },
      { icon: 'shield-checkmark-outline' as IconName, label: t.welcome.highlightThree },
    ],
    [t]
  );
  const languageLabel = language === 'en' ? t.profile.arabic : t.profile.english;

  const handleUrl = useCallback(
    async (url: string) => {
      console.log('Welcome screen - Received URL:', url);

      try {
        const urlObj = new URL(url);

        let accessToken = urlObj.searchParams.get('access_token');
        let refreshToken = urlObj.searchParams.get('refresh_token');

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

          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: doctorData } = await supabase
              .from('doctors')
              .select('id, is_approved')
              .eq('user_id', user.id)
              .maybeSingle();

            if (doctorData && doctorData.is_approved) {
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
    },
    [router]
  );

  const handleDeepLink = useCallback(({ url }: { url: string }) => {
    handleUrl(url);
  }, [handleUrl]);

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
  }, [handleDeepLink, handleUrl]);

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
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryDark]}
        style={styles.gradient}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.languageRow, isRTL && styles.rowReverse]}>
          <TouchableOpacity
            style={styles.languageToggle}
            onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            accessibilityLabel={t.welcome.languageToggle}
          >
            <Ionicons name="globe-outline" size={16} color={theme.colors.textPrimary} />
            <Text style={styles.languageToggleText}>{languageLabel}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.heroCard}>
          <Text style={[styles.heroEyebrow, isRTL && styles.textRight]}>{t.welcome.heroEyebrow}</Text>
          <View style={styles.heroLogoShell}>
            <Image source={require('@/assets/images/icon.png')} style={styles.heroLogo} />
          </View>
          <Text style={[styles.heroTitle, isRTL && styles.textRight]}>{t.welcome.heroTitle}</Text>
          <Text style={[styles.heroSubtitle, isRTL && styles.textRight]}>
            {t.welcome.heroSubtitle}
          </Text>
          <View style={styles.highlightGrid}>
            {heroHighlights.map((item) => (
              <View key={item.icon} style={styles.highlightCard}>
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.highlightIconGradient}
                >
                  <Ionicons name={item.icon} size={24} color={theme.colors.surface} />
                </LinearGradient>
                <Text style={[styles.highlightCardLabel, isRTL && styles.textRight]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actionCard}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/sign-in')}
          >
            <Text style={styles.primaryButtonText}>{t.auth.signIn}</Text>
            <Ionicons name="arrow-forward" size={18} color={theme.colors.surface} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/sign-up-patient')}
          >
            <Text style={styles.secondaryButtonText}>{t.auth.createAccount}</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>{t.welcome.dividerLabel}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <View style={[styles.googleButtonContent, isRTL && styles.rowReverse]}>
                <Image
                  source={require('@/assets/images/google-g-logo.png')}
                  style={styles.googleLogo}
                />
                <Text style={styles.googleButtonText}>{t.welcome.googleCta}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.appleButton} onPress={() => {}}>
            <View style={[styles.appleButtonContent, isRTL && styles.rowReverse]}>
              <Ionicons name="logo-apple" size={20} color={theme.colors.surface} />
              <Text style={styles.appleButtonText}>{t.welcome.appleCta}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t.welcome.termsNotice}</Text>
          <Text style={styles.versionText}>App version {appVersion}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  languageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  languageToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
  },
  languageToggleText: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 32,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    alignItems: 'center',
    ...theme.shadow.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  heroLogoShell: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(41, 98, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: theme.spacing.xs,
    borderWidth: 3,
    borderColor: theme.colors.primarySoft,
  },
  heroLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    resizeMode: 'contain',
  },
  heroEyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.colors.primary,
    textAlign: 'center',
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 32,
  },
  heroSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  highlightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    width: '100%',
  },
  highlightCard: {
    flex: 1,
    minWidth: 100,
    maxWidth: 140,
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  highlightIconGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 16,
  },
  actionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    ...theme.shadow.card,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  primaryButtonText: {
    color: theme.colors.surface,
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.elevated,
  },
  secondaryButtonText: {
    textAlign: 'center',
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  googleButton: {
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  appleButton: {
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.textPrimary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  googleLogo: {
    width: 22,
    height: 22,
  },
  googleButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  appleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  appleButtonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.lg,
  },
  footerText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  versionText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
});
