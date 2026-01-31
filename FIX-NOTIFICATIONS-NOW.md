# Fix Notifications - Quick Guide

## What's Working Now ✅
1. **Real-time sync** - Appointments update immediately ✅
2. **Appointment time fixed** - Shows correct time instead of 9:00 AM ✅  
3. **Tab switching** - Data refreshes when you switch tabs ✅

## What's NOT Working ❌
- **Push Notifications** - Firebase initialization error

## The Problem
Your development build has Firebase embedded but Firebase is not initialized. This causes:
```
⚠️ Push notification registration failed: FirebaseApp is not initialized
🔔 Push token registration result: FAILED
⚠️ No push token for doctor
```

## Quick Fix (2 options)

### Option 1: Build New APK with EAS (RECOMMENDED)
```bash
# 1. Commit changes
git add .
git commit -m "Remove Firebase dependency"

# 2. Build new development APK
eas build --profile development --platform android

# 3. Download and install the new APK
# This will take 10-15 minutes
```

### Option 2: Test with Expo Go (NO PUSH NOTIFICATIONS)
```bash
# Press 's' in the terminal to switch to Expo Go
s

# Then scan the QR code with Expo Go app
# NOTE: Push notifications won't work, only local notifications
```

## What Will Work After New Build
✅ Push token registration
✅ Push notifications to doctor when patient books
✅ Push notifications to patient when doctor approves/rejects
✅ Notification to patient when doctor cancels appointment
✅ Real-time appointment sync (already working!)

## Testing After New Build

### 1. Check Push Token Registration
After installing new APK, sign in and check console:
```
👤 User logged in, attempting to register push token
📱 Push token: ExponentPushToken[xxxxxx]  <- Should see this!
💾 Attempting to save push token
✅ Push token saved successfully
```

### 2. Test Patient Books Appointment
Patient side:
```
📨 Sending notification to doctor
✅ Notification sent to doctor
```

Doctor side should receive:
```
🔔 New Appointment Booked
Patient Name has booked an appointment...
```

### 3. Test Doctor Approves
Doctor side:
```
✅ Approve button pressed
📝 Updating appointment status
📨 Attempting to send confirmation notification
✅ Confirmation notification sent
```

Patient side should receive:
```
✅ Appointment Confirmed
Your appointment with Dr. Name is confirmed...
```

## Why This Happened
- `app.json` had `googleServicesFile` pointing to Firebase
- Development build included Firebase native code
- Firebase was never initialized in the app
- Expo Push Notifications tried to use Firebase but failed

## What I Changed
1. Removed `googleServicesFile` from app.json
2. Fixed `appointment_time` → `time_slot` mapping
3. Enhanced real-time sync with forceRefresh
4. Added comprehensive logging

## Next Steps
1. **Build new APK with EAS** (or wait for me to guide you)
2. Install new APK on your device
3. Test notifications
4. Once working, you can add FCM later for 90%+ delivery rate

---

## Alternative: Add FCM Properly (Later)

If you want FCM for better delivery:

1. Get `google-services.json` from Firebase Console
2. Place in project root
3. Add back to app.json:
   ```json
   "googleServicesFile": "./google-services.json"
   ```
4. Upload FCM server key to Expo:
   ```bash
   npx expo push:android:upload --api-key YOUR_FCM_KEY
   ```
5. Build new APK
6. Push notifications will have 90-95% delivery instead of 70-80%

---

## Summary
- **Real-time sync**: ✅ Working now
- **Appointment times**: ✅ Fixed  
- **Push notifications**: ❌ Need new build
- **Solution**: Run `eas build --profile development --platform android`
