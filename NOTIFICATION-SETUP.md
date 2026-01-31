# Fixing Notifications - Setup Guide

## Issue
Notifications not working because:
1. ❌ `user_push_tokens` table doesn't exist in database
2. ⚠️ No push tokens being saved for users
3. ⚠️ FCM (Firebase Cloud Messaging) not configured (optional but recommended)

## Quick Fix (5 minutes)

### Step 1: Create Database Table
Run this SQL in your Supabase SQL Editor:

```sql
-- Copy and paste content from: database/migrations/create_push_tokens_table.sql
```

Or run directly:
```bash
# Navigate to Supabase dashboard > SQL Editor > New Query
# Paste the content of database/migrations/create_push_tokens_table.sql
# Click "Run"
```

### Step 2: Test Notifications

#### Test Local Notifications (Works immediately):
```typescript
import { sendLocalNotification } from '@/lib/notifications';

// In any screen
await sendLocalNotification(
  'Test Title',
  'Test message body',
  { type: 'test' }
);
```

#### Test Push Tokens Registration:
1. Open app and sign in
2. Check console logs for:
   - `📱 Push token: ExponentPushToken[...]` ✅ Success
   - `⚠️ Push notification registration failed` ❌ Need development build

### Step 3: Verify Database
Check if push tokens are being saved:

```sql
SELECT * FROM user_push_tokens;
```

Should show:
- `user_id`
- `push_token` (starts with "ExponentPushToken[")
- `updated_at`

## Current Notification Status

### ✅ Working:
- Message notifications (when both users have tokens)
- Appointment confirmation (when patient has token)
- Appointment reschedule (when patient has token)
- Appointment cancellation (when patient has token)
- Appointment reminder (when patient has token)

### ⚠️ Partially Working:
- **Local Notifications** - Work in all builds (Expo Go, dev build, production)
- **Push Notifications** - Only work in development/production builds (not Expo Go)

### ❌ Not Implemented:
- Queue status updates
- Lab results ready

## Why Notifications May Not Appear

### 1. No Push Token Saved
**Symptom:** Console shows "No push token for user/patient"

**Solution:**
- User needs to open the app after database table is created
- Restart app to re-register for push notifications
- Check Supabase logs for token save errors

### 2. Using Expo Go
**Symptom:** Console shows "Push notifications are not available in Expo Go"

**Solution:**
- Push notifications don't work in Expo Go
- Use development build: `npx expo run:android`
- Or use local notifications fallback (already implemented for messages)

### 3. Permissions Not Granted
**Symptom:** Notification permission popup dismissed

**Solution:**
```typescript
// Check permission status
import * as Notifications from 'expo-notifications';
const { status } = await Notifications.getPermissionsAsync();
console.log('Permission status:', status);

// Request again if needed
await Notifications.requestPermissionsAsync();
```

### 4. FCM Not Configured
**Symptom:** "Default FirebaseApp is not initialized"

**Solution:**
- This is optional - notifications will still work via Expo Push Service
- For better delivery rates (90%+ vs 70-80%), configure Firebase:
  - Add `google-services.json` (already done)
  - Upload server key to Expo: https://docs.expo.dev/push-notifications/fcm-credentials/

## Testing Notifications

### Test 1: Local Notification (Works in Expo Go)
```typescript
import { scheduleTestNotification } from '@/lib/notifications';
await scheduleTestNotification(); // Shows notification in 2 seconds
```

### Test 2: Chat Message Notification
1. Open app as Doctor A
2. Send message to Patient B
3. Patient B should receive notification (if they have push token)
4. Check console logs for:
   ```
   📨 Attempting to send message notification to: <user_id>
   ✅ Message notification sent successfully
   ```

### Test 3: Appointment Notification
1. Doctor creates appointment for Patient
2. Patient should receive confirmation notification
3. Check console logs for:
   ```
   📨 Attempting to send confirmation notification to: <patient_id>
   ✅ Confirmation notification sent successfully
   ```

## Debugging

### Check Push Token Registration
```typescript
// In AuthContext, check console for:
console.log('📱 Push token:', token); // Should show ExponentPushToken[...]
```

### Check Token in Database
```sql
SELECT 
  user_id, 
  push_token, 
  updated_at 
FROM user_push_tokens 
WHERE user_id = '<your-user-id>';
```

### Check Notification Sending
Look for these logs:
```
📨 Attempting to send message notification to: <user_id>
⚠️ Error fetching push token: [error] // Table doesn't exist
⚠️ No push token for user // User hasn't registered
✅ Message notification sent successfully // Success!
```

### Common Errors

**Error:** `relation "public.user_push_tokens" does not exist`
**Fix:** Run the SQL migration (Step 1 above)

**Error:** `Push notification registration failed: Must use physical device`
**Fix:** Test on a real Android device, not emulator (or use local notifications)

**Error:** `No push token for patient`
**Fix:** 
1. Patient needs to open app and sign in
2. Wait 2-3 seconds for token registration
3. Check `user_push_tokens` table for their entry

## Production Checklist

Before deploying:
- [ ] Run SQL migration to create `user_push_tokens` table
- [ ] Test notifications on development build
- [ ] Verify push tokens being saved in database
- [ ] Configure Firebase FCM (optional but recommended)
- [ ] Test on physical Android device
- [ ] Add notification permission prompt in onboarding flow
- [ ] Monitor Expo push receipt API for delivery confirmation

## Next Steps

1. **Run the SQL migration NOW**
2. Restart your app
3. Sign in and check for push token in console
4. Test sending a message
5. Check if notification appears

Need help? Check console logs and Supabase logs for errors.
