# Stress Testing Guide

## 🚀 Quick Start

1. **Install dependencies** (if not already done):
```bash
npm install ts-node @types/node --save-dev
```

2. **Configure test parameters** in `scripts/stress-test.ts`:
```typescript
const CONFIG = {
  DOCTOR_ID: 'your-doctor-id-here',
  CLINIC_ID: 'your-clinic-id-here',
  PATIENT_ID: 'your-patient-id-here',
  TEST_APPOINTMENTS_COUNT: 50,
  CONCURRENT_REQUESTS: 5,
  CLEANUP_AFTER_TEST: true,
};
```

3. **Get your test IDs**:
   - **Doctor ID**: Check Supabase `doctors` table
   - **Clinic ID**: Check Supabase `clinics` table
   - **Patient ID**: Check Supabase `profiles` table (use your account ID)

4. **Run the stress test**:
```bash
npx ts-node scripts/stress-test.ts
```

## 📋 What Gets Tested

### Test 1: Bulk Appointment Creation
- Creates 50+ appointments rapidly
- Measures database insertion performance
- Tracks average time per appointment
- **Purpose**: Test database write throughput

### Test 2: Concurrent Booking (Race Condition)
- 5 users try to book same slot simultaneously
- Only 1 should succeed
- **Purpose**: Verify database constraints prevent double-booking

### Test 3: Real-time Sync Test
- Sets up subscription listener
- Creates appointment and waits for real-time event
- **Purpose**: Confirm real-time updates work properly

### Test 4: Walk-in Blocking
- Creates walk-in appointment
- Tries to book same slot normally
- **Purpose**: Verify walk-ins block regular bookings

### Test 5: Query Performance
- Runs typical booking screen queries
- Measures response times with data load
- **Purpose**: Identify slow queries under stress

## 🎯 Expected Results

✅ **All tests pass**:
```
Test Results Summary

  ✓ Bulk Appointment Creation
  ✓ Concurrent Booking (Race)
  ✓ Real-time Sync
  ✓ Walk-in Blocking
  ✓ Query Performance

Total: 5/5 tests passed
Duration: 8.5s

🎉 All tests passed!
```

## ⚠️ Troubleshooting

### "Missing configuration" error
→ Edit `scripts/stress-test.ts` and set DOCTOR_ID, CLINIC_ID, PATIENT_ID

### Race condition test fails (multiple bookings succeed)
→ Check database constraint on appointments table:
```sql
ALTER TABLE appointments 
ADD CONSTRAINT appointments_unique_slot 
UNIQUE (doctor_id, clinic_id, appointment_date, time_slot);
```

### Real-time sync fails
→ Check Supabase real-time settings are enabled
→ Verify postgres_changes are enabled on appointments table

### Walk-in test fails
→ walk_in_appointments table may not exist (optional feature)

## 🔧 Advanced Configuration

**Increase test intensity**:
```typescript
const CONFIG = {
  TEST_APPOINTMENTS_COUNT: 100,    // Create 100 appointments
  CONCURRENT_REQUESTS: 10,         // 10 concurrent booking attempts
  CLEANUP_AFTER_TEST: false,       // Keep data for manual inspection
};
```

**Target different clinic/doctor**:
```typescript
const CONFIG = {
  DOCTOR_ID: 'different-doctor-id',
  CLINIC_ID: 'different-clinic-id',
  // ... test different configurations
};
```

## 📊 Performance Benchmarks

**Good performance**:
- Bulk insert: <50ms per appointment
- Query fetch: <500ms with 100+ appointments
- Real-time event: <2s delivery

**Needs optimization**:
- Bulk insert: >100ms per appointment
- Query fetch: >1000ms
- Real-time event: >5s delivery

## 🧹 Cleanup

Test data is automatically cleaned up after tests complete (if `CLEANUP_AFTER_TEST: true`).

Manual cleanup if needed:
```sql
DELETE FROM appointments 
WHERE patient_id = 'your-test-patient-id' 
AND created_at > NOW() - INTERVAL '1 hour';
```

## 🔥 Real-World Testing Scenarios

After automated tests pass, perform these manual tests:

1. **Multi-device real-time test**:
   - Open app on 3 phones
   - All view same doctor's schedule
   - Book appointment on phone 1
   - Verify phones 2 & 3 see slot disappear instantly

2. **Network interruption test**:
   - Start booking appointment
   - Enable airplane mode mid-booking
   - Verify graceful error handling

3. **Memory leak test**:
   - Navigate to booking screen
   - Select dates/times for 5 minutes straight
   - Check if app slows down or crashes

4. **Race condition manual test**:
   - 2 phones, same wifi
   - Both select same slot
   - Both tap "Confirm" simultaneously
   - Verify only 1 succeeds

## 📱 Production Monitoring

After stress testing, monitor these in production:

- **Supabase Dashboard**: Connection count, query performance
- **Expo Notifications**: Delivery rate and latency
- **Error logs**: Watch for booking failures
- **User reports**: Pay attention to "slot was just booked" messages

---

**Ready to stress test!** 🧪

Run: `npx ts-node scripts/stress-test.ts`
