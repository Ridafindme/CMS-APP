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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  consultation_currency: string | null;
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

type CountryMeta = {
  country_code: string;
  phone_config: any;
};

type CurrencyRecord = {
  code: string;
  symbol: string;
  name_en: string;
  name_ar: string;
};

type CurrencyOption = {
  value: string;
  symbol: string;
  label: string;
  description: string;
};

const startOfDay = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const startOfMonth = (date: Date) => {
  const normalized = startOfDay(date);
  normalized.setDate(1);
  return normalized;
};

const dateToIso = (date: Date) => date.toISOString().split('T')[0];

const buildCalendarWeeks = (monthDate: Date) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<Date | null> = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: Array<Array<Date | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
};

const isSameIsoDate = (date: Date, isoDate: string | null) => {
  if (!isoDate) return false;
  return dateToIso(date) === isoDate;
};

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
  const [showAddClinicModal, setShowAddClinicModal] = useState(false);
  const [showEditClinicModal, setShowEditClinicModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showBlockTimeModal, setShowBlockTimeModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showLocationPickerModal, setShowLocationPickerModal] = useState(false);

  const [addingClinic, setAddingClinic] = useState(false);
  const [savingClinicEdit, setSavingClinicEdit] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [blockingSlots, setBlockingSlots] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);

  // Holiday Modal
  const [holidayDate, setHolidayDate] = useState<string | null>(null);
  const [holidayReason, setHolidayReason] = useState('');
  const [removingHolidayDate, setRemovingHolidayDate] = useState<string | null>(null);
  const [holidayCalendarMonth, setHolidayCalendarMonth] = useState<Date>(() => startOfMonth(new Date()));

  const [newClinic, setNewClinic] = useState<ClinicDraft>({
    clinic_name: '',
    address: '',
    consultation_fee: '',
    consultation_currency: null,
    latitude: null,
    longitude: null,
  });

  const [editClinicId, setEditClinicId] = useState<string | null>(null);
  const [editClinicDraft, setEditClinicDraft] = useState<EditClinicDraftState>({
    clinic_name: '',
    address: '',
    consultation_fee: '',
    consultation_currency: null,
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
  const [blockStepIndex, setBlockStepIndex] = useState(0);

  const [mapSelection, setMapSelection] = useState<MapSelection | null>(null);
  const [mapMarker, setMapMarker] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [locationSearchAddress, setLocationSearchAddress] = useState('');
  const [locationPickerTarget, setLocationPickerTarget] = useState<'new' | 'edit'>('new');

  const [expandedClinics, setExpandedClinics] = useState<Set<string>>(new Set());
  const [expandedBlockedClinics, setExpandedBlockedClinics] = useState<Set<string>>(new Set());
  const [expandedBlockedMonths, setExpandedBlockedMonths] = useState<Record<string, string[]>>({});
  const [expandedHolidayDays, setExpandedHolidayDays] = useState<Set<string>>(new Set());
  const [collapsedHolidayYears, setCollapsedHolidayYears] = useState<Set<string>>(new Set());
  const [defaultCountryMeta, setDefaultCountryMeta] = useState<CountryMeta | null>(null);
  const [countryMetaLoading, setCountryMetaLoading] = useState(false);
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [currencyMap, setCurrencyMap] = useState<Record<string, CurrencyRecord>>({});
  const [defaultCurrencyCode, setDefaultCurrencyCode] = useState<string | null>(null);
  const [newClinicCurrencyManuallySet, setNewClinicCurrencyManuallySet] = useState(false);
  const [editClinicCurrencyManuallySet, setEditClinicCurrencyManuallySet] = useState(false);

  const normalizeFeeToNumber = (amount?: string | null) => {
    if (!amount) return null;
    const normalized = amount.replace(/[^0-9.,]/g, '').replace(/,/g, '');
    if (!normalized) return null;
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const getAutoCurrencyCode = (amount?: string | null) => {
    const numericValue = normalizeFeeToNumber(amount);
    if (numericValue === null) return null;
    return numericValue > 1000 ? 'LBP' : 'USD';
  };

  const resolveCurrencyCode = (preferred?: string | null, amount?: string | null) => {
    if (preferred && currencyMap[preferred]) return preferred;
    const auto = getAutoCurrencyCode(amount);
    if (auto && currencyMap[auto]) return auto;
    if (defaultCurrencyCode && currencyMap[defaultCurrencyCode]) return defaultCurrencyCode;
    if (currencyMap['LBP']) return 'LBP';
    if (currencyMap['USD']) return 'USD';
    const firstKey = Object.keys(currencyMap)[0];
    return firstKey || 'LBP';
  };

  useEffect(() => {
    fetchClinics();
    fetchBlockedSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDefaultCountryMeta = useCallback(async (): Promise<CountryMeta | null> => {
    try {
      setCountryMetaLoading(true);
      const { data, error } = await supabase
        .from('countries')
        .select('country_code, phone_config')
        .eq('is_default', true)
        .single();

      if (error) {
        console.error('Error fetching default country metadata:', error);
        return null;
      }

      const typedData = (data as CountryMeta) || null;
      if (typedData) {
        setDefaultCountryMeta(typedData);
      }

      return typedData;
    } catch (error) {
      console.error('Error fetching default country metadata:', error);
      return null;
    } finally {
      setCountryMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDefaultCountryMeta();
  }, [fetchDefaultCountryMeta]);

  useEffect(() => {
    if (showAddClinicModal) {
      setNewClinicCurrencyManuallySet(false);
    }
  }, [showAddClinicModal]);

  useEffect(() => {
    if (showEditClinicModal) {
      setEditClinicCurrencyManuallySet(false);
    }
  }, [showEditClinicModal]);

  const fetchActiveCurrencies = useCallback(async () => {
    const fallback = [
      {
        currency_code: 'LBP',
        currency_name_en: 'Lebanese Pound',
        currency_name_ar: 'الليرة اللبنانية',
        currency_symbol: 'ل.ل.',
        sort_order: 10,
      },
      {
        currency_code: 'USD',
        currency_name_en: 'US Dollar',
        currency_name_ar: 'الدولار الأميركي',
        currency_symbol: '$',
        sort_order: 20,
      },
    ];

    try {
      setCurrencyLoading(true);
      const { data, error } = await supabase
        .from('currencies')
        .select('currency_code, currency_name_en, currency_name_ar, currency_symbol, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      const records = !error && data && data.length > 0 ? data : fallback;
      const map = records.reduce((acc, entry) => {
        acc[entry.currency_code] = {
          code: entry.currency_code,
          symbol: entry.currency_symbol || entry.currency_code,
          name_en: entry.currency_name_en,
          name_ar: entry.currency_name_ar,
        };
        return acc;
      }, {} as Record<string, CurrencyRecord>);

      setCurrencyMap(map);
      setCurrencyOptions(
        records.map(entry => ({
          value: entry.currency_code,
          symbol: entry.currency_symbol || entry.currency_code,
          label: entry.currency_code,
          description: isRTL ? entry.currency_name_ar : entry.currency_name_en,
        }))
      );

      setDefaultCurrencyCode(prev => {
        if (prev) return prev;
        if (map['LBP']) return 'LBP';
        return records[0]?.currency_code || null;
      });
    } catch (error) {
      console.error('Error fetching currencies:', error);
      const fallbackMap = fallback.reduce((acc, entry) => {
        acc[entry.currency_code] = {
          code: entry.currency_code,
          symbol: entry.currency_symbol || entry.currency_code,
          name_en: entry.currency_name_en,
          name_ar: entry.currency_name_ar,
        };
        return acc;
      }, {} as Record<string, CurrencyRecord>);

      setCurrencyMap(fallbackMap);
      setCurrencyOptions(
        fallback.map(entry => ({
          value: entry.currency_code,
          symbol: entry.currency_symbol || entry.currency_code,
          label: entry.currency_code,
          description: isRTL ? entry.currency_name_ar : entry.currency_name_en,
        }))
      );
      setDefaultCurrencyCode(prev => prev || 'LBP');
    } finally {
      setCurrencyLoading(false);
    }
  }, [isRTL, supabase]);

  useEffect(() => {
    fetchActiveCurrencies();
  }, [fetchActiveCurrencies]);

  const ensureCountryMeta = useCallback(async () => {
    if (defaultCountryMeta) return defaultCountryMeta;
    return fetchDefaultCountryMeta();
  }, [defaultCountryMeta, fetchDefaultCountryMeta]);

  useEffect(() => {
    if (!defaultCurrencyCode) return;
    setNewClinic(prev => (
      prev.consultation_currency
        ? prev
        : { ...prev, consultation_currency: defaultCurrencyCode }
    ));

    if (showEditClinicModal && !editClinicDraft.consultation_currency) {
      setEditClinicDraft(prev => ({
        ...prev,
        consultation_currency: defaultCurrencyCode,
      }));
    }
  }, [defaultCurrencyCode, editClinicDraft.consultation_currency, showEditClinicModal]);

  useEffect(() => {
    if (newClinicCurrencyManuallySet) return;
    const autoCode = getAutoCurrencyCode(newClinic.consultation_fee);
    const resolved = autoCode && currencyMap[autoCode] ? autoCode : null;

    if (resolved && resolved !== newClinic.consultation_currency) {
      setNewClinic(prev => ({ ...prev, consultation_currency: resolved }));
      return;
    }

    if (!resolved && !newClinic.consultation_currency && defaultCurrencyCode) {
      setNewClinic(prev => ({ ...prev, consultation_currency: defaultCurrencyCode }));
    }
  }, [newClinic.consultation_fee, newClinic.consultation_currency, newClinicCurrencyManuallySet, currencyMap, defaultCurrencyCode]);

  useEffect(() => {
    if (!showEditClinicModal || editClinicCurrencyManuallySet) return;
    const autoCode = getAutoCurrencyCode(editClinicDraft.consultation_fee);
    const resolved = autoCode && currencyMap[autoCode] ? autoCode : null;

    if (resolved && resolved !== editClinicDraft.consultation_currency) {
      setEditClinicDraft(prev => ({ ...prev, consultation_currency: resolved }));
      return;
    }

    if (!resolved && !editClinicDraft.consultation_currency && defaultCurrencyCode) {
      setEditClinicDraft(prev => ({ ...prev, consultation_currency: defaultCurrencyCode }));
    }
  }, [editClinicDraft.consultation_fee, editClinicDraft.consultation_currency, editClinicCurrencyManuallySet, showEditClinicModal, currencyMap, defaultCurrencyCode]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchClinics(), fetchBlockedSlots(), fetchHolidays()]);
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

  const minHolidayDate = useMemo(() => startOfDay(new Date()), []);
  const minHolidayMonth = useMemo(() => startOfMonth(minHolidayDate), [minHolidayDate]);
  const todayIsoDate = useMemo(() => dateToIso(minHolidayDate), [minHolidayDate]);

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
      Alert.alert(
        t.common.error,
        isRTL ? 'يرجى اختيار موقع على الخريطة' : 'Please choose a location on the map'
      );
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
    Alert.alert(
      t.common.success,
      isRTL ? 'تم اختيار الموقع بنجاح' : 'Location selected successfully'
    );
  };

  const searchLocation = async () => {
    if (!locationSearchAddress.trim()) {
      Alert.alert(
        t.common.error,
        isRTL ? 'يرجى إدخال عنوان للبحث' : 'Please enter an address to search'
      );
      return;
    }

    try {
      const results = await Location.geocodeAsync(locationSearchAddress);
      if (results.length === 0) {
        Alert.alert(
          t.common.error,
          isRTL ? 'لم يتم العثور على العنوان' : 'Address not found'
        );
        return;
      }

      const { latitude, longitude } = results[0];
      await setSelectionFromCoords(latitude, longitude);
    } catch (error) {
      Alert.alert(
        t.common.error,
        isRTL ? 'حدث خطأ أثناء البحث عن الموقع' : 'Error searching for location'
      );
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
        Alert.alert(
          t.common.success,
          isRTL ? 'تم تعيين الموقع الحالي بنجاح' : 'Current location set successfully'
        );
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

    const resolvedCurrency = resolveCurrencyCode(newClinic.consultation_currency, newClinic.consultation_fee);

    setAddingClinic(true);
    const success = await addClinic({
      clinic_name: newClinic.clinic_name,
      address: newClinic.address,
      latitude: newClinic.latitude ?? undefined,
      longitude: newClinic.longitude ?? undefined,
      consultation_fee: newClinic.consultation_fee || undefined,
      consultation_currency: resolvedCurrency,
      is_active: false,
    });

    setAddingClinic(false);

    if (success) {
      Alert.alert(t.common.success, t.doctorApp?.clinicActivationNote || 'Clinic added successfully');
      setShowAddClinicModal(false);
      setNewClinicCurrencyManuallySet(false);
      setNewClinic({
        clinic_name: '',
        address: '',
        consultation_fee: '',
        consultation_currency: defaultCurrencyCode || resolvedCurrency || null,
        latitude: null,
        longitude: null,
      });
    } else {
      Alert.alert(
        t.common.error,
        isRTL ? 'فشل في إضافة العيادة' : 'Failed to add clinic'
      );
    }
  };

  // Edit Clinic Functions
  const openEditClinicModal = (clinic: Clinic) => {
    setEditClinicId(clinic.id);
    setEditClinicDraft({
      clinic_name: clinic.clinic_name || '',
      address: clinic.address || '',
      consultation_fee: clinic.consultation_fee || '',
      consultation_currency: clinic.consultation_currency || defaultCurrencyCode || null,
      latitude: clinic.latitude ?? null,
      longitude: clinic.longitude ?? null,
      mobile: clinic.mobile || '',
      landline: clinic.landline || '',
      whatsapp: clinic.whatsapp || '',
      mobileLocal: '',
      landlineLocal: '',
      whatsappLocal: '',
    });
    // If clinic has a currency set, mark as manually set to prevent auto-currency override
    setEditClinicCurrencyManuallySet(Boolean(clinic.consultation_currency));
    setShowEditClinicModal(true);
  };

  const handleSaveClinicEdit = async () => {
    if (!editClinicId) return;
    
    // Load country data for validation
    const countryData = await ensureCountryMeta();

    if (!countryData?.phone_config) {
      Alert.alert(
        t.common.error,
        isRTL ? 'تعذر التحقق من أرقام الهاتف' : 'Unable to validate phone numbers'
      );
      return;
    }
    
    // Check if user has started typing a mobile number but it's incomplete/invalid
    if (editClinicDraft.mobileLocal && editClinicDraft.mobileLocal.length > 0 && !editClinicDraft.mobile) {
      Alert.alert(
        t.common.error,
        isRTL ? 'الموبايل: يرجى إدخال رقم صالح' : 'Mobile: Please enter a valid phone number'
      );
      return;
    }
    
    // Validate mobile if provided
    if (editClinicDraft.mobile && editClinicDraft.mobile.trim()) {
      const localNumber = fromE164(editClinicDraft.mobile, countryData.country_code);
      if (!localNumber || localNumber.length === 0) {
        Alert.alert(
          t.common.error,
          isRTL ? 'الموبايل: صيغة رقم غير صحيحة' : 'Mobile: Invalid phone number format'
        );
        return;
      }
      const validation = validatePhone(localNumber, countryData.phone_config, 'mobile');
      if (!validation.valid) {
        Alert.alert(
          t.common.error,
          isRTL ? `الموبايل: ${validation.error}` : `Mobile: ${validation.error}`
        );
        return;
      }
    }
    
    // Check if user has started typing a landline number but it's incomplete/invalid
    if (editClinicDraft.landlineLocal && editClinicDraft.landlineLocal.length > 0 && !editClinicDraft.landline) {
      Alert.alert(
        t.common.error,
        isRTL ? 'الهاتف الأرضي: يرجى إدخال رقم صالح' : 'Landline: Please enter a valid phone number'
      );
      return;
    }
    
    // Validate landline if provided
    if (editClinicDraft.landline && editClinicDraft.landline.trim()) {
      const localNumber = fromE164(editClinicDraft.landline, countryData.country_code);
      if (!localNumber || localNumber.length === 0) {
        Alert.alert(
          t.common.error,
          isRTL ? 'الهاتف الأرضي: صيغة رقم غير صحيحة' : 'Landline: Invalid phone number format'
        );
        return;
      }
      const validation = validatePhone(localNumber, countryData.phone_config, 'landline');
      if (!validation.valid) {
        Alert.alert(
          t.common.error,
          isRTL ? `الهاتف الأرضي: ${validation.error}` : `Landline: ${validation.error}`
        );
        return;
      }
    }
    
    // Check if user has started typing a whatsapp number but it's incomplete/invalid
    if (editClinicDraft.whatsappLocal && editClinicDraft.whatsappLocal.length > 0 && !editClinicDraft.whatsapp) {
      Alert.alert(
        t.common.error,
        isRTL ? 'واتساب: يرجى إدخال رقم صالح' : 'WhatsApp: Please enter a valid phone number'
      );
      return;
    }
    
    // Validate whatsapp if provided
    if (editClinicDraft.whatsapp && editClinicDraft.whatsapp.trim()) {
      const localNumber = fromE164(editClinicDraft.whatsapp, countryData.country_code);
      if (!localNumber || localNumber.length === 0) {
        Alert.alert(
          t.common.error,
          isRTL ? 'واتساب: صيغة رقم غير صحيحة' : 'WhatsApp: Invalid phone number format'
        );
        return;
      }
      const validation = validatePhone(localNumber, countryData.phone_config, 'mobile');
      if (!validation.valid) {
        Alert.alert(
          t.common.error,
          isRTL ? `واتساب: ${validation.error}` : `WhatsApp: ${validation.error}`
        );
        return;
      }
    }
    
    setSavingClinicEdit(true);
    const resolvedCurrency = resolveCurrencyCode(editClinicDraft.consultation_currency, editClinicDraft.consultation_fee);
    const success = await updateClinic(editClinicId, {
      clinic_name: editClinicDraft.clinic_name.trim(),
      address: editClinicDraft.address.trim(),
      consultation_fee: editClinicDraft.consultation_fee.trim() || undefined,
      consultation_currency: resolvedCurrency,
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
      Alert.alert(
        t.common.error,
        isRTL ? 'فشل في تحديث العيادة' : 'Failed to update clinic'
      );
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
              Alert.alert(
                t.common.error,
                isRTL ? 'فشل في إلغاء تفعيل العيادة' : 'Failed to deactivate clinic'
              );
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
      Alert.alert(
        t.common.error,
        isRTL ? 'فشل في تحديث الجدول' : 'Failed to update schedule'
      );
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
    setBlockStepIndex(0);
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
        setBlockStepIndex(0);
      } else {
        Alert.alert(
          t.common.error,
          isRTL ? 'فشل في حظر بعض الأوقات' : 'Failed to block some slots'
        );
      }
    } catch (error: any) {
      Alert.alert(t.common.error, error.message);
    } finally {
      setBlockingSlots(false);
    }
  };

  const handleUnblockSlot = async (slotId: string) => {
    Alert.alert(
      isRTL ? 'إلغاء الحجر' : 'Unblock Slot',
      isRTL ? 'هل تريد إلغاء حجر هذا الوقت؟' : 'Do you want to unblock this time slot?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.confirm,
          onPress: async () => {
            const success = await removeBlockedSlot(slotId);
            if (!success) {
              Alert.alert(
                t.common.error,
                isRTL ? 'فشل في إلغاء حجز الوقت' : 'Failed to unblock slot'
              );
            }
          },
        },
      ]
    );
  };

  // Holiday Functions
  const openHolidayModal = () => {
    const defaultDate = startOfDay(new Date());
    setHolidayCalendarMonth(startOfMonth(defaultDate));
    setHolidayDate(dateToIso(defaultDate));
    setHolidayReason('');
    setShowHolidayModal(true);
  };

  const holidayCalendarWeeks = useMemo(
    () => buildCalendarWeeks(holidayCalendarMonth),
    [holidayCalendarMonth]
  );

  const holidayCalendarLabel = useMemo(
    () =>
      holidayCalendarMonth.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [holidayCalendarMonth, isRTL]
  );

  const calendarWeekdayLabels = useMemo(() => {
    const referenceSunday = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(referenceSunday);
      day.setDate(referenceSunday.getDate() + index);
      return day.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { weekday: 'short' });
    });
  }, [isRTL]);

  const canGoToPrevHolidayMonth = useMemo(
    () => holidayCalendarMonth.getTime() > minHolidayMonth.getTime(),
    [holidayCalendarMonth, minHolidayMonth]
  );

  const goToAdjacentHolidayMonth = (direction: 1 | -1) => {
    if (direction === -1 && !canGoToPrevHolidayMonth) {
      return;
    }

    setHolidayCalendarMonth(prev => {
      const next = startOfMonth(new Date(prev));
      next.setMonth(prev.getMonth() + direction);
      return startOfMonth(next);
    });
  };

  const handleSelectHolidayDate = (selectedDate: Date) => {
    if (selectedDate.getTime() < minHolidayDate.getTime()) {
      return;
    }
    setHolidayDate(dateToIso(startOfDay(selectedDate)));
  };

  const handleAddHoliday = async () => {
    if (!holidayDate) {
      Alert.alert(t.common.error, isRTL ? 'يرجى اختيار تاريخ العطلة' : 'Please select a holiday date');
      return;
    }

    if (clinics.length === 0) {
      Alert.alert(t.common.error, isRTL ? 'لا توجد عيادات لإضافة عطلة إليها' : 'No clinics available to apply the holiday');
      return;
    }

    setSavingHoliday(true);

    try {
      const allClinicIds = clinics.map(clinic => clinic.id);
      const existingEntries = holidays.filter(entry => entry.holiday_date === holidayDate);
      const existingClinicIds = new Set(existingEntries.map(entry => entry.clinic_id));
      const clinicsToAdd = allClinicIds.filter(id => !existingClinicIds.has(id));

      if (clinicsToAdd.length === 0) {
        Alert.alert(
          t.common.success,
          isRTL ? 'هذه العطلة مضافة بالفعل لكل العيادات' : 'This holiday already applies to all clinics'
        );
        setShowHolidayModal(false);
        return;
      }

      let allSuccess = true;
      for (const clinicId of clinicsToAdd) {
        const success = await addHoliday(clinicId, holidayDate, holidayReason);
        if (!success) allSuccess = false;
      }

      if (allSuccess) {
        Alert.alert(t.common.success, isRTL ? 'تم تفعيل العطلة لكل العيادات' : 'Holiday added for all clinics');
        setShowHolidayModal(false);
      } else {
        Alert.alert(t.common.error, isRTL ? 'تعذر إضافة العطلة لبعض العيادات' : 'Failed to add the holiday for some clinics');
      }
    } finally {
      setSavingHoliday(false);
    }
  };

  const removeHolidayDateEntries = async (dateKey: string) => {
    const entries = holidays.filter(entry => entry.holiday_date === dateKey);
    if (entries.length === 0) {
      return;
    }

    setRemovingHolidayDate(dateKey);
    let allSuccess = true;

    try {
      for (const entry of entries) {
        const success = await removeHoliday(entry.id);
        if (!success) {
          allSuccess = false;
        }
      }
    } finally {
      setRemovingHolidayDate(null);
    }

    if (!allSuccess) {
      Alert.alert(t.common.error, isRTL ? 'تعذر حذف العطلة لبعض العيادات' : 'Failed to remove the holiday for some clinics');
    } else {
      Alert.alert(t.common.success, isRTL ? 'تم حذف العطلة لهذا اليوم' : 'Holiday removed for that day');
    }
  };

  const handleRemoveHolidayDate = (dateKey: string) => {
    Alert.alert(
      t.doctorDashboard?.removeHoliday || (isRTL ? 'حذف العطلة' : 'Remove Holiday'),
      isRTL
        ? 'سيتم حذف العطلة لكل العيادات في هذا اليوم'
        : 'This will remove the holiday for every clinic on that day.',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.confirm,
          style: 'destructive',
          onPress: () => removeHolidayDateEntries(dateKey),
        },
      ]
    );
  };

  // Utility Functions
  const formatTime = (time: string) => {
    const [hours, minutes = '00'] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? (isRTL ? 'م' : 'PM') : (isRTL ? 'ص' : 'AM');
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes.padStart(2, '0')} ${ampm}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getClinicName = (clinicId: string | null | undefined) =>
    clinics.find(c => c.id === clinicId)?.clinic_name || null;

  const isHoliday = (clinicId: string | null, dateString: string) =>
    holidays.some(h => h.clinic_id === clinicId && h.holiday_date === dateString);

  const getLocalizedDayLabel = (dayKey: DayKey) => {
    const dayIndex = DAY_KEYS.indexOf(dayKey);
    const baseDate = new Date(2024, 0, 7 + dayIndex);
    return baseDate.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { weekday: 'short' });
  };

  const getMonthGroupingKey = (dateString: string) => {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
  };

  const formatMonthLabel = (dateString: string) => {
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return dateString;
    }
    return date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' });
  };

  const groupBlockedSlotsByMonth = (slots: typeof blockedSlots) => {
    const groups: Record<string, { label: string; slots: typeof slots }> = {};
    slots.forEach(slot => {
      const monthKey = getMonthGroupingKey(slot.blocked_date);
      if (!groups[monthKey]) {
        groups[monthKey] = {
          label: formatMonthLabel(slot.blocked_date),
          slots: [],
        };
      }
      groups[monthKey].slots.push(slot);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .map(([monthKey, group]) => {
        group.slots.sort((first, second) => {
          if (first.blocked_date === second.blocked_date) {
            return first.time_slot.localeCompare(second.time_slot);
          }
          return first.blocked_date.localeCompare(second.blocked_date);
        });
        return { monthKey, ...group };
      });
  };

  const getBlockedSlotCountLabel = (count: number) => {
    if (isRTL) {
      return `${count} ${count === 1 ? 'فترة محجوزة' : 'فترات محجوزة'}`;
    }
    return `${count} ${count === 1 ? 'blocked slot' : 'blocked slots'}`;
  };

  const groupHolidaysByDate = (items: typeof holidays) => {
    const groups: Record<string, typeof holidays> = {};
    items.forEach((holiday) => {
      if (!holiday.holiday_date) return;
      if (!groups[holiday.holiday_date]) {
        groups[holiday.holiday_date] = [];
      }
      groups[holiday.holiday_date].push(holiday);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .map(([dateKey, dateHolidays]) => {
        const sortedEntries = [...dateHolidays].sort((first, second) => {
          const firstName = getClinicName(first.clinic_id) || '';
          const secondName = getClinicName(second.clinic_id) || '';
          return firstName.localeCompare(secondName);
        });
        const reason = sortedEntries.find(entry => entry.reason?.trim())?.reason?.trim() || '';
        return {
          dateKey,
          label: formatDate(dateKey),
          holidays: sortedEntries,
          reason,
        };
      });
  };

  const groupHolidaysByYear = (items: typeof holidays) => {
    const dateGroups = groupHolidaysByDate(items);
    const yearlyMap: Record<string, typeof dateGroups> = {};

    dateGroups.forEach((group) => {
      const inferredYear = group.dateKey?.slice(0, 4) || 'Unknown';
      if (!yearlyMap[inferredYear]) {
        yearlyMap[inferredYear] = [];
      }
      yearlyMap[inferredYear].push(group);
    });

    return Object.entries(yearlyMap)
      .sort(([a], [b]) => (a > b ? -1 : 1))
      .map(([year, days]) => ({
        year,
        label: year,
        days,
      }));
  };

  const getHolidayCountLabel = (count: number) => {
    if (isRTL) {
      return `${count} ${count === 1 ? 'عطلة' : 'عطل'}`;
    }
    return `${count} ${count === 1 ? 'holiday' : 'holidays'}`;
  };

  const getCurrencyMeta = (currencyCode?: string | null) => {
    if (!currencyCode) return null;
    if (currencyMap[currencyCode]) {
      return {
        code: currencyMap[currencyCode].code,
        symbol: currencyMap[currencyCode].symbol,
      };
    }
    if (currencyCode === 'USD') {
      return { code: 'USD', symbol: '$' };
    }
    if (currencyCode === 'LBP') {
      return { code: 'LBP', symbol: 'LBP' };
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
    const normalizedAmount = amount.trim();
    if (currencyMeta.code === 'USD') {
      return `${currencyMeta.symbol}${normalizedAmount}`;
    }
    return `${currencyMeta.symbol} ${normalizedAmount}`;
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

  const toggleBlockedClinic = (clinicId: string) => {
    setExpandedBlockedClinics(prev => {
      const next = new Set(prev);
      if (next.has(clinicId)) {
        next.delete(clinicId);
      } else {
        next.add(clinicId);
      }
      return next;
    });
  };

  const toggleBlockedMonth = (clinicId: string, monthKey: string) => {
    setExpandedBlockedMonths(prev => {
      const current = prev[clinicId] || [];
      const isExpanded = current.includes(monthKey);
      const updated = isExpanded ? current.filter(key => key !== monthKey) : [...current, monthKey];
      if (updated.length === 0) {
        const { [clinicId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [clinicId]: updated };
    });
  };

  const toggleHolidayDay = (dateKey: string) => {
    setExpandedHolidayDays(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  const toggleHolidayYear = (yearKey: string) => {
    setCollapsedHolidayYears(prev => {
      const next = new Set(prev);
      if (next.has(yearKey)) {
        next.delete(yearKey);
      } else {
        next.add(yearKey);
      }
      return next;
    });
  };

  const renderModalSectionHeader = (
    icon: React.ComponentProps<typeof Ionicons>['name'],
    title: string,
    description?: string
  ) => (
    <View style={[styles.modalSectionHeader, isRTL && styles.rowReverse]}>
      <View style={[styles.modalSectionIcon, isRTL && styles.sectionIconRtl]}>
        <Ionicons name={icon} size={16} color={theme.colors.primary} />
      </View>
      <View style={[styles.modalSectionHeaderText, isRTL && styles.alignRight]}>
        <Text style={[styles.modalSectionTitle, isRTL && styles.textRight]}>{title}</Text>
        {description ? (
          <Text style={[styles.modalSectionDescription, isRTL && styles.textRight]}>
            {description}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const CurrencySelector = ({ value, onChange }: { value: string | null; onChange: (currency: string) => void }) => {
    if (currencyLoading) {
      return (
        <View style={styles.currencyLoading}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.helperText, isRTL && styles.textRight]}>
            {isRTL ? '...جاري تحميل العملات' : 'Loading currency options...'}
          </Text>
        </View>
      );
    }

    if (!currencyOptions.length) {
      return (
        <View style={styles.currencyLoading}>
          <Ionicons name="alert-circle-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.helperText, isRTL && styles.textRight]}>
            {isRTL ? 'تعذر تحميل العملات' : 'Unable to load currency choices'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.currencyOptionsWrap}>
        {currencyOptions.map((option) => {
          const isSelected = value === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.currencyOption,
                isSelected && styles.currencyOptionSelected,
                isRTL && styles.rowReverse,
              ]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.currencyRadio,
                  isSelected && styles.currencyRadioSelected,
                  isRTL && styles.currencyRadioRtl,
                ]}
              >
                {isSelected && <View style={styles.currencyRadioDot} />}
              </View>
              <View style={[styles.currencyOptionText, isRTL && styles.alignRight]}>
                <Text style={[styles.currencyOptionLabel, isRTL && styles.textRight]}>
                  {option.symbol} ({option.label})
                </Text>
                <Text style={[styles.currencyOptionDescription, isRTL && styles.textRight]}>
                  {option.description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
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

  const selectedBlockClinicName = selectedBlockClinicId ? getClinicName(selectedBlockClinicId) : null;
  const selectedBlockDateLabel = selectedBlockDate
    ? formatDate(selectedBlockDate)
    : (isRTL ? 'اختر تاريخاً' : 'Pick a date');
  const selectedBlockSlotsLabel = selectedBlockSlots.length > 0
    ? `${selectedBlockSlots.length} ${isRTL
        ? selectedBlockSlots.length === 1 ? 'فترة' : 'فترات'
        : selectedBlockSlots.length === 1 ? 'slot' : 'slots'
      }`
    : (isRTL ? 'لا فترات محددة' : 'No slots selected');
  const blockSummaryItems = [
    {
      key: 'clinic',
      icon: 'business-outline' as const,
      label: t.doctorDashboard?.clinicLabel || 'Clinic',
      value: selectedBlockClinicName || (isRTL ? 'اختر عيادة' : 'Select a clinic'),
    },
    {
      key: 'date',
      icon: 'calendar-outline' as const,
      label: t.doctorDashboard?.dateLabel || 'Date',
      value: selectedBlockDateLabel,
    },
    {
      key: 'slots',
      icon: 'time-outline' as const,
      label: isRTL ? 'الفترات' : 'Slots',
      value: selectedBlockSlotsLabel,
    },
  ];

  const blockStepCompletion = [
    Boolean(selectedBlockClinicId),
    Boolean(selectedBlockDate),
    selectedBlockSlots.length > 0,
  ];

  const blockSteps = [
    {
      key: 'clinic',
      label: isRTL ? 'العيادة' : 'Clinic',
      done: blockStepCompletion[0],
    },
    {
      key: 'date',
      label: t.doctorDashboard?.dateLabel || 'Date',
      done: blockStepCompletion[1],
    },
    {
      key: 'slots',
      label: isRTL ? 'الفترات والملاحظة' : 'Slots & Reason',
      done: blockStepCompletion[2],
    },
  ];

  const canAdvanceBlockStep = blockStepCompletion[blockStepIndex];

  const handleNextBlockStep = () => {
    if (!canAdvanceBlockStep) {
      Alert.alert(t.common.error, isRTL ? 'أكمل هذه الخطوة للمتابعة' : 'Please complete this step before continuing');
      return;
    }
    setBlockStepIndex(prev => Math.min(prev + 1, blockSteps.length - 1));
  };

  const handlePrevBlockStep = () => {
    setBlockStepIndex(prev => Math.max(prev - 1, 0));
  };

  const renderBlockStepContent = () => {
    switch (blockStepIndex) {
      case 0:
        return (
          <View style={styles.modalSectionCard}>
            {renderModalSectionHeader(
              'business-outline',
              t.doctorDashboard?.clinicLabel || 'Clinic',
              isRTL ? 'اختر العيادة المطلوب إيقاف حجوزاتها' : 'Choose which clinic to pause'
            )}
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
                    <Text
                      style={[
                        styles.clinicChipText,
                        selectedBlockClinicId === clinic.id && styles.clinicChipTextSelected,
                      ]}
                    >
                      {clinic.clinic_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        );
      case 1:
        return (
          <View style={styles.modalSectionCard}>
            {renderModalSectionHeader(
              'calendar-outline',
              t.doctorDashboard?.dateLabel || 'Date',
              isRTL ? 'اختر اليوم الذي تريد قفله' : 'Pick the day you want to block'
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
              {getNextDays().map((day) => (
                <TouchableOpacity
                  key={day.date}
                  style={[styles.dayCard, selectedBlockDate === day.date && styles.dayCardSelected]}
                  onPress={() => setSelectedBlockDate(day.date)}
                >
                  <Text style={[styles.dayName, selectedBlockDate === day.date && styles.dayTextSelected]}>
                    {day.dayName}
                  </Text>
                  <Text style={[styles.dayNumber, selectedBlockDate === day.date && styles.dayTextSelected]}>
                    {day.dayNumber}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );
      case 2:
      default:
        return (
          <>
            <View style={styles.modalSectionCard}>
              {renderModalSectionHeader(
                'time-outline',
                isRTL ? 'الأوقات' : 'Times',
                isRTL ? 'اضغط على الفترات لتحديدها أو إلغاءها' : 'Tap slots to toggle selection'
              )}
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
                      <Text
                        style={[
                          styles.timeSlotText,
                          selectedBlockSlots.includes(slot) && styles.timeSlotTextSelected,
                        ]}
                      >
                        {formatTime(slot)}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>

            <View style={styles.modalSectionCard}>
              {renderModalSectionHeader(
                'chatbubble-ellipses-outline',
                t.doctorDashboard?.reasonLabel || 'Reason',
                isRTL ? 'ملاحظة مرئية للفريق (اختياري)' : 'Optional note for your team'
              )}
              <TextInput
                style={[styles.textArea, isRTL && styles.textRight]}
                placeholder={isRTL ? 'اختياري...' : 'Optional...'}
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                value={blockReason}
                onChangeText={setBlockReason}
              />
            </View>
          </>
        );
    }
  };

  const holidayDateLabel = holidayDate
    ? formatDate(holidayDate)
    : (isRTL ? 'اختر تاريخاً' : 'Pick a date');
  const holidayNoteLabel = holidayReason.trim().length > 0
    ? holidayReason.trim()
    : (isRTL ? 'بدون ملاحظة' : 'No note yet');
  const holidaySummaryItems = [
    {
      key: 'date',
      icon: 'calendar-outline' as const,
      label: t.doctorDashboard?.dateLabel || 'Date',
      value: holidayDateLabel,
    },
    {
      key: 'note',
      icon: 'chatbubble-ellipses-outline' as const,
      label: isRTL ? 'الملاحظة' : 'Note',
      value: holidayNoteLabel,
    },
  ];

  const holidayYearGroups = groupHolidaysByYear(holidays);

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
            {/* Decorative elements */}
            <View style={styles.heroDecorativeCircle1} />
            <View style={styles.heroDecorativeCircle2} />
            
            <View style={[styles.heroHeader, isRTL && styles.rowReverse]}>
              <View style={[styles.heroTextGroup, isRTL && styles.alignRight]}>
                <View style={[styles.heroBadge, isRTL && styles.heroBadgeRtl]}>
                  <Ionicons name="business" size={12} color="#FFFFFF" />
                  <Text style={styles.heroEyebrow}>{isRTL ? 'لوحة التحكم' : 'Clinics Dashboard'}</Text>
                </View>
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
                <View style={styles.heroIconInner}>
                  <Ionicons name="business-outline" size={28} color="#FFFFFF" />
                </View>
              </View>
            </View>

            <View style={[styles.heroStatsRow, isRTL && styles.rowReverse]}>
              {heroStats.map((stat, index) => (
                <View key={stat.key} style={[styles.heroStatItem, isRTL && styles.alignRight]}>
                  <View style={[styles.heroStatCard, isRTL && styles.heroStatCardRtl]}>
                    <View style={styles.heroStatIconContainer}>
                      <Ionicons 
                        name={index === 0 ? "checkmark-circle" : "time-outline"} 
                        size={20} 
                        color="#FFFFFF" 
                      />
                    </View>
                    <View style={styles.heroStatTextGroup}>
                      <Text style={styles.heroStatValue}>{stat.value}</Text>
                      <Text style={[styles.heroStatLabel, isRTL && styles.textRight]}>{stat.label}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.heroCtaRow, isRTL && styles.rowReverse]}>
              <TouchableOpacity
                style={styles.heroPrimaryCta}
                onPress={() => setShowAddClinicModal(true)}
                activeOpacity={0.8}
              >
                <View style={styles.heroCtaIconContainer}>
                  <Ionicons name="add" size={20} color={theme.colors.primary} />
                </View>
                <Text style={[styles.heroPrimaryCtaText, isRTL && styles.ctaTextRtl]}>
                  {isRTL ? 'عيادة جديدة' : 'New Clinic'}
                </Text>
                <Ionicons 
                  name={isRTL ? "arrow-back" : "arrow-forward"} 
                  size={16} 
                  color="#FFFFFF" 
                />
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
            const formattedConsultationFee = formatConsultationFeeValue(clinic.consultation_fee, clinic.consultation_currency);
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
                  {formattedConsultationFee ? (
                    <View style={styles.infoChip}>
                      <Ionicons name="cash-outline" size={14} color={theme.colors.accent} />
                      <Text style={styles.infoChipText}>{formattedConsultationFee}</Text>
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

        <View style={styles.sectionDivider} />

        {/* Blocked Slots */}
        <View style={[styles.tabHeader, isRTL && styles.rowReverse]}>
          <Text style={[styles.sectionSubtitle, isRTL && styles.textRight]}>
            {isRTL ? 'الأوقات المحجورة' : 'Blocked Times'}
          </Text>
          <TouchableOpacity style={styles.addButton} onPress={openBlockTimeModal}>
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addButtonText}>{isRTL ? 'حجر' : 'Block'}</Text>
          </TouchableOpacity>
        </View>
        {blockedSlots.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⏰</Text>
            <Text style={styles.emptyTitle}>{isRTL ? 'لا توجد أوقات محجورة' : 'No Blocked Slots'}</Text>
            <Text style={styles.emptyText}>
              {isRTL ? 'احجر أوقات معينة عند الحاجة' : 'Block specific time slots when needed'}
            </Text>
          </View>
        ) : (
          clinics.map((clinic) => {
            const clinicSlots = blockedSlots.filter(slot => slot.clinic_id === clinic.id);
            if (clinicSlots.length === 0) return null;
            const monthGroups = groupBlockedSlotsByMonth(clinicSlots);
            const isClinicExpanded = expandedBlockedClinics.has(clinic.id);
            const clinicSlotLabel = getBlockedSlotCountLabel(clinicSlots.length);
            return (
              <View key={clinic.id} style={styles.blockClinicGroup}>
                <TouchableOpacity
                  style={[styles.blockClinicRow, isRTL && styles.rowReverse]}
                  onPress={() => toggleBlockedClinic(clinic.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.blockClinicLabelGroup, isRTL && styles.rowReverse]}>
                    <View style={styles.blockClinicIcon}>
                      <Ionicons name="business-outline" size={18} color={theme.colors.primary} />
                    </View>
                    <View style={[styles.blockClinicTextGroup, isRTL && styles.alignRight]}>
                      <Text style={[styles.blockClinicName, isRTL && styles.textRight]}>
                        {clinic.clinic_name}
                      </Text>
                      <Text style={[styles.blockClinicCount, isRTL && styles.textRight]}>
                        {clinicSlotLabel}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isClinicExpanded ? 'chevron-down' : (isRTL ? 'chevron-back' : 'chevron-forward')}
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>

                {isClinicExpanded && monthGroups.map((month) => {
                  const expandedMonths = expandedBlockedMonths[clinic.id] || [];
                  const isMonthExpanded = expandedMonths.includes(month.monthKey);
                  const monthSlotLabel = getBlockedSlotCountLabel(month.slots.length);
                  return (
                    <View key={month.monthKey} style={styles.blockMonthGroup}>
                      <TouchableOpacity
                        style={[styles.blockMonthHeader, isRTL && styles.rowReverse]}
                        onPress={() => toggleBlockedMonth(clinic.id, month.monthKey)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.blockMonthHeaderLeft, isRTL && styles.rowReverse]}>
                          <Ionicons name="calendar-outline" size={16} color={theme.colors.accent} />
                          <Text style={[styles.blockMonthTitle, isRTL && styles.textRight]}>{month.label}</Text>
                        </View>
                        <View style={[styles.blockMonthMeta, isRTL && styles.rowReverse]}>
                          <Text style={styles.blockMonthCount}>{monthSlotLabel}</Text>
                          <Ionicons
                            name={isMonthExpanded ? 'chevron-down' : (isRTL ? 'chevron-back' : 'chevron-forward')}
                            size={16}
                            color={theme.colors.textSecondary}
                          />
                        </View>
                      </TouchableOpacity>

                      {isMonthExpanded && (
                        <View style={styles.blockMonthContent}>
                          {month.slots.map((slot) => (
                            <View key={slot.id} style={styles.blockedSlotCard}>
                              <View style={[styles.blockSlotTop, isRTL && styles.rowReverse]}>
                                <View style={[styles.blockSlotDateGroup, isRTL && styles.alignRight]}>
                                  <View style={[styles.inlineIconRow, isRTL && styles.rowReverse]}> 
                                    <Ionicons name="calendar-outline" size={16} color={theme.colors.accent} />
                                    <Text style={[styles.blockSlotDate, isRTL && styles.textRight]}>
                                      {formatDate(slot.blocked_date)}
                                    </Text>
                                  </View>
                                  <View style={[styles.blockSlotPillsRow, isRTL && styles.rowReverse]}>
                                    <View style={styles.blockSlotPill}>
                                      <Ionicons name="time-outline" size={12} color={theme.colors.primary} />
                                      <Text style={[styles.blockSlotPillText, isRTL && styles.actionTextRtl]}>
                                        {formatTime(slot.time_slot)}
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                                <TouchableOpacity
                                  style={[styles.blockSlotAction, isRTL && styles.rowReverse]}
                                  onPress={() => handleUnblockSlot(slot.id)}
                                >
                                  <Ionicons name="close-circle" size={18} color={theme.colors.danger} />
                                  <Text style={[styles.blockSlotActionText, isRTL && styles.actionTextRtl]}>
                                    {isRTL ? 'إلغاء' : 'Unblock'}
                                  </Text>
                                </TouchableOpacity>
                              </View>

                              {slot.reason ? (
                                <View style={[styles.inlineIconRow, isRTL && styles.rowReverse, { marginTop: 10 }]}> 
                                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={theme.colors.textSecondary} />
                                  <Text style={[styles.blockSlotReason, isRTL && styles.textRight]}>
                                    {slot.reason}
                                  </Text>
                                </View>
                              ) : (
                                <Text style={[styles.helperText, isRTL && styles.textRight, { marginTop: 10 }]}>
                                  {isRTL ? 'لا توجد ملاحظة' : 'No note added'}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
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
          holidayYearGroups.map((yearGroup) => {
            const isYearCollapsed = collapsedHolidayYears.has(yearGroup.year);
            return (
              <View key={yearGroup.year} style={styles.holidayYearGroup}>
                <TouchableOpacity
                  style={[styles.holidayYearHeader, isRTL && styles.rowReverse]}
                  onPress={() => toggleHolidayYear(yearGroup.year)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.holidayYearLabel, isRTL && styles.textRight]}>{yearGroup.label}</Text>
                  <Ionicons
                    name={isYearCollapsed ? (isRTL ? 'chevron-back' : 'chevron-forward') : 'chevron-down'}
                    size={18}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
                {!isYearCollapsed && yearGroup.days.map((group) => {
                const isDayExpanded = expandedHolidayDays.has(group.dateKey);
                const clinicEntries = Array.from(
                  new Map(
                    group.holidays.map(entry => {
                      const key = entry.clinic_id || entry.id;
                      const name = getClinicName(entry.clinic_id) || (isRTL ? 'عيادة غير معروفة' : 'Unknown clinic');
                      return [key, name] as const;
                    })
                  ).entries()
                ).map(([id, name]) => ({ id, name }));
                const clinicCountLabel = getHolidayCountLabel(group.holidays.length);
                const hasReason = Boolean(group.reason);

                return (
                  <View key={group.dateKey} style={styles.holidayDayGroup}>
                    <TouchableOpacity
                      style={[styles.holidayDayHeader, isRTL && styles.rowReverse]}
                      onPress={() => toggleHolidayDay(group.dateKey)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.holidayDayLeft, isRTL && styles.rowReverse]}>
                        <View style={styles.holidayDayIcon}>
                          <Ionicons name="calendar-clear-outline" size={18} color={theme.colors.primary} />
                        </View>
                        <View style={[styles.holidayDayTextGroup, isRTL && styles.alignRight]}>
                          <Text style={[styles.holidayDayTitle, isRTL && styles.textRight]}>{group.label}</Text>
                          <Text style={[styles.holidayDayCount, isRTL && styles.textRight]}>{clinicCountLabel}</Text>
                        </View>
                      </View>
                      <Ionicons
                        name={isDayExpanded ? 'chevron-down' : (isRTL ? 'chevron-back' : 'chevron-forward')}
                        size={18}
                        color={theme.colors.textSecondary}
                      />
                    </TouchableOpacity>

                    {isDayExpanded && (
                      <View style={styles.holidayDayContent}>
                        <View style={[styles.holidayReasonCard, isRTL && styles.rowReverse]}>
                          <Ionicons
                            name={hasReason ? 'chatbubble-ellipses-outline' : 'information-circle-outline'}
                            size={16}
                            color={theme.colors.textSecondary}
                          />
                          <Text style={[styles.holidayReasonText, isRTL && styles.textRight]}>
                            {hasReason ? group.reason : (isRTL ? 'لا توجد ملاحظة' : 'No note added')}
                          </Text>
                        </View>

                        <Text style={[styles.holidayClinicsTitle, isRTL && styles.textRight]}>
                          {isRTL ? 'العيادات المغلقة' : 'Clinics closed'}
                        </Text>
                        {clinicEntries.length === 0 ? (
                          <Text style={[styles.helperText, isRTL && styles.textRight]}>
                            {isRTL ? 'لا توجد عيادات مرتبطة بهذه العطلة' : 'No clinics linked to this holiday'}
                          </Text>
                        ) : (
                          <View style={[styles.holidayClinicsWrap, isRTL && styles.rowReverse]}>
                            {clinicEntries.map((entry) => (
                              <View key={entry.id} style={[styles.holidayClinicChip, isRTL && styles.rowReverse]}>
                                <Ionicons name="business-outline" size={12} color={theme.colors.primary} />
                                <Text style={[styles.holidayClinicChipText, isRTL && styles.textRight]}>{entry.name}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        <TouchableOpacity
                          style={[styles.holidayRemoveDayBtn, removingHolidayDate === group.dateKey && styles.buttonDisabled]}
                          onPress={() => handleRemoveHolidayDate(group.dateKey)}
                          disabled={removingHolidayDate === group.dateKey}
                        >
                          {removingHolidayDate === group.dateKey ? (
                            <ActivityIndicator size="small" color={theme.colors.danger} />
                          ) : (
                            <>
                              <Ionicons name="trash-outline" size={16} color={theme.colors.danger} />
                              <Text style={[styles.holidayRemoveDayText, isRTL && styles.actionTextRtl]}>
                                {t.doctorDashboard?.removeHoliday || 'Remove'}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  );
                })}
              </View>
            );
          })
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
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, newClinic.consultation_fee && newClinic.consultation_currency && styles.inputWithCurrency]}
                  placeholder={t.doctorApp?.feePlaceholder || 'Enter amount (e.g., 50 or 50,000)'}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={newClinic.consultation_fee}
                  onChangeText={(text) => setNewClinic(prev => ({ ...prev, consultation_fee: text }))}
                />
                {newClinic.consultation_fee && newClinic.consultation_currency && currencyMap[newClinic.consultation_currency] && (
                  <View style={styles.currencyBadge}>
                    <Text style={styles.currencyBadgeText}>
                      {currencyMap[newClinic.consultation_currency].symbol}
                    </Text>
                  </View>
                )}
              </View>
              {newClinic.consultation_fee && newClinic.consultation_currency && currencyMap[newClinic.consultation_currency] && (
                <Text style={styles.currencyHint}>
                  💰 {currencyMap[newClinic.consultation_currency].name_en} ({newClinic.consultation_currency})
                </Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{isRTL ? 'العملة' : 'Currency'}</Text>
              <CurrencySelector
                value={newClinic.consultation_currency}
                onChange={(currency) => {
                  setNewClinicCurrencyManuallySet(true);
                  setNewClinic(prev => ({ ...prev, consultation_currency: currency }));
                }}
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
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[styles.input, editClinicDraft.consultation_fee && editClinicDraft.consultation_currency && styles.inputWithCurrency]}
                      placeholder={t.doctorApp?.feePlaceholder || 'Enter amount (e.g., 50 or 50,000)'}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={editClinicDraft.consultation_fee}
                      onChangeText={(text) => setEditClinicDraft(prev => ({ ...prev, consultation_fee: text }))}
                    />
                    {editClinicDraft.consultation_fee && editClinicDraft.consultation_currency && currencyMap[editClinicDraft.consultation_currency] && (
                      <View style={styles.currencyBadge}>
                        <Text style={styles.currencyBadgeText}>
                          {currencyMap[editClinicDraft.consultation_currency].symbol}
                        </Text>
                      </View>
                    )}
                  </View>
                  {editClinicDraft.consultation_fee && editClinicDraft.consultation_currency && currencyMap[editClinicDraft.consultation_currency] && (
                    <Text style={styles.currencyHint}>
                      💰 {currencyMap[editClinicDraft.consultation_currency].name_en} ({editClinicDraft.consultation_currency})
                    </Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{isRTL ? 'العملة' : 'Currency'}</Text>
                  <CurrencySelector
                    value={editClinicDraft.consultation_currency}
                    onChange={(currency) => {
                      setEditClinicCurrencyManuallySet(true);
                      setEditClinicDraft(prev => ({ ...prev, consultation_currency: currency }));
                    }}
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
          <View style={[styles.modalContent, { maxHeight: '90%', width: '95%', maxWidth: 520 }]}>
            <ScrollView 
              keyboardShouldPersistTaps="handled" 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {/* Header */}
              <View style={[styles.modalHeaderSection, isRTL && styles.alignRight]}>
                <View style={[styles.modalHeroIcon, styles.modalHeroPrimary]}>
                  <Ionicons name="calendar" size={28} color={theme.colors.primary} />
                </View>
                <Text style={[styles.modalTitle, isRTL && styles.textRight]}>
                  {t.doctorDashboard?.clinicScheduleTitle || 'Clinic Schedule'}
                </Text>
                <Text style={[styles.modalMessage, isRTL && styles.textRight]}>
                  {isRTL
                    ? 'حدد مدة الجلسات وأوقات العمل لتعكس التوفر الحقيقي.'
                    : 'Set slot duration, working hours, and weekly breaks.'}
                </Text>
              </View>

              {/* Slot Minutes */}
              <View style={styles.modalSectionCard}>
                {renderModalSectionHeader(
                  'time-outline',
                  t.doctorDashboard?.slotMinutesLabel || 'Slot Minutes',
                  t.doctorDashboard?.slotMinutesHelp || '20-120 minutes per appointment'
                )}
                <TextInput
                  style={[styles.input, isRTL && styles.textRight]}
                  keyboardType="numeric"
                  value={String(scheduleSlotMinutes)}
                  onChangeText={(value) => setScheduleSlotMinutes(parseInt(value || '0', 10))}
                  placeholder={t.doctorDashboard?.slotMinutesExample || 'e.g., 30'}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Schedule Mode Toggle */}
              <View style={styles.modalSectionCard}>
                {renderModalSectionHeader(
                  'options-outline',
                  t.doctorDashboard?.scheduleMode || 'Schedule Mode',
                  isRTL ? 'اختر بين جدول موحد أو مخصص لكل يوم' : 'Choose between unified or day-specific schedule'
                )}
                <View style={styles.scheduleModeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.scheduleModeButton, 
                      scheduleMode === 'generic' && styles.scheduleModeButtonActive,
                      isRTL && styles.scheduleModeButtonRtl
                    ]}
                    onPress={() => setScheduleMode('generic')}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.scheduleModeIconBox,
                      scheduleMode === 'generic' && styles.scheduleModeIconBoxActive
                    ]}>
                      <Ionicons 
                        name="grid" 
                        size={22} 
                        color={scheduleMode === 'generic' ? '#FFFFFF' : theme.colors.textSecondary} 
                      />
                    </View>
                    <View style={styles.scheduleModeLabelGroup}>
                      <Text style={[
                        styles.scheduleModeLabel, 
                        scheduleMode === 'generic' && styles.scheduleModeLabelActive
                      ]}>
                        {t.doctorDashboard?.generic || 'Generic'}
                      </Text>
                      <Text style={[
                        styles.scheduleModeHint, 
                        scheduleMode === 'generic' && styles.scheduleModeHintActive
                      ]}>
                        {isRTL ? 'جدول موحد' : 'Same schedule'}
                      </Text>
                    </View>
                    {scheduleMode === 'generic' && (
                      <View style={styles.scheduleModeCheckmark}>
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.scheduleModeButton, 
                      scheduleMode === 'day-by-day' && styles.scheduleModeButtonActive,
                      isRTL && styles.scheduleModeButtonRtl
                    ]}
                    onPress={() => setScheduleMode('day-by-day')}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.scheduleModeIconBox,
                      scheduleMode === 'day-by-day' && styles.scheduleModeIconBoxActive
                    ]}>
                      <Ionicons 
                        name="calendar" 
                        size={22} 
                        color={scheduleMode === 'day-by-day' ? '#FFFFFF' : theme.colors.textSecondary}
                      />
                    </View>
                    <View style={styles.scheduleModeLabelGroup}>
                      <Text style={[
                        styles.scheduleModeLabel, 
                        scheduleMode === 'day-by-day' && styles.scheduleModeLabelActive
                      ]}>
                        {t.doctorDashboard?.dayByDay || 'Day-by-Day'}
                      </Text>
                      <Text style={[
                        styles.scheduleModeHint, 
                        scheduleMode === 'day-by-day' && styles.scheduleModeHintActive
                      ]}>
                        {isRTL ? 'جدول مخصص' : 'Custom per day'}
                      </Text>
                    </View>
                    {scheduleMode === 'day-by-day' && (
                      <View style={styles.scheduleModeCheckmark}>
                        <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {scheduleMode === 'generic' ? (
                <>
                  {/* Default Working Hours */}
                  <View style={styles.modalSectionCard}>
                    {renderModalSectionHeader(
                      'time-outline',
                      t.doctorDashboard?.defaultWorkingHours || 'Default Working Hours',
                      isRTL ? 'أوقات العمل الافتراضية لكل الأيام' : 'Apply to all working days'
                    )}
                    <View style={styles.scheduleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.scheduleLabel, isRTL && styles.textRight]}>
                          {t.doctorDashboard?.startLabel || 'Start'}
                        </Text>
                        <TextInput
                          style={[styles.scheduleInput, isRTL && styles.textRight]}
                          placeholder="09:00"
                          placeholderTextColor="#9CA3AF"
                          value={scheduleDraft.default?.start || ''}
                          onChangeText={(value) => updateScheduleDefault('start', value)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.scheduleLabel, isRTL && styles.textRight]}>
                          {t.doctorDashboard?.endLabel || 'End'}
                        </Text>
                        <TextInput
                          style={[styles.scheduleInput, isRTL && styles.textRight]}
                          placeholder="17:00"
                          placeholderTextColor="#9CA3AF"
                          value={scheduleDraft.default?.end || ''}
                          onChangeText={(value) => updateScheduleDefault('end', value)}
                        />
                      </View>
                    </View>

                    <View style={[styles.scheduleRow, { marginTop: 12 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.scheduleLabel, isRTL && styles.textRight]}>
                          {t.doctorDashboard?.breakLabel || 'Break'}
                        </Text>
                        <TextInput
                          style={[styles.scheduleInput, isRTL && styles.textRight]}
                          placeholder="13:00"
                          placeholderTextColor="#9CA3AF"
                          value={scheduleDraft.default?.break_start || ''}
                          onChangeText={(value) => updateScheduleDefault('break_start', value)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.scheduleLabel, isRTL && styles.textRight]}>
                          {t.doctorDashboard?.toLabel || 'To'}
                        </Text>
                        <TextInput
                          style={[styles.scheduleInput, isRTL && styles.textRight]}
                          placeholder="14:00"
                          placeholderTextColor="#9CA3AF"
                          value={scheduleDraft.default?.break_end || ''}
                          onChangeText={(value) => updateScheduleDefault('break_end', value)}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Weekly Off Days */}
                  <View style={styles.modalSectionCard}>
                    {renderModalSectionHeader(
                      'close-circle-outline',
                      t.doctorDashboard?.weeklyOffDays || 'Weekly Off Days',
                      isRTL ? 'اختر الأيام التي تكون فيها العيادة مغلقة' : 'Select days when clinic is closed'
                    )}
                    <View style={styles.weeklyOffGrid}>
                      {DAY_KEYS.map((dayKey) => {
                        const isOff = (scheduleDraft.weekly_off || []).includes(dayKey);
                        return (
                          <TouchableOpacity
                            key={dayKey}
                            style={[styles.weeklyOffChip, isOff && styles.weeklyOffChipSelected]}
                            onPress={() => toggleWeeklyOff(dayKey)}
                            activeOpacity={0.7}
                          >
                            {isOff && <Ionicons name="close-circle" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />}
                            <Text style={[styles.weeklyOffText, isOff && styles.weeklyOffTextSelected]}>
                              {getLocalizedDayLabel(dayKey)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.modalSectionCard}>
                  {renderModalSectionHeader(
                    'calendar-outline',
                    t.doctorDashboard?.dayByDaySchedule || 'Day-by-Day Schedule',
                    isRTL ? 'حدد أوقات مختلفة لكل يوم' : 'Set different hours for each day'
                  )}
                  {DAY_KEYS.map((dayKey) => {
                    const isOff = (scheduleDraft.weekly_off || []).includes(dayKey);
                    const daySchedule = scheduleDraft[dayKey];
                    return (
                      <View key={dayKey} style={styles.dayScheduleCard}>
                        <View style={[styles.dayScheduleHeader, isRTL && styles.rowReverse]}>
                          <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, isRTL && styles.rowReverse]}>
                            <Ionicons name="calendar-outline" size={16} color={theme.colors.primary} />
                            <Text style={[styles.dayScheduleDay, isRTL && styles.textRight]}>{getLocalizedDayLabel(dayKey)}</Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.dayOffToggle, isOff && styles.dayOffToggleActive]}
                            onPress={() => toggleWeeklyOff(dayKey)}
                            activeOpacity={0.7}
                          >
                            <Ionicons 
                              name={isOff ? "close-circle" : "checkmark-circle"} 
                              size={14} 
                              color="#FFFFFF" 
                              style={{ marginRight: 4 }}
                            />
                            <Text style={[styles.dayOffToggleText, isOff && styles.dayOffToggleTextActive]}>
                              {isOff ? (t.common.closed || 'Closed') : (t.common.workingHours || 'Open')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {!isOff && (
                          <View style={styles.dayScheduleInputs}>
                            <View style={styles.scheduleRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.scheduleLabel, isRTL && styles.textRight]}>
                                  {t.doctorDashboard?.startLabel || 'Start'}
                                </Text>
                                <TextInput
                                  style={[styles.scheduleInput, isRTL && styles.textRight]}
                                  placeholder="09:00"
                                  placeholderTextColor="#9CA3AF"
                                  value={daySchedule?.start || ''}
                                  onChangeText={(value) => updateScheduleDay(dayKey, 'start', value)}
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.scheduleLabel, isRTL && styles.textRight]}>
                                  {t.doctorDashboard?.endLabel || 'End'}
                                </Text>
                                <TextInput
                                  style={[styles.scheduleInput, isRTL && styles.textRight]}
                                  placeholder="17:00"
                                  placeholderTextColor="#9CA3AF"
                                  value={daySchedule?.end || ''}
                                  onChangeText={(value) => updateScheduleDay(dayKey, 'end', value)}
                                />
                              </View>
                            </View>
                            <View style={[styles.scheduleRow, { marginTop: 8 }]}>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.scheduleLabel, isRTL && styles.textRight]}>
                                  {t.doctorDashboard?.breakLabel || 'Break'}
                                </Text>
                                <TextInput
                                  style={[styles.scheduleInput, isRTL && styles.textRight]}
                                  placeholder="13:00"
                                  placeholderTextColor="#9CA3AF"
                                  value={daySchedule?.break_start || ''}
                                  onChangeText={(value) => updateScheduleDay(dayKey, 'break_start', value)}
                                />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.scheduleLabel, isRTL && styles.textRight]}>
                                  {t.doctorDashboard?.toLabel || 'To'}
                                </Text>
                                <TextInput
                                  style={[styles.scheduleInput, isRTL && styles.textRight]}
                                  placeholder="14:00"
                                  placeholderTextColor="#9CA3AF"
                                  value={daySchedule?.break_end || ''}
                                  onChangeText={(value) => updateScheduleDay(dayKey, 'break_end', value)}
                                />
                              </View>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]} 
                  onPress={() => setShowScheduleModal(false)}
                  disabled={savingSchedule}
                >
                  <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton, savingSchedule && styles.buttonDisabled]}
                  onPress={handleSaveSchedule}
                  disabled={savingSchedule}
                >
                  {savingSchedule ? (
                    <ActivityIndicator color={theme.colors.surface} size="small" />
                  ) : (
                    <Text style={styles.confirmButtonText}>{t.common.save}</Text>
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
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
              <ModalHero
                title={isRTL ? 'حظر وقت' : 'Block Time'}
                subtitle={
                  isRTL
                    ? 'حدد العيادة والتاريخ لضمان عدم حجز تلك الفترات.'
                    : 'Select clinics, dates, and slots to pause bookings.'
                }
              />

              <View style={styles.modalStepper}>
                {blockSteps.map((step, index) => {
                  const isCompleted = step.done;
                  const isActive = index === blockStepIndex;
                  return (
                    <React.Fragment key={step.key}>
                      <View style={[styles.stepperItem, isRTL && styles.alignRight]}>
                        <View
                          style={[
                            styles.stepperDot,
                            isCompleted && styles.stepperDotDone,
                            isActive && !isCompleted && styles.stepperDotActive,
                          ]}
                        >
                          {isCompleted ? (
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          ) : (
                            <Text style={styles.stepperDotLabel}>{index + 1}</Text>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.stepperLabel,
                            (isCompleted || isActive) && styles.stepperLabelActive,
                            isRTL && styles.textRight,
                          ]}
                          numberOfLines={1}
                        >
                          {step.label}
                        </Text>
                      </View>
                      {index < blockSteps.length - 1 && (
                        <View
                          style={[
                            styles.stepperConnector,
                            blockStepIndex > index && styles.stepperConnectorDone,
                          ]}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>

              <View style={[styles.selectionSummary, isRTL && styles.rowReverse]}>
                {blockSummaryItems.map((item) => (
                  <View key={item.key} style={[styles.summaryChip, isRTL && styles.rowReverse]}>
                    <View style={[styles.summaryIcon, isRTL && styles.summaryIconRtl]}>
                      <Ionicons name={item.icon} size={16} color={theme.colors.primary} />
                    </View>
                    <View style={[styles.summaryTextGroup, isRTL && styles.alignRight]}>
                      <Text style={[styles.summaryLabel, isRTL && styles.textRight]}>{item.label}</Text>
                      <Text style={[styles.summaryValue, isRTL && styles.textRight]} numberOfLines={1}>
                        {item.value}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={[styles.stepNavigation, isRTL && styles.rowReverse]}>
                <TouchableOpacity
                  style={[styles.stepNavButton, blockStepIndex === 0 && styles.stepNavButtonDisabled]}
                  onPress={handlePrevBlockStep}
                  disabled={blockStepIndex === 0}
                >
                  <Text style={styles.stepNavButtonText}>{isRTL ? 'السابق' : 'Back'}</Text>
                </TouchableOpacity>
                {blockStepIndex < blockSteps.length - 1 && (
                  <TouchableOpacity
                    style={[
                      styles.stepNavButton,
                      styles.stepNavButtonPrimary,
                      !canAdvanceBlockStep && styles.stepNavButtonDisabled,
                    ]}
                    onPress={handleNextBlockStep}
                    disabled={!canAdvanceBlockStep}
                  >
                    <Text style={[styles.stepNavButtonText, styles.stepNavButtonPrimaryText]}>
                      {isRTL ? 'التالي' : 'Next'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {renderBlockStepContent()}

              <View style={[styles.modalTip, isRTL && styles.rowReverse]}>
                <View style={[styles.modalTipIcon, isRTL && styles.modalTipIconRtl]}>
                  <Ionicons name="sparkles-outline" size={18} color={theme.colors.primary} />
                </View>
                <Text style={[styles.modalTipText, isRTL && styles.textRight]}>
                  {isRTL
                    ? 'يمكنك تحديد عدة فترات في اليوم نفسه ثم حفظها دفعة واحدة.'
                    : 'Select multiple slots on the same day before saving to block them all at once.'}
                </Text>
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButtonSecondary}
                  onPress={() => {
                    setShowBlockTimeModal(false);
                    setBlockStepIndex(0);
                  }}
                >
                  <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButtonPrimary, blockingSlots && styles.buttonDisabled]}
                  onPress={handleBlockSlots}
                  disabled={blockingSlots}
                >
                  {blockingSlots ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={styles.modalButtonPrimaryText}>{t.doctorDashboard?.blockTime || 'Block'}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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

      {/* Holiday Modal */}
      <Modal visible={showHolidayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true}>
              <ModalHero
                title={t.doctorDashboard?.specialHolidayTitle || 'Add Holiday'}
                subtitle={
                  isRTL
                    ? 'حدد أيام العطل للعيادات المختارة واسترح بثقة.'
                    : 'Mark full-day breaks across your clinics with confidence.'
                }
              />

              <View style={[styles.selectionSummary, isRTL && styles.rowReverse]}>
                {holidaySummaryItems.map((item) => (
                  <View key={item.key} style={[styles.summaryChip, isRTL && styles.rowReverse]}>
                    <View style={[styles.summaryIcon, isRTL && styles.summaryIconRtl]}>
                      <Ionicons name={item.icon} size={16} color={theme.colors.primary} />
                    </View>
                    <View style={[styles.summaryTextGroup, isRTL && styles.alignRight]}>
                      <Text style={[styles.summaryLabel, isRTL && styles.textRight]}>{item.label}</Text>
                      <Text style={[styles.summaryValue, isRTL && styles.textRight]} numberOfLines={1}>
                        {item.value}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.modalSectionCard}>
                {renderModalSectionHeader(
                  'calendar-outline',
                  t.doctorDashboard?.dateLabel || 'Date',
                  isRTL ? 'حدد اليوم الذي سيظهر كعطلة' : 'Choose the day that should be marked as a holiday'
                )}
                <View style={styles.calendarCard}>
                  <View style={[styles.calendarHeader, isRTL && styles.rowReverse]}>
                    <TouchableOpacity
                      style={[styles.calendarNavButton, isRTL && styles.rowReverse]}
                      onPress={() => goToAdjacentHolidayMonth(-1)}
                      disabled={!canGoToPrevHolidayMonth}
                      activeOpacity={0.6}
                    >
                      <Ionicons
                        name={isRTL ? 'chevron-forward' : 'chevron-back'}
                        size={18}
                        color={canGoToPrevHolidayMonth ? theme.colors.textPrimary : theme.colors.textMuted}
                      />
                    </TouchableOpacity>
                    <Text style={[styles.calendarHeaderLabel, isRTL && styles.textRight]}>
                      {holidayCalendarLabel}
                    </Text>
                    <TouchableOpacity
                      style={[styles.calendarNavButton, isRTL && styles.rowReverse]}
                      onPress={() => goToAdjacentHolidayMonth(1)}
                      activeOpacity={0.6}
                    >
                      <Ionicons
                        name={isRTL ? 'chevron-back' : 'chevron-forward'}
                        size={18}
                        color={theme.colors.textPrimary}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.calendarWeekRow, isRTL && styles.rowReverse]}>
                    {calendarWeekdayLabels.map((label, index) => (
                      <Text key={`${label}-${index}`} style={[styles.calendarWeekdayLabel, isRTL && styles.textRight]}>
                        {label}
                      </Text>
                    ))}
                  </View>

                  {holidayCalendarWeeks.map((week, weekIndex) => (
                    <View key={`week-${weekIndex}`} style={[styles.calendarWeekRow, isRTL && styles.rowReverse]}>
                      {week.map((cell, cellIndex) => {
                        if (!cell) {
                          return <View key={`empty-${weekIndex}-${cellIndex}`} style={styles.calendarDayCellEmpty} />;
                        }

                        const isDisabled = cell.getTime() < minHolidayDate.getTime();
                        const isSelected = isSameIsoDate(cell, holidayDate);
                        const isToday = isSameIsoDate(cell, todayIsoDate);

                        return (
                          <TouchableOpacity
                            key={`cell-${weekIndex}-${cellIndex}`}
                            style={[
                              styles.calendarDayCell,
                              isSelected && styles.calendarDaySelected,
                              isDisabled && styles.calendarDayDisabled,
                            ]}
                            onPress={() => handleSelectHolidayDate(cell)}
                            disabled={isDisabled}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.calendarDayText,
                                isSelected && styles.calendarDayTextSelected,
                                isDisabled && styles.calendarDayTextDisabled,
                              ]}
                            >
                              {cell.getDate()}
                            </Text>
                            {isToday && !isSelected && !isDisabled ? (
                              <View style={styles.calendarTodayDot} />
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.modalSectionCard}>
                {renderModalSectionHeader(
                  'chatbubble-ellipses-outline',
                  t.doctorDashboard?.reasonLabel || 'Reason',
                  isRTL ? 'اشرح سبب الإغلاق أو المناسبة' : 'Explain why the clinics are closed'
                )}
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
            </ScrollView>
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
    overflow: 'hidden',
    position: 'relative',
  },
  heroDecorativeCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: -100,
    right: -50,
  },
  heroDecorativeCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    bottom: -75,
    left: -40,
  },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.lg, zIndex: 1 },
  heroTextGroup: { flex: 1, gap: 8 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  heroBadgeRtl: { alignSelf: 'flex-end' },
  heroEyebrow: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', lineHeight: 32 },
  heroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20, fontWeight: '400' },
  heroIconBubble: { 
    width: 64, 
    height: 64, 
    borderRadius: theme.radii.lg, 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginLeft: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroIconInner: {
    width: 52,
    height: 52,
    borderRadius: theme.radii.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatsRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: theme.spacing.lg, zIndex: 1 },
  heroStatItem: { flex: 1 },
  heroStatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  heroStatCardRtl: { flexDirection: 'row-reverse' },
  heroStatIconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatTextGroup: { flex: 1 },
  heroStatValue: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', lineHeight: 26 },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '500', marginTop: 2 },
  heroCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 1 },
  heroPrimaryCta: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#FFFFFF', 
    borderRadius: theme.radii.md, 
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  heroCtaIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(41, 98, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPrimaryCtaText: { color: theme.colors.primary, fontWeight: '700', fontSize: 15 },
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
  modalHeaderSection: { alignItems: 'center', marginBottom: theme.spacing.md },
  modalHeroIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.radii.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalHeroPrimary: { backgroundColor: 'rgba(41,98,255,0.16)' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  modalMessage: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%', marginTop: theme.spacing.lg },
  modalButton: { flex: 1, padding: 14, borderRadius: theme.radii.md, alignItems: 'center' },
  cancelButton: { backgroundColor: theme.colors.elevated, borderWidth: 1, borderColor: theme.colors.border },
  cancelButtonText: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  confirmButton: { backgroundColor: theme.colors.primary },
  confirmButtonText: { color: theme.colors.surface, fontSize: 15, fontWeight: '600' },
  modalHero: { borderRadius: theme.radii.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  modalHeroTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  modalHeroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 8 },
  inputWrapper: { position: 'relative' },
  input: { backgroundColor: theme.colors.elevated, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, padding: 12, fontSize: 16, color: theme.colors.textPrimary },
  inputWithCurrency: { paddingRight: 70 },
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
  currencyOptionsWrap: { gap: 8 },
  currencyOption: { flexDirection: 'row', alignItems: 'center', borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.elevated, padding: 12, marginBottom: 8 },
  currencyOptionSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  currencyRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  currencyRadioRtl: { marginRight: 0, marginLeft: 12 },
  currencyRadioSelected: { borderColor: theme.colors.primary, backgroundColor: '#FFFFFF' },
  currencyRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary },
  currencyOptionText: { flex: 1 },
  currencyOptionLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  currencyOptionDescription: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  currencyLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.elevated, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, padding: 12 },
  locationIcon: { fontSize: 20, marginRight: 10 },
  locationText: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  locationPlaceholder: { flex: 1, fontSize: 14, color: theme.colors.textMuted },
  modalSectionCard: { backgroundColor: theme.colors.elevated, borderRadius: theme.radii.lg, padding: theme.spacing.md, marginTop: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.cardBorder },
  modalSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  modalSectionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  sectionIconRtl: { marginRight: 0, marginLeft: 4 },
  modalSectionHeaderText: { flex: 1 },
  modalSectionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  modalSectionDescription: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  modalButtonSecondary: { flex: 1, backgroundColor: theme.colors.elevated, paddingVertical: 12, borderRadius: theme.radii.md, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  modalButtonSecondaryText: { color: theme.colors.textPrimary, fontWeight: '600' },
  modalButtonPrimary: { flex: 1, backgroundColor: theme.colors.primary, paddingVertical: 12, borderRadius: theme.radii.md, alignItems: 'center' },
  modalButtonPrimaryText: { color: '#FFFFFF', fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },

  selectionSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: theme.spacing.sm, marginBottom: theme.spacing.sm },
  summaryChip: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 140, backgroundColor: theme.colors.elevated, borderRadius: theme.radii.md, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.cardBorder },
  summaryIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  summaryIconRtl: { marginRight: 0, marginLeft: 10 },
  summaryTextGroup: { flex: 1 },
  summaryLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: theme.colors.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 2 },

  modalStepper: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.sm, marginBottom: theme.spacing.sm },
  stepperItem: { alignItems: 'center', width: 70 },
  stepperDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  stepperDotDone: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  stepperDotActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.primarySoft },
  stepperDotLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  stepperLabel: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 6, textAlign: 'center' },
  stepperLabelActive: { color: theme.colors.primary, fontWeight: '700' },
  stepperConnector: { flex: 1, height: 2, backgroundColor: theme.colors.border },
  stepperConnectorDone: { backgroundColor: theme.colors.primary },
  stepNavigation: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: theme.spacing.sm },
  stepNavButton: { flex: 1, paddingVertical: 12, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  stepNavButtonPrimary: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  stepNavButtonText: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  stepNavButtonPrimaryText: { color: '#FFFFFF' },
  stepNavButtonDisabled: { opacity: 0.5 },

  textArea: {
    backgroundColor: theme.colors.elevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: 12,
    fontSize: 15,
    minHeight: 96,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
  },

  modalTip: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.md, padding: 12, marginTop: theme.spacing.md, borderWidth: 1, borderColor: 'rgba(37,99,235,0.2)' },
  modalTipIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  modalTipIconRtl: { marginRight: 0, marginLeft: 10 },
  modalTipText: { flex: 1, fontSize: 13, color: theme.colors.primaryDark, lineHeight: 18 },

  daysScroll: { marginVertical: 10 },
  dayCard: { width: 64, paddingVertical: 10, paddingHorizontal: 8, marginRight: 10, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevated, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  dayCardSelected: { backgroundColor: theme.colors.primary },
  dayName: { fontSize: 12, color: theme.colors.textSecondary },
  dayNumber: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 4 },
  dayTextSelected: { color: '#FFFFFF' },
  calendarCard: { borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.surface, padding: theme.spacing.md, marginTop: theme.spacing.sm },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm, gap: 12 },
  calendarHeaderLabel: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  calendarNavButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.elevated, alignItems: 'center', justifyContent: 'center' },
  calendarWeekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  calendarWeekdayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, textTransform: 'uppercase' },
  calendarDayCellEmpty: { flex: 1, aspectRatio: 1, marginHorizontal: 2, marginVertical: 4 },
  calendarDayCell: { flex: 1, aspectRatio: 1, borderRadius: theme.radii.md, alignItems: 'center', justifyContent: 'center', marginHorizontal: 2, marginVertical: 4, backgroundColor: theme.colors.elevated },
  calendarDaySelected: { backgroundColor: theme.colors.primary },
  calendarDayDisabled: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  calendarDayText: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  calendarDayTextSelected: { color: '#FFFFFF' },
  calendarDayTextDisabled: { color: theme.colors.textMuted },
  calendarTodayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: theme.colors.accent, marginTop: 4 },

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

  modalSectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.md,
    backgroundColor: 'rgba(41,98,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  scheduleModeContainer: { 
    gap: 12,
  },
  scheduleModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    padding: 16,
    gap: 12,
  },
  scheduleModeButtonRtl: { flexDirection: 'row-reverse' },
  scheduleModeButtonActive: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
    ...theme.shadow.card,
  },
  scheduleModeIconBox: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleModeIconBoxActive: {
    backgroundColor: theme.colors.primary,
  },
  scheduleModeLabelGroup: { flex: 1 },
  scheduleModeLabel: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  scheduleModeLabelActive: { 
    color: theme.colors.primary,
  },
  scheduleModeHint: { 
    fontSize: 12, 
    color: theme.colors.textMuted,
    fontWeight: '400',
  },
  scheduleModeHintActive: { 
    color: theme.colors.primaryDark,
    fontWeight: '500',
  },
  scheduleModeCheckmark: {
    marginLeft: 8,
  },

  dayScheduleCard: { marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, padding: 12, backgroundColor: theme.colors.surface },
  dayScheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dayScheduleDay: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayOffToggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: theme.colors.success, borderColor: 'transparent', borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  dayOffToggleActive: { backgroundColor: theme.colors.danger },
  dayOffToggleText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  dayOffToggleTextActive: { color: '#FFFFFF' },
  dayScheduleInputs: { marginTop: 8 },

  // Blocked Slots & Holidays
  blockClinicGroup: { borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.surface, marginBottom: theme.spacing.md, overflow: 'hidden' },
  blockClinicRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: 14 },
  blockClinicLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  blockClinicIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  blockClinicTextGroup: { flex: 1 },
  blockClinicName: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  blockClinicCount: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  blockMonthGroup: { borderTopWidth: 1, borderTopColor: theme.colors.cardBorder },
  blockMonthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: 12, backgroundColor: theme.colors.elevated },
  blockMonthHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  blockMonthTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  blockMonthMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockMonthCount: { fontSize: 12, color: theme.colors.textSecondary },
  blockMonthContent: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md, paddingTop: 6 },
  blockSlotTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  blockSlotDateGroup: { flex: 1, gap: 6 },
  blockSlotDate: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  blockSlotPillsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  blockSlotPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  blockSlotPillText: { fontSize: 12, fontWeight: '600', color: theme.colors.primaryDark, marginLeft: 6 },
  blockSlotAction: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: theme.radii.md, paddingHorizontal: 12, paddingVertical: 8 },
  blockSlotActionText: { fontSize: 12, fontWeight: '700', color: theme.colors.danger, marginLeft: 6 },
  blockSlotReason: { fontSize: 13, color: theme.colors.textSecondary, flex: 1 },
  clinicSubtitle: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 8, marginTop: 10 },
  blockedSlotCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, padding: theme.spacing.md, marginBottom: 10 },
  blockedSlotInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockedDate: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  blockedTime: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 3 },
  blockedReason: { fontSize: 13, color: theme.colors.textMuted, marginTop: 3 },
  inlineIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  unblockBtn: { backgroundColor: '#FEE2E2', paddingHorizontal: 15, paddingVertical: 8, borderRadius: theme.radii.sm },
  unblockBtnText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  secondaryButton: { backgroundColor: '#FEF3C7', paddingHorizontal: 15, paddingVertical: 8, borderRadius: theme.radii.sm },
  secondaryButtonText: { color: '#92400E', fontWeight: '600', fontSize: 13 },
  holidayYearGroup: { marginBottom: theme.spacing.lg },
  holidayYearHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  holidayYearLabel: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  holidayDayGroup: { borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.cardBorder, backgroundColor: theme.colors.surface, marginBottom: theme.spacing.md, overflow: 'hidden' },
  holidayDayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: 14 },
  holidayDayLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  holidayDayIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  holidayDayTextGroup: { flex: 1 },
  holidayDayTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  holidayDayCount: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  holidayDayContent: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md, gap: 12 },
  holidayReasonCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.elevated, borderRadius: theme.radii.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.cardBorder },
  holidayReasonText: { fontSize: 13, color: theme.colors.textSecondary, flex: 1 },
  holidayClinicsTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 4 },
  holidayClinicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  holidayClinicChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: theme.radii.pill, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.colors.primarySoft },
  holidayClinicChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.primaryDark },
  holidayRemoveDayBtn: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: theme.radii.md, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(220,38,38,0.25)', backgroundColor: 'rgba(220,38,38,0.06)' },
  holidayRemoveDayText: { fontSize: 13, fontWeight: '700', color: theme.colors.danger },

  // Holiday Modal
});
