import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './supabase';

// Types
export type Appointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  patient_name: string;
  patient_id: string;
  clinic_id: string;
  clinic_name: string;
  notes?: string | null;
};

export type Clinic = {
  id: string;
  clinic_name: string;
  address: string;
  consultation_fee: string;
  is_active: boolean;
  latitude?: number;
  longitude?: number;
  schedule?: ClinicSchedule | null;
  slot_minutes?: number | null;
  mobile?: string | null;
  landline?: string | null;
  whatsapp?: string | null;
};

export type DoctorData = {
  id: string;
  specialty_code: string;
  specialty_name?: string;
  specialty_name_ar?: string;
  specialty_icon?: string;
  is_approved: boolean;
  rating: number;
  total_reviews: number;
  instagram?: string | null;
  facebook?: string | null;
  experience_years?: number | null;
  graduate_year?: number | null;
  bio?: string | null;
};

export type Profile = {
  full_name: string;
  full_name_ar: string;
  avatar_url: string | null;
  phone?: string | null;
};

export type BlockedSlot = {
  id: string;
  blocked_date: string;
  time_slot: string;
  clinic_id?: string | null;
  reason?: string;
};

export type ClinicHoliday = {
  id: string;
  clinic_id: string;
  holiday_date: string;
  reason?: string | null;
};

export type ClinicScheduleDay = {
  start?: string;
  end?: string;
  break_start?: string | null;
  break_end?: string | null;
};

export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export type ClinicSchedule = {
  default?: ClinicScheduleDay;
  weekly_off?: DayKey[];
  sun?: ClinicScheduleDay;
  mon?: ClinicScheduleDay;
  tue?: ClinicScheduleDay;
  wed?: ClinicScheduleDay;
  thu?: ClinicScheduleDay;
  fri?: ClinicScheduleDay;
  sat?: ClinicScheduleDay;
};

export type ChatConversation = {
  id: string;
  patient_id: string;
  patient_name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
};

export type ChatMessage = {
  id: string;
  content: string;
  created_at: string;
  is_mine: boolean;
};

// Helper functions
export const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const DAY_LABELS: Record<DayKey, string> = {
  sun: 'Sun',
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
};

export const timeToMinutes = (time: string) => {
  const [h, m] = time.split(':').map(v => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

export const minutesToTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const getDayKey = (dateString: string) => {
  // Parse date string as local date to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return DAY_KEYS[date.getDay()];
};

// Context
type DoctorContextType = {
  loading: boolean;
  doctorData: DoctorData | null;
  profile: Profile | null;
  appointments: Appointment[];
  clinics: Clinic[];
  blockedSlots: BlockedSlot[];
  holidays: ClinicHoliday[];
  chatConversations: ChatConversation[];
  unreadChatCount: number;
  fetchDoctorData: () => Promise<void>;
  fetchAppointments: (lookbackDays?: number) => Promise<void>;
  fetchClinics: () => Promise<void>;
  fetchBlockedSlots: () => Promise<void>;
  fetchHolidays: () => Promise<void>;
  fetchChatConversations: () => Promise<void>;
  updateAppointmentStatus: (appointmentId: string, status: string) => Promise<boolean>;
  addClinic: (clinic: Partial<Clinic>) => Promise<boolean>;
  updateClinic: (clinicId: string, clinic: Partial<Clinic>) => Promise<boolean>;
  deactivateClinic: (clinicId: string) => Promise<boolean>;
  updateProfile: (updates: Partial<Profile>) => Promise<boolean>;
  updateDoctorSocial: (instagram: string, facebook: string) => Promise<boolean>;
  addBlockedSlot: (clinicId: string, date: string, timeSlot: string, reason?: string) => Promise<boolean>;
  removeBlockedSlot: (slotId: string) => Promise<boolean>;
  addHoliday: (clinicId: string, date: string, reason?: string) => Promise<boolean>;
  removeHoliday: (holidayId: string) => Promise<boolean>;
  updateClinicSchedule: (clinicId: string, schedule: ClinicSchedule, slotMinutes: number) => Promise<boolean>;
};

const DoctorContext = createContext<DoctorContextType | undefined>(undefined);

export const useDoctorContext = () => {
  const context = useContext(DoctorContext);
  if (!context) {
    throw new Error('useDoctorContext must be used within DoctorProvider');
  }
  return context;
};

// Provider
export const DoctorProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [doctorData, setDoctorData] = useState<DoctorData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [holidays, setHolidays] = useState<ClinicHoliday[]>([]);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const fetchDoctorData = async () => {
    if (!user) {
      console.log('❌ fetchDoctorData: No user');
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Fetching doctor data for user:', user.id);

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, full_name_ar, avatar_url, phone')
        .eq('id', user.id)
        .single();

      console.log('👤 Profile:', { found: !!profileData, error: profileError });
      if (profileData) setProfile(profileData);

      // Fetch doctor data
      const { data: doctorResult, error: doctorError } = await supabase
        .from('doctors')
        .select('id, specialty_code, is_approved, rating, total_reviews, instagram, facebook, experience_years, graduation_year, bio')
        .eq('user_id', user.id)
        .single();

      console.log('👨‍⚕️ Doctor data:', { found: !!doctorResult, doctorId: doctorResult?.id, error: doctorError });

      if (doctorResult) {
        // Fetch specialty
        const { data: specialtyData } = await supabase
          .from('specialties')
          .select('name_en, name_ar, icon')
          .eq('code', doctorResult.specialty_code)
          .single();

        const newDoctorData = {
          id: doctorResult.id,
          specialty_code: doctorResult.specialty_code,
          is_approved: doctorResult.is_approved,
          rating: doctorResult.rating || 0,
          total_reviews: doctorResult.total_reviews || 0,
          specialty_name: specialtyData?.name_en,
          specialty_name_ar: specialtyData?.name_ar,
          specialty_icon: specialtyData?.icon || '🩺',
          instagram: doctorResult.instagram || null,
          facebook: doctorResult.facebook || null,
          experience_years: doctorResult.experience_years || null,
          graduate_year: doctorResult.graduation_year || null,
          bio: doctorResult.bio || null,
        };
        
        setDoctorData(newDoctorData);
        console.log('✅ Doctor data set:', newDoctorData.id);
      }
    } catch (error) {
      console.error('Error fetching doctor data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch doctor data when user is available
  useEffect(() => {
    if (user) {
      fetchDoctorData();
    }
  }, [user]);

  // Auto-fetch related data when doctorData is available
  useEffect(() => {
    if (doctorData) {
      fetchClinics();
      fetchAppointments(7);
      fetchChatConversations();
    }
  }, [doctorData]);

  // Auto-fetch blocked slots and holidays when clinics are loaded
  useEffect(() => {
    if (doctorData && clinics.length > 0) {
      fetchBlockedSlots();
      fetchHolidays();
    }
  }, [clinics, doctorData]);

  const fetchAppointments = async (lookbackDays: number = 7) => {
    if (!doctorData) {
      console.log('❌ fetchAppointments: No doctorData');
      return;
    }

    try {
      console.log('🔍 Fetching appointments for doctor:', doctorData.id, 'lookbackDays:', lookbackDays);
      const todayDate = new Date();
      const today = todayDate.toISOString().split('T')[0];
      const startDate = new Date(todayDate);
      startDate.setDate(startDate.getDate() - lookbackDays);
      const startStr = startDate.toISOString().split('T')[0];
      
      const futureDate = new Date(todayDate);
      futureDate.setDate(futureDate.getDate() + 30);
      const futureStr = futureDate.toISOString().split('T')[0];

      console.log('📅 Date range:', { startStr, futureStr });

      const { data: appointmentsData, error } = await supabase
        .from('appointments')
        .select('id, appointment_date, time_slot, status, clinic_id, patient_id')
        .eq('doctor_id', doctorData.id)
        .gte('appointment_date', startStr)
        .lte('appointment_date', futureStr)
        .order('appointment_date', { ascending: true });

      if (error) {
        console.error('❌ Appointments query error:', error);
        setAppointments([]);
        return;
      }

      console.log('📊 Appointments query result:', { count: appointmentsData?.length || 0 });

      if (appointmentsData && appointmentsData.length > 0) {
        const patientIds = [...new Set(appointmentsData.map(a => a.patient_id).filter(Boolean))];
        const clinicIds = [...new Set(appointmentsData.map(a => a.clinic_id).filter(Boolean))];

        let patientsMap = new Map();
        if (patientIds.length > 0) {
          const { data: patients } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', patientIds);
          
          patientsMap = new Map(patients?.map(p => [p.id, p]) || []);
        }

        let clinicsMap = new Map();
        if (clinicIds.length > 0) {
          const { data: clinicsList } = await supabase
            .from('clinics')
            .select('id, clinic_name')
            .in('id', clinicIds);
          
          clinicsMap = new Map(clinicsList?.map(c => [c.id, c]) || []);
        }

        const transformed = appointmentsData.map(apt => {
          const patient = patientsMap.get(apt.patient_id) || {};
          const clinic = clinicsMap.get(apt.clinic_id) || {};
          
          return {
            id: apt.id,
            appointment_date: apt.appointment_date,
            appointment_time: apt.time_slot || '09:00',
            status: apt.status || 'pending',
            patient_name: patient.full_name || 'Patient',
            patient_id: apt.patient_id,
            clinic_id: apt.clinic_id,
            clinic_name: clinic.clinic_name || 'Clinic',
            notes: null,
          };
        });

        setAppointments(transformed);
        console.log('✅ Appointments loaded:', transformed.length);
      } else {
        setAppointments([]);
        console.log('ℹ️ No appointments found');
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  const fetchClinics = async () => {
    if (!doctorData) return;

    try {
      const { data: clinicsData } = await supabase
        .from('clinics')
        .select('id, clinic_name, address, consultation_fee, is_active, latitude, longitude, schedule, slot_minutes, mobile, landline, whatsapp')
        .eq('doctor_id', doctorData.id);

      if (clinicsData) setClinics(clinicsData);
    } catch (error) {
      console.error('Error fetching clinics:', error);
    }
  };

  const fetchBlockedSlots = async () => {
    if (!doctorData || clinics.length === 0) {
      console.log('❌ fetchBlockedSlots: No doctorData or clinics', { doctorData: !!doctorData, clinicsCount: clinics.length });
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const clinicIds = clinics.map(c => c.id);
      
      console.log('🔒 Fetching blocked slots for clinics:', clinicIds);

      const { data: blocked, error } = await supabase
        .from('doctor_blocked_slots')
        .select('id, blocked_date, time_slot, reason, clinic_id')
        .in('clinic_id', clinicIds)
        .gte('blocked_date', today);

      console.log('🔒 Blocked slots result:', { count: blocked?.length || 0, error });

      if (blocked) {
        // Deduplicate
        const seen = new Set<string>();
        const deduped = blocked.filter((slot) => {
          const key = `${slot.clinic_id || 'no-clinic'}|${slot.blocked_date}|${slot.time_slot}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setBlockedSlots(deduped);
        console.log('✅ Blocked slots loaded:', deduped.length);
      } else {
        setBlockedSlots([]);
        console.log('ℹ️ No blocked slots found');
      }
    } catch (error) {
      console.error('Error fetching blocked slots:', error);
    }
  };

  const fetchHolidays = async () => {
    if (!doctorData || clinics.length === 0) {
      console.log('❌ fetchHolidays: No doctorData or clinics', { doctorData: !!doctorData, clinicsCount: clinics.length });
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const clinicIds = clinics.map(c => c.id);
      
      console.log('🎉 Fetching holidays for clinics:', clinicIds);

      const { data, error } = await supabase
        .from('clinic_holidays')
        .select('id, clinic_id, holiday_date, reason')
        .in('clinic_id', clinicIds)
        .gte('holiday_date', today)
        .order('holiday_date');

      console.log('🎉 Holidays result:', { count: data?.length || 0, error });

      if (data) {
        setHolidays(data);
        console.log('✅ Holidays loaded:', data.length);
      } else {
        setHolidays([]);
        console.log('ℹ️ No holidays found');
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const fetchChatConversations = async () => {
    if (!doctorData) {
      console.log('❌ fetchChatConversations: No doctorData');
      return;
    }

    try {
      console.log('💬 Fetching chat conversations for user:', user?.id);
      // Fetch conversations where doctor has messages
      const { data: messages, error } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, content, created_at, is_read')
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      console.log('💬 Chat messages result:', { count: messages?.length || 0, error });

      if (!messages || messages.length === 0) {
        setChatConversations([]);
        setUnreadChatCount(0);
        return;
      }

      // Group by patient
      const conversationsMap = new Map<string, any>();
      let totalUnread = 0;

      messages.forEach(msg => {
        const patientId = msg.sender_id === user?.id ? msg.receiver_id : msg.sender_id;
        
        if (!conversationsMap.has(patientId)) {
          conversationsMap.set(patientId, {
            patient_id: patientId,
            last_message: msg.content,
            last_message_time: msg.created_at,
            unread_count: 0,
          });
        }

        // Count unread messages from patients
        if (msg.receiver_id === user?.id && !msg.is_read) {
          const conv = conversationsMap.get(patientId);
          if (conv) {
            conv.unread_count++;
            totalUnread++;
          }
        }
      });

      // Fetch patient names
      const patientIds = Array.from(conversationsMap.keys());
      const { data: patients } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', patientIds);

      const patientsMap = new Map(patients?.map(p => [p.id, p.full_name]) || []);

      const conversations: ChatConversation[] = Array.from(conversationsMap.entries()).map(([patientId, conv]) => ({
        id: patientId,
        patient_id: patientId,
        patient_name: patientsMap.get(patientId) || 'Patient',
        last_message: conv.last_message,
        last_message_time: new Date(conv.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        unread_count: conv.unread_count,
      }));

      setChatConversations(conversations);
      setUnreadChatCount(totalUnread);
    } catch (error) {
      console.error('Error fetching chat conversations:', error);
    }
  };

  const updateAppointmentStatus = async (appointmentId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId);

      if (error) throw error;
      
      // Update local state
      setAppointments(prev => 
        prev.map(apt => apt.id === appointmentId ? { ...apt, status } : apt)
      );
      
      return true;
    } catch (error) {
      console.error('Error updating appointment:', error);
      return false;
    }
  };

  const addClinic = async (clinic: Partial<Clinic>) => {
    if (!doctorData) return false;

    try {
      const { error } = await supabase
        .from('clinics')
        .insert({
          doctor_id: doctorData.id,
          ...clinic,
        });

      if (error) throw error;
      
      await fetchClinics();
      return true;
    } catch (error) {
      console.error('Error adding clinic:', error);
      return false;
    }
  };

  const updateClinic = async (clinicId: string, clinic: Partial<Clinic>) => {
    try {
      const { error } = await supabase
        .from('clinics')
        .update(clinic)
        .eq('id', clinicId);

      if (error) throw error;
      
      await fetchClinics();
      return true;
    } catch (error) {
      console.error('Error updating clinic:', error);
      return false;
    }
  };

  const deactivateClinic = async (clinicId: string) => {
    try {
      const { error } = await supabase
        .from('clinics')
        .update({ is_active: false })
        .eq('id', clinicId);

      if (error) throw error;
      
      await fetchClinics();
      return true;
    } catch (error) {
      console.error('Error deactivating clinic:', error);
      return false;
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  };

  const updateDoctorSocial = async (instagram: string, facebook: string) => {
    if (!doctorData) return false;

    try {
      const { error } = await supabase
        .from('doctors')
        .update({ instagram, facebook })
        .eq('id', doctorData.id);

      if (error) throw error;
      
      setDoctorData(prev => prev ? { ...prev, instagram, facebook } : null);
      return true;
    } catch (error) {
      console.error('Error updating social:', error);
      return false;
    }
  };

  const addBlockedSlot = async (clinicId: string, date: string, timeSlot: string, reason?: string) => {
    if (!doctorData) return false;
    
    try {
      const { error } = await supabase
        .from('doctor_blocked_slots')
        .insert({
          doctor_id: doctorData.id,
          clinic_id: clinicId,
          blocked_date: date,
          time_slot: timeSlot,
          reason: reason || null,
        });

      if (error) throw error;
      
      await fetchBlockedSlots();
      return true;
    } catch (error) {
      console.error('Error adding blocked slot:', error);
      return false;
    }
  };

  const removeBlockedSlot = async (slotId: string) => {
    try {
      const { error } = await supabase
        .from('doctor_blocked_slots')
        .delete()
        .eq('id', slotId);

      if (error) throw error;
      
      await fetchBlockedSlots();
      return true;
    } catch (error) {
      console.error('Error removing blocked slot:', error);
      return false;
    }
  };

  const addHoliday = async (clinicId: string, date: string, reason?: string) => {
    if (!doctorData) return false;
    
    try {
      const { error } = await supabase
        .from('clinic_holidays')
        .insert({
          clinic_id: clinicId,
          holiday_date: date,
          reason: reason || null,
        });

      if (error) throw error;
      
      await fetchHolidays();
      return true;
    } catch (error) {
      console.error('Error adding holiday:', error);
      return false;
    }
  };

  const removeHoliday = async (holidayId: string) => {
    try {
      const { error } = await supabase
        .from('clinic_holidays')
        .delete()
        .eq('id', holidayId);

      if (error) throw error;
      
      await fetchHolidays();
      return true;
    } catch (error) {
      console.error('Error removing holiday:', error);
      return false;
    }
  };

  const updateClinicSchedule = async (clinicId: string, schedule: ClinicSchedule, slotMinutes: number) => {
    try {
      const { error } = await supabase
        .from('clinics')
        .update({ schedule, slot_minutes: slotMinutes })
        .eq('id', clinicId);

      if (error) throw error;
      
      await fetchClinics();
      return true;
    } catch (error) {
      console.error('Error updating schedule:', error);
      return false;
    }
  };

  const value = {
    loading,
    doctorData,
    profile,
    appointments,
    clinics,
    blockedSlots,
    holidays,
    chatConversations,
    unreadChatCount,
    fetchDoctorData,
    fetchAppointments,
    fetchClinics,
    fetchBlockedSlots,
    fetchHolidays,
    fetchChatConversations,
    updateAppointmentStatus,
    addClinic,
    updateClinic,
    deactivateClinic,
    updateProfile,
    updateDoctorSocial,
    addBlockedSlot,
    removeBlockedSlot,
    addHoliday,
    removeHoliday,
    updateClinicSchedule,
  };

  return (
    <DoctorContext.Provider value={value}>
      {children}
    </DoctorContext.Provider>
  );
};
