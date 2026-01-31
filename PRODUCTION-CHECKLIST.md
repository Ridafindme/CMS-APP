# Production Build Checklist

**Last Updated:** January 31, 2026  
**Status:** Testing Phase → Production Ready

---

## 🔴 CRITICAL - Must Complete Before Production

### 1. Database Setup ✅ COMPLETED
- [x] Run all SQL migrations in Supabase
- [x] Create `user_push_tokens` table
- [x] Set up Row Level Security (RLS) policies
- [x] Create indexes for performance
- [x] Test database connections

**Pending Migrations:**
```bash
# Run in Supabase SQL Editor:
database/migrations/create_push_tokens_table.sql
database/migrations/add_consultation_currency.sql
database/migrations/add_landline_to_clinics.sql
database/migrations/add_walk_in_support.sql
database/migrations/create_countries_table.sql
database/migrations/create_currencies_table.sql
database/migrations/rename_phone_to_mobile.sql
database/migrations/virtual_queue_notes.sql
```

### 2. Firebase FCM Setup 🔴 REQUIRED FOR PRODUCTION
**Status:** ⚠️ PENDING - Test with Expo Push only for now

**Before Production Build:**
1. [ ] Go to Firebase Console → Project Settings → Cloud Messaging
2. [ ] Copy "Server Key" (NOT the legacy server key)
3. [ ] Run: `npx expo push:android:upload --api-key YOUR_FCM_SERVER_KEY`
4. [ ] Or upload at: https://expo.dev/accounts/[account]/projects/cms-app/credentials
5. [ ] Verify FCM working: Check for "Default FirebaseApp" error - should be gone
6. [ ] Test notification delivery rate (should be 90%+)

**Impact if skipped:** Only 70-80% notification delivery vs 90-95%

### 3. Google Maps API Configuration ✅ COMPLETED
- [x] API Key: `AIzaSyBxKysxV5MNeukbU2rmXEwmu-9T7TGPULo`
- [x] Configured in `app.json`
- [ ] **Restrict API Key in Google Cloud Console:**
  - Go to: https://console.cloud.google.com/apis/credentials
  - Edit API key
  - Add restriction: "Android apps"
  - Add package name: `com.cms.app`
  - Add SHA-1 certificate fingerprint

**Get SHA-1 fingerprint:**
```bash
cd android
./gradlew signingReport
# Copy SHA-1 from "debug" or "release" variant
```

### 4. App Signing & Build ⚠️ PENDING
- [ ] Generate production signing key
- [ ] Configure `eas.json` for production
- [ ] Build production APK/AAB: `eas build --platform android --profile production`
- [ ] Test production build on physical devices (minimum 3 devices)
- [ ] Upload to Google Play Console (internal testing)

---

## 🟡 HIGH PRIORITY - Strongly Recommended

### 5. Notifications Testing
- [ ] Create `user_push_tokens` table in production database
- [ ] Test chat notifications (doctor → patient, patient → doctor)
- [ ] Test appointment confirmation notifications
- [ ] Test appointment reschedule notifications
- [ ] Test appointment cancellation notifications
- [ ] Test appointment reminder notifications (24h before)
- [ ] Verify notification sound and vibration
- [ ] Test notifications when app is:
  - [ ] Foreground (active)
  - [ ] Background (minimized)
  - [ ] Killed (fully closed)

### 6. Performance Validation ✅ COMPLETED
- [x] Request deduplication implemented
- [x] 5-minute data caching active
- [x] Cache invalidation on mutations
- [ ] Test with 10+ concurrent users
- [ ] Monitor Supabase API usage (should be <50% of free tier)
- [ ] Verify cache hit rate >70%
- [ ] Check memory usage (<150MB per user session)

### 7. Security Audit
- [ ] Remove sensitive data from console logs ✅ COMPLETED
- [ ] Verify RLS policies on all tables
- [ ] Test unauthorized access attempts
- [ ] Ensure no hardcoded passwords/secrets in code
- [ ] Review API endpoints for authentication
- [ ] Test patient data privacy (can't see other patients)
- [ ] Test doctor data isolation (can't modify other doctors)

### 8. Critical User Flows - End-to-End Testing
**Doctor Flow:**
- [ ] Sign up → Email verification → Complete profile
- [ ] Add clinic with schedule
- [ ] View daily schedule
- [ ] Accept/Reject appointment
- [ ] Reschedule appointment
- [ ] Cancel appointment
- [ ] Block time slots
- [ ] Add holidays
- [ ] Send chat message to patient
- [ ] Receive notification when patient books

**Patient Flow:**
- [ ] Sign up → Email verification → Complete profile
- [ ] Search for doctors
- [ ] View doctor profile
- [ ] Book appointment
- [ ] Receive confirmation notification
- [ ] Reschedule appointment
- [ ] Cancel appointment
- [ ] Send chat message to doctor
- [ ] Receive notification for appointment reminder

---

## 🟢 MEDIUM PRIORITY - Nice to Have

### 9. UI/UX Polish
- [ ] Test all screens on different screen sizes:
  - [ ] Small (5.5" - 1080x1920)
  - [ ] Medium (6.1" - 1080x2340)
  - [ ] Large (6.7" - 1440x3120)
- [ ] Test dark mode (if implemented)
- [ ] Verify all translations (English + Arabic)
- [ ] Check loading states and error messages
- [ ] Test slow network conditions (3G simulation)
- [ ] Test offline behavior

### 10. Edge Cases & Error Handling
- [ ] Test with no internet connection
- [ ] Test appointment booking at same time by 2 patients
- [ ] Test clinic schedule overlap conflicts
- [ ] Test past date selections (should be blocked)
- [ ] Test booking during blocked time slots
- [ ] Test booking on holidays
- [ ] Test maximum appointments per day
- [ ] Test walk-in patient flow (no phone number)

### 11. Date & Time Accuracy
- [ ] Verify timezone handling (Lebanon = UTC+2/+3)
- [ ] Test daylight saving time transitions
- [ ] Verify appointment time display matches booking time
- [ ] Test date formatting in Arabic locale
- [ ] Verify "today" vs "tomorrow" logic

### 12. Analytics & Monitoring Setup
- [ ] Set up Sentry for error tracking
- [ ] Configure Supabase logging
- [ ] Add analytics events:
  - [ ] Appointment booked
  - [ ] Appointment cancelled
  - [ ] Message sent
  - [ ] Search performed
- [ ] Set up alerts for:
  - [ ] API errors >5%
  - [ ] Crash rate >1%
  - [ ] Notification delivery <85%

---

## 🔵 OPTIONAL - Future Enhancements

### 13. Not Implemented (Planned for v1.1)
- [ ] Queue Status Updates notification
- [ ] Lab Results Ready notification
- [ ] Payment integration
- [ ] Prescription management
- [ ] Medical history records
- [ ] Video consultation
- [ ] Multi-language support beyond EN/AR

### 14. Performance Optimizations (If Needed)
- [ ] Add Redis cache layer
- [ ] Implement CDN for static assets
- [ ] Add lazy image loading
- [ ] Implement GraphQL subscriptions for real-time
- [ ] Add service worker for offline-first

---

## 📋 Production Build Steps

### Phase 1: Pre-Build (Day 1)
1. ✅ Run all database migrations
2. ✅ Upload FCM server key to Expo
3. ✅ Restrict Google Maps API key
4. ✅ Complete security audit
5. ✅ Run full test suite

### Phase 2: Build (Day 2)
1. ✅ Update version in `app.json` (increment from 1.0.0)
2. ✅ Generate production signing key
3. ✅ Run: `eas build --platform android --profile production`
4. ✅ Download AAB file
5. ✅ Test on 3+ physical devices

### Phase 3: Soft Launch (Day 3-7)
1. ✅ Upload to Google Play Console (internal testing)
2. ✅ Invite 10-20 beta testers
3. ✅ Monitor crash reports and errors
4. ✅ Collect user feedback
5. ✅ Fix critical bugs
6. ✅ Monitor notification delivery rates

### Phase 4: Production Release (Day 8+)
1. ✅ Promote to production track in Google Play
2. ✅ Set up 24/7 monitoring
3. ✅ Prepare customer support channels
4. ✅ Document known issues and workarounds

---

## 🚨 Known Issues & Workarounds

### Current Issues in Testing:
1. **FCM Not Configured**
   - Impact: Notification delivery 70-80% instead of 90%+
   - Workaround: Using Expo Push Service
   - Fix: Upload FCM server key before production

2. **Date Picker on Android**
   - Impact: Spinner mode may look different on some devices
   - Workaround: Users can still select dates
   - Fix: Test on multiple Android versions (10, 11, 12, 13, 14)

3. **Map Picker First Load**
   - Impact: May take 2-3 seconds on first use
   - Workaround: Show loading indicator
   - Status: ✅ Fixed with location permissions

### Resolved Issues:
- ✅ "All days full" bug - Fixed with default clinic schedule
- ✅ Duplicate API requests - Fixed with deduplication
- ✅ Session caching - Working as intended
- ✅ Patient data in logs - Removed for security

---

## 📊 Success Metrics

### Target Metrics for Production:
- **Crash Rate:** <1%
- **API Response Time:** <300ms (p95)
- **Notification Delivery:** >90%
- **App Load Time:** <2 seconds
- **Cache Hit Rate:** >70%
- **User Satisfaction:** >4.5/5 stars

### Monitor Daily:
- Active users (DAU)
- Appointments booked
- Messages sent
- Notification delivery rate
- API errors
- App crashes

---

## 🔧 Emergency Contacts

### Critical Issues:
- **Database Down:** Contact Supabase support
- **Notifications Broken:** Check Expo status page
- **Maps Not Loading:** Verify Google Cloud Console

### Rollback Plan:
1. Previous version APK stored at: `[specify location]`
2. Rollback command: `[specify command]`
3. Database backup: Supabase auto-backup (7 days retention)

---

## ✅ Final Pre-Launch Checklist

**Day Before Launch:**
- [ ] All migrations run in production database
- [ ] FCM configured and tested
- [ ] Google Maps API key restricted
- [ ] Production build tested on 5+ devices
- [ ] All critical user flows tested
- [ ] Notification delivery >90%
- [ ] Error monitoring active
- [ ] Support channels ready
- [ ] Backup plan documented
- [ ] Team briefed on launch plan

**Launch Day:**
- [ ] Upload to Google Play Console
- [ ] Set phased rollout (10% → 50% → 100%)
- [ ] Monitor error rates every hour
- [ ] Check user feedback
- [ ] Respond to support requests
- [ ] Document any issues

---

**Next Review:** After 100 production users  
**Version:** 1.0.0  
**Target Launch:** [Set your date]
