# Check Notifications Status

## Step 1: Verify Push Tokens Are Being Saved

Run this SQL in Supabase SQL Editor:

```sql
SELECT 
  user_id, 
  push_token, 
  created_at,
  updated_at 
FROM user_push_tokens
ORDER BY updated_at DESC;
```

**Expected result:** You should see rows with:
- Your doctor's user_id
- Your patient's user_id  
- Valid push tokens starting with `ExponentPushToken[...]`

**If empty:** Push tokens are NOT being registered. Check console logs.

---

## Step 2: Check Console Logs

### When app opens (both doctor and patient):
```
📱 Push token: ExponentPushToken[xxxxxxxxxxxxxx]
✅ Push token saved
```

**If you see "⚠️ Push notifications are not available in Expo Go":**
- You're using Expo Go (push notifications don't work)
- Solution: Use development build instead

---

## Step 3: Test Notification Sending

### Test 1: Patient Books Appointment

**Patient side console logs should show:**
```
📨 Sending notification to doctor: <doctor-user-id>
✅ Notification sent to doctor
```

**Doctor side should receive:**
- Push notification: "🔔 New Appointment Booked"
- "Patient Name has booked an appointment..."

**If notification not received but logs show "✅ sent":**
- Push token exists but notification delivery failed
- Check if you're on a real device (not emulator)
- Check notification permissions on device

---

### Test 2: Doctor Approves/Rejects Appointment

**Doctor side console logs should show:**
```
✅ Approve button pressed for: <appointment-id>
📝 Updating appointment status to confirmed...
✅ Appointment status updated
📨 Attempting to send confirmation notification to: <patient-id>
✅ Confirmation notification sent
```

**Patient side should receive:**
- Push notification: "✅ Appointment Confirmed" or "❌ Appointment Cancelled"

---

## Step 4: Troubleshooting

### Issue: "⚠️ No push token for user/doctor"

**Cause:** User hasn't opened the app after database table was created

**Solution:**
1. Close and reopen app
2. Sign out and sign in again
3. Check console for push token registration
4. Verify token in database

---

### Issue: Notifications sent but not received

**Possible causes:**

1. **Using emulator instead of real device**
   - Push notifications don't work reliably on emulators
   - Test on physical Android device

2. **Notification permissions not granted**
   - Check device settings → Apps → Your App → Notifications
   - Should be enabled

3. **App in background or closed**
   - Notifications should still appear
   - If not, check device battery optimization settings

4. **Expo Push Service issue**
   - Check Expo Push Receipt API for delivery status
   - May need to configure FCM for better delivery

---

### Issue: "relation 'user_push_tokens' does not exist"

**Cause:** SQL migration not run

**Solution:**
1. Go to Supabase Dashboard
2. SQL Editor → New Query
3. Paste content from `database/migrations/create_push_tokens_table.sql`
4. Click Run
5. Restart app

---

## What Should Be Working Now

✅ **Patient books appointment** → Doctor receives notification  
✅ **Doctor approves appointment** → Patient receives notification  
✅ **Doctor rejects appointment** → Patient receives notification  
✅ **Doctor cancels appointment** → Patient receives notification  
✅ **Real-time updates** → Appointments sync immediately in daily schedule  
✅ **Chat messages** → Recipient receives notification  

---

## Next Steps for Production

Before going to production, you should:

1. **Configure Firebase FCM** for 90-95% delivery rate
   - Current: 70-80% with Expo Push only
   - See: PRODUCTION-CHECKLIST.md

2. **Test on multiple devices**
   - Different Android versions
   - Different manufacturers (Samsung, Xiaomi, etc.)

3. **Monitor notification delivery**
   - Check Expo Push Receipt API
   - Track delivery failures

4. **Add notification preference settings**
   - Let users enable/disable notifications
   - Different notification types

---

## Quick Debug Commands

Check if push tokens exist:
```sql
SELECT COUNT(*) FROM user_push_tokens;
```

Get specific user's token:
```sql
SELECT * FROM user_push_tokens WHERE user_id = 'YOUR-USER-ID';
```

Delete all tokens (if you want to reset):
```sql
DELETE FROM user_push_tokens;
```

Test local notification (add to any screen):
```typescript
import { scheduleTestNotification } from '@/lib/notifications';
await scheduleTestNotification();
```
