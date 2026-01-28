import { useAuth } from '@/lib/AuthContext';
import { useDoctorContext } from '@/lib/DoctorContext';
import { useI18n } from '@/lib/i18n';
import { sendMessageNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

type ChatMessage = {
  id: string;
  content: string;
  created_at: string;
  is_mine: boolean;
};

export default function DoctorChatScreen() {
  const { t, isRTL } = useI18n();
  const { user } = useAuth();
  const { 
    loading, 
    chatConversations, 
    doctorData, 
    fetchChatConversations 
  } = useDoctorContext();
  
  const [refreshing, setRefreshing] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (doctorData) {
      fetchChatConversations();
    }
  }, [doctorData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchChatConversations();
    setRefreshing(false);
  };

  const fetchMessages = async (patientId: string) => {
    if (!user) return;

    setLoadingMessages(true);
    try {
      console.log('📨 Fetching messages between:', user.id, 'and', patientId);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${patientId}),and(sender_id.eq.${patientId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      console.log('📨 Messages result:', { count: data?.length || 0, error });
      if (error) throw error;

      const formatted = (data || []).map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        created_at: msg.created_at,
        is_mine: msg.sender_id === user.id,
      }));

      setChatMessages(formatted);
    } catch (error) {
      console.error('Fetch messages error:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    setSendingMessage(true);
    try {
      console.log('📤 Sending message from:', user.id, 'to:', selectedConversation.patient_id);
      const messageContent = newMessage.trim();
      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: selectedConversation.patient_id,
        content: messageContent,
      });

      if (error) throw error;

      // Send push notification to patient
      const { data: doctorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      
      const doctorName = doctorProfile?.full_name ? `Dr. ${doctorProfile.full_name}` : 'Doctor';
      await sendMessageNotification(
        selectedConversation.patient_id,
        doctorName,
        messageContent
      );

      setNewMessage('');
      await fetchMessages(selectedConversation.patient_id);
    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert(t.common.error, isRTL ? 'فشل إرسال الرسالة' : 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const selectConversation = async (conv: any) => {
    setSelectedConversation(conv);
    await fetchMessages(conv.patient_id);
    // Mark messages as read
    await markMessagesAsRead(conv.patient_id);
  };

  const markMessagesAsRead = async (patientId: string) => {
    if (!user) return;

    try {
      // Mark all messages from this patient to the doctor as read
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', patientId)
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking messages as read:', error);
      } else {
        console.log('✅ Messages marked as read');
        // Refresh conversations to update unread count
        fetchChatConversations();
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const goBackToList = () => {
    setSelectedConversation(null);
    setChatMessages([]);
    fetchChatConversations();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {!selectedConversation ? (
        <>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, isRTL && styles.textRight]}>
              {isRTL ? 'الرسائل' : 'Messages'}
            </Text>
            <Text style={[styles.headerSubtitle, isRTL && styles.textRight]}>
              {isRTL 
                ? `${chatConversations.length} محادثة` 
                : `${chatConversations.length} conversations`}
            </Text>
          </View>

          <ScrollView 
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          >
            {chatConversations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>💬</Text>
                <Text style={styles.emptyTitle}>
                  {isRTL ? 'لا توجد رسائل حالياً' : 'No messages yet'}
                </Text>
                <Text style={styles.emptyText}>
                  {isRTL ? 'ستظهر رسائل المرضى هنا' : 'Patient messages will appear here'}
                </Text>
              </View>
            ) : (
              chatConversations.map((conv) => (
                <TouchableOpacity 
                  key={conv.id}
                  style={styles.conversationCard}
                  onPress={() => selectConversation(conv)}
                >
                  <View style={[styles.conversationRow, isRTL && styles.rowReverse]}>
                    <View style={styles.avatarContainer}>
                      <Text style={styles.avatarEmoji}>👤</Text>
                    </View>
                    <View style={[styles.conversationInfo, isRTL && styles.alignRight]}>
                      <Text style={[styles.conversationPatientName, isRTL && styles.textRight]}>
                        {conv.patient_name}
                      </Text>
                      <Text style={[styles.lastMessage, isRTL && styles.textRight]} numberOfLines={1}>
                        {conv.last_message}
                      </Text>
                    </View>
                    {conv.last_message_time && (
                      <Text style={styles.messageTime}>{conv.last_message_time}</Text>
                    )}
                    {conv.unread_count > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{conv.unread_count}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      ) : (
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.chatHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={goBackToList}
            >
              <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.chatHeaderTitle, isRTL && styles.textRight]}>
              {selectedConversation.patient_name}
            </Text>
          </View>

          <View style={styles.chatBody}>
            <ScrollView
              style={styles.messagesContainer}
              contentContainerStyle={{ paddingTop: 12, paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {loadingMessages ? (
                <View style={styles.centered}>
                  <ActivityIndicator color="#2563EB" />
                </View>
              ) : chatMessages.length === 0 ? (
                <View style={styles.emptyChat}>
                  <Text style={styles.emptyChatText}>
                    {isRTL ? 'لا توجد رسائل بعد' : 'No messages yet'}
                  </Text>
                </View>
              ) : (
                chatMessages.map((msg) => (
                  <View 
                    key={msg.id}
                    style={[
                      styles.messageBubble,
                      msg.is_mine ? styles.myMessage : styles.theirMessage,
                    ]}
                  >
                    <Text style={[
                      styles.messageText,
                      msg.is_mine ? styles.myMessageText : styles.theirMessageText
                    ]}>
                      {msg.content}
                    </Text>
                    <Text style={[
                      styles.messageTimeText,
                      msg.is_mine ? styles.myMessageTime : styles.theirMessageTime
                    ]}>
                      {new Date(msg.created_at).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={[styles.inputRow, isRTL && styles.rowReverse]}>
              <TextInput
                style={[styles.textInput, isRTL && styles.textRight]}
                placeholder={isRTL ? 'اكتب رسالة...' : 'Type a message...'}
                placeholderTextColor="#9CA3AF"
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity 
                style={[styles.sendBtn, (!newMessage.trim() || sendingMessage) && styles.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!newMessage.trim() || sendingMessage}
              >
                {sendingMessage ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#6B7280', fontSize: 16 },
  header: {
    backgroundColor: '#2563EB',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
  headerSubtitle: { fontSize: 16, color: '#BFDBFE' },
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 60, marginBottom: 15 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  conversationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  conversationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 24 },
  conversationInfo: { flex: 1 },
  conversationPatientName: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  lastMessage: { fontSize: 14, color: '#6B7280' },
  messageTime: { fontSize: 12, color: '#9CA3AF' },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  chatHeader: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    gap: 12,
  },
  backButton: { padding: 4 },
  chatHeaderTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1 },
  messagesContainer: { flex: 1, paddingHorizontal: 16, paddingBottom: 80, backgroundColor: '#F9FAFB' },
  emptyChat: { alignItems: 'center', marginTop: 40 },
  emptyChatText: { fontSize: 16, color: '#9CA3AF' },
  messageBubble: { 
    maxWidth: '75%', 
    marginBottom: 12, 
    padding: 12, 
    borderRadius: 16 
  },
  myMessage: { 
    alignSelf: 'flex-end', 
    backgroundColor: '#2563EB', 
    borderBottomRightRadius: 4 
  },
  theirMessage: { 
    alignSelf: 'flex-start', 
    backgroundColor: '#fff', 
    borderBottomLeftRadius: 4 
  },
  messageText: { fontSize: 15, marginBottom: 4 },
  myMessageText: { color: '#fff' },
  theirMessageText: { color: '#1F2937' },
  messageTimeText: { fontSize: 11 },
  myMessageTime: { color: '#BFDBFE' },
  theirMessageTime: { color: '#9CA3AF' },
  chatBody: { flex: 1, backgroundColor: '#F9FAFB', paddingBottom: 80 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: '#2563EB',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  textRight: { textAlign: 'right' },
  alignRight: { alignItems: 'flex-end' },
  rowReverse: { flexDirection: 'row-reverse' },
});
