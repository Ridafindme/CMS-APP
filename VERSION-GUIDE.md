# Version Management Guide

**Current Version:** `0.2.0` (Beta 2)

## When to Update Version

### 🔴 MAJOR version (0 → 1.0.0)
**When:**
- First production release
- Breaking changes to API/data structure
- Complete redesign

**Example:** `0.9.0` → `1.0.0` (Going live!)

---

### 🟡 MINOR version (0.x.0)
**When:**
- New features added
- New screens/tabs
- Major functionality improvements
- Database schema changes

**Example:** `0.2.0` → `0.3.0`

**Triggers:**
- ✅ Added payment integration
- ✅ Added prescription module
- ✅ Added lab results feature
- ✅ Added video consultation
- ✅ Major UI redesign

---

### 🟢 PATCH version (0.2.x)
**When:**
- Bug fixes
- Small improvements
- UI tweaks
- Performance optimizations

**Example:** `0.2.0` → `0.2.1`

**Triggers:**
- ✅ Fixed notification bug
- ✅ Improved loading speed
- ✅ Fixed crash on Android
- ✅ Updated translations

---

## Version History

### 0.2.0 - January 28, 2026
- ✅ Notification system (confirmation, cancellation, reminders)
- ✅ Supabase Edge Function for scheduled reminders
- ✅ Streamlined tabs (removed appointments & calendar)
- ✅ Compact daily schedule design
- ✅ Custom date picker

### 0.1.0 - January 2026
- ✅ Initial development
- ✅ Doctor/Patient authentication
- ✅ Appointment booking
- ✅ Daily schedule view
- ✅ Clinic management
- ✅ Chat system
- ✅ Walk-in support

---

## Quick Reference

**To update version:**
1. Edit `app.json` → `version: "X.Y.Z"`
2. Edit `package.json` → `version: "X.Y.Z"`
3. Add entry to this file
4. Commit with message: `chore: bump version to X.Y.Z`

**Next milestone targets:**
- `0.3.0` - [Define your next major feature]
- `0.9.0` - Release candidate (feature complete)
- `1.0.0` - Production release

---

## Reminders

⚠️ **Update version when:**
- Adding any new screen/feature
- Before sharing beta builds
- After fixing critical bugs
- Before deploying to production

🔔 **Check this file regularly!**
