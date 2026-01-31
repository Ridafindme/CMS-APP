# EAS Build Checklist for CMS App

## ✅ Pre-Build Configuration

### 1. **Location & Maps Setup** (CRITICAL - ALREADY CONFIGURED ✅)
The app uses both `expo-location` and `react-native-maps` for clinic location selection.

#### Required Packages (Already Installed):
- ✅ `expo-location@19.0.8`
- ✅ `react-native-maps@1.20.1`
- ✅ Location permissions in `app.json`

#### App.json Configuration (✅ CONFIGURED):
```json
"plugins": [
  [
    "expo-location",
    {
      "locationAlwaysAndWhenInUsePermission": "Allow CMS to use your location to find nearby clinics."
    }
  ],
  [
    "react-native-maps",
    {
      "useGoogleMaps": true,
      "googleMapsApiKey": "AIzaSyDummy_Key_Replace_With_Real_One"
    }
  ]
]
```

#### Android Config (✅ CONFIGURED):
```json
"android": {
  "permissions": [
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_COARSE_LOCATION"
  ],
  "config": {
    "googleMaps": {
      "apiKey": "AIzaSyDummy_Key_Replace_With_Real_One"
    }
  }
}
```

### 2. **Google Maps API Key** ⚠️ ACTION REQUIRED
**IMPORTANT**: Replace the dummy API key in BOTH places in `app.json`:
1. In the `react-native-maps` plugin config
2. In the `android.config.googleMaps` section

**How to get API key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Maps SDK for Android"
4. Enable "Geocoding API" (for reverse geocoding)
5. Go to "Credentials" → "Create Credentials" → "API Key"
6. Restrict the key to Android apps with your package name: `com.cms.app`
7. Replace `"AIzaSyDummy_Key_Replace_With_Real_One"` in both places

### 3. **Map Picker Implementation** (✅ PRODUCTION READY)
The map picker in `clinics.tsx` is configured correctly:
- ✅ Uses `MapView` from `react-native-maps`
- ✅ Proper error handling with `expo-location`
- ✅ Fallback to default location if GPS fails
- ✅ Reverse geocoding for address lookup
- ✅ Three location selection methods: GPS, Map, Manual

### 4. **Date Picker Setup** (✅ CONFIGURED)
- ✅ `@react-native-community/datetimepicker@8.4.4` installed
- ✅ Plugin configured in `app.json`
- ✅ Used in patient profile for date of birth selection

### 5. **Other Dependencies** (✅ ALL INSTALLED)
All critical dependencies are installed:
- ✅ `@supabase/supabase-js` - Database
- ✅ `expo-auth-session` - Google/Apple OAuth
- ✅ `expo-notifications` - Push notifications
- ✅ `expo-image-picker` - Profile pictures
- ✅ `react-native-maps` - Location selection

## 🚀 Build Commands

### Development Build:
```bash
eas build --profile development --platform android
```

### Preview Build:
```bash
eas build --profile preview --platform android
```

### Production Build:
```bash
eas build --profile production --platform android
```

## 🔍 Common Build Issues & Solutions

### Issue 1: "react-native-maps" build fails
**Solution:**
- Ensure Google Maps API key is set in `app.json`
- Plugin must be in the plugins array
- Run `eas build:configure` to regenerate config

### Issue 2: Location permissions denied
**Solution:**
- Check `android.permissions` array in `app.json`
- Ensure both `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` are present

### Issue 3: DateTimePicker crashes
**Solution:**
- Plugin already configured: `"@react-native-community/datetimepicker"`
- No additional config needed for Android

## 📱 Testing After Build

1. **Test Location Picker:**
   - Go to Clinics → Add Clinic
   - Try all three location options:
     - ✅ Use Current Location
     - ✅ Pick on Map (opens full-screen map)
     - ✅ Manual Address Entry

2. **Test Date Picker:**
   - Go to Profile → Edit Profile
   - Click on "Date of Birth" field
   - Spinner picker should appear with theme colors

3. **Test Map View:**
   - Ensure map loads without crashes
   - Tap on map to select location
   - Verify reverse geocoding works (address shows)

## 🎯 Build Optimization

### Current Version: 0.3.0

### Features Included:
- ✅ Default clinic schedule (9 AM - 5 PM) on creation
- ✅ Enhanced location picker with map
- ✅ Patient profile with DOB and gender
- ✅ Gradient back buttons on modals
- ✅ Compact edit profile modal
- ✅ Improved welcome screen design

### App Size Optimization:
- All dependencies are production-ready
- No dev dependencies in bundle
- Maps and location are lazy-loaded

## 🔐 Environment Variables

### Required for Build:
- Google Maps API Key (in `app.json`)
- Supabase URL (hardcoded in `lib/supabase.ts`)
- Supabase Anon Key (hardcoded in `lib/supabase.ts`)

### Optional:
- Push notification credentials (configured separately)

## 📝 Pre-Build Checklist

Before running `eas build`:

- [ ] Google Maps API key added to `app.json`
- [ ] Version number updated in both `package.json` and `app.json`
- [ ] All code committed to git
- [ ] Tested on Expo Go (if possible)
- [ ] Reviewed permissions in `app.json`
- [ ] Checked EAS project ID is correct

## 🛠️ Troubleshooting

### If build fails with "MapView" error:
1. Check `app.json` has `react-native-maps` plugin
2. Verify API key is properly set (no placeholder text)
3. Run: `npx expo prebuild --clean` locally to test

### If location permission errors:
1. Verify permissions array in `app.json`
2. Check expo-location plugin config
3. Ensure permission strings are descriptive

### If date picker issues:
1. Plugin should be: `"@react-native-community/datetimepicker"`
2. No additional config needed
3. Component is properly imported in profile.tsx

## 🎉 Ready to Build!

Everything is configured. Just make sure to:
1. **Add your Google Maps API key**
2. Run: `eas build --profile production --platform android`
3. Monitor build logs for any issues

Good luck with your build! 🚀
