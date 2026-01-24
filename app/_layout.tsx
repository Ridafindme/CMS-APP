import { Stack } from 'expo-router';
import 'react-native-reanimated';
import { AuthProvider } from '@/lib/AuthContext';
import { I18nProvider } from '@/lib/i18n';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="sign-up-patient" />
            <Stack.Screen name="sign-up-doctor" />
            <Stack.Screen name="(patient-tabs)" />
            <Stack.Screen name="doctor-dashboard" />
            <Stack.Screen name="doctor-profile" />
            <Stack.Screen name="booking" />
          </Stack>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
