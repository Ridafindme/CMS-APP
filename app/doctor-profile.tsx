import { patientTheme } from '@/constants/patientTheme';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type HeroHighlight = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

type InfoRow = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
  isLink?: boolean;
  hint?: string;
};

type ContactAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
};

const theme = patientTheme;

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

  // Handle Android back button
  useFocusEffect(
    useCallback(() => {
      const backAction = () => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(patient-tabs)/home');
        }
        return true;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      
      return () => {
        backHandler.remove();
      };
    }, [router])
  );

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

  const heroHighlights: HeroHighlight[] = (
    [
      {
        key: 'rating',
        icon: 'star',
        label: isRTL ? 'التقييم' : 'Rating',
        value: `${rating} • ${reviews} ${isRTL ? 'تقييم' : 'reviews'}`,
      },
      {
        key: 'experience',
        icon: 'medal-outline',
        label: isRTL ? 'الخبرة' : 'Experience',
        value: experience,
      },
      {
        key: 'fee',
        icon: 'cash-outline',
        label: isRTL ? 'الرسوم' : 'Consultation Fee',
        value: fee,
      },
      distance
        ? {
            key: 'distance',
            icon: theme.icons.distance as keyof typeof Ionicons.glyphMap,
            label: isRTL ? 'المسافة' : 'Distance',
            value: distance,
          }
        : null,
    ] as (HeroHighlight | null)[]
  ).filter((highlight): highlight is HeroHighlight => Boolean(highlight && highlight.value));

  const contactActions: ContactAction[] = (
    [
      phone
        ? {
            key: 'call',
            label: isRTL ? 'اتصال' : 'Call',
            icon: 'call-outline',
            color: theme.colors.primaryDark,
            onPress: handleCall,
          }
        : null,
      whatsapp
        ? {
            key: 'whatsapp',
            label: 'WhatsApp',
            icon: 'logo-whatsapp',
            color: '#25D366',
            onPress: handleWhatsApp,
          }
        : null,
    ] as (ContactAction | null)[]
  ).filter((action): action is ContactAction => Boolean(action));

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

  const handleOpenLink = (url: string) => {
    Linking.openURL(url);
  };

  const infoRows: InfoRow[] = (
    [
      {
        key: 'clinic',
        icon: theme.icons.clinic as keyof typeof Ionicons.glyphMap,
        label: isRTL ? 'العيادة' : 'Clinic',
        value: clinicName,
      },
      {
        key: 'location',
        icon: theme.icons.location as keyof typeof Ionicons.glyphMap,
        label: isRTL ? 'الموقع' : 'Location',
        value: distance ? `${address} • ${distance}` : address,
        onPress: openMaps,
        isLink: true,
        hint: isRTL ? 'اضغط لفتح الخرائط' : 'Tap to open maps',
      },
      {
        key: 'experience',
        icon: 'medal-outline',
        label: isRTL ? 'الخبرة' : 'Experience',
        value: experience,
      },
      {
        key: 'fee',
        icon: 'card-outline',
        label: isRTL ? 'رسوم الاستشارة' : 'Consultation Fee',
        value: fee,
      },
    ] as InfoRow[]
  ).filter((row) => row.value && row.value.trim().length > 0);

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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.heroShadow}>
            <LinearGradient
              colors={[theme.colors.primaryDark, theme.colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={[styles.heroTopRow, isRTL && styles.rowReverse]}>
                <TouchableOpacity
                  style={styles.heroNavButton}
                  onPress={() => router.back()}
                  accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
                >
                  <Ionicons
                    name={isRTL ? 'arrow-forward' : 'arrow-back'}
                    size={20}
                    color={theme.colors.surface}
                  />
                </TouchableOpacity>

                <View style={[styles.heroMetaChip, isRTL && styles.rowReverse]}>
                  <Ionicons
                    name={theme.icons.location as keyof typeof Ionicons.glyphMap}
                    size={18}
                    color={theme.colors.surface}
                  />
                  <Text style={[styles.heroMetaText, isRTL && styles.textRight]} numberOfLines={1}>
                    {distance}
                  </Text>
                </View>
              </View>

              <View style={[styles.heroBody, isRTL && styles.alignEnd]}>
                <View style={styles.avatarWrapper}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.heroAvatar} />
                  ) : (
                    <Text style={styles.avatarFallback}>{icon}</Text>
                  )}
                </View>

                <Text style={[styles.heroName, isRTL && styles.textRight]} numberOfLines={2}>
                  {isRTL ? doctorNameAr : doctorName}
                </Text>

                <View style={[styles.heroSpecialtyChip, isRTL && styles.rowReverse]}>
                  <Ionicons
                    name={theme.icons.doctor as keyof typeof Ionicons.glyphMap}
                    size={16}
                    color={theme.colors.surface}
                  />
                  <Text style={[styles.heroSpecialty, isRTL && styles.textRight]}>
                    {isRTL ? specialtyAr : specialty}
                  </Text>
                </View>

                <View style={[styles.heroRatingRow, isRTL && styles.rowReverse]}>
                  <Ionicons name="star" size={18} color="#FACC15" />
                  <Text style={styles.heroRatingText}>{rating}</Text>
                  <Text style={[styles.heroRatingReviews, isRTL && styles.textRight]}>
                    ({reviews} {isRTL ? 'تقييم' : 'reviews'})
                  </Text>
                </View>

                {bio ? (
                  <Text style={[styles.heroBio, isRTL && styles.textRight]} numberOfLines={4}>
                    {bio}
                  </Text>
                ) : null}

                <View style={[styles.heroClinicChip, isRTL && styles.rowReverse]}>
                  <Ionicons
                    name={theme.icons.clinic as keyof typeof Ionicons.glyphMap}
                    size={16}
                    color={theme.colors.surface}
                  />
                  <Text style={[styles.heroClinicText, isRTL && styles.textRight]} numberOfLines={1}>
                    {clinicName}
                  </Text>
                </View>

                {heroHighlights.length > 0 && (
                  <View style={styles.heroHighlights}>
                    {heroHighlights.map((highlight) => (
                      <View key={highlight.key} style={styles.heroHighlight}>
                        <View style={styles.heroHighlightIcon}>
                          <Ionicons name={highlight.icon} size={16} color={theme.colors.surface} />
                        </View>
                        <Text style={[styles.heroHighlightLabel, isRTL && styles.textRight]}>
                          {highlight.label}
                        </Text>
                        <Text style={[styles.heroHighlightValue, isRTL && styles.textRight]} numberOfLines={1}>
                          {highlight.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </LinearGradient>
          </View>
        </View>

        {infoRows.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, isRTL && styles.textRight]}>
              {isRTL ? 'معلومات' : 'About'}
            </Text>

            {infoRows.map((row, index) => (
              <TouchableOpacity
                key={row.key}
                style={[
                  styles.infoRow,
                  isRTL && styles.rowReverse,
                  index === infoRows.length - 1 && styles.infoRowLast,
                ]}
                onPress={row.onPress}
                disabled={!row.onPress}
                activeOpacity={row.onPress ? 0.85 : 1}
              >
                <View style={styles.infoIconWrap}>
                  <Ionicons name={row.icon} size={18} color={theme.colors.primary} />
                </View>
                <View style={[styles.infoTextWrap, isRTL && styles.alignEnd]}>
                  <Text style={[styles.infoLabel, isRTL && styles.textRight]}>{row.label}</Text>
                  <Text
                    style={[styles.infoValue, row.isLink && styles.infoValueInteractive, isRTL && styles.textRight]}
                    numberOfLines={2}
                  >
                    {row.value}
                  </Text>
                  {row.hint && (
                    <Text style={[styles.infoHint, isRTL && styles.textRight]}>
                      {row.hint}
                    </Text>
                  )}
                </View>
                {row.isLink && (
                  <Ionicons
                    name={isRTL ? 'arrow-back' : 'arrow-forward'}
                    size={16}
                    color={theme.colors.textMuted}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {contactActions.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, isRTL && styles.textRight]}>
              {isRTL ? 'التواصل' : 'Contact'}
            </Text>

            <View style={[styles.contactRow, isRTL && styles.rowReverse]}>
              {contactActions.map((action) => (
                <TouchableOpacity
                  key={action.key}
                  style={styles.contactButton}
                  onPress={action.onPress}
                >
                  <View
                    style={[
                      styles.contactIconWrap,
                      action.key === 'whatsapp' && styles.contactIconWhatsapp,
                    ]}
                  >
                    <Ionicons name={action.icon} size={18} color={action.color} />
                  </View>
                  <Text style={styles.contactText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {socialLinks.length > 0 && (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, isRTL && styles.textRight]}>
              {isRTL ? 'وسائل التواصل الاجتماعي' : 'Social Media'}
            </Text>

            <View style={[styles.socialButtons, isRTL && styles.rowReverseWrap]}>
              {socialLinks.map((link) => (
                <TouchableOpacity
                  key={link.key}
                  style={styles.socialButton}
                  onPress={() => handleOpenLink(link.url)}
                >
                  <View style={[styles.socialIconWrap, { backgroundColor: `${link.color}22` }]}>
                    <Ionicons name={link.iconName as keyof typeof Ionicons.glyphMap} size={16} color={link.color} />
                  </View>
                  <Text style={[styles.socialText, isRTL && styles.textRight]}>{link.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={[styles.cardTitle, isRTL && styles.textRight]}>
            {isRTL ? 'ساعات العمل' : 'Working Hours'}
          </Text>

          {loadingSchedule ? (
            <ActivityIndicator size="small" color={theme.colors.primary} style={styles.scheduleLoader} />
          ) : clinicSchedule ? (
            <>
              {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                const isWeeklyOff = clinicSchedule.weekly_off?.includes(day);
                const daySchedule = clinicSchedule[day];
                const schedule = (daySchedule && (daySchedule.start || daySchedule.end))
                  ? daySchedule
                  : clinicSchedule.default;

                return (
                  <View key={day} style={[styles.scheduleRow, isRTL && styles.rowReverse]}>
                    <Text style={[styles.scheduleDay, isRTL && styles.textRight]}>{getDayName(day)}</Text>
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
            <Text style={[styles.scheduleEmpty, isRTL && styles.textRight]}>
              {isRTL ? 'لا توجد ساعات عمل محددة' : 'No schedule available'}
            </Text>
          )}
        </View>

        <View style={styles.footerSpacer} />
      </ScrollView>

      <View style={styles.bottomButton}>
        <TouchableOpacity activeOpacity={0.9} onPress={handleBookAppointment}>
          <LinearGradient
            colors={[theme.colors.primaryDark, theme.colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bookButton}
          >
            <Text style={[styles.bookButtonLabel, isRTL && styles.textRight]}>
              {isRTL ? 'احجز موعداً' : 'Book Appointment'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 190 },
  heroSection: { paddingTop: 52, paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.lg },
  heroShadow: {
    borderRadius: theme.radii.lg + 8,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 10,
  },
  heroCard: { borderRadius: theme.radii.lg + 8, padding: theme.spacing.lg },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  rowReverse: { flexDirection: 'row-reverse' },
  rowReverseWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  heroNavButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radii.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    maxWidth: '70%',
  },
  heroMetaText: { color: theme.colors.surface, fontSize: 13, fontWeight: '600' },
  heroBody: { gap: 12 },
  alignEnd: { alignItems: 'flex-end' },
  textRight: { textAlign: 'right' },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroAvatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { fontSize: 48, color: theme.colors.surface },
  heroName: { fontSize: 26, fontWeight: '700', color: theme.colors.surface },
  heroSpecialtyChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: theme.radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroSpecialty: { color: theme.colors.surface, fontWeight: '600' },
  heroRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroRatingText: { color: theme.colors.surface, fontSize: 18, fontWeight: '700' },
  heroRatingReviews: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  heroBio: { color: 'rgba(255,255,255,0.9)', lineHeight: 20 },
  heroClinicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: theme.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroClinicText: { color: theme.colors.surface, fontWeight: '600', flex: 1 },
  heroHighlights: { flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing.sm, marginHorizontal: -4 },
  heroHighlight: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: theme.radii.md,
    padding: 12,
    margin: 4,
    minWidth: '45%',
    flexGrow: 1,
  },
  heroHighlightIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  heroHighlightLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  heroHighlightValue: { color: theme.colors.surface, fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  cardTitle: { fontSize: theme.typography.title, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: theme.spacing.md },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  infoRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextWrap: { flex: 1 },
  infoLabel: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 4 },
  infoValue: { fontSize: 16, color: theme.colors.textPrimary, fontWeight: '600' },
  infoValueInteractive: { color: theme.colors.primary, textDecorationLine: 'underline' },
  infoHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  contactRow: { flexDirection: 'row', gap: 12 },
  contactButton: {
    flex: 1,
    backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radii.lg,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  contactIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(41,98,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactIconWhatsapp: { backgroundColor: 'rgba(37,211,102,0.18)' },
  contactText: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  socialButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.elevated,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radii.md,
    flexGrow: 1,
    minWidth: '45%',
  },
  socialIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialText: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  scheduleLoader: { marginVertical: theme.spacing.md },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  scheduleDay: { fontSize: 14, color: theme.colors.textSecondary },
  scheduleTime: { fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600' },
  closedText: { color: theme.colors.danger },
  scheduleEmpty: { textAlign: 'center', paddingVertical: theme.spacing.lg, color: theme.colors.textSecondary },
  footerSpacer: { height: 140 },
  bottomButton: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 28 : 18,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl + (Platform.OS === 'ios' ? 10 : 4),
    borderRadius: theme.radii.lg,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
    marginHorizontal: theme.spacing.lg,
  },
  bookButton: { borderRadius: theme.radii.lg, padding: theme.spacing.lg, alignItems: 'center', justifyContent: 'center' },
  bookButtonLabel: { color: theme.colors.surface, fontSize: 18, fontWeight: '700', textAlign: 'center' },
});
