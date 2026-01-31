# 🧪 CMS App Testing Suite

Complete testing utilities for heavy load testing, stress testing, and race condition simulation.

## 📋 Quick Start

### 1️⃣ Get Your Test IDs

First, retrieve the necessary IDs from your database:

```bash
npm run test:ids
```

This will display all available:
- **Doctors** (with IDs and names)
- **Clinics** (with IDs and addresses)
- **Patients** (with IDs and contact info)

### 2️⃣ Configure Testing

Copy the IDs from step 1 into [`test-config.js`](test-config.js):

```javascript
testData: {
  doctorId: 'abc123-doctor-id',
  clinicId: 'xyz789-clinic-id',
  patientId: 'patient-user-id',
  additionalPatientIds: [
    'patient-2-id',
    'patient-3-id',
    'patient-4-id',
  ],
}
```

### 3️⃣ Run Tests

```bash
# Heavy load test (creates 50+ appointments)
npm run test:heavy

# Race condition test (concurrent bookings)
npm run test:race

# Comprehensive stress test
npm run test:stress
```

---

## 🔬 Available Tests

### 1. Heavy Load Test
**File:** `test-heavy-load.js`  
**Command:** `npm run test:heavy`

**What it does:**
- ✅ Creates 50+ test appointments
- ✅ Tests database performance under load
- ✅ Verifies real-time sync
- ✅ Checks notification delivery
- ✅ Auto-cleanup option

**Example output:**
```
🚀 Starting Heavy Load Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Configuration:
   Appointments: 50
   Doctor ID: abc123...
   Clinic ID: xyz789...

⏳ Creating appointments...
✅ Created 50/50 appointments
⌛ Duration: 12.5 seconds
📈 Average: 4 appointments/sec

✅ Heavy load test complete!
```

---

### 2. Race Condition Test
**File:** `test-race-condition.ts`  
**Command:** `npm run test:race`

**What it does:**
- ⚡ Simulates 5 patients booking same slot simultaneously
- ✅ Verifies only ONE booking succeeds
- ✅ Tests database constraints
- ✅ Checks conflict detection
- ✅ Validates error handling

**Example output:**
```
⚡ Race Condition Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Target slot: 2026-02-01 at 10:00

🏁 Starting 5 concurrent booking attempts...

Results:
✅ Success: 1 booking
❌ Conflicts detected: 4 bookings
⚠️ Database constraint prevented double-booking

✅ Race condition handled correctly!
```

---

### 3. Comprehensive Stress Test
**File:** `stress-test.ts`  
**Command:** `npm run test:stress`

**What it does:**
- 🔥 All tests combined
- 🚀 Heavy load (50+ appointments)
- ⚡ Concurrent bookings (5 simultaneous)
- 🔄 Real-time sync verification
- 📊 Performance metrics
- 🧹 Automatic cleanup

**Example output:**
```
🔥 Comprehensive Stress Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test 1: Heavy Load
✅ Created 50 appointments
⌛ Duration: 12.3s
📈 Rate: 4.1 appts/sec

Test 2: Concurrent Booking
✅ Only 1 booking succeeded
✅ 4 conflicts detected correctly

Test 3: Real-time Sync
✅ Changes propagated in <2s
✅ All devices updated

Test 4: Notification Delivery
✅ 50/50 notifications sent
✅ Average latency: 1.2s

📊 Overall Performance: EXCELLENT
✅ All tests passed!
```

---

## 🎯 Testing Scenarios

### Scenario 1: Database Performance
**Goal:** Test if database handles many appointments

```bash
npm run test:heavy
```

**What to check:**
- ⏱️ Response times stay under 2 seconds
- ✅ All appointments created successfully
- 🔄 Real-time updates work
- 📊 No database errors

---

### Scenario 2: Concurrent Users
**Goal:** Simulate multiple patients booking simultaneously

```bash
npm run test:race
```

**What to check:**
- ✅ Only ONE booking succeeds
- ❌ Others get "Slot Just Booked" error
- 🔄 Real-time sync shows slot as unavailable
- 📱 UI updates immediately

---

### Scenario 3: Complete System Test
**Goal:** Test everything at once

```bash
npm run test:stress
```

**What to check:**
- 🚀 System stays responsive
- 💾 Database doesn't crash
- 🔄 Real-time sync works under load
- 📨 Notifications delivered
- 🧹 Cleanup works correctly

---

## 🛠️ Manual Testing Checklist

### Device Testing (3-5 phones)

**Setup:**
1. Install APK on 3-5 different phones
2. Sign in as different patients on each
3. Navigate to same doctor profile

**Test 1: Race Condition**
```
1. All devices: Select same date (e.g., tomorrow)
2. All devices: Select same time slot (e.g., 10:00 AM)
3. All devices: Tap "Confirm booking" SIMULTANEOUSLY
4. Expected: Only ONE succeeds, others see conflict
```

**Test 2: Real-time Sync**
```
1. Device A: Book a slot (e.g., 2:00 PM)
2. Device B/C/D: Should see that slot turn unavailable
3. Device A: Cancel appointment
4. Device B/C/D: Slot should become available again
5. Expected: Changes appear within 1-2 seconds
```

**Test 3: Walk-in Blocking**
```
1. Doctor device: Create walk-in for 3:00 PM
2. Patient device: Try to book 3:00 PM
3. Expected: Slot shows as unavailable/blocked
```

---

## 📱 Real Device Testing

### Low-End Device Test
**Device:** Tecno Spark (2GB RAM, Android 10)
```
✅ App launches in <3 seconds
✅ Scrolling is smooth
✅ No crashes after 10 minutes
✅ Memory usage stays under 200MB
```

### High-End Device Test
**Device:** Samsung S22 / Pixel 7
```
✅ Buttery smooth performance
✅ Animations at 60fps
✅ Instant response times
```

### Network Tests
```bash
# Test on slow connection
✅ 3G: Bookings work (slow but functional)
✅ 2G: Shows loading states correctly
✅ Offline: Shows appropriate error messages
```

---

## 🧹 Cleanup

### Automatic Cleanup
Tests will ask if you want to clean up:
```
? Clean up test data? (Y/n)
```

### Manual Cleanup
If needed, run SQL in Supabase:

```sql
-- Delete test appointments
DELETE FROM appointments 
WHERE appointment_date >= CURRENT_DATE
  AND doctor_id = 'your-test-doctor-id'
  AND status IN ('pending', 'confirmed');

-- Delete test notifications (optional)
-- Notifications auto-expire, but you can clean them manually
```

---

## 📊 Performance Benchmarks

### Expected Results

| Metric | Target | Excellent |
|--------|--------|-----------|
| Booking response | < 2s | < 1s |
| Real-time sync | < 3s | < 2s |
| Heavy load (50 appts) | < 30s | < 15s |
| Concurrent conflicts | 100% caught | 100% caught |
| Notification delivery | < 5s | < 2s |

### Your Results
Fill this in after testing:

```
Heavy Load Test:
- Total time: _____s
- Appointments/sec: _____
- Errors: _____

Race Condition Test:
- Conflicts detected: _____/5
- Correct winner: YES / NO
- Sync time: _____s

Stress Test:
- Overall status: PASS / FAIL
- Performance: EXCELLENT / GOOD / POOR
```

---

## 🐛 Troubleshooting

### Error: "Supabase connection failed"
```bash
# Check your test-config.js
# Verify supabaseUrl and supabaseAnonKey are correct
```

### Error: "Doctor/Clinic not found"
```bash
# Run npm run test:ids to get correct IDs
# Update test-config.js with real IDs
```

### Tests are slow
```bash
# Normal on first run
# Database needs to warm up
# Run test again - should be faster
```

### Race condition test shows multiple successes
```bash
# ⚠️ CRITICAL BUG! 
# This means double-booking is possible
# Check database unique constraints
# Review booking logic in booking.tsx
```

---

## 🔐 Security Notes

- ⚠️ **Never commit real IDs** to git
- ⚠️ Don't test on production database
- ✅ Use test/staging environment
- ✅ Clean up test data after testing
- ✅ Use test accounts only

---

## 📝 Adding New Tests

### Template for new test script:

```javascript
const { createClient } = require('@supabase/supabase-js');
const config = require('./test-config');

const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

async function myNewTest() {
  console.log('🧪 Starting My New Test\\n');
  
  try {
    // Your test logic here
    
    console.log('✅ Test passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

myNewTest();
```

Add to package.json:
```json
"test:mytest": "node ./scripts/my-new-test.js"
```

---

## 🎓 Testing Best Practices

1. **Start small** → Run test:ids first
2. **Configure once** → Update test-config.js
3. **Test incrementally** → Heavy load → Race → Stress
4. **Clean up** → Always clean test data
5. **Document results** → Fill in the benchmarks table
6. **Test on real devices** → Don't rely on simulator only
7. **Test networks** → Try 3G, WiFi, offline
8. **Monitor console** → Watch for errors in terminal

---

## 📞 Support

If tests fail or show unexpected behavior:
1. Check terminal output for specific errors
2. Verify test-config.js has correct IDs
3. Ensure Supabase is accessible
4. Check database constraints are in place
5. Review appointment booking logic

---

## ✅ Testing Checklist

Before production deployment:

- [ ] Heavy load test passed (50+ appointments)
- [ ] Race condition test passed (only 1 succeeds)
- [ ] Real-time sync works (< 2s delay)
- [ ] Notifications delivered (< 5s)
- [ ] Tested on 3+ devices
- [ ] Tested on slow network (3G)
- [ ] Walk-in blocking works
- [ ] Hardware back button works
- [ ] All UI elements visible on small screens
- [ ] Arabic (RTL) mode works correctly
- [ ] Test data cleaned up

**Ready to build production APK? ✅**
