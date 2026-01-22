import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
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
  View,
} from 'react-native';

type Appointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  doctor_id: string;
  doctor_name: string;
  doctor_name_ar: string;
  specialty: string;
  specialty_ar: string;
  specialty_icon: string;
  clinic_name: string;
  clinic_address: string;
          has_review: reviewsMap.has(apt.id),
  has_review: boolean;
};

export default function AppointmentsTab() {
  const { user } = useAuth();
  const { t, isRTL } = useI18n();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pastLookbackDays, setPastLookbackDays] = useState(14);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewAppointment, setReviewAppointment] = useState<Appointment | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (user) fetchAppointments();
    else setLoading(false);
  }, [user, activeTab, pastLookbackDays]);

  const fetchAppointments = async () => {
    if (!user) return;

    try {
      // Simple query without foreign key hints - fetch appointments first
      const todayStr = new Date().toISOString().split('T')[0];
      let query = supabase
        .from('appointments')
        .select('id, appointment_date, status, doctor_id, clinic_id')
        .eq('patient_id', user.id);

      if (activeTab === 'upcoming') {
        query = query
          .gte('appointment_date', todayStr)
          .order('appointment_date', { ascending: true });
      } else {
        const start = new Date();
        start.setDate(start.getDate() - pastLookbackDays);
        const startStr = start.toISOString().split('T')[0];
        query = query
          .gte('appointment_date', startStr)
          .lte('appointment_date', todayStr)
          .order('appointment_date', { ascending: false });
      }

      const { data: appointmentsData, error: aptError } = await query;

      if (aptError) {
        console.error('Error fetching appointments:', aptError);
        setAppointments([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!appointmentsData || appointmentsData.length === 0) {
        setAppointments([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Get unique doctor IDs and clinic IDs
      const doctorIds = [...new Set(appointmentsData.map(a => a.doctor_id).filter(Boolean))];
      const clinicIds = [...new Set(appointmentsData.map(a => a.clinic_id).filter(Boolean))];

      // Fetch doctors with specialties
      let doctorsMap = new Map();
      if (doctorIds.length > 0) {
        const { data: doctors } = await supabase
          .from('doctors')
          .select('id, user_id, specialty_code, specialties(name_en, name_ar, icon)')
          .in('id', doctorIds);
        
        if (doctors) {
          // Get doctor profiles
          const userIds = doctors.map(d => d.user_id).filter(Boolean);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, full_name_ar')
            .in('id', userIds);
          
          const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
          
          doctors.forEach(d => {
            const profile = profilesMap.get(d.user_id);
            doctorsMap.set(d.id, {
              ...d,
              full_name: profile?.full_name,
              full_name_ar: profile?.full_name_ar
            });
          });
        }
      }

      // Fetch clinics
      let clinicsMap = new Map();
      if (clinicIds.length > 0) {
        const { data: clinics } = await supabase
          .from('clinics')
          .select('id, clinic_name, address')
          .in('id', clinicIds);
        
        if (clinics) {
          clinicsMap = new Map(clinics.map(c => [c.id, c]));
        }
      }

      // Fetch reviews for these appointments
      let reviewsMap = new Map<string, number>();
      if (user && appointmentsData.length > 0) {
        const appointmentIds = appointmentsData.map(a => a.id);
        const { data: reviews } = await supabase
          .from('reviews')
          .select('appointment_id, rating')
          .eq('patient_id', user.id)
          .in('appointment_id', appointmentIds);

        if (reviews) {
          reviewsMap = new Map(reviews.map(r => [r.appointment_id, r.rating]));
        }
      }

      // Transform appointments
      const transformed: Appointment[] = appointmentsData.map(apt => {
        const doctor = doctorsMap.get(apt.doctor_id) || {};
        const clinic = clinicsMap.get(apt.clinic_id) || {};
        const specialty = doctor.specialties || {};

        return {
          id: apt.id,
          appointment_date: apt.appointment_date,
          appointment_time: '09:00',
          status: apt.status || 'pending',
          doctor_id: apt.doctor_id,
          doctor_name: doctor.full_name ? `Dr. ${doctor.full_name}` : 'Doctor',
          doctor_name_ar: doctor.full_name_ar ? `د. ${doctor.full_name_ar}` : 'طبيب',
          specialty: specialty.name_en || 'Specialist',
          specialty_ar: specialty.name_ar || 'متخصص',
          specialty_icon: specialty.icon || '🩺',
          clinic_name: clinic.clinic_name || 'Clinic',
          clinic_address: clinic.address || '',
        };
      });

      setAppointments(transformed);
    } catch (error) {
      console.error('Error:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAppointments();
  };

  const handleCancelAppointment = (appointmentId: string) => {
    Alert.alert(
      t.appointments.cancelConfirmTitle,
      t.appointments.cancelConfirmMsg,
      [
        { text: t.common.no, style: 'cancel' },
        {
          text: t.common.yes,
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('appointments')
              .update({ status: 'cancelled' })
              .eq('id', appointmentId);

            if (!error) {
              Alert.alert(t.common.success, t.appointments.appointmentCancelled);
              fetchAppointments();
            }
          },
        },
      ]
    );
  };

  const openReviewModal = (apt: Appointment) => {
    setReviewAppointment(apt);
    setReviewRating(5);
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!user || !reviewAppointment) return;
    setSubmittingReview(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          patient_id: user.id,
          doctor_id: reviewAppointment.doctor_id,
          appointment_id: reviewAppointment.id,
          rating: reviewRating,
          review_text: null,
          is_anonymous: false,
        });

      if (error) {
        Alert.alert(t.common.error, error.message);
        return;
      }

      setShowReviewModal(false);
      setReviewAppointment(null);
      fetchAppointments();
    } finally {
      setSubmittingReview(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    if (dateString === todayStr) return t.appointments.today;
    if (dateString === tomorrowStr) return t.appointments.tomorrow;
    
    return date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours) || 9;
    const ampm = hour >= 12 ? (isRTL ? 'م' : 'PM') : (isRTL ? 'ص' : 'AM');
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes || '00'} ${ampm}`;
  };

  const getMonthLabel = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'long', year: 'numeric' });
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return t.appointments.confirmed;
      case 'pending': return t.appointments.pending;
      case 'cancelled': return t.appointments.cancelled;
      case 'completed': return t.appointments.completed;
      default: return status;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'confirmed': return { bg: '#D1FAE5', text: '#065F46' };
      case 'pending': return { bg: '#FEF3C7', text: '#92400E' };
      case 'cancelled': return { bg: '#FEE2E2', text: '#DC2626' };
      case 'completed': return { bg: '#DBEAFE', text: '#1E40AF' };
      default: return { bg: '#F3F4F6', text: '#374151' };
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const filteredAppointments = appointments.filter(apt => {
    if (activeTab === 'upcoming') {
      return apt.appointment_date >= today && apt.status !== 'cancelled';
    } else {
      return apt.appointment_date < today || apt.status === 'completed' || apt.status === 'cancelled';
    }
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.textRight]}>{t.appointments.title}</Text>
        <Text style={[styles.headerSubtitle, isRTL && styles.textRight]}>{t.appointments.subtitle}</Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            {t.appointments.upcoming}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            {t.appointments.past}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {filteredAppointments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>
              {activeTab === 'upcoming' ? t.appointments.noUpcoming : t.appointments.noPast}
            </Text>
            <Text style={styles.emptyText}>
              {activeTab === 'upcoming' ? t.appointments.noUpcomingDesc : t.appointments.noPastDesc}
            </Text>
            {activeTab === 'upcoming' && (
              <TouchableOpacity 
                style={styles.findDoctorButton}
                onPress={() => router.push('/(patient-tabs)/home')}
              >
                <Text style={styles.findDoctorButtonText}>{t.appointments.findDoctor}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          (() => {
            let lastMonth = '';
            return filteredAppointments.map((apt) => {
              const monthLabel = getMonthLabel(apt.appointment_date);
              const showMonth = monthLabel !== lastMonth;
              lastMonth = monthLabel;
              return (
                <View key={apt.id}>
                  {showMonth && (
                    <Text style={[styles.monthHeader, isRTL && styles.textRight]}>
                      {monthLabel}
                    </Text>
                  )}
                  <View style={styles.appointmentCard}>
                    <View style={[styles.appointmentHeader, isRTL && styles.rowReverse]}>
                      <View style={styles.doctorIconContainer}>
                        <Text style={styles.doctorIcon}>{apt.specialty_icon}</Text>
                      </View>
                      <View style={[styles.appointmentInfo, isRTL && styles.alignRight]}>
                        <Text style={[styles.doctorName, isRTL && styles.textRight]}>
                          {isRTL ? apt.doctor_name_ar : apt.doctor_name}
                        </Text>
                        <Text style={[styles.specialty, isRTL && styles.textRight]}>
                          {isRTL ? apt.specialty_ar : apt.specialty}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(apt.status).bg }]}>
                        <Text style={[styles.statusText, { color: getStatusStyle(apt.status).text }]}>
                          {getStatusText(apt.status)}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.appointmentDetails, isRTL && styles.rowReverse]}>
                      <View style={[styles.detailItem, isRTL && styles.rowReverse]}>
                        <Text style={styles.detailIcon}>?Y".</Text>
                        <Text style={styles.detailText}>{formatDate(apt.appointment_date)}</Text>
                      </View>
                      <View style={[styles.detailItem, isRTL && styles.rowReverse]}>
                        <Text style={styles.detailIcon}>?Y?</Text>
                        <Text style={styles.detailText}>{formatTime(apt.appointment_time)}</Text>
                      </View>
                    </View>

                    <View style={[styles.clinicInfo, isRTL && styles.rowReverse]}>
                      <Text style={styles.clinicIcon}>?Y??</Text>
                      <Text style={[styles.clinicName, isRTL && styles.textRight]}>{apt.clinic_name}</Text>
                    </View>

                    {(apt.status === 'pending' || apt.status === 'confirmed') && (
                      <TouchableOpacity 
                        style={styles.cancelButton}
                        onPress={() => handleCancelAppointment(apt.id)}
                      >
                        <Text style={styles.cancelButtonText}>{t.appointments.cancelAppointment}</Text>
                      </TouchableOpacity>
                    )}

                    {(apt.status === 'confirmed' || apt.status === 'completed') && !apt.has_review && (
                      <TouchableOpacity
                        style={styles.reviewButton}
                        onPress={() => openReviewModal(apt)}
                      >
                        <Text style={styles.reviewButtonText}>{t.appointments.leaveReview}</Text>
                      </TouchableOpacity>
                    )}

                    {(apt.status === 'confirmed' || apt.status === 'completed') && apt.has_review && (
                      <View style={styles.reviewedBadge}>
                        <Text style={styles.reviewedText}>{t.appointments.reviewed}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            });
          })()        ))
        )}

        {activeTab === 'past' && filteredAppointments.length > 0 && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => setPastLookbackDays((prev) => prev + 14)}
          >
            <Text style={styles.loadMoreText}>{t.appointments.loadMore}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal visible={showReviewModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, isRTL && styles.textRight]}>
              {t.appointments.leaveReviewTitle}
            </Text>
            {reviewAppointment && (
              <Text style={[styles.modalSubtitle, isRTL && styles.textRight]}>
                {isRTL ? reviewAppointment.doctor_name_ar : reviewAppointment.doctor_name}
              </Text>
            )}

            <View style={[styles.ratingRow, isRTL && styles.rowReverse]}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setReviewRating(star)}
                  style={styles.starButton}
                >
                  <Text style={[styles.starText, reviewRating >= star && styles.starTextActive]}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setShowReviewModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonPrimary, submittingReview && styles.buttonDisabled]}
                onPress={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>{t.appointments.submitReview}</Text>
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
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#6B7280' },
  header: { backgroundColor: '#2563EB', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 25, borderBottomRightRadius: 25 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  headerSubtitle: { fontSize: 14, color: '#BFDBFE', marginTop: 5 },
  textRight: { textAlign: 'right' },
  rowReverse: { flexDirection: 'row-reverse' },
  alignRight: { alignItems: 'flex-end' },
  tabContainer: { flexDirection: 'row', backgroundColor: 'white', marginHorizontal: 20, marginTop: -10, borderRadius: 12, padding: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 3 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#2563EB' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: 'white' },
  content: { flex: 1, padding: 20 },
  emptyState: { alignItems: 'center', padding: 40, backgroundColor: 'white', borderRadius: 16, marginTop: 20 },
  emptyIcon: { fontSize: 60, marginBottom: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20 },
  monthHeader: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 8, marginTop: 10 },
  findDoctorButton: { backgroundColor: '#2563EB', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 10 },
  findDoctorButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  appointmentCard: { backgroundColor: 'white', borderRadius: 16, padding: 15, marginBottom: 12 },
  appointmentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  doctorIconContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  doctorIcon: { fontSize: 24 },
  appointmentInfo: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  specialty: { fontSize: 13, color: '#6B7280' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '600' },
  appointmentDetails: { flexDirection: 'row', gap: 20, marginBottom: 10 },
  detailItem: { flexDirection: 'row', alignItems: 'center' },
  detailIcon: { fontSize: 16, marginRight: 5 },
  detailText: { fontSize: 14, color: '#374151' },
  clinicInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 10, borderRadius: 8, marginBottom: 10 },
  clinicIcon: { fontSize: 16, marginRight: 8 },
  clinicName: { fontSize: 13, color: '#374151', flex: 1 },
  cancelButton: { backgroundColor: '#FEE2E2', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  cancelButtonText: { color: '#DC2626', fontWeight: '600' },
  reviewButton: { backgroundColor: '#FDE68A', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  reviewButtonText: { color: '#92400E', fontWeight: '600' },
  reviewedBadge: { backgroundColor: '#D1FAE5', paddingVertical: 8, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  reviewedText: { color: '#065F46', fontWeight: '600' },
  loadMoreButton: { backgroundColor: 'white', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  loadMoreText: { color: '#1F2937', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 16, padding: 20, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#6B7280', marginBottom: 15 },
  ratingRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20, gap: 6 },
  starButton: { padding: 4 },
  starText: { fontSize: 28, color: '#D1D5DB' },
  starTextActive: { color: '#F59E0B' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalButtonSecondary: { flex: 1, backgroundColor: '#F3F4F6', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalButtonSecondaryText: { color: '#374151', fontWeight: '600' },
  modalButtonPrimary: { flex: 1, backgroundColor: '#2563EB', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalButtonPrimaryText: { color: 'white', fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
});
