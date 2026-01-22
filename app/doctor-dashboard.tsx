import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';

type Appointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  patient_name: string;
  patient_id: string;
  clinic_name: string;
};

type Clinic = {
  id: string;
  clinic_name: string;
  address: string;
  consultation_fee: string;
  is_active: boolean;
  latitude?: number;
  longitude?: number;
  schedule?: ClinicSchedule | null;
  slot_minutes?: number | null;
};

type DoctorData = {
  id: string;
  specialty_code: string;
  specialty_name?: string;
  specialty_name_ar?: string;
  specialty_icon?: string;
  is_approved: boolean;
  rating: number;
  total_reviews: number;
  instagram?: string | null;
  facebook?: string | null;
};

type Profile = {
  full_name: string;
  full_name_ar: string;
  avatar_url: string | null;
};

type BlockedSlot = {
  id: string;
  blocked_date: string;
  time_slot: string;
  clinic_id?: string | null;
  reason?: string;
};

type ClinicHoliday = {
  id: string;
  clinic_id: string;
  holiday_date: string;
  reason?: string | null;
};

type ClinicScheduleDay = {
  start?: string;
  end?: string;
  break_start?: string | null;
  break_end?: string | null;
};

type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

type ClinicSchedule = {
  default?: ClinicScheduleDay;
  weekly_off?: DayKey[];
};

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map(v => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

const minutesToTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const getDayKey = (dateString: string) => {
  const date = new Date(dateString);
  return DAY_KEYS[date.getDay()];
};

const DAY_LABELS: Record<DayKey, string> = {
  sun: 'Sun',
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
};

export default function DoctorDashboardScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t, isRTL } = useI18n();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [doctorData, setDoctorData] = useState<DoctorData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [holidays, setHolidays] = useState<ClinicHoliday[]>([]);
  const [activeTab, setActiveTab] = useState<'appointments' | 'clinics' | 'schedule' | 'chat' | 'profile'>('appointments');
  const [appointmentsLookbackDays, setAppointmentsLookbackDays] = useState(7);
  
  // Add Clinic Modal
  const [showAddClinicModal, setShowAddClinicModal] = useState(false);
  const [newClinic, setNewClinic] = useState({
    clinic_name: '',
    address: '',
    consultation_fee: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });
  const [addingClinic, setAddingClinic] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleClinicId, setScheduleClinicId] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ClinicSchedule>({});
  const [scheduleSlotMinutes, setScheduleSlotMinutes] = useState<number>(30);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [showDoctorSocialModal, setShowDoctorSocialModal] = useState(false);
  const [socialInstagram, setSocialInstagram] = useState('');
  const [socialFacebook, setSocialFacebook] = useState('');
  const [savingSocial, setSavingSocial] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayClinicId, setHolidayClinicId] = useState<string | null>(null);
  const [holidayDate, setHolidayDate] = useState<string | null>(null);
  const [holidayReason, setHolidayReason] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);
  
  // Block Time Modal
  const [showBlockTimeModal, setShowBlockTimeModal] = useState(false);
  const [selectedBlockDate, setSelectedBlockDate] = useState<string | null>(null);
  const [selectedBlockSlots, setSelectedBlockSlots] = useState<string[]>([]);
  const [selectedBlockClinicId, setSelectedBlockClinicId] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockingSlots, setBlockingSlots] = useState(false);
  
  // Reschedule Modal
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState<string | null>(null);
  const [newTime, setNewTime] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  
  // Profile Picture
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [showAvatarConfirmModal, setShowAvatarConfirmModal] = useState(false);
  
  // Language Modal
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  
  // Location Picker Modal
  const [showLocationPickerModal, setShowLocationPickerModal] = useState(false);
  const [locationSearchAddress, setLocationSearchAddress] = useState('');
  const [mapRegion, setMapRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const [mapMarker, setMapMarker] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapSelection, setMapSelection] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  
  // Chat State
  const [chatConversations, setChatConversations] = useState<any[]>([]);
  const [selectedChatConversation, setSelectedChatConversation] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, appointmentsLookbackDays]);

  useEffect(() => {
    if (activeTab === 'chat' && doctorData) {
      fetchDoctorConversations();
    }
  }, [activeTab, doctorData, user]);

  useEffect(() => {
    setSelectedBlockSlots([]);
  }, [selectedBlockDate, selectedBlockClinicId]);

  const dedupeBlockedSlots = (slots: BlockedSlot[]) => {
    const seen = new Set<string>();
    return slots.filter((slot) => {
      const key = `${slot.clinic_id || 'no-clinic'}|${slot.blocked_date}|${slot.time_slot}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const fetchData = async () => {
    if (!user) return;

    try {
      console.log('🔍 Fetching data for user:', user.id);
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, full_name_ar, avatar_url')
        .eq('id', user.id)
        .single();

      console.log('👤 Profile:', profileData, profileError);
      if (profileData) setProfile(profileData);

      // Fetch doctor data
      const { data: doctorResult, error: doctorError } = await supabase
        .from('doctors')
        .select('id, specialty_code, is_approved, rating, total_reviews, instagram, facebook')
        .eq('user_id', user.id)
        .single();

      console.log('👨‍⚕️ Doctor:', doctorResult, doctorError);

      if (doctorResult) {
        // Fetch specialty separately
        const { data: specialtyData } = await supabase
          .from('specialties')
          .select('name_en, name_ar, icon')
          .eq('code', doctorResult.specialty_code)
          .single();

        console.log('🏥 Specialty:', specialtyData);

        setDoctorData({
          id: doctorResult.id,
          specialty_code: doctorResult.specialty_code,
          is_approved: doctorResult.is_approved,
          rating: doctorResult.rating || 0,
          total_reviews: doctorResult.total_reviews || 0,
          specialty_name: specialtyData?.name_en,
          specialty_name_ar: specialtyData?.name_ar,
          specialty_icon: specialtyData?.icon || '🩺',
          instagram: doctorResult.instagram || null,
          facebook: doctorResult.facebook || null,
        });

        // Fetch clinics
        const { data: clinicsData, error: clinicsError } = await supabase
          .from('clinics')
          .select('id, clinic_name, address, consultation_fee, is_active, latitude, longitude, schedule, slot_minutes')
          .eq('doctor_id', doctorResult.id);

        console.log('🏢 Clinics:', clinicsData, clinicsError);
        if (clinicsData) setClinics(clinicsData);
        const clinicIds = clinicsData?.map(c => c.id) || [];
        await fetchClinicHolidays(clinicIds);

        // *** FETCH APPOINTMENTS - WITHOUT DATE FILTER FIRST FOR DEBUGGING ***
        console.log('📅 Fetching appointments for doctor_id:', doctorResult.id);
        
        const { data: allAppointments, error: aptError } = await supabase
          .from('appointments')
          .select('*')
          .eq('doctor_id', doctorResult.id);

        console.log('📅 ALL Appointments (no filter):', allAppointments, aptError);

        // Now fetch with date filter
        const todayDate = new Date();
        const today = todayDate.toISOString().split('T')[0];
        const startDate = new Date(todayDate);
        startDate.setDate(startDate.getDate() - appointmentsLookbackDays);
        const startStr = startDate.toISOString().split('T')[0];
        console.log('📅 Today is:', today);
        
        const { data: appointmentsData, error: aptError2 } = await supabase
          .from('appointments')
          .select('id, appointment_date,time_slot, status, clinic_id, patient_id')
          .eq('doctor_id', doctorResult.id)
          .gte('appointment_date', startStr)
          .lte('appointment_date', today)
          .order('appointment_date', { ascending: false });

        console.log('📅 Filtered appointments:', appointmentsData, aptError2);

        // Use all appointments if filtered is empty but all has data
        const aptsToUse = (appointmentsData && appointmentsData.length > 0) 
          ? appointmentsData 
          : allAppointments?.filter(a => a.appointment_date >= startStr && a.appointment_date <= today) || [];

        console.log('📅 Using appointments:', aptsToUse);

        if (aptsToUse.length > 0) {
          const patientIds = [...new Set(aptsToUse.map(a => a.patient_id).filter(Boolean))];
          const clinicIds = [...new Set(aptsToUse.map(a => a.clinic_id).filter(Boolean))];
          
          console.log('👥 Patient IDs:', patientIds);
          console.log('🏥 Clinic IDs:', clinicIds);
          
          let patientsMap = new Map();
          if (patientIds.length > 0) {
            const { data: patients, error: pError } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', patientIds);
            
            console.log('👥 Patients:', patients, pError);
            patientsMap = new Map(patients?.map(p => [p.id, p]) || []);
          }

          let clinicsMap = new Map();
          if (clinicIds.length > 0) {
            const { data: clinicsList, error: cError } = await supabase
              .from('clinics')
              .select('id, clinic_name')
              .in('id', clinicIds);
            
            console.log('🏢 Clinics for appointments:', clinicsList, cError);
            clinicsMap = new Map(clinicsList?.map(c => [c.id, c]) || []);
          }

          const transformed = aptsToUse.map(apt => {
            const patient = patientsMap.get(apt.patient_id) || {};
            const clinic = clinicsMap.get(apt.clinic_id) || {};
            
            return {
              id: apt.id,
              appointment_date: apt.appointment_date,
              appointment_time: apt.time_slot || '09:00',
              status: apt.status || 'pending',
              patient_name: patient.full_name || 'Patient',
              patient_id: apt.patient_id,
              clinic_name: clinic.clinic_name || 'Clinic',
            };
          });

          console.log('✅ Transformed appointments:', transformed);
          setAppointments(transformed);
        } else {
          console.log('⚠️ No appointments found');
          setAppointments([]);
        }

        // Fetch blocked slots
        try {
          if (clinicIds.length === 0) {
            setBlockedSlots([]);
          } else {
            const { data: blocked } = await supabase
              .from('doctor_blocked_slots')
              .select('id, blocked_date, time_slot, reason, clinic_id')
              .in('clinic_id', clinicIds)
              .gte('blocked_date', today);

            if (blocked) setBlockedSlots(dedupeBlockedSlots(blocked));
          }
        } catch (e) {
          console.log('Blocked slots table may not exist');
        }
      }

    } catch (error) {
      console.error('❌ Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const fetchClinicHolidays = async (clinicIds: string[]) => {
    if (clinicIds.length === 0) {
      setHolidays([]);
      return;
    }
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('clinic_holidays')
        .select('id, clinic_id, holiday_date, reason')
        .in('clinic_id', clinicIds)
        .gte('holiday_date', today)
        .order('holiday_date');

      if (error) {
        console.error('Error fetching clinic holidays:', error);
        return;
      }
      setHolidays(data || []);
    } catch (error) {
      console.error('Error fetching clinic holidays:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.common.error, isRTL ? 'نحتاج إذن الوصول للصور' : 'We need permission to access your photos');
      return;
    }

    try {
      const mediaTypes = ['images'] as any;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes,
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      console.log('Image picker result:', result);

      if (result.canceled) {
        console.log('Image selection canceled');
        return;
      }

      const selectedUri = result.assets?.[0]?.uri;
      if (!selectedUri) {
        Alert.alert(t.common.error, t.doctorDashboard.failedReadImage);
        return;
      }
      console.log('Selected image URI:', selectedUri);
      setSelectedImageUri(selectedUri);
      setShowAvatarConfirmModal(true);
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert(t.common.error, isRTL ? 'حدث خطأ في اختيار الصورة' : 'Error selecting image');
    }
  };

  const uploadProfileImage = async (uri: string) => {
    if (!user) return;
    
    setUploadingImage(true);
    
    try {
      console.log('Starting image upload from URI:', uri);

      const fileName = `${user.id}-${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;

      // Use FileSystem to read the image as base64
      console.log('Reading file with FileSystem...');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      console.log('File read successfully, uploading...');

      // Convert base64 to Uint8Array
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        Alert.alert(
          t.common.error, 
          isRTL ? 'فشل تحميل الصورة. تحقق من اتصالك بالإنترنت' : 'Failed to upload image. Check your internet connection.'
        );
        setUploadingImage(false);
        return;
      }

      console.log('Image uploaded successfully');

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = data?.publicUrl;
      
      if (!publicUrl) {
        Alert.alert(t.common.error, 'Failed to get image URL');
        setUploadingImage(false);
        return;
      }

      console.log('Public URL:', publicUrl);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Update error:', updateError);
        Alert.alert(t.common.error, updateError.message);
        setUploadingImage(false);
        return;
      }

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      Alert.alert(t.common.success, isRTL ? 'تم تحديث الصورة بنجاح' : 'Profile picture updated successfully!');
      setShowAvatarConfirmModal(false);
      setSelectedImageUri(null);
      setUploadingImage(false);

    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert(
        t.common.error, 
        error.message || (isRTL ? 'فشل تحديث الصورة' : 'Failed to upload image')
      );
      setUploadingImage(false);
    }
  };

  const openLocationPicker = async () => {
    setLocationSearchAddress('');
    setMapSelection(null);
    setMapMarker(null);
    setMapRegion(null);
    setShowLocationPickerModal(true);
    const fallbackLat = newClinic.latitude;
    const fallbackLng = newClinic.longitude;
    if (fallbackLat !== null && fallbackLng !== null) {
      await setSelectionFromCoords(fallbackLat, fallbackLng);
      return;
    }
    await getCurrentLocationAndSet(true);
  };

  const buildAddressString = (address: Location.LocationGeocodedAddress) =>
    [address.street, address.district, address.city, address.region, address.country]
      .filter(Boolean)
      .join(', ');

  const setSelectionFromCoords = async (latitude: number, longitude: number) => {
    try {
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const addressString = address
        ? buildAddressString(address)
        : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      setMapSelection({ latitude, longitude, address: addressString });
      setMapMarker({ latitude, longitude });
      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      setMapSelection({ latitude, longitude, address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` });
      setMapMarker({ latitude, longitude });
      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectionFromCoords(latitude, longitude);
  };

  const applySelectedLocation = () => {
    if (!mapSelection) {
      Alert.alert(t.common.error, 'Please choose a location on the map');
      return;
    }
    setNewClinic(prev => ({
      ...prev,
      latitude: mapSelection.latitude,
      longitude: mapSelection.longitude,
      address: mapSelection.address,
    }));
    setShowLocationPickerModal(false);
    Alert.alert(t.common.success, 'Location selected successfully');
  };

  const searchLocation = async () => {
    if (!locationSearchAddress.trim()) {
      Alert.alert(t.common.error, isRTL ? 'Please enter an address to search' : 'Please enter an address to search');
      return;
    }

    try {
      const results = await Location.geocodeAsync(locationSearchAddress);
      if (results.length === 0) {
        Alert.alert(t.common.error, isRTL ? 'Address not found' : 'Address not found');
        return;
      }

      const { latitude, longitude } = results[0];
      await setSelectionFromCoords(latitude, longitude);
    } catch (error) {
      Alert.alert(t.common.error, isRTL ? 'Error searching for location' : 'Error searching for location');
    }
  };

  const getCurrentLocationAndSet = async (keepOpen = false) => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(t.common.error, t.doctorApp.locationServicesDisabled);
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t.common.error, t.doctorApp.locationPermissionMsg);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      await setSelectionFromCoords(location.coords.latitude, location.coords.longitude);

      if (!keepOpen) {
        setShowLocationPickerModal(false);
        Alert.alert(t.common.success, isRTL ? 'Current location set successfully' : 'Current location set successfully');
      }
    } catch (error) {
      Alert.alert(t.common.error, t.doctorApp.locationError);
    }
  };

  const fetchDoctorConversations = async () => {
    if (!user || !doctorData) return;

    try {
      console.log('🔍 Fetching conversations for doctor:', user.id);

      // Step 1: Get all appointments for this doctor
      const { data: appointments, error: aptError } = await supabase
        .from('appointments')
        .select('id, patient_id, status')
        .eq('doctor_id', doctorData.id)
        .in('status', ['confirmed', 'completed', 'pending']);

      console.log('📅 Doctor appointments:', appointments, aptError);

      if (!appointments || appointments.length === 0) {
        setChatConversations([]);
        return;
      }

      // Step 2: Get unique patient IDs
      const patientIds = [...new Set(appointments.map(a => a.patient_id).filter(Boolean))];
      console.log('👥 Patient IDs:', patientIds);

      if (patientIds.length === 0) {
        setChatConversations([]);
        return;
      }

      // Step 3: Fetch patient profiles
      const { data: patients, error: patError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', patientIds);

      console.log('👥 Patients:', patients, patError);

      const patientsMap = new Map(patients?.map(p => [p.id, p]) || []);

      // Step 4: Build conversations
      const conversationsData: any[] = [];
      const seenPatients = new Set();

      for (const apt of appointments) {
        if (!apt.patient_id || seenPatients.has(apt.patient_id)) continue;
        seenPatients.add(apt.patient_id);

        const patient = patientsMap.get(apt.patient_id);
        if (!patient) continue;

        conversationsData.push({
          id: `conv_doc_${user.id}_${apt.patient_id}`,
          patient_id: apt.patient_id,
          patient_name: patient.full_name,
          last_message: isRTL ? 'اضغط لفتح المحادثة' : 'Tap to open chat',
          last_message_time: '',
          unread_count: 0,
        });
      }

      console.log('💬 Conversations:', conversationsData);
      setChatConversations(conversationsData);

      // Step 5: Fetch last messages for each conversation
      for (const conv of conversationsData) {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${conv.patient_id}),and(sender_id.eq.${conv.patient_id},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastMsg) {
          conv.last_message = lastMsg.content.substring(0, 50) + (lastMsg.content.length > 50 ? '...' : '');
          conv.last_message_time = new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      }

      setChatConversations([...conversationsData]);
    } catch (error) {
      console.error('❌ Error:', error);
    }
  };

  const fetchDoctorChatMessages = async (patientId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${patientId}),and(sender_id.eq.${patientId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.log('Messages error:', error);
        setChatMessages([]);
        return;
      }

      if (data) {
        setChatMessages(data.map(msg => ({
          id: msg.id,
          sender_id: msg.sender_id,
          content: msg.content,
          created_at: msg.created_at,
          is_mine: msg.sender_id === user.id,
        })));
      } else {
        setChatMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      setChatMessages([]);
    }
  };

  const sendDoctorMessage = async () => {
    if (!newChatMessage.trim() || !selectedChatConversation || !user) return;

    setSendingMessage(true);
    const messageContent = newChatMessage.trim();
    setNewChatMessage('');

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedChatConversation.patient_id,
          content: messageContent,
        })
        .select()
        .single();

      if (error) {
        console.log('Send error:', error);
        const tempMsg = {
          id: `temp_${Date.now()}`,
          sender_id: user.id,
          content: messageContent,
          created_at: new Date().toISOString(),
          is_mine: true,
        };
        setChatMessages(prev => [...prev, tempMsg]);
      } else if (data) {
        setChatMessages(prev => [...prev, {
          id: data.id,
          sender_id: data.sender_id,
          content: data.content,
          created_at: data.created_at,
          is_mine: true,
        }]);
      }
    } catch (error) {
      console.error('Error sending:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleAddClinic = async () => {
    if (!newClinic.clinic_name.trim()) {
      Alert.alert(t.common.error, t.doctorApp.enterClinicName);
      return;
    }
    if (!newClinic.address.trim()) {
      Alert.alert(t.common.error, t.doctorApp.setClinicLocation);
      return;
    }
    if (!doctorData?.id) return;

    setAddingClinic(true);
    
    const { error } = await supabase
      .from('clinics')
      .insert({
        doctor_id: doctorData.id,
        clinic_name: newClinic.clinic_name,
        address: newClinic.address,
        latitude: newClinic.latitude,
        longitude: newClinic.longitude,
        consultation_fee: newClinic.consultation_fee || null,
        is_active: false,
      });

    setAddingClinic(false);

    if (error) {
      Alert.alert(t.common.error, error.message);
    } else {
      Alert.alert(t.common.success, t.doctorApp.clinicActivationNote);
      setShowAddClinicModal(false);
      setNewClinic({ clinic_name: '', address: '', consultation_fee: '', latitude: null, longitude: null });
      fetchData();
    }
  };

  const handleDeactivateClinic = async (clinicId: string) => {
    Alert.alert(
      t.doctorDashboard.deactivateClinic,
      t.doctorDashboard.deactivateClinicConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.confirm,
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('clinics')
              .update({ is_active: false })
              .eq('id', clinicId);

            if (!error) {
              fetchData();
              Alert.alert(t.common.success, t.doctorDashboard.clinicDeactivated);
            }
          },
        },
      ]
    );
  };

  const openScheduleModal = (clinic: Clinic) => {
    setScheduleClinicId(clinic.id);
    setScheduleDraft(clinic.schedule || {});
    const raw = clinic.slot_minutes ?? 30;
    setScheduleSlotMinutes(Math.min(120, Math.max(20, raw)));
    setShowScheduleModal(true);
  };

  const updateScheduleDefault = (
    field: keyof ClinicScheduleDay,
    value: string
  ) => {
    setScheduleDraft(prev => ({
      ...prev,
      default: {
        ...(prev.default || {}),
        [field]: value.trim(),
      },
    }));
  };

  const toggleWeeklyOff = (day: DayKey) => {
    setScheduleDraft(prev => {
      const current = prev.weekly_off || [];
      const next = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day];
      return { ...prev, weekly_off: next };
    });
  };

  const handleSaveSchedule = async () => {
    if (!scheduleClinicId) return;
    setSavingSchedule(true);
    try {
      const clamped = Math.min(120, Math.max(20, scheduleSlotMinutes || 30));
      const { error } = await supabase
        .from('clinics')
        .update({
          schedule: scheduleDraft,
          slot_minutes: clamped,
        })
        .eq('id', scheduleClinicId);

      if (error) {
        Alert.alert(t.common.error, error.message);
        return;
      }

      setClinics(prev =>
        prev.map(c =>
          c.id === scheduleClinicId
            ? { ...c, schedule: scheduleDraft, slot_minutes: clamped }
            : c
        )
      );
      setShowScheduleModal(false);
    } finally {
      setSavingSchedule(false);
    }
  };

  const openDoctorSocialModal = () => {
    setSocialInstagram(doctorData?.instagram || '');
    setSocialFacebook(doctorData?.facebook || '');
    setShowDoctorSocialModal(true);
  };

  const handleSaveSocial = async () => {
    if (!doctorData?.id) return;
    const cleanedInstagram = socialInstagram.trim();
    const cleanedFacebook = socialFacebook.trim();
    setSavingSocial(true);
    try {
      const { error } = await supabase
        .from('doctors')
        .update({
          instagram: cleanedInstagram || null,
          facebook: cleanedFacebook || null,
        })
        .eq('id', doctorData.id);

      if (error) {
        Alert.alert(t.common.error, error.message);
        return;
      }

      setDoctorData(prev =>
        prev
          ? { ...prev, instagram: cleanedInstagram || null, facebook: cleanedFacebook || null }
          : prev
      );
      setShowDoctorSocialModal(false);
    } finally {
      setSavingSocial(false);
    }
  };


  const handleUpdateAppointmentStatus = async (appointmentId: string, newStatus: string, patientId: string) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', appointmentId);

    if (error) {
      Alert.alert(t.common.error, error.message);
    } else {
      fetchData();
      const statusMsg = newStatus === 'confirmed' 
        ? (isRTL ? 'تم تأكيد الموعد' : 'Appointment confirmed')
        : (isRTL ? 'تم إلغاء الموعد' : 'Appointment cancelled');
      Alert.alert(t.common.success, statusMsg);
    }
  };

  // Block Time Slots Functions
  const openBlockTimeModal = () => {
    const defaultClinicId =
      clinics.find(c => c.is_active)?.id || clinics[0]?.id || null;
    setSelectedBlockDate(null);
    setSelectedBlockSlots([]);
    setSelectedBlockClinicId(defaultClinicId);
    setBlockReason('');
    setShowBlockTimeModal(true);
  };

  const getClinicById = (clinicId: string | null) =>
    clinics.find(c => c.id === clinicId) || null;

  const getClinicName = (clinicId: string | null | undefined) =>
    clinics.find(c => c.id === clinicId)?.clinic_name || null;

  const isHoliday = (clinicId: string | null, dateString: string) =>
    holidays.some(h => h.clinic_id === clinicId && h.holiday_date === dateString);

  const getClinicSlotMinutes = (clinic: Clinic | null) => {
    const raw = clinic?.slot_minutes ?? 30;
    return Math.min(120, Math.max(20, raw));
  };

  const getScheduleForDate = (clinic: Clinic | null, dateString: string) => {
    if (!clinic?.schedule?.default) return null;
    const dayKey = getDayKey(dateString);
    const weeklyOff = clinic.schedule.weekly_off || [];
    if (weeklyOff.includes(dayKey)) return null;
    return clinic.schedule.default;
  };

  const generateSlotsForClinicDate = (clinicId: string | null, dateString: string) => {
    if (isHoliday(clinicId, dateString)) return [];
    const clinic = getClinicById(clinicId);
    const schedule = getScheduleForDate(clinic, dateString);
    if (!schedule?.start || !schedule?.end) return [];

    const startMin = timeToMinutes(schedule.start);
    const endMin = timeToMinutes(schedule.end);
    if (startMin === null || endMin === null || endMin <= startMin) return [];

    const slotMinutes = getClinicSlotMinutes(clinic);
    const breakStart = schedule.break_start ? timeToMinutes(schedule.break_start) : null;
    const breakEnd = schedule.break_end ? timeToMinutes(schedule.break_end) : null;

    const slots: string[] = [];
    for (let t = startMin; t + slotMinutes <= endMin; t += slotMinutes) {
      const slotEnd = t + slotMinutes;
      if (breakStart !== null && breakEnd !== null) {
        if (t < breakEnd && slotEnd > breakStart) continue;
      }
      slots.push(minutesToTime(t));
    }
    return slots;
  };

  const getNextDays = (count = 14) => {
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < count; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        month: date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short' }),
      });
    }
    return days;
  };

  const toggleBlockSlot = (slot: string) => {
    if (selectedBlockSlots.includes(slot)) {
      setSelectedBlockSlots(selectedBlockSlots.filter(s => s !== slot));
    } else {
      setSelectedBlockSlots([...selectedBlockSlots, slot]);
    }
  };

  const handleBlockSlots = async () => {
    if (!selectedBlockDate || selectedBlockSlots.length === 0 || !selectedBlockClinicId) {
      Alert.alert(t.common.error, isRTL ? 'اختر التاريخ والوقت' : 'Please select date and time slots');
      return;
    }
    if (!doctorData?.id) return;

    setBlockingSlots(true);

    try {
      const existingKeys = new Set(
        blockedSlots
          .filter(s => s.blocked_date === selectedBlockDate && s.clinic_id === selectedBlockClinicId)
          .map(s => `${s.blocked_date}|${s.time_slot}`)
      );

      const slotsToInsert = selectedBlockSlots
        .filter(slot => !existingKeys.has(`${selectedBlockDate}|${slot}`))
        .map(slot => ({
        doctor_id: doctorData.id,
        clinic_id: selectedBlockClinicId,
        blocked_date: selectedBlockDate,
        time_slot: slot,
        reason: blockReason || null,
      }));

      if (slotsToInsert.length === 0) {
        Alert.alert(t.common.success, isRTL ? 'تم حظر كل الأوقات المحددة مسبقاً' : 'All selected slots are already blocked.');
        setBlockingSlots(false);
        return;
      }

      const { error } = await supabase
        .from('doctor_blocked_slots')
        .insert(slotsToInsert);

      if (error) {
        Alert.alert(t.common.error, error.message);
      } else {
        Alert.alert(t.common.success, isRTL ? 'تم حظر المواعيد بنجاح' : 'Time slots blocked successfully');
        setShowBlockTimeModal(false);
        fetchData();
      }
    } catch (error: any) {
      Alert.alert(t.common.error, error.message);
    } finally {
      setBlockingSlots(false);
    }
  };

  const handleUnblockSlot = async (slotId: string) => {
    Alert.alert(
      isRTL ? 'إلغاء الحظر' : 'Unblock Slot',
      isRTL ? 'هل تريد إلغاء حظر هذا الوقت؟' : 'Do you want to unblock this time slot?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.confirm,
          onPress: async () => {
            const { error } = await supabase
              .from('doctor_blocked_slots')
              .delete()
              .eq('id', slotId);

            if (!error) fetchData();
          },
        },
      ]
    );
  };

  const openHolidayModal = () => {
    const defaultClinicId =
      clinics.find(c => c.is_active)?.id || clinics[0]?.id || null;
    setHolidayClinicId(defaultClinicId);
    setHolidayDate(null);
    setHolidayReason('');
    setShowHolidayModal(true);
  };

  const handleAddHoliday = async () => {
    if (!holidayClinicId || !holidayDate) {
      Alert.alert(t.common.error, t.doctorDashboard.selectClinicAndDateError);
      return;
    }
    setSavingHoliday(true);
    try {
      const { error } = await supabase
        .from('clinic_holidays')
        .insert({
          clinic_id: holidayClinicId,
          holiday_date: holidayDate,
          reason: holidayReason || null,
        });
      if (error) {
        Alert.alert(t.common.error, error.message);
        return;
      }
      await fetchClinicHolidays(clinics.map(c => c.id));
      setShowHolidayModal(false);
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleRemoveHoliday = async (holidayId: string) => {
    const { error } = await supabase
      .from('clinic_holidays')
      .delete()
      .eq('id', holidayId);
    if (!error) {
      await fetchClinicHolidays(clinics.map(c => c.id));
    }
  };

  // Reschedule Functions
  const openRescheduleModal = (apt: Appointment) => {
    setRescheduleAppointment(apt);
    setNewDate(null);
    setNewTime(null);
    setShowRescheduleModal(true);
  };

  const handleReschedule = async () => {
    if (!newDate || !rescheduleAppointment) {
      Alert.alert(t.common.error, isRTL ? 'اختر التاريخ الجديد' : 'Please select new date');
      return;
    }

    setRescheduling(true);

    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          appointment_date: newDate,
          status: 'pending'
        })
        .eq('id', rescheduleAppointment.id);

      if (error) {
        Alert.alert(t.common.error, error.message);
      } else {
        Alert.alert(t.common.success, isRTL ? 'تم إعادة جدولة الموعد' : 'Appointment rescheduled');
        setShowRescheduleModal(false);
        fetchData();
      }
    } catch (error: any) {
      Alert.alert(t.common.error, error.message);
    } finally {
      setRescheduling(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      t.profile.signOut,
      t.profile.signOutConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        { 
          text: t.common.confirm, 
          style: 'destructive', 
          onPress: async () => {
            await signOut();
            router.replace('/');
          }
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (dateString === todayStr) return t.appointments.today;
    
    return date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes = '00'] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? (isRTL ? 'م' : 'PM') : (isRTL ? 'ص' : 'AM');
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes.padStart(2, '0')} ${ampm}`;
  };

  const getLocalizedDayLabel = (dayKey: DayKey) => {
    const dayIndex = DAY_KEYS.indexOf(dayKey);
    const baseDate = new Date(2024, 0, 7 + dayIndex);
    return baseDate.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { weekday: 'short' });
  };

  const renderClinicWorkingHours = (clinic: Clinic) => {
    const schedule = clinic.schedule?.default;
    const weeklyOff = clinic.schedule?.weekly_off || [];
    const hasSchedule = Boolean(schedule?.start && schedule?.end);
    const slotMinutes = getClinicSlotMinutes(clinic);

    return (
      <View key={clinic.id} style={styles.clinicCard}>
        <Text style={[styles.clinicName, isRTL && styles.textRight]}>{clinic.clinic_name}</Text>
        {hasSchedule ? (
          <>
            <Text style={[styles.scheduleInfoText, isRTL && styles.textRight]}>
              {t.common.workingHours}: {formatTime(schedule?.start || '00:00')} - {formatTime(schedule?.end || '00:00')}
            </Text>
            {schedule?.break_start && schedule?.break_end && (
              <Text style={[styles.scheduleInfoText, isRTL && styles.textRight]}>
                {t.common.breakTime}: {formatTime(schedule.break_start)} - {formatTime(schedule.break_end)}
              </Text>
            )}
            <Text style={[styles.scheduleInfoText, isRTL && styles.textRight]}>
              {t.doctorDashboard.slotMinutesLabel}: {slotMinutes}
            </Text>
            {weeklyOff.length > 0 && (
              <Text style={[styles.scheduleInfoText, isRTL && styles.textRight]}>
                {t.common.weeklyOff}: {weeklyOff.map(getLocalizedDayLabel).join(', ')}
              </Text>
            )}
          </>
        ) : (
          <Text style={[styles.scheduleInfoText, isRTL && styles.textRight]}>
            {t.common.notAvailable}
          </Text>
        )}
      </View>
    );
  };

  const blockSlots =
    selectedBlockDate && selectedBlockClinicId
      ? generateSlotsForClinicDate(selectedBlockClinicId, selectedBlockDate)
      : [];

  if (loading) {
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
        <TouchableOpacity 
          style={styles.switchButton}
          onPress={() => router.replace('/(patient-tabs)/home')}
        >
          <Text style={styles.switchButtonText}>👤 {t.doctorDashboard.patientMode}</Text>
        </TouchableOpacity>

        <Text style={styles.greeting}>{t.doctorDashboard.title}</Text>
        <Text style={styles.doctorName}>
          {isRTL ? `د. ${profile?.full_name_ar || profile?.full_name}` : `Dr. ${profile?.full_name}`}
        </Text>
        <Text style={styles.specialty}>
          {doctorData?.specialty_icon} {isRTL ? doctorData?.specialty_name_ar : doctorData?.specialty_name}
        </Text>

        {!doctorData?.is_approved && (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerText}>⏳ {t.doctorDashboard.accountPendingApproval}</Text>
          </View>
        )}

        <View style={styles.statsRow}>

           <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {appointments.filter(a => a.appointment_date === new Date().toISOString().split('T')[0]).length}
            </Text>
            <Text style={styles.statLabel}>{t.appointments.today}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{appointments.filter(a => a.status === 'pending').length}</Text>
            <Text style={styles.statLabel}>{isRTL ? 'معلق' : 'Pending'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{clinics.filter(c => c.is_active).length}</Text>
            <Text style={styles.statLabel}>{isRTL ? 'عيادات' : 'Clinics'}</Text>
          </View>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'appointments' && styles.tabActive]}
          onPress={() => setActiveTab('appointments')}
        >
          <Text style={styles.tabEmoji}>📅</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'schedule' && styles.tabActive]}
          onPress={() => setActiveTab('schedule')}
        >
          <Text style={styles.tabEmoji}>🕐</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'clinics' && styles.tabActive]}
          onPress={() => setActiveTab('clinics')}
        >
          <Text style={styles.tabEmoji}>🏥</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={styles.tabEmoji}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={styles.tabEmoji}>👤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Appointments Tab */}
        {activeTab === 'appointments' && (
          <>
            <Text style={[styles.tabTitle, isRTL && styles.textRight]}>
              {t.doctorDashboard.appointments} ({appointments.length})
            </Text>
            {appointments.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📅</Text>
                <Text style={styles.emptyTitle}>{t.doctorDashboard.noAppointments}</Text>
                <Text style={styles.emptyText}>{t.doctorDashboard.noAppointmentsDesc}</Text>
              </View>
            ) : (
              appointments.map((apt) => (
                <View key={apt.id} style={styles.appointmentCard}>
                  <View style={[styles.appointmentHeader, isRTL && styles.rowReverse]}>
                    <View style={isRTL ? styles.alignRight : undefined}>
                      <Text style={[styles.patientName, isRTL && styles.textRight]}>{apt.patient_name}</Text>
                      <Text style={[styles.clinicText, isRTL && styles.textRight]}>🏥 {apt.clinic_name}</Text>
                    </View>
                    <View style={[styles.dateBadge, apt.appointment_date === new Date().toISOString().split('T')[0] && styles.todayBadge]}>
                      <Text style={styles.dateText}>{formatDate(apt.appointment_date)}</Text>
                    </View>
                    <View style={styles.timeBadge}>
          <Text style={styles.timeText}>🕒 {apt.appointment_time}</Text>
        </View>
                  </View>
                  
                  <View style={styles.appointmentActions}>
                    {apt.status === 'pending' && (
                      <>
                        <TouchableOpacity 
                          style={styles.confirmBtn}
                          onPress={() => handleUpdateAppointmentStatus(apt.id, 'confirmed', apt.patient_id)}
                        >
                          <Text style={styles.confirmBtnText}>✓ {isRTL ? 'تأكيد' : 'Confirm'}</Text>
                          </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.rescheduleBtn}
                          onPress={() => openRescheduleModal(apt)}
                        >
                        <Text style={styles.scheduleBtnText}>{t.doctorDashboard.scheduleClinic}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.cancelBtn}
                          onPress={() => handleUpdateAppointmentStatus(apt.id, 'cancelled', apt.patient_id)}
                        >
                          <Text style={styles.cancelBtnText}>✕</Text>
                        </TouchableOpacity>


                      </>
                    )}
                    {apt.status === 'confirmed' && (
                      <>
                        <View style={styles.confirmedBadge}>
                          <Text style={styles.confirmedText}>✓ {t.appointments.confirmed}</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.rescheduleBtn}
                          onPress={() => openRescheduleModal(apt)}
                        >
                          <Text style={styles.rescheduleBtnText}>📅</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {apt.status === 'cancelled' && (
                      <View style={styles.cancelledBadge}>
                        <Text style={styles.cancelledText}>✕ {isRTL ? 'ملغي' : 'Cancelled'}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}

            {appointments.length > 0 && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={() => setAppointmentsLookbackDays((prev) => prev + 7)}
              >
                <Text style={styles.loadMoreText}>{t.appointments.loadMore}</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <>
            <View style={[styles.tabHeader, isRTL && styles.rowReverse]}>
              <Text style={[styles.tabTitle, isRTL && styles.textRight]}>
                {isRTL ? 'إدارة الجدول' : 'Schedule'}
              </Text>
              <View style={styles.tabActions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={openHolidayModal}>
                  <Text style={styles.secondaryButtonText}>+ {t.doctorDashboard.addHoliday}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addButton} onPress={openBlockTimeModal}>
                  <Text style={styles.addButtonText}>+ {t.doctorDashboard.blockTime}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.tabTitle, isRTL && styles.textRight]}>
              {t.common.workingHours}
            </Text>
            {clinics.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>ÐY?¾</Text>
                <Text style={styles.emptyTitle}>{t.doctorDashboard.noClinics}</Text>
                <Text style={styles.emptyText}>{t.doctorDashboard.noClinicsDesc}</Text>
              </View>
            ) : (
              clinics.map(renderClinicWorkingHours)
            )}

            <View style={styles.sectionDivider} />

            {blockedSlots.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🕐</Text>
                <Text style={styles.emptyTitle}>{isRTL ? 'لا أوقات محظورة' : 'No Blocked Times'}</Text>
                <Text style={styles.emptyText}>
                  {isRTL ? 'جميع أوقاتك متاحة' : 'All time slots available'}
                </Text>
              </View>
            ) : (
              clinics.map((clinic) => {
                const clinicSlots = blockedSlots.filter(slot => slot.clinic_id === clinic.id);
                if (clinicSlots.length === 0) return null;
                return (
                  <View key={clinic.id}>
                    <Text style={[styles.sectionSubtitle, isRTL && styles.textRight]}>
                      {clinic.clinic_name}
                    </Text>
                    {clinicSlots.map((slot) => (
                      <View key={slot.id} style={styles.blockedSlotCard}>
                        <View style={[styles.blockedSlotInfo, isRTL && styles.rowReverse]}>
                          <View>
                            <Text style={styles.blockedDate}>📅 {formatDate(slot.blocked_date)}</Text>
                            <Text style={styles.blockedTime}>🕐 {formatTime(slot.time_slot)}</Text>
                            {slot.reason && <Text style={styles.blockedReason}>💬 {slot.reason}</Text>}
                          </View>
                          <TouchableOpacity style={styles.unblockBtn} onPress={() => handleUnblockSlot(slot.id)}>
                            <Text style={styles.unblockBtnText}>{isRTL ? 'إلغاء' : 'Unblock'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                );
              })
            )}

            <View style={styles.sectionDivider} />
            <Text style={[styles.tabTitle, isRTL && styles.textRight]}>
              {t.doctorDashboard.holidays}
            </Text>
            {holidays.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>??</Text>
                <Text style={styles.emptyTitle}>{t.doctorDashboard.noHolidaysTitle}</Text>
                <Text style={styles.emptyText}>
                  {t.doctorDashboard.noHolidaysDesc}
                </Text>
              </View>
            ) : (
              holidays.map((holiday) => (
                <View key={holiday.id} style={styles.blockedSlotCard}>
                  <View style={[styles.blockedSlotInfo, isRTL && styles.rowReverse]}>
                    <View>
                      <Text style={styles.blockedDate}>?? {formatDate(holiday.holiday_date)}</Text>
                      {getClinicName(holiday.clinic_id) && (
                        <Text style={styles.blockedReason}>?? {getClinicName(holiday.clinic_id)}</Text>
                      )}
                      {holiday.reason && <Text style={styles.blockedReason}>?? {holiday.reason}</Text>}
                    </View>
                    <TouchableOpacity style={styles.unblockBtn} onPress={() => handleRemoveHoliday(holiday.id)}>
                      <Text style={styles.unblockBtnText}>{t.doctorDashboard.removeHoliday}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}


        {/* Clinics Tab */}
        {activeTab === 'clinics' && (
          <>
            <View style={[styles.tabHeader, isRTL && styles.rowReverse]}>
              <Text style={[styles.tabTitle, isRTL && styles.textRight]}>{t.doctorDashboard.myClinics}</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => setShowAddClinicModal(true)}>
                  <Text style={styles.addButtonText}>+ {isRTL ? 'إضافة' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
            
            {clinics.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏥</Text>
                <Text style={styles.emptyTitle}>{t.doctorDashboard.noClinics}</Text>
                <Text style={styles.emptyText}>{t.doctorDashboard.noClinicsDesc}</Text>
              </View>
            ) : (
              clinics.map((clinic) => (
                <View key={clinic.id} style={styles.clinicCard}>
                  <View style={[styles.clinicHeader, isRTL && styles.rowReverse]}>
                    <Text style={[styles.clinicName, isRTL && styles.textRight]}>{clinic.clinic_name}</Text>
                    <View style={[styles.statusBadge, clinic.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                      <Text style={[styles.statusText, !clinic.is_active && { color: '#92400E' }]}>
                        {clinic.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'معلق' : 'Pending')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.clinicAddress}>📍 {clinic.address}</Text>
                  {clinic.consultation_fee && (
                    <Text style={styles.clinicFee}>💰 {clinic.consultation_fee}</Text>
                  )}
                  {clinic.is_active && (
                    <>
                      <TouchableOpacity 
                        style={styles.scheduleBtn}
                        onPress={() => openScheduleModal(clinic)}
                      >
                        <Text style={styles.scheduleBtnText}>{t.doctorDashboard.scheduleClinic}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.deactivateBtn}
                        onPress={() => handleDeactivateClinic(clinic.id)}
                      >
                        <Text style={styles.deactivateBtnText}>{t.doctorDashboard.deactivateClinic}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ))
            )}
          </>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <>
            <Text style={[styles.tabTitle, isRTL && styles.textRight]}>💬 {isRTL ? 'الرسائل' : 'Messages'}</Text>
            
            {!selectedChatConversation ? (
              // Conversations List
              chatConversations.length === 0 ? (
                <View style={styles.chatPlaceholder}>
                  <Text style={styles.chatPlaceholderEmoji}>💬</Text>
                  <Text style={styles.chatPlaceholderText}>
                    {isRTL ? 'لا توجد رسائل حالياً' : 'No messages yet'}
                  </Text>
                  <Text style={styles.chatPlaceholderSubtext}>
                    {isRTL ? 'ستظهر رسائل المرضى هنا' : 'Patient messages will appear here'}
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.conversationsList} showsVerticalScrollIndicator={false}>
                  {chatConversations.map((conv) => (
                    <TouchableOpacity 
                      key={conv.id}
                      style={styles.conversationCard}
                      onPress={() => {
                        setSelectedChatConversation(conv);
                        fetchDoctorChatMessages(conv.patient_id);
                      }}
                    >
                      <View style={[styles.conversationRow, isRTL && styles.rowReverse]}>
                        <View style={styles.avatarContainer}>
                          <Text style={styles.avatarEmoji}>👤</Text>
                        </View>
                        <View style={[styles.conversationInfo, isRTL && styles.alignRight]}>
                          <Text style={[styles.doctorName, isRTL && styles.textRight]}>{conv.patient_name}</Text>
                          <Text style={[styles.lastMessage, isRTL && styles.textRight]} numberOfLines={1}>
                            {conv.last_message}
                          </Text>
                        </View>
                        {conv.last_message_time && (
                          <Text style={styles.messageTime}>{conv.last_message_time}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )
            ) : (
              // Chat View
              <View style={styles.chatViewContainer}>
                <TouchableOpacity 
                  style={styles.backButton}
                  onPress={() => {
                    setSelectedChatConversation(null);
                    setChatMessages([]);
                  }}
                >
                  <Text style={styles.backButtonText}>{isRTL ? '→' : '←'}</Text>
                </TouchableOpacity>
                <Text style={[styles.chatPatientName, isRTL && styles.textRight]}>
                  {selectedChatConversation.patient_name}
                </Text>
                
                <ScrollView style={styles.messagesScrollView} showsVerticalScrollIndicator={false}>
                  {chatMessages.length === 0 ? (
                    <View style={styles.emptyChat}>
                      <Text style={styles.emptyChatText}>
                        {isRTL ? 'لا توجد رسائل' : 'No messages'}
                      </Text>
                    </View>
                  ) : (
                    chatMessages.map((msg) => (
                      <View 
                        key={msg.id}
                        style={[
                          styles.messageBubble,
                          msg.is_mine ? styles.myMessage : styles.theirMessage,
                        ]}
                      >
                        <Text style={[
                          styles.messageText,
                          msg.is_mine ? styles.myMessageText : styles.theirMessageText
                        ]}>
                          {msg.content}
                        </Text>
                        <Text style={[
                          styles.messageTime,
                          msg.is_mine ? styles.myMessageTime : styles.theirMessageTime
                        ]}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    ))
                  )}
                </ScrollView>

                <View style={[styles.inputRow, isRTL && styles.rowReverse]}>
                  <TextInput
                    style={[styles.textInput, isRTL && styles.textRight]}
                    placeholder={isRTL ? 'اكتب رسالة...' : 'Type a message...'}
                    placeholderTextColor="#9CA3AF"
                    value={newChatMessage}
                    onChangeText={setNewChatMessage}
                    multiline
                    maxLength={1000}
                  />
                  <TouchableOpacity 
                    style={[styles.sendBtn, !newChatMessage.trim() && styles.sendBtnDisabled]}
                    onPress={sendDoctorMessage}
                    disabled={!newChatMessage.trim() || sendingMessage}
                  >
                    {sendingMessage ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.sendBtnText}>{isRTL ? '←' : '→'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <>
            <Text style={[styles.tabTitle, isRTL && styles.textRight]}>{t.profile.title}</Text>
            
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

            <TouchableOpacity style={styles.scheduleBtn} onPress={openDoctorSocialModal}>
              <Text style={styles.scheduleBtnText}>Social Media</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <Text style={styles.signOutText}>🚪 {t.profile.signOut}</Text>
            </TouchableOpacity>
          </>
        )}

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
              <Text style={styles.emptyText}>{t.doctorDashboard.failedReadImage}</Text>
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

      {/* Add Clinic Modal */}
      <Modal visible={showAddClinicModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.doctorDashboard.addNewClinic}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.doctorApp.clinicName} *</Text>
              <TextInput
                style={styles.input}
                placeholder={t.doctorApp.clinicNamePlaceholder}
                placeholderTextColor="#9CA3AF"
                value={newClinic.clinic_name}
                onChangeText={(text) => setNewClinic(prev => ({ ...prev, clinic_name: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.doctorApp.clinicLocation} *</Text>
              <TouchableOpacity style={styles.locationButton} onPress={openLocationPicker}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={newClinic.address ? styles.locationText : styles.locationPlaceholder}>
                  {newClinic.address || t.doctorApp.selectLocation}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.doctorApp.consultationFee}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.doctorApp.feePlaceholder}
                placeholderTextColor="#9CA3AF"
                value={newClinic.consultation_fee}
                onChangeText={(text) => setNewClinic(prev => ({ ...prev, consultation_fee: text }))}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowAddClinicModal(false)}>
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButtonPrimary, addingClinic && styles.buttonDisabled]}
                onPress={handleAddClinic}
                disabled={addingClinic}
              >
                {addingClinic ? <ActivityIndicator color="white" size="small" /> : (
                  <Text style={styles.modalButtonPrimaryText}>{t.common.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Block Time Modal */}
      {/* Clinic Schedule Modal */}
      <Modal visible={showScheduleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>{t.doctorDashboard.clinicScheduleTitle}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.doctorDashboard.slotMinutesLabel}</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={String(scheduleSlotMinutes)}
                onChangeText={(value) => setScheduleSlotMinutes(parseInt(value || '0', 10))}
                placeholder={t.doctorDashboard.slotMinutesExample}
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.helperText}>{t.doctorDashboard.slotMinutesHelp}</Text>
            </View>

            <View style={styles.scheduleSection}>
              <Text style={styles.label}>{t.doctorDashboard.defaultWorkingHours}</Text>
              <View style={styles.scheduleRow}>
                <Text style={styles.scheduleLabel}>{t.doctorDashboard.startLabel}</Text>
                <TextInput
                  style={styles.scheduleInput}
                  placeholder="09:00"
                  placeholderTextColor="#9CA3AF"
                  value={scheduleDraft.default?.start || ''}
                  onChangeText={(value) => updateScheduleDefault('start', value)}
                />
                <Text style={styles.scheduleLabel}>{t.doctorDashboard.endLabel}</Text>
                <TextInput
                  style={styles.scheduleInput}
                  placeholder="17:00"
                  placeholderTextColor="#9CA3AF"
                  value={scheduleDraft.default?.end || ''}
                  onChangeText={(value) => updateScheduleDefault('end', value)}
                />
              </View>

              <View style={styles.scheduleRow}>
                <Text style={styles.scheduleLabel}>{t.doctorDashboard.breakLabel}</Text>
                <TextInput
                  style={styles.scheduleInput}
                  placeholder="13:00"
                  placeholderTextColor="#9CA3AF"
                  value={scheduleDraft.default?.break_start || ''}
                  onChangeText={(value) => updateScheduleDefault('break_start', value)}
                />
                <Text style={styles.scheduleLabel}>{t.doctorDashboard.toLabel}</Text>
                <TextInput
                  style={styles.scheduleInput}
                  placeholder="14:00"
                  placeholderTextColor="#9CA3AF"
                  value={scheduleDraft.default?.break_end || ''}
                  onChangeText={(value) => updateScheduleDefault('break_end', value)}
                />
              </View>
            </View>

            <View style={styles.scheduleSection}>
              <Text style={styles.label}>{t.doctorDashboard.weeklyOffDays}</Text>
              <View style={styles.weeklyOffGrid}>
                {DAY_KEYS.map((dayKey) => {
                  const isOff = (scheduleDraft.weekly_off || []).includes(dayKey);
                  return (
                    <TouchableOpacity
                      key={dayKey}
                      style={[styles.weeklyOffChip, isOff && styles.weeklyOffChipSelected]}
                      onPress={() => toggleWeeklyOff(dayKey)}
                    >
                      <Text style={[styles.weeklyOffText, isOff && styles.weeklyOffTextSelected]}>
                        {DAY_LABELS[dayKey]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowScheduleModal(false)}>
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonPrimary, savingSchedule && styles.buttonDisabled]}
                onPress={handleSaveSchedule}
                disabled={savingSchedule}
              >
                {savingSchedule ? <ActivityIndicator color="white" size="small" /> : (
                  <Text style={styles.modalButtonPrimaryText}>{t.common.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* Social Media Modal */}
      <Modal visible={showDoctorSocialModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Social Media</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Instagram</Text>
              <TextInput
                style={styles.input}
                placeholder={isRTL ? 'instagram.com/username' : 'instagram.com/username'}
                placeholderTextColor="#9CA3AF"
                value={socialInstagram}
                onChangeText={setSocialInstagram}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Facebook</Text>
              <TextInput
                style={styles.input}
                placeholder={isRTL ? 'facebook.com/page' : 'facebook.com/page'}
                placeholderTextColor="#9CA3AF"
                value={socialFacebook}
                onChangeText={setSocialFacebook}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowDoctorSocialModal(false)}>
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonPrimary, savingSocial && styles.buttonDisabled]}
                onPress={handleSaveSocial}
                disabled={savingSocial}
              >
                {savingSocial ? <ActivityIndicator color="white" size="small" /> : (
                  <Text style={styles.modalButtonPrimaryText}>{t.common.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Clinic Holiday Modal */}
      <Modal visible={showHolidayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>{t.doctorDashboard.specialHolidayTitle}</Text>

            <Text style={styles.label}>{t.doctorDashboard.clinicLabel}</Text>
            {clinics.length === 0 ? (
              <Text style={styles.emptyText}>
                {t.doctorDashboard.noClinicsAvailable}
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
                {clinics.map((clinic) => (
                  <TouchableOpacity
                    key={clinic.id}
                    style={[styles.clinicChip, holidayClinicId === clinic.id && styles.clinicChipSelected]}
                    onPress={() => setHolidayClinicId(clinic.id)}
                  >
                    <Text style={[
                      styles.clinicChipText,
                      holidayClinicId === clinic.id && styles.clinicChipTextSelected
                    ]}>
                      {clinic.clinic_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={styles.label}>{t.doctorDashboard.dateLabel}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
              {getNextDays(30).map((day) => (
                <TouchableOpacity
                  key={day.date}
                  style={[styles.dayCard, holidayDate === day.date && styles.dayCardSelected]}
                  onPress={() => setHolidayDate(day.date)}
                >
                  <Text style={[styles.dayName, holidayDate === day.date && styles.dayTextSelected]}>{day.dayName}</Text>
                  <Text style={[styles.dayNumber, holidayDate === day.date && styles.dayTextSelected]}>{day.dayNumber}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.doctorDashboard.reasonLabel}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.doctorDashboard.publicHolidayExample}
                placeholderTextColor="#9CA3AF"
                value={holidayReason}
                onChangeText={setHolidayReason}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowHolidayModal(false)}>
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonPrimary, savingHoliday && styles.buttonDisabled]}
                onPress={handleAddHoliday}
                disabled={savingHoliday}
              >
                {savingHoliday ? <ActivityIndicator color="white" size="small" /> : (
                  <Text style={styles.modalButtonPrimaryText}>{t.common.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={showBlockTimeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>{isRTL ? 'حظر وقت' : 'Block Time'}</Text>
            
            <Text style={styles.label}>{t.doctorDashboard.clinicLabel}</Text>
            {clinics.length === 0 ? (
              <Text style={styles.emptyText}>
                {t.doctorDashboard.noClinicsAvailable}
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
                {clinics.map((clinic) => (
                  <TouchableOpacity
                    key={clinic.id}
                    style={[styles.clinicChip, selectedBlockClinicId === clinic.id && styles.clinicChipSelected]}
                    onPress={() => setSelectedBlockClinicId(clinic.id)}
                  >
                    <Text style={[
                      styles.clinicChipText,
                      selectedBlockClinicId === clinic.id && styles.clinicChipTextSelected
                    ]}>
                      {clinic.clinic_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            
            <Text style={styles.label}>{t.doctorDashboard.dateLabel}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
              {getNextDays().map((day) => (
                <TouchableOpacity
                  key={day.date}
                  style={[styles.dayCard, selectedBlockDate === day.date && styles.dayCardSelected]}
                  onPress={() => setSelectedBlockDate(day.date)}
                >
                  <Text style={[styles.dayName, selectedBlockDate === day.date && styles.dayTextSelected]}>{day.dayName}</Text>
                  <Text style={[styles.dayNumber, selectedBlockDate === day.date && styles.dayTextSelected]}>{day.dayNumber}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.label, { marginTop: 15 }]}>{isRTL ? 'الأوقات' : 'Times'}</Text>
            <View style={styles.timeSlotsGrid}>
              {blockSlots.length === 0 ? (
                <Text style={styles.emptyText}>
                  {t.doctorDashboard.noAvailableSlotsForDay}
                </Text>
              ) : (
                blockSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.timeSlot, selectedBlockSlots.includes(slot) && styles.timeSlotSelected]}
                    onPress={() => toggleBlockSlot(slot)}
                  >
                    <Text style={[styles.timeSlotText, selectedBlockSlots.includes(slot) && styles.timeSlotTextSelected]}>
                      {formatTime(slot)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.doctorDashboard.reasonLabel}</Text>
              <TextInput
                style={styles.input}
                placeholder={isRTL ? 'اختياري...' : 'Optional...'}
                placeholderTextColor="#9CA3AF"
                value={blockReason}
                onChangeText={setBlockReason}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowBlockTimeModal(false)}>
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButtonPrimary, blockingSlots && styles.buttonDisabled]}
                onPress={handleBlockSlots}
                disabled={blockingSlots}
              >
                {blockingSlots ? <ActivityIndicator color="white" size="small" /> : (
                  <Text style={styles.modalButtonPrimaryText}>{t.doctorDashboard.blockTime}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reschedule Modal */}
      <Modal visible={showRescheduleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{isRTL ? 'إعادة جدولة' : 'Reschedule'}</Text>
            
            {rescheduleAppointment && (
              <View style={styles.rescheduleInfo}>
                <Text style={styles.reschedulePatient}>👤 {rescheduleAppointment.patient_name}</Text>
                <Text style={styles.rescheduleOldDate}>
                  {isRTL ? 'الحالي:' : 'Current:'} {formatDate(rescheduleAppointment.appointment_date)}
                </Text>
              </View>
            )}
            
            <Text style={styles.label}>{isRTL ? 'التاريخ الجديد' : 'New Date'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
              {getNextDays().map((day) => (
                <TouchableOpacity
                  key={day.date}
                  style={[styles.dayCard, newDate === day.date && styles.dayCardSelected]}
                  onPress={() => setNewDate(day.date)}
                >
                  <Text style={[styles.dayName, newDate === day.date && styles.dayTextSelected]}>{day.dayName}</Text>
                  <Text style={[styles.dayNumber, newDate === day.date && styles.dayTextSelected]}>{day.dayNumber}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowRescheduleModal(false)}>
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButtonPrimary, rescheduling && styles.buttonDisabled]}
                onPress={handleReschedule}
                disabled={rescheduling}
              >
                {rescheduling ? <ActivityIndicator color="white" size="small" /> : (
                  <Text style={styles.modalButtonPrimaryText}>{t.common.confirm}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal */}
      <Modal visible={showLocationPickerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{isRTL ? 'اختر موقع العيادة' : 'Select Clinic Location'}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{isRTL ? 'ابحث عن العنوان' : 'Search Address'}</Text>
              <TextInput
                style={styles.input}
                placeholder={isRTL ? 'أدخل العنوان أو المدينة' : 'Enter address or city'}
                placeholderTextColor="#9CA3AF"
                value={locationSearchAddress}
                onChangeText={setLocationSearchAddress}
                returnKeyType="search"
                onSubmitEditing={searchLocation}
              />
            </View>

            <View style={styles.mapContainer}>
              {mapRegion ? (
                <MapView
                  style={styles.mapView}
                  region={mapRegion}
                  onPress={handleMapPress}
                >
                  {mapMarker && <Marker coordinate={mapMarker} />}
                </MapView>
              ) : (
                <View style={styles.mapPlaceholder}>
                  <ActivityIndicator size="small" color="#2563EB" />
                  <Text style={styles.helperText}>Loading map...</Text>
                </View>
              )}
            </View>
            {mapSelection?.address && (
              <Text style={styles.helperText}>{mapSelection.address}</Text>
            )}


            <TouchableOpacity
              style={[styles.modalButtonSecondary, styles.fullWidthButton]}
              onPress={() => getCurrentLocationAndSet(true)}
            >
              <Text style={styles.modalButtonSecondaryText}>Current Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButtonPrimary, styles.fullWidthButton, !mapSelection && styles.buttonDisabled]}
              onPress={applySelectedLocation}
              disabled={!mapSelection}
            >
              <Text style={styles.modalButtonPrimaryText}>Set Location</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButtonSecondary, styles.fullWidthButton]}
              onPress={() => setShowLocationPickerModal(false)}
            >
              <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  timeBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },timeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
  },
  loadingText: { marginTop: 10, fontSize: 16, color: '#6B7280' },
  textRight: { textAlign: 'right' },
  rowReverse: { flexDirection: 'row-reverse' },
  alignRight: { alignItems: 'flex-end' },
  
  header: { backgroundColor: '#2563EB', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 25, borderBottomRightRadius: 25 },
  switchButton: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, marginBottom: 10 },
  switchButtonText: { color: 'white', fontSize: 12, fontWeight: '600' },
  greeting: { fontSize: 14, color: '#BFDBFE' },
  doctorName: { fontSize: 24, fontWeight: 'bold', color: 'white', marginTop: 5 },
  specialty: { fontSize: 14, color: '#BFDBFE', marginTop: 3 },
  pendingBanner: { backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginTop: 15 },
  pendingBannerText: { color: '#92400E', fontSize: 13, textAlign: 'center', fontWeight: '600' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  statCard: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 15, flex: 1, marginHorizontal: 5, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  statLabel: { fontSize: 11, color: '#BFDBFE', marginTop: 3 },
  
  tabContainer: { flexDirection: 'row', backgroundColor: 'white', marginHorizontal: 20, marginTop: -15, borderRadius: 12, padding: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#2563EB' },
  tabEmoji: { fontSize: 20 },
  
  content: { flex: 1, padding: 20 },
  tabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  tabActions: { flexDirection: 'row', gap: 8 },
  tabTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 15 },
  
  emptyState: { alignItems: 'center', padding: 40, backgroundColor: 'white', borderRadius: 16 },
  emptyIcon: { fontSize: 50, marginBottom: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  
  appointmentCard: { backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 10 },
  appointmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  patientName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  clinicText: { fontSize: 13, color: '#6B7280', marginTop: 3 },
  dateBadge: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  todayBadge: { backgroundColor: '#FEF3C7' },
  dateText: { fontSize: 12, color: '#1E40AF', fontWeight: '600' },
  appointmentActions: { flexDirection: 'row', gap: 10 },
  confirmBtn: { flex: 1, backgroundColor: '#D1FAE5', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  confirmBtnText: { color: '#065F46', fontWeight: '600' },
  rescheduleBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  rescheduleBtnText: { color: '#1E40AF', fontWeight: '600' },
  cancelBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8 },
  cancelBtnText: { color: '#DC2626', fontWeight: '600' },
  confirmedBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  confirmedText: { color: '#065F46', fontWeight: '600' },
  cancelledBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  cancelledText: { color: '#DC2626', fontWeight: '600' },
  
  blockedSlotCard: { backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 10 },
  blockedSlotInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockedDate: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  blockedTime: { fontSize: 14, color: '#6B7280', marginTop: 3 },
  blockedReason: { fontSize: 13, color: '#9CA3AF', marginTop: 3 },
  unblockBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  unblockBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  
  clinicCard: { backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 10 },
  clinicHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  clinicName: { fontSize: 16, fontWeight: '600', color: '#1F2937', flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeBadge: { backgroundColor: '#D1FAE5' },
  inactiveBadge: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#065F46' },
  clinicAddress: { fontSize: 13, color: '#6B7280', marginBottom: 5 },
  clinicFee: { fontSize: 13, color: '#6B7280' },
  scheduleBtn: { marginTop: 10, backgroundColor: '#EFF6FF', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  scheduleBtnText: { color: '#1E40AF', fontWeight: '600', fontSize: 13 },
  deactivateBtn: { marginTop: 12, backgroundColor: '#FEE2E2', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  deactivateBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  addButton: { backgroundColor: '#2563EB', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: 'white', fontWeight: '600', fontSize: 13 },
  secondaryButton: { backgroundColor: '#FEF3C7', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  secondaryButtonText: { color: '#92400E', fontWeight: '600', fontSize: 13 },
  
  profileCard: { backgroundColor: 'white', borderRadius: 16, padding: 25, alignItems: 'center', marginBottom: 20 },
  profileAvatarContainer: { position: 'relative', marginBottom: 15 },
  profileAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  profileImage: { width: 100, height: 100, borderRadius: 50 },
  avatarText: { fontSize: 40, color: 'white', fontWeight: 'bold' },
  editAvatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'white', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  editAvatarIcon: { fontSize: 16 },
  profileName: { fontSize: 22, fontWeight: 'bold', color: '#1F2937' },
  profileSpecialty: { fontSize: 14, color: '#6B7280', marginTop: 5 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  ratingText: { fontSize: 16, fontWeight: '600', color: '#F59E0B' },
  reviewCount: { fontSize: 13, color: '#6B7280', marginLeft: 5 },
  signOutButton: { backgroundColor: '#FEE2E2', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  signOutText: { color: '#DC2626', fontSize: 16, fontWeight: '600' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 25, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 20, textAlign: 'center' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 16 },
  locationButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12 },
  locationIcon: { fontSize: 20, marginRight: 10 },
  locationText: { flex: 1, fontSize: 14, color: '#1F2937' },
  locationPlaceholder: { flex: 1, fontSize: 14, color: '#9CA3AF' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalButtonSecondary: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalButtonSecondaryText: { color: '#374151', fontWeight: '600' },
  modalButtonPrimary: { flex: 1, backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalButtonPrimaryText: { color: 'white', fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
  
  daysScroll: { marginVertical: 10 },
  dayCard: { width: 60, padding: 10, marginRight: 10, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  dayCardSelected: { backgroundColor: '#2563EB' },
  dayName: { fontSize: 12, color: '#6B7280' },
  dayNumber: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginTop: 5 },
  dayTextSelected: { color: 'white' },

  clinicChip: { paddingHorizontal: 12, paddingVertical: 8, marginRight: 10, borderRadius: 20, backgroundColor: '#F3F4F6' },
  clinicChipSelected: { backgroundColor: '#2563EB' },
  clinicChipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  clinicChipTextSelected: { color: 'white' },
  
  timeSlotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  timeSlot: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6' },
  timeSlotSelected: { backgroundColor: '#2563EB' },
  timeSlotText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  timeSlotTextSelected: { color: 'white' },
  
  rescheduleInfo: { backgroundColor: '#F9FAFB', padding: 15, borderRadius: 12, marginBottom: 15 },
  reschedulePatient: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  rescheduleOldDate: { fontSize: 14, color: '#6B7280', marginTop: 5 },

  helperText: { fontSize: 12, color: '#6B7280', marginTop: 6 },
  mapContainer: { height: 200, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB', marginTop: 10 },
  mapView: { flex: 1 },
  mapPlaceholder: { height: 200, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  fullWidthButton: { marginTop: 10, alignSelf: 'stretch', width: '100%', flex: 0 },
  scheduleInfoText: { fontSize: 13, color: '#6B7280', marginTop: 6 },
  sectionSubtitle: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  scheduleSection: { marginBottom: 15 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  scheduleLabel: { fontSize: 12, color: '#6B7280' },
  scheduleInput: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, fontSize: 12 },
  weeklyOffGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weeklyOffChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#F3F4F6' },
  weeklyOffChipSelected: { backgroundColor: '#F59E0B' },
  weeklyOffText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  weeklyOffTextSelected: { color: 'white' },
  
  chatPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
  chatPlaceholderEmoji: { fontSize: 60, marginBottom: 15 },
  chatPlaceholderText: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  chatPlaceholderSubtext: { fontSize: 14, color: '#6B7280' },

  sectionDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 15 },
  loadMoreButton: { backgroundColor: 'white', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  loadMoreText: { color: '#1F2937', fontWeight: '600' },
  
  previewImage: { width: 200, height: 200, borderRadius: 100, marginVertical: 20, alignSelf: 'center', borderWidth: 3, borderColor: '#2563EB' },
  avatarConfirmContent: { backgroundColor: 'white', borderRadius: 20, padding: 25, width: '90%', maxWidth: 400 },
  
  conversationsList: { flex: 1, paddingVertical: 10 },
  conversationCard: { backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 10, marginHorizontal: 10 },
  conversationRow: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarEmoji: { fontSize: 24 },
  conversationInfo: { flex: 1 },
  lastMessage: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  
  chatViewContainer: { flex: 1, flexDirection: 'column' },
  backButton: { padding: 12, marginBottom: 8 },
  backButtonText: { fontSize: 20, color: '#2563EB', fontWeight: 'bold' },
  chatPatientName: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', paddingHorizontal: 15, marginBottom: 10 },
  messagesScrollView: { flex: 1, paddingHorizontal: 15, paddingVertical: 10 },
  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyChatText: { fontSize: 14, color: '#6B7280' },
  messageBubble: { marginBottom: 8, maxWidth: '80%', padding: 12, borderRadius: 16 },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: '#F3F4F6', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 20 },
  myMessageText: { color: 'white' },
  theirMessageText: { color: '#1F2937' },
  messageTime: { fontSize: 12, marginTop: 4 },
  myMessageTime: { color: '#E0E7FF' },
  theirMessageTime: { color: '#9CA3AF' },
  inputRow: { flexDirection: 'row', padding: 12, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E5E7EB', alignItems: 'flex-end', gap: 8 },
  textInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#93C5FD' },
  sendBtnText: { fontSize: 20, color: 'white', fontWeight: 'bold' },
});
