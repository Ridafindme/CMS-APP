import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  I18nManager,
} from 'react-native';

type Specialty = {
  code: string;
  name_en: string;
  name_ar: string;
  icon: string;
};

type Clinic = {
  id: string;
  clinic_name: string;
  address: string;
  consultation_fee: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  latitude: number | null;
  longitude: number | null;
  distance: number | null;
  distance_text: string;
  doctor_id: string;
  doctor_name: string;
  doctor_name_ar: string;
  specialty: string;
  specialty_ar: string;
  specialty_code: string;
  specialty_icon: string;
  rating: string;
  reviews: string;
  experience: string;
  experience_years: number;
};

type Profile = {
  full_name: string;
  full_name_ar?: string;
};

type UserLocation = {
  latitude: number;
  longitude: number;
};

export default function PatientHomeTab() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, language, isRTL } = useI18n();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [filteredClinics, setFilteredClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  useEffect(() => {
    getUserLocation();
    fetchData();
  }, [user]);

  useEffect(() => {
    filterClinics();
  }, [selectedSpecialty, clinics]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number | null, lon2: number | null): number | null => {
    if (!lat2 || !lon2) return null;
    
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name, full_name_ar')
          .eq('id', user.id)
          .single();
        
        if (profileData) setProfile(profileData);
      }

      const { data: specialtiesData } = await supabase
        .from('specialties')
        .select('code, name_en, name_ar, icon')
        .eq('is_active', true)
        .order('sort_order');

      if (specialtiesData) setSpecialties(specialtiesData);

      const { data: clinicsData, error: clinicsError } = await supabase
        .from('clinics')
        .select(`
          id, clinic_name, address, consultation_fee, phone, whatsapp, latitude, longitude, doctor_id,
          doctors!inner (id, user_id, specialty_code, experience_years, rating, total_reviews, is_approved, instagram, facebook)
        `)
        .eq('is_active', true)
        .eq('doctors.is_approved', true);

      if (clinicsError) {
        setError(clinicsError.message);
        setLoading(false);
        return;
      }

      if (!clinicsData || clinicsData.length === 0) {
        setClinics([]);
        setFilteredClinics([]);
        setLoading(false);
        return;
      }

      const specialtiesMap = new Map(specialtiesData?.map((s: any) => [s.code, s]) || []);
      const userIds = clinicsData.map((c: any) => c.doctors?.user_id).filter(Boolean);
      
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, full_name_ar')
        .in('id', userIds);

      const profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]) || []);

      const transformedClinics: Clinic[] = clinicsData.map((clinic: any) => {
        const doctor = clinic.doctors;
        const doctorProfile = profilesMap.get(doctor?.user_id);
        const specialty = specialtiesMap.get(doctor?.specialty_code);
        
        let distance: number | null = null;
        if (userLocation) {
          distance = calculateDistance(userLocation.latitude, userLocation.longitude, clinic.latitude, clinic.longitude);
        }

        return {
          id: clinic.id,
          clinic_name: clinic.clinic_name,
          address: clinic.address || '',
          consultation_fee: clinic.consultation_fee || t.home.consultationFee,
          phone: clinic.phone || '',
          whatsapp: clinic.whatsapp || '',
          instagram: doctor?.instagram || '',
          facebook: doctor?.facebook || '',
          latitude: clinic.latitude,
          longitude: clinic.longitude,
          distance,
          distance_text: distance ? `${distance.toFixed(1)} km` : 'N/A',
          doctor_id: doctor?.id,
          doctor_name: doctorProfile?.full_name ? `Dr. ${doctorProfile.full_name}` : 'Doctor',
          doctor_name_ar: doctorProfile?.full_name_ar ? `د. ${doctorProfile.full_name_ar}` : 'طبيب',
          specialty: specialty?.name_en || doctor?.specialty_code || 'General',
          specialty_ar: specialty?.name_ar || 'عام',
          specialty_code: doctor?.specialty_code || '',
          specialty_icon: specialty?.icon || '🩺',
          rating: doctor?.rating?.toFixed(1) || '0.0',
          reviews: doctor?.total_reviews?.toString() || '0',
          experience: `${doctor?.experience_years || 0} ${t.home.yearsExp}`,
          experience_years: doctor?.experience_years || 0,
        };
      });

      transformedClinics.sort((a, b) => {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });

      setClinics(transformedClinics);
      setFilteredClinics(transformedClinics);
      setLoading(false);

    } catch (err: any) {
      setError(err.message || t.errors.somethingWentWrong);
      setLoading(false);
    }
  };

  const filterClinics = () => {
    if (!selectedSpecialty) {
      setFilteredClinics(clinics);
    } else {
      setFilteredClinics(clinics.filter(c => c.specialty_code === selectedSpecialty));
    }
  };

  const handleSpecialtyPress = (code: string) => {
    setSelectedSpecialty(selectedSpecialty === code ? null : code);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t.home.goodMorning;
    if (hour < 17) return t.home.goodAfternoon;
    return t.home.goodEvening;
  };

  const getUserName = () => {
    if (isRTL && profile?.full_name_ar) {
      return profile.full_name_ar.split(' ')[0];
    }
    if (profile?.full_name) {
      return profile.full_name.split(' ')[0];
    }
    return '';
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <View style={[styles.headerContent, isRTL && styles.rowReverse]}>
          <View>
            <Text style={[styles.greeting, isRTL && styles.textRight]}>
              {getGreeting()}, {getUserName()} 👋
            </Text>
            <Text style={[styles.subtitle, isRTL && styles.textRight]}>{t.home.findNearbyClinics}</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Text style={styles.notificationIcon}>🔔</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={[styles.searchBar, isRTL && styles.rowReverse]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>{t.home.searchPlaceholder}</Text>
        </TouchableOpacity>

        <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
          <Text style={styles.sectionTitle}>{t.home.filterBySpecialty}</Text>
          {selectedSpecialty && (
            <TouchableOpacity onPress={() => setSelectedSpecialty(null)}>
              <Text style={styles.clearFilter}>{t.common.clear} ✕</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.specialtiesScroll}
          contentContainerStyle={isRTL && { flexDirection: 'row-reverse' }}
        >
          {specialties.map((specialty) => (
            <TouchableOpacity 
              key={specialty.code} 
              style={[styles.specialtyCard, selectedSpecialty === specialty.code && styles.specialtyCardSelected]}
              onPress={() => handleSpecialtyPress(specialty.code)}
            >
              <Text style={styles.specialtyIcon}>{specialty.icon}</Text>
              <Text style={[styles.specialtyText, selectedSpecialty === specialty.code && styles.specialtyTextSelected]} numberOfLines={1}>
                {isRTL ? specialty.name_ar : specialty.name_en}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
          <Text style={styles.sectionTitle}>
            {selectedSpecialty ? t.home.filteredClinics : t.home.nearbyClinics}
          </Text>
          <Text style={styles.clinicCount}>({filteredClinics.length})</Text>
        </View>
        
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
              <Text style={styles.retryButtonText}>{t.common.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : filteredClinics.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏥</Text>
            <Text style={styles.emptyTitle}>{t.home.noClinicsFound}</Text>
            <Text style={styles.emptyText}>
              {selectedSpecialty ? t.home.noClinicsForSpecialty : t.home.noApprovedClinics}
            </Text>
          </View>
        ) : (
          filteredClinics.map((clinic) => (
            <TouchableOpacity
              key={clinic.id}
              style={styles.clinicCard}
              onPress={() => router.push({
                pathname: '/doctor-profile',
                params: {
                  clinic_id: clinic.id,
                  doctor_id: clinic.doctor_id,
                  name: clinic.doctor_name,
                  name_ar: clinic.doctor_name_ar,
                  specialty: clinic.specialty,
                  specialty_ar: clinic.specialty_ar,
                  rating: clinic.rating,
                  reviews: clinic.reviews,
                  distance: clinic.distance_text,
                  fee: clinic.consultation_fee,
                  icon: clinic.specialty_icon,
                  clinic: clinic.clinic_name,
                  address: clinic.address,
                  experience: clinic.experience,
                  phone: clinic.phone,
                  whatsapp: clinic.whatsapp,
                  instagram: clinic.instagram,
                  facebook: clinic.facebook,
                }
              } as any)}
            >
              <View style={[styles.clinicHeader, isRTL && styles.rowReverse]}>
                <View style={styles.clinicIconContainer}>
                  <Text style={styles.clinicIcon}>🏥</Text>
                </View>
                <View style={[styles.clinicHeaderInfo, isRTL && styles.alignRight]}>
                  <Text style={[styles.clinicName, isRTL && styles.textRight]}>{clinic.clinic_name}</Text>
                  <Text style={[styles.clinicAddress, isRTL && styles.textRight]} numberOfLines={1}>
                    📍 {clinic.address}
                  </Text>
                </View>
                <View style={styles.distanceBadge}>
                  <Text style={styles.distanceText}>{clinic.distance_text}</Text>
                </View>
              </View>

              <View style={[styles.doctorSection, isRTL && styles.rowReverse]}>
                <View style={styles.doctorIconSmall}>
                  <Text>{clinic.specialty_icon}</Text>
                </View>
                <View style={[styles.doctorInfoSmall, isRTL && styles.alignRight]}>
                  <Text style={[styles.doctorNameSmall, isRTL && styles.textRight]}>
                    {isRTL ? clinic.doctor_name_ar : clinic.doctor_name}
                  </Text>
                  <Text style={[styles.doctorSpecialtySmall, isRTL && styles.textRight]}>
                    {isRTL ? clinic.specialty_ar : clinic.specialty}
                  </Text>
                </View>
                <View style={[styles.doctorStats, isRTL && styles.alignLeft]}>
                  <Text style={styles.doctorRating}>⭐ {clinic.rating}</Text>
                  <Text style={styles.doctorExp}>{clinic.experience_years} {t.home.yearsExp}</Text>
                </View>
              </View>

              <View style={[styles.clinicFooter, isRTL && styles.rowReverse]}>
                <Text style={styles.feeLabel}>{t.home.consultationFee}</Text>
                <Text style={styles.feeAmount}>{clinic.consultation_fee}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#6B7280' },
  header: { backgroundColor: '#2563EB', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 25, borderBottomRightRadius: 25 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowReverse: { flexDirection: 'row-reverse' },
  textRight: { textAlign: 'right' },
  alignRight: { alignItems: 'flex-end' },
  alignLeft: { alignItems: 'flex-start' },
  greeting: { fontSize: 22, fontWeight: 'bold', color: 'white', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#BFDBFE' },
  notificationButton: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 },
  notificationIcon: { fontSize: 20 },
  content: { flex: 1, padding: 20 },
  searchBar: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 20, marginTop: -10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
  searchIcon: { fontSize: 20, marginRight: 10 },
  searchPlaceholder: { color: '#9CA3AF', fontSize: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  clearFilter: { fontSize: 14, color: '#EF4444', fontWeight: '500' },
  clinicCount: { fontSize: 14, color: '#6B7280' },
  specialtiesScroll: { marginBottom: 20 },
  specialtyCard: { backgroundColor: 'white', padding: 12, borderRadius: 12, marginRight: 10, alignItems: 'center', minWidth: 80, borderWidth: 2, borderColor: 'transparent' },
  specialtyCardSelected: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  specialtyIcon: { fontSize: 26, marginBottom: 6 },
  specialtyText: { fontSize: 11, fontWeight: '500', color: '#374151', textAlign: 'center' },
  specialtyTextSelected: { color: '#2563EB', fontWeight: '600' },
  clinicCard: { backgroundColor: 'white', borderRadius: 16, padding: 15, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  clinicHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  clinicIconContainer: { backgroundColor: '#DBEAFE', width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  clinicIcon: { fontSize: 22 },
  clinicHeaderInfo: { flex: 1 },
  clinicName: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 2 },
  clinicAddress: { fontSize: 12, color: '#6B7280' },
  distanceBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  distanceText: { fontSize: 12, fontWeight: '600', color: '#059669' },
  doctorSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 10, borderRadius: 10, marginBottom: 10 },
  doctorIconSmall: { backgroundColor: '#EFF6FF', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  doctorInfoSmall: { flex: 1 },
  doctorNameSmall: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  doctorSpecialtySmall: { fontSize: 12, color: '#6B7280' },
  doctorStats: { alignItems: 'flex-end' },
  doctorRating: { fontSize: 12, fontWeight: '600', color: '#F59E0B' },
  doctorExp: { fontSize: 11, color: '#9CA3AF' },
  clinicFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  feeLabel: { fontSize: 13, color: '#6B7280' },
  feeAmount: { fontSize: 16, fontWeight: 'bold', color: '#2563EB' },
  errorContainer: { alignItems: 'center', padding: 30 },
  errorIcon: { fontSize: 40, marginBottom: 10 },
  errorText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 15 },
  retryButton: { backgroundColor: '#2563EB', paddingHorizontal: 25, paddingVertical: 10, borderRadius: 8 },
  retryButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: 40, backgroundColor: 'white', borderRadius: 12 },
  emptyIcon: { fontSize: 50, marginBottom: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
});
