import { patientTheme } from '@/constants/patientTheme';
import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { sendPatientCancellationNotificationToDoctor } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
  has_review: boolean;
  review_id?: string | null;
  review_rating?: number | null;
};

const theme = patientTheme;

export default function AppointmentsTab() {
  const { user } = useAuth();
  const { t, isRTL } = useI18n();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [pastLookbackDays, setPastLookbackDays] = useState(14);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewAppointment, setReviewAppointment] = useState<Appointment | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const historyLabel = ((t as any)?.appointments?.history ?? t.appointments.past) as string;
  const historySubtitle = ((t as any)?.appointments?.historySubtitle ?? t.appointments.subtitle) as string;

  const fetchAppointments = useCallback(async () => {
    if (!user) return;

    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const pastStart = new Date();
      pastStart.setDate(pastStart.getDate() - pastLookbackDays);
      const pastStartStr = pastStart.toISOString().split('T')[0];
      const selectColumns = 'id, appointment_date, time_slot, status, doctor_id, clinic_id';

      const [upcomingRes, pastRes] = await Promise.all([
        supabase
          .from('appointments')
          .select(selectColumns)
          .eq('patient_id', user.id)
          .gte('appointment_date', todayStr)
          .order('appointment_date', { ascending: true }),
        supabase
          .from('appointments')
          .select(selectColumns)
          .eq('patient_id', user.id)
          .gte('appointment_date', pastStartStr)
          .lte('appointment_date', todayStr)
          .order('appointment_date', { ascending: false }),
      ]);

      if (upcomingRes.error || pastRes.error) {
        console.error('Error fetching appointments:', upcomingRes.error || pastRes.error);
        setUpcomingAppointments([]);
        setPastAppointments([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const upcomingRaw = upcomingRes.data ?? [];
      const pastRaw = pastRes.data ?? [];
      const combinedRaw = [...upcomingRaw, ...pastRaw];

      if (combinedRaw.length === 0) {
        setUpcomingAppointments([]);
        setPastAppointments([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const doctorIds = [...new Set(combinedRaw.map((apt) => apt.doctor_id).filter(Boolean))];
      const clinicIds = [...new Set(combinedRaw.map((apt) => apt.clinic_id).filter(Boolean))];

      let doctorsMap = new Map<string, any>();
      if (doctorIds.length > 0) {
        const { data: doctors } = await supabase
          .from('doctors')
          .select('id, user_id, specialty_code, specialties(name_en, name_ar, icon)')
          .in('id', doctorIds);

        if (doctors) {
          const userIds = doctors.map((doc) => doc.user_id).filter(Boolean);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, full_name_ar')
            .in('id', userIds);

          const profilesMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
          doctorsMap = new Map(
            doctors.map((doc) => [
              doc.id,
              {
                ...doc,
                full_name: profilesMap.get(doc.user_id)?.full_name,
                full_name_ar: profilesMap.get(doc.user_id)?.full_name_ar,
              },
            ])
          );
        }
      }

      let clinicsMap = new Map<string, any>();
      if (clinicIds.length > 0) {
        const { data: clinics } = await supabase
          .from('clinics')
          .select('id, clinic_name, address')
          .in('id', clinicIds);

        if (clinics) {
          clinicsMap = new Map(clinics.map((clinic) => [clinic.id, clinic]));
        }
      }

      let reviewsMap = new Map<string, { id: string; rating: number }>();
      if (combinedRaw.length > 0) {
        const appointmentIds = combinedRaw.map((apt) => apt.id);
        const { data: reviews } = await supabase
          .from('reviews')
          .select('id, appointment_id, rating')
          .eq('patient_id', user.id)
          .in('appointment_id', appointmentIds);

        if (reviews) {
          reviewsMap = new Map(reviews.map((review) => [review.appointment_id, { id: review.id, rating: review.rating }]));
        }
      }

      const transformAppointment = (apt: any): Appointment => {
        const doctor = doctorsMap.get(apt.doctor_id) ?? {};
        const clinic = clinicsMap.get(apt.clinic_id) ?? {};
        const specialty = doctor.specialties ?? {};

        return {
          id: apt.id,
          appointment_date: apt.appointment_date,
          appointment_time: apt.time_slot ?? '09:00',
          status: apt.status ?? 'pending',
          doctor_id: apt.doctor_id,
          doctor_name: doctor.full_name ? `Dr. ${doctor.full_name}` : 'Doctor',
          doctor_name_ar: doctor.full_name_ar ? `د. ${doctor.full_name_ar}` : 'طبيب',
          specialty: specialty.name_en ?? 'Specialist',
          specialty_ar: specialty.name_ar ?? 'متخصص',
          specialty_icon: specialty.icon ?? '🩺',
          clinic_name: clinic.clinic_name ?? 'Clinic',
          clinic_address: clinic.address ?? '',
          has_review: reviewsMap.has(apt.id),
          review_id: reviewsMap.get(apt.id)?.id ?? null,
          review_rating: reviewsMap.get(apt.id)?.rating ?? null,
        };
      };

      const normalizedUpcoming = upcomingRaw
        .map(transformAppointment)
        .filter((apt) => apt.status !== 'cancelled');
      const normalizedPast = pastRaw.map(transformAppointment);

      setUpcomingAppointments(normalizedUpcoming);
      setPastAppointments(normalizedPast);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setUpcomingAppointments([]);
      setPastAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pastLookbackDays, user]);

  useEffect(() => {
    if (user) {
      fetchAppointments();
      
      // Subscribe to real-time appointment changes for this patient
      const appointmentSubscription = supabase
        .channel('patient-appointments')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'appointments',
            filter: `patient_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('🔔 Real-time appointment change detected:', payload);
            fetchAppointments();
          }
        )
        .subscribe((status) => {
          console.log('📡 Patient appointment subscription status:', status);
        });

      return () => {
        appointmentSubscription.unsubscribe();
      };
    } else {
      setLoading(false);
    }
  }, [user, fetchAppointments]);

  // Refresh appointments when screen comes into focus (e.g., after booking)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('📱 Appointments tab focused - refreshing data');
        fetchAppointments();
      }
    }, [user, fetchAppointments])
  );

  // Handle Android back button for modals
  useEffect(() => {
    const backAction = () => {
      if (showHistoryModal) {
        setShowHistoryModal(false);
        return true;
      }
      if (showReviewModal) {
        setShowReviewModal(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showHistoryModal, showReviewModal]);

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
            try {
              // Get appointment details before cancelling for notification
              const appointment = upcomingAppointments.find(apt => apt.id === appointmentId) || 
                                  pastAppointments.find(apt => apt.id === appointmentId);

              const { error } = await supabase
                .from('appointments')
                .update({ status: 'cancelled' })
                .eq('id', appointmentId);

              if (error) throw error;

              // Send notification to doctor
              if (appointment && user) {
                try {
                  console.log('📨 Sending cancellation notification to doctor');
                  
                  // Get doctor's user_id
                  const { data: doctorData } = await supabase
                    .from('doctors')
                    .select('user_id')
                    .eq('id', appointment.doctor_id)
                    .single();

                  if (doctorData?.user_id) {
                    // Get patient name
                    const { data: profileData } = await supabase
                      .from('profiles')
                      .select('full_name')
                      .eq('id', user.id)
                      .single();

                    const patientName = profileData?.full_name || 'A patient';

                    await sendPatientCancellationNotificationToDoctor(
                      doctorData.user_id,
                      patientName,
                      appointment.appointment_date,
                      appointment.appointment_time,
                      appointment.clinic_name
                    );
                    console.log('✅ Doctor notified about patient cancellation');
                  }
                } catch (notifError) {
                  console.error('⚠️ Failed to notify doctor:', notifError);
                  // Don't fail the cancellation if notification fails
                }
              }

              Alert.alert(t.common.success, t.appointments.appointmentCancelled);
              fetchAppointments();
            } catch (err) {
              console.error('Error cancelling appointment:', err);
              Alert.alert(t.common.error, 'Failed to cancel appointment');
            }
          },
        },
      ]
    );
  };

  const openReviewModal = (appointment: Appointment) => {
    setReviewAppointment(appointment);
    setReviewRating(appointment.review_rating ?? 0);
    setShowReviewModal(true);
  };

  const canEditReview = (appointment: Appointment) => {
    if (!appointment.review_id) return false;
    const aptDate = new Date(appointment.appointment_date);
    const now = new Date();
    return aptDate.getFullYear() === now.getFullYear() && aptDate.getMonth() === now.getMonth();
  };

  const handleSubmitReview = async () => {
    if (!user || !reviewAppointment) return;
    setSubmittingReview(true);

    try {
      const isEditing = canEditReview(reviewAppointment);
      if (reviewAppointment.review_id && !isEditing) {
        Alert.alert(
          t.common.error,
          isRTL ? 'لا يمكن تعديل التقييم بعد انتهاء الشهر' : 'Reviews can only be edited within the same month.'
        );
        return;
      }

      const { error } = reviewAppointment.review_id && isEditing
        ? await supabase
            .from('reviews')
            .update({
              rating: reviewRating,
              review_text: null,
              is_anonymous: false,
            })
            .eq('id', reviewAppointment.review_id)
        : await supabase
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
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10) || 9;
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
      case 'confirmed':
        return t.appointments.confirmed;
      case 'pending':
        return t.appointments.pending;
      case 'cancelled':
        return t.appointments.cancelled;
      case 'completed':
        return t.appointments.completed;
      default:
        return status;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { bg: 'rgba(34,197,94,0.18)', text: theme.colors.success };
      case 'pending':
        return { bg: 'rgba(249,115,22,0.22)', text: theme.colors.warning };
      case 'cancelled':
        return { bg: 'rgba(239,68,68,0.18)', text: theme.colors.danger };
      case 'completed':
        return { bg: theme.colors.primarySoft, text: theme.colors.primaryDark };
      default:
        return { bg: 'rgba(148,163,184,0.25)', text: theme.colors.textPrimary };
    }
  };

  const historyCompletedCount = pastAppointments.filter((apt) => apt.status === 'completed').length;
  const historyCancelledCount = pastAppointments.filter((apt) => apt.status === 'cancelled').length;

  const historyStatsCards = [
    {
      key: 'pastTotal',
      label: historyLabel,
      value: pastAppointments.length,
      icon: 'time-outline' as keyof typeof Ionicons.glyphMap,
      bg: 'rgba(30,136,229,0.12)',
      color: theme.colors.accent,
    },
    {
      key: 'completed',
      label: t.appointments.completed,
      value: historyCompletedCount,
      icon: 'checkmark-done-outline' as keyof typeof Ionicons.glyphMap,
      bg: 'rgba(34,197,94,0.12)',
      color: theme.colors.success,
    },
    {
      key: 'cancelled',
      label: t.appointments.cancelled,
      value: historyCancelledCount,
      icon: 'close-circle-outline' as keyof typeof Ionicons.glyphMap,
      bg: 'rgba(239,68,68,0.15)',
      color: theme.colors.danger,
    },
  ];

  const groupAppointmentsByMonth = (list: Appointment[]) => {
    const order: string[] = [];
    const monthMap = new Map<string, Appointment[]>();

    list.forEach((appointment) => {
      const label = getMonthLabel(appointment.appointment_date);
      if (!monthMap.has(label)) {
        order.push(label);
      }
      monthMap.set(label, [...(monthMap.get(label) ?? []), appointment]);
    });

    return order.map((label) => ({ label, data: monthMap.get(label) ?? [] }));
  };

  const renderAppointmentCard = (appointment: Appointment) => {
    const normalizedToday = new Date();
    normalizedToday.setHours(0, 0, 0, 0);

    const appointmentDate = new Date(appointment.appointment_date);
    appointmentDate.setHours(0, 0, 0, 0);
    const isFutureAppointment = appointmentDate >= normalizedToday;
    const showCancelAction = isFutureAppointment && (appointment.status === 'pending' || appointment.status === 'confirmed');
    const showReviewAction =
      (appointment.status === 'confirmed' || appointment.status === 'completed') && (!appointment.has_review || canEditReview(appointment));
    const reviewActionLabel = appointment.has_review ? t.appointments.editReview : t.appointments.leaveReview;
    const reviewIconSize = 24;
    const ratingValue = typeof appointment.review_rating === 'number' ? appointment.review_rating : null;
    const reviewFillPercent = Math.min(Math.max((ratingValue ?? 0) / 5, 0), 1);
    const reviewFillWidth = reviewIconSize * reviewFillPercent;
    const ratingDisplay = ratingValue !== null && !Number.isNaN(ratingValue) ? ratingValue.toFixed(1) : '—';

    return (
      <View key={appointment.id}>
        <View style={styles.appointmentCard}>
          <View style={[styles.cardMetaRow, isRTL && styles.rowReverse]}>
            <View style={[styles.metaChip, styles.metaChipPrimary, isRTL && styles.rowReverse]}>
              <Ionicons
                name={theme.icons.calendar as keyof typeof Ionicons.glyphMap}
                size={14}
                color={theme.colors.surface}
              />
              <Text style={[styles.metaChipText, isRTL && styles.textRight]}>
                {formatDate(appointment.appointment_date)}
              </Text>
            </View>
            <View style={[styles.metaChip, isRTL && styles.rowReverse]}>
              <Ionicons
                name={theme.icons.time as keyof typeof Ionicons.glyphMap}
                size={14}
                color={theme.colors.accent}
              />
              <Text style={[styles.metaChipTextSoft, isRTL && styles.textRight]}>
                {formatTime(appointment.appointment_time)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusStyle(appointment.status).bg }]}>
              <Text style={[styles.statusText, { color: getStatusStyle(appointment.status).text }]}>
                {getStatusText(appointment.status)}
              </Text>
            </View>
          </View>

          <View style={[styles.cardMainRow, isRTL && styles.rowReverse]}>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarEmoji}>{appointment.specialty_icon}</Text>
            </View>
            <View style={[styles.cardDetails, isRTL && styles.alignRight]}>
              <Text style={[styles.doctorName, isRTL && styles.textRight]}>
                {isRTL ? appointment.doctor_name_ar : appointment.doctor_name}
              </Text>
              <Text style={[styles.doctorSubText, isRTL && styles.textRight]}>
                {isRTL ? appointment.specialty_ar : appointment.specialty}
              </Text>
              <View style={[styles.clinicRow, isRTL && styles.rowReverse]}>
                <Ionicons
                  name={theme.icons.location as keyof typeof Ionicons.glyphMap}
                  size={14}
                  color={theme.colors.textMuted}
                />
                <Text style={[styles.clinicText, isRTL && styles.textRight]} numberOfLines={2}>
                  {appointment.clinic_name}
                  {appointment.clinic_address ? ` · ${appointment.clinic_address}` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={14} color="#FACC15" />
              <Text style={styles.ratingText}>{ratingDisplay}</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {(showCancelAction || showReviewAction) && (
            <View style={[styles.actionRow, isRTL && styles.rowReverse]}>
              {showCancelAction && (
                <TouchableOpacity
                  accessibilityLabel={t.appointments.cancelAppointment}
                  accessibilityRole="button"
                  style={[styles.iconButton, styles.iconButtonDanger]}
                  onPress={() => handleCancelAppointment(appointment.id)}
                >
                  <Ionicons name="close-circle" size={22} color={theme.colors.danger} />
                </TouchableOpacity>
              )}

              {showReviewAction && (
                <TouchableOpacity
                  accessibilityLabel={reviewActionLabel}
                  accessibilityRole="button"
                  style={[styles.iconButton, styles.iconButtonPrimary]}
                  onPress={() => openReviewModal(appointment)}
                >
                  <View
                    style={[styles.starIconWrapper, { width: reviewIconSize, height: reviewIconSize }]}
                    pointerEvents="none"
                  >
                    <Ionicons name="star-outline" size={reviewIconSize} color={theme.colors.accent} />
                    {reviewFillPercent > 0 && (
                      <View style={[styles.starFillClip, { width: reviewFillWidth }]}>
                        <Ionicons name="star" size={reviewIconSize} color="#FACC15" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {(appointment.status === 'confirmed' || appointment.status === 'completed') &&
            appointment.has_review &&
            !canEditReview(appointment) && (
              <View style={styles.reviewedBadge}>
                <Text style={styles.reviewedText}>{t.appointments.reviewed}</Text>
              </View>
            )}
        </View>
      </View>
    );
  };

  const renderAppointmentsList = (list: Appointment[]) => {
    const groups = groupAppointmentsByMonth(list);
    if (groups.length === 0) return null;

    return groups.map(({ label, data }) => (
      <View key={label}>
        <Text style={[styles.monthHeader, isRTL && styles.textRight]}>{label}</Text>
        {data.map((appointment) => renderAppointmentCard(appointment))}
      </View>
    ));
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={[styles.headerTopRow, isRTL && styles.rowReverse]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, isRTL && styles.textRight]}>{t.appointments.title}</Text>
            <Text style={[styles.headerSubtitle, isRTL && styles.textRight]}>{t.appointments.subtitle}</Text>
          </View>
          <TouchableOpacity
            accessibilityLabel={historyLabel}
            accessibilityRole="button"
            style={styles.historyButton}
            onPress={() => setShowHistoryModal(true)}
          >
            <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {upcomingAppointments.length === 0 ? (
          <View style={styles.upcomingEmpty}>
            <LinearGradient
              colors={[theme.colors.primaryDark, theme.colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.emptyHero}
            >
              <View style={styles.emptyHeroIconWrap}>
                <Ionicons name="calendar-outline" size={26} color={theme.colors.primary} />
              </View>
              <Text style={[styles.emptyHeroTitle, isRTL && styles.textRight]}>
                {t.appointments.noUpcoming}
              </Text>
              <Text style={[styles.emptyHeroText, isRTL && styles.textRight]}>
                {t.appointments.noUpcomingDesc}
              </Text>

              <View style={styles.emptyHeroHighlights}>
                <View style={[styles.emptyHighlightRow, isRTL && styles.rowReverse]}>
                  <Ionicons name="time-outline" size={16} color={theme.colors.surface} />
                  <Text style={[styles.emptyHighlightText, isRTL && styles.textRight]}>
                    {t.appointments.subtitle}
                  </Text>
                </View>
                <View style={[styles.emptyHighlightRow, isRTL && styles.rowReverse]}>
                  <Ionicons name="sparkles-outline" size={16} color={theme.colors.surface} />
                  <Text style={[styles.emptyHighlightText, isRTL && styles.textRight]}>
                    {t.booking.title}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            <View style={[styles.emptyActions, isRTL && styles.rowReverse]}>
              <TouchableOpacity
                style={styles.findDoctorButton}
                onPress={() => router.push('/(patient-tabs)/home')}
              >
                <Ionicons
                  name={isRTL ? 'arrow-back' : 'arrow-forward'}
                  size={18}
                  color={theme.colors.surface}
                />
                <Text style={styles.findDoctorButtonText}>{t.appointments.findDoctor}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionButton}
                onPress={() => setShowHistoryModal(true)}
              >
                <Text style={styles.secondaryActionText}>{t.appointments.past}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          renderAppointmentsList(upcomingAppointments)
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
                <TouchableOpacity key={star} onPress={() => setReviewRating(star)} style={styles.starButton}>
                  <Text style={[styles.starText, reviewRating >= star && styles.starTextActive]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={() => setShowReviewModal(false)}>
                <Text style={styles.modalButtonSecondaryText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButtonPrimary, submittingReview && styles.buttonDisabled]}
                onPress={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator color={theme.colors.surface} size="small" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>{t.appointments.submitReview}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showHistoryModal}
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.historyContainer}>
          <View style={[styles.historyHeader, isRTL && styles.rowReverse]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.historyTitle, isRTL && styles.textRight]}>{historyLabel}</Text>
              <Text style={[styles.historySubtitle, isRTL && styles.textRight]}>
                {historySubtitle}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel={t.common.close}
              accessibilityRole="button"
              style={styles.historyCloseButton}
              onPress={() => setShowHistoryModal(false)}
            >
              <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            {historyStatsCards.map((card) => (
              <View key={card.key} style={styles.statCard}>
                <View style={[styles.statIconWrap, { backgroundColor: card.bg }]}> 
                  <Ionicons name={card.icon} size={16} color={card.color} />
                </View>
                <Text style={styles.statValue}>{card.value}</Text>
                <Text style={styles.statLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          <ScrollView
            style={styles.historyList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: theme.spacing.xl }}
          >
            {pastAppointments.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🕘</Text>
                <Text style={styles.emptyTitle}>{t.appointments.noPast}</Text>
                <Text style={styles.emptyText}>{t.appointments.noPastDesc}</Text>
              </View>
            ) : (
              renderAppointmentsList(pastAppointments)
            )}

            {pastAppointments.length > 0 && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={() => setPastLookbackDays((prev) => prev + 14)}
              >
                <Text style={styles.loadMoreText}>{t.appointments.loadMore}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: theme.colors.textSecondary },
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: 52,
    paddingBottom: 28,
    paddingHorizontal: theme.spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: theme.colors.surface },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.78)', marginTop: 6 },
  historyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  textRight: { textAlign: 'right' },
  rowReverse: { flexDirection: 'row-reverse' },
  alignRight: { alignItems: 'flex-end' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    marginTop: 12,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  upcomingEmpty: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  emptyHero: {
    borderRadius: 32,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 20,
    elevation: 6,
  },
  emptyHeroIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  emptyHeroTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.surface, textAlign: 'center' },
  emptyHeroText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyHeroHighlights: {
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  emptyHighlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    opacity: 0.85,
  },
  emptyHighlightText: { color: theme.colors.surface, fontSize: 13, fontWeight: '500' },
  statCard: {
    flex: 1,
    minWidth: 110,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    padding: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary },
  statLabel: { fontSize: 12, color: theme.colors.textSecondary },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 0,
    paddingBottom: theme.spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary },
  emptyText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  monthHeader: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8, marginTop: 12 },
  findDoctorButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radii.md,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  findDoctorButtonText: { color: theme.colors.surface, fontSize: 15, fontWeight: '600' },
  emptyActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  secondaryActionButton: {
    flex: 1,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  secondaryActionText: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600' },
  appointmentCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.elevated,
  },
  metaChipPrimary: { backgroundColor: theme.colors.primary },
  metaChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.surface },
  metaChipTextSoft: { fontSize: 12, fontWeight: '600', color: theme.colors.accent },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radii.pill },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardMainRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: { fontSize: 26 },
  cardDetails: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  doctorSubText: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  clinicRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  clinicText: { fontSize: 12, color: theme.colors.textSecondary, flex: 1 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(250,204,21,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radii.pill,
  },
  ratingText: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  cardDivider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 12 },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconButtonDanger: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.4)',
  },
  iconButtonPrimary: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.primary,
  },
  starIconWrapper: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  starFillClip: { position: 'absolute', top: 0, left: 0, height: '100%', overflow: 'hidden' },
  reviewedBadge: {
    backgroundColor: 'rgba(34,197,94,0.16)',
    paddingVertical: 8,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginTop: 10,
  },
  reviewedText: { color: theme.colors.success, fontWeight: '600' },
  loadMoreButton: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  loadMoreText: { color: theme.colors.textPrimary, fontWeight: '600' },
  historyContainer: { flex: 1, backgroundColor: theme.colors.background },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  historyTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary },
  historySubtitle: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  historyCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.elevated,
  },
  historyList: { flex: 1, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8,15,40,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    width: '90%',
    maxWidth: 420,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: theme.colors.textSecondary, marginBottom: 16 },
  ratingRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16, gap: 8 },
  starButton: { padding: 4 },
  starText: { fontSize: 28, color: theme.colors.cardBorder },
  starTextActive: { color: '#FACC15' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalButtonSecondary: {
    flex: 1,
    backgroundColor: theme.colors.elevated,
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  modalButtonSecondaryText: { color: theme.colors.textPrimary, fontWeight: '600' },
  modalButtonPrimary: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  modalButtonPrimaryText: { color: theme.colors.surface, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
});
