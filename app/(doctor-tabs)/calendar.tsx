import { getDayKey, minutesToTime, timeToMinutes, useDoctorContext } from '@/lib/DoctorContext';
import { useI18n } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    RefreshControl,
    StatusBar as RNStatusBar,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

type DayAppointment = {
  date: string;
  count: number;
  pending: number;
  confirmed: number;
  completed: number;
};

type TimeSlot = {
  time: string;
  status: 'available' | 'pending' | 'taken';
  appointment?: any;
};

export default function DoctorCalendarScreen() {
  const { t, isRTL } = useI18n();
  const { loading, appointments, clinics, fetchAppointments, doctorData } = useDoctorContext();
  
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<string | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  useEffect(() => {
    // Auto-select first active clinic
    if (clinics.length > 0 && !selectedClinic) {
      const activeClinic = clinics.find(c => c.is_active) || clinics[0];
      setSelectedClinic(activeClinic.id);
    }
  }, [clinics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  // Get appointments grouped by date
  const getAppointmentsByDate = (): Map<string, DayAppointment> => {
    const grouped = new Map<string, DayAppointment>();
    
    appointments.forEach(apt => {
      const date = apt.appointment_date;
      if (!grouped.has(date)) {
        grouped.set(date, {
          date,
          count: 0,
          pending: 0,
          confirmed: 0,
          completed: 0,
        });
      }
      
      const day = grouped.get(date)!;
      day.count++;
      
      if (apt.status === 'pending') day.pending++;
      else if (apt.status === 'confirmed') day.confirmed++;
      else if (apt.status === 'completed') day.completed++;
    });
    
    return grouped;
  };

  const appointmentsByDate = getAppointmentsByDate();

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startPadding = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = lastDay.getDate();
    
    const days: (number | null)[] = [];
    
    // Add padding for days before month starts
    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }
    
    // Add actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };

  const formatDateKey = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const getSelectedDayAppointments = () => {
    if (!selectedDate) return [];
    return appointments.filter(apt => apt.appointment_date === selectedDate);
  };

  // Generate time slots for selected date and clinic
  const generateTimeSlots = (): TimeSlot[] => {
    if (!selectedDate || !selectedClinic) {
      console.log('❌ No date or clinic selected');
      return [];
    }

    const clinic = clinics.find(c => c.id === selectedClinic);
    if (!clinic) {
      console.log('❌ Clinic not found:', selectedClinic);
      return [];
    }

    const slots: TimeSlot[] = [];

    // First, check if there are any appointments for this day/clinic
    const dayAppointments = appointments.filter(apt => 
      apt.appointment_date === selectedDate && 
      apt.clinic_id === selectedClinic
    );

    console.log('📅 Selected date:', selectedDate, 'Appointments:', dayAppointments.length);
    
    if (!clinic.schedule) {
      console.log('❌ No schedule for clinic:', clinic.clinic_name);
      // Still show appointment slots even without schedule
      dayAppointments.forEach(apt => {
        let status: 'available' | 'pending' | 'taken' = 'pending';
        if (apt.status === 'confirmed' || apt.status === 'completed') {
          status = 'taken';
        }
        slots.push({ time: apt.appointment_time, status, appointment: apt });
      });
      return slots;
    }

    const dayKey = getDayKey(selectedDate);
    console.log('Day:', dayKey);
    
    const schedule = clinic.schedule;
    const slotMinutes = clinic.slot_minutes || 30;

    // Check if day is weekly off
    if (schedule.weekly_off?.includes(dayKey)) {
      console.log('🚫 Day is weekly off:', dayKey);
      // Still show appointment slots even on weekly off
      dayAppointments.forEach(apt => {
        let status: 'available' | 'pending' | 'taken' = 'pending';
        if (apt.status === 'confirmed' || apt.status === 'completed') {
          status = 'taken';
        }
        slots.push({ time: apt.appointment_time, status, appointment: apt });
      });
      return slots;
    }

    // Get schedule for this day (use day-specific or default)
    const daySchedule = schedule[dayKey] || schedule.default;
    console.log('⏰ Day schedule:', daySchedule);
    
    if (!daySchedule?.start || !daySchedule?.end) {
      console.log('❌ No start/end time for day:', dayKey);
      // Still show appointment slots
      dayAppointments.forEach(apt => {
        let status: 'available' | 'pending' | 'taken' = 'pending';
        if (apt.status === 'confirmed' || apt.status === 'completed') {
          status = 'taken';
        }
        slots.push({ time: apt.appointment_time, status, appointment: apt });
      });
      return slots;
    }

    const startMin = timeToMinutes(daySchedule.start);
    const endMin = timeToMinutes(daySchedule.end);
    const breakStartMin = daySchedule.break_start ? timeToMinutes(daySchedule.break_start) : null;
    const breakEndMin = daySchedule.break_end ? timeToMinutes(daySchedule.break_end) : null;

    if (startMin === null || endMin === null) {
      console.log('❌ Invalid start/end minutes');
      return slots;
    }

    console.log('✅ Generating slots from', daySchedule.start, 'to', daySchedule.end);

    let currentMin = startMin;

    while (currentMin < endMin) {
      // Skip break time
      if (breakStartMin !== null && breakEndMin !== null && 
          currentMin >= breakStartMin && currentMin < breakEndMin) {
        currentMin += slotMinutes;
        continue;
      }

      const timeStr = minutesToTime(currentMin);
      
      // Check if this slot has an appointment
      const appointment = appointments.find(apt => 
        apt.appointment_date === selectedDate && 
        apt.appointment_time === timeStr &&
        apt.clinic_id === selectedClinic
      );

      let status: 'available' | 'pending' | 'taken' = 'available';
      if (appointment) {
        if (appointment.status === 'pending') {
          status = 'pending';
        } else if (appointment.status === 'confirmed' || appointment.status === 'completed') {
          status = 'taken';
        }
      }

      slots.push({ time: timeStr, status, appointment });
      currentMin += slotMinutes;
    }

    console.log('✅ Generated', slots.length, 'slots');
    return slots;
  };

  const handleSlotPress = (slot: TimeSlot) => {
    if (slot.status === 'available') {
      Alert.alert(
        isRTL ? 'حجز موعد' : 'Book Appointment',
        isRTL ? `هل تريد فتح نموذج الحجز للساعة ${slot.time}؟` : `Open booking form for ${slot.time}?`,
        [
          { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
          { text: isRTL ? 'نعم' : 'Yes', onPress: () => {
            // TODO: Navigate to booking or open booking modal
            Alert.alert(isRTL ? 'قريباً' : 'Coming Soon', isRTL ? 'سيتم إضافة وظيفة الحجز قريباً' : 'Booking functionality coming soon');
          }}
        ]
      );
    } else if (slot.appointment) {
      setSelectedAppointment(slot.appointment);
      setShowAppointmentModal(true);
    }
  };

  const timeSlots = generateTimeSlots();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const monthNamesAr = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const calendarDays = generateCalendarDays();
  const selectedDayAppointments = getSelectedDayAppointments();
  const today = new Date().toISOString().split('T')[0];

  if (loading && appointments.length === 0) {
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
      
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.textRight]}>
          {isRTL ? 'تقويم المواعيد' : 'Appointment Calendar'}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Month Navigation */}
        <View style={[styles.monthNav, isRTL && styles.rowReverse]}>
          <TouchableOpacity style={styles.navButton} onPress={goToPreviousMonth}>
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={24} color="#2563EB" />
          </TouchableOpacity>
          
          <View style={styles.monthTitleContainer}>
            <Text style={styles.monthTitle}>
              {isRTL ? monthNamesAr[currentMonth.getMonth()] : monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </Text>
            <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
              <Text style={styles.todayButtonText}>{isRTL ? 'اليوم' : 'Today'}</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.navButton} onPress={goToNextMonth}>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={24} color="#2563EB" />
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarCard}>
          {/* Day Names Header */}
          <View style={[styles.dayNamesRow, isRTL && styles.rowReverse]}>
            {(isRTL ? [...dayNamesAr].reverse() : dayNames).map((dayName, index) => (
              <View key={index} style={styles.dayNameCell}>
                <Text style={styles.dayNameText}>{dayName}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Days */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <View key={`empty-${index}`} style={styles.dayCell} />;
              }
              
              const dateKey = formatDateKey(day);
              const dayData = appointmentsByDate.get(dateKey);
              const isToday = dateKey === today;
              const isSelected = dateKey === selectedDate;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dayCell,
                    isToday && styles.todayCell,
                    isSelected && styles.selectedCell,
                  ]}
                  onPress={() => setSelectedDate(dateKey)}
                >
                  <Text style={[
                    styles.dayNumber,
                    isToday && styles.todayNumber,
                    isSelected && styles.selectedNumber,
                  ]}>
                    {day}
                  </Text>
                  {dayData && dayData.count > 0 && (
                    <View style={styles.dotContainer}>
                      {dayData.pending > 0 && <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />}
                      {dayData.confirmed > 0 && <View style={[styles.dot, { backgroundColor: '#10B981' }]} />}
                      {dayData.completed > 0 && <View style={[styles.dot, { backgroundColor: '#6B7280' }]} />}
                    </View>
                  )}
                  {dayData && (
                    <Text style={styles.countBadge}>{dayData.count}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>{isRTL ? 'معلق' : 'Pending'}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>{isRTL ? 'مؤكد' : 'Confirmed'}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#6B7280' }]} />
            <Text style={styles.legendText}>{isRTL ? 'مكتمل' : 'Completed'}</Text>
          </View>
        </View>

        {/* Selected Day Appointments */}
        {selectedDate && (
          <View style={styles.appointmentsSection}>
            <Text style={[styles.sectionTitle, isRTL && styles.textRight]}>
              {new Date(selectedDate).toLocaleDateString(isRTL ? 'ar' : 'en', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>

            {/* Clinic Selector */}
            {clinics.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clinicSelector}>
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

            {/* Time Slots Grid */}
            {timeSlots.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🕐</Text>
                <Text style={styles.emptyText}>
                  {isRTL ? 'لا توجد مواعيد متاحة في هذا اليوم' : 'No available slots on this day'}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.slotsLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendBox, styles.availableSlot]} />
                    <Text style={styles.legendText}>{isRTL ? 'متاح' : 'Available'}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendBox, styles.pendingSlot]} />
                    <Text style={styles.legendText}>{isRTL ? 'معلق' : 'Pending'}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendBox, styles.takenSlot]} />
                    <Text style={styles.legendText}>{isRTL ? 'محجوز' : 'Taken'}</Text>
                  </View>
                </View>

                <View style={styles.slotsGrid}>
                  {timeSlots.map((slot, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.slotButton,
                        slot.status === 'available' && styles.availableSlot,
                        slot.status === 'pending' && styles.pendingSlot,
                        slot.status === 'taken' && styles.takenSlot,
                      ]}
                      onPress={() => handleSlotPress(slot)}
                      disabled={slot.status === 'available' ? false : false} // All clickable
                    >
                      <Text style={[
                        styles.slotTime,
                        slot.status === 'available' && styles.availableSlotText,
                        slot.status === 'pending' && styles.pendingSlotText,
                        slot.status === 'taken' && styles.takenSlotText,
                      ]}>
                        {slot.time}
                      </Text>
                      {slot.status === 'pending' && <Text style={styles.slotIcon}>🟡</Text>}
                      {slot.status === 'taken' && <Text style={styles.slotIcon}>🔴</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Appointment Details Modal */}
      <Modal
        visible={showAppointmentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAppointmentModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAppointmentModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isRTL ? 'تفاصيل الموعد' : 'Appointment Details'}
              </Text>
              <TouchableOpacity onPress={() => setShowAppointmentModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedAppointment && (
              <View style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{isRTL ? 'المريض:' : 'Patient:'}</Text>
                  <Text style={styles.detailValue}>{selectedAppointment.patient_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{isRTL ? 'التاريخ:' : 'Date:'}</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedAppointment.appointment_date).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{isRTL ? 'الوقت:' : 'Time:'}</Text>
                  <Text style={styles.detailValue}>{selectedAppointment.appointment_time}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{isRTL ? 'العيادة:' : 'Clinic:'}</Text>
                  <Text style={styles.detailValue}>{selectedAppointment.clinic_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{isRTL ? 'الحالة:' : 'Status:'}</Text>
                  <View style={[
                    styles.statusBadge,
                    selectedAppointment.status === 'pending' && styles.pendingBadge,
                    selectedAppointment.status === 'confirmed' && styles.confirmedBadge,
                    selectedAppointment.status === 'completed' && styles.completedBadge,
                  ]}>
                    <Text style={styles.statusText}>
                      {selectedAppointment.status === 'pending' ? (isRTL ? 'معلق' : 'Pending') :
                       selectedAppointment.status === 'confirmed' ? (isRTL ? 'مؤكد' : 'Confirmed') :
                       (isRTL ? 'مكتمل' : 'Completed')}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowAppointmentModal(false)}
            >
              <Text style={styles.closeButtonText}>{isRTL ? 'إغلاق' : 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F3F4F6',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0
  },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#6B7280' },
  textRight: { textAlign: 'right' },
  rowReverse: { flexDirection: 'row-reverse' },
  
  header: {
    backgroundColor: '#2563EB',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  
  content: { flex: 1, padding: 16 },
  
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  monthTitleContainer: { alignItems: 'center' },
  monthTitle: { fontSize: 20, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  todayButton: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#DBEAFE', borderRadius: 12 },
  todayButtonText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
  
  calendarCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  dayNamesRow: { flexDirection: 'row', marginBottom: 8 },
  dayNameCell: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  dayNameText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
  },
  todayCell: { backgroundColor: '#DBEAFE', borderRadius: 8 },
  selectedCell: { backgroundColor: '#2563EB', borderRadius: 8 },
  dayNumber: { fontSize: 16, color: '#1F2937', fontWeight: '500' },
  todayNumber: { color: '#2563EB', fontWeight: '700' },
  selectedNumber: { color: 'white', fontWeight: '700' },
  
  dotContainer: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  countBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    fontSize: 9,
    fontWeight: '700',
    color: '#EF4444',
  },
  
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 12, color: '#6B7280' },
  
  appointmentsSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  
  clinicSelector: { marginBottom: 16 },
  clinicChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  clinicChipSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#2563EB',
  },
  clinicChipText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  clinicChipTextSelected: { color: '#2563EB', fontWeight: '600' },

  slotsLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
    paddingVertical: 8,
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 4,
  },

  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotButton: {
    width: '22%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  availableSlot: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  pendingSlot: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  takenSlot: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  slotTime: {
    fontSize: 13,
    fontWeight: '600',
  },
  availableSlotText: { color: '#1F2937' },
  pendingSlotText: { color: '#92400E' },
  takenSlotText: { color: '#991B1B' },
  slotIcon: { fontSize: 10, marginTop: 2 },
  
  emptyState: { alignItems: 'center', padding: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
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
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  modalBody: { marginBottom: 20 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#1F2937', fontWeight: '600' },
  closeButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  
  appointmentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  appointmentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appointmentInfo: { flex: 1 },
  patientName: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  appointmentTime: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  clinicName: { fontSize: 13, color: '#6B7280' },
  
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pendingBadge: { backgroundColor: '#FEF3C7' },
  confirmedBadge: { backgroundColor: '#D1FAE5' },
  completedBadge: { backgroundColor: '#E5E7EB' },
  cancelledBadge: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#1F2937' },
});
