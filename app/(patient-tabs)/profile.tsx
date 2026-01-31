import PhoneInput from '@/components/ui/phone-input';
import { patientTheme } from '@/constants/patientTheme';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { fromE164, validatePhone } from '@/lib/phone-utils';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Profile = {
  full_name: string;
  full_name_ar: string;
  email: string;
  phone: string;
  date_of_birth?: string | null;
  gender?: string | null;
};

type DoctorInfo = {
  id: string;
  specialty_code: string;
  is_approved: boolean;
};

type IconName = keyof typeof Ionicons.glyphMap;

const theme = patientTheme;

export default function ProfileTab() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t, language, setLanguage, isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNameAr, setEditNameAr] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoneLocal, setEditPhoneLocal] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState('');
  const [editGender, setEditGender] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Handle Android back button for modals
  useEffect(() => {
    const backAction = () => {
      if (showEditModal) {
        setShowEditModal(false);
        return true;
      }
      if (showSignOutModal) {
        setShowSignOutModal(false);
        return true;
      }
      if (showDoctorModal) {
        setShowDoctorModal(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showEditModal, showSignOutModal, showDoctorModal]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, full_name_ar, phone, date_of_birth, gender')
        .eq('id', user.id)
        .single();

      if (profileError) console.error('Profile error:', profileError);

      if (profileData) {
        setProfile({
          ...profileData,
          email: user.email || '',
        });
      } else {
        setProfile({
          full_name: user.user_metadata?.full_name || '',
          full_name_ar: '',
          email: user.email || '',
          phone: user.user_metadata?.phone || '',
        });
      }

      const { data: doctorData } = await supabase
        .from('doctors')
        .select('id, specialty_code, is_approved')
        .eq('user_id', user.id)
        .maybeSingle();

      setDoctorInfo(doctorData);

    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorAction = () => {
    setShowDoctorModal(false);
    if (doctorInfo) {
      if (!doctorInfo.is_approved) {
        return;
      }
      router.push('/(doctor-tabs)/daily');
      return;
    }
    router.push('/sign-up-doctor');
  };

  const handleSignOut = async () => {
    setShowSignOutModal(false);
    await signOut();
    router.replace('/');
  };

  const getDisplayName = () => {
    if (isRTL && profile?.full_name_ar) return profile.full_name_ar;
    return profile?.full_name || t.profile.notLoggedIn;
  };

  const getEmailValue = () => profile?.email || t.profile.notProvided;
  const getPhoneValue = () => {
    if (!profile?.phone?.trim()) return t.profile.notProvided;
    // Display local format from E.164
    const local = fromE164(profile.phone, '961');
    return local || profile.phone;
  };

  const getDateOfBirthValue = () => {
    if (!profile?.date_of_birth) return t.profile.notProvided;
    try {
      const date = new Date(profile.date_of_birth);
      return date.toLocaleDateString(isRTL ? 'ar-LB' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return profile.date_of_birth;
    }
  };

  const getGenderValue = () => {
    if (!profile?.gender) return t.profile.notProvided;
    if (profile.gender === 'male') return isRTL ? 'ذكر' : 'Male';
    if (profile.gender === 'female') return isRTL ? 'أنثى' : 'Female';
    return profile.gender;
  };

  const handleOpenEditModal = () => {
    setEditName(profile?.full_name || '');
    setEditNameAr(profile?.full_name_ar || '');
    setEditPhone(profile?.phone || '');
    setEditPhoneLocal('');
    setEditDateOfBirth(profile?.date_of_birth || '');
    setEditGender(profile?.gender || '');
    setShowEditModal(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      const formatted = selectedDate.toISOString().split('T')[0];
      setEditDateOfBirth(formatted);
    }
  };

  const getDatePickerValue = () => {
    if (editDateOfBirth) {
      try {
        return new Date(editDateOfBirth);
      } catch {}
    }
    // Default to 20 years ago
    const defaultDate = new Date();
    defaultDate.setFullYear(defaultDate.getFullYear() - 20);
    return defaultDate;
  };

  const handleSaveProfile = async () => {
    if (!user || !editName.trim()) {
      Alert.alert(t.common.error, 'Name is required');
      return;
    }

    // Validate phone if provided
    if (editPhoneLocal && editPhoneLocal.length > 0) {
      if (!editPhone) {
        Alert.alert(t.common.error, 'Please enter a valid mobile number');
        return;
      }
      
      // Load country data for validation
      const { data: countryData } = await supabase
        .from('countries')
        .select('phone_config, country_code')
        .eq('is_default', true)
        .single();
      
      if (countryData?.phone_config) {
        const validation = validatePhone(editPhoneLocal, countryData.phone_config, 'mobile');
        if (!validation.valid) {
          Alert.alert(t.common.error, validation.error || 'Invalid mobile number');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editName.trim(),
          full_name_ar: editNameAr.trim() || null,
          phone: editPhone || null,
          date_of_birth: editDateOfBirth || null,
          gender: editGender || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({
        ...profile!,
        full_name: editName.trim(),
        full_name_ar: editNameAr.trim(),
        phone: editPhone,
        date_of_birth: editDateOfBirth,
        gender: editGender,
      });

      setShowEditModal(false);
      Alert.alert(t.common.success, 'Profile updated successfully');
    } catch (error: any) {
      Alert.alert(t.common.error, error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="dark" />
        <Text style={styles.notLoggedInIcon}>👤</Text>
        <Text style={styles.notLoggedInText}>{t.profile.notLoggedIn}</Text>
        <Text style={styles.notLoggedInSubtext}>{t.profile.pleaseSignIn}</Text>
        <TouchableOpacity 
          style={styles.signInButton}
          onPress={() => router.push('/sign-in')}
        >
          <Text style={styles.signInButtonText}>{t.auth.signIn}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const heroMetaItems = [
    {
      key: 'phone',
      label: t.profile.phoneLabel,
      value: getPhoneValue(),
      icon: 'call-outline' as IconName,
    },
    {
      key: 'language',
      label: t.profile.language,
      value: language === 'en' ? t.profile.english : t.profile.arabic,
      icon: 'globe-outline' as IconName,
    },
  ];

  const personalInfoItems = [
    {
      key: 'name',
      label: t.profile.fullNameLabel,
      value: getDisplayName(),
      icon: 'person-outline' as IconName,
    },
    {
      key: 'nameAr',
      label: t.profile.fullNameArabicLabel,
      value: profile?.full_name_ar?.trim() || t.profile.notProvided,
      icon: 'book-outline' as IconName,
    },
    {
      key: 'email',
      label: t.profile.emailLabel,
      value: getEmailValue(),
      icon: 'mail-outline' as IconName,
    },
    {
      key: 'phone',
      label: t.profile.phoneLabel,
      value: getPhoneValue(),
      icon: 'call-outline' as IconName,
    },
    {
      key: 'dob',
      label: isRTL ? 'تاريخ الميلاد' : 'Date of Birth',
      value: getDateOfBirthValue(),
      icon: 'calendar-outline' as IconName,
    },
    {
      key: 'gender',
      label: isRTL ? 'الجنس' : 'Gender',
      value: getGenderValue(),
      icon: 'male-female-outline' as IconName,
    },
  ];

  const settingsItems = [
    { key: 'notifications', label: t.profile.notifications, icon: 'notifications-outline' as IconName },
    { key: 'help', label: t.profile.helpSupport, icon: 'help-circle-outline' as IconName },
  ];

  const policyItems = [
    { key: 'privacy', label: t.profile.privacyPolicy, icon: 'shield-checkmark-outline' as IconName },
    { key: 'terms', label: t.profile.termsConditions, icon: 'document-text-outline' as IconName },
  ];

  const doctorStatusLabel = doctorInfo
    ? doctorInfo.is_approved
      ? t.profile.approved
      : t.profile.pendingApproval
    : t.doctorDashboard.patientMode;

  const doctorStatusBadgeStyle = [
    styles.doctorStatusBadge,
    doctorInfo
      ? doctorInfo.is_approved
        ? styles.doctorStatusApproved
        : styles.doctorStatusPending
      : styles.doctorStatusPatient,
  ];

  const doctorStatusTextStyle = [
    styles.doctorStatusText,
    doctorInfo
      ? doctorInfo.is_approved
        ? styles.doctorStatusTextApproved
        : styles.doctorStatusTextPending
      : styles.doctorStatusTextPatient,
  ];

  const hasDoctorRecord = Boolean(doctorInfo);
  const doctorIsApproved = Boolean(doctorInfo?.is_approved);
  const doctorIsPending = hasDoctorRecord && !doctorIsApproved;
  const doctorActionTitle = doctorIsApproved
    ? t.profile.approvedDoctorTitle
    : doctorIsPending
      ? t.profile.pendingDoctorTitle
      : t.profile.areYouDoctor;
  const doctorActionSubtitle = doctorIsApproved
    ? t.profile.accessDoctorDashboard
    : doctorIsPending
      ? t.profile.pendingDoctorSubtitle
      : t.profile.joinDoctorNetwork;
  const doctorModalTitle = doctorInfo
    ? doctorInfo.is_approved
      ? t.profile.switchToDoctorMode
      : t.profile.pendingDoctorTitle
    : t.profile.applyAsDoctor;
  const doctorModalSubtitle = doctorInfo
    ? doctorInfo.is_approved
      ? t.profile.accessDoctorDashboard
      : t.profile.pendingDoctorSubtitle
    : t.profile.joinDoctorNetwork;
  const doctorModalPrimaryLabel = doctorInfo
    ? doctorInfo.is_approved
      ? t.profile.switchNow
      : t.common.ok
    : t.profile.applyNow;
  const showDoctorModalSecondaryButton = !doctorInfo || Boolean(doctorInfo?.is_approved);
  const chevronIcon: IconName = isRTL ? 'chevron-back' : 'chevron-forward';
  const scrollContentStyle = [styles.scrollContent, { paddingTop: theme.spacing.lg + insets.top }];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={[styles.heroTopRow, isRTL && styles.rowReverse]}>
            <TouchableOpacity
              style={styles.languagePill}
              onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              accessibilityLabel={isRTL ? 'تغيير اللغة' : 'Toggle Language'}
            >
              <Ionicons name="globe-outline" size={16} color={theme.colors.surface} />
              <Text style={styles.languagePillText}>{language === 'en' ? 'AR' : 'EN'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signOutChip}
              onPress={() => setShowSignOutModal(true)}
              accessibilityLabel={t.profile.signOut}
            >
              <Ionicons name="log-out-outline" size={16} color={theme.colors.surface} />
              <Text style={styles.signOutChipText}>{t.profile.signOut}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.heroProfileRow, isRTL && styles.rowReverse]}>
            <View style={styles.profileAvatar}>
              <Text style={styles.avatarText}>
                {(profile?.full_name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={[styles.heroTextBlock, isRTL && styles.alignRight]}>
              <Text style={styles.heroGreeting}>{t.profile.title}</Text>
              <Text style={[styles.heroName, isRTL && styles.textRight]}>{getDisplayName()}</Text>
              <Text style={[styles.heroEmail, isRTL && styles.textRight]}>{getEmailValue()}</Text>
            </View>
          </View>

          <View style={[styles.heroMetaRow, isRTL && styles.rowReverse]}>
            {heroMetaItems.map((item) => (
              <View key={item.key} style={[styles.heroMetaCard, isRTL && styles.rowReverse]}>
                <View
                  style={[
                    styles.heroMetaIconWrap,
                    item.key === 'language' && styles.heroMetaIconSecondary,
                  ]}
                >
                  <Ionicons name={item.icon} size={18} color={theme.colors.surface} />
                </View>
                <View style={[styles.heroMetaText, isRTL && styles.alignRight]}>
                  <Text style={[styles.heroMetaLabel, isRTL && styles.textRight]}>{item.label}</Text>
                  <Text style={[styles.heroMetaValue, isRTL && styles.textRight]}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={[styles.sectionHeaderRow, isRTL && styles.rowReverse]}>
            <View style={[styles.sectionHeaderText, isRTL && styles.alignRight]}>
              <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>{t.profile.personalInfo}</Text>
              <Text style={[styles.sectionSubtitle, isRTL && styles.textRight]}>{t.profile.editProfile}</Text>
            </View>
            <TouchableOpacity style={styles.sectionAction} onPress={handleOpenEditModal}>
              <Ionicons name="create-outline" size={16} color={theme.colors.primary} />
              <Text style={styles.sectionActionText}>{t.common.edit}</Text>
            </TouchableOpacity>
          </View>
          {personalInfoItems.map((item, index) => (
            <React.Fragment key={item.key}>
              <View style={[styles.infoItem, isRTL && styles.rowReverse]}>
                <View style={styles.infoIconWrap}>
                  <Ionicons name={item.icon} size={18} color={theme.colors.primary} />
                </View>
                <View style={[styles.infoTexts, isRTL && styles.alignRight]}>
                  <Text style={[styles.infoLabel, isRTL && styles.textRight]}>{item.label}</Text>
                  <Text style={[styles.infoValue, isRTL && styles.textRight]}>{item.value}</Text>
                </View>
              </View>
              {index < personalInfoItems.length - 1 && <View style={styles.infoDivider} />}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity
          style={styles.doctorActionCard}
          onPress={() => setShowDoctorModal(true)}
        >
          <View style={[styles.doctorActionContent, isRTL && styles.rowReverse]}>
            <View style={styles.doctorIconContainer}>
              <Ionicons name="medkit-outline" size={20} color={theme.colors.surface} />
            </View>
            <View style={[styles.doctorActionTextWrap, isRTL && styles.alignRight]}>
              <Text style={[styles.doctorActionTitle, isRTL && styles.textRight]}>{doctorActionTitle}</Text>
              <Text style={[styles.doctorActionSubtitle, isRTL && styles.textRight]}>{doctorActionSubtitle}</Text>
              <View style={doctorStatusBadgeStyle}>
                <Text style={doctorStatusTextStyle}>{doctorStatusLabel}</Text>
              </View>
            </View>
            <Ionicons name={chevronIcon} size={20} color={theme.colors.surface} style={styles.doctorChevron} />
          </View>
        </TouchableOpacity>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>{t.profile.settings}</Text>
          {settingsItems.map((item, index) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.settingsRow,
                index === settingsItems.length - 1 && styles.settingsRowLast,
                isRTL && styles.rowReverse,
              ]}
            >
              <View style={[styles.settingsLeft, isRTL && styles.rowReverse]}>
                <View style={styles.settingsIconWrap}>
                  <Ionicons name={item.icon} size={18} color={theme.colors.primary} />
                </View>
                <Text style={[styles.settingsLabel, isRTL && styles.textRight]}>{item.label}</Text>
              </View>
              <Ionicons name={chevronIcon} size={20} color={theme.colors.textMuted} style={styles.settingsChevron} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>{t.profile.aboutApp}</Text>
          {policyItems.map((item, index) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.settingsRow,
                index === policyItems.length - 1 && styles.settingsRowLast,
                isRTL && styles.rowReverse,
              ]}
            >
              <View style={[styles.settingsLeft, isRTL && styles.rowReverse]}>
                <View style={styles.settingsIconWrap}>
                  <Ionicons name={item.icon} size={18} color={theme.colors.primary} />
                </View>
                <Text style={[styles.settingsLabel, isRTL && styles.textRight]}>{item.label}</Text>
              </View>
              <Ionicons name={chevronIcon} size={20} color={theme.colors.textMuted} style={styles.settingsChevron} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity 
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setShowEditModal(false)}
          >
            <TouchableOpacity 
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={[styles.modalContent, styles.editModalContent, isRTL && styles.alignRight]}
            >
              {/* Fixed Header with Back Button */}
              <View style={styles.modalFixedHeader}>
                <TouchableOpacity 
                  style={styles.modalBackButtonInline}
                  onPress={() => setShowEditModal(false)}
                  activeOpacity={0.8}
                  disabled={saving}
                >
                  <LinearGradient
                    colors={[theme.colors.primary, theme.colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalBackButtonGradient}
                  >
                    <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <View style={[styles.modalHeroIcon, styles.modalHeroPrimary]}>
                <Ionicons name="create-outline" size={26} color={theme.colors.primary} />
              </View>
              <Text style={[styles.modalTitle, isRTL && styles.textRight]}>{t.profile.editProfile}</Text>
              <Text style={[styles.modalMessage, styles.editModalMessage, isRTL && styles.textRight]}>
                {t.profile.personalInfo}
              </Text>

              <View style={styles.formField}>
                <Text style={[styles.inputLabel, isRTL && styles.textRight]}>Full Name (English)</Text>
                <TextInput
                  style={[styles.input, isRTL && styles.textRight]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter your full name"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              <View style={styles.formField}>
                <Text style={[styles.inputLabel, isRTL && styles.textRight]}>Full Name (Arabic)</Text>
                <TextInput
                  style={[styles.input, isRTL && styles.textRight]}
                  value={editNameAr}
                  onChangeText={setEditNameAr}
                  placeholder="أدخل اسمك الكامل"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              <View style={styles.formField}>
                <PhoneInput
                  value={editPhone}
                  onChangeValue={(e164, local) => {
                    setEditPhone(e164);
                    setEditPhoneLocal(local);
                  }}
                  type="mobile"
                  label={t.profile.phoneLabel}
                  placeholder="70 123 456"
                  isRTL={isRTL}
                />
              </View>

              <View style={[styles.formField, styles.formFieldCompact]}>
                <Text style={[styles.inputLabel, isRTL && styles.textRight]}>
                  {isRTL ? 'تاريخ الميلاد (اختياري)' : 'Date of Birth (Optional)'}
                </Text>
                <TouchableOpacity
                  style={[styles.datePickerButton, isRTL && styles.rowReverse]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <View style={styles.datePickerIconBox}>
                    <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                  </View>
                  <Text style={[styles.datePickerText, !editDateOfBirth && styles.datePickerPlaceholder]}>
                    {editDateOfBirth 
                      ? new Date(editDateOfBirth).toLocaleDateString(isRTL ? 'ar-LB' : 'en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : (isRTL ? 'اضغط لاختيار التاريخ' : 'Tap to select date')
                    }
                  </Text>
                  {editDateOfBirth && (
                    <TouchableOpacity
                      style={styles.dateClearButton}
                      onPress={() => setEditDateOfBirth('')}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>

              <View style={[styles.formField, styles.formFieldCompact]}>
                <Text style={[styles.inputLabel, isRTL && styles.textRight]}>
                  {isRTL ? 'الجنس (اختياري)' : 'Gender (Optional)'}
                </Text>
                <View style={styles.genderOptions}>
                  <TouchableOpacity
                    style={[styles.genderOption, editGender === 'male' && styles.genderOptionSelected]}
                    onPress={() => setEditGender('male')}
                  >
                    <Ionicons 
                      name={editGender === 'male' ? 'radio-button-on' : 'radio-button-off'} 
                      size={20} 
                      color={editGender === 'male' ? theme.colors.primary : theme.colors.textMuted} 
                    />
                    <Text style={[styles.genderOptionText, editGender === 'male' && styles.genderOptionTextSelected]}>
                      {isRTL ? 'ذكر' : 'Male'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.genderOption, editGender === 'female' && styles.genderOptionSelected]}
                    onPress={() => setEditGender('female')}
                  >
                    <Ionicons 
                      name={editGender === 'female' ? 'radio-button-on' : 'radio-button-off'} 
                      size={20} 
                      color={editGender === 'female' ? theme.colors.primary : theme.colors.textMuted} 
                    />
                    <Text style={[styles.genderOptionText, editGender === 'female' && styles.genderOptionTextSelected]}>
                      {isRTL ? 'أنثى' : 'Female'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={theme.colors.surface} />
                  ) : (
                    <Text style={styles.confirmButtonText}>{t.common.save}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={getDatePickerValue()}
          mode="date"
          display="spinner"
          onChange={handleDateChange}
          maximumDate={new Date()}
          textColor={theme.colors.textPrimary}
          accentColor={theme.colors.primary}
          themeVariant="light"
        />
      )}

      {/* Doctor Modal */}
      <Modal visible={showDoctorModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.standardModalContent]}>
            <View style={[
              styles.modalHeroIcon, 
              doctorIsApproved 
                ? styles.modalHeroSuccess 
                : doctorIsPending 
                  ? styles.modalHeroWarning 
                  : styles.modalHeroInfo
            ]}>
              <Ionicons 
                name={doctorIsApproved ? "checkmark-circle" : doctorIsPending ? "time" : "medkit"} 
                size={32} 
                color={
                  doctorIsApproved 
                    ? theme.colors.success 
                    : doctorIsPending 
                      ? theme.colors.warning 
                      : theme.colors.primary
                } 
              />
            </View>
            <Text style={[styles.modalTitle, isRTL && styles.textRight]}>{doctorModalTitle}</Text>
            <Text style={[styles.modalMessage, isRTL && styles.textRight]}>{doctorModalSubtitle}</Text>
            
            {/* Status Badge */}
            <View style={[
              styles.doctorModalStatusBadge,
              doctorIsApproved 
                ? styles.doctorModalStatusApproved 
                : doctorIsPending 
                  ? styles.doctorModalStatusPending 
                  : styles.doctorModalStatusDefault
            ]}>
              <Ionicons 
                name={doctorIsApproved ? "checkmark-circle" : doctorIsPending ? "time-outline" : "information-circle-outline"} 
                size={16} 
                color={
                  doctorIsApproved 
                    ? theme.colors.success 
                    : doctorIsPending 
                      ? theme.colors.warning 
                      : theme.colors.primary
                }
              />
              <Text style={[
                styles.doctorModalStatusText,
                doctorIsApproved 
                  ? styles.doctorModalStatusTextApproved 
                  : doctorIsPending 
                    ? styles.doctorModalStatusTextPending 
                    : styles.doctorModalStatusTextDefault
              ]}>
                {doctorStatusLabel}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              {showDoctorModalSecondaryButton && (
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowDoctorModal(false)}
                >
                  <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[
                  styles.modalButton, 
                  doctorIsApproved 
                    ? styles.confirmButton 
                    : doctorIsPending 
                      ? styles.okButton 
                      : styles.confirmButton
                ]}
                onPress={handleDoctorAction}
              >
                <Text style={[
                  doctorIsApproved 
                    ? styles.confirmButtonText 
                    : doctorIsPending 
                      ? styles.okButtonText 
                      : styles.confirmButtonText
                ]}>
                  {doctorModalPrimaryLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sign Out Modal */}
      <Modal visible={showSignOutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.standardModalContent]}>
            <View style={[styles.alertIconWrap, styles.alertIconDanger]}>
              <Ionicons name="log-out-outline" size={28} color={theme.colors.danger} />
            </View>
            <Text style={[styles.modalTitle, isRTL && styles.textRight]}>{t.profile.signOut}</Text>
            <Text style={[styles.modalMessage, isRTL && styles.textRight]}>{t.profile.signOutConfirm}</Text>
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonSecondary]}
                onPress={() => setShowSignOutModal(false)}
              >
                <Text style={styles.alertButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonDanger]}
                onPress={handleSignOut}
              >
                <Text style={styles.alertButtonDangerText}>{t.profile.signOut}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },
  loadingText: { marginTop: 10, fontSize: 16, color: theme.colors.textSecondary },
  notLoggedInIcon: { fontSize: 60, marginBottom: 15 },
  notLoggedInText: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 8 },
  notLoggedInSubtext: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 20 },
  signInButton: { backgroundColor: theme.colors.primary, paddingHorizontal: 30, paddingVertical: 12, borderRadius: theme.radii.md },
  signInButtonText: { color: theme.colors.surface, fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  heroCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: 32,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    gap: 6,
  },
  languagePillText: { color: theme.colors.surface, fontWeight: '600', letterSpacing: 0.4 },
  signOutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(15,23,42,0.25)',
    gap: 6,
  },
  signOutChipText: { color: theme.colors.surface, fontWeight: '600', fontSize: 13 },
  heroProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  profileAvatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: theme.colors.surface },
  heroTextBlock: { flex: 1 },
  heroGreeting: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 4 },
  heroName: { fontSize: 24, fontWeight: '700', color: theme.colors.surface },
  heroEmail: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  heroMetaRow: { flexDirection: 'row', gap: theme.spacing.md, flexWrap: 'wrap' },
  heroMetaCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
  },
  heroMetaIconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroMetaIconSecondary: { backgroundColor: 'rgba(8,47,140,0.35)' },
  heroMetaText: { flex: 1 },
  heroMetaLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  heroMetaValue: { color: theme.colors.surface, fontWeight: '600', marginTop: 2 },
  textRight: { textAlign: 'right' },
  rowReverse: { flexDirection: 'row-reverse' },
  alignRight: { alignItems: 'flex-end' },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    ...theme.shadow.card,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.md },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  sectionSubtitle: { marginTop: 4, fontSize: 13, color: theme.colors.textSecondary },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    gap: 6,
  },
  sectionActionText: { color: theme.colors.primary, fontWeight: '600', fontSize: 13 },
  infoItem: { flexDirection: 'row', alignItems: 'center' },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTexts: { flex: 1, marginHorizontal: theme.spacing.md },
  infoLabel: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 4 },
  infoValue: { fontSize: 16, color: theme.colors.textPrimary, fontWeight: '600' },
  infoDivider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.md },
  doctorActionCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.card,
  },
  doctorActionContent: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  doctorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorActionTextWrap: { flex: 1 },
  doctorActionTitle: { color: theme.colors.surface, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  doctorActionSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
  doctorStatusBadge: { marginTop: theme.spacing.sm, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill, alignSelf: 'flex-start' },
  doctorStatusApproved: { backgroundColor: 'rgba(34,197,94,0.25)' },
  doctorStatusPending: { backgroundColor: 'rgba(249,115,22,0.25)' },
  doctorStatusPatient: { backgroundColor: 'rgba(255,255,255,0.2)' },
  doctorStatusText: { fontSize: 12, fontWeight: '600' },
  doctorStatusTextApproved: { color: theme.colors.success },
  doctorStatusTextPending: { color: theme.colors.warning },
  doctorStatusTextPatient: { color: theme.colors.surface },
  doctorChevron: { marginLeft: theme.spacing.md },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  settingsRowLast: { borderBottomWidth: 0 },
  settingsLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: theme.spacing.md },
  settingsIconWrap: {
    width: 42,
    height: 42,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsLabel: { fontSize: 15, color: theme.colors.textPrimary, fontWeight: '500' },
  settingsChevron: { marginLeft: theme.spacing.sm },
  bottomSpacer: { height: theme.spacing.xl * 1.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,15,40,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalOverlayTouchable: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    width: '90%',
    alignItems: 'center',
    alignSelf: 'center',
    ...theme.shadow.card,
  },
  standardModalContent: { width: '90%', maxWidth: 420 },
  editModalContent: { 
    width: '95%', 
    maxWidth: 520, 
    maxHeight: '92%',
    alignItems: 'stretch', 
    alignSelf: 'center',
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  modalIcon: { fontSize: 50, marginBottom: 15 },
  modalHeroIcon: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  modalHeroPrimary: { backgroundColor: 'rgba(41,98,255,0.16)' },
  modalHeroSuccess: { backgroundColor: 'rgba(34,197,94,0.16)' },
  modalHeroWarning: { backgroundColor: 'rgba(249,115,22,0.16)' },
  modalHeroInfo: { backgroundColor: 'rgba(59,130,246,0.16)' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4, textAlign: 'center' },
  modalMessage: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 18 },
  editModalMessage: { marginBottom: theme.spacing.sm },
  formField: { width: '100%', alignSelf: 'stretch', marginBottom: theme.spacing.sm },
  formFieldCompact: { marginBottom: theme.spacing.xs },
  alertIconWrap: {
    width: 68,
    height: 68,
    borderRadius: theme.radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  alertIconDanger: { backgroundColor: 'rgba(239,68,68,0.14)' },
  alertButtons: { width: '100%', marginTop: theme.spacing.lg, gap: 10 },
  alertButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertButtonSecondary: { backgroundColor: theme.colors.elevated, borderWidth: 1, borderColor: theme.colors.border },
  alertButtonSecondaryText: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  alertButtonDanger: { backgroundColor: theme.colors.danger },
  alertButtonDangerText: { color: theme.colors.surface, fontSize: 15, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 10, width: '100%', marginTop: theme.spacing.md },
  modalButton: { flex: 1, padding: 12, borderRadius: theme.radii.md, alignItems: 'center' },
  cancelButton: { backgroundColor: theme.colors.elevated },
  cancelButtonText: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  confirmButton: { backgroundColor: theme.colors.primary },
  confirmButtonText: { color: theme.colors.surface, fontSize: 15, fontWeight: '600' },
  okButton: { backgroundColor: theme.colors.elevated, borderWidth: 1, borderColor: theme.colors.border },
  okButtonText: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  doctorModalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radii.pill,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  doctorModalStatusDefault: { backgroundColor: 'rgba(59,130,246,0.16)' },
  doctorModalStatusApproved: { backgroundColor: 'rgba(34,197,94,0.16)' },
  doctorModalStatusPending: { backgroundColor: 'rgba(249,115,22,0.16)' },
  doctorModalStatusText: { fontSize: 13, fontWeight: '600' },
  doctorModalStatusTextDefault: { color: theme.colors.primary },
  doctorModalStatusTextApproved: { color: theme.colors.success },
  doctorModalStatusTextPending: { color: theme.colors.warning },
  inputLabel: { fontSize: 13, color: theme.colors.textPrimary, marginBottom: 4, fontWeight: '600', width: '100%' },
  input: {
    backgroundColor: theme.colors.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: 10,
    fontSize: 14,
    color: theme.colors.textPrimary,
    width: '100%',
    marginBottom: 0,
  },
  dangerButton: { backgroundColor: theme.colors.danger },
  modalFixedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    marginBottom: 4,
  },
  modalBackButtonInline: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalBackButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.elevated,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: 10,
  },
  genderOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  genderOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  genderOptionTextSelected: {
    fontWeight: '700',
    color: theme.colors.primary,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.elevated,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: 10,
    gap: 10,
  },
  datePickerIconBox: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  datePickerPlaceholder: {
    color: theme.colors.textMuted,
    fontWeight: '400',
  },
  dateClearButton: {
    padding: 4,
  },
});
