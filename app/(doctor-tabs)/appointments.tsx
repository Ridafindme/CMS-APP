import { useDoctorContext } from '@/lib/DoctorContext';
import { useI18n } from '@/lib/i18n';
import {
    sendAppointmentCancellationNotification,
    sendAppointmentConfirmationNotification,
    sendRescheduleNotification,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

// Import helper functions for slot generation
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

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const getDayKey = (dateString: string) => {
  const date = new Date(dateString);
  return DAY_KEYS[date.getDay()] as 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
};

export default function DoctorAppointmentsScreen() {
  const { t, isRTL } = useI18n();
  const { loading, appointments, doctorData, fetchAppointments, clinics } = useDoctorContext();
  
  const [refreshing, setRefreshing] = useState(false);
  const [lookbackDays, setLookbackDays] = useState(7);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<any>(null);
  const [newDate, setNewDate] = useState<string | null>(null);
  const [newTime, setNewTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    if (doctorData) {
      fetchAppointments(lookbackDays);
    }
  }, [doctorData, lookbackDays, fetchAppointments]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments(lookbackDays);
    setRefreshing(false);
  };

  const handleApprove = async (appointmentId: string) => {
    try {
      // Find the appointment details
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (!appointment) return;

      const { error } = await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', appointmentId);

      if (error) throw error;

      // Send confirmation notification to patient
      if (appointment.booking_type !== 'walk-in' && appointment.patient_id) {
        const clinic = clinics.find(c => c.id === appointment.clinic_id);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', doctorData?.id)
          .single();
        
        const doctorName = profileData?.full_name || 'Doctor';
        const clinicName = clinic?.clinic_name || 'Clinic';
        
        await sendAppointmentConfirmationNotification(
          appointment.patient_id,
          doctorName,
          appointment.appointment_date,
          appointment.appointment_time,
          clinicName
        );
      }

      Alert.alert(t.common.success, isRTL ? 'تم تأكيد الموعد' : 'Appointment confirmed');
      await fetchAppointments(lookbackDays);
    } catch (error) {
      console.error('Approve error:', error);
      Alert.alert(t.common.error, isRTL ? 'فشل تأكيد الموعد' : 'Failed to confirm appointment');
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
              // Find the appointment details
              const appointment = appointments.find(apt => apt.id === appointmentId);
              if (!appointment) return;

              const { error } = await supabase
                .from('appointments')
                .update({ status: 'cancelled' })
                .eq('id', appointmentId);

              if (error) throw error;

              // Send cancellation notification to patient
              if (appointment.booking_type !== 'walk-in' && appointment.patient_id) {
                const clinic = clinics.find(c => c.id === appointment.clinic_id);
                const { data: profileData } = await supabase
                  .from('profiles')
                  .select('full_name')
                  .eq('id', doctorData?.id)
                  .single();
                
                const doctorName = profileData?.full_name || 'Doctor';
                const clinicName = clinic?.clinic_name || 'Clinic';
                
                await sendAppointmentCancellationNotification(
                  appointment.patient_id,
                  doctorName,
                  appointment.appointment_date,
                  appointment.appointment_time,
                  clinicName,
                  'Doctor rejected the appointment request'
                );
              }

              Alert.alert(t.common.success, isRTL ? 'تم رفض الموعد' : 'Appointment rejected');
              await fetchAppointments(lookbackDays);
            } catch (error) {
              console.error('Reject error:', error);
              Alert.alert(t.common.error, isRTL ? 'فشل رفض الموعد' : 'Failed to reject appointment');
            }
          }
        }
      ]
    );
  };

  const openRescheduleModal = (appointment: any) => {
    setRescheduleAppointment(appointment);
    setNewDate(null);
    setNewTime(null);
    setAvailableSlots([]);
    setShowRescheduleModal(true);
  };

  // Fetch available slots when date is selected
  useEffect(() => {
    if (newDate && rescheduleAppointment) {
      fetchAvailableSlots(newDate, rescheduleAppointment.clinic_id, rescheduleAppointment.id);
    } else {
      setAvailableSlots([]);
      setNewTime(null);
    }
  }, [newDate, rescheduleAppointment, fetchAvailableSlots]);

  const fetchAvailableSlots = useCallback(async (date: string, clinicId: string, excludeAppointmentId?: string) => {
    setLoadingSlots(true);
    try {
      // Get clinic schedule
      const clinic = clinics.find(c => c.id === clinicId);
      if (!clinic || !clinic.schedule) {
        setAvailableSlots([]);
        return;
      }

      const dayKey = getDayKey(date);
      const schedule = clinic.schedule;
      const slotMinutes = clinic.slot_minutes || 30;

      // Check if day is weekly off
      if (schedule.weekly_off?.includes(dayKey)) {
        setAvailableSlots([]);
        return;
      }

      // Get schedule for this day
      const daySchedule = (schedule as any)[dayKey] || schedule.default;
      if (!daySchedule?.start || !daySchedule?.end) {
        setAvailableSlots([]);
        return;
      }

      const startMin = timeToMinutes(daySchedule.start);
      const endMin = timeToMinutes(daySchedule.end);
      if (startMin === null || endMin === null) {
        setAvailableSlots([]);
        return;
      }

      const breakStartMin = daySchedule.break_start ? timeToMinutes(daySchedule.break_start) : null;
      const breakEndMin = daySchedule.break_end ? timeToMinutes(daySchedule.break_end) : null;

      // Generate all possible slots
      const allSlots: string[] = [];
      for (let t = startMin; t + slotMinutes <= endMin; t += slotMinutes) {
        const slotEnd = t + slotMinutes;
        if (breakStartMin !== null && breakEndMin !== null) {
          if (t < breakEndMin && slotEnd > breakStartMin) continue;
        }
        allSlots.push(minutesToTime(t));
      }

      // Get booked/blocked slots
      let bookedQuery = supabase
        .from('appointments')
        .select('time_slot')
        .eq('doctor_id', doctorData?.id)
        .eq('clinic_id', clinicId)
        .eq('appointment_date', date)
        .in('status', ['pending', 'confirmed']);

      if (excludeAppointmentId) {
        bookedQuery = bookedQuery.neq('id', excludeAppointmentId);
      }

      const { data: bookedData } = await bookedQuery;

      const { data: blockedData } = await supabase
        .from('doctor_blocked_slots')
        .select('time_slot')
        .eq('doctor_id', doctorData?.id)
        .eq('clinic_id', clinicId)
        .eq('blocked_date', date);

      const bookedTimes = new Set(bookedData?.map(b => b.time_slot) || []);
      const blockedTimes = new Set(blockedData?.map(b => b.time_slot) || []);

      // Filter available slots
      const available = allSlots.filter(slot => !bookedTimes.has(slot) && !blockedTimes.has(slot));
      setAvailableSlots(available);
    } catch (error) {
      console.error('Error fetching available slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [clinics, doctorData?.id]);

  const handleReschedule = async () => {
    if (!rescheduleAppointment || !newDate || !newTime) {
      Alert.alert(
        t.common.error,
        isRTL ? 'الرجاء اختيار التاريخ والوقت' : 'Please select both date and time'
      );
      return;
    }

    setRescheduling(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          appointment_date: newDate,
          time_slot: newTime
        })
        .eq('id', rescheduleAppointment.id);

      if (error) throw error;

      // Send push notification to patient (skip for walk-ins)
      if (rescheduleAppointment.booking_type !== 'walk-in' && rescheduleAppointment.patient_id) {
        const clinic = clinics.find(c => c.id === rescheduleAppointment.clinic_id);
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', doctorData?.id)
          .single();
        
        const doctorName = profileData?.full_name || 'Doctor';
        const clinicName = clinic?.clinic_name || 'Clinic';
        
        await sendRescheduleNotification(
          rescheduleAppointment.patient_id,
          doctorName,
          newDate,
          newTime,
          clinicName
        );
      }
      
      Alert.alert(
        t.common.success, 
        isRTL 
          ? `تم إعادة جدولة الموعد إلى ${newDate} في ${newTime}` 
          : `Appointment rescheduled to ${newDate} at ${newTime}`
      );
      setShowRescheduleModal(false);
      await fetchAppointments(lookbackDays);
    } catch (error) {
      console.error('Reschedule error:', error);
      Alert.alert(t.common.error, isRTL ? 'فشلت إعادة الجدولة' : 'Failed to reschedule');
    } finally {
      setRescheduling(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString: string) => {
    const [h, m] = timeString.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  };

  const getNextDays = (count: number = 14) => {
    const days = [];
    for (let i = 0; i < count; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
      });
    }
    return days;
  };

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
      
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.textRight]}>
          {t.doctorDashboard?.appointments || 'Appointments'}
        </Text>
        <Text style={[styles.headerSubtitle, isRTL && styles.textRight]}>
          {isRTL ? `${appointments.length} موعد` : `${appointments.length} appointments`}
        </Text>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {appointments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>
              {t.doctorDashboard?.noAppointments || 'No Appointments'}
            </Text>
            <Text style={styles.emptyText}>
              {t.doctorDashboard?.noAppointmentsDesc || 'New appointments will appear here'}
            </Text>
          </View>
        ) : (
          appointments.map((apt) => (
            <View key={apt.id} style={styles.appointmentCard}>
              <View style={[styles.appointmentHeader, isRTL && styles.rowReverse]}>
                <View style={isRTL ? styles.alignRight : undefined}>
                  <Text style={[styles.patientName, isRTL && styles.textRight]}>
                    {apt.booking_type === 'walk-in' ? '🚶' : '👤'} {apt.patient_name}
                  </Text>
                  {apt.booking_type === 'walk-in' && apt.walk_in_phone && (
                    <Text style={[styles.phoneText, isRTL && styles.textRight]}>
                      📱 {apt.walk_in_phone}
                    </Text>
                  )}
                  <Text style={[styles.clinicText, isRTL && styles.textRight]}>
                    🏥 {apt.clinic_name}
                  </Text>
                  {apt.booking_type === 'walk-in' && (
                    <View style={[styles.walkInBadge, isRTL && styles.alignRight]}>
                      <Text style={styles.walkInBadgeText}>
                        {isRTL ? 'مريض زائر' : 'Walk-in'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              
              <View style={[styles.appointmentMeta, isRTL && styles.rowReverse]}>
                <View style={[
                  styles.dateBadge, 
                  apt.appointment_date === new Date().toISOString().split('T')[0] && styles.todayBadge
                ]}>
                  <Text style={styles.dateText}>📅 {formatDate(apt.appointment_date)}</Text>
                </View>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeText}>🕒 {formatTime(apt.appointment_time)}</Text>
                </View>
                <View style={[
                  styles.statusBadgeInline, 
                  apt.status === 'confirmed' && styles.confirmedBadgeInline,
                  apt.status === 'cancelled' && styles.cancelledBadgeInline
                ]}>
                  <Text style={styles.statusBadgeText}>
                    {apt.status === 'pending' ? (isRTL ? 'معلق' : 'Pending') :
                     apt.status === 'confirmed' ? (isRTL ? 'مؤكد' : 'Confirmed') :
                     apt.status === 'cancelled' ? (isRTL ? 'ملغي' : 'Cancelled') :
                     apt.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') : apt.status}
                  </Text>
                </View>
              </View>

              {apt.notes && (
                <View style={styles.appointmentNotes}>
                  <Text style={styles.notesLabel}>{isRTL ? 'ملاحظات:' : 'Notes:'}</Text>
                  <Text style={styles.notesText}>{apt.notes}</Text>
                </View>
              )}
              
              <View style={styles.appointmentActions}>
                {apt.status === 'pending' && (
                  <>
                    <TouchableOpacity 
                      style={styles.approveButton}
                      onPress={() => handleApprove(apt.id)}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#fff" />
                      <Text style={styles.approveButtonText}>
                        {isRTL ? 'قبول' : 'Approve'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.rescheduleButton}
                      onPress={() => openRescheduleModal(apt)}
                    >
                      <Ionicons name="calendar-outline" size={16} color="#2563EB" />
                      <Text style={styles.rescheduleButtonText}>
                        {isRTL ? 'إعادة جدولة' : 'Reschedule'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.rejectButton}
                      onPress={() => handleReject(apt.id)}
                    >
                      <Ionicons name="close-circle" size={16} color="#DC2626" />
                      <Text style={styles.rejectButtonText}>
                        {isRTL ? 'رفض' : 'Reject'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
                {apt.status === 'confirmed' && (
                  <>
                    <TouchableOpacity 
                      style={styles.rescheduleButton}
                      onPress={() => openRescheduleModal(apt)}
                    >
                      <Ionicons name="calendar-outline" size={16} color="#2563EB" />
                      <Text style={styles.rescheduleButtonText}>
                        {isRTL ? 'إعادة جدولة' : 'Reschedule'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))
        )}

        {appointments.length > 0 && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => setLookbackDays((prev) => prev + 7)}
          >
            <Text style={styles.loadMoreText}>
              {t.appointments?.loadMore || 'Load More'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Reschedule Modal */}
      <Modal visible={showRescheduleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, isRTL && styles.textRight]}>
              {isRTL ? 'إعادة جدولة' : 'Reschedule'}
            </Text>
            
            {rescheduleAppointment && (
              <View style={styles.rescheduleInfo}>
                <Text style={styles.reschedulePatient}>👤 {rescheduleAppointment.patient_name}</Text>
                <Text style={styles.rescheduleOldDate}>
                  {isRTL ? 'الحالي:' : 'Current:'} {formatDate(rescheduleAppointment.appointment_date)}
                </Text>
              </View>
            )}
            
            <Text style={[styles.label, isRTL && styles.textRight]}>
              {isRTL ? 'التاريخ الجديد' : 'New Date'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
              {getNextDays().map((day) => (
                <TouchableOpacity
                  key={day.date}
                  style={[styles.dayCard, newDate === day.date && styles.dayCardSelected]}
                  onPress={() => setNewDate(day.date)}
                >
                  <Text style={[styles.dayName, newDate === day.date && styles.dayTextSelected]}>
                    {day.dayName}
                  </Text>
                  <Text style={[styles.dayNumber, newDate === day.date && styles.dayTextSelected]}>
                    {day.dayNumber}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Time Slot Selection */}
            {newDate && (
              <>
                <Text style={[styles.label, isRTL && styles.textRight, { marginTop: 20 }]}>
                  {isRTL ? 'الوقت الجديد' : 'New Time'}
                </Text>
                {loadingSlots ? (
                  <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 20 }} />
                ) : availableSlots.length === 0 ? (
                  <Text style={[styles.noSlotsText, isRTL && styles.textRight]}>
                    {isRTL ? 'لا توجد أوقات متاحة في هذا التاريخ' : 'No available slots on this date'}
                  </Text>
                ) : (
                  <View style={styles.timeSlotsGrid}>
                    {availableSlots.map((slot) => (
                      <TouchableOpacity
                        key={slot}
                        style={[
                          styles.timeSlotChip,
                          newTime === slot && styles.timeSlotChipSelected
                        ]}
                        onPress={() => setNewTime(slot)}
                      >
                        <Text style={[
                          styles.timeSlotText,
                          newTime === slot && styles.timeSlotTextSelected
                        ]}>
                          {formatTime(slot)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButtonSecondary} 
                onPress={() => setShowRescheduleModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.modalButtonPrimary, 
                  (rescheduling || !newDate || !newTime) && styles.buttonDisabled
                ]}
                onPress={handleReschedule}
                disabled={rescheduling || !newDate || !newTime}
              >
                {rescheduling ? <ActivityIndicator color="white" size="small" /> : (
                  <Text style={styles.modalButtonPrimaryText}>{t.common.confirm}</Text>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
  loadingText: { marginTop: 10, color: '#6B7280', fontSize: 16 },
  header: {
    backgroundColor: '#2563EB',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
  headerSubtitle: { fontSize: 16, color: '#BFDBFE' },
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 60, marginBottom: 15 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  appointmentHeader: { marginBottom: 12 },
  patientName: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  phoneText: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  clinicText: { fontSize: 14, color: '#6B7280' },
  walkInBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  walkInBadgeText: { fontSize: 11, fontWeight: '600', color: '#92400E' },
  appointmentMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  dateBadge: { 
    backgroundColor: '#EFF6FF', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 6 
  },
  todayBadge: { backgroundColor: '#DBEAFE' },
  dateText: { fontSize: 12, color: '#1E40AF', fontWeight: '500' },
  timeBadge: { 
    backgroundColor: '#F3F4F6', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 6 
  },
  timeText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  statusBadgeInline: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  confirmedBadgeInline: { backgroundColor: '#D1FAE5' },
  cancelledBadgeInline: { backgroundColor: '#FEE2E2' },
  statusBadgeText: { fontSize: 12, color: '#92400E', fontWeight: '600' },
  appointmentNotes: { 
    backgroundColor: '#F9FAFB', 
    padding: 10, 
    borderRadius: 8, 
    marginBottom: 12 
  },
  notesLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  notesText: { fontSize: 14, color: '#374151' },
  appointmentActions: { flexDirection: 'row', gap: 8 },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rescheduleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  rescheduleButtonText: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  rejectButtonText: { color: '#DC2626', fontSize: 14, fontWeight: '600' },
  loadMoreButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  loadMoreText: { color: '#2563EB', fontWeight: '600', fontSize: 14 },
  textRight: { textAlign: 'right' },
  alignRight: { alignItems: 'flex-end' },
  rowReverse: { flexDirection: 'row-reverse' },
  
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
    maxWidth: 500,
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#1F2937', marginBottom: 16 },
  rescheduleInfo: { 
    backgroundColor: '#F3F4F6', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 16 
  },
  reschedulePatient: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  rescheduleOldDate: { fontSize: 14, color: '#6B7280' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  daysScroll: { marginBottom: 20 },
  dayCard: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 60,
  },
  dayCardSelected: { backgroundColor: '#2563EB' },
  dayName: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  dayNumber: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  dayTextSelected: { color: '#fff' },
  
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  timeSlotChip: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeSlotChipSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  timeSlotTextSelected: {
    color: '#2563EB',
  },
  noSlotsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
  
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalButtonSecondaryText: { color: '#374151', fontWeight: '600', fontSize: 16 },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  modalButtonPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  buttonDisabled: { opacity: 0.5 },
});
