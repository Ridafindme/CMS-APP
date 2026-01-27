import { useDoctorContext } from '@/lib/DoctorContext';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
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

export default function DoctorAppointmentsScreen() {
  const { t, isRTL } = useI18n();
  const { loading, appointments, doctorData, fetchAppointments } = useDoctorContext();
  
  const [refreshing, setRefreshing] = useState(false);
  const [lookbackDays, setLookbackDays] = useState(7);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<any>(null);
  const [newDate, setNewDate] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    if (doctorData) {
      fetchAppointments(lookbackDays);
    }
  }, [doctorData, lookbackDays]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments(lookbackDays);
    setRefreshing(false);
  };

  const handleApprove = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'confirmed' })
        .eq('id', appointmentId);

      if (error) throw error;
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
              const { error } = await supabase
                .from('appointments')
                .update({ status: 'cancelled' })
                .eq('id', appointmentId);

              if (error) throw error;
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
    setShowRescheduleModal(true);
  };

  const handleReschedule = async () => {
    if (!rescheduleAppointment || !newDate) return;

    setRescheduling(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ appointment_date: newDate })
        .eq('id', rescheduleAppointment.id);

      if (error) throw error;
      Alert.alert(t.common.success, isRTL ? 'تم إعادة جدولة الموعد' : 'Appointment rescheduled');
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
                    👤 {apt.patient_name}
                  </Text>
                  <Text style={[styles.clinicText, isRTL && styles.textRight]}>
                    🏥 {apt.clinic_name}
                  </Text>
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

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButtonSecondary} 
                onPress={() => setShowRescheduleModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButtonPrimary, rescheduling && styles.buttonDisabled]}
                onPress={handleReschedule}
                disabled={rescheduling || !newDate}
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
  clinicText: { fontSize: 14, color: '#6B7280' },
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
