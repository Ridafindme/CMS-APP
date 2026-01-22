import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Logo */}
      <Text style={styles.icon}>🏥</Text>
      
      {/* App Name */}
      <Text style={styles.title}>CMS App</Text>
      <Text style={styles.subtitle}>Clinic Management System</Text>
      <Text style={styles.tagline}>Connect with healthcare professionals</Text>
      
      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.signInButton}
          onPress={() => router.push('/sign-in')}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
        
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity 
          style={styles.signUpButton}
          onPress={() => router.push('/sign-up')}
        >
          <Text style={styles.signUpButtonText}>Create Account</Text>
        </TouchableOpacity>
      </View>
      
      {/* Footer */}
      <Text style={styles.footerText}>
        By continuing, you agree to our Terms & Privacy Policy
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  icon: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#BFDBFE',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#93C5FD',
    marginBottom: 60,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  signInButton: {
    backgroundColor: 'white',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  signInButtonText: {
    color: '#2563EB',
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#93C5FD',
  },
  dividerText: {
    color: '#BFDBFE',
    paddingHorizontal: 10,
    fontSize: 14,
  },
  signUpButton: {
    backgroundColor: '#1E40AF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  signUpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  footerText: {
    marginTop: 30,
    color: '#93C5FD',
    fontSize: 12,
    textAlign: 'center',
  },
});
