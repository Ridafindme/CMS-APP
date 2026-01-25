# CMS App - Manual Testing Checklist

Quick 10-minute test before each release.

## ✅ Before Starting
- [ ] App starts without crashes: `npx expo start`
- [ ] No console errors on startup

---

## 🩺 Doctor Flow (5 minutes)

### 1. Login
- [ ] Open app → Navigate to Sign In
- [ ] Email: testdoctor@test.com | Password: Test123!
- [ ] Click Sign In → Should reach Doctor Dashboard

### 2. Create/View Clinic
- [ ] On dashboard → Click "Clinics" tab
- [ ] Create new clinic OR view existing clinics
- [ ] Verify clinic shows in list

### 3. Check Appointments
- [ ] Click "Appointments" tab
- [ ] Verify appointments load (or show "No appointments")

**✅ Pass if:** Login works, can view dashboard, no crashes

---

## 👨‍⚕️ Patient Flow (5 minutes)

### 1. Login
- [ ] Logout from doctor account
- [ ] Sign in as patient OR sign up new patient
- [ ] Should reach Patient Home screen

### 2. Search & Book
- [ ] Search for a doctor (by name or specialty)
- [ ] Click on doctor → View profile
- [ ] Click "Book Appointment" button
- [ ] Select date & time → Confirm booking
- [ ] Check "My Appointments" tab → Should see booking

**✅ Pass if:** Can search, book appointment, view appointments

---

## 🚨 Critical Bugs Check (2 minutes)

- [ ] App doesn't crash on startup
- [ ] Login works for both doctor & patient
- [ ] Can create/view clinics
- [ ] Can book appointments
- [ ] No white screen / blank pages
- [ ] Navigation works (back buttons, tabs)

---

## 📝 Notes Section

**Date Tested:** __________  
**Tested By:** __________

**Issues Found:**
1. _________________________________
2. _________________________________
3. _________________________________

**Status:** ☐ Ready to Deploy  |  ☐ Bugs Found - Fix First

---

## 💡 Tips

- Test on both Android & iOS if possible
- Test with actual Supabase connection
- Clear app cache if weird behavior: `npx expo start --clear`
- Check Supabase dashboard for data consistency

**Time Required:** ~10-15 minutes per release
**Frequency:** Before every production deployment
