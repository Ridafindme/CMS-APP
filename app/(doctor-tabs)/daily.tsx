import PhoneInput from '@/components/ui/phone-input';
import { getDayKey, minutesToTime, timeToMinutes, useDoctorContext } from '@/lib/DoctorContext';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

type TimeSlotData = {
  time: string;
  type: 'available' | 'appointment' | 'walk-in' | 'blocked';
  appointment?: any;
  blockedReason?: string;
};

export default function DailyScheduleScreen() {
  const { t, isRTL } = useI18n();
  const { loading, appointments, clinics, blockedSlots, fetchAppointments, fetchBlockedSlots, doctorData } = useDoctorContext();
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedClinic, setSelectedClinic] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [timeSlots, setTimeSlots] = useState<TimeSlotData[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAppointments(), fetchBlockedSlots()]);
    setRefreshing(false);
  };

  const generateTimeSlots = () => {
    if (!selectedClinic) return;

    const clinic = clinics.find(c => c.id === selectedClinic);
    if (!clinic || !clinic.schedule) return;

    const dayKey = getDayKey(selectedDate);
    const schedule = clinic.schedule;
    const slotMinutes = clinic.slot_minutes || 30;

    // Check if day is weekly off
    if (schedule.weekly_off?.includes(dayKey)) {
      setTimeSlots([]);
      return;
    }

    // Get schedule for this day
    const daySchedule = (schedule as any)[dayKey] || schedule.default;
    if (!daySchedule?.start || !daySchedule?.end) {
      setTimeSlots([]);
      return;
    }

    const startMin = timeToMinutes(daySchedule.start);
    const endMin = timeToMinutes(daySchedule.end);
    if (startMin === null || endMin === null) return;

    const breakStartMin = daySchedule.break_start ? timeToMinutes(daySchedule.break_start) : null;
    const breakEndMin = daySchedule.break_end ? timeToMinutes(daySchedule.break_end) : null;

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
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', appointmentId);

      if (error) throw error;
      Alert.alert(t.common.success, isRTL ? 'تم تأكيد الموعد' : 'Appointment confirmed');
      await fetchAppointments();
    } catch (error) {
      console.error('Approve error:', error);
      Alert.alert(t.common.error, isRTL ? 'فشل التأكيد' : 'Failed to confirm');
    }
  };

  const handleReject = async (appointmentId: string) => {
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
              const { error } = await supabase
                .from('appointments')
                .update({ status: 'cancelled' })
                .eq('id', appointmentId);

              if (error) throw error;
              Alert.alert(t.common.success, isRTL ? 'تم رفض الموعد' : 'Appointment rejected');
              await fetchAppointments();
            } catch (error) {
              console.error('Reject error:', error);
              Alert.alert(t.common.error, isRTL ? 'فشل الرفض' : 'Failed to reject');
            }
          }
        }
      ]
    );
  };

  const handleCancelAppointment = async (appointmentId: string) => {
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
              const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', appointmentId);

              if (error) throw error;
              Alert.alert(t.common.success, isRTL ? 'تم إلغاء الموعد وتحرير الوقت' : 'Appointment cancelled and slot freed');
              await fetchAppointments();
            } catch (error) {
              console.error('Cancel error:', error);
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

  const getStats = () => {
    const confirmed = timeSlots.filter(s => s.type === 'appointment' && s.appointment?.status === 'confirmed').length;
    const pending = timeSlots.filter(s => s.type === 'appointment' && s.appointment?.status === 'pending').length;
    const walkIns = timeSlots.filter(s => s.type === 'walk-in').length;
    const blocked = timeSlots.filter(s => s.type === 'blocked').length;
    const available = timeSlots.filter(s => s.type === 'available').length;
    return { confirmed, pending, walkIns, blocked, available, total: timeSlots.length };
  };

  const stats = getStats();
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

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
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.textRight]}>
          {isRTL ? 'الجدول اليومي' : 'Daily Schedule'}
        </Text>
      </View>

      {/* Date Navigator */}
      <View style={styles.dateNavigator}>
        <TouchableOpacity style={styles.navButton} onPress={() => changeDate(-1)}>
          <Ionicons name="chevron-back" size={24} color="#2563EB" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.dateDisplay} onPress={goToToday}>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          {!isToday && <Text style={styles.todayHint}>{isRTL ? 'اضغط للعودة لليوم' : 'Tap for today'}</Text>}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navButton} onPress={() => changeDate(1)}>
          <Ionicons name="chevron-forward" size={24} color="#2563EB" />
        </TouchableOpacity>
      </View>

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
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyText}>
              {isRTL ? 'لا توجد مواعيد في هذا اليوم' : 'No schedule for this day'}
            </Text>
          </View>
        ) : (
          timeSlots.map((slot, index) => (
            <View key={index} style={styles.slotContainer}>
              {slot.type === 'available' ? (
                <View style={[styles.slotCard, styles.availableCard, styles.availableCardFull, styles.availableSlotCard]}>
                  <Text style={styles.cardTime}>{formatTime(slot.time)}</Text>
                  <Text style={styles.availableText}>
                    {isRTL ? '⚪ متاح' : '⚪ Available'}
                  </Text>
                  <View style={styles.availableActions}>
                    <TouchableOpacity 
                      style={styles.bookButton}
                      onPress={() => handleBookWalkIn(slot.time)}
                    >
                      <Ionicons name="person-add" size={16} color="#2563EB" />
                      <Text style={styles.bookButtonText}>{isRTL ? 'تسجيل زائر' : 'Book Walk-in'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.blockButton}
                      onPress={() => handleOpenBlockModal(slot.time)}
                    >
                      <Ionicons name="ban" size={16} color="#DC2626" />
                      <Text style={styles.blockButtonText}>{isRTL ? 'حظر' : 'Block'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : slot.type === 'blocked' ? (
                <View style={[styles.slotCard, styles.blockedCard, styles.blockedCardFull]}>
                  <Text style={styles.cardTime}>{formatTime(slot.time)}</Text>
                  <View style={styles.cardContent}>
                    <Text style={styles.blockedTitle}>🚫 {isRTL ? 'محظور' : 'Blocked'}</Text>
                    {slot.blockedReason && (
                      <Text style={styles.blockedReason}>{slot.blockedReason}</Text>
                    )}
                  </View>
                  <TouchableOpacity 
                    style={styles.unblockButton}
                    onPress={() => handleUnblock(slot.time)}
                  >
                    <Text style={styles.unblockButtonText}>{isRTL ? 'إلغاء' : 'Unblock'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.slotCard, styles.appointmentCard, styles.appointmentCardFull]}>
                  <View style={styles.cardMain}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.cardTime}>{formatTime(slot.time)}</Text>
                      <TouchableOpacity 
                        onPress={() => slot.type === 'walk-in' && handleEditWalkIn(slot.appointment)}
                        style={styles.patientInfo}
                      >
                        <Text style={styles.patientName} numberOfLines={2}>
                          {slot.type === 'walk-in' ? '🚶 ' : '👤 '}
                          {slot.appointment.patient_name}
                        </Text>
                        {slot.type === 'walk-in' && (
                          <Text style={styles.editHint}>{isRTL ? '(اضغط للتعديل)' : '(tap to edit)'}</Text>
                        )}
                        {slot.type === 'appointment' && !slot.appointment.patient_mobile && (
                          <Text style={styles.noPhoneHint}>{isRTL ? 'لا يوجد رقم هاتف' : 'No phone'}</Text>
                        )}
                      </TouchableOpacity>
                      <View style={[
                        styles.statusBadgeInline,
                        slot.appointment.status === 'pending' && styles.pendingBadge,
                        slot.appointment.status === 'confirmed' && styles.confirmedBadge,
                        slot.type === 'walk-in' && styles.walkInBadge
                      ]}>
                        <Text style={styles.statusText}>
                          {slot.type === 'walk-in' 
                            ? (isRTL ? 'زائر' : 'Walk-in')
                            : slot.appointment.status === 'pending' 
                            ? (isRTL ? 'معلق' : 'Pending')
                            : (isRTL ? 'مؤكد' : 'Confirmed')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardRight}>
                      {/* Debug call button logic */}
                      {(() => {
                        const hasWalkInPhone = slot.type === 'walk-in' && slot.appointment.walk_in_phone;
                        const hasPatientMobile = slot.type === 'appointment' && slot.appointment.patient_mobile;
                        const shouldShowCall = hasWalkInPhone || hasPatientMobile;
                        
                        console.log('📞 Call button check:', {
                          slotType: slot.type,
                          hasWalkInPhone,
                          hasPatientMobile,
                          shouldShowCall,
                          walkInPhone: slot.appointment.walk_in_phone,
                          patientMobile: slot.appointment.patient_mobile
                        });
                        
                        return shouldShowCall ? (
                          <View style={styles.contactButtons}>
                            <TouchableOpacity 
                              style={styles.callButton}
                              onPress={() => handleCall(
                                slot.type === 'walk-in' 
                                  ? slot.appointment.walk_in_phone 
                                  : slot.appointment.patient_mobile
                              )}
                            >
                              <Ionicons name="call" size={18} color="#10B981" />
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.whatsappButton}
                              onPress={() => handleWhatsApp(
                                slot.type === 'walk-in' 
                                  ? slot.appointment.walk_in_phone 
                                  : slot.appointment.patient_mobile
                              )}
                            >
                              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ) : null;
                      })()}
                    </View>
                  </View>

                  {/* Quick Actions */}
                  <View style={styles.actions}>
                    {slot.appointment.status === 'pending' && (
                      <>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleApprove(slot.appointment.id)}
                        >
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                          <Text style={styles.actionButtonText}>{isRTL ? 'قبول' : 'Approve'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleReject(slot.appointment.id)}
                        >
                          <Ionicons name="close-circle" size={16} color="#EF4444" />
                          <Text style={styles.actionButtonText}>{isRTL ? 'رفض' : 'Reject'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleOpenReschedule(slot.appointment)}
                        >
                          <Ionicons name="calendar" size={16} color="#2563EB" />
                          <Text style={styles.actionButtonText}>{isRTL ? 'إعادة جدولة' : 'Reschedule'}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {slot.appointment.status === 'confirmed' && (
                      <>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleOpenReschedule(slot.appointment)}
                        >
                          <Ionicons name="calendar" size={16} color="#2563EB" />
                          <Text style={styles.actionButtonText}>{isRTL ? 'إعادة جدولة' : 'Reschedule'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleCancelAppointment(slot.appointment.id)}
                        >
                          <Ionicons name="trash" size={16} color="#DC2626" />
                          <Text style={styles.actionButtonText}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              )}
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

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
                icon="📱"
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
                icon="📱"
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
  
  header: {
    backgroundColor: '#2563EB',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  navButton: {
    padding: 8,
  },
  dateDisplay: {
    flex: 1,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  todayHint: {
    fontSize: 11,
    color: '#2563EB',
    marginTop: 2,
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  
  timeline: {
    flex: 1,
  },
  slotContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timeLabel: {
    width: 80,
    paddingTop: 4,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  
  slotCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
  },
  availableSlotCard: {
    padding: 8,
  },
  availableCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  availableCardFull: {
    marginLeft: 0,
  },
  availableText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 4,
  },
  availableActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bookButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
  },
  bookButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  blockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  blockButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
  },
  
  blockedCard: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  blockedCardFull: {
    marginLeft: 0,
  },
  blockedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: 4,
  },
  blockedReason: {
    fontSize: 12,
    color: '#7F1D1D',
  },
  cardContent: {
    flex: 1,
  },
  unblockButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  unblockButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  
  appointmentCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  appointmentCardFull: {
    marginLeft: 0,
  },
  cardMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardLeft: {
    flex: 1,
    marginRight: 8,
  },
  cardTime: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 4,
  },
  patientInfo: {
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flexWrap: 'wrap',
  },
  editHint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  noPhoneHint: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 2,
  },
  
  cardRight: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  contactButtons: {
    flexDirection: 'column',
    gap: 8,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeInline: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
  },
  confirmedBadge: {
    backgroundColor: '#D1FAE5',
  },
  walkInBadge: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
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
