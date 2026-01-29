import PhoneInput from '@/components/ui/phone-input';
import { patientTheme } from '@/constants/patientTheme';
import { DAY_KEYS, DAY_LABELS, getDayKey, minutesToTime, timeToMinutes, useDoctorContext } from '@/lib/DoctorContext';
import { useI18n } from '@/lib/i18n';
import { fromE164, validatePhone } from '@/lib/phone-utils';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';

import type { Clinic, ClinicSchedule, ClinicScheduleDay, DayKey } from '@/lib/DoctorContext';

const theme = patientTheme;

type ClinicDraft = {
  clinic_name: string;
  address: string;
  consultation_fee: string;
  latitude: number | null;
  longitude: number | null;
};

type EditClinicDraftState = ClinicDraft & {
  mobile: string;
  landline: string;
  whatsapp: string;
  mobileLocal: string;
  landlineLocal: string;
  whatsappLocal: string;
};

type MapSelection = {
  latitude: number;
  longitude: number;
  address: string;
};

export default function DoctorClinicsScreen() {
  const { t, isRTL } = useI18n();
  const { 
    loading, 
    clinics, 
    blockedSlots, 
    fetchClinics, 
    fetchBlockedSlots,
    addClinic,
    updateClinic,
    deactivateClinic,
    updateClinicSchedule,
    addBlockedSlot
  } = useDoctorContext();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddClinicModal, setShowAddClinicModal] = useState(false);
  const [showEditClinicModal, setShowEditClinicModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showBlockTimeModal, setShowBlockTimeModal] = useState(false);
  const [showLocationPickerModal, setShowLocationPickerModal] = useState(false);

  const [addingClinic, setAddingClinic] = useState(false);
  const [savingClinicEdit, setSavingClinicEdit] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [blockingSlots, setBlockingSlots] = useState(false);

  const [newClinic, setNewClinic] = useState<ClinicDraft>({
    clinic_name: '',
    address: '',
    consultation_fee: '',
    latitude: null,
    longitude: null,
  });

  const [editClinicId, setEditClinicId] = useState<string | null>(null);
  const [editClinicDraft, setEditClinicDraft] = useState<EditClinicDraftState>({
    clinic_name: '',
    address: '',
    consultation_fee: '',
    latitude: null,
    longitude: null,
    mobile: '',
    landline: '',
    whatsapp: '',
    mobileLocal: '',
    landlineLocal: '',
    whatsappLocal: '',
  });

  const [scheduleClinicId, setScheduleClinicId] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ClinicSchedule>({});
  const [scheduleSlotMinutes, setScheduleSlotMinutes] = useState(30);
  const [scheduleMode, setScheduleMode] = useState<'generic' | 'day-by-day'>('generic');

  const [selectedBlockClinicId, setSelectedBlockClinicId] = useState<string | null>(null);
  const [selectedBlockDate, setSelectedBlockDate] = useState<string | null>(null);
  const [selectedBlockSlots, setSelectedBlockSlots] = useState<string[]>([]);
  const [blockReason, setBlockReason] = useState('');

  const [mapSelection, setMapSelection] = useState<MapSelection | null>(null);
  const [mapMarker, setMapMarker] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [locationSearchAddress, setLocationSearchAddress] = useState('');
  const [locationPickerTarget, setLocationPickerTarget] = useState<'new' | 'edit'>('new');

  const [expandedClinics, setExpandedClinics] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchClinics();
    fetchBlockedSlots();
  }, [fetchClinics, fetchBlockedSlots]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchClinics(), fetchBlockedSlots()]);
    } finally {
      setRefreshing(false);
    }
  };

  const heroStats = useMemo(
    () => {
      const activeClinics = clinics.filter(clinic => clinic.is_active).length;
      const pendingClinics = Math.max(clinics.length - activeClinics, 0);
      return [
        {
          key: 'active',
          label: t.doctorDashboard?.activeClinics || (isRTL ? 'العيادات النشطة' : 'Active Clinics'),
          value: String(activeClinics),
        },
        {
          key: 'pending',
          label: isRTL ? 'بانتظار الموافقة' : 'Pending Approval',
          value: String(pendingClinics),
        },
      ];
    },
    [clinics, isRTL, t.doctorDashboard]
  );

  const openLocationPicker = async (
    target: 'new' | 'edit',
    fallback?: { latitude: number | null | undefined; longitude: number | null | undefined }
  ) => {
    setLocationPickerTarget(target);
    setMapSelection(null);
    setMapMarker(null);
    setMapRegion(null);
    setLocationSearchAddress('');
    setShowLocationPickerModal(true);

    const fallbackLat = fallback?.latitude ?? null;
    const fallbackLng = fallback?.longitude ?? null;
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
    if (locationPickerTarget === 'edit') {
      setEditClinicDraft(prev => ({
        ...prev,
        latitude: mapSelection.latitude,
        longitude: mapSelection.longitude,
        address: mapSelection.address,
      }));
    } else {
      setNewClinic(prev => ({
        ...prev,
        latitude: mapSelection.latitude,
        longitude: mapSelection.longitude,
        address: mapSelection.address,
      }));
    }
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
        Alert.alert(t.common.error, t.doctorApp?.locationServicesDisabled || 'Location services disabled');
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t.common.error, t.doctorApp?.locationPermissionMsg || 'Location permission denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      await setSelectionFromCoords(location.coords.latitude, location.coords.longitude);

      if (!keepOpen) {
        setShowLocationPickerModal(false);
        Alert.alert(t.common.success, isRTL ? 'Current location set successfully' : 'Current location set successfully');
      }
    } catch (error) {
      Alert.alert(t.common.error, t.doctorApp?.locationError || 'Error getting location');
    }
  };

  // Add Clinic Functions
  const handleAddClinic = async () => {
    if (!newClinic.clinic_name.trim()) {
      Alert.alert(t.common.error, t.doctorApp?.enterClinicName || 'Enter clinic name');
      return;
    }
    if (!newClinic.address.trim()) {
      Alert.alert(t.common.error, t.doctorApp?.setClinicLocation || 'Set clinic location');
      return;
    }

    setAddingClinic(true);
    const success = await addClinic({
      clinic_name: newClinic.clinic_name,
      address: newClinic.address,
      latitude: newClinic.latitude ?? undefined,
      longitude: newClinic.longitude ?? undefined,
      consultation_fee: newClinic.consultation_fee || undefined,
      is_active: false,
    });

    setAddingClinic(false);

    if (success) {
      Alert.alert(t.common.success, t.doctorApp?.clinicActivationNote || 'Clinic added successfully');
      setShowAddClinicModal(false);
      setNewClinic({ clinic_name: '', address: '', consultation_fee: '', latitude: null, longitude: null });
    } else {
      Alert.alert(t.common.error, 'Failed to add clinic');
    }
  };

  // Edit Clinic Functions
  const openEditClinicModal = (clinic: Clinic) => {
    setEditClinicId(clinic.id);
    setEditClinicDraft({
      clinic_name: clinic.clinic_name || '',
      address: clinic.address || '',
      consultation_fee: clinic.consultation_fee || '',
      latitude: clinic.latitude ?? null,
      longitude: clinic.longitude ?? null,
      mobile: clinic.mobile || '',
      landline: clinic.landline || '',
      whatsapp: clinic.whatsapp || '',
      mobileLocal: '',
      landlineLocal: '',
      whatsappLocal: '',
    });
    setShowEditClinicModal(true);
  };

  const handleSaveClinicEdit = async () => {
    if (!editClinicId) return;
    
    // Load country data for validation
    const { data: countryData } = await supabase
      .from('countries')
      .select('phone_config, country_code')
      .eq('is_default', true)
      .single();
    
    if (!countryData?.phone_config) {
      Alert.alert(t.common.error, 'Unable to validate phone numbers');
      return;
    }
    
    // Check if user has started typing a mobile number but it's incomplete/invalid
    if (editClinicDraft.mobileLocal && editClinicDraft.mobileLocal.length > 0 && !editClinicDraft.mobile) {
      Alert.alert(t.common.error, 'Mobile: Please enter a valid phone number');
      return;
    }
    
    // Validate mobile if provided
    if (editClinicDraft.mobile && editClinicDraft.mobile.trim()) {
      const localNumber = fromE164(editClinicDraft.mobile, countryData.country_code);
      if (!localNumber || localNumber.length === 0) {
        Alert.alert(t.common.error, 'Mobile: Invalid phone number format');
        return;
      }
      const validation = validatePhone(localNumber, countryData.phone_config, 'mobile');
      if (!validation.valid) {
        Alert.alert(t.common.error, `Mobile: ${validation.error}`);
        return;
      }
    }
    
    // Check if user has started typing a landline number but it's incomplete/invalid
    if (editClinicDraft.landlineLocal && editClinicDraft.landlineLocal.length > 0 && !editClinicDraft.landline) {
      Alert.alert(t.common.error, 'Landline: Please enter a valid phone number');
      return;
    }
    
    // Validate landline if provided
    if (editClinicDraft.landline && editClinicDraft.landline.trim()) {
      const localNumber = fromE164(editClinicDraft.landline, countryData.country_code);
      if (!localNumber || localNumber.length === 0) {
        Alert.alert(t.common.error, 'Landline: Invalid phone number format');
        return;
      }
      const validation = validatePhone(localNumber, countryData.phone_config, 'landline');
      if (!validation.valid) {
        Alert.alert(t.common.error, `Landline: ${validation.error}`);
        return;
      }
    }
    
    // Check if user has started typing a whatsapp number but it's incomplete/invalid
    if (editClinicDraft.whatsappLocal && editClinicDraft.whatsappLocal.length > 0 && !editClinicDraft.whatsapp) {
      Alert.alert(t.common.error, 'WhatsApp: Please enter a valid phone number');
      return;
    }
    
    // Validate whatsapp if provided
    if (editClinicDraft.whatsapp && editClinicDraft.whatsapp.trim()) {
      const localNumber = fromE164(editClinicDraft.whatsapp, countryData.country_code);
      if (!localNumber || localNumber.length === 0) {
        Alert.alert(t.common.error, 'WhatsApp: Invalid phone number format');
        return;
      }
      const validation = validatePhone(localNumber, countryData.phone_config, 'mobile');
      if (!validation.valid) {
        Alert.alert(t.common.error, `WhatsApp: ${validation.error}`);
        return;
      }
    }
    
    setSavingClinicEdit(true);
    const success = await updateClinic(editClinicId, {
      clinic_name: editClinicDraft.clinic_name.trim(),
      address: editClinicDraft.address.trim(),
      consultation_fee: editClinicDraft.consultation_fee.trim() || undefined,
      latitude: editClinicDraft.latitude ?? undefined,
      longitude: editClinicDraft.longitude ?? undefined,
      mobile: editClinicDraft.mobile || null,
      landline: editClinicDraft.landline || null,
      whatsapp: editClinicDraft.whatsapp || null,
    });
    
    setSavingClinicEdit(false);
    
    if (success) {
      setShowEditClinicModal(false);
    } else {
      Alert.alert(t.common.error, 'Failed to update clinic');
    }
  };

  const handleDeactivateClinic = async (clinicId: string) => {
    Alert.alert(
      t.doctorDashboard?.deactivateClinic || 'Deactivate Clinic',
      t.doctorDashboard?.deactivateClinicConfirm || 'Are you sure?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.confirm,
          style: 'destructive',
          onPress: async () => {
            const success = await deactivateClinic(clinicId);
            if (success) {
              Alert.alert(t.common.success, t.doctorDashboard?.clinicDeactivated || 'Clinic deactivated');
            } else {
              Alert.alert(t.common.error, 'Failed to deactivate clinic');
            }
          },
        },
      ]
    );
  };

  // Schedule Functions
  const openScheduleModal = (clinic: Clinic) => {
    setScheduleClinicId(clinic.id);
    setScheduleDraft(clinic.schedule || {});
    const raw = clinic.slot_minutes ?? 30;
    setScheduleSlotMinutes(Math.min(120, Math.max(20, raw)));
    setScheduleMode('generic');
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

  const updateScheduleDay = (
    day: DayKey,
    field: keyof ClinicScheduleDay,
    value: string
  ) => {
    setScheduleDraft(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || {}),
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
    const clamped = Math.min(120, Math.max(20, scheduleSlotMinutes || 30));
    const success = await updateClinicSchedule(scheduleClinicId, scheduleDraft, clamped);
    setSavingSchedule(false);
    
    if (success) {
      setShowScheduleModal(false);
    } else {
      Alert.alert(t.common.error, 'Failed to update schedule');
    }
  };

  // Block Time Functions
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

    setBlockingSlots(true);

    try {
      const existingKeys = new Set(
        blockedSlots
          .filter(s => s.blocked_date === selectedBlockDate && s.clinic_id === selectedBlockClinicId)
          .map(s => `${s.blocked_date}|${s.time_slot}`)
      );

      const slotsToInsert = selectedBlockSlots.filter(
        slot => !existingKeys.has(`${selectedBlockDate}|${slot}`)
      );

      if (slotsToInsert.length === 0) {
        Alert.alert(t.common.success, isRTL ? 'تم حظر كل الأوقات المحددة مسبقاً' : 'All selected slots are already blocked.');
        setBlockingSlots(false);
        return;
      }

      let allSuccess = true;
      for (const slot of slotsToInsert) {
        const success = await addBlockedSlot(selectedBlockClinicId, selectedBlockDate, slot, blockReason);
        if (!success) allSuccess = false;
      }

      if (allSuccess) {
        Alert.alert(t.common.success, isRTL ? 'تم حظر المواعيد بنجاح' : 'Time slots blocked successfully');
        setShowBlockTimeModal(false);
      } else {
        Alert.alert(t.common.error, 'Failed to block some slots');
      }
    } catch (error: any) {
      Alert.alert(t.common.error, error.message);
    } finally {
      setBlockingSlots(false);
    }
  };

  // Utility Functions
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

  const toggleClinicExpanded = (clinicId: string) => {
    setExpandedClinics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clinicId)) {
        newSet.delete(clinicId);
      } else {
        newSet.add(clinicId);
      }
      return newSet;
    });
  };

  const renderClinicWorkingHours = (clinic: Clinic) => {
    const schedule = clinic.schedule;
    const weeklyOff = schedule?.weekly_off || [];
    const slotMinutes = getClinicSlotMinutes(clinic);
    const hasDefaultSchedule = Boolean(schedule?.default?.start && schedule?.default?.end);
    const isExpanded = expandedClinics.has(clinic.id);

    return (
      <View key={clinic.id} style={styles.scheduleCard}>
        <TouchableOpacity
          style={[styles.clinicHeader, isRTL && styles.rowReverse]}
          onPress={() => toggleClinicExpanded(clinic.id)}
          activeOpacity={0.7}
        >
          <View style={[styles.clinicHeaderLeft, isRTL && styles.rowReverse]}>
            <Ionicons 
              name={isExpanded ? "chevron-down" : (isRTL ? "chevron-back" : "chevron-forward")} 
              size={20} 
              color="#6B7280" 
            />
            <Text style={[styles.clinicName, isRTL && styles.textRight]}>{clinic.clinic_name}</Text>
          </View>
          <TouchableOpacity
            style={[styles.editScheduleButton, !clinic.is_active && styles.clinicIconDisabled]}
            onPress={(e) => {
              e.stopPropagation();
              openScheduleModal(clinic);
            }}
            disabled={!clinic.is_active}
          >
            <Ionicons name="create-outline" size={16} color={clinic.is_active ? '#1E40AF' : '#9CA3AF'} />
            <Text style={[styles.editScheduleText, !clinic.is_active && { color: '#9CA3AF' }]}>
              {isRTL ? 'تعديل' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Collapsed summary */}
        {!isExpanded && clinic.is_active && hasDefaultSchedule && (
          <Text style={[styles.scheduleInfoText, { marginTop: 8 }, isRTL && styles.textRight]}>
            {formatTime(schedule?.default?.start || '00:00')} - {formatTime(schedule?.default?.end || '00:00')} • {slotMinutes} {isRTL ? 'دقيقة' : 'min'}
          </Text>
        )}

        {/* Expanded details */}
        {isExpanded && (
          !clinic.is_active ? (
            <Text style={[styles.scheduleInfoText, { color: '#9CA3AF', fontStyle: 'italic', marginTop: 8 }, isRTL && styles.textRight]}>
              {isRTL ? 'العيادة غير نشطة' : 'Clinic inactive'}
            </Text>
          ) : !hasDefaultSchedule ? (
            <Text style={[styles.scheduleInfoText, { marginTop: 8 }, isRTL && styles.textRight]}>
              {t.common.notAvailable}
            </Text>
          ) : (
            <View>
              <Text style={[styles.scheduleInfoText, { fontWeight: '600', marginTop: 8, marginBottom: 4 }, isRTL && styles.textRight]}>
                {t.doctorDashboard?.slotMinutesLabel || 'Slot Minutes'}: {slotMinutes} {isRTL ? 'دقيقة' : 'min'}
              </Text>
              
              {/* Day-by-day schedule in single container */}
              <View style={styles.scheduleContainer}>
                {DAY_KEYS.map((dayKey, index) => {
                  const isWeeklyOff = weeklyOff.includes(dayKey);
                  const daySchedule = schedule?.[dayKey] || schedule?.default;
                  const dayLabel = getLocalizedDayLabel(dayKey);
                  
                  return (
                    <View key={dayKey} style={[styles.dayScheduleRow, isRTL && styles.rowReverse]}>
                      <Text style={[styles.dayLabel, isRTL && styles.textRight, isWeeklyOff && { color: '#DC2626' }]}>
                        {dayLabel}:
                      </Text>
                      <Text style={[styles.dayScheduleText, isRTL && styles.textRight, isWeeklyOff && { color: '#DC2626' }]}>
                        {isWeeklyOff 
                          ? (isRTL ? 'عطلة' : 'Off')
                          : `${formatTime(daySchedule?.start || '00:00')} - ${formatTime(daySchedule?.end || '00:00')}${
                              daySchedule?.break_start && daySchedule?.break_end 
                                ? ` (${isRTL ? 'استراحة' : 'Break'}: ${formatTime(daySchedule.break_start)}-${formatTime(daySchedule.break_end)})`
                                : ''
                            }`
                        }
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )
        )}
      </View>
    );
  };

  const blockSlots =
    selectedBlockDate && selectedBlockClinicId
      ? generateSlotsForClinicDate(selectedBlockClinicId, selectedBlockDate)
      : [];

  if (loading && clinics.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />
      
      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.heroCardWrapper}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={[styles.heroHeader, isRTL && styles.rowReverse]}>
              <View style={[styles.heroTextGroup, isRTL && styles.alignRight]}>
                <Text style={styles.heroEyebrow}>{isRTL ? 'لوحة التحكم' : 'Clinics Dashboard'}</Text>
                <Text style={[styles.heroTitle, isRTL && styles.textRight]}>
                  {isRTL ? 'انشر جدولك وابق منظماً' : 'Publish schedules & stay organized'}
                </Text>
                <Text style={[styles.heroSubtitle, isRTL && styles.textRight]}>
                  {isRTL
                    ? 'قم بتحديث مواقع العيادة، الأجور، الجداول، والعطل من مكان واحد.'
                    : 'Update clinic locations, fees, schedules, and off days from one place.'}
                </Text>
              </View>
              <View style={styles.heroIconBubble}>
                <Ionicons name="business-outline" size={32} color="#FFFFFF" />
              </View>
            </View>

            <View style={styles.heroStatsGrid}>
              {heroStats.map((stat) => (
                <View key={stat.key} style={styles.heroStatCard}>
                  <Text style={styles.heroStatValue}>{stat.value}</Text>
                  <Text style={styles.heroStatLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.heroCtaRow, isRTL && styles.rowReverse]}>
              <TouchableOpacity
                style={styles.heroPrimaryCta}
                onPress={() => setShowAddClinicModal(true)}
              >
                <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={[styles.heroPrimaryCtaText, isRTL && styles.ctaTextRtl]}>
                  {isRTL ? 'عيادة جديدة' : 'New Clinic'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.heroSecondaryCta} onPress={openBlockTimeModal}>
                <Ionicons name="time-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.heroSecondaryCtaText, isRTL && styles.ctaTextRtl]}>
                  {t.doctorDashboard?.blockTime || (isRTL ? 'حظر وقت' : 'Block Time')}
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Clinics List */}
        <View style={[styles.tabHeader, isRTL && styles.rowReverse]}>
          <View style={styles.sectionHeadingText}>
            <Text style={[styles.tabTitle, isRTL && styles.textRight]}>
              {t.doctorDashboard?.myClinics || 'My Clinics'}
            </Text>
            <Text style={[styles.sectionHint, isRTL && styles.textRight]}>
              {isRTL
                ? 'قم بإدارة بيانات كل عيادة بسهولة'
                : 'Tap a clinic card to edit its details'}
            </Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddClinicModal(true)}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addButtonText}>{isRTL ? 'إضافة' : 'Add'}</Text>
          </TouchableOpacity>
        </View>
        
        {clinics.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏥</Text>
            <Text style={styles.emptyTitle}>{t.doctorDashboard?.noClinics || 'No Clinics'}</Text>
            <Text style={styles.emptyText}>{t.doctorDashboard?.noClinicsDesc || 'Add your first clinic'}</Text>
          </View>
        ) : (
          clinics.map((clinic) => {
            const statusLabel = clinic.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'معلق' : 'Pending');
            return (
              <TouchableOpacity
                key={clinic.id}
                style={styles.clinicCard}
                activeOpacity={0.9}
                onPress={() => openEditClinicModal(clinic)}
              >
                <View style={[styles.clinicCardTop, isRTL && styles.rowReverse]}>
                  <View style={[styles.clinicIdentity, isRTL && styles.rowReverse]}>
                    <View style={styles.clinicAvatar}>
                      <Ionicons name="medkit-outline" size={20} color={theme.colors.primary} />
                    </View>
                    <View style={[styles.clinicTextGroup, isRTL && styles.alignRight]}>
                      <Text style={styles.clinicName}>{clinic.clinic_name}</Text>
                      <Text style={[styles.clinicAddress, isRTL && styles.textRight]} numberOfLines={1}>
                        {clinic.address}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusPill, clinic.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                    <Text style={[styles.statusText, !clinic.is_active && styles.statusPendingText]}>{statusLabel}</Text>
                  </View>
                </View>

                <View style={styles.clinicMetaRow}>
                  {clinic.consultation_fee ? (
                    <View style={styles.infoChip}>
                      <Ionicons name="cash-outline" size={14} color={theme.colors.accent} />
                      <Text style={styles.infoChipText}>{clinic.consultation_fee}</Text>
                    </View>
                  ) : null}

                  {clinic.mobile ? (
                    <View style={styles.infoChip}>
                      <Ionicons name="call-outline" size={14} color={theme.colors.accent} />
                      <Text style={styles.infoChipText}>{clinic.mobile}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={[styles.clinicActionRow, isRTL && styles.rowReverse]}>
                  <TouchableOpacity
                    style={styles.clinicActionButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      openScheduleModal(clinic);
                    }}
                    accessibilityLabel={t.doctorDashboard?.clinicScheduleTitle || 'Schedule'}
                  >
                    <Ionicons name="calendar-outline" size={16} color={theme.colors.accent} />
                    <Text style={[styles.clinicActionLabel, isRTL && styles.actionTextRtl]}>
                      {isRTL ? 'الجدول' : 'Schedule'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.clinicActionButton}
                    onPress={(event) => {
                      event.stopPropagation();
                      openEditClinicModal(clinic);
                    }}
                    accessibilityLabel={t.common.edit}
                  >
                    <Ionicons name="create-outline" size={16} color={theme.colors.accent} />
                    <Text style={[styles.clinicActionLabel, isRTL && styles.actionTextRtl]}>
                      {t.common.edit}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.clinicActionButton, styles.clinicActionDanger, !clinic.is_active && styles.clinicIconDisabled]}
                    onPress={(event) => {
                      event.stopPropagation();
                      handleDeactivateClinic(clinic.id);
                    }}
                    disabled={!clinic.is_active}
                    accessibilityLabel={t.doctorDashboard?.deactivateClinic || 'Deactivate'}
                  >
                    <Ionicons
                      name="power-outline"
                      size={16}
                      color={clinic.is_active ? theme.colors.danger : theme.colors.textMuted}
                    />
                    <Text style={[styles.clinicActionLabel, styles.clinicActionDangerText, isRTL && styles.actionTextRtl]}>
                      {isRTL ? 'إيقاف' : 'Deactivate'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.sectionDivider} />

        {/* Schedule Management */}
        <Text style={[styles.tabTitle, isRTL && styles.textRight]}>
          {isRTL ? 'إدارة الجدول' : 'Schedule Management'}
        </Text>

        <Text style={[styles.sectionSubtitle, isRTL && styles.textRight]}>
          {t.common.workingHours}
        </Text>
        {clinics.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>{t.doctorDashboard?.noClinics || 'No Clinics'}</Text>
            <Text style={styles.emptyText}>{t.doctorDashboard?.noClinicsDesc || 'Add your first clinic'}</Text>
          </View>
        ) : (
          clinics.map(renderClinicWorkingHours)
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Clinic Modal */}
      <Modal visible={showAddClinicModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ModalHero
              title={t.doctorDashboard?.addNewClinic || 'Add New Clinic'}
              subtitle={
                isRTL
                  ? 'أضف عنوان العيادة والرسوم لتفعيلها في التطبيق.'
                  : 'Share your clinic address and fees to make it discoverable.'
              }
            />
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.doctorApp?.clinicName || 'Clinic Name'} *</Text>
              <TextInput
                style={styles.input}
                placeholder={t.doctorApp?.clinicNamePlaceholder || 'Enter clinic name'}
                placeholderTextColor="#9CA3AF"
                value={newClinic.clinic_name}
                onChangeText={(text) => setNewClinic(prev => ({ ...prev, clinic_name: text }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.doctorApp?.clinicLocation || 'Location'} *</Text>
              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => openLocationPicker('new', { latitude: newClinic.latitude, longitude: newClinic.longitude })}
              >
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={newClinic.address ? styles.locationText : styles.locationPlaceholder}>
                  {newClinic.address || (t.doctorApp?.selectLocation || 'Select location')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.doctorApp?.consultationFee || 'Consultation Fee'}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.doctorApp?.feePlaceholder || 'e.g., $50'}
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

      {/* Edit Clinic Modal */}
      <Modal visible={showEditClinicModal} transparent animationType="slide">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]}>
              <ScrollView 
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={true}
              >
                <ModalHero
                  title={t.common.edit}
                  subtitle={
                    isRTL
                      ? 'حدث بيانات العيادة ووسائل التواصل من هنا.'
                      : 'Refresh clinic details, fees, and contact info.'
                  }
                />

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t.doctorApp?.clinicName || 'Clinic Name'}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t.doctorApp?.clinicNamePlaceholder || 'Enter clinic name'}
                    placeholderTextColor="#9CA3AF"
                    value={editClinicDraft.clinic_name}
                    onChangeText={(text) => setEditClinicDraft(prev => ({ ...prev, clinic_name: text }))}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t.doctorApp?.clinicLocation || 'Location'}</Text>
                  <TouchableOpacity
                    style={styles.locationButton}
                    onPress={() => openLocationPicker('edit', { latitude: editClinicDraft.latitude, longitude: editClinicDraft.longitude })}
                  >
                    <Text style={editClinicDraft.address ? styles.locationText : styles.locationPlaceholder}>
                      {editClinicDraft.address || (t.doctorApp?.selectLocation || 'Select location')}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t.doctorApp?.consultationFee || 'Consultation Fee'}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t.doctorApp?.feePlaceholder || 'e.g., $50'}
                    placeholderTextColor="#9CA3AF"
                    value={editClinicDraft.consultation_fee}
                    onChangeText={(text) => setEditClinicDraft(prev => ({ ...prev, consultation_fee: text }))}
                  />
                </View>

                <PhoneInput
                  value={editClinicDraft.mobile}
                  onChangeValue={(e164, local) => setEditClinicDraft(prev => ({ ...prev, mobile: e164, mobileLocal: local }))}
                  type="mobile"
                  label={isRTL ? 'رقم الموبايل' : 'Mobile Number'}
                  placeholder="70 123 456"
                  icon="call-outline"
                  isRTL={isRTL}
                />

                <PhoneInput
                  value={editClinicDraft.landline}
                  onChangeValue={(e164, local) => setEditClinicDraft(prev => ({ ...prev, landline: e164, landlineLocal: local }))}
                  type="landline"
                  label={isRTL ? 'رقم أرضي (اختياري)' : 'Landline (Optional)'}
                  placeholder="01 123 456"
                  icon="call-sharp"
                  isRTL={isRTL}
                />

                <PhoneInput
                  value={editClinicDraft.whatsapp}
                  onChangeValue={(e164, local) => setEditClinicDraft(prev => ({ ...prev, whatsapp: e164, whatsappLocal: local }))}
                  type="mobile"
                  label={isRTL ? 'رقم واتساب' : 'WhatsApp Number'}
                  placeholder="70 123 456"
                  icon={require('@/assets/images/whatsappicon.png')}
                  isRTL={isRTL}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowEditClinicModal(false)}>
                    <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButtonPrimary, savingClinicEdit && styles.buttonDisabled]}
                    onPress={handleSaveClinicEdit}
                    disabled={savingClinicEdit}
                  >
                    {savingClinicEdit ? <ActivityIndicator color="white" size="small" /> : (
                      <Text style={styles.modalButtonPrimaryText}>{t.common.save}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Schedule Modal */}
      <Modal visible={showScheduleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
              <ModalHero
                title={t.doctorDashboard?.clinicScheduleTitle || 'Clinic Schedule'}
                subtitle={
                  isRTL
                    ? 'حدد مدة الجلسات وأوقات العمل لتعكس التوفر الحقيقي.'
                    : 'Set slot duration, working hours, and weekly breaks.'
                }
              />

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t.doctorDashboard?.slotMinutesLabel || 'Slot Minutes'}</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={String(scheduleSlotMinutes)}
                  onChangeText={(value) => setScheduleSlotMinutes(parseInt(value || '0', 10))}
                  placeholder={t.doctorDashboard?.slotMinutesExample || 'e.g., 30'}
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={styles.helperText}>{t.doctorDashboard?.slotMinutesHelp || '20-120 minutes per appointment'}</Text>
              </View>

              {/* Schedule Mode Toggle */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t.doctorDashboard?.scheduleMode || 'Schedule Mode'}</Text>
                <View style={styles.scheduleModeToggle}>
                  <TouchableOpacity
                    style={[styles.scheduleModeOption, scheduleMode === 'generic' && styles.scheduleModeOptionActive]}
                    onPress={() => setScheduleMode('generic')}
                  >
                    <Text style={[styles.scheduleModeText, scheduleMode === 'generic' && styles.scheduleModeTextActive]}>
                      {t.doctorDashboard?.generic || 'Generic'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.scheduleModeOption, scheduleMode === 'day-by-day' && styles.scheduleModeOptionActive]}
                    onPress={() => setScheduleMode('day-by-day')}
                  >
                    <Text style={[styles.scheduleModeText, scheduleMode === 'day-by-day' && styles.scheduleModeTextActive]}>
                      {t.doctorDashboard?.dayByDay || 'Day-by-Day'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {scheduleMode === 'generic' ? (
                <>
                  <View style={styles.scheduleSection}>
                    <Text style={styles.label}>{t.doctorDashboard?.defaultWorkingHours || 'Default Working Hours'}</Text>
                    <View style={styles.scheduleRow}>
                      <Text style={styles.scheduleLabel}>{t.doctorDashboard?.startLabel || 'Start'}</Text>
                      <TextInput
                        style={styles.scheduleInput}
                        placeholder="09:00"
                        placeholderTextColor="#9CA3AF"
                        value={scheduleDraft.default?.start || ''}
                        onChangeText={(value) => updateScheduleDefault('start', value)}
                      />
                      <Text style={styles.scheduleLabel}>{t.doctorDashboard?.endLabel || 'End'}</Text>
                      <TextInput
                        style={styles.scheduleInput}
                        placeholder="17:00"
                        placeholderTextColor="#9CA3AF"
                        value={scheduleDraft.default?.end || ''}
                        onChangeText={(value) => updateScheduleDefault('end', value)}
                      />
                    </View>

                    <View style={styles.scheduleRow}>
                      <Text style={styles.scheduleLabel}>{t.doctorDashboard?.breakLabel || 'Break'}</Text>
                      <TextInput
                        style={styles.scheduleInput}
                        placeholder="13:00"
                        placeholderTextColor="#9CA3AF"
                        value={scheduleDraft.default?.break_start || ''}
                        onChangeText={(value) => updateScheduleDefault('break_start', value)}
                      />
                      <Text style={styles.scheduleLabel}>{t.doctorDashboard?.toLabel || 'To'}</Text>
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
                    <Text style={styles.label}>{t.doctorDashboard?.weeklyOffDays || 'Weekly Off Days'}</Text>
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
                </>
              ) : (
                <View style={styles.scheduleSection}>
                  <Text style={styles.label}>{t.doctorDashboard?.dayByDaySchedule || 'Day-by-Day Schedule'}</Text>
                  {DAY_KEYS.map((dayKey) => {
                    const isOff = (scheduleDraft.weekly_off || []).includes(dayKey);
                    const daySchedule = scheduleDraft[dayKey];
                    return (
                      <View key={dayKey} style={styles.dayScheduleCard}>
                        <View style={styles.dayScheduleHeader}>
                          <Text style={styles.dayScheduleDay}>{DAY_LABELS[dayKey]}</Text>
                          <TouchableOpacity
                            style={[styles.dayOffToggle, isOff && styles.dayOffToggleActive]}
                            onPress={() => toggleWeeklyOff(dayKey)}
                          >
                            <Text style={[styles.dayOffToggleText, isOff && styles.dayOffToggleTextActive]}>
                              {isOff ? (t.common.closed || 'Closed') : (t.common.workingHours || 'Working')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {!isOff && (
                          <View style={styles.dayScheduleInputs}>
                            <View style={styles.scheduleRow}>
                              <Text style={styles.scheduleLabel}>{t.doctorDashboard?.startLabel || 'Start'}</Text>
                              <TextInput
                                style={styles.scheduleInput}
                                placeholder="09:00"
                                placeholderTextColor="#9CA3AF"
                                value={daySchedule?.start || ''}
                                onChangeText={(value) => updateScheduleDay(dayKey, 'start', value)}
                              />
                              <Text style={styles.scheduleLabel}>{t.doctorDashboard?.endLabel || 'End'}</Text>
                              <TextInput
                                style={styles.scheduleInput}
                                placeholder="17:00"
                                placeholderTextColor="#9CA3AF"
                                value={daySchedule?.end || ''}
                                onChangeText={(value) => updateScheduleDay(dayKey, 'end', value)}
                              />
                            </View>
                            <View style={styles.scheduleRow}>
                              <Text style={styles.scheduleLabel}>{t.doctorDashboard?.breakLabel || 'Break'}</Text>
                              <TextInput
                                style={styles.scheduleInput}
                                placeholder="13:00"
                                placeholderTextColor="#9CA3AF"
                                value={daySchedule?.break_start || ''}
                                onChangeText={(value) => updateScheduleDay(dayKey, 'break_start', value)}
                              />
                              <Text style={styles.scheduleLabel}>{t.doctorDashboard?.toLabel || 'To'}</Text>
                              <TextInput
                                style={styles.scheduleInput}
                                placeholder="14:00"
                                placeholderTextColor="#9CA3AF"
                                value={daySchedule?.break_end || ''}
                                onChangeText={(value) => updateScheduleDay(dayKey, 'break_end', value)}
                              />
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

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
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Block Time Modal */}
      <Modal visible={showBlockTimeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <ModalHero
              title={isRTL ? 'حظر وقت' : 'Block Time'}
              subtitle={
                isRTL
                  ? 'حدد العيادة والتاريخ لضمان عدم حجز تلك الفترات.'
                  : 'Select clinics, dates, and slots to pause bookings.'
              }
            />
            
            <View style={styles.modalSectionCard}>
              <Text style={styles.modalSectionHeading}>{t.doctorDashboard?.clinicLabel || 'Clinic'}</Text>
              {clinics.length === 0 ? (
                <Text style={styles.emptyText}>
                  {t.doctorDashboard?.noClinicsAvailable || 'No clinics available'}
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
            </View>

            <View style={styles.modalSectionCard}>
              <Text style={styles.modalSectionHeading}>{t.doctorDashboard?.dateLabel || 'Date'}</Text>
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
            </View>

            <View style={styles.modalSectionCard}>
              <Text style={styles.modalSectionHeading}>{isRTL ? 'الأوقات' : 'Times'}</Text>
              <View style={styles.timeSlotsGrid}>
                {blockSlots.length === 0 ? (
                  <Text style={styles.emptyText}>
                    {t.doctorDashboard?.noAvailableSlotsForDay || 'No available slots for this day'}
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
            </View>

            <View style={styles.modalSectionCard}>
              <Text style={styles.modalSectionHeading}>{t.doctorDashboard?.reasonLabel || 'Reason'}</Text>
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
                  <Text style={styles.modalButtonPrimaryText}>{t.doctorDashboard?.blockTime || 'Block'}</Text>
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
            <ModalHero
              title={isRTL ? 'اختر موقع العيادة' : 'Select Clinic Location'}
              subtitle={
                isRTL
                  ? 'حدد الموقع على الخريطة أو استخدم البحث للحصول على عنوان دقيق.'
                  : 'Drop a precise map pin or search for the address.'
              }
            />
            
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

            <View style={styles.locationActionRow}>
              <TouchableOpacity
                style={[styles.locationActionButton, styles.locationActionSecondary]}
                onPress={() => getCurrentLocationAndSet(true)}
                accessibilityLabel="Current Location"
              >
                <Ionicons name="locate-outline" size={18} color="#2563EB" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.locationActionButton,
                  styles.locationActionPrimary,
                  !mapSelection && styles.buttonDisabled,
                ]}
                onPress={applySelectedLocation}
                disabled={!mapSelection}
                accessibilityLabel="Set Location"
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.locationActionButton, styles.locationActionSecondary]}
                onPress={() => setShowLocationPickerModal(false)}
                accessibilityLabel={t.common.cancel}
              >
                <Ionicons name="close-circle-outline" size={18} color="#374151" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type ModalHeroProps = {
  title: string;
  subtitle: string;
};

const ModalHero = ({ title, subtitle }: ModalHeroProps) => (
  <LinearGradient
    colors={[theme.colors.primary, theme.colors.accent]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={styles.modalHero}
  >
    <Text style={styles.modalHeroTitle}>{title}</Text>
    <Text style={styles.modalHeroSubtitle}>{subtitle}</Text>
  </LinearGradient>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: theme.colors.textSecondary },
  textRight: { textAlign: 'right' },
  rowReverse: { flexDirection: 'row-reverse' },
  alignRight: { alignItems: 'flex-end' },
  content: { flex: 1, padding: theme.spacing.lg },

  heroCardWrapper: { marginBottom: theme.spacing.lg },
  heroCard: {
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  heroTextGroup: { flex: 1, gap: 6 },
  heroEyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', lineHeight: 30 },
  heroSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 },
  heroIconBubble: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginLeft: 16 },
  heroStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.md },
  heroStatCard: { flexBasis: '50%', padding: theme.spacing.sm, borderRadius: theme.radii.md, backgroundColor: 'rgba(255,255,255,0.18)' },
  heroStatValue: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  heroStatLabel: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  heroCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroPrimaryCta: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: theme.radii.md, paddingVertical: 12 },
  heroPrimaryCtaText: { color: '#FFFFFF', fontWeight: '600', marginLeft: 8 },
  heroSecondaryCta: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radii.md, paddingVertical: 12 },
  heroSecondaryCtaText: { color: theme.colors.primary, fontWeight: '600', marginLeft: 8 },
  ctaTextRtl: { marginLeft: 0, marginRight: 8 },

  tabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  tabActions: { flexDirection: 'row', gap: 8 },
  sectionHeadingText: { flex: 1 },
  tabTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary },
  sectionHint: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },

  emptyState: { alignItems: 'center', padding: theme.spacing.xl, backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.cardBorder, marginBottom: theme.spacing.lg },
  emptyIcon: { fontSize: 50, marginBottom: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },

  clinicCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, padding: theme.spacing.md, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.cardBorder, ...theme.shadow.card },
  clinicHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clinicHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  clinicCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clinicIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  clinicAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primarySoft, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  clinicTextGroup: { flex: 1 },
  clinicName: { fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radii.pill },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radii.pill },
  activeBadge: { backgroundColor: 'rgba(34,197,94,0.15)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  inactiveBadge: { backgroundColor: 'rgba(251,191,36,0.15)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' },
  statusText: { fontSize: 12, fontWeight: '700', color: theme.colors.success },
  statusPendingText: { color: theme.colors.warning },
  clinicAddress: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  clinicFee: { fontSize: 13, color: theme.colors.textSecondary },
  clinicMetaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing.sm, gap: 8 },
  infoChip: { flexDirection: 'row', alignItems: 'center', borderRadius: theme.radii.pill, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.colors.primarySoft },
  infoChipText: { fontSize: 12, color: theme.colors.primaryDark, marginLeft: 6 },
  clinicActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: theme.spacing.md },
  clinicIconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  clinicIconDanger: { backgroundColor: 'rgba(239,68,68,0.15)' },
  clinicIconDisabled: { opacity: 0.4 },
  clinicActionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevated, borderRadius: theme.radii.md, paddingVertical: 10, marginHorizontal: 4, borderWidth: 1, borderColor: theme.colors.border },
  clinicActionLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginLeft: 6 },
  actionTextRtl: { marginLeft: 0, marginRight: 6 },
  clinicActionDanger: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' },
  clinicActionDangerText: { color: theme.colors.danger },

  addButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radii.md, gap: 6 },
  addButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  sectionDivider: { height: 1, backgroundColor: theme.colors.border, marginVertical: theme.spacing.lg },
  sectionSubtitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 10 },
  scheduleInfoText: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 6 },

  editScheduleButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primarySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radii.md },
  editScheduleText: { fontSize: 12, fontWeight: '600', color: theme.colors.primaryDark },

  scheduleCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, padding: theme.spacing.md, marginBottom: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.cardBorder },
  scheduleContainer: { marginTop: 8, paddingLeft: 4 },
  dayScheduleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  dayLabel: { fontSize: 13, color: theme.colors.textSecondary },
  dayScheduleText: { fontSize: 13, color: theme.colors.textPrimary, textAlign: 'right' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 7, 22, 0.65)', justifyContent: 'center', alignItems: 'center', padding: theme.spacing.lg },
  modalContent: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, padding: theme.spacing.lg, width: '92%', maxWidth: 420, borderWidth: 1, borderColor: theme.colors.cardBorder },
  modalHero: { borderRadius: theme.radii.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  modalHeroTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  modalHeroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 20, textAlign: 'center' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 8 },
  input: { backgroundColor: theme.colors.elevated, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, padding: 12, fontSize: 16, color: theme.colors.textPrimary },
  locationButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.elevated, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, padding: 12 },
  locationIcon: { fontSize: 20, marginRight: 10 },
  locationText: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  locationPlaceholder: { flex: 1, fontSize: 14, color: theme.colors.textMuted },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalSectionCard: { backgroundColor: theme.colors.elevated, borderRadius: theme.radii.lg, padding: theme.spacing.md, marginTop: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.cardBorder },
  modalSectionHeading: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalButtonSecondary: { flex: 1, backgroundColor: theme.colors.elevated, paddingVertical: 12, borderRadius: theme.radii.md, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  modalButtonSecondaryText: { color: theme.colors.textPrimary, fontWeight: '600' },
  modalButtonPrimary: { flex: 1, backgroundColor: theme.colors.primary, paddingVertical: 12, borderRadius: theme.radii.md, alignItems: 'center' },
  modalButtonPrimaryText: { color: '#FFFFFF', fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },

  daysScroll: { marginVertical: 10 },
  dayCard: { width: 64, paddingVertical: 10, paddingHorizontal: 8, marginRight: 10, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevated, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  dayCardSelected: { backgroundColor: theme.colors.primary },
  dayName: { fontSize: 12, color: theme.colors.textSecondary },
  dayNumber: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 4 },
  dayTextSelected: { color: '#FFFFFF' },

  clinicChip: { paddingHorizontal: 12, paddingVertical: 8, marginRight: 10, borderRadius: theme.radii.pill, backgroundColor: theme.colors.elevated },
  clinicChipSelected: { backgroundColor: theme.colors.primary },
  clinicChipText: { fontSize: 12, color: theme.colors.textPrimary, fontWeight: '500' },
  clinicChipTextSelected: { color: '#FFFFFF' },

  timeSlotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  timeSlot: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevated, borderWidth: 1, borderColor: theme.colors.border },
  timeSlotSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  timeSlotText: { fontSize: 12, color: theme.colors.textPrimary, fontWeight: '500' },
  timeSlotTextSelected: { color: '#FFFFFF' },

  helperText: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6 },
  mapContainer: { height: 200, borderRadius: theme.radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border, marginTop: 10 },
  mapView: { flex: 1 },
  mapPlaceholder: { height: 200, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevated },
  locationActionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  locationActionButton: { flex: 1, height: 44, borderRadius: theme.radii.md, alignItems: 'center', justifyContent: 'center' },
  locationActionSecondary: { backgroundColor: theme.colors.elevated },
  locationActionPrimary: { backgroundColor: theme.colors.primary },

  scheduleSection: { marginBottom: 15 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  scheduleLabel: { fontSize: 12, color: theme.colors.textSecondary },
  scheduleInput: { flex: 1, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, paddingVertical: 8, paddingHorizontal: 10, fontSize: 12 },
  weeklyOffGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weeklyOffChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.pill, backgroundColor: theme.colors.elevated },
  weeklyOffChipSelected: { backgroundColor: theme.colors.warning },
  weeklyOffText: { fontSize: 12, color: theme.colors.textPrimary, fontWeight: '500' },
  weeklyOffTextSelected: { color: '#FFFFFF' },

  scheduleModeToggle: { flexDirection: 'row', backgroundColor: theme.colors.elevated, borderRadius: theme.radii.md, padding: 4 },
  scheduleModeOption: { flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: theme.radii.md, alignItems: 'center' },
  scheduleModeOptionActive: { backgroundColor: theme.colors.surface, ...theme.shadow.card },
  scheduleModeText: { fontSize: 14, fontWeight: '500', color: theme.colors.textSecondary },
  scheduleModeTextActive: { color: theme.colors.primary, fontWeight: '700' },

  dayScheduleCard: { marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, padding: 12, backgroundColor: theme.colors.surface },
  dayScheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayScheduleDay: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  dayOffToggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: theme.colors.success, borderColor: 'transparent', borderWidth: 1 },
  dayOffToggleActive: { backgroundColor: theme.colors.danger },
  dayOffToggleText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  dayOffToggleTextActive: { color: '#FFFFFF' },
  dayScheduleInputs: { marginTop: 8 },
});
