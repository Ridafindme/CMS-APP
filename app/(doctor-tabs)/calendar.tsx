import { useDoctorContext } from '@/lib/DoctorContext';
import { useI18n } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
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

export default function DoctorCalendarScreen() {
  const { t, isRTL } = useI18n();
  const { loading, appointments, fetchAppointments } = useDoctorContext();
  
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

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
    const date = new Date(year, month, day);
    return date.toISOString().split('T')[0];
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
              {isRTL ? 'مواعيد' : 'Appointments for'} {new Date(selectedDate).toLocaleDateString(isRTL ? 'ar' : 'en', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>

            {selectedDayAppointments.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📅</Text>
                <Text style={styles.emptyText}>
                  {isRTL ? 'لا توجد مواعيد في هذا اليوم' : 'No appointments on this day'}
                </Text>
              </View>
            ) : (
              selectedDayAppointments.map(apt => (
                <View key={apt.id} style={styles.appointmentCard}>
                  <View style={[styles.appointmentRow, isRTL && styles.rowReverse]}>
                    <View style={styles.appointmentInfo}>
                      <Text style={[styles.patientName, isRTL && styles.textRight]}>
                        {apt.patient_name}
                      </Text>
                      <Text style={[styles.appointmentTime, isRTL && styles.textRight]}>
                        🕐 {apt.appointment_time}
                      </Text>
                      <Text style={[styles.clinicName, isRTL && styles.textRight]}>
                        🏥 {apt.clinic_name}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      apt.status === 'pending' && styles.pendingBadge,
                      apt.status === 'confirmed' && styles.confirmedBadge,
                      apt.status === 'completed' && styles.completedBadge,
                      apt.status === 'cancelled' && styles.cancelledBadge,
                    ]}>
                      <Text style={styles.statusText}>
                        {apt.status === 'pending' ? (isRTL ? 'معلق' : 'Pending') :
                         apt.status === 'confirmed' ? (isRTL ? 'مؤكد' : 'Confirmed') :
                         apt.status === 'completed' ? (isRTL ? 'مكتمل' : 'Completed') :
                         (isRTL ? 'ملغي' : 'Cancelled')}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 },
  
  emptyState: { alignItems: 'center', padding: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  
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
