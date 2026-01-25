import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
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
import { Ionicons } from '@expo/vector-icons';
import PhoneInput from '@/components/ui/phone-input';
import { validatePhone, fromE164 } from '@/lib/phone-utils';

type Specialty = {
  code: string;
  name_en: string;
  name_ar: string;
  icon: string;
};

type LocationData = {
  latitude: number;
  longitude: number;
  address: string;
};

export default function ApplyAsDoctorScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [showSpecialtyPicker, setShowSpecialtyPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  
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

    setLoading(true);
    
    try {
      // Update profile role
      await supabase
        .from('profiles')
        .update({ role: 'doctor' })
        .eq('id', user.id);

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
          mobile: formData.mobile || null,
          landline: formData.landline || null,
          whatsapp: formData.whatsapp || null,
          is_active: false, // Admin must activate
        });

      Alert.alert(
        'Application Submitted! 🎉',
        'Your application will be reviewed within 2-3 business days. Your clinic will be activated after approval.',
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
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => step > 1 ? setStep(step - 1) : router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← {step > 1 ? 'Back' : 'Cancel'}</Text>
          </TouchableOpacity>
          
          <Text style={styles.icon}>👨‍⚕️</Text>
          <Text style={styles.title}>Apply as Doctor</Text>
          <Text style={styles.subtitle}>Step {step} of 2</Text>
          
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${(step / 2) * 100}%` }]} />
          </View>
        </View>

        {/* Form */}
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
                    style={styles.input}
                    placeholder="$50 or 50,000 LBP"
                    placeholderTextColor="#9CA3AF"
                    value={formData.consultationFee}
                    onChangeText={(value) => updateField('consultationFee', value)}
                  />
                </View>
              </View>

              <PhoneInput
                value={formData.mobile}
                onChangeValue={(e164, local) => updateField('mobile', e164)}
                type="mobile"
                label="Mobile Number"
                placeholder="70 123 456"
                icon="📱"
              />

              <PhoneInput
                value={formData.landline}
                onChangeValue={(e164, local) => updateField('landline', e164)}
                type="landline"
                label="Landline (Optional)"
                placeholder="01 123 456"
                icon="☎️"
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
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Clinic Location</Text>
            
            <TouchableOpacity 
              style={styles.locationOption}
              onPress={getCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <ActivityIndicator color="#2563EB" />
              ) : (
                <>
                  <Text style={styles.locationOptionIcon}>📍</Text>
                  <View style={styles.locationOptionInfo}>
                    <Text style={styles.locationOptionTitle}>Use Current Location</Text>
                    <Text style={styles.locationOptionDesc}>Automatically detect your clinic location</Text>
                  </View>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or enter manually</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Street, City, Country"
                  placeholderTextColor="#9CA3AF"
                  value={formData.clinicAddress}
                  onChangeText={(value) => updateField('clinicAddress', value)}
                  multiline
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButtonSecondary}
                onPress={() => setShowLocationPicker(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalButtonPrimary}
                onPress={() => setShowLocationPicker(false)}
              >
                <Text style={styles.modalButtonPrimaryText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E40AF',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  icon: {
    fontSize: 45,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#BFDBFE',
    marginBottom: 15,
  },
  progressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 3,
  },
  formContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 5,
  },
  stepDesc: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 25,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 15,
  },
  input: {
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  row: {
    flexDirection: 'row',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  pickerText: {
    fontSize: 16,
    color: '#1F2937',
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#6B7280',
  },
  pickerOptions: {
    marginTop: 5,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pickerOption: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerOptionSelected: {
    backgroundColor: '#EFF6FF',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#1F2937',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    padding: 15,
  },
  locationIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  locationPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: '#9CA3AF',
  },
  coordinatesText: {
    fontSize: 12,
    color: '#059669',
    marginTop: 5,
    marginLeft: 5,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
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
  },
  nextButton: {
    backgroundColor: '#2563EB',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  locationOptionIcon: {
    fontSize: 30,
    marginRight: 15,
  },
  locationOptionInfo: {
    flex: 1,
  },
  locationOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  locationOptionDesc: {
    fontSize: 13,
    color: '#6B7280',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    color: '#9CA3AF',
    paddingHorizontal: 10,
    fontSize: 13,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
