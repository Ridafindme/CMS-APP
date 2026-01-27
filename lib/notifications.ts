import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Check if running in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Test local notifications (works in Expo Go)
 */
export async function scheduleTestNotification() {
  try {
    // Request permissions first
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('⚠️ Notification permissions not granted');
      return;
    }

    // Schedule a local notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "📅 Test Notification",
        body: 'This is a test notification from your CMS app!',
        data: { type: 'test' },
        sound: true,
      },
      trigger: { seconds: 2 },
    });

    console.log('✅ Test notification scheduled for 2 seconds from now');
  } catch (error) {
    console.error('Error scheduling test notification:', error);
  }
}

/**
 * Send immediate local notification (works in Expo Go)
 */
export async function sendLocalNotification(title: string, body: string, data?: any) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    
    if (status !== 'granted') {
      console.log('⚠️ Notification permissions not granted');
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null, // immediate
    });

    console.log('✅ Local notification sent');
  } catch (error) {
    console.error('Error sending local notification:', error);
  }
}

/**
 * Register for push notifications and get the Expo push token
 */
export async function registerForPushNotificationsAsync() {
  let token;

  // Skip in Expo Go since push notifications don't work there
  if (isExpoGo) {
    console.log('⚠️ Push notifications are not available in Expo Go. Use a development build instead.');
    return null;
  }

  if (!Device.isDevice) {
    console.log('⚠️ Push notifications require a physical device');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    
    token = (await Notifications.getExpoPushTokenAsync({
      projectId: '071beeff-64f2-4989-8fdf-f7e478d74765',
    })).data;
    console.log('📱 Push token:', token);
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

/**
 * Save the user's push token to the database
 */
export async function savePushToken(userId: string, pushToken: string) {
  try {
    const { error } = await supabase
      .from('user_push_tokens')
      .upsert({
        user_id: userId,
        push_token: pushToken,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('Error saving push token:', error);
    } else {
      console.log('✅ Push token saved');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

/**
 * Send a notification when a new message is received
 */
export async function sendMessageNotification(
  recipientUserId: string,
  senderName: string,
  messageContent: string
) {
  try {
    // Get recipient's push token
    const { data: tokenData } = await supabase
      .from('user_push_tokens')
      .select('push_token')
      .eq('user_id', recipientUserId)
      .single();

    if (!tokenData?.push_token) {
      console.log('No push token for user');
      return;
    }

    // Send notification via Expo Push API
    const message = {
      to: tokenData.push_token,
      sound: 'default',
      title: `💬 ${senderName}`,
      body: messageContent.substring(0, 100),
      data: { type: 'message', userId: recipientUserId },
      categoryIdentifier: 'message',
      priority: 'high',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('📨 Notification sent:', result);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

/**
 * Send appointment reschedule notification to a patient
 */
export async function sendRescheduleNotification(
  patientUserId: string | null,
  doctorName: string,
  newDate: string,
  newTime: string,
  clinicName: string
) {
  if (!patientUserId) {
    console.log('No patient user ID - skipping notification (walk-in patient)');
    return;
  }

  try {
    // Get patient's push token
    const { data: tokenData } = await supabase
      .from('user_push_tokens')
      .select('push_token')
      .eq('user_id', patientUserId)
      .single();

    if (!tokenData?.push_token) {
      console.log('No push token for patient');
      return;
    }

    // Format date nicely
    const date = new Date(newDate);
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });

    // Send notification via Expo Push API
    const message = {
      to: tokenData.push_token,
      sound: 'default',
      title: '📅 Appointment Rescheduled',
      body: `Your appointment with Dr. ${doctorName} has been moved to ${formattedDate} at ${newTime}`,
      data: { 
        type: 'appointment_reschedule', 
        date: newDate,
        time: newTime,
        clinic: clinicName 
      },
      categoryIdentifier: 'appointment',
      priority: 'high',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log('📨 Reschedule notification sent:', result);
  } catch (error) {
    console.error('Error sending reschedule notification:', error);
  }
}

/**
 * Setup notification listeners
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void
) {
  // Skip in Expo Go
  if (isExpoGo) {
    console.log('⚠️ Notification listeners not available in Expo Go');
    return () => {}; // Return empty cleanup function
  }

  // Listener for when notification is received while app is in foreground
  const receivedListener = Notifications.addNotificationReceivedListener(notification => {
    console.log('📬 Notification received:', notification);
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // Listener for when user taps on notification
  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('👆 Notification tapped:', response);
    if (onNotificationResponse) {
      onNotificationResponse(response);
    }
  });

  // Return cleanup function
  return () => {
    receivedListener.remove();
    responseListener.remove();
  };
}
