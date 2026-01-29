import PhoneInput from '@/components/ui/phone-input';
import { patientTheme } from '@/constants/patientTheme';
import { useAuth } from '@/lib/AuthContext';
import { useDoctorContext } from '@/lib/DoctorContext';
import { useI18n } from '@/lib/i18n';
import { fromE164 } from '@/lib/phone-utils';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const theme = patientTheme;
type IconName = keyof typeof Ionicons.glyphMap;

export default function DoctorProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t, isRTL, language, setLanguage } = useI18n();
  const { 
    loading, 
    doctorData, 
    profile, 
    fetchDoctorData, 
    updateProfile, 
    updateDoctorSocial 
  } = useDoctorContext();

  const [refreshing, setRefreshing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showAvatarConfirmModal, setShowAvatarConfirmModal] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Edit profile form
  const [editName, setEditName] = useState('');
  const [editNameAr, setEditNameAr] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoneLocal, setEditPhoneLocal] = useState('');
  const [editInstagram, setEditInstagram] = useState('');
  const [editFacebook, setEditFacebook] = useState('');
  const [editExperienceYears, setEditExperienceYears] = useState('');
  const [editGraduateYear, setEditGraduateYear] = useState('');
  const [editBio, setEditBio] = useState('');

  const doctorDisplayName = isRTL
    ? profile?.full_name_ar || profile?.full_name || t.profile.notProvided
    : profile?.full_name || t.profile.notProvided;
  const doctorSpecialty = isRTL ? doctorData?.specialty_name_ar : doctorData?.specialty_name;
  const specialtyLabel = doctorSpecialty || t.profile.notProvided;
  const ratingValue = doctorData?.rating ? doctorData.rating.toFixed(1) : '—';
  const experienceChip = doctorData?.experience_years
    ? `${doctorData.experience_years}+ ${isRTL ? 'سنة' : 'yrs'}`
    : t.profile.notProvided;
  const reviewChip = `${doctorData?.total_reviews || 0} ${isRTL ? 'مراجعة' : 'reviews'}`;
  const doctorInitial = doctorDisplayName?.charAt(0)?.toUpperCase() || 'D';
  const specialtyIcon = doctorData?.specialty_icon || '🩺';

  const quickStats: Array<{ key: string; icon: IconName; label: string; value: string }> = [
    {
      key: 'experience',
      icon: 'briefcase-outline',
      label: isRTL ? 'الخبرة' : 'Experience',
      value: doctorData?.experience_years
        ? `${doctorData.experience_years} ${isRTL ? 'سنة' : 'yrs'}`
        : t.profile.notProvided,
    },
    {
      key: 'graduate',
      icon: 'school-outline',
      label: isRTL ? 'سنة التخرج' : 'Graduate year',
      value: doctorData?.graduate_year
        ? String(doctorData.graduate_year)
        : t.profile.notProvided,
    },
    {
      key: 'reviews',
      icon: 'chatbubbles-outline',
      label: isRTL ? 'المراجعات' : 'Reviews',
      value: `${doctorData?.total_reviews || 0} ${isRTL ? 'تقييم' : 'reviews'}`,
    },
  ];

  const infoRows: Array<{ key: string; icon: IconName; label: string; value: string }> = [
    {
      key: 'name',
      icon: 'person-outline',
      label: t.profile.fullNameLabel,
      value: doctorDisplayName,
    },
    {
      key: 'email',
      icon: 'mail-outline',
      label: t.profile.emailLabel,
      value: user?.email || t.profile.notProvided,
    },
    {
      key: 'phone',
      icon: 'call-outline',
      label: t.profile.phoneLabel,
      value: profile?.phone || t.profile.notProvided,
    },
    {
      key: 'specialty',
      icon: 'medkit-outline',
      label: isRTL ? 'التخصص' : 'Specialty',
      value: specialtyLabel,
    },
    {
      key: 'experienceYears',
      icon: 'trophy-outline',
      label: isRTL ? 'سنوات الخبرة' : 'Experience years',
      value: doctorData?.experience_years
        ? `${doctorData.experience_years} ${isRTL ? 'سنة' : 'years'}`
        : t.profile.notProvided,
    },
    {
      key: 'graduateYear',
      icon: 'school-outline',
      label: isRTL ? 'سنة التخرج' : 'Graduate year',
      value: doctorData?.graduate_year
        ? String(doctorData.graduate_year)
        : t.profile.notProvided,
    },
    {
      key: 'bio',
      icon: 'document-text-outline',
      label: isRTL ? 'نبذة تعريفية' : 'Bio',
      value: doctorData?.bio || t.profile.notProvided,
    },
    {
      key: 'instagram',
      icon: 'logo-instagram',
      label: 'Instagram',
      value: doctorData?.instagram || t.profile.notProvided,
    },
    {
      key: 'facebook',
      icon: 'logo-facebook',
      label: 'Facebook',
      value: doctorData?.facebook || t.profile.notProvided,
    },
  ];

  useEffect(() => {
    if (user) {
      fetchDoctorData();
    }
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDoctorData();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    Alert.alert(
      t.profile.signOut,
      isRTL ? 'هل أنت متأكد؟' : 'Are you sure?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.confirm,
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/sign-in');
          },
        },
      ]
    );
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImageUri(result.assets[0].uri);
      setShowAvatarConfirmModal(true);
    }
  };

  const uploadProfileImage = async (uri: string) => {
    if (!user) return;

    setUploadingImage(true);
    try {
      const fileName = `avatar_${user.id}_${Date.now()}.jpg`;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(data.path);

      const success = await updateProfile({ avatar_url: publicUrlData.publicUrl });
      
      if (success) {
        Alert.alert(t.common.success, isRTL ? 'تم تحديث الصورة' : 'Avatar updated');
        setShowAvatarConfirmModal(false);
        setSelectedImageUri(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert(t.common.error, isRTL ? 'فشل رفع الصورة' : 'Failed to upload avatar');
    } finally {
      setUploadingImage(false);
    }
  };

  const decode = (base64: string) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bufferLength = base64.length * 0.75;
    if (base64[base64.length - 1] === '=') bufferLength--;
    if (base64[base64.length - 2] === '=') bufferLength--;

    const bytes = new Uint8Array(bufferLength);
    let p = 0;

    for (let i = 0; i < base64.length; i += 4) {
      const encoded1 = chars.indexOf(base64[i]);
      const encoded2 = chars.indexOf(base64[i + 1]);
      const encoded3 = chars.indexOf(base64[i + 2]);
      const encoded4 = chars.indexOf(base64[i + 3]);

      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return bytes;
  };

  const handleOpenEditProfileModal = () => {
    setEditName(profile?.full_name || '');
    setEditNameAr(profile?.full_name_ar || '');
    const phoneData = fromE164(profile?.phone || '', '961');
    setEditPhone(profile?.phone || '');
    setEditPhoneLocal(phoneData);
    setEditInstagram(doctorData?.instagram || '');
    setEditFacebook(doctorData?.facebook || '');
    setEditExperienceYears(doctorData?.experience_years?.toString() || '');
    setEditGraduateYear(doctorData?.graduate_year?.toString() || '');
    setEditBio(doctorData?.bio || '');
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const profileSuccess = await updateProfile({
        full_name: editName,
        full_name_ar: editNameAr,
        phone: editPhone,
      });

      const socialSuccess = await updateDoctorSocial(editInstagram, editFacebook);

      // Update doctor fields (experience, graduate year, bio)
      let doctorFieldsSuccess = true;
      if (doctorData) {
        const { error } = await supabase
          .from('doctors')
          .update({
            experience_years: editExperienceYears ? parseInt(editExperienceYears) : null,
            graduation_year: editGraduateYear ? parseInt(editGraduateYear) : null,
            bio: editBio || null,
          })
          .eq('id', doctorData.id);
        
        if (error) {
          console.error('Error updating doctor fields:', error);
          doctorFieldsSuccess = false;
        }
      }

      if (profileSuccess && socialSuccess && doctorFieldsSuccess) {
        Alert.alert(t.common.success, isRTL ? 'تم تحديث الملف الشخصي' : 'Profile updated');
        setShowEditProfileModal(false);
        await fetchDoctorData(); // Refresh data
      } else {
        Alert.alert(t.common.error, isRTL ? 'فشل التحديث' : 'Failed to update');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert(t.common.error, isRTL ? 'فشل التحديث' : 'Failed to update');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading && !profile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <LinearGradient
            colors={[theme.colors.primaryDark, theme.colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroCard, isRTL && styles.alignEnd]}
          >
            <View style={[styles.heroTopRow, isRTL && styles.rowReverse]}>
              <TouchableOpacity
                style={styles.languageButton}
                onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                accessibilityLabel={isRTL ? 'تغيير اللغة' : 'Toggle Language'}
              >
                <Ionicons name="globe-outline" size={16} color={theme.colors.surface} />
                <Text style={styles.languageButtonText}>{language === 'en' ? 'AR' : 'EN'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.signOutIconButton}
                onPress={handleSignOut}
                accessibilityLabel={t.profile.signOut}
              >
                <Ionicons name="log-out-outline" size={18} color={theme.colors.surface} />
                <Text style={styles.signOutIconButtonText}>{t.profile.signOut}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.switchButton, isRTL && styles.rowReverse]}
              onPress={() => router.replace('/(patient-tabs)/home')}
            >
              <View style={[styles.switchButtonContent, isRTL && styles.rowReverse]}>
                <Ionicons name="person-outline" size={16} color={theme.colors.surface} />
                <Text style={styles.switchButtonText}>
                  {t.doctorDashboard?.patientMode || 'Patient Mode'}
                </Text>
              </View>
              <Ionicons
                name={isRTL ? 'arrow-back' : 'arrow-forward'}
                size={16}
                color={theme.colors.surface}
              />
            </TouchableOpacity>

            <View style={[styles.heroProfileRow, isRTL && styles.rowReverse]}>
              <TouchableOpacity
                style={styles.heroAvatarContainer}
                onPress={pickImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <View style={styles.heroAvatar}>
                    <ActivityIndicator color={theme.colors.surface} />
                  </View>
                ) : profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.heroAvatarImage} />
                ) : (
                  <View style={styles.heroAvatar}>
                    <Text style={styles.heroAvatarText}>{doctorInitial}</Text>
                  </View>
                )}
                <View style={styles.editAvatarBadge}>
                  <Text style={styles.editAvatarIcon}>📷</Text>
                </View>
              </TouchableOpacity>

              <View style={isRTL ? styles.alignEnd : undefined}>
                <Text style={[styles.heroEyebrow, isRTL && styles.textRight]}>
                  {isRTL ? 'ملف الطبيب' : 'Doctor profile'}
                </Text>
                <Text style={[styles.heroName, isRTL && styles.textRight]}>
                  {isRTL ? `د. ${doctorDisplayName}` : `Dr. ${doctorDisplayName}`}
                </Text>
                <Text style={[styles.heroSpecialty, isRTL && styles.textRight]}>
                  {specialtyIcon} {specialtyLabel}
                </Text>
              </View>
            </View>

            <View style={[styles.heroMetaRow, isRTL && styles.rowReverse]}>
              <View style={[styles.heroMetaBadge, isRTL && styles.rowReverse]}>
                <Ionicons name="star" size={14} color={theme.colors.surface} />
                <Text style={styles.heroMetaText}>{ratingValue}</Text>
              </View>
              <View style={[styles.heroMetaBadge, isRTL && styles.rowReverse]}>
                <Ionicons name="briefcase-outline" size={14} color={theme.colors.surface} />
                <Text style={styles.heroMetaText}>{experienceChip}</Text>
              </View>
              <View style={[styles.heroMetaBadge, isRTL && styles.rowReverse]}>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={theme.colors.surface} />
                <Text style={styles.heroMetaText}>{reviewChip}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View style={[styles.statsGrid, isRTL && styles.rowReverse]}>
          {quickStats.map(stat => (
            <View key={stat.key} style={styles.statCard}>
              <View style={styles.statIconWrapper}>
                <Ionicons name={stat.icon} size={18} color={theme.colors.primary} />
              </View>
              <Text style={[styles.statLabel, isRTL && styles.textRight]}>{stat.label}</Text>
              <Text style={[styles.statValue, isRTL && styles.textRight]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <View style={[styles.sectionHeaderRow, isRTL && styles.rowReverse]}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>{t.profile.personalInfo}</Text>
            <TouchableOpacity onPress={handleOpenEditProfileModal} style={styles.editButton}>
              <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.editButtonText}>{t.common.edit}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoList}>
            {infoRows.map((row, index) => (
              <React.Fragment key={row.key}>
                <View style={[styles.infoRow, isRTL && styles.rowReverse]}>
                  <View style={styles.infoIconCircle}>
                    <Ionicons name={row.icon} size={18} color={theme.colors.primaryDark} />
                  </View>
                  <View style={[styles.infoTextGroup, isRTL && styles.alignEnd]}>
                    <Text style={[styles.infoLabel, isRTL && styles.textRight]}>{row.label}</Text>
                    <Text style={[styles.infoValue, isRTL && styles.textRight]}>{row.value}</Text>
                  </View>
                </View>
                {index < infoRows.length - 1 && <View style={styles.infoDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Avatar Confirm Modal */}
      <Modal visible={showAvatarConfirmModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.avatarConfirmContent}>
            <Text style={styles.modalTitle}>Confirm Photo</Text>
            {selectedImageUri ? (
              <Image source={{ uri: selectedImageUri }} style={styles.previewImage} />
            ) : (
              <Text style={styles.emptyText}>{isRTL ? 'فشل قراءة الصورة' : 'Failed to read image'}</Text>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => {
                  setShowAvatarConfirmModal(false);
                  setSelectedImageUri(null);
                }}
                disabled={uploadingImage}
              >
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonPrimary, uploadingImage && styles.buttonDisabled]}
                onPress={() => {
                  if (selectedImageUri) uploadProfileImage(selectedImageUri);
                }}
                disabled={uploadingImage || !selectedImageUri}
              >
                {uploadingImage ? <ActivityIndicator color="white" size="small" /> : (
                  <Text style={styles.modalButtonPrimaryText}>{t.common.confirm}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfileModal} transparent animationType="fade" onRequestClose={() => setShowEditProfileModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalOverlay, styles.editProfileModalOverlay]}
        >
          <ScrollView
            style={styles.editProfileModalScroll}
            contentContainerStyle={[styles.modalScrollContent, styles.editProfileModalScrollContent]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.modalContent, styles.editProfileModalContent]}>
              <Text style={[styles.modalTitle, isRTL && styles.textRight]}>Edit Profile</Text>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.label, isRTL && styles.textRight]}>Full Name (English)</Text>
                <TextInput
                  style={[styles.input, isRTL && styles.textRight]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter your full name"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, isRTL && styles.textRight]}>Full Name (Arabic)</Text>
                <TextInput
                  style={[styles.input, isRTL && styles.textRight]}
                  value={editNameAr}
                  onChangeText={setEditNameAr}
                  placeholder="أدخل اسمك الكامل"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <PhoneInput
                value={editPhone}
                onChangeValue={(e164, local) => {
                  setEditPhone(e164);
                  setEditPhoneLocal(local);
                }}
                type="mobile"
                label={isRTL ? 'رقم الموبايل' : 'Mobile'}
                placeholder="70 123 456"
                icon="call-outline"
                isRTL={isRTL}
              />

              <View style={styles.inputGroup}>
                <Text style={[styles.label, isRTL && styles.textRight]}>Instagram</Text>
                <TextInput
                  style={[styles.input, isRTL && styles.textRight]}
                  value={editInstagram}
                  onChangeText={setEditInstagram}
                  placeholder="instagram.com/username"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, isRTL && styles.textRight]}>Facebook</Text>
                <TextInput
                  style={[styles.input, isRTL && styles.textRight]}
                  value={editFacebook}
                  onChangeText={setEditFacebook}
                  placeholder="facebook.com/page"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, isRTL && styles.textRight]}>
                  {isRTL ? 'سنوات الخبرة' : 'Experience Years'}
                </Text>
                <TextInput
                  style={[styles.input, isRTL && styles.textRight]}
                  value={editExperienceYears}
                  onChangeText={setEditExperienceYears}
                  placeholder={isRTL ? 'مثال: 5' : 'e.g., 5'}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, isRTL && styles.textRight]}>
                  {isRTL ? 'سنة التخرج' : 'Graduate Year'}
                </Text>
                <TextInput
                  style={[styles.input, isRTL && styles.textRight]}
                  value={editGraduateYear}
                  onChangeText={setEditGraduateYear}
                  placeholder={isRTL ? 'مثال: 2018' : 'e.g., 2018'}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, isRTL && styles.textRight]}>
                  {isRTL ? 'نبذة تعريفية' : 'Bio'}
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea, isRTL && styles.textRight]}
                  value={editBio}
                  onChangeText={setEditBio}
                  placeholder={isRTL ? 'أخبرنا المزيد عنك...' : 'Tell us about yourself...'}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButtonSecondary}
                  onPress={() => setShowEditProfileModal(false)}
                  disabled={savingProfile}
                >
                  <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButtonPrimary, savingProfile && styles.buttonDisabled]}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.modalButtonPrimaryText}>{t.common.save}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  loadingText: { marginTop: 12, fontSize: 16, color: theme.colors.textSecondary },
  content: { flex: 1 },
  scrollContent: { paddingBottom: 160 },
  heroSection: { paddingHorizontal: theme.spacing.lg, paddingTop: 52 },
  heroCard: {
    borderRadius: theme.radii.lg + 8,
    padding: theme.spacing.lg,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 10,
    gap: theme.spacing.md,
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  languageButtonText: { color: theme.colors.surface, fontWeight: '600', fontSize: 12 },
  signOutIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  signOutIconButtonText: { color: theme.colors.surface, fontWeight: '600', fontSize: 12 },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.radii.lg,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15,23,42,0.18)',
    marginTop: theme.spacing.sm,
  },
  switchButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchButtonText: { color: theme.colors.surface, fontWeight: '600' },
  heroProfileRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  heroAvatarContainer: { position: 'relative' },
  heroAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  heroAvatarText: { fontSize: 38, fontWeight: '700', color: theme.colors.surface },
  editAvatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: theme.colors.surface,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  editAvatarIcon: { fontSize: 16 },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontSize: 12,
    marginBottom: 4,
  },
  heroName: { color: theme.colors.surface, fontSize: 28, fontWeight: '700' },
  heroSpecialty: { color: 'rgba(255,255,255,0.85)', fontSize: 16 },
  heroMetaRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  heroMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroMetaText: { color: theme.colors.surface, fontWeight: '600' },
  rowReverse: { flexDirection: 'row-reverse' },
  textRight: { textAlign: 'right' },
  alignEnd: { alignItems: 'flex-end' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  statIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 4 },
  sectionCard: {
    marginTop: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 5,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editButtonText: { color: theme.colors.primary, fontWeight: '600' },
  infoList: {},
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14 },
  infoIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextGroup: { flex: 1 },
  infoLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoValue: { marginTop: 4, fontSize: 15, color: theme.colors.textPrimary, fontWeight: '600', lineHeight: 20 },
  infoDivider: { height: 1, backgroundColor: theme.colors.border },
  bottomSpacer: { height: 120 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,8,20,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  avatarConfirmContent: {
    width: '90%',
    maxWidth: 360,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: theme.spacing.md },
  previewImage: { width: 220, height: 220, borderRadius: 110, marginBottom: theme.spacing.md },
  emptyText: { fontSize: 14, color: theme.colors.textMuted, textAlign: 'center', marginVertical: theme.spacing.md },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: theme.spacing.lg, width: '100%' },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    backgroundColor: theme.colors.elevated,
    alignItems: 'center',
  },
  modalButtonSecondaryText: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
  },
  modalButtonPrimaryText: { fontSize: 16, fontWeight: '700', color: theme.colors.surface },
  buttonDisabled: { opacity: 0.5 },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 420,
  },
  editProfileModalOverlay: { justifyContent: 'flex-end' },
  editProfileModalScroll: { maxHeight: '92%', width: '100%' },
  modalScrollContent: { paddingBottom: theme.spacing.xl },
  editProfileModalScrollContent: { alignItems: 'center' },
  editProfileModalContent: { width: '100%' },
  inputGroup: { marginBottom: theme.spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  textArea: { minHeight: 110, paddingTop: 12 },
});
