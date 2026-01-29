import PhoneInput from '@/components/ui/phone-input';
import { patientTheme } from '@/constants/patientTheme';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
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

const theme = patientTheme;

export default function SignUpPatientScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signUp, signOut } = useAuth();
  const { t, isRTL } = useI18n();

  const [formData, setFormData] = useState({
    fullName: '',
    fullNameAr: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const keyboardOffset = useMemo(() => (Platform.OS === 'ios' ? 68 : 0), []);

  const heroHighlights = useMemo(
    () => [
      { icon: 'calendar-outline', label: t.patientSignUp.highlightInstant },
      { icon: 'chatbubble-ellipses-outline', label: t.patientSignUp.highlightChat },
      { icon: 'medkit-outline', label: t.patientSignUp.highlightTrack },
    ],
    [t]
  );

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.password || !formData.phone.trim()) {
      Alert.alert(t.common.error, t.auth.fillAllFields);
      return false;
    }

    if (formData.password.length < 6) {
      Alert.alert(t.common.error, t.auth.passwordTooShort);
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert(t.common.error, t.auth.passwordMismatch);
      return false;
    }

    if (!agreeToTerms) {
      Alert.alert(t.common.error, t.patientSignUp.termsAgree);
      return false;
    }

    return true;
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const englishName = formData.fullName.trim();
      const arabicName = formData.fullNameAr.trim();
      const email = formData.email.trim();

      const { error } = await signUp(email, formData.password, {
        full_name: englishName,
        full_name_ar: arabicName || null,
        phone: formData.phone.trim(),
        role: 'patient',
      });

      if (error) {
        Alert.alert(t.auth.signUpFailed, error.message);
        setLoading(false);
        return;
      }

      await signOut();

      Alert.alert(t.patientSignUp.successTitle, t.patientSignUp.successMessage, [
        { text: t.common.ok, onPress: () => router.replace('/sign-in') },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={[theme.colors.primary, theme.colors.primaryDark]} style={styles.gradient} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardOffset}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + theme.spacing.lg,
              paddingBottom: insets.bottom + theme.spacing.xl * 2,
            },
          ]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollIndicatorInsets={{ right: 1 }}
        >
          <View style={[styles.headerRow, isRTL && styles.rowReverse]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <View style={[styles.headerTextGroup, isRTL && styles.alignEnd]}>
              <Text style={[styles.headerEyebrow, isRTL && styles.textRight]}>{t.auth.signUp}</Text>
              <Text style={[styles.headerTitle, isRTL && styles.textRight]}>{t.patientSignUp.title}</Text>
              <Text style={[styles.headerSubtitle, isRTL && styles.textRight]}>{t.patientSignUp.subtitle}</Text>
            </View>
          </View>

          <View style={styles.infoBanner}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="heart-outline" size={24} color={theme.colors.primary} />
            </View>
            <View style={[styles.infoContent, isRTL && styles.alignEnd]}>
              <Text style={[styles.infoTitle, isRTL && styles.textRight]}>{t.patientSignUp.infoTitle}</Text>
              <Text style={[styles.infoSubtitle, isRTL && styles.textRight]}>{t.patientSignUp.infoSubtitle}</Text>
              <View style={[styles.highlightChips, isRTL && styles.rowReverse]}>
                {heroHighlights.map(item => (
                  <LinearGradient
                    key={item.icon}
                    colors={[theme.colors.surface, theme.colors.primarySoft]}
                    start={{ x: isRTL ? 1 : 0, y: 0.5 }}
                    end={{ x: isRTL ? 0 : 1, y: 0.5 }}
                    style={styles.highlightChip}
                  >
                    <Ionicons name={item.icon as any} size={14} color={theme.colors.textSecondary} />
                    <Text style={styles.highlightChipText}>{item.label}</Text>
                  </LinearGradient>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, isRTL && styles.textRight]}>{`${t.patientSignUp.fullNameEnglish} *`}</Text>
              <View style={[styles.inputWrapper, isRTL && styles.rowReverse]}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={theme.colors.primary}
                  style={[styles.inputIcon, isRTL && styles.iconRTL]}
                />
                <TextInput
                  style={[styles.input, isRTL && styles.rtlInput]}
                  placeholder={t.patientSignUp.fullNamePlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  value={formData.fullName}
                  onChangeText={value => updateField('fullName', value)}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, isRTL && styles.textRight]}>{t.patientSignUp.fullNameArabic}</Text>
              <View style={[styles.inputWrapper, isRTL && styles.rowReverse]}>
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={theme.colors.primary}
                  style={[styles.inputIcon, isRTL && styles.iconRTL]}
                />
                <TextInput
                  style={[styles.input, styles.arabicInput]}
                  placeholder={t.patientSignUp.fullNameArabicPlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  value={formData.fullNameAr}
                  onChangeText={value => updateField('fullNameAr', value)}
                  textAlign="right"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, isRTL && styles.textRight]}>{`${t.auth.email} *`}</Text>
              <View style={[styles.inputWrapper, isRTL && styles.rowReverse]}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={theme.colors.primary}
                  style={[styles.inputIcon, isRTL && styles.iconRTL]}
                />
                <TextInput
                  style={[styles.input, isRTL && styles.rtlInput]}
                  placeholder={t.patientSignUp.emailPlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  value={formData.email}
                  onChangeText={value => updateField('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                />
              </View>
            </View>

            <PhoneInput
              value={formData.phone}
              onChangeValue={e164 => updateField('phone', e164)}
              type="mobile"
              label={`${t.patientSignUp.phone} *`}
              placeholder={t.patientSignUp.phonePlaceholder}
              icon="call-outline"
            />
          </View>

          <View style={styles.securityCard}>
            <View style={[styles.securityHeader, isRTL && styles.rowReverse]}>
              <View style={styles.securityIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={[styles.securityTextGroup, isRTL && styles.alignEnd]}>
                <Text style={[styles.securityTitle, isRTL && styles.textRight]}>{t.patientSignUp.securityTitle}</Text>
                <Text style={[styles.securitySubtitle, isRTL && styles.textRight]}>{t.patientSignUp.securitySubtitle}</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, isRTL && styles.textRight]}>{`${t.auth.password} *`}</Text>
              <View style={[styles.inputWrapper, styles.passwordWrapper, isRTL && styles.rowReverse]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={theme.colors.primary}
                  style={[styles.inputIcon, isRTL && styles.iconRTL]}
                />
                <TextInput
                  style={[styles.input, styles.passwordInput, isRTL && styles.rtlInput]}
                  placeholder={t.patientSignUp.passwordPlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  value={formData.password}
                  onChangeText={value => updateField('password', value)}
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

            <View style={styles.inputGroup}>
              <Text style={[styles.label, isRTL && styles.textRight]}>{`${t.auth.confirmPassword} *`}</Text>
              <View style={[styles.inputWrapper, styles.passwordWrapper, isRTL && styles.rowReverse]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={theme.colors.primary}
                  style={[styles.inputIcon, isRTL && styles.iconRTL]}
                />
                <TextInput
                  style={[styles.input, styles.passwordInput, isRTL && styles.rtlInput]}
                  placeholder={t.patientSignUp.confirmPasswordPlaceholder}
                  placeholderTextColor={theme.colors.textMuted}
                  value={formData.confirmPassword}
                  onChangeText={value => updateField('confirmPassword', value)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  multiline={false}
                  numberOfLines={1}
                  textAlignVertical="center"
                />
              </View>
            </View>

            <TouchableOpacity style={[styles.termsRow, isRTL && styles.rowReverse]} onPress={() => setAgreeToTerms(!agreeToTerms)}>
              <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
                {agreeToTerms && <Ionicons name="checkmark" size={14} color={theme.colors.surface} />}
              </View>
              <Text style={[styles.termsText, isRTL && styles.textRight]}>{t.patientSignUp.termsAgree}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.surface} />
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.primaryButtonText}>{t.patientSignUp.createButton}</Text>
                  <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={18} color={theme.colors.surface} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.signInRow, isRTL && styles.rowReverse]}>
            <Text style={[styles.signInText, isRTL && styles.textRight]}>{t.auth.hasAccount}</Text>
            <TouchableOpacity onPress={() => router.push('/sign-in')}>
              <Text style={styles.signInLink}>{t.auth.signIn}</Text>
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
  alignEnd: {
    alignItems: 'flex-end',
  },
  headerEyebrow: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.textMuted,
  },
  textRight: {
    textAlign: 'right',
  },
  headerTitle: {
    fontSize: 24,
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
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    alignItems: 'flex-start',
  },
  infoIconWrap: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  infoSubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  highlightChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  highlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
    minWidth: 170,
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.primarySoft,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 1,
  },
  highlightChipText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  securityCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
  },
  securityHeader: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  securityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  securityTextGroup: {
    flex: 1,
    gap: 2,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  securitySubtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
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
    minHeight: 48,
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
    paddingVertical: 8,
  },
  rtlInput: {
    textAlign: 'right',
  },
  passwordInput: {
    paddingVertical: 0,
    height: 52,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  arabicInput: {
    textAlign: 'right',
  },
  eyeButton: {
    paddingHorizontal: 4,
    height: '100%',
    justifyContent: 'center',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  termsText: {
    flex: 1,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    fontSize: 13,
  },
  termsLink: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  primaryButton: {
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
  primaryButtonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  signInRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  signInText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  signInLink: {
    color: theme.colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
});
