import { useAuth } from '@/lib/AuthContext';
import { useI18n } from '@/lib/i18n';
import { sendMessageNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

type Conversation = {
  id: string;
  doctor_id: string;
  doctor_user_id: string;
  doctor_name: string;
  specialty: string;
  specialty_icon: string;
  clinic_name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
};

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_mine: boolean;
};

type PresenceState = {
  presence_ref: string;
  typing?: boolean;
};

export default function ChatTab() {
  const { user } = useAuth();
  const { t, isRTL } = useI18n();
  const tabBarHeight = useBottomTabBarHeight();
  const flatListRef = useRef<FlatList>(null);
  
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageChannel, setMessageChannel] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  // Clean up message channel when conversation changes or unmounts
  useEffect(() => {
    return () => {
      if (messageChannel) {
        messageChannel.unsubscribe();
      }
    };
  }, [selectedConversation]);

  const fetchConversations = async () => {
    if (!user) return;
    
    try {
      console.log('🔍 Fetching conversations for user:', user.id);
      
      // Step 1: Get appointments for this patient
      const { data: appointments, error: aptError } = await supabase
        .from('appointments')
        .select('id, doctor_id, clinic_id, status')
        .eq('patient_id', user.id)
        .in('status', ['confirmed', 'completed', 'pending']);

      console.log('📅 Appointments:', appointments, aptError);

      if (!appointments || appointments.length === 0) {
        console.log('⚠️ No appointments found');
        setConversations([]);
        setLoading(false);
        return;
      }

      // Step 2: Get unique doctor IDs
      const doctorIds = [...new Set(appointments.map(a => a.doctor_id).filter(Boolean))];
      console.log('👨‍⚕️ Doctor IDs:', doctorIds);

      if (doctorIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Step 3: Fetch doctor details
      const { data: doctors, error: docError } = await supabase
        .from('doctors')
        .select('id, user_id, specialty_code')
        .in('id', doctorIds);

      console.log('👨‍⚕️ Doctors:', doctors, docError);

      if (!doctors || doctors.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Step 4: Fetch profiles for doctor users
      const userIds = doctors.map(d => d.user_id).filter(Boolean);
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      console.log('👤 Profiles:', profiles, profError);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Step 5: Fetch specialties
      const specialtyCodes = [...new Set(doctors.map(d => d.specialty_code).filter(Boolean))];
      const { data: specialties } = await supabase
        .from('specialties')
        .select('code, name_en, name_ar, icon')
        .in('code', specialtyCodes);

      const specialtiesMap = new Map(specialties?.map(s => [s.code, s]) || []);

      // Step 6: Fetch clinics
      const clinicIds = [...new Set(appointments.map(a => a.clinic_id).filter(Boolean))];
      const { data: clinics } = await supabase
        .from('clinics')
        .select('id, clinic_name')
        .in('id', clinicIds);

      const clinicsMap = new Map(clinics?.map(c => [c.id, c]) || []);

      // Step 7: Build conversations
      const conversationsData: Conversation[] = [];
      const seenDoctors = new Set();

      for (const apt of appointments) {
        if (!apt.doctor_id || seenDoctors.has(apt.doctor_id)) continue;
        seenDoctors.add(apt.doctor_id);

        const doctor = doctors.find(d => d.id === apt.doctor_id);
        if (!doctor) continue;

        const profile = profilesMap.get(doctor.user_id);
        const specialty = specialtiesMap.get(doctor.specialty_code);
        const clinic = clinicsMap.get(apt.clinic_id);

        conversationsData.push({
          id: `conv_${user.id}_${doctor.id}`,
          doctor_id: doctor.id,
          doctor_user_id: doctor.user_id,
          doctor_name: profile?.full_name ? `Dr. ${profile.full_name}` : 'Doctor',
          specialty: isRTL ? (specialty?.name_ar || 'متخصص') : (specialty?.name_en || 'Specialist'),
          specialty_icon: specialty?.icon || '🩺',
          clinic_name: clinic?.clinic_name || 'Clinic',
          last_message: isRTL ? 'اضغط لبدء المحادثة' : 'Tap to start chatting',
          last_message_time: '',
          unread_count: 0,
        });
      }

      console.log('💬 Conversations:', conversationsData);
      setConversations(conversationsData);

      // Step 8: Fetch last messages for each conversation
      for (const conv of conversationsData) {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at')
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${conv.doctor_user_id}),and(sender_id.eq.${conv.doctor_user_id},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastMsg) {
          conv.last_message = lastMsg.content.substring(0, 50) + (lastMsg.content.length > 50 ? '...' : '');
          conv.last_message_time = new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      }

      setConversations([...conversationsData]);

    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async (conversation: Conversation) => {
    if (!user) return;

    try {
      // Mark all unread messages from this doctor as read
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', conversation.doctor_user_id)
        .eq('receiver_id', user.id)
        .is('read_at', null);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const fetchMessages = async (conversation: Conversation) => {
    if (!user) return;

    try {
      setError(null);
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${conversation.doctor_user_id}),and(sender_id.eq.${conversation.doctor_user_id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) {
        console.log('Messages error:', error);
        // Messages table might not exist or there's no data yet
        if (error.code === 'PGRST116' || !data) {
          // Table doesn't exist or no permission - show empty messages
          setMessages([]);
          return;
        }
        setError(isRTL ? 'خطأ في تحميل الرسائل' : 'Error loading messages');
        setMessages([]);
        return;
      }

      if (data) {
        setMessages(data.map(msg => ({
          id: msg.id,
          sender_id: msg.sender_id,
          content: msg.content,
          created_at: msg.created_at,
          is_mine: msg.sender_id === user.id,
        })));
      } else {
        setMessages([]);
      }

      // Set up real-time subscription for new messages
      if (messageChannel) {
        messageChannel.unsubscribe();
      }

      console.log('🔔 Setting up real-time for:', user.id, 'and', conversation.doctor_user_id);
      
      const channel = supabase
        .channel(`messages:${user.id}:${conversation.doctor_user_id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          (payload: any) => {
            console.log('📨 New message received:', payload);
            const newMsg: Message = {
              id: payload.new.id,
              sender_id: payload.new.sender_id,
              content: payload.new.content,
              created_at: payload.new.created_at,
              is_mine: payload.new.sender_id === user.id,
            };
            setMessages(prev => [...prev, newMsg]);
            
            // Auto-scroll to new message
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        )
        .subscribe();

      setMessageChannel(channel);

      // Mark messages as read
      await markMessagesAsRead(conversation);

      // Subscribe to typing presence
      const presenceChannel = supabase.channel(`presence:${user.id}:${conversation.doctor_user_id}`, {
        config: { presence: { key: user.id } }
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state = presenceChannel.presenceState() as Record<string, PresenceState[]>;
          const doctorPresence = state[conversation.doctor_user_id];
          setIsTyping(doctorPresence && doctorPresence[0]?.typing === true);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }: { key: string; newPresences: PresenceState[] }) => {
          if (key === conversation.doctor_user_id && newPresences[0]?.typing) {
            setIsTyping(true);
          }
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          if (key === conversation.doctor_user_id) {
            setIsTyping(false);
          }
        })
        .subscribe();

      // Listen for read receipt updates
      const readChannel = supabase
        .channel(`read_receipts:${user.id}:${conversation.doctor_user_id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `sender_id=eq.${user.id}`
          },
          (payload: any) => {
            if (payload.new.read_at) {
              console.log('📖 Message read:', payload.new.id);
              // Update local message to show as read
              setMessages(prev => prev.map(msg => 
                msg.id === payload.new.id ? { ...msg, read_at: payload.new.read_at } : msg
              ));
            }
          }
        )
        .subscribe();

    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    }
  };

  const handleTextChange = (text: string) => {
    setNewMessage(text);

    if (!selectedConversation || !user) return;

    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Broadcast typing status
    const channel = supabase.channel(`presence:${selectedConversation.doctor_user_id}:${user.id}`);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ typing: text.length > 0 });
      }
    });

    // Stop typing after 2 seconds of no input
    const timeout = setTimeout(async () => {
      await channel.track({ typing: false });
      channel.unsubscribe();
    }, 2000);

    setTypingTimeout(timeout);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    setSending(true);
    setError(null);
    const messageContent = newMessage.trim();
    setNewMessage('');

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedConversation.doctor_user_id,
          content: messageContent,
        })
        .select()
        .single();

      if (error) {
        console.log('Send error:', error);
        // If table doesn't exist or other error, show message locally
        if (error.code === 'PGRST116') {
          setError(isRTL ? 'ميزة الرسائل غير متاحة حالياً' : 'Messaging feature is not available yet');
        } else {
          setError(isRTL ? 'فشل إرسال الرسالة' : 'Failed to send message');
        }
        const tempMsg: Message = {
          id: `temp_${Date.now()}`,
          sender_id: user.id,
          content: messageContent,
          created_at: new Date().toISOString(),
          is_mine: true,
        };
        setMessages(prev => [...prev, tempMsg]);
      } else {
        // Send push notification to doctor
        const { data: patientProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        const patientName = patientProfile?.full_name || 'Patient';
        await sendMessageNotification(
          selectedConversation.doctor_user_id,
          patientName,
          messageContent
        );
      }
      // Real-time subscription will add the message automatically

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('Error sending:', error);
      setError(isRTL ? 'حدث خطأ ما' : 'Something went wrong');
    } finally {
      setSending(false);
    }
  };

  const openConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation);
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </View>
    );
  }

  // Chat View
  if (selectedConversation) {
    return (
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.chatContainer}>
          <StatusBar style="light" />
          
          {/* Chat Header */}
          <View style={styles.chatHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setSelectedConversation(null)}
            >
              <Text style={styles.backButtonText}>{isRTL ? '→' : '←'}</Text>
            </TouchableOpacity>
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatHeaderName}>{selectedConversation.doctor_name}</Text>
              <Text style={styles.chatHeaderSpecialty}>
                {selectedConversation.specialty_icon} {selectedConversation.specialty}
              </Text>
            </View>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={{ paddingBottom: 20 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            scrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Text style={styles.emptyMessagesIcon}>💬</Text>
              <Text style={styles.emptyMessagesText}>
                {isRTL ? 'ابدأ المحادثة' : 'Start the conversation'}
              </Text>
              {error && (
                <Text style={styles.errorText}>{error}</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={[
              styles.messageBubble,
              item.is_mine ? styles.myMessage : styles.theirMessage,
              isRTL && { alignSelf: item.is_mine ? 'flex-start' : 'flex-end' }
            ]}>
              <Text style={[
                styles.messageText,
                item.is_mine ? styles.myMessageText : styles.theirMessageText
              ]}>
                {item.content}
              </Text>
              <Text style={[
                styles.messageTime,
                item.is_mine ? styles.myMessageTime : styles.theirMessageTime
              ]}>
                {formatTime(item.created_at)}
                {item.is_mine && (
                  <Text style={styles.readReceipt}>
                    {' '}{(item as any).read_at ? '✓✓' : '✓'}
                  </Text>
                )}
              </Text>
            </View>
          )}
        />

          {/* Error Banner */}
          {error && messages.length > 0 && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          )}

          {/* Input */}
          <View style={[styles.inputContainer, isRTL && styles.rowReverse, { paddingBottom: tabBarHeight }]}>
            <TextInput
              style={[styles.textInput, isRTL && styles.textRight]}
              placeholder={isRTL ? 'اكتب رسالتك...' : 'Type a message...'}
              placeholderTextColor="#9CA3AF"
              value={newMessage}
              onChangeText={handleTextChange}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity 
              style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.sendButtonText}>{isRTL ? '←' : '→'}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Typing Indicator */}
          {isTyping && (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>
                {isRTL ? `${selectedConversation.doctor_name} يكتب...` : `${selectedConversation.doctor_name} is typing...`}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Conversations List
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.textRight]}>
          {isRTL ? 'المحادثات' : 'Messages'}
        </Text>
        <Text style={[styles.headerSubtitle, isRTL && styles.textRight]}>
          {isRTL ? 'تواصل مع أطبائك' : 'Chat with your doctors'}
        </Text>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>
            {isRTL ? 'لا توجد محادثات' : 'No Conversations'}
          </Text>
          <Text style={styles.emptyText}>
            {isRTL 
              ? 'احجز موعد مع طبيب للتمكن من المحادثة'
              : 'Book an appointment with a doctor to start chatting'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          style={styles.conversationsList}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.conversationCard}
              onPress={() => openConversation(item)}
            >
              <View style={[styles.conversationRow, isRTL && styles.rowReverse]}>
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarEmoji}>{item.specialty_icon}</Text>
                </View>
                <View style={[styles.conversationInfo, isRTL && styles.alignRight]}>
                  <Text style={[styles.doctorName, isRTL && styles.textRight]}>{item.doctor_name}</Text>
                  <Text style={[styles.specialty, isRTL && styles.textRight]}>{item.specialty}</Text>
                  <Text style={[styles.lastMessage, isRTL && styles.textRight]} numberOfLines={1}>
                    {item.last_message}
                  </Text>
                </View>
                {item.last_message_time && (
                  <Text style={styles.messageTime}>{item.last_message_time}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  chatContainer: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#6B7280' },
  textRight: { textAlign: 'right' },
  rowReverse: { flexDirection: 'row-reverse' },
  alignRight: { alignItems: 'flex-end' },
  
  header: { backgroundColor: '#2563EB', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 25, borderBottomRightRadius: 25 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  headerSubtitle: { fontSize: 14, color: '#BFDBFE', marginTop: 5 },
  
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 60, marginBottom: 15 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  
  conversationsList: { flex: 1, padding: 15 },
  conversationCard: { backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 10 },
  conversationRow: { flexDirection: 'row', alignItems: 'center' },
  avatarContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarEmoji: { fontSize: 24 },
  conversationInfo: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  specialty: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  lastMessage: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  messageTime: { fontSize: 12, color: '#9CA3AF' },
  
  chatHeader: { backgroundColor: '#2563EB', paddingTop: 50, paddingBottom: 15, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  backButtonText: { fontSize: 20, color: 'white', fontWeight: 'bold' },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  chatHeaderSpecialty: { fontSize: 13, color: '#BFDBFE', marginTop: 2 },
  
  messagesList: { flex: 1 },
  messagesContent: { padding: 15, paddingBottom: 100 },
  emptyMessages: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyMessagesIcon: { fontSize: 50, marginBottom: 10 },
  emptyMessagesText: { fontSize: 16, color: '#6B7280' },
  errorText: { fontSize: 12, color: '#DC2626', marginTop: 15, textAlign: 'center' },
  errorBanner: { backgroundColor: '#FEE2E2', padding: 12, borderTopWidth: 1, borderTopColor: '#FCA5A5' },
  errorBannerText: { fontSize: 12, color: '#DC2626', textAlign: 'center' },
  
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 8 },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: 'white', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 20 },
  myMessageText: { color: 'white' },
  theirMessageText: { color: '#1F2937' },
  messageTimeContainer: { marginTop: 4 },
  myMessageTime: { fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  theirMessageTime: { fontSize: 11, color: '#9CA3AF' },
  
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E5E7EB', alignItems: 'flex-end' },
  textInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16, maxHeight: 100, marginRight: 10 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { backgroundColor: '#93C5FD' },
  sendButtonText: { fontSize: 20, color: 'white', fontWeight: 'bold' },
  
  typingIndicator: { position: 'absolute', bottom: 80, left: 15, backgroundColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  typingText: { fontSize: 12, color: '#6B7280', fontStyle: 'italic' },
  readReceipt: { fontSize: 10, color: 'rgba(255,255,255,0.9)' },
});
