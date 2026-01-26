import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const SAVED_CREDENTIALS_KEY = '@saved_credentials';

type SavedCredential = {
  email: string;
  timestamp: number;
};

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { t, isRTL } = useI18n();
  
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

        if (doctorData) {
          router.replace('/(doctor-tabs)/appointments');
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
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={0}
    >
      <StatusBar style="light" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={[styles.backButton, isRTL && styles.alignRight]}
          >
            <Text style={styles.backButtonText}>{isRTL ? '→' : '←'} {t.common.back}</Text>
          </TouchableOpacity>
          
          <Text style={styles.icon}>🏥</Text>
          <Text style={styles.title}>{t.auth.welcomeBack}</Text>
          <Text style={styles.subtitle}>{t.auth.signInToContinue}</Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          {/* Saved Accounts */}
          {savedCredentials.length > 0 && (
            <View style={styles.savedAccountsSection}>
              <TouchableOpacity 
                style={[styles.savedAccountsHeader, isRTL && styles.rowReverse]}
                onPress={() => setShowSavedAccounts(!showSavedAccounts)}
              >
                <Text style={styles.savedAccountsTitle}>📋 {t.auth.recentAccounts}</Text>
                <Text style={styles.savedAccountsArrow}>
                  {showSavedAccounts ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
              
              {showSavedAccounts && (
                <View style={styles.savedAccountsList}>
                  {savedCredentials.map((cred, index) => (
                    <View key={index} style={[styles.savedAccountItem, isRTL && styles.rowReverse]}>
                      <TouchableOpacity 
                        style={[styles.savedAccountButton, isRTL && styles.rowReverse]}
                        onPress={() => selectSavedAccount(cred.email)}
                      >
                        <Text style={styles.savedAccountIcon}>👤</Text>
                        <Text style={styles.savedAccountEmail}>{cred.email}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => removeSavedCredential(cred.email)}
                        style={styles.removeButton}
                      >
                        <Text style={styles.removeButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, isRTL && styles.textRight]}>{t.auth.email}</Text>
            <View style={[styles.inputWrapper, isRTL && styles.rowReverse]}>
              <Text style={styles.inputIcon}>📧</Text>
              <TextInput
                style={[styles.input, isRTL && styles.textRight]}
                placeholder={t.patientSignUp.emailPlaceholder}
                placeholderTextColor="#9CA3AF"
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
            <View style={[styles.inputWrapper, isRTL && styles.rowReverse]}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={[styles.input, isRTL && styles.textRight]}
                placeholder={t.patientSignUp.passwordPlaceholder}
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Remember Me & Forgot Password Row */}
          <View style={[styles.optionsRow, isRTL && styles.rowReverse]}>
            <TouchableOpacity 
              style={[styles.rememberMeContainer, isRTL && styles.rowReverse]}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
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
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.signInButtonText}>{t.auth.signIn}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t.auth.noAccount}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity 
            style={styles.signUpButton}
            onPress={() => router.push('/sign-up-patient')}
          >
            <Text style={styles.signUpButtonText}>{t.auth.createAccount}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2563EB' },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  header: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 30, alignItems: 'center' },
  backButton: { alignSelf: 'flex-start', marginBottom: 20 },
  alignRight: { alignSelf: 'flex-end' },
  backButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  icon: { fontSize: 60, marginBottom: 15 },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#BFDBFE' },
  formContainer: { flex: 1, backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, paddingTop: 25, paddingBottom: 50 },
  rowReverse: { flexDirection: 'row-reverse' },
  textRight: { textAlign: 'right' },
  savedAccountsSection: { marginBottom: 20, backgroundColor: '#F9FAFB', borderRadius: 12, overflow: 'hidden' },
  savedAccountsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  savedAccountsTitle: { fontSize: 14, fontWeight: '600', color: '#374151' },
  savedAccountsArrow: { fontSize: 12, color: '#6B7280' },
  savedAccountsList: { borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  savedAccountItem: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  savedAccountButton: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, paddingLeft: 15 },
  savedAccountIcon: { fontSize: 18, marginRight: 10 },
  savedAccountEmail: { fontSize: 14, color: '#2563EB' },
  removeButton: { padding: 12, paddingRight: 15 },
  removeButtonText: { fontSize: 14, color: '#9CA3AF' },
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 15 },
  inputIcon: { fontSize: 20, marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16, color: '#1F2937' },
  eyeButton: { padding: 5 },
  eyeIcon: { fontSize: 20 },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  rememberMeContainer: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  checkmark: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  rememberMeText: { fontSize: 14, color: '#374151' },
  forgotPasswordText: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
  signInButton: { backgroundColor: '#2563EB', padding: 18, borderRadius: 12, alignItems: 'center', marginBottom: 25 },
  buttonDisabled: { opacity: 0.7 },
  signInButtonText: { color: 'white', fontSize: 18, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { color: '#9CA3AF', paddingHorizontal: 15, fontSize: 14 },
  signUpButton: { backgroundColor: '#F3F4F6', padding: 18, borderRadius: 12, alignItems: 'center' },
  signUpButtonText: { color: '#374151', fontSize: 16, fontWeight: '600' },
});
