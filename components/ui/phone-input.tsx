import { patientTheme } from '@/constants/patientTheme';
import {
  CountryData,
  formatAsTyping,
  fromE164,
  getPhoneErrorMessage,
  PhoneType,
  toE164,
  validatePhone,
} from '@/lib/phone-utils';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

type IconName = keyof typeof Ionicons.glyphMap;
const theme = patientTheme;

type PhoneInputProps = {
  value: string; // E.164 format or local format
  onChangeValue: (e164: string, local: string) => void; // Return both formats
  type?: PhoneType; // 'mobile' | 'landline' | undefined (any)
  placeholder?: string;
  label?: string;
  icon?: IconName | ImageSourcePropType; // Ionicon name or image source
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
  icon = 'call-outline' as IconName,
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
          <ActivityIndicator size="small" color={theme.colors.primary} />
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
  const iconColor = disabled ? theme.colors.textSecondary : theme.colors.primary;

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
        <View
          style={[
            styles.leadingIcon,
            isRTL && styles.leadingIconRTL,
            disabled && styles.leadingIconDisabled,
          ]}
        >
          {typeof icon === 'string' ? (
            <Ionicons name={icon as IconName} size={18} color={iconColor} />
          ) : (
            <Image source={icon} style={styles.leadingIconImage} />
          )}
        </View>
        
        {showCountryCode && (
          <View style={[styles.countryCode, isRTL && styles.countryCodeRTL]}>
            <Text style={styles.countryFlag}>{country.flag_emoji}</Text>
            <Text style={styles.countryCodeText}>+{country.country_code}</Text>
          </View>
        )}
        
        <TextInput
          style={[styles.input, isRTL && styles.textRight]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
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
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    marginTop: 10,
  },
  textRight: {
    textAlign: 'right',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.elevated,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 56,
    width: '100%',
  },
  inputWrapperError: {
    borderColor: theme.colors.danger,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  inputWrapperDisabled: {
    opacity: 0.7,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  leadingIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  leadingIconRTL: {
    marginRight: 0,
    marginLeft: 12,
  },
  leadingIconDisabled: {
    backgroundColor: theme.colors.elevated,
  },
  leadingIconImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    marginRight: 8,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  countryCodeRTL: {
    paddingRight: 0,
    paddingLeft: 8,
    marginRight: 0,
    marginLeft: 8,
    borderRightWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
  },
  countryFlag: {
    fontSize: 16,
    marginRight: 4,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.danger,
    marginTop: 4,
    marginLeft: 5,
  },
  hintText: {
    fontSize: 12,
    color: theme.colors.success,
    marginTop: 4,
    marginLeft: 5,
  },
});
