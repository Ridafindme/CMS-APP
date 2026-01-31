import PhoneInput from '@/components/ui/phone-input';
import { patientTheme } from '@/constants/patientTheme';
import { getDayKey, minutesToTime, timeToMinutes, useDoctorContext } from '@/lib/DoctorContext';
import { useI18n } from '@/lib/i18n';
import { sendAppointmentCancellationNotification, sendAppointmentConfirmationNotification, sendRescheduleNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

type TimeSlotData = {
  time: string;
  type: 'available' | 'appointment' | 'walk-in' | 'blocked';
  appointment?: any;
  blockedReason?: string;
};

export default function DailyScheduleScreen() {
  const { t, isRTL } = useI18n();
  const { loading, appointments, clinics, blockedSlots, fetchAppointments, fetchBlockedSlots, doctorData, profile } = useDoctorContext();
  const insets = useSafeAreaInsets();
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedClinic, setSelectedClinic] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlotData[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  // Walk-in edit modal
  const [showEditWalkIn, setShowEditWalkIn] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [editWalkInName, setEditWalkInName] = useState('');
  const [editWalkInPhone, setEditWalkInPhone] = useState('');
  const [editWalkInPhoneLocal, setEditWalkInPhoneLocal] = useState('');
  const [updating, setUpdating] = useState(false);
  
  // Walk-in registration modal
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInPhoneLocal, setWalkInPhoneLocal] = useState('');
  const [registering, setRegistering] = useState(false);
  
  // Block slot modal
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockTimeSlot, setBlockTimeSlot] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blocking, setBlocking] = useState(false);
  
  // Reschedule modal
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Refresh appointments when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 Daily screen focused - refreshing data with forceRefresh=true...');
      fetchAppointments(7, true); // Force refresh when returning to screen
      fetchBlockedSlots();
    }, [])
  );

  // Real-time subscription for appointments
  useEffect(() => {
    console.log('🔄 Setting up real-time appointment subscription...');
    
    const appointmentSubscription = supabase
      .channel('daily-appointments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          console.log('🔔 Real-time appointment change detected:', {
            event: payload.eventType,
            new: payload.new,
            old: payload.old
          });
          console.log('🔄 Triggering appointment fetch with forceRefresh=true...');
          fetchAppointments(7, true); // Force refresh to bypass cache
        }
      )
      .subscribe((status) => {
        console.log('📡 Appointment subscription status:', status);
      });

    const blockedSlotsSubscription = supabase
      .channel('daily-blocked-slots')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_slots'
        },
        (payload) => {
          console.log('🔔 Real-time blocked slot change detected:', {
            event: payload.eventType,
            new: payload.new,
            old: payload.old
          });
          console.log('🔄 Triggering blocked slots fetch...');
          fetchBlockedSlots();
        }
      )
      .subscribe((status) => {
        console.log('📡 Blocked slots subscription status:', status);
      });

    return () => {
      console.log('🔌 Cleaning up real-time subscriptions...');
      appointmentSubscription.unsubscribe();
      blockedSlotsSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    console.log('🔄 Daily screen mounted, fetching appointments...');
    fetchAppointments();
    fetchBlockedSlots();
  }, []);

  useEffect(() => {
    console.log('📋 Appointments updated in daily view:', {
      count: appointments.length,
      sample: appointments[0]
    });
  }, [appointments]);

  useEffect(() => {
    // Auto-select first active clinic
    if (clinics.length > 0 && !selectedClinic) {
      const activeClinic = clinics.find(c => c.is_active) || clinics[0];
      setSelectedClinic(activeClinic.id);
    }
  }, [clinics]);

  useEffect(() => {
    if (selectedDate && selectedClinic) {
      generateTimeSlots();
    }
  }, [selectedDate, selectedClinic, appointments, blockedSlots]);

  // Handle Android back button for modals
  useEffect(() => {
    const backAction = () => {
      // Close modals in priority order
      if (showRescheduleModal) {
        setShowRescheduleModal(false);
        return true;
      }
      if (showBlockModal) {
        setShowBlockModal(false);
        return true;
      }
      if (showWalkInModal) {
        setShowWalkInModal(false);
        return true;
      }
      if (showEditWalkIn) {
        setShowEditWalkIn(false);
        return true;
      }
      if (showDatePicker) {
        setShowDatePicker(false);
        return true;
      }
      // Prevent back navigation from tab screens - stay on the tab
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showRescheduleModal, showBlockModal, showWalkInModal, showEditWalkIn, showDatePicker]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAppointments(), fetchBlockedSlots()]);
    setRefreshing(false);
  };

  const generateTimeSlots = () => {
    if (!selectedClinic) return;

    const clinic = clinics.find(c => c.id === selectedClinic);
    if (!clinic) return;

    console.log('🔍 Generating slots for clinic:', {
      clinicId: clinic.id,
      clinicName: clinic.clinic_name,
      isActive: clinic.is_active,
      hasSchedule: !!clinic.schedule,
      schedule: clinic.schedule,
      doctorApproved: doctorData?.is_approved
    });

    // Only generate slots if doctor is approved
    if (!doctorData?.is_approved) {
      console.log('❌ Doctor not approved');
      setTimeSlots([]);
      return;
    }

    // Only generate slots if clinic is active
    if (!clinic.is_active) {
      console.log('❌ Clinic not active');
      setTimeSlots([]);
      return;
    }

    // Only generate slots if schedule is configured
    if (!clinic.schedule) {
      console.log('❌ No schedule configured');
      setTimeSlots([]);
      return;
    }

    const schedule = clinic.schedule;
    const slotMinutes = clinic.slot_minutes || 30;

    const dayKey = getDayKey(selectedDate);
    console.log('📅 Day key:', dayKey, 'Date:', selectedDate);

    // Check if day is weekly off
    if (schedule.weekly_off?.includes(dayKey)) {
      console.log('❌ Day is weekly off');
      setTimeSlots([]);
      return;
    }

    // Get schedule for this day
    const daySchedule = (schedule as any)[dayKey] || schedule.default;
    console.log('📋 Day schedule:', daySchedule);
    
    if (!daySchedule?.start || !daySchedule?.end) {
      console.log('❌ No schedule for this day');
      setTimeSlots([]);
      return;
    }

    // Helper function to normalize time format (handles "9" -> "09:00" and "09:00" -> "09:00")
    const normalizeTime = (time: string): string => {
      if (!time) return '';
      // If already in HH:MM format, return as is
      if (time.includes(':')) return time;
      // If just a number, convert to HH:00 format
      const hour = parseInt(time, 10);
      return `${String(hour).padStart(2, '0')}:00`;
    };

    const startMin = timeToMinutes(normalizeTime(daySchedule.start));
    const endMin = timeToMinutes(normalizeTime(daySchedule.end));
    
    console.log('⏰ Time conversion:', {
      startRaw: daySchedule.start,
      startNormalized: normalizeTime(daySchedule.start),
      startMin,
      endRaw: daySchedule.end,
      endNormalized: normalizeTime(daySchedule.end),
      endMin
    });
    
    if (startMin === null || endMin === null) {
      console.log('❌ Failed to parse start/end times');
      return;
    }

    const breakStartMin = daySchedule.break_start ? timeToMinutes(normalizeTime(daySchedule.break_start)) : null;
    const breakEndMin = daySchedule.break_end ? timeToMinutes(normalizeTime(daySchedule.break_end)) : null;

    const slots: TimeSlotData[] = [];

    for (let t = startMin; t + slotMinutes <= endMin; t += slotMinutes) {
      const slotEnd = t + slotMinutes;
      if (breakStartMin !== null && breakEndMin !== null) {
        if (t < breakEndMin && slotEnd > breakStartMin) continue;
      }

      const timeStr = minutesToTime(t);

      // Check if blocked
      const blocked = blockedSlots.find(bs =>
        bs.blocked_date === selectedDate &&
        bs.time_slot === timeStr &&
        bs.clinic_id === selectedClinic
      );

      if (blocked) {
        slots.push({
          time: timeStr,
          type: 'blocked',
          blockedReason: blocked.reason || undefined
        });
        continue;
      }

      // Check if appointment exists
      const appointment = appointments.find(apt =>
        apt.appointment_date === selectedDate &&
        apt.appointment_time === timeStr &&
        apt.clinic_id === selectedClinic
      );

      if (appointment) {
        slots.push({
          time: timeStr,
          type: appointment.booking_type === 'walk-in' ? 'walk-in' : 'appointment',
          appointment
        });
      } else {
        slots.push({
          time: timeStr,
          type: 'available'
        });
      }
    }

    console.log('✅ Generating', slots.length, 'time slots');
    setTimeSlots(slots);
  };

  const changeDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const updateSelectedDate = (date: Date) => {
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const openDatePicker = () => {
    const baseDate = selectedDate ? new Date(selectedDate) : new Date();
    setCalendarDate(baseDate);
    setShowDatePicker(true);
  };

  const closeDatePicker = () => setShowDatePicker(false);

  const changeCalendarMonth = (offset: number) => {
    const next = new Date(calendarDate);
    next.setMonth(next.getMonth() + offset);
    setCalendarDate(next);
  };

  const handleSelectCalendarDay = (day: number) => {
    const chosen = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
    updateSelectedDate(chosen);
    setShowDatePicker(false);
  };

  const getCalendarWeeks = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<number | null> = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    const weeks: Array<Array<number | null>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? (isRTL ? 'م' : 'PM') : (isRTL ? 'ص' : 'AM');
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isRTL ? 'ar' : 'en', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string) => {
    // Remove + and any spaces from phone number for WhatsApp
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    Linking.openURL(`whatsapp://send?phone=${cleanPhone}`);
  };

  const handleBookWalkIn = (time: string) => {
    setSelectedTimeSlot(time);
    setWalkInName('');
    setWalkInPhone('');
    setWalkInPhoneLocal('');
    setShowWalkInModal(true);
  };

  const handleRegisterWalkIn = async () => {
    if (!walkInName.trim() || !walkInPhone || !selectedTimeSlot || !selectedClinic) {
      Alert.alert(t.common.error, isRTL ? 'الرجاء إدخال جميع البيانات' : 'Please fill all fields');
      return;
    }

    setRegistering(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .insert({
          doctor_id: doctorData?.id,
          clinic_id: selectedClinic,
          appointment_date: selectedDate,
          time_slot: selectedTimeSlot,
          booking_type: 'walk-in',
          walk_in_name: walkInName.trim(),
          walk_in_phone: walkInPhone,
          status: 'confirmed'
        });

      if (error) throw error;

      await fetchAppointments();
      setShowWalkInModal(false);
      Alert.alert(t.common.success, isRTL ? 'تم تسجيل الزائر' : 'Walk-in registered');
    } catch (error) {
      console.error('Register walk-in error:', error);
      Alert.alert(t.common.error, isRTL ? 'فشل التسجيل' : 'Registration failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleEditWalkIn = (appointment: any) => {
    setEditingAppointment(appointment);
    setEditWalkInName(appointment.walk_in_name || '');
    setEditWalkInPhone(appointment.walk_in_phone || '');
    setShowEditWalkIn(true);
  };

  const handleSaveWalkIn = async () => {
    if (!editingAppointment || !editWalkInName.trim() || !editWalkInPhone) {
      Alert.alert(t.common.error, isRTL ? 'الرجاء إدخال الاسم ورقم الهاتف' : 'Please enter name and phone');
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          walk_in_name: editWalkInName.trim(),
          walk_in_phone: editWalkInPhone
        })
        .eq('id', editingAppointment.id);

      if (error) throw error;

      Alert.alert(t.common.success, isRTL ? 'تم تحديث البيانات' : 'Walk-in updated');
      setShowEditWalkIn(false);
      await fetchAppointments();
    } catch (error) {
      console.error('Update walk-in error:', error);
      Alert.alert(t.common.error, isRTL ? 'فشل التحديث' : 'Update failed');
    } finally {
      setUpdating(false);
    }
  };

  const handleApprove = async (appointmentId: string) => {
    console.log('✅ Approve button pressed for:', appointmentId);
    try {
      // Find the appointment to get patient info
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (!appointment) {
        console.log('❌ Appointment not found:', appointmentId);
        Alert.alert(t.common.error, 'Appointment not found');
        return;
      }

      console.log('📝 Updating appointment status to confirmed...');
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', appointmentId);

      if (error) throw error;
      console.log('✅ Appointment status updated');

      // Send confirmation notification to patient (skip for walk-ins)
      if (appointment.booking_type !== 'walk-in' && appointment.patient_id) {
        const doctorName = profile?.full_name || 'the doctor';
        const clinicName = appointment.clinic_name || 'the clinic';
        await sendAppointmentConfirmationNotification(
          appointment.patient_id,
          doctorName,
          appointment.appointment_date,
          appointment.appointment_time,
          clinicName
        );
      }

      Alert.alert(t.common.success, isRTL ? 'تم تأكيد الموعد' : 'Appointment confirmed');
      console.log('🔄 Fetching appointments...');
      await fetchAppointments(7, true);
      console.log('🔄 Regenerating time slots...');
      generateTimeSlots();
    } catch (error) {
      console.error('❌ Approve error:', error);
      Alert.alert(t.common.error, isRTL ? 'فشل التأكيد' : 'Failed to confirm');
    }
  };

  const handleReject = async (appointmentId: string) => {
    console.log('❌ Reject button pressed for:', appointmentId);
    // Find the appointment to get patient info
    const appointment = appointments.find(apt => apt.id === appointmentId);
    if (!appointment) {
      console.log('❌ Appointment not found:', appointmentId);
      Alert.alert(t.common.error, 'Appointment not found');
      return;
    }

    Alert.alert(
      isRTL ? 'رفض الموعد' : 'Reject Appointment',
      isRTL ? 'هل أنت متأكد؟' : 'Are you sure?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: isRTL ? 'رفض' : 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('📝 Updating appointment status to cancelled...');
              const { error } = await supabase
                .from('appointments')
                .update({ status: 'cancelled' })
                .eq('id', appointmentId);

              if (error) throw error;
              console.log('✅ Appointment status updated');

              // Send cancellation notification to patient (skip for walk-ins)
              if (appointment.booking_type !== 'walk-in' && appointment.patient_id) {
                const doctorName = profile?.full_name || 'the doctor';
                const clinicName = appointment.clinic_name || 'the clinic';
                await sendAppointmentCancellationNotification(
                  appointment.patient_id,
                  doctorName,
                  appointment.appointment_date,
                  appointment.appointment_time,
                  clinicName
                );
              }

              Alert.alert(t.common.success, isRTL ? 'تم رفض الموعد' : 'Appointment rejected');
              console.log('🔄 Fetching appointments...');
              await fetchAppointments(7, true);
              console.log('🔄 Regenerating time slots...');
              generateTimeSlots();
            } catch (error) {
              console.error('❌ Reject error:', error);
              Alert.alert(t.common.error, isRTL ? 'فشل الرفض' : 'Failed to reject');
            }
          }
        }
      ]
    );
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    console.log('🗑️ Cancel button pressed for:', appointmentId);
    Alert.alert(
      isRTL ? 'إلغاء الموعد' : 'Cancel Appointment',
      isRTL ? 'سيتم حذف الموعد وتحرير الوقت. هل أنت متأكد؟' : 'This will delete the appointment and free up the slot. Are you sure?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: isRTL ? 'إلغاء الموعد' : 'Cancel Appointment',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🗑️ Deleting appointment...');
              
              // Get appointment details before deleting for notification
              const appointment = appointments.find(apt => apt.id === appointmentId);
              
              const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', appointmentId);

              if (error) throw error;
              console.log('✅ Appointment deleted');
              
              // Send cancellation notification to patient (skip for walk-ins)
              if (appointment && appointment.booking_type !== 'walk-in' && appointment.patient_id) {
                console.log('📨 Sending cancellation notification to patient:', appointment.patient_id);
                const doctorName = profile?.full_name || 'the doctor';
                const clinicName = appointment.clinic_name || 'the clinic';
                await sendAppointmentCancellationNotification(
                  appointment.patient_id,
                  doctorName,
                  appointment.appointment_date,
                  appointment.appointment_time,
                  clinicName,
                  'Cancelled by doctor'
                );
                console.log('✅ Cancellation notification sent');
              }
              
              Alert.alert(t.common.success, isRTL ? 'تم إلغاء الموعد وتحرير الوقت' : 'Appointment cancelled and slot freed');
              console.log('🔄 Fetching appointments...');
              await fetchAppointments(7, true);
              console.log('🔄 Regenerating time slots...');
              generateTimeSlots();
            } catch (error) {
              console.error('❌ Cancel error:', error);
              Alert.alert(t.common.error, isRTL ? 'فشل الإلغاء' : 'Failed to cancel');
            }
          }
        }
      ]
    );
  };

  const handleOpenReschedule = (appointment: any) => {
    setRescheduleAppointment(appointment);
    setRescheduleDate(appointment.appointment_date);
    setRescheduleTime(appointment.appointment_time);
    setShowRescheduleModal(true);
  };

  const handleReschedule = async () => {
    if (!rescheduleAppointment || !rescheduleDate || !rescheduleTime) {
      Alert.alert(t.common.error, isRTL ? 'الرجاء اختيار التاريخ والوقت' : 'Please select date and time');
      return;
    }

    setRescheduling(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          appointment_date: rescheduleDate,
          time_slot: rescheduleTime
        })
        .eq('id', rescheduleAppointment.id);

      if (error) throw error;

      // Send reschedule notification to patient (skip for walk-ins)
      if (rescheduleAppointment.booking_type !== 'walk-in' && rescheduleAppointment.patient_id) {
        const doctorName = profile?.full_name || 'the doctor';
        const clinicName = rescheduleAppointment.clinic_name || 'the clinic';
        await sendRescheduleNotification(
          rescheduleAppointment.patient_id,
          doctorName,
          rescheduleDate,
          rescheduleTime,
          clinicName
        );
      }

      await fetchAppointments();
      setShowRescheduleModal(false);
      Alert.alert(t.common.success, isRTL ? 'تم إعادة الجدولة' : 'Appointment rescheduled');
    } catch (error) {
      console.error('Reschedule error:', error);
      Alert.alert(t.common.error, isRTL ? 'فشل إعادة الجدولة' : 'Failed to reschedule');
    } finally {
      setRescheduling(false);
    }
  };

  const handleUnblock = async (time: string) => {
    try {
      const { error } = await supabase
        .from('doctor_blocked_slots')
        .delete()
        .eq('doctor_id', doctorData?.id)
        .eq('clinic_id', selectedClinic)
        .eq('blocked_date', selectedDate)
        .eq('time_slot', time);

      if (error) throw error;
      Alert.alert(t.common.success, isRTL ? 'تم إلغاء الحظر' : 'Slot unblocked');
      await fetchBlockedSlots();
    } catch (error) {
      console.error('Unblock error:', error);
      Alert.alert(t.common.error, isRTL ? 'فشل إلغاء الحظر' : 'Failed to unblock');
    }
  };

  const handleOpenBlockModal = (time: string) => {
    setBlockTimeSlot(time);
    setBlockReason('');
    setShowBlockModal(true);
  };

  const handleBlockSlot = async () => {
    if (!blockTimeSlot || !selectedClinic) return;

    setBlocking(true);
    try {
      const { error } = await supabase
        .from('doctor_blocked_slots')
        .insert({
          doctor_id: doctorData?.id,
          clinic_id: selectedClinic,
          blocked_date: selectedDate,
          time_slot: blockTimeSlot,
          reason: blockReason.trim() || null
        });

      if (error) throw error;

      await fetchBlockedSlots();
      setShowBlockModal(false);
      Alert.alert(t.common.success, isRTL ? 'تم حظر الوقت' : 'Slot blocked');
    } catch (error) {
      console.error('Block slot error:', error);
      Alert.alert(t.common.error, isRTL ? 'فشل الحظر' : 'Failed to block');
    } finally {
      setBlocking(false);
    }
  };

  const getSlotMeta = (slot: TimeSlotData) => {
    if (slot.type === 'available') {
      return {
        icon: 'flash-outline' as const,
        iconColor: '#059669',
        chipStyle: styles.slotTypeChipAvailable,
        label: isRTL ? 'متاح' : 'Free'
      };
    }

    if (slot.type === 'blocked') {
      return {
        icon: 'lock-closed-outline' as const,
        iconColor: '#B91C1C',
        chipStyle: styles.slotTypeChipBlocked,
        label: isRTL ? 'محظور' : 'Blocked'
      };
    }

    if (slot.type === 'walk-in') {
      return {
        icon: 'walk-outline' as const,
        iconColor: '#F97316',
        chipStyle: styles.slotTypeChipWalkIn,
        label: isRTL ? 'زائر' : 'Walk-in'
      };
    }

    return {
      icon: 'medkit-outline' as const,
      iconColor: '#2563EB',
      chipStyle: styles.slotTypeChipAppointment,
      label: isRTL ? 'حجز' : 'Online'
    };
  };

  const renderSlotContent = (slot: TimeSlotData) => {
    const meta = getSlotMeta(slot);

    if (slot.type === 'available') {
      return (
        <View style={[styles.slotCardSurface, styles.availableSurface]}>
          <View style={[styles.slotMetaRow, isRTL && styles.slotMetaRowRtl]}>
            <View style={styles.slotLeftContent}>
              <View style={[styles.slotTypeChip, meta.chipStyle]}>
                <Ionicons name={meta.icon} size={14} color={meta.iconColor} />
                <Text style={styles.slotTypeChipText}>{meta.label}</Text>
              </View>
            </View>
            
            <View style={styles.inlineActions}>
              <TouchableOpacity 
                style={styles.iconChip}
                onPress={() => handleBookWalkIn(slot.time)}
              >
                <Ionicons name="person-add-outline" size={16} color="#1D4ED8" />
                <Text style={styles.iconChipText}>{isRTL ? 'زائر' : 'Walk-in'}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.iconChip, styles.iconChipDanger]}
                onPress={() => handleOpenBlockModal(slot.time)}
              >
                <Ionicons name="remove-circle-outline" size={16} color="#B91C1C" />
                <Text style={[styles.iconChipText, styles.iconChipTextDanger]}>{isRTL ? 'حظر' : 'Block'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.availableRow}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.availableLabel}>
              {isRTL ? 'أضف زائر أو احجز كتلة زمنية' : 'Add a walk-in or block this time'}
            </Text>
          </View>
        </View>
      );
    }

    if (slot.type === 'blocked') {
      return (
        <View style={[styles.slotCardSurface, styles.blockedSurface]}>
          <View style={styles.slotMetaRow}>
            <View style={[styles.slotTypeChip, meta.chipStyle]}>
              <Ionicons name={meta.icon} size={14} color={meta.iconColor} />
              <Text style={styles.slotTypeChipText}>{meta.label}</Text>
            </View>
            <View style={[styles.statusPill, styles.statusPillMuted]}>
              <Text style={styles.statusPillText}>{isRTL ? 'غير متاح' : 'Unavailable'}</Text>
            </View>
          </View>

          <View style={styles.blockedRow}>
            <Ionicons name="lock-closed-outline" size={18} color="#B91C1C" />
            <View style={styles.blockedCopy}>
              <Text style={styles.blockedTitleText}>{isRTL ? 'تم حظر هذا الوقت' : 'This slot is blocked'}</Text>
              {slot.blockedReason && (
                <Text style={styles.blockedReasonText}>{slot.blockedReason}</Text>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.linkButton} onPress={() => handleUnblock(slot.time)}>
            <Ionicons name="refresh-outline" size={14} color="#2563EB" />
            <Text style={styles.linkButtonText}>{isRTL ? 'إلغاء الحظر' : 'Unblock'}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!slot.appointment) return null;

    const isWalkIn = slot.type === 'walk-in';
    const status = slot.appointment.status;
    const rawPhone = isWalkIn ? slot.appointment.walk_in_phone : slot.appointment.patient_mobile;
    const contactPhone = rawPhone || '';
    const showContact = Boolean(contactPhone);

    return (
      <View style={[styles.slotCardSurface, styles.appointmentSurface]}>
        <View style={styles.slotMetaRow}>
          <View style={[styles.slotTypeChip, meta.chipStyle]}>
            <Ionicons name={meta.icon} size={14} color={meta.iconColor} />
            <Text style={styles.slotTypeChipText}>{meta.label}</Text>
          </View>
          <View style={[
            styles.statusPill,
            isWalkIn && styles.statusPillWalkIn,
            status === 'pending' && styles.statusPillPending,
            status === 'confirmed' && styles.statusPillConfirmed
          ]}>
            <Text style={styles.statusPillText}>
              {isWalkIn
                ? (isRTL ? 'زائر' : 'Walk-in')
                : status === 'pending'
                ? (isRTL ? 'معلق' : 'Pending')
                : (isRTL ? 'مؤكد' : 'Confirmed')}
            </Text>
          </View>
        </View>

        <View style={styles.patientRow}>
          <View style={[styles.patientIcon, isWalkIn && styles.patientIconWalkIn]}>
            <Ionicons
              name={isWalkIn ? 'walk-outline' : 'person-circle-outline'}
              size={18}
              color={isWalkIn ? '#F97316' : '#2563EB'}
            />
          </View>
          <TouchableOpacity
            style={styles.patientDetails}
            activeOpacity={isWalkIn ? 0.8 : 1}
            onPress={() => isWalkIn && handleEditWalkIn(slot.appointment)}
          >
            <Text style={styles.patientNameText} numberOfLines={1}>
              {slot.appointment.patient_name}
            </Text>
            {(isWalkIn || (!isWalkIn && !showContact)) && (
              <View style={styles.patientMetaRow}>
                {isWalkIn && (
                  <Text style={styles.metaHint}>{isRTL ? 'اضغط للتعديل' : 'Tap to edit'}</Text>
                )}
                {!isWalkIn && !showContact && (
                  <Text style={styles.noPhoneLabel}>{isRTL ? 'لا يوجد رقم' : 'No phone'}</Text>
                )}
              </View>
            )}
          </TouchableOpacity>
          {showContact && (
            <View style={styles.contactRow}>
              <TouchableOpacity
                style={styles.contactButton}
                onPress={() => handleCall(contactPhone)}
              >
                <Ionicons name="call-outline" size={15} color="#059669" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactButton, styles.contactButtonWhatsapp]}
                onPress={() => handleWhatsApp(contactPhone)}
              >
                <Ionicons name="logo-whatsapp" size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.actionRow}>
          {status === 'pending' && (
            <>
              <TouchableOpacity
                style={[styles.actionChip, styles.actionChipSuccess]}
                onPress={() => handleApprove(slot.appointment.id)}
              >
                <Ionicons name="checkmark-outline" size={14} color="#065F46" />
                <Text style={styles.actionChipText}>{isRTL ? 'قبول' : 'Approve'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionChip, styles.actionChipDanger]}
                onPress={() => handleReject(slot.appointment.id)}
              >
                <Ionicons name="close-outline" size={14} color="#991B1B" />
                <Text style={styles.actionChipText}>{isRTL ? 'رفض' : 'Reject'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionChip}
                onPress={() => handleOpenReschedule(slot.appointment)}
              >
                <Ionicons name="calendar-outline" size={14} color="#1D4ED8" />
                <Text style={styles.actionChipText}>{isRTL ? 'إعادة' : 'Reschedule'}</Text>
              </TouchableOpacity>
            </>
          )}
          {status === 'confirmed' && (
            <>
              <TouchableOpacity
                style={styles.actionChip}
                onPress={() => handleOpenReschedule(slot.appointment)}
              >
                <Ionicons name="calendar-outline" size={14} color="#1D4ED8" />
                <Text style={styles.actionChipText}>{isRTL ? 'إعادة' : 'Reschedule'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionChip, styles.actionChipDanger]}
                onPress={() => handleCancelAppointment(slot.appointment.id)}
              >
                <Ionicons name="trash-outline" size={14} color="#991B1B" />
                <Text style={styles.actionChipText}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const getStats = () => {
    const confirmed = timeSlots.filter(s => s.type === 'appointment' && s.appointment?.status === 'confirmed').length;
    const pending = timeSlots.filter(s => s.type === 'appointment' && s.appointment?.status === 'pending').length;
    const walkIns = timeSlots.filter(s => s.type === 'walk-in').length;
    const blocked = timeSlots.filter(s => s.type === 'blocked').length;
    const available = timeSlots.filter(s => s.type === 'available').length;
    return { confirmed, pending, walkIns, blocked, available, total: timeSlots.length };
  };

  const getEmptyStateReason = () => {
    if (!selectedClinic) return { icon: 'alert-circle-outline', title: isRTL ? 'اختر عيادة' : 'Select a Clinic', subtitle: isRTL ? 'يرجى اختيار عيادة لعرض المواعيد' : 'Please select a clinic to view appointments' };
    
    const clinic = clinics.find(c => c.id === selectedClinic);
    if (!clinic) return { icon: 'alert-circle-outline', title: isRTL ? 'عيادة غير موجودة' : 'Clinic Not Found', subtitle: isRTL ? 'لم يتم العثور على العيادة المحددة' : 'The selected clinic was not found' };
    
    if (!doctorData?.is_approved) return { icon: 'time-outline', title: isRTL ? 'في انتظار الموافقة' : 'Pending Approval', subtitle: isRTL ? 'حسابك قيد المراجعة. سيتم تفعيل المواعيد بعد الموافقة.' : 'Your account is under review. Appointments will be enabled after approval.' };
    
    if (!clinic.is_active) return { icon: 'pause-circle-outline', title: isRTL ? 'العيادة غير نشطة' : 'Clinic Inactive', subtitle: isRTL ? 'قم بتفعيل العيادة لبدء استقبال المواعيد' : 'Activate the clinic to start receiving appointments' };
    
    if (!clinic.schedule) return { icon: 'settings-outline', title: isRTL ? 'لم يتم تعيين الجدول' : 'Schedule Not Set', subtitle: isRTL ? 'يرجى تكوين جدول العمل للعيادة أولاً' : 'Please configure the clinic schedule first' };
    
    const dayKey = getDayKey(selectedDate);
    if (clinic.schedule.weekly_off?.includes(dayKey)) return { icon: 'calendar-outline', title: isRTL ? 'يوم عطلة' : 'Day Off', subtitle: isRTL ? 'هذا اليوم مخصص كعطلة أسبوعية' : 'This day is set as a weekly off day' };
    
    return { icon: 'calendar-outline', title: isRTL ? 'لا توجد مواعيد' : 'No Appointments', subtitle: isRTL ? 'لا توجد مواعيد مجدولة لهذا اليوم.' : 'No appointments scheduled for this day.' };
  };

  const stats = getStats();
  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const weekdayLabels = isRTL ? ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const calendarWeeks = getCalendarWeeks();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Hero Banner */}
      <LinearGradient
        colors={[patientTheme.colors.primary, patientTheme.colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroBanner, { paddingTop: insets.top + 12 }]}
      >
        {/* Decorative elements */}
        <View style={styles.heroDecorativeCircle1} />
        <View style={styles.heroDecorativeCircle2} />
        
        <View style={[styles.heroContent, isRTL && styles.heroContentRtl]}>
          <View style={styles.heroTextSection}>
            <View style={[styles.heroBadge, isRTL && styles.heroBadgeRtl]}>
              <Ionicons name="calendar" size={12} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>{isRTL ? 'الجدول اليومي' : 'Daily Schedule'}</Text>
            </View>
            <Text style={[styles.heroTitle, isRTL && styles.textRight]}>
              {isRTL ? 'إدارة المواعيد اليومية' : 'Manage Daily Appointments'}
            </Text>
            <Text style={[styles.heroSubtitle, isRTL && styles.textRight]}>
              {isRTL ? 'راجع وأكّد حجوزات اليوم' : 'Review and confirm today\'s bookings'}
            </Text>
          </View>
          
          <View style={styles.heroIconBubble}>
            <View style={styles.heroIconInner}>
              <Ionicons name="calendar-outline" size={28} color="#FFFFFF" />
            </View>
          </View>
        </View>

        {/* Date Navigator */}
        <View style={[styles.dateNavigator, isRTL && styles.dateNavigatorRtl]}>
          <TouchableOpacity style={styles.navButton} onPress={() => changeDate(-1)}>
            <Ionicons name={isRTL ? "chevron-forward" : "chevron-back"} size={20} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.dateDisplay} onPress={openDatePicker}>
            <View style={[styles.dateCard, isRTL && styles.dateCardRtl]}>
              <Ionicons name="calendar" size={18} color={patientTheme.colors.primary} />
              <View style={styles.dateLabelGroup}>
                <Text style={[styles.dateText, isRTL && styles.textRight]}>{formatDate(selectedDate)}</Text>
                <Text style={[styles.dateHint, isRTL && styles.textRight]}>
                  {isToday ? (isRTL ? 'اليوم' : 'Today') : (isRTL ? 'انقر للتغيير' : 'Tap to change')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.navButton} onPress={() => changeDate(1)}>
            <Ionicons name={isRTL ? "chevron-back" : "chevron-forward"} size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Clinic Filter */}
      {clinics.length > 1 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.clinicFilter}
        >
          {clinics.map(clinic => (
            <TouchableOpacity
              key={clinic.id}
              style={[
                styles.clinicChip,
                selectedClinic === clinic.id && styles.clinicChipSelected
              ]}
              onPress={() => setSelectedClinic(clinic.id)}
            >
              <Text style={[
                styles.clinicChipText,
                selectedClinic === clinic.id && styles.clinicChipTextSelected
              ]}>
                {clinic.clinic_name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Stats Summary */}
      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.confirmed}</Text>
          <Text style={styles.statLabel}>{isRTL ? 'مؤكد' : 'Confirmed'}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>{isRTL ? 'معلق' : 'Pending'}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.walkIns}</Text>
          <Text style={styles.statLabel}>{isRTL ? 'زائر' : 'Walk-in'}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.available}</Text>
          <Text style={styles.statLabel}>{isRTL ? 'متاح' : 'Free'}</Text>
        </View>
      </View>

      {/* Timeline */}
      <ScrollView 
        key={`timeline-${appointments.length}-${selectedDate}-${selectedClinic}`}
        style={styles.timeline}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {timeSlots.length === 0 ? (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={['#F0F9FF', '#E0F2FE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyCard}
            >
              <View style={styles.emptyIconContainer}>
                <View style={styles.emptyIconOuter}>
                  <View style={styles.emptyIconInner}>
                    <Ionicons name={getEmptyStateReason().icon as any} size={40} color="#2563EB" />
                  </View>
                </View>
              </View>
              
              <Text style={[styles.emptyTitle, isRTL && styles.textRight]}>
                {getEmptyStateReason().title}
              </Text>
              <Text style={[styles.emptySubtitle, isRTL && styles.textRight]}>
                {getEmptyStateReason().subtitle}
              </Text>
            </LinearGradient>
          </View>
        ) : (
          timeSlots.map((slot, index) => (
            <View key={`${slot.time}-${index}`} style={styles.slotRow}>
              <View style={styles.slotTime}>
                <Text style={[styles.timeText, isRTL && styles.textRight]}>{formatTime(slot.time)}</Text>
              </View>
              <View style={styles.slotDivider} />
              <View style={styles.slotBody}>{renderSlotContent(slot)}</View>
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {showDatePicker && (
        <Modal visible={showDatePicker} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.calendarModal]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{isRTL ? '📅 اختر التاريخ' : '📅 Select Date'}</Text>
                <TouchableOpacity onPress={closeDatePicker}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.calendarControlRow}>
                <TouchableOpacity style={styles.calendarNavButton} onPress={() => changeCalendarMonth(-1)}>
                  <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color="#1D4ED8" />
                </TouchableOpacity>
                <Text style={[styles.calendarMonthText, isRTL && styles.textRight]}>
                  {calendarDate.toLocaleDateString(isRTL ? 'ar' : 'en', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity style={styles.calendarNavButton} onPress={() => changeCalendarMonth(1)}>
                  <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color="#1D4ED8" />
                </TouchableOpacity>
              </View>

              <View style={styles.calendarWeekRow}>
                {weekdayLabels.map(label => (
                  <Text key={label} style={styles.calendarWeekDayLabel}>{label}</Text>
                ))}
              </View>

              <View>
                {calendarWeeks.map((week, weekIndex) => (
                  <View key={`week-${weekIndex}`} style={styles.calendarWeekRow}>
                    {week.map((day, dayIndex) => {
                      if (!day) {
                        return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.calendarDayPlaceholder} />;
                      }

                      const dateKey = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day).toISOString().split('T')[0];
                      const isSelectedDay = dateKey === selectedDate;
                      const isTodayDay = dateKey === new Date().toISOString().split('T')[0];

                      return (
                        <TouchableOpacity
                          key={`day-${weekIndex}-${dayIndex}`}
                          style={[
                            styles.calendarDay,
                            isSelectedDay && styles.calendarDaySelected,
                            !isSelectedDay && isTodayDay && styles.calendarDayToday
                          ]}
                          onPress={() => handleSelectCalendarDay(day)}
                        >
                          <Text
                            style={[
                              styles.calendarDayText,
                              isSelectedDay && styles.calendarDayTextSelected,
                              !isSelectedDay && isTodayDay && styles.calendarDayTextToday
                            ]}
                          >
                            {day}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={styles.modalButtonSecondary}
                  onPress={closeDatePicker}
                >
                  <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalButtonPrimary}
                  onPress={() => {
                    goToToday();
                    closeDatePicker();
                  }}
                >
                  <Text style={styles.modalButtonPrimaryText}>{isRTL ? 'اليوم' : 'Jump to Today'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Edit Walk-In Modal */}
      <Modal visible={showEditWalkIn} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isRTL ? '✏️ تعديل بيانات الزائر' : '✏️ Edit Walk-In'}
              </Text>
              <TouchableOpacity onPress={() => setShowEditWalkIn(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>{isRTL ? 'الاسم' : 'Name'}</Text>
              <TextInput
                style={[styles.input, isRTL && styles.textRight]}
                value={editWalkInName}
                onChangeText={setEditWalkInName}
                placeholder={isRTL ? 'أدخل الاسم' : 'Enter name'}
                editable={!updating}
              />

              <PhoneInput
                value={editWalkInPhone}
                onChangeValue={(e164, local) => {
                  setEditWalkInPhone(e164);
                  setEditWalkInPhoneLocal(local);
                }}
                type="mobile"
                label={isRTL ? 'رقم الهاتف' : 'Phone'}
                icon="call-outline"
                isRTL={isRTL}
                disabled={updating}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButtonSecondary}
                onPress={() => setShowEditWalkIn(false)}
                disabled={updating}
              >
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButtonPrimary, updating && styles.buttonDisabled]}
                onPress={handleSaveWalkIn}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>{t.common.save || 'Save'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Walk-In Registration Modal */}
      <Modal visible={showWalkInModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isRTL ? '🚶 تسجيل زائر' : '🚶 Register Walk-In'}
              </Text>
              <TouchableOpacity onPress={() => setShowWalkInModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>{isRTL ? 'الاسم' : 'Name'}</Text>
              <TextInput
                style={[styles.input, isRTL && styles.textRight]}
                value={walkInName}
                onChangeText={setWalkInName}
                placeholder={isRTL ? 'أدخل الاسم' : 'Enter name'}
                editable={!registering}
              />

              <PhoneInput
                value={walkInPhone}
                onChangeValue={(e164, local) => {
                  setWalkInPhone(e164);
                  setWalkInPhoneLocal(local);
                }}
                type="mobile"
                label={isRTL ? 'رقم الهاتف' : 'Phone'}
                icon="call-outline"
                isRTL={isRTL}
                disabled={registering}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButtonSecondary}
                onPress={() => setShowWalkInModal(false)}
                disabled={registering}
              >
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButtonPrimary, registering && styles.buttonDisabled]}
                onPress={handleRegisterWalkIn}
                disabled={registering}
              >
                {registering ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>{isRTL ? 'تسجيل' : 'Register'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Block Slot Modal */}
      <Modal visible={showBlockModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isRTL ? '🚫 حظر وقت' : '🚫 Block Slot'}
              </Text>
              <TouchableOpacity onPress={() => setShowBlockModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>{isRTL ? 'السبب (اختياري)' : 'Reason (optional)'}</Text>
              <TextInput
                style={[styles.input, styles.textArea, isRTL && styles.textRight]}
                value={blockReason}
                onChangeText={setBlockReason}
                placeholder={isRTL ? 'أدخل السبب' : 'Enter reason'}
                multiline
                numberOfLines={3}
                editable={!blocking}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButtonSecondary}
                onPress={() => setShowBlockModal(false)}
                disabled={blocking}
              >
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButtonPrimary, styles.modalButtonDanger, blocking && styles.buttonDisabled]}
                onPress={handleBlockSlot}
                disabled={blocking}
              >
                {blocking ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>{isRTL ? 'حظر' : 'Block'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reschedule Modal */}
      <Modal visible={showRescheduleModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isRTL ? '📅 إعادة جدولة الموعد' : '📅 Reschedule Appointment'}
              </Text>
              <TouchableOpacity onPress={() => setShowRescheduleModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>{isRTL ? 'التاريخ' : 'Date'}</Text>
              <TextInput
                style={[styles.input, isRTL && styles.textRight]}
                value={rescheduleDate}
                onChangeText={setRescheduleDate}
                placeholder="YYYY-MM-DD"
                editable={!rescheduling}
              />

              <Text style={styles.inputLabel}>{isRTL ? 'الوقت' : 'Time'}</Text>
              <TextInput
                style={[styles.input, isRTL && styles.textRight]}
                value={rescheduleTime}
                onChangeText={setRescheduleTime}
                placeholder="HH:MM"
                editable={!rescheduling}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButtonSecondary}
                onPress={() => setShowRescheduleModal(false)}
                disabled={rescheduling}
              >
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButtonPrimary, rescheduling && styles.buttonDisabled]}
                onPress={handleReschedule}
                disabled={rescheduling}
              >
                {rescheduling ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>{isRTL ? 'حفظ' : 'Reschedule'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#6B7280', fontSize: 16 },
  textRight: { textAlign: 'right' },
  
  heroBanner: {
    paddingBottom: 12,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  heroDecorativeCircle1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: -90,
    right: -40,
  },
  heroDecorativeCircle2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    bottom: -40,
    left: -30,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    zIndex: 1,
  },
  heroContentRtl: { flexDirection: 'row-reverse' },
  heroTextSection: { flex: 1 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  heroBadgeRtl: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  heroBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  heroTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', lineHeight: 22, marginBottom: 3 },
  heroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 16, fontWeight: '400' },
  heroIconBubble: { 
    width: 44, 
    height: 44, 
    borderRadius: 10, 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginLeft: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroIconInner: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  dateNavigatorRtl: { flexDirection: 'row-reverse' },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDisplay: {
    flex: 1,
    marginHorizontal: 8,
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateCardRtl: { flexDirection: 'row-reverse' },
  dateLabelGroup: { flex: 1 },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 1,
  },
  dateHint: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  
  clinicFilter: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    maxHeight: 60,
  },
  clinicChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clinicChipSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
  },
  clinicChipText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  clinicChipTextSelected: {
    color: '#2563EB',
    fontWeight: '600',
  },
  
  stats: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    lineHeight: 20,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 14,
  },
  
  timeline: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  slotRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'flex-start',
    gap: 12,
  },
  slotTime: {
    width: 70,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  slotDivider: {
    width: 2,
    borderRadius: 1,
    backgroundColor: '#E5E7EB',
    alignSelf: 'stretch',
  },
  slotBody: {
    flex: 1,
  },
  slotCardSurface: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    padding: 8,
    gap: 6,
  },
  availableSurface: {
    borderStyle: 'dashed',
    backgroundColor: '#F9FAFB',
  },
  appointmentSurface: {
    borderColor: '#E0E7FF',
  },
  blockedSurface: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  slotMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  slotMetaRowRtl: {
    flexDirection: 'row-reverse',
  },
  slotLeftContent: {
    flex: 1,
  },
  slotTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  slotTypeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  slotTypeChipAvailable: {
    backgroundColor: '#ECFDF5',
  },
  slotTypeChipBlocked: {
    backgroundColor: '#FEE2E2',
  },
  slotTypeChipWalkIn: {
    backgroundColor: '#FEF3C7',
  },
  slotTypeChipAppointment: {
    backgroundColor: '#DBEAFE',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPillConfirmed: {
    backgroundColor: '#D1FAE5',
  },
  statusPillWalkIn: {
    backgroundColor: '#FDE68A',
  },
  statusPillMuted: {
    backgroundColor: '#E5E7EB',
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  availableLabel: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
  },
  inlineActions: {
    flexDirection: 'column',
    gap: 4,
  },
  iconChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    minWidth: 80,
  },
  iconChipDanger: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  iconChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  iconChipTextDanger: {
    color: '#B91C1C',
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  blockedCopy: {
    flex: 1,
  },
  blockedTitleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991B1B',
  },
  blockedReasonText: {
    fontSize: 12,
    color: '#7F1D1D',
    marginTop: 4,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  patientIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientIconWalkIn: {
    backgroundColor: '#FFEDD5',
  },
  patientDetails: {
    flex: 1,
  },
  patientNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  patientMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  metaHint: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  noPhoneLabel: {
    fontSize: 11,
    color: '#F59E0B',
  },
  contactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactButtonWhatsapp: {
    backgroundColor: '#22C55E',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionChipSuccess: {
    borderColor: '#A7F3D0',
    backgroundColor: '#D1FAE5',
  },
  actionChipDanger: {
    borderColor: '#FECACA',
    backgroundColor: '#FEE2E2',
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  
  emptyState: {
    padding: 20,
    paddingTop: 60,
  },
  emptyCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.1)',
  },
  emptyIconContainer: {
    marginBottom: 20,
  },
  emptyIconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalBody: {
    marginBottom: 20,
  },
  calendarModal: {
    width: '100%',
    maxWidth: 360,
  },
  calendarControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  calendarMonthText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calendarWeekDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  calendarDayPlaceholder: {
    flex: 1,
    marginHorizontal: 4,
    aspectRatio: 1,
  },
  calendarDay: {
    flex: 1,
    aspectRatio: 1,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calendarDaySelected: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  calendarDayToday: {
    borderColor: '#FACC15',
    backgroundColor: '#FEF9C3',
  },
  calendarDayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  calendarDayTextSelected: {
    color: '#fff',
  },
  calendarDayTextToday: {
    color: '#92400E',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 16,
  },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  modalButtonDanger: {
    backgroundColor: '#DC2626',
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
