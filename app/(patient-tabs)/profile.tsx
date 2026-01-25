import PhoneInput from '@/components/ui/phone-input';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Profile = {
  full_name: string;
  full_name_ar: string;
  email: string;
  phone: string;
};

type DoctorInfo = {
  id: string;
  specialty_code: string;
  is_approved: boolean;
};

export default function ProfileTab() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t, language, setLanguage, isRTL } = useI18n();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNameAr, setEditNameAr] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, full_name_ar, phone')
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
      router.push('/doctor-dashboard');
    } else {
      router.push('/sign-up-doctor');
    }
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
  const getPhoneValue = () => (profile?.phone?.trim() ? profile.phone : t.profile.notProvided);

  const handleOpenEditModal = () => {
    setEditName(profile?.full_name || '');
    setEditNameAr(profile?.full_name_ar || '');
    setEditPhone(profile?.phone || '');
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!user || !editName.trim()) {
      Alert.alert(t.common.error, 'Name is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editName.trim(),
          full_name_ar: editNameAr.trim() || null,
          phone: editPhone || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({
        ...profile!,
        full_name: editName.trim(),
        full_name_ar: editNameAr.trim(),
        phone: editPhone,
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
        <ActivityIndicator size="large" color="#2563EB" />
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

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.languageToggleRow}>
            <TouchableOpacity
              style={[styles.languageButton, language === 'ar' && styles.languageButtonActive]}
              onPress={() => setLanguage('ar')}
              accessibilityLabel="AR"
            >
              <Text style={styles.languageButtonText}>AR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.languageButton, language === 'en' && styles.languageButtonActive]}
              onPress={() => setLanguage('en')}
              accessibilityLabel="EN"
            >
              <Text style={styles.languageButtonText}>EN</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.headerSignOutButton}
            onPress={() => setShowSignOutModal(true)}
            accessibilityLabel={t.profile.signOut}
          >
            <Text style={styles.headerSignOutIcon}>X</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.profileAvatar}>
          <Text style={styles.avatarText}>
            {(profile?.full_name || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.profileName, isRTL && styles.textRight]}>{getDisplayName()}</Text>
        <Text style={[styles.profileEmail, isRTL && styles.textRight]}>{profile?.email}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>{t.profile.personalInfo}</Text>
        <View style={[styles.infoCard, isRTL && styles.alignRight]}>
          <TouchableOpacity style={styles.infoRow} onPress={handleOpenEditModal}>
            <Text style={styles.infoLabel}>{t.profile.fullNameLabel}</Text>
            <View style={styles.infoValueContainer}>
              <Text style={[styles.infoValue, isRTL && styles.textRight]}>{getDisplayName()}</Text>
              <Text style={styles.editIcon}>✏️</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t.profile.emailLabel}</Text>
            <Text style={[styles.infoValue, isRTL && styles.textRight]}>{getEmailValue()}</Text>
          </View>

          <View style={styles.infoDivider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t.profile.phoneLabel}</Text>
            <Text style={[styles.infoValue, isRTL && styles.textRight]}>{getPhoneValue()}</Text>
          </View>
        </View>

        {/* Doctor Card */}
        <TouchableOpacity 
          style={styles.doctorCard}
          onPress={() => setShowDoctorModal(true)}
        >
          <View style={[styles.doctorCardContent, isRTL && styles.rowReverse]}>
            <View style={styles.doctorIconContainer}>
              <Text style={styles.doctorIcon}>👨‍⚕️</Text>
            </View>
            <View style={[styles.doctorCardInfo, isRTL && styles.alignRight]}>
              <Text style={[styles.doctorCardTitle, isRTL && styles.textRight]}>
                {doctorInfo ? t.profile.doctorMode : t.profile.areYouDoctor}
              </Text>
              <Text style={[styles.doctorCardSubtitle, isRTL && styles.textRight]}>
                {doctorInfo 
                  ? t.profile.accessDoctorDashboard
                  : t.profile.joinDoctorNetwork}
              </Text>
              {doctorInfo && (
                <View style={[styles.approvalBadge, doctorInfo.is_approved ? styles.approvedBadge : styles.pendingBadge]}>
                  <Text style={[styles.approvalBadgeText, doctorInfo.is_approved ? styles.approvedText : styles.pendingText]}>
                    {doctorInfo.is_approved ? t.profile.approved : t.profile.pendingApproval}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.arrowIcon}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Settings Section */}
        <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>{t.profile.settings}</Text>
        
        <View style={styles.settingsCard}>

          {/* Notifications */}
          <TouchableOpacity style={[styles.settingsItem, isRTL && styles.rowReverse]}>
            <View style={[styles.settingsItemLeft, isRTL && styles.rowReverse]}>
              <Text style={styles.settingsIcon}>🔔</Text>
              <Text style={styles.settingsLabel}>{t.profile.notifications}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          {/* Help */}
          <TouchableOpacity style={[styles.settingsItem, styles.noBorder, isRTL && styles.rowReverse]}>
            <View style={[styles.settingsItemLeft, isRTL && styles.rowReverse]}>
              <Text style={styles.settingsIcon}>❓</Text>
              <Text style={styles.settingsLabel}>{t.profile.helpSupport}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.settingsCard}>
          <TouchableOpacity style={[styles.settingsItem, isRTL && styles.rowReverse]}>
            <View style={[styles.settingsItemLeft, isRTL && styles.rowReverse]}>
              <Text style={styles.settingsIcon}>📄</Text>
              <Text style={styles.settingsLabel}>{t.profile.privacyPolicy}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingsItem, styles.noBorder, isRTL && styles.rowReverse]}>
            <View style={[styles.settingsItemLeft, isRTL && styles.rowReverse]}>
              <Text style={styles.settingsIcon}>📋</Text>
              <Text style={styles.settingsLabel}>{t.profile.termsConditions}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isRTL && styles.alignRight]}>
            <Text style={[styles.modalTitle, isRTL && styles.textRight]}>Edit Profile</Text>
            
            <Text style={[styles.inputLabel, isRTL && styles.textRight]}>Full Name (English)</Text>
            <TextInput
              style={[styles.input, isRTL && styles.textRight]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your full name"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={[styles.inputLabel, isRTL && styles.textRight]}>Full Name (Arabic)</Text>
            <TextInput
              style={[styles.input, isRTL && styles.textRight]}
              value={editNameAr}
              onChangeText={setEditNameAr}
              placeholder="أدخل اسمك الكامل"
              placeholderTextColor="#9CA3AF"
            />

            <View style={{ marginTop: 10 }}>
              <PhoneInput
                value={editPhone}
                onChangeValue={(e164, local) => setEditPhone(e164)}
                type="mobile"
                label={isRTL ? 'رقم الهاتف' : 'Phone Number'}
                placeholder="70 123 456"
                icon="📱"
                isRTL={isRTL}
              />
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
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.confirmButtonText}>{t.common.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Doctor Modal */}
      <Modal visible={showDoctorModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>👨‍⚕️</Text>
            <Text style={[styles.modalTitle, isRTL && styles.textRight]}>
              {doctorInfo ? t.profile.switchToDoctorMode : t.profile.applyAsDoctor}
            </Text>
            <Text style={[styles.modalMessage, isRTL && styles.textRight]}>
              {doctorInfo 
                ? t.profile.accessDoctorDashboard
                : t.profile.joinDoctorNetwork}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButtonSecondary}
                onPress={() => setShowDoctorModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalButtonPrimary}
                onPress={handleDoctorAction}
              >
                <Text style={styles.modalButtonPrimaryText}>
                  {doctorInfo ? t.profile.switchNow : t.profile.applyNow}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sign Out Modal */}
      <Modal visible={showSignOutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalIcon}>🚪</Text>
            <Text style={[styles.modalTitle, isRTL && styles.textRight]}>{t.profile.signOut}</Text>
            <Text style={[styles.modalMessage, isRTL && styles.textRight]}>{t.profile.signOutConfirm}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButtonSecondary}
                onPress={() => setShowSignOutModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButtonPrimary, styles.dangerButton]}
                onPress={handleSignOut}
              >
                <Text style={styles.modalButtonPrimaryText}>{t.profile.signOut}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#6B7280' },
  notLoggedInIcon: { fontSize: 60, marginBottom: 15 },
  notLoggedInText: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  notLoggedInSubtext: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
  signInButton: { backgroundColor: '#2563EB', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 10 },
  signInButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  header: { backgroundColor: '#2563EB', paddingTop: 50, paddingBottom: 30, alignItems: 'center', borderBottomLeftRadius: 25, borderBottomRightRadius: 25 },
  headerTopRow: { width: '100%', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  languageToggleRow: { flexDirection: 'row', alignItems: 'center' },
  languageButton: { backgroundColor: 'rgba(255,255,255,0.2)', width: 40, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  languageButtonActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  languageButtonText: { color: 'white', fontSize: 12, fontWeight: '600' },
  headerSignOutButton: { backgroundColor: 'rgba(255,255,255,0.2)', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerSignOutIcon: { color: 'white', fontSize: 14, fontWeight: '700' },
  profileAvatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: 'white' },
  profileName: { fontSize: 22, fontWeight: 'bold', color: 'white', marginBottom: 5 },
  profileEmail: { fontSize: 14, color: '#BFDBFE' },
  content: { flex: 1, padding: 20 },
  textRight: { textAlign: 'right' },
  rowReverse: { flexDirection: 'row-reverse' },
  alignRight: { alignItems: 'flex-end' },
  doctorCard: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#BFDBFE' },
  doctorCardContent: { flexDirection: 'row', alignItems: 'center' },
  doctorIconContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  doctorIcon: { fontSize: 24 },
  doctorCardInfo: { flex: 1 },
  doctorCardTitle: { fontSize: 16, fontWeight: '600', color: '#1E40AF', marginBottom: 3 },
  doctorCardSubtitle: { fontSize: 13, color: '#3B82F6' },
  arrowIcon: { fontSize: 24, color: '#2563EB' },
  approvalBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  approvedBadge: { backgroundColor: '#D1FAE5' },
  approvalBadgeText: { fontSize: 11, fontWeight: '600' },
  pendingText: { color: '#92400E' },
  approvedText: { color: '#065F46' },
  infoCard: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 20 },
  infoRow: { marginBottom: 12 },
  infoLabel: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#111827', fontWeight: '500' },
  infoValueContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editIcon: { fontSize: 16 },
  infoDivider: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 10 },
  settingsCard: { backgroundColor: 'white', borderRadius: 16, marginBottom: 15, overflow: 'hidden' },
  settingsItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  noBorder: { borderBottomWidth: 0 },
  settingsItemLeft: { flexDirection: 'row', alignItems: 'center' },
  settingsIcon: { fontSize: 22, marginRight: 12 },
  settingsLabel: { fontSize: 15, color: '#1F2937' },
  settingsItemRight: { flexDirection: 'row', alignItems: 'center' },
  settingsValue: { fontSize: 14, color: '#6B7280', marginRight: 5 },
  chevron: { fontSize: 20, color: '#9CA3AF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 25, width: '100%', maxWidth: 340, alignItems: 'center' },
  modalIcon: { fontSize: 50, marginBottom: 15 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 10, textAlign: 'center' },
  modalMessage: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  cancelButton: { backgroundColor: '#F3F4F6' },
  cancelButtonText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  confirmButton: { backgroundColor: '#2563EB' },
  confirmButtonText: { color: 'white', fontSize: 15, fontWeight: '600' },
  inputLabel: { fontSize: 14, color: '#374151', marginBottom: 6, marginTop: 10, width: '100%' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 15, color: '#111827', width: '100%', marginBottom: 10 },
  modalButtonSecondary: { flex: 1, backgroundColor: '#F3F4F6', padding: 14, borderRadius: 10, alignItems: 'center' },
  modalButtonSecondaryText: { color: '#374151', fontSize: 15, fontWeight: '600' },
  modalButtonPrimary: { flex: 1, backgroundColor: '#2563EB', padding: 14, borderRadius: 10, alignItems: 'center' },
  modalButtonPrimaryText: { color: 'white', fontSize: 15, fontWeight: '600' },
  dangerButton: { backgroundColor: '#DC2626' },
  modalButtonCancel: { width: '100%', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 5 },
  modalButtonCancelText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
});
