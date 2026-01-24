import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Clipboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function TestRedirectScreen() {
  const router = useRouter();
  const [copied, setCopied] = useState('');

  // Get both redirect URIs
  const nativeUri = makeRedirectUri({ scheme: 'cms' });
  const currentUri = nativeUri;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await Clipboard.setString(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
      Alert.alert('Copied!', `${label} copied to clipboard`);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔗 OAuth Redirect URIs</Text>
        <Text style={styles.subtitle}>Add these to Supabase</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>� Current Redirect URI</Text>
        <View style={styles.uriBox}>
          <Text style={styles.uri} selectable>{currentUri}</Text>
        </View>
        <TouchableOpacity
          style={styles.copyButton}
          onPress={() => copyToClipboard(currentUri, 'Redirect URI')}
        >
          <Text style={styles.copyButtonText}>
            {copied === 'Redirect URI' ? '✓ Copied' : 'Copy'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>📋 Required in Supabase</Text>
        <View style={styles.uriBox}>
          <Text style={styles.uri} selectable>cms://</Text>
        </View>
        <Text style={styles.description}>
          Make sure "cms://" is added to Redirect URLs in Supabase
        </Text>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>📋 Setup Instructions:</Text>
        <Text style={styles.instructionsText}>
          1. Go to Supabase Dashboard{'\n'}
          2. Navigate to: Authentication → URL Configuration{'\n'}
          3. Add both URLs above to "Redirect URLs"{'\n'}
          4. Click "Save"{'\n\n'}
          Direct link:{'\n'}
          https://supabase.com/dashboard/project/tqajsfkofgpncufkghvk/auth/url-configuration
        </Text>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>⚠️ Current Issue:</Text>
        <Text style={styles.infoText}>
          Your OAuth is redirecting to "localhost:3000" because these URLs are not configured in Supabase.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.testButton}
        onPress={() => router.push('/sign-in')}
      >
        <Text style={styles.testButtonText}>Test Google Sign-In</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2563EB',
    padding: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  backButton: {
    marginBottom: 20,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  uriBox: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  uri: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#2563EB',
  },
  copyButton: {
    backgroundColor: '#2563EB',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  copyButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  instructions: {
    backgroundColor: '#fff9e6',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffd700',
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  instructionsText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: '#ffebee',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef5350',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#c62828',
  },
  infoText: {
    fontSize: 14,
    color: '#d32f2f',
    lineHeight: 20,
  },
  testButton: {
    backgroundColor: '#4CAF50',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
