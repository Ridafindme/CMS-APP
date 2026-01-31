# Medical Clinic Management System - Technical Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Authentication & Authorization](#authentication--authorization)
5. [Core Features Implementation](#core-features-implementation)
6. [File Structure](#file-structure)
7. [State Management](#state-management)
8. [API Integration](#api-integration)
9. [Real-time Features](#real-time-features)
10. [Geolocation & Mapping](#geolocation--mapping)
11. [Internationalization](#internationalization)
12. [Performance Optimization](#performance-optimization)
13. [Build & Deployment](#build--deployment)

---

## System Architecture

### Application Type
- **Platform**: Cross-platform mobile application (iOS & Android)
- **Framework**: React Native with Expo SDK 54
- **Routing**: File-based routing using Expo Router 6
- **Backend**: Supabase (PostgreSQL + Real-time + Storage + Auth)

### Architecture Pattern
- **Frontend**: Component-based architecture with React hooks
- **State Management**: React Context API + Local State
- **Data Flow**: Unidirectional data flow
- **API Communication**: RESTful with real-time subscriptions

### Key Design Patterns
1. **Context Pattern**: Authentication and language contexts
2. **Component Composition**: Reusable UI components
3. **Container/Presentational**: Separation of logic and UI
4. **Custom Hooks**: Reusable stateful logic

---

## Technology Stack

### Core Dependencies
```json
{
  "react": "19.1.0",
  "react-native": "0.81.5",
  "expo": "~54.0.31",
  "typescript": "~5.9.2"
}
```

### Navigation & Routing
```json
{
  "expo-router": "~6.0.21",
  "@react-navigation/native": "^7.1.8",
  "@react-navigation/bottom-tabs": "^7.4.0"
}
```

### Backend & Database
```json
{
  "@supabase/supabase-js": "^2.90.1",
  "@supabase/auth-helpers-react": "^0.14.0"
}
```

### UI & User Experience
```json
{
  "@expo/vector-icons": "^15.0.3",
  "react-native-maps": "1.20.1",
  "expo-image": "~3.0.11",
  "expo-haptics": "~15.0.8"
}
```

### Device Features
```json
{
  "expo-location": "~19.0.8",
  "expo-notifications": "~0.32.16",
  "expo-image-picker": "~17.0.10",
  "expo-device": "~8.0.10"
}
```

### Storage & Persistence
```json
{
  "@react-native-async-storage/async-storage": "2.2.0"
}
```

### Testing
```json
{
  "jest": "^30.2.0",
  "jest-expo": "^54.0.16",
  "@testing-library/react-native": "^13.3.3"
}
```

---

## Database Schema

### Tables & Relationships

#### **profiles** (User Base Table)
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE,
  full_name TEXT,
  full_name_ar TEXT,
  mobile TEXT,
  mobile_local TEXT,
  avatar_url TEXT,
  user_type TEXT CHECK (user_type IN ('patient', 'doctor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **doctors** (Doctor-Specific Data)
```sql
CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  specialty_code TEXT REFERENCES specialties(code),
  specialty_name TEXT,
  specialty_name_ar TEXT,
  specialty_icon TEXT,
  graduation_year INTEGER,
  experience_years INTEGER,
  bio TEXT,
  instagram TEXT,
  facebook TEXT,
  rating DECIMAL(3,2) DEFAULT 0.0,
  total_reviews INTEGER DEFAULT 0,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

#### **specialties** (Medical Specialties Catalog)
```sql
CREATE TABLE specialties (
  code TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  icon TEXT,
  sort_order INTEGER,
  is_active BOOLEAN DEFAULT TRUE
);
```

#### **currencies** (Consultation Currency Registry)
```sql
CREATE TABLE currencies (
  currency_code TEXT PRIMARY KEY,
  currency_name_en TEXT NOT NULL,
  currency_name_ar TEXT NOT NULL,
  currency_symbol TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

> Admins toggle availability by flipping `is_active`. Only active currencies appear inside the doctor dashboard forms.

Seed data ships with USD ($) and LBP (ل.ل.) and can be extended later without code changes.

#### **clinics** (Clinic Locations)
```sql
CREATE TABLE clinics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  mobile TEXT,
  mobile_local TEXT,
  landline TEXT,
  landline_local TEXT,
  whatsapp TEXT,
  whatsapp_local TEXT,
  consultation_fee TEXT,
  consultation_currency TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  schedule JSONB,
  slot_minutes INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Consultation Currency Behavior**

- `consultation_currency` always stores one of the active `currencies.currency_code` values (e.g., `USD`, `LBP`).
- When doctors type a consultation fee inside the clinics screen, the UI auto-picks USD for any numeric value greater than 1000 and LBP otherwise. Doctors can still override the auto-selection via the currency toggle before saving.
- During doctor sign-up we silently apply the same >1000 rule so every newly created clinic persists a consistent currency without exposing the selector upfront.

**Schedule JSONB Structure**:
```json
{
  "mode": "generic" | "day-by-day",
  "default": {
    "start": "09:00",
    "end": "17:00",
    "break_start": "13:00",
    "break_end": "14:00"
  },
  "weekly_off": ["fri", "sat"],
  "sun": { "start": "09:00", "end": "17:00", "break_start": null, "break_end": null },
  "mon": { ... },
  ...
}
```

#### **appointments** (Booking Records)
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES profiles(id),
  doctor_id UUID REFERENCES doctors(id),
  clinic_id UUID REFERENCES clinics(id),
  appointment_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, appointment_date, time_slot)
);
```

#### **blocked_slots** (Unavailable Time Periods)
```sql
CREATE TABLE blocked_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID REFERENCES doctors(id),
  clinic_id UUID REFERENCES clinics(id),
  appointment_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, appointment_date, time_slot)
);
```

#### **holidays** (Special Non-Working Days)
```sql
CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID REFERENCES doctors(id),
  clinic_id UUID REFERENCES clinics(id) NULL,
  date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **messages** (Chat Communications)
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES profiles(id),
  receiver_id UUID REFERENCES profiles(id),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  INDEX idx_messages_conversation (sender_id, receiver_id, created_at)
);
```

#### **countries** (Phone Country Codes)
```sql
CREATE TABLE countries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  code TEXT UNIQUE NOT NULL,
  dial_code TEXT NOT NULL,
  flag_emoji TEXT,
  mobile_format TEXT,
  landline_format TEXT,
  currency_code TEXT,
  currency_name TEXT,
  currency_symbol TEXT
);
```

### Database Indexes
```sql
-- Performance indexes
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id, appointment_date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id, appointment_date);
CREATE INDEX idx_clinics_doctor ON clinics(doctor_id);
CREATE INDEX idx_clinics_location ON clinics USING GIST (ll_to_earth(latitude, longitude));
CREATE INDEX idx_messages_unread ON messages(receiver_id) WHERE is_read = FALSE;
```

### Row Level Security (RLS) Policies

**Profiles Table**:
```sql
-- Users can read all profiles
CREATE POLICY "Public profiles are viewable by everyone" 
  ON profiles FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE USING (auth.uid() = id);
```

**Doctors Table**:
```sql
-- Everyone can view approved doctors
CREATE POLICY "Approved doctors are viewable by everyone" 
  ON doctors FOR SELECT USING (is_approved = true);

-- Doctors can update their own record
CREATE POLICY "Doctors can update own record" 
  ON doctors FOR UPDATE USING (auth.uid() = user_id);
```

**Appointments Table**:
```sql
-- Patients can view their own appointments
CREATE POLICY "Patients can view own appointments" 
  ON appointments FOR SELECT USING (auth.uid() = patient_id);

-- Doctors can view appointments for their clinics
CREATE POLICY "Doctors can view clinic appointments" 
  ON appointments FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM doctors WHERE id = doctor_id)
  );
```

---

## Authentication & Authorization

### Authentication Flow

#### Sign Up (Patient)
```typescript
// app/sign-up-patient.tsx
const { data, error } = await supabase.auth.signUp({
  email: email,
  password: password,
});

if (data.user) {
  // Create profile
  await supabase.from('profiles').insert({
    id: data.user.id,
    email: email,
    full_name: fullName,
    full_name_ar: fullNameAr,
    mobile: phoneE164,
    mobile_local: phoneLocal,
    user_type: 'patient'
  });
}
```

#### Sign Up (Doctor)
```typescript
// app/sign-up-doctor.tsx
// Step 1: User must be authenticated
if (!user) {
  Alert.alert('Sign In Required');
  return;
}

// Step 2: Create doctor profile
const { data: doctorData, error: doctorError } = await supabase
  .from('doctors')
  .insert({
    user_id: user.id,
    specialty_code: formData.specialtyCode,
    graduation_year: parseInt(formData.graduationYear),
    experience_years: parseInt(formData.experienceYears),
    is_approved: false // Requires admin approval
  })
  .select()
  .single();

// Step 3: Create first clinic
await supabase.from('clinics').insert({
  doctor_id: doctorData.id,
  clinic_name: formData.clinicName,
  address: formData.clinicAddress,
  latitude: formData.clinicLatitude,
  longitude: formData.clinicLongitude,
  consultation_fee: formData.consultationFee,
  mobile: formData.mobile,
  is_active: false // Pending approval
});
```

#### Sign In
```typescript
// lib/AuthContext.tsx
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password,
});

if (data.session) {
  // Session stored automatically by Supabase client
  // User context updated
}
```

### Session Management
```typescript
// lib/supabase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### Authorization Context
```typescript
// lib/AuthContext.tsx
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
```

---

## Core Features Implementation

### 1. Appointment Booking System

#### Available Slots Generation
```typescript
// app/booking.tsx
const generateAvailableSlots = (
  schedule: ClinicSchedule,
  date: string,
  slotMinutes: number
): string[] => {
  const dayKey = getDayKey(date); // sun, mon, tue, etc.
  
  // Check if day is off
  if (schedule.weekly_off?.includes(dayKey)) return [];
  
  // Get day schedule (specific or default)
  const daySchedule = schedule[dayKey] || schedule.default;
  if (!daySchedule) return [];
  
  const startMinutes = timeToMinutes(daySchedule.start);
  const endMinutes = timeToMinutes(daySchedule.end);
  const breakStart = timeToMinutes(daySchedule.break_start);
  const breakEnd = timeToMinutes(daySchedule.break_end);
  
  const slots: string[] = [];
  
  for (let minutes = startMinutes; minutes < endMinutes; minutes += slotMinutes) {
    // Skip if in break time
    if (breakStart && breakEnd && minutes >= breakStart && minutes < breakEnd) {
      continue;
    }
    slots.push(minutesToTime(minutes));
  }
  
  return slots;
};
```

#### Booking Conflict Detection
```typescript
// app/booking.tsx
const fetchBookedSlots = async () => {
  // Get booked appointments
  const { data: appointments } = await supabase
    .from('appointments')
    .select('appointment_date, time_slot')
    .eq('clinic_id', clinicId)
    .gte('appointment_date', today)
    .in('status', ['pending', 'confirmed']);
  
  // Get blocked slots
  const { data: blocked } = await supabase
    .from('blocked_slots')
    .select('appointment_date, time_slot')
    .eq('clinic_id', clinicId)
    .gte('appointment_date', today);
  
  // Get holidays
  const { data: holidays } = await supabase
    .from('holidays')
    .select('date')
    .eq('doctor_id', doctorId)
    .or(`clinic_id.eq.${clinicId},clinic_id.is.null`)
    .gte('date', today);
  
  setBookedSlots([...appointments, ...blocked]);
  setClinicHolidays(holidays.map(h => h.date));
};
```

#### Create Appointment
```typescript
// app/booking.tsx
const handleBookAppointment = async () => {
  const { data, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: user.id,
      doctor_id: doctorId,
      clinic_id: clinicId,
      appointment_date: selectedDate,
      time_slot: selectedTime,
      status: 'pending'
    })
    .select()
    .single();
  
  if (!error) {
    // Send notification to doctor
    await sendNotification(doctorId, 'New appointment request');
    router.back();
  }
};
```

### 2. Clinic Schedule Management

#### Schedule Modal (Generic Mode)
```typescript
// app/doctor-dashboard.tsx
const [scheduleDraft, setScheduleDraft] = useState<ClinicSchedule>({
  mode: 'generic',
  default: {
    start: '09:00',
    end: '17:00',
    break_start: '13:00',
    break_end: '14:00'
  },
  weekly_off: ['fri']
});

const handleSaveSchedule = async () => {
  const { error } = await supabase
    .from('clinics')
    .update({
      schedule: scheduleDraft,
      slot_minutes: scheduleSlotMinutes
    })
    .eq('id', selectedClinicForSchedule.id);
  
  if (!error) {
    fetchClinics(); // Refresh
    setShowScheduleModal(false);
  }
};
```

#### Schedule Modal (Day-by-Day Mode)
```typescript
// app/doctor-dashboard.tsx
const updateScheduleDay = (dayKey: DayKey, field: string, value: string) => {
  setScheduleDraft(prev => ({
    ...prev,
    [dayKey]: {
      ...prev[dayKey],
      [field]: value
    }
  }));
};
```

### 3. Real-time Chat System

#### Fetch Conversations
```typescript
// app/doctor-dashboard.tsx
const fetchDoctorChatConversations = async () => {
  const { data: messages } = await supabase
    .from('messages')
    .select(`
      id,
      sender_id,
      receiver_id,
      message,
      created_at,
      sender:profiles!messages_sender_id_fkey(full_name, full_name_ar)
    `)
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false });
  
  // Group by conversation partner
  const conversations = new Map();
  messages.forEach(msg => {
    const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
    if (!conversations.has(partnerId)) {
      conversations.set(partnerId, {
        patient_id: partnerId,
        patient_name: msg.sender.full_name,
        last_message: msg.message,
        last_message_time: formatTime(msg.created_at)
      });
    }
  });
  
  setChatConversations(Array.from(conversations.values()));
};
```

#### Send Message
```typescript
// app/doctor-dashboard.tsx
const sendDoctorMessage = async () => {
  const { error } = await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      receiver_id: selectedChatConversation.patient_id,
      message: newChatMessage.trim()
    });
  
  if (!error) {
    setNewChatMessage('');
    fetchDoctorChatMessages(selectedChatConversation.patient_id);
  }
};
```

### 4. Geolocation & Distance Calculation

#### Get User Location
```typescript
// app/(patient-tabs)/home.tsx
const getUserLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;
  
  const location = await Location.getCurrentPositionAsync({});
  setUserLocation({
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  });
};
```

#### Calculate Distance (Haversine Formula)
```typescript
// app/(patient-tabs)/home.tsx
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};
```

#### Geocoding & Reverse Geocoding
```typescript
// app/doctor-dashboard.tsx
const searchLocation = async () => {
  const results = await Location.geocodeAsync(locationSearchAddress);
  if (results.length > 0) {
    const { latitude, longitude } = results[0];
    setMapRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  }
};

const reverseGeocode = async (latitude: number, longitude: number) => {
  const results = await Location.reverseGeocodeAsync({ latitude, longitude });
  if (results.length > 0) {
    const address = `${results[0].street}, ${results[0].city}, ${results[0].region}`;
    return address;
  }
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
};
```

### 5. Image Upload System

#### Profile Picture Upload
```typescript
// app/doctor-dashboard.tsx
const pickImage = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Camera roll permissions required');
    return;
  }
  
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  
  if (!result.canceled) {
    setSelectedImageUri(result.assets[0].uri);
    setShowAvatarConfirmModal(true);
  }
};

const uploadProfileImage = async (uri: string) => {
  setUploadingImage(true);
  
  // Convert to blob
  const response = await fetch(uri);
  const blob = await response.blob();
  
  // Upload to Supabase Storage
  const fileName = `${user.id}-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(fileName, blob, {
      contentType: 'image/jpeg',
      upsert: true
    });
  
  if (!error) {
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    // Update profile
    await supabase.from('profiles').update({
      avatar_url: publicUrl
    }).eq('id', user.id);
    
    fetchProfile();
  }
  
  setUploadingImage(false);
  setShowAvatarConfirmModal(false);
};
```

### 6. Phone Number Validation

#### E.164 Format Conversion
```typescript
// lib/phone-utils.ts
export const toE164 = (local: string, countryCode: string, dialCode: string): string => {
  const cleaned = local.replace(/\D/g, '');
  
  // Lebanon-specific logic
  if (countryCode === 'LB') {
    if (cleaned.startsWith('961')) {
      return `+${cleaned}`;
    }
    if (cleaned.startsWith('0')) {
      return `+961${cleaned.substring(1)}`;
    }
    return `+961${cleaned}`;
  }
  
  return `${dialCode}${cleaned}`;
};

export const fromE164 = (e164: string, countryCode: string): string => {
  if (!e164) return '';
  
  if (countryCode === 'LB') {
    if (e164.startsWith('+961')) {
      return e164.substring(4); // Remove +961
    }
  }
  
  return e164.replace(/^\+\d{1,3}/, '');
};
```

#### Custom Phone Input Component
```typescript
// components/ui/phone-input.tsx
export default function PhoneInput({
  value,
  onChangeValue,
  type,
  label,
  placeholder,
  icon,
  isRTL
}: PhoneInputProps) {
  const [localValue, setLocalValue] = useState('');
  const [country, setCountry] = useState({ code: 'LB', dialCode: '+961' });
  
  const handleChange = (text: string) => {
    setLocalValue(text);
    const e164 = toE164(text, country.code, country.dialCode);
    onChangeValue(e164, text);
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <View style={styles.countryCode}>
          <Text>{country.dialCode}</Text>
        </View>
        <TextInput
          style={styles.input}
          value={localValue}
          onChangeText={handleChange}
          placeholder={placeholder}
          keyboardType="phone-pad"
        />
      </View>
    </View>
  );
}
```

---

## File Structure

```
cms-app/
├── app/                          # Main application screens (Expo Router)
│   ├── _layout.tsx              # Root layout
│   ├── index.tsx                # Landing/redirect page
│   ├── sign-in.tsx              # Sign in screen
│   ├── sign-up-patient.tsx      # Patient registration
│   ├── sign-up-doctor.tsx       # Doctor application (multi-step)
│   ├── doctor-dashboard.tsx     # Doctor main dashboard (3390 lines)
│   ├── doctor-profile.tsx       # Public doctor profile view
│   ├── booking.tsx              # Appointment booking flow
│   └── (patient-tabs)/          # Patient tab navigation
│       ├── _layout.tsx          # Tab layout
│       ├── home.tsx             # Patient home (doctor search)
│       ├── appointments.tsx     # Patient appointments list
│       ├── chat.tsx             # Patient chat interface
│       └── profile.tsx          # Patient profile
│
├── components/                   # Reusable UI components
│   ├── ui/                      # UI-specific components
│   │   ├── phone-input.tsx      # Custom phone input with country code
│   │   ├── collapsible.tsx      # Collapsible sections
│   │   └── icon-symbol.tsx      # SF Symbols wrapper
│   ├── themed-text.tsx          # Theme-aware text
│   └── themed-view.tsx          # Theme-aware view
│
├── lib/                         # Core libraries & utilities
│   ├── supabase.ts             # Supabase client configuration
│   ├── AuthContext.tsx         # Authentication context provider
│   ├── LanguageContext.tsx     # Language/i18n context
│   ├── phone-utils.ts          # Phone number utilities
│   ├── notifications.ts        # Push notification handlers
│   └── i18n/                   # Internationalization
│       ├── index.ts            # i18n hook & logic
│       ├── en.ts               # English translations
│       └── ar.ts               # Arabic translations
│
├── constants/                   # App-wide constants
│   └── theme.ts                # Color schemes
│
├── assets/                      # Static assets
│   └── images/                 # Image files
│
├── database/                    # Database migrations
│   └── migrations/
│       ├── create_countries_table.sql
│       ├── add_landline_to_clinics.sql
│       └── rename_phone_to_mobile.sql
│
├── app.json                    # Expo configuration
├── eas.json                    # EAS Build configuration
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript configuration
└── jest-setup.js              # Jest test configuration
```

---

## State Management

### Context Providers

#### Authentication Context
```typescript
// lib/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuth = () => useContext(AuthContext);
```

#### Language Context
```typescript
// lib/LanguageContext.tsx
interface LanguageContextType {
  language: 'en' | 'ar';
  isRTL: boolean;
  setLanguage: (lang: 'en' | 'ar') => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useI18n = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useI18n must be used within LanguageProvider');
  return context;
};
```

### Component-Level State Management

#### Doctor Dashboard State
```typescript
// app/doctor-dashboard.tsx
const [activeTab, setActiveTab] = useState<'appointments' | 'schedule' | 'clinics' | 'chat' | 'profile'>('appointments');
const [appointments, setAppointments] = useState<Appointment[]>([]);
const [clinics, setClinics] = useState<Clinic[]>([]);
const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
const [holidays, setHolidays] = useState<Holiday[]>([]);
const [chatConversations, setChatConversations] = useState<Conversation[]>([]);
const [profile, setProfile] = useState<Profile | null>(null);
const [doctorData, setDoctorData] = useState<Doctor | null>(null);
```

---

## API Integration

### Supabase Configuration
```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### Common Query Patterns

#### Fetch with Joins
```typescript
const { data: clinics } = await supabase
  .from('clinics')
  .select(`
    *,
    doctor:doctors!clinics_doctor_id_fkey(
      user:profiles!doctors_user_id_fkey(full_name, full_name_ar, avatar_url),
      specialty_name,
      specialty_name_ar,
      specialty_icon,
      rating,
      total_reviews,
      experience_years
    )
  `)
  .eq('is_active', true)
  .order('created_at', { ascending: false });
```

#### Complex Filtering
```typescript
const { data: appointments } = await supabase
  .from('appointments')
  .select(`
    *,
    patient:profiles!appointments_patient_id_fkey(full_name, full_name_ar),
    clinic:clinics!appointments_clinic_id_fkey(clinic_name, address)
  `)
  .eq('doctor_id', doctorId)
  .gte('appointment_date', startDate)
  .lte('appointment_date', endDate)
  .in('status', ['pending', 'confirmed'])
  .order('appointment_date', { ascending: true })
  .order('time_slot', { ascending: true });
```

#### Upsert Operations
```typescript
const { data, error } = await supabase
  .from('profiles')
  .upsert({
    id: user.id,
    full_name: editName,
    full_name_ar: editNameAr,
    mobile: editPhone,
    updated_at: new Date().toISOString()
  }, {
    onConflict: 'id'
  });
```

---

## Real-time Features

### Real-time Subscriptions
```typescript
// Listen for new messages
const subscription = supabase
  .channel('messages')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `receiver_id=eq.${user.id}`
    },
    (payload) => {
      // New message received
      setChatMessages(prev => [...prev, payload.new]);
      // Show notification
      showNotification(payload.new);
    }
  )
  .subscribe();

// Cleanup
return () => {
  subscription.unsubscribe();
};
```

### Push Notifications
```typescript
// lib/notifications.ts
import * as Notifications from 'expo-notifications';

export const registerForPushNotifications = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    return null;
  }
  
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  
  // Save token to database
  await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);
  
  return token;
};

export const sendNotification = async (userId: string, message: string) => {
  // Fetch user's push token
  const { data } = await supabase
    .from('profiles')
    .select('push_token')
    .eq('id', userId)
    .single();
  
  if (data?.push_token) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: data.push_token,
        title: 'Clinic Management System',
        body: message,
      }),
    });
  }
};
```

---

## Internationalization

### Translation Structure
```typescript
// lib/i18n/en.ts
export const en = {
  common: {
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    // ...
  },
  auth: {
    signIn: 'Sign In',
    signUp: 'Sign Up',
    // ...
  },
  doctorDashboard: {
    title: 'Doctor Dashboard',
    appointments: 'Appointments',
    myClinics: 'My Clinics',
    // ...
  },
  // ...
};
```

### RTL Support
```typescript
// lib/i18n/index.ts
export const useI18n = () => {
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  
  const isRTL = language === 'ar';
  const t = language === 'en' ? en : ar;
  
  return { language, isRTL, setLanguage, t };
};

// Usage in components
const { t, isRTL } = useI18n();

<View style={[styles.row, isRTL && styles.rowReverse]}>
  <Text style={[styles.label, isRTL && styles.textRight]}>
    {t.common.save}
  </Text>
</View>
```

---

## Performance Optimization

### Lazy Loading & Code Splitting
```typescript
// Expo Router automatically code-splits by route
// Each screen is a separate bundle
```

### Image Optimization
```typescript
import { Image } from 'expo-image';

<Image
  source={{ uri: profile.avatar_url }}
  style={styles.avatar}
  contentFit="cover"
  transition={200}
  cachePolicy="memory-disk"
/>
```

### Memoization
```typescript
// Memoize expensive calculations
const filteredClinics = useMemo(() => {
  return clinics.filter(clinic => {
    if (selectedSpecialty && clinic.specialty_code !== selectedSpecialty) {
      return false;
    }
    if (searchQuery && !clinic.clinic_name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  }).sort((a, b) => (a.distance || 0) - (b.distance || 0));
}, [clinics, selectedSpecialty, searchQuery]);

// Memoize callbacks
const handlePress = useCallback(() => {
  router.push(`/booking?clinicId=${clinic.id}`);
}, [clinic.id]);
```

### Pagination
```typescript
// Load more appointments
const [appointmentsLookbackDays, setAppointmentsLookbackDays] = useState(30);

const fetchAppointments = async () => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - appointmentsLookbackDays);
  
  const { data } = await supabase
    .from('appointments')
    .select('*')
    .eq('doctor_id', doctorId)
    .gte('appointment_date', startDate.toISOString().split('T')[0])
    .order('appointment_date', { ascending: false })
    .limit(50);
  
  setAppointments(data);
};

// Load more button
<TouchableOpacity onPress={() => setAppointmentsLookbackDays(prev => prev + 7)}>
  <Text>Load More</Text>
</TouchableOpacity>
```

---

## Build & Deployment

### EAS Build Configuration
```json
// eas.json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "bundler": "metro"
      }
    }
  }
}
```

### Environment Variables
```bash
# .env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Build Commands
```bash
# Development build
npx expo start

# Preview build (APK)
eas build -p android --profile preview

# Production build
eas build -p android --profile production
eas build -p ios --profile production

# Submit to stores
eas submit -p android
eas submit -p ios
```

### App Configuration
```json
// app.json
{
  "expo": {
    "name": "Clinic Management System",
    "slug": "cms-app",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "cmsapp",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/images/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.cmsapp"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.yourcompany.cmsapp",
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-location",
      "expo-image-picker",
      [
        "expo-notifications",
        {
          "icon": "./assets/images/notification-icon.png",
          "color": "#2563EB"
        }
      ]
    ]
  }
}
```

---

## Security Considerations

### Input Validation
```typescript
// Validate email
const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Validate phone number
const isValidPhone = (phone: string) => {
  return /^\+961[3-9]\d{7}$/.test(phone); // Lebanon format
};

// Sanitize input
const sanitizeInput = (input: string) => {
  return input.trim().replace(/[<>]/g, '');
};
```

### SQL Injection Prevention
- Using Supabase parameterized queries
- All queries use `.eq()`, `.in()`, etc. instead of string concatenation

### XSS Prevention
- React Native escapes content by default
- No dangerouslySetInnerHTML equivalent used

### Authentication Token Security
- Tokens stored in AsyncStorage (encrypted on device)
- Auto-refresh implemented
- Logout clears all stored tokens

---

## Testing

### Jest Configuration
```javascript
// jest-setup.js
import '@testing-library/jest-native/extend-expect';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
```

### Unit Test Example
```typescript
// __tests__/phone-utils.test.ts
import { toE164, fromE164 } from '../lib/phone-utils';

describe('Phone Utils', () => {
  test('converts Lebanese mobile to E.164', () => {
    expect(toE164('70123456', 'LB', '+961')).toBe('+96170123456');
  });
  
  test('handles leading zero', () => {
    expect(toE164('070123456', 'LB', '+961')).toBe('+96170123456');
  });
  
  test('converts E.164 back to local', () => {
    expect(fromE164('+96170123456', 'LB')).toBe('70123456');
  });
});
```

---

## Known Technical Limitations

1. **Map Performance**: Large number of markers can slow down MapView
2. **Image Caching**: Profile images may not update immediately
3. **Real-time Limitations**: Supabase real-time has connection limits
4. **Offline Support**: Currently requires internet connection
5. **File Size**: doctor-dashboard.tsx is 3390 lines (needs refactoring)

---

## Future Technical Enhancements

1. **Offline Mode**: Implement offline-first architecture with sync
2. **Code Splitting**: Break down large components
3. **Advanced Search**: Elasticsearch integration
4. **Video Calls**: Telemedicine feature with WebRTC
5. **Analytics**: Firebase Analytics or Mixpanel integration
6. **Error Tracking**: Sentry integration
7. **Performance Monitoring**: React Native Performance monitoring
8. **Automated Testing**: E2E tests with Detox

---

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- ESLint with Expo config
- Functional components with hooks
- Named exports for utilities, default for screens

### Git Workflow
```bash
# Feature branch
git checkout -b feature/appointment-reminders

# Commit messages
git commit -m "feat: add appointment reminder notifications"
git commit -m "fix: resolve timezone issue in booking"
git commit -m "refactor: split doctor dashboard into smaller components"
```

### Component Structure
```typescript
// Component template
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ComponentProps {
  // Props with TypeScript types
}

export default function Component({ prop1, prop2 }: ComponentProps) {
  // State hooks
  const [state, setState] = useState();
  
  // Effect hooks
  useEffect(() => {
    // Side effects
  }, []);
  
  // Event handlers
  const handleEvent = () => {
    // Logic
  };
  
  // Render
  return (
    <View style={styles.container}>
      <Text>Content</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

---

## Contact & Support

For technical questions or contributions, please refer to the project repository or contact the development team.

---

**Document Version**: 1.0  
**Last Updated**: January 26, 2026  
**Total Lines of Code**: ~15,000+  
**Main Technologies**: React Native, Expo, Supabase, TypeScript
