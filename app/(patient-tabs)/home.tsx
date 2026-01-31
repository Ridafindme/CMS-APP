import { patientTheme } from '@/constants/patientTheme';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
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
  consultation_currency: string | null;
  mobile: string;
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
  doctor_avatar_url: string;
  specialty: string;
  specialty_ar: string;
  specialty_code: string;
  specialty_icon: string;
  rating: string;
  reviews: string;
  experience: string;
  experience_years: number;
  bio?: string;
};

type Profile = {
  full_name: string;
  full_name_ar?: string;
};

type UserLocation = {
  latitude: number;
  longitude: number;
};

const theme = patientTheme;

export default function PatientHomeTab() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, language, isRTL, toggleLanguage } = useI18n();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [filteredClinics, setFilteredClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyMap, setCurrencyMap] = useState<Record<string, { code: string; symbol: string }>>({});

  useEffect(() => {
    const initializeData = async () => {
      await getUserLocation();
      await fetchData();
    };
    initializeData();
  }, [user]);

  // Recalculate distances when location is obtained or clinics change
  useEffect(() => {
    if (clinics.length === 0) return;
    
    const updatedClinics = clinics.map(clinic => {
      let distance: number | null = null;
      
      if (userLocation && clinic.latitude && clinic.longitude) {
        distance = calculateDistance(
          userLocation.latitude, 
          userLocation.longitude, 
          clinic.latitude, 
          clinic.longitude
        );
      }
      
      return {
        ...clinic,
        distance,
        distance_text: distance ? `${distance.toFixed(1)} km` : 'N/A',
      };
    });
    
    // Sort by distance
    updatedClinics.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });
    
    // Only update if distances actually changed
    const hasDistanceChanges = updatedClinics.some((clinic, index) => 
      clinic.distance !== clinics[index]?.distance
    );
    
    if (hasDistanceChanges) {
      setClinics(updatedClinics);
    }
  }, [userLocation, clinics.length]);

  useEffect(() => {
    filterClinics();
  }, [selectedSpecialty, clinics, searchQuery]);

  useEffect(() => {
    const fetchCurrencyMetadata = async () => {
      const fallback = {
        USD: { code: 'USD', symbol: '$' },
        LBP: { code: 'LBP', symbol: 'ل.ل.' },
      };

      try {
        const { data, error } = await supabase
          .from('currencies')
          .select('currency_code, currency_symbol')
          .eq('is_active', true);

        if (error) throw error;

        if (data && data.length > 0) {
          const map = data.reduce((acc, curr) => {
            acc[curr.currency_code] = {
              code: curr.currency_code,
              symbol: curr.currency_symbol || curr.currency_code,
            };
            return acc;
          }, {} as Record<string, { code: string; symbol: string }>);

          setCurrencyMap(map);
        } else {
          setCurrencyMap(fallback);
        }
      } catch (currencyError) {
        console.log('Error fetching currency metadata:', currencyError);
        setCurrencyMap(fallback);
      }
    };

    fetchCurrencyMetadata();
  }, []);

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

  const getCurrencyMeta = (currencyCode?: string | null) => {
    if (!currencyCode) return null;
    if (currencyMap[currencyCode]) return currencyMap[currencyCode];
    if (currencyCode === 'USD') {
      return { code: 'USD', symbol: '$' };
    }
    if (currencyCode === 'LBP') {
      return { code: 'LBP', symbol: 'ل.ل.' };
    }
    return { code: currencyCode, symbol: currencyCode };
  };

  const formatConsultationFeeValue = (
    amount?: string | null,
    currencyCode?: string | null
  ) => {
    if (!amount || !amount.trim()) return null;
    const currencyMeta = getCurrencyMeta(currencyCode);
    if (!currencyMeta) return amount.trim();
    
    // Remove any existing formatting and parse the number
    const cleanAmount = amount.trim().replace(/[^0-9]/g, '');
    if (!cleanAmount) return amount.trim();
    
    // Format with thousands separator
    const numericAmount = parseInt(cleanAmount, 10);
    if (isNaN(numericAmount)) return amount.trim();
    
    const formattedAmount = numericAmount.toLocaleString('en-US');
    
    if (currencyMeta.code === 'USD') {
      return `${currencyMeta.symbol}${formattedAmount}`;
    }
    return `${formattedAmount} ${currencyMeta.symbol}`;
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
          id, clinic_name, address, consultation_fee, consultation_currency, mobile, whatsapp, latitude, longitude, doctor_id,
          doctors!inner (id, user_id, specialty_code, experience_years, rating, total_reviews, is_approved, instagram, facebook, bio)
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
        .select('id, full_name, full_name_ar, avatar_url')
        .in('id', userIds);

      const profilesMap = new Map(profilesData?.map((p: any) => [p.id, p]) || []);

      const transformedClinics: Clinic[] = clinicsData.map((clinic: any) => {
        const doctor = clinic.doctors;
        const doctorProfile = profilesMap.get(doctor?.user_id);
        const specialty = specialtiesMap.get(doctor?.specialty_code);
        
        let distance: number | null = null;
        let distance_text = 'N/A';
        
        if (userLocation && clinic.latitude && clinic.longitude) {
          distance = calculateDistance(
            userLocation.latitude, 
            userLocation.longitude, 
            clinic.latitude, 
            clinic.longitude
          );
          distance_text = distance ? `${distance.toFixed(1)} km` : 'N/A';
        }

        return {
          id: clinic.id,
          clinic_name: clinic.clinic_name,
          address: clinic.address || '',
          consultation_fee: clinic.consultation_fee || '',
          consultation_currency: clinic.consultation_currency || null,
          mobile: clinic.mobile || '',
          whatsapp: clinic.whatsapp || '',
          instagram: doctor?.instagram || '',
          facebook: doctor?.facebook || '',
          latitude: clinic.latitude,
          longitude: clinic.longitude,
          distance,
          distance_text,
          doctor_id: doctor?.id,
          doctor_name: doctorProfile?.full_name ? `Dr. ${doctorProfile.full_name}` : 'Doctor',
          doctor_name_ar: doctorProfile?.full_name_ar ? `د. ${doctorProfile.full_name_ar}` : 'طبيب',
          doctor_avatar_url: doctorProfile?.avatar_url || '',
          specialty: specialty?.name_en || doctor?.specialty_code || 'General',
          specialty_ar: specialty?.name_ar || 'عام',
          specialty_code: doctor?.specialty_code || '',
          specialty_icon: specialty?.icon || '🩺',
          rating: doctor?.rating?.toFixed(1) || '0.0',
          reviews: doctor?.total_reviews?.toString() || '0',
          experience: `${doctor?.experience_years || 0} ${t.home.yearsExp}`,
          experience_years: doctor?.experience_years || 0,
          bio: doctor?.bio || '',
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
    let filtered = clinics;

    // Filter by specialty
    if (selectedSpecialty) {
      filtered = filtered.filter(c => c.specialty_code === selectedSpecialty);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      
      // Detect if the query contains Arabic characters
      const isArabicQuery = /[\u0600-\u06FF]/.test(query);
      
      filtered = filtered.filter(clinic => {
        if (isArabicQuery) {
          // Search in Arabic fields
          return (
            clinic.clinic_name.toLowerCase().includes(query) ||
            clinic.specialty_ar.toLowerCase().includes(query) ||
            clinic.doctor_name_ar.toLowerCase().includes(query)
          );
        } else {
          // Search in English fields
          return (
            clinic.clinic_name.toLowerCase().includes(query) ||
            clinic.specialty.toLowerCase().includes(query) ||
            clinic.doctor_name.toLowerCase().includes(query) ||
            clinic.address.toLowerCase().includes(query)
          );
        }
      });
    }

    // Sort by distance (nearest first)
    filtered.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    setFilteredClinics(filtered);
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

  const getDisplayName = () => {
    const englishName = profile?.full_name?.trim();
    const arabicName = profile?.full_name_ar?.trim();

    if (language === 'ar' || isRTL) {
      return arabicName || englishName || '';
    }

    return englishName || arabicName || '';
  };

  const openMaps = (latitude: number | null, longitude: number | null, address: string) => {
    if (latitude && longitude) {
      const scheme = Platform.select({
        ios: 'maps:',
        android: 'geo:',
      });
      const url = Platform.select({
        ios: `${scheme}${latitude},${longitude}?q=${encodeURIComponent(address)}`,
        android: `${scheme}${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(address)})`,
      });
      
      if (url) {
        Linking.openURL(url).catch(() => {
          // Fallback to Google Maps web
          Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
        });
      }
    } else if (address) {
      // If no coordinates, search by address
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
      Linking.openURL(url);
    }
  };

  const goToPatientProfile = () => {
    router.push('/(patient-tabs)/profile');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <View style={[styles.headerContent, isRTL && styles.rowReverse]}>
          <View style={[styles.headerGreeting, isRTL && styles.alignRight]}>
            <View style={[styles.greetingRow, isRTL && styles.rowReverse]}>
              <TouchableOpacity
                style={styles.greetingIconBadge}
                onPress={goToPatientProfile}
                activeOpacity={0.8}
              >
                <View style={styles.greetingIconBadgeInner}>
                  <View style={styles.patientGlyphWrapper}>
                    <Ionicons
                      name="person-outline"
                      size={28}
                      color={theme.colors.primaryDark}
                      style={styles.patientGlyphIcon}
                    />
                  </View>
                </View>
              </TouchableOpacity>
              <Text style={[styles.greeting, isRTL && styles.textRight]}>
                {getDisplayName() || (isRTL ? 'المريض' : 'Patient')}
              </Text>
            </View>
            <Text style={[styles.subtitle, isRTL && styles.textRight]}>{t.home.findNearbyClinics}</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={toggleLanguage}
            >
              <Ionicons name="globe-outline" size={18} color={theme.colors.surface} />
              <Text style={styles.iconButtonText}>
                {language === 'ar' ? 'EN' : 'AR'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconButton, styles.notificationButton]}>
              <Ionicons
                name={theme.icons.headerNotification as keyof typeof Ionicons.glyphMap}
                size={20}
                color={theme.colors.surface}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.searchBar, isRTL && styles.rowReverse]}>
          <Ionicons
            name={theme.icons.search as keyof typeof Ionicons.glyphMap}
            size={20}
            color={theme.colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, isRTL && styles.textRight]}
            placeholder={t.home.searchPlaceholder}
            placeholderTextColor={theme.colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons
                name={theme.icons.clear as keyof typeof Ionicons.glyphMap}
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

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
            <Ionicons name="alert-circle-outline" size={36} color={theme.colors.warning} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
              <Text style={styles.retryButtonText}>{t.common.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : filteredClinics.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="medkit-outline" size={42} color={theme.colors.primary} />
            <Text style={styles.emptyTitle}>{t.home.noClinicsFound}</Text>
            <Text style={styles.emptyText}>
              {selectedSpecialty ? t.home.noClinicsForSpecialty : t.home.noApprovedClinics}
            </Text>
          </View>
        ) : (
          filteredClinics.map((clinic) => {
            const formattedFee =
              formatConsultationFeeValue(clinic.consultation_fee, clinic.consultation_currency) ||
              t.common.notAvailable;
            return (
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
                  fee: formattedFee,
                  fee_currency: clinic.consultation_currency || '',
                  fee_amount: clinic.consultation_fee || '',
                  icon: clinic.specialty_icon,
                  clinic: clinic.clinic_name,
                  address: clinic.address,
                  latitude: clinic.latitude?.toString() || '',
                  longitude: clinic.longitude?.toString() || '',
                  experience: clinic.experience,
                  phone: clinic.mobile,
                  whatsapp: clinic.whatsapp,
                  instagram: clinic.instagram,
                  facebook: clinic.facebook,
                  avatar_url: clinic.doctor_avatar_url,
                  bio: clinic.bio,
                }
              } as any)}
            >
              <View style={[styles.clinicHeader, isRTL && styles.rowReverse]}>
                <View style={styles.clinicIconContainer}>
                  <Ionicons
                    name={theme.icons.clinic as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={[styles.clinicHeaderInfo, isRTL && styles.alignRight]}>
                  <Text style={[styles.clinicName, isRTL && styles.textRight]}>{clinic.clinic_name}</Text>
                  <View style={[styles.addressRow, isRTL && styles.rowReverse]}>
                    <Ionicons
                      name={theme.icons.location as keyof typeof Ionicons.glyphMap}
                      size={14}
                      color={theme.colors.textMuted}
                      style={styles.addressIcon}
                    />
                    <Text style={[styles.clinicAddress, isRTL && styles.textRight]} numberOfLines={1}>
                      {clinic.address}
                    </Text>
                  </View>
                </View>
                <View style={styles.distanceBadge}>
                  <Ionicons
                    name={theme.icons.distance as keyof typeof Ionicons.glyphMap}
                    size={14}
                    color={theme.colors.primaryDark}
                  />
                  <Text style={styles.distanceText}>{clinic.distance_text}</Text>
                </View>
              </View>

              <View style={[styles.doctorSection, isRTL && styles.rowReverse]}>
                <View style={styles.doctorIconSmall}>
                  <Ionicons
                    name={theme.icons.doctor as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={theme.colors.primaryDark}
                  />
                </View>
                <View style={[styles.doctorInfoSmall, isRTL && styles.alignRight]}>
                  <Text style={[styles.doctorNameSmall, isRTL && styles.textRight]}>
                    {isRTL ? clinic.doctor_name_ar : clinic.doctor_name}
                  </Text>
                  <Text style={[styles.doctorSpecialtySmall, isRTL && styles.textRight]}>
                    {(isRTL ? clinic.specialty_ar : clinic.specialty) + (clinic.specialty_icon ? ` ${clinic.specialty_icon}` : '')}
                  </Text>
                </View>
                <View style={[styles.doctorStats, isRTL && styles.alignLeft]}>
                  <View style={styles.statRow}>
                    <Ionicons name="star-outline" size={14} color={theme.colors.warning} />
                    <Text style={styles.doctorRating}>{clinic.rating}</Text>
                  </View>
                  <View style={styles.statRow}>
                    <Ionicons name="briefcase-outline" size={14} color={theme.colors.textMuted} />
                    <Text style={styles.doctorExp}>{clinic.experience_years} {t.home.yearsExp}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.clinicFooter, isRTL && styles.rowReverse]}>
                <View style={[styles.feeLabelRow, isRTL && styles.rowReverse]}>
                  <Ionicons name="card-outline" size={16} color={theme.colors.textMuted} />
                  <Text style={styles.feeLabel}>{t.home.consultationFee}</Text>
                </View>
                <Text style={styles.feeAmount}>{formattedFee}</Text>
              </View>
            </TouchableOpacity>
          );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: theme.colors.textSecondary },
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: 52,
    paddingBottom: 24,
    paddingHorizontal: theme.spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md },
  headerGreeting: { flex: 1 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  greetingIconBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    padding: 4,
    borderRadius: theme.radii.pill,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  greetingIconBadgeInner: {
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.pill,
    padding: 6,
    borderWidth: 1,
    borderColor: 'rgba(41,98,255,0.25)',
    transform: [{ translateY: -1 }],
  },
  patientGlyphWrapper: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  patientGlyphIcon: {
    marginTop: 2,
  },
  rowReverse: { flexDirection: 'row-reverse' },
  textRight: { textAlign: 'right' },
  alignRight: { alignItems: 'flex-end' },
  alignLeft: { alignItems: 'flex-start' },
  greeting: { fontSize: 22, fontWeight: '700', color: theme.colors.surface },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.78)', marginTop: 4 },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radii.pill,
  },
  iconButtonText: { color: theme.colors.surface, fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },
  notificationButton: { paddingHorizontal: 10 },
  content: { flex: 1, padding: theme.spacing.lg },
  searchBar: {
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.lg,
    marginBottom: theme.spacing.lg,
    marginTop: -20,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    ...theme.shadow.card,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: theme.colors.textPrimary },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, marginTop: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary },
  clearFilter: { fontSize: 14, color: theme.colors.danger, fontWeight: '500' },
  clinicCount: { fontSize: 14, color: theme.colors.textMuted },
  specialtiesScroll: { marginBottom: 20 },
  specialtyCard: {
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: theme.radii.md,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 84,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  specialtyCardSelected: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  specialtyIcon: { fontSize: 24, marginBottom: 6 },
  specialtyText: { fontSize: 12, fontWeight: '500', color: theme.colors.textPrimary, textAlign: 'center' },
  specialtyTextSelected: { color: theme.colors.primary, fontWeight: '600' },
  clinicCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  clinicHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  clinicIconContainer: {
    backgroundColor: theme.colors.primarySoft,
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clinicHeaderInfo: { flex: 1, gap: 4 },
  clinicName: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addressIcon: { marginTop: 1 },
  clinicAddress: { fontSize: 13, color: theme.colors.textSecondary, flexShrink: 1 },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  distanceText: { fontSize: 12, fontWeight: '600', color: theme.colors.primaryDark },
  doctorSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  doctorIconSmall: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.elevated,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorInfoSmall: { flex: 1, paddingHorizontal: 12 },
  doctorNameSmall: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  doctorSpecialtySmall: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  doctorStats: { gap: 6, alignItems: 'flex-end' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doctorRating: { fontWeight: '600', color: theme.colors.warning },
  doctorExp: { fontSize: 12, color: theme.colors.textSecondary },
  clinicFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderColor: theme.colors.border },
  feeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  feeLabel: { fontSize: 13, color: theme.colors.textSecondary },
  feeAmount: { fontSize: 16, fontWeight: '700', color: theme.colors.primaryDark, writingDirection: 'ltr' },
  errorContainer: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    gap: theme.spacing.sm,
  },
  errorText: { textAlign: 'center', color: theme.colors.textSecondary, fontSize: 14 },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: theme.radii.pill,
  },
  retryButtonText: { color: theme.colors.surface, fontWeight: '600' },
  emptyState: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    gap: theme.spacing.sm,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary },
  emptyText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
});
