import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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
  // Normalize format: if no colon, assume it's just hours (e.g., "9" -> "09:00")
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
  const { t, isRTL } = useI18n();
  
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

  // Get params
  const doctorId = params.doctorId as string;
  const clinicId = params.clinicId as string;
  const doctorName = params.doctorName as string || 'Doctor';
  const doctorNameAr = params.doctorNameAr as string || 'طبيب';
  const doctorSpecialty = params.doctorSpecialty as string || 'Specialist';
  const doctorSpecialtyAr = params.doctorSpecialtyAr as string || 'متخصص';
  const doctorFee = params.doctorFee as string || '$50';
  const doctorIcon = params.doctorIcon as string || '🩺';
  const clinicName = params.clinicName as string || 'Clinic';

  useEffect(() => {
    if (doctorId && clinicId) {
      fetchBookedSlots();
    }
  }, [doctorId, clinicId]);

  useEffect(() => {
    if (clinicId) {
      fetchClinicSchedule();
      fetchClinicHolidays();
    }
  }, [clinicId]);

  const fetchClinicSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('schedule, slot_minutes')
        .eq('id', clinicId)
        .single();

      console.log('Fetched clinic schedule:', { clinicId, data, error });

      if (!error && data) {
        setClinicSchedule((data as any).schedule || null);
        const rawMinutes = (data as any).slot_minutes ?? 30;
        const clamped = Math.min(120, Math.max(20, rawMinutes));
        setSlotMinutes(clamped);
        console.log('Set clinic schedule:', (data as any).schedule);
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
      // Auto-expire pending appointments older than 15 minutes
      await expireOldPendingAppointments();

      // Get confirmed appointments
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

      // Get pending appointments (still within 15-min window)
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

      // Try to get blocked slots (table may not exist)
      try {
        const { data: blocked } = await supabase
          .from('doctor_blocked_slots')
          .select('blocked_date, time_slot')
          .eq('clinic_id', clinicId)
          .gte('blocked_date', new Date().toISOString().split('T')[0]);

        if (blocked) {
          setBlockedSlots(blocked.map(b => ({
            appointment_date: b.blocked_date,
            time_slot: b.time_slot
          })));
        }
      } catch (e) {
        // Table doesn't exist, ignore
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Generate next 14 days starting from tomorrow
  const getNextDays = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 1; i < 15; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
        month: date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short' }),
        isToday: false,
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
    
    // Priority: Day-specific schedule > Generic default
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
        isRTL ? 'يرجى اختيار التاريخ والوقت' : 'Please select a date and time'
      );
      return;
    }

    if (!user) {
      Alert.alert(
        isRTL ? 'تسجيل الدخول مطلوب' : 'Sign In Required',
        isRTL ? 'يرجى تسجيل الدخول لحجز موعد' : 'Please sign in to book an appointment',
        [
          { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: isRTL ? 'تسجيل الدخول' : 'Sign In', onPress: () => router.push('/sign-in') }
        ]
      );
      return;
    }

    if (!doctorId || !clinicId) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'معلومات الطبيب غير متوفرة' : 'Doctor information is missing. Please go back and try again.'
      );
      console.log('Missing params:', { doctorId, clinicId });
      return;
    }

    // Check if patient already has an appointment on the same day
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

    // Check if slot is still available
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
      // Insert appointment into database
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
          error.message || (isRTL ? 'فشل في حجز الموعد' : 'Failed to book appointment')
        );
        return;
      }

      console.log('Appointment created:', data);

      // Success
      Alert.alert(
        isRTL ? 'تم الحجز بنجاح! ✅' : 'Appointment Booked! ✅',
        isRTL 
          ? `تم حجز موعدك مع ${doctorNameAr}\n\n📅 ${selectedDate}\n🕐 ${formatTime(selectedTime)}\n🏥 ${clinicName}\n\nفي انتظار تأكيد الطبيب.`
          : `Your appointment with ${doctorName} has been scheduled:\n\n📅 ${selectedDate}\n🕐 ${formatTime(selectedTime)}\n🏥 ${clinicName}\n\nWaiting for doctor confirmation.`,
        [
          { 
            text: isRTL ? 'عرض المواعيد' : 'View Appointments', 
            onPress: () => router.replace('/(patient-tabs)/appointments')
          },
          {
            text: isRTL ? 'تم' : 'Done',
            onPress: () => router.back()
          }
        ]
      );

    } catch (err: any) {
      console.error('Booking error:', err);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error', 
        err.message || (isRTL ? 'فشل في حجز الموعد' : 'Failed to book appointment')
      );
    } finally {
      setLoading(false);
    }
  };

  const days = getNextDays();
  const daySlots = selectedDate ? getSlotsForDate(selectedDate) : [];
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
            <Text style={[
              styles.timeText,
              selectedTime === slot.time && styles.timeTextSelected,
              (isBooked || isBlocked) && styles.timeTextUnavailable,
              isPending && styles.timeTextPending,
            ]}>
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

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{isRTL ? '→ رجوع' : '← Back'}</Text>
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, isRTL && styles.textRight]}>
          {isRTL ? 'حجز موعد' : 'Book Appointment'}
        </Text>
        
        <View style={[styles.doctorInfo, isRTL && styles.rowReverse]}>
          <Text style={styles.doctorIcon}>{doctorIcon}</Text>
          <View style={isRTL ? styles.alignRight : undefined}>
            <Text style={[styles.doctorName, isRTL && styles.textRight]}>
              {isRTL ? doctorNameAr : doctorName}
            </Text>
            <Text style={[styles.doctorSpecialty, isRTL && styles.textRight]}>
              {isRTL ? doctorSpecialtyAr : doctorSpecialty}
            </Text>
            <Text style={[styles.clinicNameHeader, isRTL && styles.textRight]}>
              🏥 {clinicName}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Date Selection */}
        <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>
          {isRTL ? 'اختر التاريخ' : 'Select Date'}
        </Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.dateScroll}
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
                ]}
                onPress={() => {
                  if (!isFullyBooked) {
                    setSelectedDate(day.date);
                    setSelectedTime(null);
                  }
                }}
                disabled={isFullyBooked}
              >
                <Text style={[
                  styles.dayName,
                  selectedDate === day.date && styles.dateTextSelected,
                  isFullyBooked && styles.textDisabled,
                ]}>
                  {day.isToday ? (isRTL ? 'اليوم' : 'Today') : day.dayName}
                </Text>
                <Text style={[
                  styles.dayNum,
                  selectedDate === day.date && styles.dateTextSelected,
                  isFullyBooked && styles.textDisabled,
                ]}>
                  {day.dayNum}
                </Text>
                <Text style={[
                  styles.month,
                  selectedDate === day.date && styles.dateTextSelected,
                  isFullyBooked && styles.textDisabled,
                ]}>
                  {day.month}
                </Text>
                <Text style={[
                  styles.availableCount,
                  selectedDate === day.date && styles.dateTextSelected,
                  isFullyBooked && styles.fullText,
                ]}>
                  {isFullyBooked 
                    ? (isRTL ? 'ممتلئ' : 'Full') 
                    : `${availableCount} ${isRTL ? 'متاح' : 'free'}`
                  }
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Time Selection */}
        {selectedDate && (
          <>
            <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>
              {isRTL ? 'اختر الوقت' : 'Select Time'}
            </Text>
            
            {loadingSlots ? (
              <ActivityIndicator size="large" color="#2563EB" style={{ marginVertical: 20 }} />
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
          </>
        )}

        {/* Appointment Summary */}
        {selectedDate && selectedTime && (
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryTitle, isRTL && styles.textRight]}>
              {isRTL ? 'ملخص الموعد' : 'Appointment Summary'}
            </Text>
            
            <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
              <Text style={styles.summaryLabel}>{isRTL ? 'الطبيب' : 'Doctor'}</Text>
              <Text style={styles.summaryValue}>{isRTL ? doctorNameAr : doctorName}</Text>
            </View>
            
            <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
              <Text style={styles.summaryLabel}>{isRTL ? 'العيادة' : 'Clinic'}</Text>
              <Text style={styles.summaryValue}>{clinicName}</Text>
            </View>
            
            <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
              <Text style={styles.summaryLabel}>{isRTL ? 'التاريخ' : 'Date'}</Text>
              <Text style={styles.summaryValue}>{selectedDate}</Text>
            </View>
            
            <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
              <Text style={styles.summaryLabel}>{isRTL ? 'الوقت' : 'Time'}</Text>
              <Text style={styles.summaryValue}>
                {formatTime(selectedTime)}
              </Text>
            </View>
            
            <View style={[styles.summaryRow, styles.summaryTotal, isRTL && styles.rowReverse]}>
              <Text style={styles.summaryLabel}>{isRTL ? 'الرسوم' : 'Fee'}</Text>
              <Text style={styles.summaryFee}>{doctorFee}</Text>
            </View>
            
            <View style={styles.statusNote}>
              <Text style={styles.statusNoteText}>
                ⏳ {isRTL ? 'في انتظار تأكيد الطبيب' : 'Pending doctor confirmation'}
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity 
          style={[
            styles.bookButton,
            (!selectedDate || !selectedTime) && styles.bookButtonDisabled,
            loading && styles.bookButtonDisabled,
          ]}
          onPress={handleBookAppointment}
          disabled={!selectedDate || !selectedTime || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.bookButtonText}>
              {selectedDate && selectedTime 
                ? (isRTL ? `تأكيد الحجز • ${doctorFee}` : `Confirm Booking • ${doctorFee}`)
                : (isRTL ? 'اختر التاريخ والوقت' : 'Select Date & Time')
              }
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: '#2563EB', paddingTop: 50, paddingBottom: 25, paddingHorizontal: 20, borderBottomLeftRadius: 25, borderBottomRightRadius: 25 },
  backButton: { marginBottom: 15 },
  backButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 20 },
  doctorInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', padding: 15, borderRadius: 12 },
  rowReverse: { flexDirection: 'row-reverse' },
  alignRight: { alignItems: 'flex-end' },
  textRight: { textAlign: 'right' },
  doctorIcon: { fontSize: 40, marginHorizontal: 15 },
  doctorName: { fontSize: 18, fontWeight: '600', color: 'white', marginBottom: 3 },
  doctorSpecialty: { fontSize: 14, color: '#BFDBFE' },
  clinicNameHeader: { fontSize: 12, color: '#BFDBFE', marginTop: 3 },
  content: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 15, marginTop: 10 },
  periodLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 10, marginTop: 15 },
  dateScroll: { marginBottom: 10 },
  dateCard: { backgroundColor: 'white', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 15, marginRight: 12, alignItems: 'center', minWidth: 80, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  dateCardSelected: { backgroundColor: '#2563EB' },
  dateCardDisabled: { backgroundColor: '#F3F4F6' },
  dayName: { fontSize: 11, color: '#6B7280', marginBottom: 4, fontWeight: '500' },
  dayNum: { fontSize: 20, fontWeight: 'bold', color: '#1F2937', marginBottom: 2 },
  month: { fontSize: 11, color: '#9CA3AF' },
  availableCount: { fontSize: 10, color: '#10B981', marginTop: 4, fontWeight: '600' },
  fullText: { color: '#EF4444' },
  dateTextSelected: { color: 'white' },
  textDisabled: { color: '#9CA3AF' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  timeSlot: { backgroundColor: 'white', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10, width: '31%', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  timeSlotSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  timeSlotUnavailable: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  timeSlotPending: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
  timeSlotBlocked: { backgroundColor: '#FCA5A5', borderColor: '#DC2626' },
  timeText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  timeTextSelected: { color: 'white' },
  timeTextUnavailable: { color: '#D1D5DB' },
  timeTextPending: { color: '#92400E' },
  bookedLabel: { fontSize: 9, color: '#EF4444', marginTop: 2 },
  pendingLabel: { fontSize: 9, color: '#F59E0B', marginTop: 2 },
  blockedLabel: { fontSize: 9, color: '#DC2626', marginTop: 2, fontWeight: '600' },
  summaryCard: { backgroundColor: 'white', borderRadius: 15, padding: 20, marginTop: 20 },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 15 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  summaryTotal: { borderBottomWidth: 0, marginTop: 5 },
  summaryLabel: { fontSize: 14, color: '#6B7280' },
  summaryValue: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  summaryFee: { fontSize: 18, color: '#2563EB', fontWeight: 'bold' },
  statusNote: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, marginTop: 15 },
  statusNoteText: { color: '#92400E', fontSize: 13, textAlign: 'center' },
  bottomContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 20, paddingBottom: 35 },
  bookButton: { backgroundColor: '#2563EB', padding: 18, borderRadius: 12, alignItems: 'center' },
  bookButtonDisabled: { backgroundColor: '#9CA3AF' },
  bookButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
