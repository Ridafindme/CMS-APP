import { patientTheme } from '@/constants/patientTheme';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { sendNewAppointmentNotificationToDoctor } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const theme = patientTheme;

type BookedSlot = {
  appointment_date: string;
  time_slot: string;
  status?: string;
  created_at?: string;
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
  sun?: ClinicScheduleDay;
  mon?: ClinicScheduleDay;
  tue?: ClinicScheduleDay;
  wed?: ClinicScheduleDay;
  thu?: ClinicScheduleDay;
  fri?: ClinicScheduleDay;
  sat?: ClinicScheduleDay;
};

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const timeToMinutes = (time: string) => {
  if (!time) return null;
  const normalized = time.includes(':') ? time : `${time}:00`;
  const [h, m] = normalized.split(':').map(v => parseInt(v, 10));
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

export default function BookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { isRTL } = useI18n();

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [pendingSlots, setPendingSlots] = useState<BookedSlot[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BookedSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clinicSchedule, setClinicSchedule] = useState<ClinicSchedule | null>(null);
  const [slotMinutes, setSlotMinutes] = useState<number>(30);
  const [clinicHolidays, setClinicHolidays] = useState<string[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successSummary, setSuccessSummary] = useState<{ date: string; time: string } | null>(null);

  const doctorId = params.doctorId as string;
  const clinicId = params.clinicId as string;
  const doctorName = (params.doctorName as string) || 'Doctor';
  const doctorNameAr = (params.doctorNameAr as string) || 'طبيب';
  const doctorSpecialty = (params.doctorSpecialty as string) || 'Specialist';
  const doctorSpecialtyAr = (params.doctorSpecialtyAr as string) || 'متخصص';
  const doctorFee = (params.doctorFee as string) || '$50';
  const doctorIcon = (params.doctorIcon as string) || '🩺';
  const clinicName = (params.clinicName as string) || 'Clinic';

  useEffect(() => {
    if (doctorId && clinicId) {
      fetchBookedSlots();
      
      // Subscribe to real-time appointment changes
      const appointmentSubscription = supabase
        .channel('booking-appointments')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `doctor_id=eq.${doctorId},clinic_id=eq.${clinicId}`,
          },
          (payload) => {
            console.log('🔔 Real-time appointment change detected:', payload);
            fetchBookedSlots();
          }
        )
        .subscribe((status) => {
          console.log('📡 Booking appointment subscription status:', status);
        });

      // Subscribe to blocked slots changes
      const blockedSlotsSubscription = supabase
        .channel('booking-blocked-slots')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'doctor_blocked_slots',
            filter: `clinic_id=eq.${clinicId}`,
          },
          (payload) => {
            console.log('🔔 Real-time blocked slot change detected:', payload);
            fetchBookedSlots();
          }
        )
        .subscribe((status) => {
          console.log('📡 Booking blocked slots subscription status:', status);
        });

      return () => {
        appointmentSubscription.unsubscribe();
        blockedSlotsSubscription.unsubscribe();
      };
    }
  }, [doctorId, clinicId]);

  useEffect(() => {
    if (clinicId) {
      fetchClinicSchedule();
      fetchClinicHolidays();
    }
  }, [clinicId]);

  // Handle Android back button for modal
  useEffect(() => {
    const backAction = () => {
      if (showSuccessModal) {
        setShowSuccessModal(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showSuccessModal]);

  const fetchClinicSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('schedule, slot_minutes')
        .eq('id', clinicId)
        .single();

      if (!error && data) {
        setClinicSchedule((data as any).schedule || null);
        const rawMinutes = (data as any).slot_minutes ?? 30;
        setSlotMinutes(Math.min(120, Math.max(20, rawMinutes)));
      }
    } catch (error) {
      console.error('Error fetching clinic schedule:', error);
    }
  };

  const fetchClinicHolidays = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('clinic_holidays')
        .select('holiday_date')
        .eq('clinic_id', clinicId)
        .gte('holiday_date', today);

      if (!error && data) {
        setClinicHolidays(data.map((h: any) => h.holiday_date));
      }
    } catch (error) {
      console.error('Error fetching clinic holidays:', error);
    }
  };

  const expireOldPendingAppointments = async () => {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('status', 'pending')
        .lt('created_at', fifteenMinutesAgo);

      if (error) {
        console.error('Error expiring pending appointments:', error);
      }
    } catch (error) {
      console.error('Error in expireOldPendingAppointments:', error);
    }
  };

  const fetchBookedSlots = async () => {
    setLoadingSlots(true);
    try {
      await expireOldPendingAppointments();

      const { data: confirmed, error: confirmedError } = await supabase
        .from('appointments')
        .select('appointment_date, time_slot, status')
        .eq('doctor_id', doctorId)
        .eq('clinic_id', clinicId)
        .eq('status', 'confirmed')
        .gte('appointment_date', new Date().toISOString().split('T')[0]);

      if (!confirmedError && confirmed) {
        setBookedSlots(confirmed);
      }

      const { data: pending, error: pendingError } = await supabase
        .from('appointments')
        .select('appointment_date, time_slot, status, created_at')
        .eq('doctor_id', doctorId)
        .eq('clinic_id', clinicId)
        .eq('status', 'pending')
        .gte('appointment_date', new Date().toISOString().split('T')[0]);

      if (!pendingError && pending) {
        setPendingSlots(pending);
      }

      try {
        const { data: blocked } = await supabase
          .from('doctor_blocked_slots')
          .select('blocked_date, time_slot')
          .eq('clinic_id', clinicId)
          .gte('blocked_date', new Date().toISOString().split('T')[0]);

        if (blocked) {
          setBlockedSlots(
            blocked.map(b => ({
              appointment_date: b.blocked_date,
              time_slot: b.time_slot,
            })),
          );
        }
      } catch {
        // Optional table, ignore if missing
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const getNextDays = () => {
    const days = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      days.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
        month: date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short' }),
        isToday: i === 0,
      });
    }
    return days;
  };

  const getScheduleForDate = (dateString: string) => {
    if (!clinicSchedule) {
      console.log('No clinic schedule available');
      return null;
    }
    const dayKey = getDayKey(dateString);
    const weeklyOff = clinicSchedule.weekly_off || [];
    if (weeklyOff.includes(dayKey)) {
      console.log(`${dayKey} is weekly off`);
      return null;
    }

    const daySpecificSchedule = (clinicSchedule as any)[dayKey] as ClinicScheduleDay | undefined;
    if (daySpecificSchedule && (daySpecificSchedule.start || daySpecificSchedule.end)) {
      return daySpecificSchedule;
    }

    return clinicSchedule.default || null;
  };

  const getSlotsForDate = (dateString: string) => {
    if (clinicHolidays.includes(dateString)) return [];
    const schedule = getScheduleForDate(dateString);
    if (!schedule?.start || !schedule?.end) return [];

    const startMin = timeToMinutes(schedule.start);
    const endMin = timeToMinutes(schedule.end);
    if (startMin === null || endMin === null || endMin <= startMin) return [];

    const breakStart = schedule.break_start ? timeToMinutes(schedule.break_start) : null;
    const breakEnd = schedule.break_end ? timeToMinutes(schedule.break_end) : null;

    const slots: Array<{ time: string; period: 'morning' | 'afternoon' | 'evening' }> = [];
    for (let t = startMin; t + slotMinutes <= endMin; t += slotMinutes) {
      const slotEnd = t + slotMinutes;
      if (breakStart !== null && breakEnd !== null) {
        if (t < breakEnd && slotEnd > breakStart) continue;
      }
      const time = minutesToTime(t);
      const hour = parseInt(time.split(':')[0], 10);
      const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      slots.push({ time, period });
    }
    return slots;
  };

  const formatTime = (time: string) => {
    const [hours, minutes = '00'] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? (isRTL ? 'م' : 'PM') : (isRTL ? 'ص' : 'AM');
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes.padStart(2, '0')} ${ampm}`;
  };

  const isSlotBooked = (date: string, time: string) => {
    return bookedSlots.some(s => s.appointment_date === date && s.time_slot === time);
  };

  const isSlotPending = (date: string, time: string) => {
    return pendingSlots.some(s => s.appointment_date === date && s.time_slot === time);
  };

  const isSlotBlocked = (date: string, time: string) => {
    return blockedSlots.some(s => s.appointment_date === date && s.time_slot === time);
  };

  const isSlotAvailable = (date: string, time: string) => {
    return !isSlotBooked(date, time) && !isSlotPending(date, time) && !isSlotBlocked(date, time);
  };

  const getAvailableSlotsCount = (date: string) => {
    return getSlotsForDate(date).filter(slot => isSlotAvailable(date, slot.time)).length;
  };

  const handleBookAppointment = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'يرجى اختيار التاريخ والوقت' : 'Please select a date and time',
      );
      return;
    }

    if (!user) {
      Alert.alert(
        isRTL ? 'تسجيل الدخول مطلوب' : 'Sign In Required',
        isRTL ? 'يرجى تسجيل الدخول لحجز موعد' : 'Please sign in to book an appointment',
        [
          { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: isRTL ? 'تسجيل الدخول' : 'Sign In', onPress: () => router.push('/sign-in') },
        ],
      );
      return;
    }

    // Check if user has phone number before booking
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        Alert.alert(
          isRTL ? 'خطأ' : 'Error',
          isRTL ? 'حدث خطأ أثناء التحقق من ملفك الشخصي' : 'Error verifying your profile',
        );
        return;
      }

      if (!profileData?.phone) {
        Alert.alert(
          isRTL ? 'رقم الهاتف مطلوب' : 'Phone Number Required',
          isRTL
            ? 'يرجى إضافة رقم هاتفك في ملفك الشخصي قبل حجز موعد'
            : 'Please add your phone number in your profile before booking an appointment. This is required for appointment confirmation and reminders.',
          [
            { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
            {
              text: isRTL ? 'إضافة رقم الهاتف' : 'Add Phone Number',
              onPress: () => router.push('/(patient-tabs)/profile'),
            },
          ],
        );
        return;
      }
    } catch (err) {
      console.error('Error checking phone number:', err);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'حدث خطأ أثناء التحقق' : 'An error occurred while verifying your information',
      );
      return;
    }

    if (!doctorId || !clinicId) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'معلومات الطبيب غير متوفرة' : 'Doctor information is missing. Please go back and try again.',
      );
      console.log('Missing params:', { doctorId, clinicId });
      return;
    }

    try {
      const { data: existingAppointments, error: checkError } = await supabase
        .from('appointments')
        .select('id, appointment_date')
        .eq('patient_id', user.id)
        .eq('appointment_date', selectedDate)
        .in('status', ['pending', 'confirmed']);

      if (checkError) {
        console.error('Error checking existing appointments:', checkError);
        Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'حدث خطأ أثناء التحقق' : 'An error occurred');
        return;
      }

      if (existingAppointments && existingAppointments.length > 0) {
        Alert.alert(
          isRTL ? 'تنبيه' : 'Already Booked',
          isRTL
            ? 'لديك موعد محجوز بالفعل في هذا اليوم. يرجى اختيار يوم آخر.'
            : 'You already have an appointment booked on this date. Please select a different date.',
        );
        return;
      }
    } catch (err: any) {
      console.error('Error checking appointments:', err);
      Alert.alert(isRTL ? 'خطأ' : 'Error', isRTL ? 'فشل التحقق من المواعيد' : 'Failed to verify appointments');
      return;
    }

    if (!isSlotAvailable(selectedDate, selectedTime)) {
      Alert.alert(
        isRTL ? 'الموعد غير متاح' : 'Slot Unavailable',
        isRTL ? 'هذا الموعد محجوز بالفعل. يرجى اختيار وقت آخر.' : 'This slot has been booked. Please select another time.',
      );
      fetchBookedSlots();
      setSelectedTime(null);
      return;
    }

    setLoading(true);

    try {
      // Final check: verify slot is still available at database level
      const { data: conflictingAppointments, error: conflictError } = await supabase
        .from('appointments')
        .select('id')
        .eq('doctor_id', doctorId)
        .eq('clinic_id', clinicId)
        .eq('appointment_date', selectedDate)
        .eq('time_slot', selectedTime)
        .in('status', ['pending', 'confirmed']);

      if (conflictError) {
        console.error('Error checking for conflicts:', conflictError);
        throw conflictError;
      }

      if (conflictingAppointments && conflictingAppointments.length > 0) {
        console.log('⚠️ Slot was just booked by someone else');
        Alert.alert(
          isRTL ? 'الموعد محجوز' : 'Slot Just Booked',
          isRTL ? 'تم حجز هذا الموعد للتو من قبل مريض آخر. يرجى اختيار وقت آخر.' : 'This slot was just booked by another patient. Please select a different time.',
        );
        await fetchBookedSlots();
        setSelectedTime(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          patient_id: user.id,
          doctor_id: doctorId,
          clinic_id: clinicId,
          appointment_date: selectedDate,
          time_slot: selectedTime,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.error('Booking error:', error);
        Alert.alert(
          isRTL ? 'خطأ' : 'Error',
          error.message || (isRTL ? 'فشل في حجز الموعد' : 'Failed to book appointment'),
        );
        return;
      }

      console.log('Appointment created:', data);

      // Send notification to doctor about new appointment
      try {
        console.log('📨 Sending notification to doctor:', doctorId);
        
        // Get patient name
        const { data: patientProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        // Get clinic name
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('name')
          .eq('id', clinicId)
          .single();

        const patientName = patientProfile?.full_name || 'A patient';
        const clinicName = clinicData?.name || 'Clinic';

        // Send notification to doctor
        await sendNewAppointmentNotificationToDoctor(
          doctorId,
          patientName,
          selectedDate,
          selectedTime,
          clinicName
        );
        console.log('✅ Notification sent to doctor');
      } catch (notificationError) {
        console.error('⚠️ Failed to send notification to doctor:', notificationError);
        // Don't fail the booking if notification fails
      }

      if (selectedDate && selectedTime) {
        setSuccessSummary({ date: selectedDate, time: formatTime(selectedTime) });
        setShowSuccessModal(true);
      }
    } catch (err: any) {
      console.error('Booking error:', err);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        err.message || (isRTL ? 'فشل في حجز الموعد' : 'Failed to book appointment'),
      );
    } finally {
      setLoading(false);
    }
  };

  const days = getNextDays();
  
  // Filter out past slots if selected date is today
  const isSlotInPast = (dateString: string, timeString: string) => {
    const today = new Date().toISOString().split('T')[0];
    if (dateString !== today) return false;
    
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const slotMinutes = timeToMinutes(timeString);
    
    return slotMinutes !== null && slotMinutes <= currentMinutes;
  };
  
  const allDaySlots = selectedDate ? getSlotsForDate(selectedDate) : [];
  const daySlots = allDaySlots.filter(slot => !isSlotInPast(selectedDate || '', slot.time));
  
  const morningSlots = daySlots.filter(s => s.period === 'morning');
  const afternoonSlots = daySlots.filter(s => s.period === 'afternoon');
  const eveningSlots = daySlots.filter(s => s.period === 'evening');

  const renderTimeSlots = (slots: Array<{ time: string }>) => (
    <View style={[styles.timeGrid, isRTL && styles.rowReverse]}>
      {slots.map((slot) => {
        const isBooked = selectedDate ? isSlotBooked(selectedDate, slot.time) : false;
        const isPending = selectedDate ? isSlotPending(selectedDate, slot.time) : false;
        const isBlocked = selectedDate ? isSlotBlocked(selectedDate, slot.time) : false;
        const isUnavailable = isBooked || isPending || isBlocked;

        return (
          <TouchableOpacity
            key={slot.time}
            style={[
              styles.timeSlot,
              selectedTime === slot.time && styles.timeSlotSelected,
              isBooked && styles.timeSlotUnavailable,
              isPending && styles.timeSlotPending,
              isBlocked && styles.timeSlotBlocked,
            ]}
            onPress={() => !isUnavailable && setSelectedTime(slot.time)}
            disabled={isUnavailable}
          >
            <Text
              style={[
                styles.timeText,
                selectedTime === slot.time && styles.timeTextSelected,
                (isBooked || isBlocked) && styles.timeTextUnavailable,
                isPending && styles.timeTextPending,
              ]}
            >
              {formatTime(slot.time)}
            </Text>
            {isBooked && (
              <Text style={styles.bookedLabel}>{isRTL ? 'محجوز' : 'Booked'}</Text>
            )}
            {isPending && (
              <Text style={styles.pendingLabel}>{isRTL ? 'قيد الانتظار' : 'Pending'}</Text>
            )}
            {isBlocked && (
              <Text style={styles.blockedLabel}>{isRTL ? 'محظور' : 'Blocked'}</Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const handleSuccessAction = (action: 'view' | 'done') => {
    setShowSuccessModal(false);
    if (action === 'view') {
      router.replace('/(patient-tabs)/appointments');
    } else {
      router.back();
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.heroShadow}>
            <LinearGradient
              colors={[theme.colors.primaryDark, theme.colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={[styles.heroTopRow, isRTL && styles.rowReverse]}>
                <TouchableOpacity
                  style={styles.heroBackButton}
                  onPress={() => router.back()}
                  accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
                >
                  <Ionicons
                    name={isRTL ? 'arrow-forward' : 'arrow-back'}
                    size={20}
                    color={theme.colors.surface}
                  />
                </TouchableOpacity>
                <View style={styles.heroChip}>
                  <Ionicons name="cash-outline" size={16} color={theme.colors.surface} />
                  <Text style={styles.heroChipText}>{doctorFee}</Text>
                </View>
              </View>
              <View style={[styles.heroBody, isRTL && styles.alignEnd]}>
                <View style={styles.heroAvatarWrapper}>
                  <Text style={styles.heroAvatarIcon}>{doctorIcon}</Text>
                </View>
                <Text style={[styles.heroEyebrow, isRTL && styles.textRight]}>
                  {isRTL ? 'موعدك القادم' : 'Your next visit'}
                </Text>
                <Text style={[styles.heroTitle, isRTL && styles.textRight]}>
                  {isRTL ? doctorNameAr : doctorName}
                </Text>
                <Text style={[styles.heroSubtitle, isRTL && styles.textRight]}>
                  {isRTL ? doctorSpecialtyAr : doctorSpecialty}
                </Text>
                <Text style={[styles.heroClinic, isRTL && styles.textRight]}>
                  {clinicName}
                </Text>

                <View style={[styles.heroMetaRow, isRTL && styles.rowReverse]}>
                  <View style={styles.heroMetaBadge}>
                    <Ionicons name="calendar-outline" size={16} color={theme.colors.surface} />
                    <Text style={styles.heroMetaText}>
                      {isRTL ? 'نافذة 14 يوماً' : 'Next 14 days'}
                    </Text>
                  </View>
                  <View style={styles.heroMetaBadge}>
                    <Ionicons name="time-outline" size={16} color={theme.colors.surface} />
                    <Text style={styles.heroMetaText}>
                      {slotMinutes} {isRTL ? 'د/موعد' : 'min slots'}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.card}>
          <View style={[styles.cardHeaderRow, isRTL && styles.rowReverse]}>
            <View style={isRTL ? styles.alignEnd : undefined}>
              <Text style={[styles.cardEyebrow, isRTL && styles.textRight]}>
                {isRTL ? 'الخطوة ١' : 'Step 1'}
              </Text>
              <Text style={[styles.cardTitle, isRTL && styles.textRight]}>
                {isRTL ? 'اختر التاريخ' : 'Pick a date'}
              </Text>
            </View>
            <Ionicons name="calendar-outline" size={22} color={theme.colors.primary} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateScrollContent}
          >
            {days.map((day) => {
              const availableCount = getAvailableSlotsCount(day.date);
              const isFullyBooked = availableCount === 0;

              return (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    styles.dateCard,
                    selectedDate === day.date && styles.dateCardSelected,
                    isFullyBooked && styles.dateCardDisabled,
                    isRTL && styles.dateCardRTL,
                  ]}
                  onPress={() => {
                    if (!isFullyBooked) {
                      setSelectedDate(day.date);
                      setSelectedTime(null);
                    }
                  }}
                  disabled={isFullyBooked}
                >
                  <Text
                    style={[
                      styles.dayName,
                      selectedDate === day.date && styles.dateTextSelected,
                      isFullyBooked && styles.textDisabled,
                      isRTL && styles.textRight,
                    ]}
                  >
                    {day.isToday ? (isRTL ? 'اليوم' : 'Today') : day.dayName}
                  </Text>
                  <Text
                    style={[
                      styles.dayNum,
                      selectedDate === day.date && styles.dateTextSelected,
                      isFullyBooked && styles.textDisabled,
                    ]}
                  >
                    {day.dayNum}
                  </Text>
                  <Text
                    style={[
                      styles.month,
                      selectedDate === day.date && styles.dateTextSelected,
                      isFullyBooked && styles.textDisabled,
                    ]}
                  >
                    {day.month}
                  </Text>
                  <View style={styles.dateBadgeRow}>
                    <View
                      style={[
                        styles.dateBadge,
                        isFullyBooked && styles.dateBadgeFull,
                        isRTL && styles.dateBadgeRTL,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateBadgeText,
                          isFullyBooked && styles.dateBadgeTextFull,
                        ]}
                      >
                        {isFullyBooked
                          ? (isRTL ? 'ممتلئ' : 'Full')
                          : `${availableCount} ${isRTL ? 'متاح' : 'open'}`}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {selectedDate && (
          <View style={styles.card}>
            <View style={[styles.cardHeaderRow, isRTL && styles.rowReverse]}>
              <View style={isRTL ? styles.alignEnd : undefined}>
                <Text style={[styles.cardEyebrow, isRTL && styles.textRight]}>
                  {isRTL ? 'الخطوة ٢' : 'Step 2'}
                </Text>
                <Text style={[styles.cardTitle, isRTL && styles.textRight]}>
                  {isRTL ? 'اختر الوقت' : 'Pick a time'}
                </Text>
              </View>
              <Ionicons name="time-outline" size={22} color={theme.colors.accent} />
            </View>

            {loadingSlots ? (
              <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loadingIndicator} />
            ) : (
              <>
                <Text style={[styles.periodLabel, isRTL && styles.textRight]}>
                  🌅 {isRTL ? 'صباحاً' : 'Morning'}
                </Text>
                {renderTimeSlots(morningSlots)}

                <Text style={[styles.periodLabel, isRTL && styles.textRight]}>
                  ☀️ {isRTL ? 'بعد الظهر' : 'Afternoon'}
                </Text>
                {renderTimeSlots(afternoonSlots)}

                <Text style={[styles.periodLabel, isRTL && styles.textRight]}>
                  🌆 {isRTL ? 'مساءً' : 'Evening'}
                </Text>
                {renderTimeSlots(eveningSlots)}
              </>
            )}
          </View>
        )}

        {selectedDate && selectedTime && (
          <View style={styles.card}>
            <View style={[styles.cardHeaderRow, isRTL && styles.rowReverse]}>
              <View style={isRTL ? styles.alignEnd : undefined}>
                <Text style={[styles.cardEyebrow, isRTL && styles.textRight]}>
                  {isRTL ? 'الخطوة ٣' : 'Step 3'}
                </Text>
                <Text style={[styles.cardTitle, isRTL && styles.textRight]}>
                  {isRTL ? 'تأكيد الموعد' : 'Confirm details'}
                </Text>
              </View>
              <Ionicons name="checkmark-circle-outline" size={24} color={theme.colors.success} />
            </View>

            <View style={styles.summaryList}>
              <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                <View style={styles.summaryIconCircle}>
                  <Ionicons name="person-outline" size={18} color={theme.colors.primaryDark} />
                </View>
                <Text style={[styles.summaryLabel, isRTL && styles.textRight]}>{isRTL ? 'الطبيب' : 'Doctor'}</Text>
                <Text style={[styles.summaryValue, isRTL && styles.textRight]}>
                  {isRTL ? doctorNameAr : doctorName}
                </Text>
              </View>
              <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                <View style={styles.summaryIconCircle}>
                  <Ionicons name="business-outline" size={18} color={theme.colors.primaryDark} />
                </View>
                <Text style={[styles.summaryLabel, isRTL && styles.textRight]}>{isRTL ? 'العيادة' : 'Clinic'}</Text>
                <Text style={[styles.summaryValue, isRTL && styles.textRight]}>{clinicName}</Text>
              </View>
              <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                <View style={styles.summaryIconCircle}>
                  <Ionicons name="calendar-outline" size={18} color={theme.colors.primaryDark} />
                </View>
                <Text style={[styles.summaryLabel, isRTL && styles.textRight]}>{isRTL ? 'التاريخ' : 'Date'}</Text>
                <Text style={[styles.summaryValue, isRTL && styles.textRight]}>{selectedDate}</Text>
              </View>
              <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                <View style={styles.summaryIconCircle}>
                  <Ionicons name="time-outline" size={18} color={theme.colors.primaryDark} />
                </View>
                <Text style={[styles.summaryLabel, isRTL && styles.textRight]}>{isRTL ? 'الوقت' : 'Time'}</Text>
                <Text style={[styles.summaryValue, isRTL && styles.textRight]}>{formatTime(selectedTime)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryRowTotal, isRTL && styles.rowReverse]}>
                <View style={[styles.summaryIconCircle, styles.summaryIconFee]}>
                  <Ionicons name="card-outline" size={18} color={theme.colors.surface} />
                </View>
                <Text style={[styles.summaryLabel, isRTL && styles.textRight]}>{isRTL ? 'الرسوم' : 'Fee'}</Text>
                <Text style={[styles.summaryFee, isRTL && styles.textRight]}>{doctorFee}</Text>
              </View>
            </View>

            <View style={styles.statusNote}>
              <Ionicons name="information-circle-outline" size={16} color={theme.colors.warning} />
              <Text style={[styles.statusNoteText, isRTL && styles.textRight]}>
                {isRTL ? 'سيتم تأكيد الموعد من قبل العيادة' : 'Waiting on clinic confirmation'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.footerSpacer} />
      </ScrollView>

      <View style={styles.bottomButton}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleBookAppointment}
          disabled={!selectedDate || !selectedTime || loading}
        >
          <LinearGradient
            colors={[theme.colors.primaryDark, theme.colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.bookButton,
              (!selectedDate || !selectedTime || loading) && styles.bookButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.surface} />
            ) : (
              <View style={[styles.bookButtonContent, isRTL && styles.rowReverse]}>
                <View style={isRTL ? styles.alignEnd : undefined}>
                  <Text style={[styles.bookButtonLabel, isRTL && styles.textRight]}>
                    {selectedDate && selectedTime
                      ? (isRTL ? 'تأكيد الحجز' : 'Confirm booking')
                      : (isRTL ? 'اختر التاريخ والوقت' : 'Select date & time')}
                  </Text>
                  {selectedDate && selectedTime ? (
                    <Text style={[styles.bookButtonSub, isRTL && styles.textRight]}>
                      {isRTL ? 'يشمل رسوم الاستشارة' : 'Includes consultation fee'}
                    </Text>
                  ) : (
                    <Text style={[styles.bookButtonSub, isRTL && styles.textRight]}>
                      {isRTL ? 'ابدأ من التاريخ' : 'Start by choosing a date'}
                    </Text>
                  )}
                </View>
                <Text style={styles.bookButtonPrice}>{doctorFee}</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View pointerEvents="none" style={styles.modalGlow} />
          <View style={[styles.modalCard, isRTL && styles.alignEnd]}>
            <LinearGradient
              colors={[theme.colors.primaryDark, theme.colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.modalHero, isRTL && styles.alignEnd]}
            >
              <View style={styles.modalHeroIconShell}>
                <Ionicons name="checkmark-circle" size={32} color={theme.colors.surface} />
              </View>
              <Text style={[styles.modalTitle, isRTL && styles.textRight]}>
                {isRTL ? 'تم حجز موعدك!' : 'Appointment booked!'}
              </Text>
              <Text style={[styles.modalSubtitle, isRTL && styles.textRight]}>
                {isRTL ? 'بانتظار تأكيد العيادة' : 'Waiting on clinic confirmation'}
              </Text>
              <View style={[styles.modalHeroMetaRow, isRTL && styles.rowReverse]}>
                <View style={[styles.modalHeroMeta, isRTL && styles.rowReverse]}>
                  <Ionicons name="calendar-outline" size={16} color={theme.colors.surface} />
                  <Text style={[styles.modalHeroMetaText, isRTL && styles.textRight]}>
                    {successSummary?.date || (isRTL ? '—' : '—')}
                  </Text>
                </View>
                <View style={[styles.modalHeroMeta, isRTL && styles.rowReverse]}>
                  <Ionicons name="time-outline" size={16} color={theme.colors.surface} />
                  <Text style={[styles.modalHeroMetaText, isRTL && styles.textRight]}>
                    {successSummary?.time || (isRTL ? '—' : '—')}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.modalBody}>
              <View style={[styles.modalDoctorRow, isRTL && styles.rowReverse]}>
                <View style={styles.modalDoctorAvatar}>
                  <Text style={styles.modalDoctorEmoji}>{doctorIcon}</Text>
                </View>
                <View style={isRTL ? styles.alignEnd : undefined}>
                  <Text style={[styles.modalDoctorLabel, isRTL && styles.textRight]}>
                    {isRTL ? 'الطبيب' : 'Doctor'}
                  </Text>
                  <Text style={[styles.modalDoctorName, isRTL && styles.textRight]}>
                    {isRTL ? doctorNameAr : doctorName}
                  </Text>
                  <Text style={[styles.modalDoctorSpecialty, isRTL && styles.textRight]}>
                    {isRTL ? doctorSpecialtyAr : doctorSpecialty}
                  </Text>
                </View>
              </View>

              <View style={styles.modalDivider} />

              <View style={[styles.modalDetailGrid, isRTL && styles.rowReverse]}>
                <View style={[styles.modalDetailTile, isRTL && styles.alignEnd]}>
                  <Ionicons name="business-outline" size={18} color={theme.colors.primary} />
                  <View style={isRTL ? styles.alignEnd : undefined}>
                    <Text style={[styles.modalDetailLabel, isRTL && styles.textRight]}>
                      {isRTL ? 'العيادة' : 'Clinic'}
                    </Text>
                    <Text style={[styles.modalDetailValue, isRTL && styles.textRight]}>{clinicName}</Text>
                  </View>
                </View>
                <View style={[styles.modalDetailTile, isRTL && styles.alignEnd]}>
                  <Ionicons name="card-outline" size={18} color={theme.colors.primary} />
                  <View style={isRTL ? styles.alignEnd : undefined}>
                    <Text style={[styles.modalDetailLabel, isRTL && styles.textRight]}>
                      {isRTL ? 'الرسوم' : 'Fee'}
                    </Text>
                    <Text style={[styles.modalDetailValue, isRTL && styles.textRight]}>{doctorFee}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.modalNote, isRTL && styles.rowReverse]}>
                <Ionicons name="information-circle-outline" size={18} color={theme.colors.warning} />
                <Text style={[styles.modalNoteText, isRTL && styles.textRight]}>
                  {isRTL ? 'سيتم تأكيد الموعد من قبل العيادة' : 'The clinic will confirm shortly.'}
                </Text>
              </View>
            </View>

            <View style={[styles.modalActions, isRTL && styles.rowReverse]}>
              <TouchableOpacity
                style={styles.modalSecondary}
                onPress={() => handleSuccessAction('view')}
              >
                <View style={[styles.modalSecondaryContent, isRTL && styles.rowReverse]}>
                  <Ionicons name="list-outline" size={18} color={theme.colors.textPrimary} />
                  <Text style={[styles.modalSecondaryText, isRTL && styles.textRight]}>
                    {isRTL ? 'عرض المواعيد' : 'View appointments'}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalPrimary}
                onPress={() => handleSuccessAction('done')}
              >
                <LinearGradient
                  colors={[theme.colors.primaryDark, theme.colors.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalPrimaryGradient}
                >
                  <View style={[styles.modalPrimaryContent, isRTL && styles.rowReverse]}>
                    <Text style={styles.modalPrimaryText}>{isRTL ? 'تم' : 'Done'}</Text>
                    <Ionicons
                      name={isRTL ? 'arrow-back' : 'arrow-forward'}
                      size={18}
                      color={theme.colors.surface}
                    />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 200 },
  heroSection: { paddingTop: 52, paddingHorizontal: theme.spacing.lg },
  heroShadow: {
    borderRadius: theme.radii.lg + 8,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 12,
  },
  heroCard: { borderRadius: theme.radii.lg + 8, padding: theme.spacing.lg },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  rowReverse: { flexDirection: 'row-reverse' },
  heroBackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroChipText: { color: theme.colors.surface, fontWeight: '700' },
  heroBody: { gap: 10 },
  alignEnd: { alignItems: 'flex-end' },
  textRight: { textAlign: 'right' },
  heroAvatarWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroAvatarIcon: { fontSize: 32, color: theme.colors.surface },
  heroEyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  heroTitle: { color: theme.colors.surface, fontSize: 26, fontWeight: '700' },
  heroSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 16 },
  heroClinic: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  heroMetaRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  heroMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  heroMetaText: { color: theme.colors.surface, fontSize: 13, fontWeight: '600' },
  card: {
    marginTop: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  cardEyebrow: { fontSize: 12, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 2 },
  dateScrollContent: { paddingVertical: 6, gap: 14 },
  dateCard: {
    width: 98,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: theme.colors.elevated,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    alignItems: 'flex-start',
  },
  dateCardSelected: { backgroundColor: theme.colors.primary },
  dateCardDisabled: { opacity: 0.4 },
  dateCardRTL: { alignItems: 'flex-end' },
  dayName: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },
  dayNum: { fontSize: 26, fontWeight: '700', color: theme.colors.textPrimary, marginVertical: 4 },
  month: { fontSize: 12, color: theme.colors.textMuted },
  textDisabled: { color: theme.colors.textMuted },
  dateTextSelected: { color: theme.colors.surface },
  dateBadgeRow: { marginTop: 10 },
  dateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radii.pill,
  },
  dateBadgeRTL: { alignSelf: 'flex-end' },
  dateBadgeFull: { backgroundColor: 'rgba(239,68,68,0.2)' },
  dateBadgeText: { fontSize: 11, fontWeight: '600', color: theme.colors.success },
  dateBadgeTextFull: { color: theme.colors.danger },
  periodLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 8 },
  loadingIndicator: { marginVertical: 20 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  timeSlot: {
    flexBasis: '30%',
    minWidth: 96,
    backgroundColor: theme.colors.elevated,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  timeSlotSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  timeSlotUnavailable: { backgroundColor: theme.colors.background },
  timeSlotPending: { backgroundColor: 'rgba(251,191,36,0.2)', borderColor: '#FBBF24' },
  timeSlotBlocked: { backgroundColor: 'rgba(248,113,113,0.2)', borderColor: '#F87171' },
  timeText: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  timeTextSelected: { color: theme.colors.surface },
  timeTextUnavailable: { color: theme.colors.textMuted },
  timeTextPending: { color: '#92400E' },
  bookedLabel: { fontSize: 11, color: '#DC2626', marginTop: 6, fontWeight: '600' },
  pendingLabel: { fontSize: 11, color: '#B45309', marginTop: 6, fontWeight: '600' },
  blockedLabel: { fontSize: 11, color: '#B91C1C', marginTop: 6, fontWeight: '700' },
  summaryList: { gap: 8 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  summaryRowTotal: { borderBottomWidth: 0 },
  summaryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryIconFee: { backgroundColor: theme.colors.primaryDark },
  summaryLabel: { flex: 1, fontSize: 14, color: theme.colors.textSecondary, fontWeight: '600' },
  summaryValue: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600' },
  summaryFee: { fontSize: 20, color: theme.colors.primary, fontWeight: '700' },
  statusNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(249,115,22,0.2)',
    borderRadius: theme.radii.md,
    padding: 12,
    marginTop: theme.spacing.md,
  },
  statusNoteText: { flex: 1, color: theme.colors.warning, fontSize: 13 },
  footerSpacer: { height: 140 },
  bottomButton: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 28 : 18,
    paddingHorizontal: theme.spacing.lg,
  },
  bookButton: { borderRadius: theme.radii.lg, padding: theme.spacing.lg },
  bookButtonDisabled: { opacity: 0.6 },
  bookButtonContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  bookButtonLabel: { color: theme.colors.surface, fontSize: 18, fontWeight: '700' },
  bookButtonSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4 },
  bookButtonPrice: { color: theme.colors.surface, fontSize: 22, fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,17,29,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: theme.colors.primarySoft,
    opacity: 0.35,
    top: 80,
    alignSelf: 'center',
  },
  modalCard: {
    width: '100%',
    borderRadius: theme.radii.lg + 10,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  modalHero: {
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  modalHeroIconShell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalTitle: { color: theme.colors.surface, fontSize: 20, fontWeight: '700' },
  modalSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  modalHeroMetaRow: { flexDirection: 'row', gap: 10, marginTop: theme.spacing.sm },
  modalHeroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  modalHeroMetaText: { color: theme.colors.surface, fontWeight: '600' },
  modalBody: { padding: theme.spacing.lg, gap: theme.spacing.md },
  modalDoctorRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  modalDoctorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDoctorEmoji: { fontSize: 28 },
  modalDoctorLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalDoctorName: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary },
  modalDoctorSpecialty: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 },
  modalDivider: { height: 1, backgroundColor: theme.colors.cardBorder },
  modalDetailGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  modalDetailTile: {
    flex: 1,
    minWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.elevated,
  },
  modalDetailLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modalDetailValue: { fontSize: 15, color: theme.colors.textPrimary, fontWeight: '700', marginTop: 2 },
  modalNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderRadius: theme.radii.md,
    padding: 12,
  },
  modalNoteText: { flex: 1, color: theme.colors.warning, fontSize: 13 },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  modalSecondary: {
    flex: 1,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    alignItems: 'center',
  },
  modalSecondaryContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalSecondaryText: { color: theme.colors.textPrimary, fontWeight: '600' },
  modalPrimary: { flex: 1, borderRadius: theme.radii.lg, overflow: 'hidden' },
  modalPrimaryGradient: { paddingVertical: theme.spacing.md, alignItems: 'center' },
  modalPrimaryContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalPrimaryText: { color: theme.colors.surface, fontWeight: '700', fontSize: 16 },
});
