import PhoneInput from '@/components/ui/phone-input';
import { useAuth } from '@/lib/AuthContext';
import { useDoctorContext } from '@/lib/DoctorContext';
import { useI18n } from '@/lib/i18n';
import { fromE164 } from '@/lib/phone-utils';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
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
    View
} from 'react-native';

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
            graduate_year: editGraduateYear ? parseInt(editGraduateYear) : null,
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
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.languageToggleRow}>
            <TouchableOpacity
              style={styles.languageButton}
              onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              accessibilityLabel={isRTL ? 'تغيير اللغة' : 'Toggle Language'}
            >
              <Ionicons name="globe-outline" size={16} color="#fff" />
              <Text style={styles.languageButtonText}>{language === 'en' ? 'AR' : 'EN'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.signOutIconButton}
            onPress={handleSignOut}
            accessibilityLabel={t.profile.signOut}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" />
            <Text style={styles.signOutIconButtonText}>{t.profile.signOut}</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.switchButton}
          onPress={() => router.replace('/(patient-tabs)/home')}
        >
          <View style={styles.switchButtonContent}>
            <Ionicons name="person-outline" size={14} color="#fff" />
            <Text style={styles.switchButtonText}>{t.doctorDashboard?.patientMode || 'Patient Mode'}</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.greeting}>{t.profile.title}</Text>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.profileAvatarContainer} onPress={pickImage} disabled={uploadingImage}>
            {uploadingImage ? (
              <View style={styles.profileAvatar}>
                <ActivityIndicator color="#2563EB" />
              </View>
            ) : profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileAvatar}>
                <Text style={styles.avatarText}>
                  {(profile?.full_name || 'D').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.editAvatarBadge}>
              <Text style={styles.editAvatarIcon}>📷</Text>
            </View>
          </TouchableOpacity>
          
          <Text style={styles.profileName}>
            {isRTL ? `د. ${profile?.full_name_ar || profile?.full_name}` : `Dr. ${profile?.full_name}`}
          </Text>
          <Text style={styles.profileSpecialty}>
            {doctorData?.specialty_icon} {isRTL ? doctorData?.specialty_name_ar : doctorData?.specialty_name}
          </Text>
          
          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>⭐ {doctorData?.rating?.toFixed(1) || '0.0'}</Text>
            <Text style={styles.reviewCount}>({doctorData?.total_reviews || 0} reviews)</Text>
          </View>
        </View>

        <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
          <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>{t.profile.personalInfo}</Text>
          <TouchableOpacity onPress={handleOpenEditProfileModal} style={styles.editButton}>
            <Ionicons name="create-outline" size={18} color="#2563EB" />
            <Text style={styles.editButtonText}>{t.common.edit}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={[styles.infoCard, isRTL && styles.alignRight]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isRTL && styles.textRight]}>{t.profile.fullNameLabel}</Text>
            <Text style={[styles.infoValue, isRTL && styles.textRight]}>
              {isRTL ? (profile?.full_name_ar || profile?.full_name || t.profile.notProvided) : (profile?.full_name || t.profile.notProvided)}
            </Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isRTL && styles.textRight]}>{t.profile.emailLabel}</Text>
            <Text style={[styles.infoValue, isRTL && styles.textRight]}>
              {user?.email || t.profile.notProvided}
            </Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isRTL && styles.textRight]}>{t.profile.phoneLabel}</Text>
            <Text style={[styles.infoValue, isRTL && styles.textRight]}>
              {profile?.phone || t.profile.notProvided}
            </Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isRTL && styles.textRight]}>
              {isRTL ? 'التخصص' : 'Specialty'}
            </Text>
            <Text style={[styles.infoValue, isRTL && styles.textRight]}>
              {isRTL ? doctorData?.specialty_name_ar : doctorData?.specialty_name}
            </Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isRTL && styles.textRight]}>
              {isRTL ? 'سنوات الخبرة' : 'Experience Years'}
            </Text>
            <Text style={[styles.infoValue, isRTL && styles.textRight]}>
              {doctorData?.experience_years ? `${doctorData.experience_years} ${isRTL ? 'سنة' : 'years'}` : t.profile.notProvided}
            </Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isRTL && styles.textRight]}>
              {isRTL ? 'سنة التخرج' : 'Graduate Year'}
            </Text>
            <Text style={[styles.infoValue, isRTL && styles.textRight]}>
              {doctorData?.graduate_year || t.profile.notProvided}
            </Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isRTL && styles.textRight]}>
              {isRTL ? 'نبذة تعريفية' : 'Bio'}
            </Text>
            <Text style={[styles.infoValue, isRTL && styles.textRight]}>
              {doctorData?.bio || t.profile.notProvided}
            </Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isRTL && styles.textRight]}>Instagram</Text>
            <Text style={[styles.infoValue, isRTL && styles.textRight]}>
              {doctorData?.instagram || t.profile.notProvided}
            </Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, isRTL && styles.textRight]}>Facebook</Text>
            <Text style={[styles.infoValue, isRTL && styles.textRight]}>
              {doctorData?.facebook || t.profile.notProvided}
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
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
                icon="📱"
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
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#2563EB',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  languageToggleRow: {
    flex: 1,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  languageButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  signOutIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  signOutIconButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  switchButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  switchButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileAvatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  editAvatarIcon: {
    fontSize: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  profileSpecialty: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  reviewCount: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButtonText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoRow: {
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  avatarConfirmContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 350,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: 100,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginVertical: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  editProfileModalOverlay: {
    justifyContent: 'flex-end',
  },
  editProfileModalScroll: {
    maxHeight: '90%',
    width: '100%',
  },
  modalScrollContent: {
    paddingBottom: 40,
  },
  editProfileModalScrollContent: {
    alignItems: 'center',
  },
  editProfileModalContent: {
    width: '100%',
    maxHeight: undefined,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 10,
  },
});
