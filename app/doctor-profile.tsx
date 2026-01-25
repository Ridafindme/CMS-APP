import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DoctorProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t, isRTL } = useI18n();
  
  const [clinicSchedule, setClinicSchedule] = useState<any>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  
  // Get all data from navigation params
  const clinicId = params.clinic_id as string;
  const doctorId = params.doctor_id as string;
  const doctorName = params.name as string || 'Dr. Unknown';
  const doctorNameAr = params.name_ar as string || 'طبيب';
  const specialty = params.specialty as string || 'General';
  const specialtyAr = params.specialty_ar as string || 'عام';
  const rating = params.rating as string || '4.5';
  const reviews = params.reviews as string || '0';
  const fee = params.fee as string || '$50';
  const distance = params.distance as string || '0 km';
  const clinicName = params.clinic as string || 'Medical Center';
  const address = params.address as string || 'Lebanon';
  const experience = params.experience as string || '10 years';
  const icon = params.icon as string || '🩺';
  const phone = params.phone as string || '';
  const whatsapp = params.whatsapp as string || '';
  const instagram = params.instagram as string || '';
  const facebook = params.facebook as string || '';
  const avatarUrl = params.avatar_url as string || '';
  const bio = params.bio as string || '';

  useEffect(() => {
    fetchClinicSchedule();
  }, [clinicId]);

  const fetchClinicSchedule = async () => {
    if (!clinicId) {
      setLoadingSchedule(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('schedule')
        .eq('id', clinicId)
        .single();

      if (error) throw error;
      setClinicSchedule(data?.schedule);
    } catch (error) {
      console.error('Error fetching clinic schedule:', error);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes = '00'] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getDayName = (dayKey: string) => {
    const days: { [key: string]: { en: string; ar: string } } = {
      sun: { en: 'Sunday', ar: 'الأحد' },
      mon: { en: 'Monday', ar: 'الإثنين' },
      tue: { en: 'Tuesday', ar: 'الثلاثاء' },
      wed: { en: 'Wednesday', ar: 'الأربعاء' },
      thu: { en: 'Thursday', ar: 'الخميس' },
      fri: { en: 'Friday', ar: 'الجمعة' },
      sat: { en: 'Saturday', ar: 'السبت' },
    };
    return isRTL ? days[dayKey]?.ar : days[dayKey]?.en || dayKey;
  };

  const handleCall = () => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleWhatsApp = () => {
    if (whatsapp) {
      const message = isRTL 
        ? `مرحباً، أود حجز موعد في ${clinicName}`
        : `Hello, I would like to book an appointment at ${clinicName}`;
      Linking.openURL(`whatsapp://send?phone=${whatsapp.replace(/\s/g, '')}&text=${encodeURIComponent(message)}`);
    }
  };

  const normalizeSocialHandle = (value: string) => value.replace(/^@/, '').trim();

  const buildSocialUrl = (platform: 'instagram' | 'facebook', value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const handle = normalizeSocialHandle(trimmed);

    switch (platform) {
      case 'instagram':
        return `https://instagram.com/${handle}`;
      case 'facebook':
        return `https://facebook.com/${handle}`;
      default:
        return '';
    }
  };

  const socialLinks = [
    { key: 'instagram', label: 'Instagram', iconName: 'logo-instagram', color: '#E1306C', url: buildSocialUrl('instagram', instagram) },
    { key: 'facebook', label: 'Facebook', iconName: 'logo-facebook', color: '#1877F2', url: buildSocialUrl('facebook', facebook) },
  ].filter(link => link.url);

  const handleOpenLink = (url: string) => {
    Linking.openURL(url);
  };

  const openMaps = () => {
    const addressParam = params.address as string;
    const latParam = params.latitude as string;
    const lonParam = params.longitude as string;
    const latitude = latParam ? parseFloat(latParam) : null;
    const longitude = lonParam ? parseFloat(lonParam) : null;

    if (latitude && longitude) {
      const scheme = Platform.select({
        ios: 'maps:',
        android: 'geo:',
      });
      const url = Platform.select({
        ios: `${scheme}${latitude},${longitude}?q=${latitude},${longitude}`,
        android: `${scheme}${latitude},${longitude}?q=${latitude},${longitude}`,
      });

      Linking.canOpenURL(url!).then((supported) => {
        if (supported) {
          Linking.openURL(url!);
        } else {
          Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
        }
      });
    } else if (addressParam) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressParam)}`;
      Linking.openURL(url);
    }
  };

  const handleBookAppointment = () => {
    router.push({
      pathname: '/booking',
      params: {
        doctorId: doctorId,
        clinicId: clinicId,
        doctorName: doctorName,
        doctorNameAr: doctorNameAr,
        doctorSpecialty: specialty,
        doctorSpecialtyAr: specialtyAr,
        doctorFee: fee,
        doctorIcon: icon,
        clinicName: clinicName,
      }
    } as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>{isRTL ? '→ رجوع' : '← Back'}</Text>
        </TouchableOpacity>
        
        <View style={styles.doctorHeader}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.doctorAvatar} />
          ) : (
            <Text style={styles.doctorIcon}>{icon}</Text>
          )}
          <Text style={styles.doctorName}>{isRTL ? doctorNameAr : doctorName}</Text>
          <Text style={styles.doctorSpecialty}>{isRTL ? specialtyAr : specialty}</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.rating}>⭐ {rating}</Text>
            <Text style={styles.reviews}>({reviews} {isRTL ? 'تقييم' : 'reviews'})</Text>
          </View>
          {bio ? (
            <Text style={[styles.bioInHeader, isRTL && styles.textRight]}>
              {bio}
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* About Section */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, isRTL && styles.textRight]}>
            {isRTL ? 'معلومات' : 'About'}
          </Text>
          
          <View style={[styles.infoRow, isRTL && styles.rowReverse]}>
            <Text style={styles.infoIcon}>🏥</Text>
            <View style={[styles.infoText, isRTL && styles.alignRight]}>
              <Text style={[styles.infoLabel, isRTL && styles.textRight]}>
                {isRTL ? 'العيادة' : 'Clinic'}
              </Text>
              <Text style={[styles.infoValue, isRTL && styles.textRight]}>{clinicName}</Text>
            </View>
          </View>
          
          <View style={[styles.infoRow, isRTL && styles.rowReverse]}>
            <Text style={styles.infoIcon}>📍</Text>
            <View style={[styles.infoText, isRTL && styles.alignRight]}>
              <Text style={[styles.infoLabel, isRTL && styles.textRight]}>
                {isRTL ? 'الموقع' : 'Location'}
              </Text>
              <TouchableOpacity onPress={openMaps}>
                <Text style={[styles.infoValue, styles.clickableAddress, isRTL && styles.textRight]}>{address} • {distance}</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={[styles.infoRow, isRTL && styles.rowReverse]}>
            <Text style={styles.infoIcon}>⏰</Text>
            <View style={[styles.infoText, isRTL && styles.alignRight]}>
              <Text style={[styles.infoLabel, isRTL && styles.textRight]}>
                {isRTL ? 'الخبرة' : 'Experience'}
              </Text>
              <Text style={[styles.infoValue, isRTL && styles.textRight]}>{experience}</Text>
            </View>
          </View>
          
          <View style={[styles.infoRow, isRTL && styles.rowReverse]}>
            <Text style={styles.infoIcon}>💰</Text>
            <View style={[styles.infoText, isRTL && styles.alignRight]}>
              <Text style={[styles.infoLabel, isRTL && styles.textRight]}>
                {isRTL ? 'رسوم الاستشارة' : 'Consultation Fee'}
              </Text>
              <Text style={[styles.infoValue, styles.feeText, isRTL && styles.textRight]}>{fee}</Text>
            </View>
          </View>
        </View>

        {/* Contact Section */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, isRTL && styles.textRight]}>
            {isRTL ? 'التواصل' : 'Contact'}
          </Text>
          
          <View style={styles.contactButtons}>
            {phone && (
              <TouchableOpacity style={styles.contactButton} onPress={handleCall}>
                <Ionicons name="call-outline" size={20} color="#1F2937" style={styles.contactButtonIcon} />
                <Text style={styles.contactButtonText}>{isRTL ? 'اتصال' : 'Call'}</Text>
              </TouchableOpacity>
            )}
            
            {whatsapp && (
              <TouchableOpacity style={[styles.contactButton, styles.whatsappButton]} onPress={handleWhatsApp}>
                <Ionicons name="logo-whatsapp" size={20} color="#25D366" style={styles.contactButtonIcon} />
                <Text style={styles.contactButtonText}>WhatsApp</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {socialLinks.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, isRTL && styles.textRight]}>
              Social Media
            </Text>

            <View style={styles.socialButtons}>
              {socialLinks.map((link) => (
                <TouchableOpacity
                  key={link.key}
                  style={[styles.socialButton, isRTL && styles.rowReverse]}
                  onPress={() => handleOpenLink(link.url)}
                >
                    <Ionicons name={link.iconName as any} size={20} color={link.color} style={styles.socialIcon} />
                  <Text style={[styles.socialText, isRTL && styles.textRight]}>{link.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}



        {/* Working Hours */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, isRTL && styles.textRight]}>
            {isRTL ? 'ساعات العمل' : 'Working Hours'}
          </Text>
          
          {loadingSchedule ? (
            <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 20 }} />
          ) : clinicSchedule ? (
            <>
              {/* Days with working hours */}
              {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                const isWeeklyOff = clinicSchedule.weekly_off?.includes(day);
                // Priority: Day-specific schedule > Generic default
                const daySchedule = clinicSchedule[day];
                const schedule = (daySchedule && (daySchedule.start || daySchedule.end)) 
                  ? daySchedule 
                  : clinicSchedule.default;
                
                return (
                  <View key={day} style={[styles.scheduleRow, isRTL && styles.rowReverse]}>
                    <Text style={styles.scheduleDay}>{getDayName(day)}</Text>
                    {isWeeklyOff ? (
                      <Text style={[styles.scheduleTime, styles.closedText]}>
                        {isRTL ? 'مغلق' : 'Closed'}
                      </Text>
                    ) : schedule?.start && schedule?.end ? (
                      <Text style={styles.scheduleTime}>
                        {formatTime(schedule.start)} - {formatTime(schedule.end)}
                      </Text>
                    ) : (
                      <Text style={[styles.scheduleTime, styles.closedText]}>
                        {isRTL ? 'غير متاح' : 'Not Available'}
                      </Text>
                    )}
                  </View>
                );
              })}
            </>
          ) : (
            <Text style={[styles.scheduleTime, { textAlign: 'center', paddingVertical: 20 }]}>
              {isRTL ? 'لا توجد ساعات عمل محددة' : 'No schedule available'}
            </Text>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View style={styles.bottomButton}>
        <TouchableOpacity style={styles.bookButton} onPress={handleBookAppointment}>
          <Text style={styles.bookButtonText}>
            {isRTL ? `حجز موعد • ${fee}` : `Book Appointment • ${fee}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { backgroundColor: '#2563EB', paddingTop: 50, paddingBottom: 30, borderBottomLeftRadius: 25, borderBottomRightRadius: 25 },
  backButton: { paddingHorizontal: 20, paddingVertical: 10 },
  backButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  doctorHeader: { alignItems: 'center', paddingHorizontal: 20 },
  doctorIcon: { fontSize: 60, marginBottom: 10 },
  doctorAvatar: { width: 90, height: 90, borderRadius: 45, marginBottom: 10 },
  doctorName: { fontSize: 24, fontWeight: 'bold', color: 'white', textAlign: 'center' },
  doctorSpecialty: { fontSize: 16, color: '#BFDBFE', marginTop: 5 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  rating: { fontSize: 16, color: '#FCD34D', fontWeight: '600' },
  reviews: { fontSize: 14, color: '#BFDBFE', marginLeft: 8 },
  bioInHeader: { fontSize: 14, color: '#E0E7FF', marginTop: 12, paddingHorizontal: 20, textAlign: 'center', lineHeight: 20 },
  content: { flex: 1, padding: 20 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 15 },
  bioText: { fontSize: 15, color: '#4B5563', lineHeight: 24 },
  textRight: { textAlign: 'right' },
  rowReverse: { flexDirection: 'row-reverse' },
  alignRight: { alignItems: 'flex-end' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  infoIcon: { fontSize: 20, marginRight: 15, marginTop: 2 },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#1F2937', fontWeight: '500' },
  clickableAddress: { color: '#2563EB', textDecorationLine: 'underline' },
  feeText: { color: '#2563EB', fontWeight: 'bold', fontSize: 18 },
  contactButtons: { flexDirection: 'row', gap: 10 },
  contactButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', padding: 15, borderRadius: 12 },
  whatsappButton: { backgroundColor: '#D1FAE5' },
  contactButtonIcon: { marginRight: 8 },
  contactButtonText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  socialButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  socialButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 12, borderRadius: 12 },
  socialIcon: { marginRight: 8 },
  socialText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  scheduleDay: { fontSize: 14, color: '#6B7280' },
  scheduleTime: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  closedText: { color: '#EF4444' },
  bottomButton: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 20, paddingBottom: 35, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 5 },
  bookButton: { backgroundColor: '#2563EB', padding: 18, borderRadius: 12, alignItems: 'center' },
  bookButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
