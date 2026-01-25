import { Tabs, usePathname } from 'expo-router';
import React, { useEffect } from 'react';
import { Platform, Text, BackHandler, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PatientTabsLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  
  useEffect(() => {
    // Only handle back button on main tab screens
    const mainPaths = ['/home', '/appointments', '/chat', '/profile'];
    const isMainTab = mainPaths.includes(pathname);
    
    if (!isMainTab) return;
    
    const backAction = () => {
      Alert.alert(
        'Exit App',
        'Use Sign Out from the Profile tab to exit properly.',
        [
          {
            text: 'OK',
            style: 'cancel'
          }
        ]
      );
      return true; // Prevent exit
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backHandler.remove();
  }, [pathname]);
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 5,
          paddingTop: 8,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ fontSize: 24 }}>{focused ? '🏠' : '🏘️'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Appointments',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ fontSize: 24 }}>{focused ? '📅' : '📆'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ fontSize: 24 }}>{focused ? '💬' : '💭'}</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ fontSize: 24 }}>{focused ? '👤' : '👥'}</Text>
          ),
        }}
      />
    </Tabs>
  );
}
