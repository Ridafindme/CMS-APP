import PhoneInput from '@/components/ui/phone-input';
import { patientTheme } from '@/constants/patientTheme';
import { useAuth } from '@/lib/AuthContext';
import { fromE164, validatePhone } from '@/lib/phone-utils';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const theme = patientTheme;

type Specialty = {
  code: string;
  name_en: string;
  name_ar: string;
  icon: string;
};

const determineCurrencyByFee = (amount?: string | null) => {
  if (!amount) return null;
  const normalized = amount.replace(/[^0-9.,]/g, '').replace(/,/g, '');
  if (!normalized) return null;
  const parsed = parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed > 1000 ? 'LBP' : 'USD';
};

export default function DoctorSignUpScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [showSpecialtyPicker, setShowSpecialtyPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [tempLocation, setTempLocation] = useState<{ latitude: number; longitude: number; address: string } | null>(null);

  const [formData, setFormData] = useState({
    specialtyCode: '',
    graduationYear: '',
    experienceYears: '',
    clinicName: '',
    clinicAddress: '',
    clinicLatitude: null as number | null,
    clinicLongitude: null as number | null,
    consultationFee: '',
    mobile: '',
    landline: '',
    whatsapp: '',
  });

  useEffect(() => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Please sign in or create an account first before applying as a doctor.',
        [
          { text: 'Cancel', onPress: () => router.back() },
          { text: 'Sign In', onPress: () => router.replace('/sign-in') },
          { text: 'Sign Up', onPress: () => router.replace('/sign-up-patient') },
        ]
      );
      return;
    }
    
    fetchSpecialties();
    checkExistingApplication();
  }, [user]);

  const fetchSpecialties = async () => {
    const { data, error } = await supabase
      .from('specialties')
      .select('code, name_en, name_ar, icon')
      .eq('is_active', true)
      .order('sort_order');
    
    if (!error && data) {
      setSpecialties(data);
    }
  };

  const checkExistingApplication = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('doctors')
      .select('id, is_approved')
      .eq('user_id', user.id)
      .single();
    
    if (data) {
      Alert.alert(
        'Already Applied',
        data.is_approved 
          ? 'You are already registered as a doctor.'
          : 'Your application is pending approval.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to set clinic location.');
        setGettingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const addressString = [
        address.street,
        address.district,
        address.city,
        address.region,
        address.country
      ].filter(Boolean).join(', ');

      updateField('clinicLatitude', location.coords.latitude);
      updateField('clinicLongitude', location.coords.longitude);
      updateField('clinicAddress', addressString);
      
      setShowLocationPicker(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location. Please enter address manually.');
    }
    setGettingLocation(false);
  };

  const openMapPicker = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use the map.');
        return;
      }

      // Get current location for initial map position
      const location = await Location.getCurrentPositionAsync({});
      setTempLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: '',
      });
      setShowMapPicker(true);
    } catch (error) {
      // If can't get location, use default (Beirut, Lebanon)
      setTempLocation({
        latitude: 33.8886,
        longitude: 35.4955,
        address: '',
      });
      setShowMapPicker(true);
    }
  };

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    
    try {
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const addressString = [
        address.street,
        address.district,
        address.city,
        address.region,
        address.country
      ].filter(Boolean).join(', ');

      setTempLocation({ latitude, longitude, address: addressString });
    } catch (error) {
      setTempLocation({ latitude, longitude, address: 'Selected location' });
    }
  };

  const confirmMapLocation = () => {
    if (tempLocation) {
      updateField('clinicLatitude', tempLocation.latitude);
      updateField('clinicLongitude', tempLocation.longitude);
      updateField('clinicAddress', tempLocation.address);
      setShowMapPicker(false);
      setShowLocationPicker(false);
      setTempLocation(null);
    }
  };

  const validateStep1 = () => {
    if (!formData.specialtyCode) {
      Alert.alert('Error', 'Please select your specialty');
      return false;
    }
    if (!formData.graduationYear || parseInt(formData.graduationYear) < 1950 || parseInt(formData.graduationYear) > new Date().getFullYear()) {
      Alert.alert('Error', 'Please enter a valid graduation year');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.clinicName) {
      Alert.alert('Error', 'Please enter clinic name');
      return false;
    }
    if (!formData.clinicAddress) {
      Alert.alert('Error', 'Please set clinic location');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    if (!user) {
      Alert.alert('Error', 'You must be signed in to apply');
      return;
    }

    // Validate phone numbers if provided
    if (formData.mobile || formData.landline || formData.whatsapp) {
      const { data: countryData } = await supabase
        .from('countries')
        .select('phone_config, country_code')
        .eq('is_default', true)
        .single();
      
      if (countryData?.phone_config) {
        // Validate mobile
        if (formData.mobile) {
          const localNumber = fromE164(formData.mobile, countryData.country_code);
          const validation = validatePhone(localNumber, countryData.phone_config, 'mobile');
          if (!validation.valid) {
            Alert.alert('Error', `Mobile: ${validation.error}`);
            return;
          }
        }
        
        // Validate landline
        if (formData.landline) {
          const localNumber = fromE164(formData.landline, countryData.country_code);
          const validation = validatePhone(localNumber, countryData.phone_config, 'landline');
          if (!validation.valid) {
            Alert.alert('Error', `Landline: ${validation.error}`);
            return;
          }
        }
        
        // Validate whatsapp
        if (formData.whatsapp) {
          const localNumber = fromE164(formData.whatsapp, countryData.country_code);
          const validation = validatePhone(localNumber, countryData.phone_config, 'mobile');
          if (!validation.valid) {
            Alert.alert('Error', `WhatsApp: ${validation.error}`);
            return;
          }
        }
      }
    }

    const autoCurrency = determineCurrencyByFee(formData.consultationFee) || 'LBP';

    setLoading(true);
    
    try {
      // Create doctor record
      const { data: doctorData, error: doctorError } = await supabase
        .from('doctors')
        .insert({
          user_id: user.id,
          specialty_code: formData.specialtyCode,
          graduation_year: parseInt(formData.graduationYear),
          experience_years: parseInt(formData.experienceYears) || 0,
          is_approved: false,
        })
        .select()
        .single();

      if (doctorError) {
        Alert.alert('Error', doctorError.message);
        setLoading(false);
        return;
      }

      // Create clinic (inactive until admin approves)
      await supabase
        .from('clinics')
        .insert({
          doctor_id: doctorData.id,
          clinic_name: formData.clinicName,
          address: formData.clinicAddress,
          latitude: formData.clinicLatitude,
          longitude: formData.clinicLongitude,
          consultation_fee: formData.consultationFee || null,
          consultation_currency: autoCurrency,
          mobile: formData.mobile || null,
          landline: formData.landline || null,
          whatsapp: formData.whatsapp || null,
          is_active: false, // Admin must activate
        });

      Alert.alert(
        'Application Submitted! 🎉',
        'Your account will be waiting for approval. The review process takes up to 24 hours maximum. Your clinic will be activated after approval.',
        [{ text: 'OK', onPress: () => router.replace('/(patient-tabs)/profile') }]
      );

    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedSpecialty = specialties.find(s => s.code === formData.specialtyCode);

  if (!user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={[theme.colors.primary, theme.colors.accent]} style={styles.gradient}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => step > 1 ? setStep(step - 1) : router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.headerIconBox}>
            <Text style={styles.icon}>👨‍⚕️</Text>
          </View>
          <Text style={styles.title}>Apply as Doctor</Text>
          <Text style={styles.subtitle}>Complete your professional profile</Text>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressBar, { width: `${(step / 2) * 100}%` }]} />
            </View>
            <View style={styles.stepsRow}>
              <View style={[styles.stepIndicator, step >= 1 && styles.stepIndicatorActive]}>
                <Text style={[styles.stepNumber, step >= 1 && styles.stepNumberActive]}>1</Text>
              </View>
              <View style={styles.stepConnector} />
              <View style={[styles.stepIndicator, step >= 2 && styles.stepIndicatorActive]}>
                <Text style={[styles.stepNumber, step >= 2 && styles.stepNumberActive]}>2</Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContainer}>
          {/* STEP 1: Professional Info */}
          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>Professional Information</Text>
              <Text style={styles.stepDesc}>Tell us about your medical background</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Specialty *</Text>
                <TouchableOpacity 
                  style={styles.pickerButton}
                  onPress={() => setShowSpecialtyPicker(!showSpecialtyPicker)}
                >
                  <Text style={selectedSpecialty ? styles.pickerText : styles.pickerPlaceholder}>
                    {selectedSpecialty ? `${selectedSpecialty.icon} ${selectedSpecialty.name_en}` : 'Select your specialty'}
                  </Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </TouchableOpacity>
                
                {showSpecialtyPicker && (
                  <View style={styles.pickerOptions}>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {specialties.map((spec) => (
                        <TouchableOpacity
                          key={spec.code}
                          style={[
                            styles.pickerOption,
                            formData.specialtyCode === spec.code && styles.pickerOptionSelected
                          ]}
                          onPress={() => {
                            updateField('specialtyCode', spec.code);
                            setShowSpecialtyPicker(false);
                          }}
                        >
                          <Text style={styles.pickerOptionText}>
                            {spec.icon} {spec.name_en}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Graduation Year *</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="2015"
                      placeholderTextColor="#9CA3AF"
                      value={formData.graduationYear}
                      onChangeText={(value) => updateField('graduationYear', value)}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Years Experience</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="10"
                      placeholderTextColor="#9CA3AF"
                      value={formData.experienceYears}
                      onChangeText={(value) => updateField('experienceYears', value)}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>
                </View>
              </View>
            </>
          )}

          {/* STEP 2: Clinic Info */}
          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>Clinic Information</Text>
              <Text style={styles.stepDesc}>Where will you see patients?</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Clinic Name *</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Heart Care Medical Center"
                    placeholderTextColor="#9CA3AF"
                    value={formData.clinicName}
                    onChangeText={(value) => updateField('clinicName', value)}
                  />
                </View>
              </View>

              {/* Location Picker */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Clinic Location *</Text>
                <TouchableOpacity 
                  style={styles.locationButton}
                  onPress={() => setShowLocationPicker(true)}
                >
                  <Text style={styles.locationIcon}>📍</Text>
                  <Text style={formData.clinicAddress ? styles.locationText : styles.locationPlaceholder}>
                    {formData.clinicAddress || 'Tap to set clinic location'}
                  </Text>
                </TouchableOpacity>
                {formData.clinicLatitude && (
                  <Text style={styles.coordinatesText}>
                    ✓ Location set ({formData.clinicLatitude.toFixed(4)}, {formData.clinicLongitude?.toFixed(4)})
                  </Text>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Consultation Fee</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.input, formData.consultationFee && styles.inputWithCurrency]}
                    placeholder="Enter amount (e.g., 50 or 50,000)"
                    placeholderTextColor="#9CA3AF"
                    value={formData.consultationFee}
                    onChangeText={(value) => updateField('consultationFee', value)}
                    keyboardType="numeric"
                  />
                  {formData.consultationFee && determineCurrencyByFee(formData.consultationFee) && (
                    <View style={styles.currencyBadge}>
                      <Text style={styles.currencyBadgeText}>
                        {determineCurrencyByFee(formData.consultationFee)}
                      </Text>
                    </View>
                  )}
                </View>
                {formData.consultationFee && determineCurrencyByFee(formData.consultationFee) && (
                  <Text style={styles.currencyHint}>
                    💰 Detected currency: {determineCurrencyByFee(formData.consultationFee)} 
                    {determineCurrencyByFee(formData.consultationFee) === 'LBP' 
                      ? ' (amount > 1,000)' 
                      : ' (amount ≤ 1,000)'}
                  </Text>
                )}
              </View>

              <PhoneInput
                value={formData.mobile}
                onChangeValue={(e164, local) => updateField('mobile', e164)}
                type="mobile"
                label="Mobile Number"
                placeholder="70 123 456"
                icon="call-outline"
              />

              <PhoneInput
                value={formData.landline}
                onChangeValue={(e164, local) => updateField('landline', e164)}
                type="landline"
                label="Landline (Optional)"
                placeholder="01 123 456"
                icon="call-sharp"
              />

              <PhoneInput
                value={formData.whatsapp}
                onChangeValue={(e164, local) => updateField('whatsapp', e164)}
                type="mobile"
                label="WhatsApp Number"
                placeholder="70 123 456"
                icon={require('@/assets/images/whatsappicon.png')}
              />

              <View style={styles.infoBox}>
                <Text style={styles.infoIcon}>ℹ️</Text>
                <Text style={styles.infoText}>
                  Your clinic will be activated after admin approval. You can add more clinics from your dashboard later.
                </Text>
              </View>
            </>
          )}

          {/* Navigation Button */}
          <TouchableOpacity 
            style={[styles.nextButton, loading && styles.buttonDisabled]}
            onPress={step < 2 ? handleNext : handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.nextButtonText}>
                {step < 2 ? 'Continue →' : 'Submit Application'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Location Picker Modal */}
      <Modal
        visible={showLocationPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalIconCircle}>
                  <Ionicons name="location" size={24} color={theme.colors.primary} />
                </View>
                <Text style={styles.modalTitle}>Set Clinic Location</Text>
                <Text style={styles.modalSubtitle}>Help patients find your clinic easily</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.locationOption}
                onPress={getCurrentLocation}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <View style={styles.locationLoading}>
                    <ActivityIndicator color={theme.colors.primary} />
                    <Text style={styles.locationLoadingText}>Getting location...</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.locationOptionIconBox}>
                      <Ionicons name="navigate-circle" size={28} color={theme.colors.primary} />
                    </View>
                    <View style={styles.locationOptionInfo}>
                      <Text style={styles.locationOptionTitle}>Use Current Location</Text>
                      <Text style={styles.locationOptionDesc}>Automatically detect your clinic location</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.locationOption}
                onPress={openMapPicker}
              >
                <View style={styles.locationOptionIconBox}>
                  <Ionicons name="map" size={28} color={theme.colors.accent} />
                </View>
                <View style={styles.locationOptionInfo}>
                  <Text style={styles.locationOptionTitle}>Pick on Map</Text>
                  <Text style={styles.locationOptionDesc}>Select location visually on a map</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or enter manually</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Ionicons name="document-text" size={14} color={theme.colors.textMuted} /> Address
                </Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Street, City, Country"
                    placeholderTextColor="#9CA3AF"
                    value={formData.clinicAddress}
                    onChangeText={(value) => updateField('clinicAddress', value)}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.modalButtonSecondary}
                  onPress={() => setShowLocationPicker(false)}
                >
                  <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButtonPrimary, !formData.clinicAddress && styles.buttonDisabled]}
                  onPress={() => setShowLocationPicker(false)}
                  disabled={!formData.clinicAddress}
                >
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.modalButtonPrimaryText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Map Picker Modal */}
      <Modal
        visible={showMapPicker}
        animationType="slide"
        onRequestClose={() => setShowMapPicker(false)}
      >
        <View style={{ flex: 1 }}>
          <MapView
            style={{ flex: 1 }}
            initialRegion={{
              latitude: tempLocation?.latitude || 33.8886,
              longitude: tempLocation?.longitude || 35.4955,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            onPress={handleMapPress}
          >
            {tempLocation && (
              <Marker
                coordinate={{
                  latitude: tempLocation.latitude,
                  longitude: tempLocation.longitude,
                }}
                title="Clinic Location"
                description={tempLocation.address}
              />
            )}
          </MapView>
          
          {/* Map Controls Overlay */}
          <View style={styles.mapOverlay}>
            <View style={styles.mapHeader}>
              <TouchableOpacity 
                onPress={() => setShowMapPicker(false)}
                style={styles.mapCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.mapHeaderInfo}>
                <Text style={styles.mapHeaderTitle}>Select Clinic Location</Text>
                <Text style={styles.mapHeaderDesc}>Tap anywhere on the map</Text>
              </View>
            </View>
          </View>

          {tempLocation && (
            <View style={styles.mapFooter}>
              <View style={styles.mapLocationInfo}>
                <Ionicons name="location" size={20} color={theme.colors.primary} />
                <Text style={styles.mapLocationText} numberOfLines={2}>
                  {tempLocation.address || 'Location selected'}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.mapConfirmButton}
                onPress={confirmMapLocation}
              >
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                <Text style={styles.mapConfirmText}>Confirm Location</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 20,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stepIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stepIndicatorActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  stepNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  stepNumberActive: {
    color: theme.colors.primary,
  },
  stepConnector: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  formContainer: {
    backgroundColor: theme.colors.surface,
    marginTop: -20,
    borderTopLeftRadius: theme.radii.lg + 8,
    borderTopRightRadius: theme.radii.lg + 8,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  inputWrapper: {
    backgroundColor: theme.colors.elevated,
    borderRadius: theme.radii.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  inputWithCurrency: {
    paddingRight: 70,
  },
  textArea: {
    minHeight: 90,
    paddingTop: 14,
  },
  currencyBadge: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{ translateY: -14 }],
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  currencyBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  currencyHint: {
    fontSize: 12,
    color: theme.colors.accent,
    marginTop: 6,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.elevated,
    borderRadius: theme.radii.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerText: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  pickerPlaceholder: {
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  pickerArrow: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  pickerOptions: {
    marginTop: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: theme.colors.primarySoft,
  },
  pickerOptionText: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.elevated,
    borderRadius: theme.radii.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    padding: 16,
    gap: 12,
  },
  locationIcon: {
    fontSize: 24,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  locationPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  coordinatesText: {
    fontSize: 11,
    color: '#059669',
    marginTop: 6,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: theme.radii.lg,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
    fontWeight: '500',
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    padding: 18,
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii.lg + 8,
    borderTopRightRadius: theme.radii.lg + 8,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.lg,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.primary + '30',
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    justifyContent: 'center',
  },
  locationLoadingText: {
    fontSize: 15,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  locationOptionIconBox: {
    marginRight: 12,
  },
  locationOptionInfo: {
    flex: 1,
  },
  locationOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  locationOptionDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    color: theme.colors.textMuted,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: theme.colors.elevated,
    padding: 16,
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  modalButtonSecondaryText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    padding: 16,
    borderRadius: theme.radii.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  mapHeader: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  mapCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  mapHeaderInfo: {
    flex: 1,
  },
  mapHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  mapHeaderDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  mapFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopLeftRadius: theme.radii.lg + 8,
    borderTopRightRadius: theme.radii.lg + 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  mapLocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primarySoft,
    padding: 12,
    borderRadius: theme.radii.lg,
    marginBottom: 12,
    gap: 10,
  },
  mapLocationText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textPrimary,
    fontWeight: '600',
  },
  mapConfirmButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: theme.radii.lg,
    gap: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  mapConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
