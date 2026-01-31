# 🚀 Quick Start Testing Guide

## Network Issue? No Problem!

If `npm run test:ids` fails with network errors, you can get your IDs manually from Supabase:

---

## Option 1: Get IDs from Supabase Dashboard

### 📋 Step 1: Go to Supabase SQL Editor

1. Open https://supabase.com/dashboard
2. Select your project: **awqywawapwkpfpcxlbcl**
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### 🔍 Step 2: Run These Queries

**Get Doctor IDs:**
```sql
SELECT 
  d.id as doctor_id, 
  d.user_id, 
  p.full_name as doctor_name
FROM doctors d
JOIN profiles p ON d.user_id = p.id
LIMIT 5;
```

**Get Clinic IDs:**
```sql
SELECT 
  id as clinic_id, 
  name as clinic_name, 
  address
FROM clinics
LIMIT 5;
```

**Get Patient IDs:**
```sql
SELECT 
  id as patient_id, 
  full_name, 
  email, 
  phone
FROM profiles
WHERE user_type = 'patient'
LIMIT 5;
```

### ✏️ Step 3: Copy to test-config.js

Open [`scripts/test-config.js`](test-config.js) and fill in:

```javascript
testData: {
  // From first query
  doctorId: 'PASTE_DOCTOR_ID_HERE',
  
  // From second query
  clinicId: 'PASTE_CLINIC_ID_HERE',
  
  // From third query
  patientId: 'PASTE_PATIENT_ID_HERE',
  
  // Additional patients from third query (optional)
  additionalPatientIds: [
    'PATIENT_2_ID',
    'PATIENT_3_ID',
    'PATIENT_4_ID',
  ],
},
```

---

## Option 2: Quick Test Without Configuration

If you just want to test quickly without configuring IDs:

### 📱 Manual Device Testing (Easiest)

1. **Install APK on 3-5 phones**
2. **Sign in as different patients**
3. **All navigate to same doctor**
4. **Try to book same slot simultaneously**
5. **Expected: Only 1 succeeds, others get conflict**

This tests the most important thing: **race condition handling**!

---

## Option 3: Fix Network Issue

If you want to fix the `npm run test:ids` error:

### Check 1: Internet Connection
```bash
ping google.com
```

### Check 2: DNS Resolution
```bash
nslookup awqywawapwkpfpcxlbcl.supabase.co
```

### Check 3: Firewall
- Temporarily disable firewall
- Try running test again

### Check 4: Use Different DNS
```powershell
# Try Google DNS
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses "8.8.8.8","8.8.4.4"

# Or Cloudflare DNS
Set-DnsClientServerAddress -InterfaceAlias "Ethernet" -ServerAddresses "1.1.1.1","1.0.0.1"
```

---

## ✅ After Getting IDs

### Test 1: Heavy Load
```bash
npm run test:heavy
```

### Test 2: Race Condition
```bash
npm run test:race
```

### Test 3: Full Stress Test
```bash
npm run test:stress
```

---

## 🎯 Priority Testing

**If you can only do ONE test:**

### Manual Concurrent Test (Most Important!)

1. Get 3 phones
2. Open app on all 3
3. Navigate to same doctor
4. Select same date and time
5. All tap "Confirm Booking" at the same time
6. **✅ Expected: Only 1 succeeds**
7. **❌ Bug if: Multiple succeed**

This tests the **most critical feature**: preventing double-bookings!

---

## 📊 What Each Test Does

| Test | What It Checks | How Long |
|------|---------------|----------|
| Heavy Load | Database can handle 50+ appointments | 15-30 sec |
| Race Condition | Only 1 booking succeeds from 5 simultaneous | 5 sec |
| Stress Test | Everything together + performance | 1-2 min |
| Manual Device | Real-world concurrent booking behavior | 2 min |

---

## 🐛 Common Issues

### "Cannot connect to Supabase"
- Check internet connection
- Verify Supabase URL in test-config.js
- Try from different network

### "Doctor/Clinic not found"
- Get correct IDs from Supabase dashboard
- Update test-config.js

### "Tests pass but app has issues"
- Always test on **real devices** too
- Emulator behavior ≠ real device behavior
- Network conditions matter

---

## 💡 Pro Tips

1. **Start with manual testing** - Most reliable
2. **Test on real devices** - Catches real issues
3. **Test on slow network** - 3G/2G reveals problems
4. **Clean up test data** - Don't clutter production

---

## 🎉 Ready to Test?

### Minimum Testing Checklist:
- [ ] Manual concurrent booking on 3 devices ✅ (CRITICAL)
- [ ] Real-time sync check (book/cancel/update)
- [ ] Walk-in blocking works
- [ ] Hardware back button works
- [ ] Slow network (3G) still functional

### After These Pass:
- [ ] Run heavy load test
- [ ] Run race condition test
- [ ] Run full stress test
- [ ] Test on different Android versions

---

**Need help?** Check the full guide: [`TESTING-README.md`](TESTING-README.md)
