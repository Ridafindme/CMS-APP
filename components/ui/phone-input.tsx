import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import {
  CountryData,
  PhoneType,
  validatePhone,
  formatAsTyping,
  toE164,
  fromE164,
  getPhoneErrorMessage,
} from '@/lib/phone-utils';

type PhoneInputProps = {
  value: string; // E.164 format or local format
  onChangeValue: (e164: string, local: string) => void; // Return both formats
  type?: PhoneType; // 'mobile' | 'landline' | undefined (any)
  placeholder?: string;
  label?: string;
  icon?: string | ImageSourcePropType; // String emoji or image source
  isRTL?: boolean;
  error?: string;
  disabled?: boolean;
};

export default function PhoneInput({
  value,
  onChangeValue,
  type,
  placeholder = '70 123 456',
  label,
  icon = '📱',
  isRTL = false,
  error: externalError,
  disabled = false,
}: PhoneInputProps) {
  const [country, setCountry] = useState<CountryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [localValue, setLocalValue] = useState('');
  const [internalError, setInternalError] = useState('');

  useEffect(() => {
    loadCountryConfig();
  }, []);

  useEffect(() => {
    if (country && value) {
      // Convert E.164 to local if needed
      if (value.startsWith('+')) {
        const local = fromE164(value, country.country_code);
        setLocalValue(formatAsTyping(local, country.phone_config));
      } else {
        setLocalValue(formatAsTyping(value, country.phone_config));
      }
    }
  }, [value, country]);

  const loadCountryConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .eq('is_default', true)
        .single();

      if (error) throw error;
      if (data) setCountry(data);
    } catch (err) {
      console.error('Failed to load country config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeText = (text: string) => {
    if (!country) return;

    // Format as typing
    const formatted = formatAsTyping(text, country.phone_config);
    setLocalValue(formatted);

    // Get raw digits
    const digits = text.replace(/\D/g, '');

    // Validate
    const validation = validatePhone(digits, country.phone_config, type);
    
    if (validation.valid) {
      setInternalError('');
      const e164 = toE164(digits, country.country_code);
      onChangeValue(e164, digits);
    } else {
      if (digits.length === country.phone_config.phone_length) {
        // Only show error if complete
        setInternalError(validation.error || '');
      } else {
        setInternalError('');
      }
      onChangeValue('', digits);
    }
  };

  if (loading) {
    return (
      <View style={styles.inputGroup}>
        {label && <Text style={[styles.label, isRTL && styles.textRight]}>{label}</Text>}
        <View style={styles.inputWrapper}>
          <ActivityIndicator size="small" color="#2563EB" />
        </View>
      </View>
    );
  }

  if (!country) {
    return (
      <View style={styles.inputGroup}>
        {label && <Text style={[styles.label, isRTL && styles.textRight]}>{label}</Text>}
        <View style={styles.inputWrapper}>
          <Text style={styles.errorText}>Failed to load country config</Text>
        </View>
      </View>
    );
  }

  const displayError = externalError || internalError;
  const showCountryCode = type !== 'landline'; // Show for mobile/any, hide for landline

  return (
    <View style={styles.inputGroup}>
      {label && (
        <Text style={[styles.label, isRTL && styles.textRight]}>{label}</Text>
      )}
      
      <View style={[
        styles.inputWrapper,
        isRTL && styles.rowReverse,
        displayError && styles.inputWrapperError,
        disabled && styles.inputWrapperDisabled,
      ]}>
        {typeof icon === 'string' ? (
          <Text style={styles.inputIcon}>{icon}</Text>
        ) : (
          <Image source={icon} style={styles.inputIconImage} />
        )}
        
        {showCountryCode && (
          <View style={[styles.countryCode, isRTL && styles.countryCodeRTL]}>
            <Text style={styles.countryFlag}>{country.flag_emoji}</Text>
            <Text style={styles.countryCodeText}>+{country.country_code}</Text>
          </View>
        )}
        
        <TextInput
          style={[styles.input, isRTL && styles.textRight]}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={localValue}
          onChangeText={handleChangeText}
          keyboardType="phone-pad"
          maxLength={11} // XX XXX XXX with spaces
          editable={!disabled}
        />
      </View>
      
      {displayError && (
        <Text style={[styles.errorText, isRTL && styles.textRight]}>
          {getPhoneErrorMessage(displayError, isRTL, type)}
        </Text>
      )}
      
      {type && !displayError && localValue.length > 0 && (
        <Text style={[styles.hintText, isRTL && styles.textRight]}>
          {type === 'mobile' 
            ? (isRTL ? 'رقم موبايل' : 'Mobile number')
            : (isRTL ? 'رقم أرضي' : 'Landline number')
          }
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textRight: {
    textAlign: 'right',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 15,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  inputWrapperDisabled: {
    backgroundColor: '#F3F4F6',
    opacity: 0.6,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  inputIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  inputIconImage: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    marginRight: 10,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  countryCodeRTL: {
    paddingRight: 0,
    paddingLeft: 10,
    marginRight: 0,
    marginLeft: 10,
    borderRightWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  countryFlag: {
    fontSize: 18,
    marginRight: 5,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#1F2937',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 5,
  },
  hintText: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
    marginLeft: 5,
  },
});
