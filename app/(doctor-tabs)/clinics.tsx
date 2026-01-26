import PhoneInput from '@/components/ui/phone-input';
import { DAY_KEYS, DAY_LABELS, getDayKey, minutesToTime, timeToMinutes, useDoctorContext } from '@/lib/DoctorContext';
import { useI18n } from '@/lib/i18n';
import { fromE164, validatePhone } from '@/lib/phone-utils';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
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
import MapView, { Marker } from 'react-native-maps';

import type { Clinic, ClinicSchedule, ClinicScheduleDay, DayKey } from '@/lib/DoctorContext';

export default function DoctorClinicsScreen() {
  const { t, isRTL } = useI18n();
  const { 
    loading, 
    clinics, 
    blockedSlots, 
    holidays, 
    fetchClinics, 
    fetchBlockedSlots, 
    fetchHolidays,
    addClinic,
    updateClinic,
    deactivateClinic,
    updateClinicSchedule,
    addBlockedSlot,
    removeBlockedSlot,
    addHoliday,
    removeHoliday
  } = useDoctorContext();

  const [refreshing, setRefreshing] = useState(false);
  const [expandedClinics, setExpandedClinics] = useState<Set<string>>(new Set());
  
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

  // Edit Clinic Modal
  const [showEditClinicModal, setShowEditClinicModal] = useState(false);
  const [editClinicId, setEditClinicId] = useState<string | null>(null);
  const [editClinicDraft, setEditClinicDraft] = useState({
    clinic_name: '',
    address: '',
    consultation_fee: '',
    latitude: null as number | null,
    longitude: null as number | null,
    mobile: '',
    landline: '',
    whatsapp: '',
    mobileLocal: '',
    landlineLocal: '',
    whatsappLocal: '',
  });
  const [savingClinicEdit, setSavingClinicEdit] = useState(false);

  // Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleClinicId, setScheduleClinicId] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ClinicSchedule>({});
  const [scheduleSlotMinutes, setScheduleSlotMinutes] = useState<number>(30);
  const [scheduleMode, setScheduleMode] = useState<'generic' | 'day-by-day'>('generic');
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Block Time Modal
  const [showBlockTimeModal, setShowBlockTimeModal] = useState(false);
  const [selectedBlockDate, setSelectedBlockDate] = useState<string | null>(null);
  const [selectedBlockSlots, setSelectedBlockSlots] = useState<string[]>([]);
  const [selectedBlockClinicId, setSelectedBlockClinicId] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockingSlots, setBlockingSlots] = useState(false);

  // Holiday Modal
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayClinicIds, setHolidayClinicIds] = useState<string[]>([]);
  const [holidayDate, setHolidayDate] = useState<string | null>(null);
  const [holidayReason, setHolidayReason] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);

  // Location Picker Modal
  const [showLocationPickerModal, setShowLocationPickerModal] = useState(false);
  const [locationPickerTarget, setLocationPickerTarget] = useState<'new' | 'edit'>('new');
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

  useEffect(() => {
    setSelectedBlockSlots([]);
  }, [selectedBlockDate, selectedBlockClinicId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchClinics(), fetchBlockedSlots(), fetchHolidays()]);
    setRefreshing(false);
  };

  // Location Picker Functions
  const openLocationPicker = async (
    target: 'new' | 'edit',
    fallback?: { latitude: number | null; longitude: number | null }
  ) => {
    setLocationPickerTarget(target);
    setLocationSearchAddress('');
    setMapSelection(null);
    setMapMarker(null);
    setMapRegion(null);
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

  const handleUnblockSlot = async (slotId: string) => {
    Alert.alert(
      isRTL ? 'إلغاء الحظر' : 'Unblock Slot',
      isRTL ? 'هل تريد إلغاء حظر هذا الوقت؟' : 'Do you want to unblock this time slot?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.confirm,
          onPress: async () => {
            const success = await removeBlockedSlot(slotId);
            if (!success) {
              Alert.alert(t.common.error, 'Failed to unblock slot');
            }
          },
        },
      ]
    );
  };

  // Holiday Functions
  const openHolidayModal = () => {
    const defaultClinicId =
      clinics.find(c => c.is_active)?.id || clinics[0]?.id || null;
    setHolidayClinicIds(defaultClinicId ? [defaultClinicId] : []);
    setHolidayDate(null);
    setHolidayReason('');
    setShowHolidayModal(true);
  };

  const handleAddHoliday = async () => {
    if (holidayClinicIds.length === 0 || !holidayDate) {
      Alert.alert(t.common.error, t.doctorDashboard?.selectClinicAndDateError || 'Select clinic(s) and date');
      return;
    }
    setSavingHoliday(true);
    
    try {
      let allSuccess = true;
      for (const clinicId of holidayClinicIds) {
        const success = await addHoliday(clinicId, holidayDate, holidayReason);
        if (!success) allSuccess = false;
      }
      
      if (allSuccess) {
        Alert.alert(t.common.success, isRTL ? 'تمت إضافة العطلة' : 'Holiday added successfully');
        setShowHolidayModal(false);
      } else {
        Alert.alert(t.common.error, 'Failed to add holiday for some clinics');
      }
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleRemoveHoliday = async (holidayId: string) => {
    const success = await removeHoliday(holidayId);
    if (!success) {
      Alert.alert(t.common.error, 'Failed to remove holiday');
    }
  };

  // Utility Functions
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (dateString === todayStr) return t.appointments?.today || 'Today';
    
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
      <View key={clinic.id} style={styles.clinicCard}>
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
        {/* Clinics List */}
        <View style={[styles.tabHeader, isRTL && styles.rowReverse]}>
          <Text style={[styles.tabTitle, isRTL && styles.textRight]}>
            {t.doctorDashboard?.myClinics || 'My Clinics'}
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddClinicModal(true)}>
            <Text style={styles.addButtonText}>+ {isRTL ? 'إضافة' : 'Add'}</Text>
          </TouchableOpacity>
        </View>
        
        {clinics.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏥</Text>
            <Text style={styles.emptyTitle}>{t.doctorDashboard?.noClinics || 'No Clinics'}</Text>
            <Text style={styles.emptyText}>{t.doctorDashboard?.noClinicsDesc || 'Add your first clinic'}</Text>
          </View>
        ) : (
          clinics.map((clinic) => (
            <TouchableOpacity
              key={clinic.id}
              style={styles.clinicCard}
              activeOpacity={0.9}
              onPress={() => openEditClinicModal(clinic)}
            >
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
              <View style={[styles.clinicActionRow, isRTL && styles.rowReverse]}>
                <TouchableOpacity
                  style={styles.clinicIconButton}
                  onPress={() => openEditClinicModal(clinic)}
                  accessibilityLabel={t.common.edit}
                >
                  <Ionicons name="create-outline" size={16} color="#1E40AF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.clinicIconButton, styles.clinicIconDanger, !clinic.is_active && styles.clinicIconDisabled]}
                  onPress={() => handleDeactivateClinic(clinic.id)}
                  disabled={!clinic.is_active}
                  accessibilityLabel={t.doctorDashboard?.deactivateClinic || 'Deactivate'}
                >
                  <Ionicons name="power-outline" size={16} color={clinic.is_active ? '#DC2626' : '#9CA3AF'} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
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

        <View style={styles.sectionDivider} />

        {/* Blocked Slots */}
        <View style={[styles.tabHeader, isRTL && styles.rowReverse]}>
          <Text style={[styles.sectionSubtitle, isRTL && styles.textRight]}>
            {isRTL ? 'الأوقات المحظورة' : 'Blocked Times'}
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={openBlockTimeModal}>
            <Text style={styles.addButtonText}>+ {t.doctorDashboard?.blockTime || 'Block'}</Text>
          </TouchableOpacity>
        </View>
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
                <Text style={[styles.clinicSubtitle, isRTL && styles.textRight]}>
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

        {/* Holidays */}
        <View style={[styles.tabHeader, isRTL && styles.rowReverse]}>
          <Text style={[styles.sectionSubtitle, isRTL && styles.textRight]}>
            {t.doctorDashboard?.holidays || 'Holidays'}
          </Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={openHolidayModal}>
            <Text style={styles.secondaryButtonText}>+ {t.doctorDashboard?.addHoliday || 'Holiday'}</Text>
          </TouchableOpacity>
        </View>
        {holidays.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎉</Text>
            <Text style={styles.emptyTitle}>{t.doctorDashboard?.noHolidaysTitle || 'No Holidays'}</Text>
            <Text style={styles.emptyText}>
              {t.doctorDashboard?.noHolidaysDesc || 'No holidays set'}
            </Text>
          </View>
        ) : (
          holidays.map((holiday) => (
            <View key={holiday.id} style={styles.blockedSlotCard}>
              <View style={[styles.blockedSlotInfo, isRTL && styles.rowReverse]}>
                <View>
                  <View style={styles.inlineIconRow}>
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text style={styles.blockedDate}>{formatDate(holiday.holiday_date)}</Text>
                  </View>
                  {getClinicName(holiday.clinic_id) && (
                    <View style={styles.inlineIconRow}>
                      <Ionicons name="business-outline" size={14} color="#9CA3AF" />
                      <Text style={styles.blockedReason}>{getClinicName(holiday.clinic_id)}</Text>
                    </View>
                  )}
                  {holiday.reason && (
                    <View style={styles.inlineIconRow}>
                      <Ionicons name="information-circle-outline" size={14} color="#9CA3AF" />
                      <Text style={styles.blockedReason}>{holiday.reason}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity style={styles.unblockBtn} onPress={() => handleRemoveHoliday(holiday.id)}>
                  <Text style={styles.unblockBtnText}>{t.doctorDashboard?.removeHoliday || 'Remove'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Clinic Modal */}
      <Modal visible={showAddClinicModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t.doctorDashboard?.addNewClinic || 'Add New Clinic'}</Text>
            
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
                <Text style={styles.modalTitle}>{t.common.edit}</Text>

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
                  icon="📱"
                  isRTL={isRTL}
                />

                <PhoneInput
                  value={editClinicDraft.landline}
                  onChangeValue={(e164, local) => setEditClinicDraft(prev => ({ ...prev, landline: e164, landlineLocal: local }))}
                  type="landline"
                  label={isRTL ? 'رقم أرضي (اختياري)' : 'Landline (Optional)'}
                  placeholder="01 123 456"
                  icon="☎️"
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
              <Text style={styles.modalTitle}>{t.doctorDashboard?.clinicScheduleTitle || 'Clinic Schedule'}</Text>

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
            <Text style={styles.modalTitle}>{isRTL ? 'حظر وقت' : 'Block Time'}</Text>
            
            <Text style={styles.label}>{t.doctorDashboard?.clinicLabel || 'Clinic'}</Text>
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
            
            <Text style={styles.label}>{t.doctorDashboard?.dateLabel || 'Date'}</Text>
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.doctorDashboard?.reasonLabel || 'Reason'}</Text>
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

      {/* Holiday Modal */}
      <Modal visible={showHolidayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>{t.doctorDashboard?.specialHolidayTitle || 'Add Holiday'}</Text>

            <Text style={styles.label}>{t.doctorDashboard?.clinicLabel || 'Clinics'} ({isRTL ? 'يمكن اختيار أكثر من عيادة' : 'Select one or more'})</Text>
            {clinics.length === 0 ? (
              <Text style={styles.emptyText}>
                {t.doctorDashboard?.noClinicsAvailable || 'No clinics available'}
              </Text>
            ) : (
              <View style={styles.clinicCheckboxGrid}>
                {clinics.map((clinic) => (
                  <TouchableOpacity
                    key={clinic.id}
                    style={[styles.clinicCheckbox, holidayClinicIds.includes(clinic.id) && styles.clinicCheckboxSelected]}
                    onPress={() => {
                      if (holidayClinicIds.includes(clinic.id)) {
                        setHolidayClinicIds(holidayClinicIds.filter(id => id !== clinic.id));
                      } else {
                        setHolidayClinicIds([...holidayClinicIds, clinic.id]);
                      }
                    }}
                  >
                    <Ionicons 
                      name={holidayClinicIds.includes(clinic.id) ? 'checkbox' : 'square-outline'} 
                      size={20} 
                      color={holidayClinicIds.includes(clinic.id) ? '#2563EB' : '#9CA3AF'} 
                    />
                    <Text style={[
                      styles.clinicCheckboxText,
                      holidayClinicIds.includes(clinic.id) && styles.clinicCheckboxTextSelected
                    ]}>
                      {clinic.clinic_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>{t.doctorDashboard?.dateLabel || 'Date'}</Text>
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
              <Text style={styles.label}>{t.doctorDashboard?.reasonLabel || 'Reason'}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.doctorDashboard?.publicHolidayExample || 'e.g., National Holiday'}
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

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F3F4F6',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#6B7280' },
  textRight: { textAlign: 'right' },
  rowReverse: { flexDirection: 'row-reverse' },
  alignRight: { alignItems: 'flex-end' },
  
  content: { flex: 1, padding: 20 },
  tabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  tabActions: { flexDirection: 'row', gap: 8 },
  tabTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 15 },
  
  emptyState: { alignItems: 'center', padding: 40, backgroundColor: 'white', borderRadius: 16 },
  emptyIcon: { fontSize: 50, marginBottom: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  
  clinicCard: { backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 10 },
  clinicHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clinicHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  clinicName: { fontSize: 16, fontWeight: '600', color: '#1F2937', flex: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeBadge: { backgroundColor: '#D1FAE5' },
  inactiveBadge: { backgroundColor: '#FEF3C7' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#065F46' },
  clinicAddress: { fontSize: 13, color: '#6B7280', marginBottom: 5 },
  clinicFee: { fontSize: 13, color: '#6B7280' },
  clinicActionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  clinicIconButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  clinicIconDanger: { backgroundColor: '#FEE2E2' },
  clinicIconDisabled: { backgroundColor: '#E5E7EB' },
  
  addButton: { backgroundColor: '#2563EB', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: 'white', fontWeight: '600', fontSize: 13 },
  secondaryButton: { backgroundColor: '#FEF3C7', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  secondaryButtonText: { color: '#92400E', fontWeight: '600', fontSize: 13 },
  
  sectionDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 20 },
  sectionSubtitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 10 },
  clinicSubtitle: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 8, marginTop: 10 },
  scheduleInfoText: { fontSize: 13, color: '#6B7280', marginTop: 6 },
  
  editScheduleButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  editScheduleText: { fontSize: 12, fontWeight: '600', color: '#1E40AF' },
  
  scheduleContainer: { marginTop: 8, paddingLeft: 4 },
  dayScheduleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  dayLabel: { fontSize: 13, color: '#6B7280' },
  dayScheduleText: { fontSize: 13, color: '#374151', textAlign: 'right' },
  
  blockedSlotCard: { backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 10 },
  blockedSlotInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockedDate: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  blockedTime: { fontSize: 14, color: '#6B7280', marginTop: 3 },
  blockedReason: { fontSize: 13, color: '#9CA3AF', marginTop: 3 },
  inlineIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  unblockBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  unblockBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  
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
  
  clinicCheckboxGrid: { flexDirection: 'column', gap: 10, marginVertical: 10 },
  clinicCheckbox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' },
  clinicCheckboxSelected: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  clinicCheckboxText: { fontSize: 14, color: '#374151', fontWeight: '500', marginLeft: 10 },
  clinicCheckboxTextSelected: { color: '#2563EB', fontWeight: '600' },
  
  timeSlotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  timeSlot: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6' },
  timeSlotSelected: { backgroundColor: '#2563EB' },
  timeSlotText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  timeSlotTextSelected: { color: 'white' },
  
  helperText: { fontSize: 12, color: '#6B7280', marginTop: 6 },
  mapContainer: { height: 200, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB', marginTop: 10 },
  mapView: { flex: 1 },
  mapPlaceholder: { height: 200, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  locationActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  locationActionButton: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  locationActionSecondary: { backgroundColor: '#F3F4F6' },
  locationActionPrimary: { backgroundColor: '#2563EB' },
  
  scheduleSection: { marginBottom: 15 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  scheduleLabel: { fontSize: 12, color: '#6B7280' },
  scheduleInput: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, fontSize: 12 },
  weeklyOffGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  weeklyOffChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: '#F3F4F6' },
  weeklyOffChipSelected: { backgroundColor: '#F59E0B' },
  weeklyOffText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  weeklyOffTextSelected: { color: 'white' },
  
  scheduleModeToggle: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 4 },
  scheduleModeOption: { flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  scheduleModeOptionActive: { backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  scheduleModeText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  scheduleModeTextActive: { color: '#2563EB', fontWeight: '600' },
  
  dayScheduleCard: { marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, backgroundColor: 'white' },
  dayScheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayScheduleDay: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  dayOffToggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#10B981', borderWidth: 1, borderColor: '#10B981' },
  dayOffToggleActive: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  dayOffToggleText: { fontSize: 12, fontWeight: '600', color: 'white' },
  dayOffToggleTextActive: { color: 'white' },
  dayScheduleInputs: { marginTop: 8 },
});
