# Google Maps API Key Setup for EAS Build

## ⚠️ CRITICAL: Replace API Key Before Building

The app.json currently contains a dummy API key that **MUST** be replaced with a real Google Maps API key.

### Current Status:
```
Dummy Key: "AIzaSyDummy_Key_Replace_With_Real_One"
```

### Where to Replace (2 locations in app.json):

1. **In react-native-maps plugin:**
```json
[
  "react-native-maps",
  {
    "useGoogleMaps": true,
    "googleMapsApiKey": "YOUR_REAL_API_KEY_HERE"
  }
]
```

2. **In android.config:**
```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "YOUR_REAL_API_KEY_HERE"
    }
  }
}
```

## 🔧 How to Get Google Maps API Key

### Step 1: Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### Step 2: Create or Select Project
- Create a new project named "CMS App" OR
- Select existing project

### Step 3: Enable Required APIs
Enable these APIs for your project:
1. **Maps SDK for Android** (Required for map display)
2. **Geocoding API** (Required for address lookup)

### Step 4: Create API Key
1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API Key**
3. Copy the generated API key

### Step 5: Restrict API Key (IMPORTANT for security)
1. Click on the created API key to edit it
2. Under "Application restrictions":
   - Select **Android apps**
   - Click **Add an item**
   - Package name: `com.cms.app`
   - SHA-1 certificate fingerprint: (get from EAS)
3. Under "API restrictions":
   - Select **Restrict key**
   - Check: **Maps SDK for Android**
   - Check: **Geocoding API**
4. Save

### Step 6: Get SHA-1 Fingerprint for EAS Build
Run this command:
```bash
eas credentials
```
Select your Android app and copy the SHA-1 fingerprint.

### Step 7: Update app.json
Replace `"AIzaSyDummy_Key_Replace_With_Real_One"` with your real API key in BOTH locations.

## 🧪 Testing Locally
For local development (Expo Go), the app will use a default fallback location if the API key is invalid. However, for production builds, a valid API key is **REQUIRED**.

## 💰 Pricing Note
Google Maps offers a free tier:
- $200 free credit per month
- Maps SDK for Android: Free up to 100,000 loads/month
- Geocoding API: Free up to 40,000 requests/month

This should be more than enough for the CMS app usage.

## 🚨 Build Will Fail Without Valid API Key
If you try to build without replacing the dummy key, the map picker will:
- Show blank maps
- Fail to load tiles
- Not work in production

## ✅ Verification Checklist
Before running `eas build`:
- [ ] Created Google Cloud project
- [ ] Enabled Maps SDK for Android
- [ ] Enabled Geocoding API
- [ ] Created API key
- [ ] Restricted API key to Android app (com.cms.app)
- [ ] Added SHA-1 fingerprint from EAS
- [ ] Replaced dummy key in `app.json` (2 places)
- [ ] Committed changes to git

## 🔗 Useful Links
- [Google Cloud Console](https://console.cloud.google.com/)
- [Maps SDK for Android](https://console.cloud.google.com/marketplace/product/google/maps-android-backend.googleapis.com)
- [Geocoding API](https://console.cloud.google.com/marketplace/product/google/geocoding-backend.googleapis.com)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
