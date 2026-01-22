import { useI18n } from '@/lib/i18n';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function DoctorProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t, isRTL } = useI18n();
  
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
    { key: 'instagram', label: 'Instagram', icon: 'IG', url: buildSocialUrl('instagram', instagram) },
    { key: 'facebook', label: 'Facebook', icon: 'FB', url: buildSocialUrl('facebook', facebook) },
  ].filter(link => link.url);

  const handleOpenLink = (url: string) => {
    Linking.openURL(url);
  };

  const handleBookAppointment = () => {
 = () => {
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
          <Text style={styles.doctorIcon}>{icon}</Text>
          <Text style={styles.doctorName}>{isRTL ? doctorNameAr : doctorName}</Text>
          <Text style={styles.doctorSpecialty}>{isRTL ? specialtyAr : specialty}</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.rating}>⭐ {rating}</Text>
            <Text style={styles.reviews}>({reviews} {isRTL ? 'تقييم' : 'reviews'})</Text>
          </View>
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
              <Text style={[styles.infoValue, isRTL && styles.textRight]}>{address} • {distance}</Text>
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
                <Text style={styles.contactButtonIcon}>📞</Text>
                <Text style={styles.contactButtonText}>{isRTL ? 'اتصال' : 'Call'}</Text>
              </TouchableOpacity>
            )}
            
            {whatsapp && (
              <TouchableOpacity style={[styles.contactButton, styles.whatsappButton]} onPress={handleWhatsApp}>
                <Text style={styles.contactButtonIcon}>💬</Text>
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
                  <Text style={styles.socialIcon}>{link.icon}</Text>
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
          
          <View style={[styles.scheduleRow, isRTL && styles.rowReverse]}>
            <Text style={styles.scheduleDay}>{isRTL ? 'الإثنين - الجمعة' : 'Monday - Friday'}</Text>
            <Text style={styles.scheduleTime}>{isRTL ? '٩:٠٠ ص - ٥:٠٠ م' : '9:00 AM - 5:00 PM'}</Text>
          </View>
          <View style={[styles.scheduleRow, isRTL && styles.rowReverse]}>
            <Text style={styles.scheduleDay}>{isRTL ? 'السبت' : 'Saturday'}</Text>
            <Text style={styles.scheduleTime}>{isRTL ? '١٠:٠٠ ص - ٢:٠٠ م' : '10:00 AM - 2:00 PM'}</Text>
          </View>
          <View style={[styles.scheduleRow, isRTL && styles.rowReverse]}>
            <Text style={styles.scheduleDay}>{isRTL ? 'الأحد' : 'Sunday'}</Text>
            <Text style={[styles.scheduleTime, styles.closedText]}>{isRTL ? 'مغلق' : 'Closed'}</Text>
          </View>
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
  doctorName: { fontSize: 24, fontWeight: 'bold', color: 'white', textAlign: 'center' },
  doctorSpecialty: { fontSize: 16, color: '#BFDBFE', marginTop: 5 },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  rating: { fontSize: 16, color: '#FCD34D', fontWeight: '600' },
  reviews: { fontSize: 14, color: '#BFDBFE', marginLeft: 8 },
  content: { flex: 1, padding: 20 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937', marginBottom: 15 },
  textRight: { textAlign: 'right' },
  rowReverse: { flexDirection: 'row-reverse' },
  alignRight: { alignItems: 'flex-end' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  infoIcon: { fontSize: 20, marginRight: 15, marginTop: 2 },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#1F2937', fontWeight: '500' },
  feeText: { color: '#2563EB', fontWeight: 'bold', fontSize: 18 },
  contactButtons: { flexDirection: 'row', gap: 10 },
  contactButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', padding: 15, borderRadius: 12 },
  whatsappButton: { backgroundColor: '#D1FAE5' },
  contactButtonIcon: { fontSize: 20, marginRight: 8 },
  contactButtonText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  socialButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  socialButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 12, borderRadius: 12 },
  socialIcon: { fontSize: 18, marginRight: 8 },
  socialText: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  scheduleDay: { fontSize: 14, color: '#6B7280' },
  scheduleTime: { fontSize: 14, color: '#1F2937', fontWeight: '500' },
  closedText: { color: '#EF4444' },
  bottomButton: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 20, paddingBottom: 35, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 5 },
  bookButton: { backgroundColor: '#2563EB', padding: 18, borderRadius: 12, alignItems: 'center' },
  bookButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
