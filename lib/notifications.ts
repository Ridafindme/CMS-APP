import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
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
        ...(Platform.OS === 'android' && {
          color: '#2563EB',
        }),
      },
      trigger: { 
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2 
      },
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

  try {
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
        projectId: '6f3bb877-4b6d-4669-a005-acf4f7fd4d49',
      })).data;
      console.log('📱 Push token:', token);
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  } catch (error: any) {
    console.log('⚠️ Push notification registration failed (this is OK - FCM not configured):', error.message);
    // Return null instead of throwing - app will work without push notifications
    return null;
  }
}

/**
 * Save the user's push token to the database
 */
export async function savePushToken(userId: string, pushToken: string) {
  try {
    console.log('💾 Attempting to save push token for user:', userId);
    console.log('📱 Token:', pushToken);
    
    const { data, error } = await supabase
      .from('user_push_tokens')
      .upsert({
        user_id: userId,
        push_token: pushToken,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      })
      .select();

    if (error) {
      console.error('❌ Error saving push token:', error);
      throw error;
    } else {
      console.log('✅ Push token saved successfully:', data);
    }
  } catch (error) {
    console.error('❌ Save push token exception:', error);
    throw error;
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
    console.log('📨 Attempting to send message notification to:', recipientUserId);
    
    // Get recipient's push token
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('push_token')
      .eq('user_id', recipientUserId)
      .single();

    if (tokenError) {
      console.log('⚠️ Error fetching push token:', tokenError.message);
    }

    if (!tokenData?.push_token) {
      console.log('⚠️ No push token for user - using local notification fallback');
      // Fallback to local notification if user is active in app
      await sendLocalNotification(
        `💬 ${senderName}`,
        messageContent.substring(0, 100),
        { type: 'message', userId: recipientUserId }
      );
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
    
    if (result.data?.status === 'ok') {
      console.log('✅ Message notification sent successfully');
    } else {
      console.log('⚠️ Notification response:', result);
    }
  } catch (error) {
    console.error('❌ Error sending message notification:', error);
    // Try local notification as fallback
    try {
      await sendLocalNotification(
        `💬 ${senderName}`,
        messageContent.substring(0, 100),
        { type: 'message', userId: recipientUserId }
      );
    } catch (localError) {
      console.error('Local notification fallback also failed:', localError);
    }
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
    
    if (result.data?.status === 'ok') {
      console.log('✅ Reschedule notification sent successfully');
    } else {
      console.log('⚠️ Reschedule notification response:', result);
    }
  } catch (error) {
    console.error('❌ Error sending reschedule notification:', error);
  }
}

/**
 * Send appointment confirmation notification to a patient
 */
export async function sendAppointmentConfirmationNotification(
  patientUserId: string | null,
  doctorName: string,
  appointmentDate: string,
  timeSlot: string,
  clinicName: string
) {
  if (!patientUserId) {
    console.log('No patient user ID - skipping notification (walk-in patient)');
    return;
  }

  try {
    console.log('📨 Attempting to send confirmation notification to:', patientUserId);
    
    // Get patient's push token
    const { data: tokenData } = await supabase
      .from('user_push_tokens')
      .select('push_token')
      .eq('user_id', patientUserId)
      .single();

    if (!tokenData?.push_token) {
      console.log('⚠️ No push token for patient');
      return;
    }

    // Format date nicely
    const date = new Date(appointmentDate);
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });

    // Send notification via Expo Push API
    const message = {
      to: tokenData.push_token,
      sound: 'default',
      title: '✅ Appointment Confirmed',
      body: `Your appointment with Dr. ${doctorName} is confirmed for ${formattedDate} at ${timeSlot} - ${clinicName}`,
      data: { 
        type: 'appointment_confirmation', 
        date: appointmentDate,
        time: timeSlot,
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
    console.log('✅ Confirmation notification sent:', result);
  } catch (error) {
    console.error('❌ Error sending confirmation notification:', error);
  }
}

/**
 * Send new appointment booking notification to a doctor
 */
export async function sendNewAppointmentNotificationToDoctor(
  doctorUserId: string,
  patientName: string,
  appointmentDate: string,
  timeSlot: string,
  clinicName: string
) {
  try {
    console.log('📨 Attempting to send new appointment notification to doctor:', doctorUserId);
    
    // Get doctor's push token
    const { data: tokenData } = await supabase
      .from('user_push_tokens')
      .select('push_token')
      .eq('user_id', doctorUserId)
      .single();

    if (!tokenData?.push_token) {
      console.log('⚠️ No push token for doctor');
      return;
    }

    // Format date nicely
    const date = new Date(appointmentDate);
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });

    // Send notification via Expo Push API
    const message = {
      to: tokenData.push_token,
      sound: 'default',
      title: '🔔 New Appointment Booked',
      body: `${patientName} has booked an appointment on ${formattedDate} at ${timeSlot} - ${clinicName}`,
      data: { 
        type: 'new_appointment', 
        date: appointmentDate,
        time: timeSlot,
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
    
    if (result.data?.status === 'ok') {
      console.log('✅ New appointment notification sent to doctor successfully');
    } else {
      console.log('⚠️ Doctor notification response:', result);
    }
  } catch (error) {
    console.error('❌ Error sending new appointment notification to doctor:', error);
  }
}

/**
 * Send appointment cancellation notification to a patient
 */
export async function sendAppointmentCancellationNotification(
  patientUserId: string | null,
  doctorName: string,
  appointmentDate: string,
  timeSlot: string,
  clinicName: string,
  reason?: string
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
    const date = new Date(appointmentDate);
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });

    const bodyText = reason 
      ? `Your appointment with Dr. ${doctorName} on ${formattedDate} at ${timeSlot} has been cancelled. Reason: ${reason}`
      : `Your appointment with Dr. ${doctorName} on ${formattedDate} at ${timeSlot} has been cancelled. Please contact the clinic for more details.`;

    // Send notification via Expo Push API
    const message = {
      to: tokenData.push_token,
      sound: 'default',
      title: '❌ Appointment Cancelled',
      body: bodyText,
      data: { 
        type: 'appointment_cancellation', 
        date: appointmentDate,
        time: timeSlot,
        clinic: clinicName,
        reason: reason || '' 
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
    console.log('📨 Cancellation notification sent:', result);
  } catch (error) {
    console.error('Error sending cancellation notification:', error);
  }
}

/**
 * Send appointment reminder notification (call this 24 hours before appointment)
 */
export async function sendAppointmentReminderNotification(
  patientUserId: string | null,
  doctorName: string,
  appointmentDate: string,
  timeSlot: string,
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
    const date = new Date(appointmentDate);
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });

    // Send notification via Expo Push API
    const message = {
      to: tokenData.push_token,
      sound: 'default',
      title: '⏰ Appointment Reminder',
      body: `Reminder: You have an appointment with Dr. ${doctorName} tomorrow at ${timeSlot} - ${clinicName}`,
      data: { 
        type: 'appointment_reminder', 
        date: appointmentDate,
        time: timeSlot,
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
    console.log('📨 Reminder notification sent:', result);
  } catch (error) {
    console.error('Error sending reminder notification:', error);
  }
}

/**
 * Send notification to doctor when patient cancels appointment
 */
export async function sendPatientCancellationNotificationToDoctor(
  doctorUserId: string,
  patientName: string,
  appointmentDate: string,
  timeSlot: string,
  clinicName: string
) {
  try {
    console.log('📨 Attempting to send patient cancellation notification to doctor:', doctorUserId);
    
    // Get doctor's push token
    const { data: tokenData } = await supabase
      .from('user_push_tokens')
      .select('push_token')
      .eq('user_id', doctorUserId)
      .single();

    if (!tokenData?.push_token) {
      console.log('⚠️ No push token for doctor');
      return;
    }

    // Format date nicely
    const date = new Date(appointmentDate);
    const formattedDate = date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });

    // Send notification via Expo Push API
    const message = {
      to: tokenData.push_token,
      sound: 'default',
      title: '❌ Appointment Cancelled by Patient',
      body: `${patientName} cancelled their appointment on ${formattedDate} at ${timeSlot} - ${clinicName}`,
      data: { 
        type: 'patient_cancellation', 
        date: appointmentDate,
        time: timeSlot,
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
    
    if (result.data?.status === 'ok') {
      console.log('✅ Patient cancellation notification sent to doctor successfully');
    } else {
      console.log('⚠️ Doctor notification response:', result);
    }
  } catch (error) {
    console.error('❌ Error sending patient cancellation notification to doctor:', error);
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
