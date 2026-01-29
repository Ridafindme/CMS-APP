import { useAuth } from '@/lib/AuthContext';
import { useDoctorContext } from '@/lib/DoctorContext';
import { useI18n } from '@/lib/i18n';
import { sendMessageNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Linking,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ChatMessage = {
  id: string;
  content: string;
  created_at: string;
  is_mine: boolean;
};

export default function DoctorChatScreen() {
  const { t, isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const tabBarOffset = 60 + insets.bottom;
  const { user } = useAuth();
  const { 
    loading, 
    chatConversations, 
    doctorData,
    profile,
    fetchChatConversations 
  } = useDoctorContext();
  
  const [refreshing, setRefreshing] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const doctorDisplayName = profile?.full_name || (isRTL ? 'طبيب' : 'Doctor');
  const unreadTotal = chatConversations.reduce((sum: number, conv: any) => sum + (conv.unread_count || 0), 0);

  const filteredConversations = chatConversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      conv.patient_name?.toLowerCase().includes(query) ||
      conv.last_message?.toLowerCase().includes(query)
    );
  });

  const getPatientInitials = (name?: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '??';
  };

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

  const handleContactPatient = async () => {
    const phone = selectedConversation?.patient_phone;
    if (!phone) {
      Alert.alert(
        isRTL ? 'الهاتف غير متوفر' : 'Phone unavailable',
        isRTL ? 'لا يوجد رقم هاتف لهذا المريض.' : 'This patient does not have a phone number on file.'
      );
      return;
    }

    const telLink = `tel:${phone.replace(/\s+/g, '')}`;
    try {
      const supported = await Linking.canOpenURL(telLink);
      if (supported) {
        await Linking.openURL(telLink);
      } else {
        Alert.alert(
          isRTL ? 'لا يمكن إجراء المكالمة' : 'Unable to place call',
          isRTL ? 'يرجى التحقق من إعدادات الهاتف.' : 'Please check the device phone settings.'
        );
      }
    } catch (error) {
      console.error('Call error:', error);
      Alert.alert(
        isRTL ? 'تعذر الاتصال' : 'Call failed',
        isRTL ? 'حدث خطأ أثناء محاولة الاتصال.' : 'Something went wrong while trying to call.'
      );
    }
  };

  const handleComposerAction = () => {
    Alert.alert(
      isRTL ? 'قريباً' : 'Coming soon',
      isRTL ? 'أدوات الدردشة السريعة ستتوفر قريباً.' : 'Chat quick actions will be available soon.'
    );
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
    <View style={[styles.container, { paddingBottom: tabBarOffset }]}>
      <StatusBar style="light" />
      
      {!selectedConversation ? (
        <>
          <LinearGradient colors={[ '#1E3A8A', '#1D4ED8' ]} style={styles.hero}>
            <View style={[styles.heroContent, isRTL && styles.rowReverse]}>
              <View style={[styles.heroTextBlock, isRTL && styles.alignRight]}>
                <Text style={styles.heroEyebrow}>{isRTL ? 'مساحة الدردشة' : 'Conversation Hub'}</Text>
                <Text style={[styles.heroTitle, isRTL && styles.textRight]}>
                  {isRTL ? `مرحباً ${doctorDisplayName}` : `Welcome, ${doctorDisplayName}`}
                </Text>
                <Text style={[styles.heroSubtitle, isRTL && styles.textRight]}>
                  {isRTL ? 'إبقَ على اتصال فوري مع مرضاك وراجع أحدث الرسائل.' : 'Stay close to your patients and review every conversation at a glance.'}
                </Text>
              </View>
              <View style={styles.heroStatCard}>
                <View style={styles.heroStatGroup}>
                  <Text style={styles.heroStatValue}>{filteredConversations.length}</Text>
                  <Text style={styles.heroStatLabel}>{isRTL ? 'محادثات نشطة' : 'Active chats'}</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStatGroup}>
                  <Text style={styles.heroStatValue}>{unreadTotal}</Text>
                  <Text style={styles.heroStatLabel}>{isRTL ? 'رسائل غير مقروءة' : 'Unread notes'}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>

          <View style={[styles.searchWrapper, isRTL && styles.rowReverse]}>
            <Ionicons name="search" size={18} color="#93C5FD" style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, isRTL && styles.textRight]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={isRTL ? 'ابحث باسم المريض أو الرسالة' : 'Search patient or message'}
              placeholderTextColor="#93C5FD"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                <Ionicons name="close" size={18} color="#93C5FD" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            style={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          >
            {filteredConversations.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={48} color="#93C5FD" />
                <Text style={styles.emptyTitle}>
                  {isRTL ? 'لا توجد محادثات مطابقة' : 'No matching chats'}
                </Text>
                <Text style={styles.emptyText}>
                  {isRTL ? 'حاول كلمات مفتاحية مختلفة أو حدّث القائمة.' : 'Try different keywords or refresh the inbox.'}
                </Text>
              </View>
            ) : (
              filteredConversations.map((conv) => (
                <TouchableOpacity
                  key={conv.id}
                  style={styles.conversationCard}
                  onPress={() => selectConversation(conv)}
                  activeOpacity={0.9}
                >
                  <View style={[styles.conversationRow, isRTL && styles.rowReverse]}>
                    <View style={[styles.avatarBadge, conv.unread_count > 0 && styles.avatarBadgeUnread]}>
                      <Text style={styles.avatarInitials}>{getPatientInitials(conv.patient_name)}</Text>
                    </View>
                    <View style={[styles.conversationInfo, isRTL && styles.alignRight]}>
                      <View style={[styles.conversationTopRow, isRTL && styles.rowReverse]}>
                        <Text style={[styles.conversationPatientName, isRTL && styles.textRight]} numberOfLines={1}>
                          {conv.patient_name}
                        </Text>
                        {conv.last_message_time && (
                          <Text style={styles.messageTime}>{conv.last_message_time}</Text>
                        )}
                      </View>
                      <Text style={[styles.lastMessage, isRTL && styles.textRight]} numberOfLines={1}>
                        {conv.last_message || (isRTL ? 'لا توجد رسائل بعد' : 'No messages yet')}
                      </Text>
                      <View style={[styles.conversationMetaRow, isRTL && styles.rowReverse]}>
                        <View style={styles.statusPill}>
                          <View style={[styles.statusDot, conv.unread_count > 0 && styles.statusDotPending]} />
                          <Text style={styles.statusText}>{conv.unread_count > 0 ? (isRTL ? 'بانتظار الرد' : 'Waiting for reply') : (isRTL ? 'محدّث' : 'Up to date')}</Text>
                        </View>
                        {conv.unread_count > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{conv.unread_count}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
            <View style={{ height: 120 }} />
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
            <View style={[styles.chatHeaderInfo, isRTL && styles.alignRight]}>
              <Text style={[styles.chatHeaderTitle, isRTL && styles.textRight]}>
                {selectedConversation.patient_name}
              </Text>
              <Text style={[styles.chatHeaderSubtitle, isRTL && styles.textRight]}>
                {selectedConversation.last_message_time
                  ? (isRTL ? `آخر تفاعل ${selectedConversation.last_message_time}` : `Last active ${selectedConversation.last_message_time}`)
                  : (isRTL ? 'في انتظار أول رسالة' : 'Waiting for the first message')}
              </Text>
            </View>
            <TouchableOpacity style={styles.headerIconButton} onPress={handleContactPatient}>
              <Ionicons name="call-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={[styles.chatBody, { paddingBottom: 16 + insets.bottom }]}>
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

            <View
              style={[
                styles.composerBar,
                isRTL && styles.rowReverse,
                { paddingBottom: 16 + insets.bottom, marginBottom: insets.bottom },
              ]}
            >
              <View style={[styles.composerInputShell, isRTL && styles.rowReverse]}>
                <TextInput
                  style={[styles.composerInput, isRTL && styles.textRight]}
                  placeholder={isRTL ? 'اكتب رسالة...' : 'Type a message...'}
                  placeholderTextColor="#94A3B8"
                  value={newMessage}
                  onChangeText={setNewMessage}
                  multiline
                  maxLength={1000}
                />
              </View>
              <TouchableOpacity 
                style={[styles.sendBtn, (!newMessage.trim() || sendingMessage) && styles.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!newMessage.trim() || sendingMessage}
                activeOpacity={0.8}
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
  container: { flex: 1, backgroundColor: '#EEF2FF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#94A3B8', fontSize: 16 },
  hero: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroContent: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18 },
  heroTextBlock: { flex: 1, gap: 6 },
  heroEyebrow: { fontSize: 12, fontWeight: '600', letterSpacing: 1, color: '#BFDBFE', textTransform: 'uppercase' },
  heroTitle: { fontSize: 26, fontWeight: '700', color: '#fff' },
  heroSubtitle: { fontSize: 14, color: '#E0E7FF', lineHeight: 20 },
  heroStatCard: {
    backgroundColor: 'rgba(15,23,42,0.25)',
    borderRadius: 24,
    padding: 16,
    minWidth: 140,
    gap: 12,
  },
  heroStatGroup: { alignItems: 'center' },
  heroStatValue: { fontSize: 28, fontWeight: '700', color: '#fff' },
  heroStatLabel: { fontSize: 12, color: '#BFDBFE' },
  heroDivider: { height: 1, backgroundColor: 'rgba(148,163,184,0.4)' },
  searchWrapper: {
    marginHorizontal: 24,
    marginTop: -24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1D4ED8',
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#E0E7FF', fontSize: 14 },
  clearSearchBtn: { padding: 4 },
  content: { flex: 1, padding: 24 },
  emptyState: {
    marginTop: 60,
    padding: 24,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1E293B' },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  conversationCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  conversationRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarBadge: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeUnread: { borderWidth: 1, borderColor: '#1D4ED8', backgroundColor: '#DBEAFE' },
  avatarInitials: { fontSize: 16, fontWeight: '700', color: '#1D4ED8' },
  conversationInfo: { flex: 1, gap: 2 },
  conversationTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  conversationPatientName: { fontSize: 17, fontWeight: '600', color: '#0F172A', flexShrink: 1 },
  lastMessage: { fontSize: 14, color: '#64748B' },
  messageTime: { fontSize: 12, color: '#94A3B8', marginLeft: 8 },
  conversationMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 12 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  statusDotPending: { backgroundColor: '#F59E0B' },
  statusText: { fontSize: 12, color: '#0F172A', fontWeight: '500' },
  unreadBadge: {
    backgroundColor: '#1D4ED8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  chatHeader: {
    backgroundColor: '#1D4ED8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 18,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  backButton: { padding: 4 },
  chatHeaderInfo: { flex: 1, gap: 2 },
  chatHeaderTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  chatHeaderSubtitle: { fontSize: 13, color: '#DBEAFE' },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBody: { flex: 1, backgroundColor: '#F8FAFC', paddingBottom: 16 },
  messagesContainer: { flex: 1, paddingHorizontal: 20, paddingBottom: 16 },
  emptyChat: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyChatText: { fontSize: 16, color: '#94A3B8' },
  messageBubble: {
    maxWidth: '78%',
    marginBottom: 14,
    padding: 14,
    borderRadius: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  myMessage: { alignSelf: 'flex-end', backgroundColor: '#1D4ED8', borderBottomRightRadius: 6 },
  theirMessage: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 6 },
  messageText: { fontSize: 15, marginBottom: 6 },
  myMessageText: { color: '#F8FAFC' },
  theirMessageText: { color: '#0F172A' },
  messageTimeText: { fontSize: 11 },
  myMessageTime: { color: '#BFDBFE' },
  theirMessageTime: { color: '#94A3B8' },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  composerInputShell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  composerInput: {
    flex: 1,
    fontSize: 16,
    color: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 6,
    maxHeight: 110,
  },
  sendBtn: {
    backgroundColor: '#1D4ED8',
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D4ED8',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sendBtnDisabled: { opacity: 0.4 },
  textRight: { textAlign: 'right' },
  alignRight: { alignItems: 'flex-end' },
  rowReverse: { flexDirection: 'row-reverse' },
});
