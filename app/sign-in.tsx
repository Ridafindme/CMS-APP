import { patientTheme } from '@/constants/patientTheme';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SAVED_CREDENTIALS_KEY = '@saved_credentials';

const theme = patientTheme;

type SavedCredential = {
  email: string;
  timestamp: number;
};

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { t, isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [savedCredentials, setSavedCredentials] = useState<SavedCredential[]>([]);
  const [showSavedAccounts, setShowSavedAccounts] = useState(false);

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const saved = await AsyncStorage.getItem(SAVED_CREDENTIALS_KEY);
      if (saved) {
        const credentials: SavedCredential[] = JSON.parse(saved);
        const validCredentials = credentials.filter(
          c => Date.now() - c.timestamp < 30 * 24 * 60 * 60 * 1000
        );
        setSavedCredentials(validCredentials);
      }
    } catch (error) {
      console.error('Error loading saved credentials:', error);
    }
  };

  const saveCredential = async (emailToSave: string) => {
    try {
      const newCredential: SavedCredential = {
        email: emailToSave,
        timestamp: Date.now(),
      };
      
      const updatedCredentials = [
        newCredential,
        ...savedCredentials.filter(c => c.email !== emailToSave)
      ].slice(0, 5);
      
      await AsyncStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify(updatedCredentials));
      setSavedCredentials(updatedCredentials);
    } catch (error) {
      console.error('Error saving credential:', error);
    }
  };

  const removeSavedCredential = async (emailToRemove: string) => {
    try {
      const updatedCredentials = savedCredentials.filter(c => c.email !== emailToRemove);
      await AsyncStorage.setItem(SAVED_CREDENTIALS_KEY, JSON.stringify(updatedCredentials));
      setSavedCredentials(updatedCredentials);
    } catch (error) {
      console.error('Error removing credential:', error);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert(t.common.error, t.auth.fillAllFields);
      return;
    }

    setLoading(true);
    
    try {
      const { error } = await signIn(email.trim().toLowerCase(), password);
      
      if (error) {
        Alert.alert(t.auth.signInFailed, error.message);
        setLoading(false);
        return;
      }

      if (rememberMe) {
        await saveCredential(email.trim().toLowerCase());
      }

      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: doctorData } = await supabase
          .from('doctors')
          .select('id, is_approved')
          .eq('user_id', user.id)
          .maybeSingle();

        if (doctorData && doctorData.is_approved) {
          router.replace('/(doctor-tabs)/daily');
        } else {
          router.replace('/(patient-tabs)/home');
        }
      } else {
        router.replace('/(patient-tabs)/home');
      }
      
    } catch (err: any) {
      Alert.alert(t.common.error, err.message || t.errors.somethingWentWrong);
    } finally {
      setLoading(false);
    }
  };

  const selectSavedAccount = (savedEmail: string) => {
    setEmail(savedEmail);
    setShowSavedAccounts(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.gradient} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 68 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + theme.spacing.lg,
              paddingBottom: insets.bottom + theme.spacing.xl * 2,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.headerRow, isRTL && styles.rowReverse]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <View style={[styles.headerTextGroup, isRTL && styles.alignEnd]}>
              <Text style={styles.headerEyebrow}>{t.auth.signIn}</Text>
              <Text style={styles.headerTitle}>{t.auth.welcomeBack}</Text>
              <Text style={[styles.headerSubtitle, isRTL && styles.textRight]}>{t.auth.signInToContinue}</Text>
            </View>
          </View>

          <View style={styles.infoBanner}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="sparkles-outline" size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>{t.auth.signInToContinue}</Text>
              <Text style={styles.infoSubtitle}>
                Book visits, chat securely, and keep your treatment plans on track in one place.
              </Text>
            </View>
          </View>

          {savedCredentials.length > 0 && (
            <View style={styles.savedAccountsCard}>
              <TouchableOpacity
                style={[styles.savedAccountsHeader, isRTL && styles.rowReverse]}
                onPress={() => setShowSavedAccounts(!showSavedAccounts)}
              >
                <View style={[styles.savedAccountsLabel, isRTL && styles.rowReverse]}>
                  <Ionicons name="albums-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.savedAccountsTitle}>{t.auth.recentAccounts}</Text>
                </View>
                <Ionicons
                  name={showSavedAccounts ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              {showSavedAccounts && (
                <View style={styles.savedAccountsList}>
                  {savedCredentials.map((cred, index) => (
                    <View key={index} style={[styles.savedAccountItem, isRTL && styles.rowReverse]}>
                      <TouchableOpacity
                        style={[styles.savedAccountButton, isRTL && styles.rowReverse]}
                        onPress={() => selectSavedAccount(cred.email)}
                      >
                        <Ionicons name="person-circle-outline" size={20} color={theme.colors.primary} />
                        <Text style={styles.savedAccountEmail}>{cred.email}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.removeButton} onPress={() => removeSavedCredential(cred.email)}>
                        <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, isRTL && styles.textRight]}>{t.auth.email}</Text>
              <View style={[styles.inputWrapper, isRTL && styles.rowReverse]}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={theme.colors.primary}
                  style={[styles.inputIcon, isRTL && styles.iconRTL]}
                />
                <TextInput
                  style={[styles.input, isRTL && styles.textRight]}
                  placeholder={t.patientSignUp.emailPlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, isRTL && styles.textRight]}>{t.auth.password}</Text>
              <View style={[styles.inputWrapper, styles.passwordWrapper, isRTL && styles.rowReverse]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={theme.colors.primary}
                  style={[styles.inputIcon, isRTL && styles.iconRTL]}
                />
                <TextInput
                  style={[styles.input, styles.passwordInput, isRTL && styles.textRight]}
                  placeholder={t.patientSignUp.passwordPlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  multiline={false}
                  numberOfLines={1}
                  textAlignVertical="center"
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.optionsRow, isRTL && styles.rowReverse]}>
              <TouchableOpacity
                style={[styles.rememberMeContainer, isRTL && styles.rowReverse]}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Ionicons name="checkmark" size={14} color={theme.colors.surface} />}
                </View>
                <Text style={styles.rememberMeText}>{t.auth.rememberMe}</Text>
              </TouchableOpacity>

              <TouchableOpacity>
                <Text style={styles.forgotPasswordText}>{t.auth.forgotPassword}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.signInButton, loading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.surface} />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.signInButtonText}>{t.auth.signIn}</Text>
                  <Ionicons name="arrow-forward" size={18} color={theme.colors.surface} />
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t.auth.noAccount}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/sign-up-patient')}>
              <Text style={styles.secondaryButtonText}>{t.auth.createAccount}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  headerTextGroup: {
    flex: 1,
    gap: 4,
  },
  headerEyebrow: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.surface,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.surface,
    opacity: 0.85,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  infoSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  savedAccountsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  savedAccountsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedAccountsLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  savedAccountsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  savedAccountsList: {
    gap: theme.spacing.xs,
  },
  savedAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  savedAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  savedAccountEmail: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 5,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.elevated,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    minHeight: 52,
  },
  passwordWrapper: {
    minHeight: 52,
    maxHeight: 52,
  },
  inputIcon: {
    marginRight: theme.spacing.sm,
  },
  iconRTL: {
    marginRight: 0,
    marginLeft: theme.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textPrimary,
    paddingVertical: 10,
  },
  passwordInput: {
    paddingVertical: 0,
    height: 52,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  eyeButton: {
    paddingHorizontal: 4,
    height: '100%',
    justifyContent: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: theme.radii.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  rememberMeText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  signInButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  signInButtonText: {
    color: theme.colors.surface,
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
  dividerText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryButton: {
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: theme.colors.elevated,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
});
