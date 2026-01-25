/**
 * Phone number utilities for validation and formatting
 * Supports dynamic country configurations from database
 */

export type PhoneType = 'mobile' | 'landline' | 'unknown';

export type PhoneConfig = {
  landline_prefixes: string[];
  mobile_prefixes: string[];
  phone_length: number;
  format_display: string;
  format_pattern: string;
};

export type CountryData = {
  id: string;
  code: string; // 'LB'
  country_code: string; // '961'
  name_en: string;
  name_ar: string;
  iso_code: string;
  flag_emoji: string;
  phone_config: PhoneConfig;
  is_active: boolean;
  is_default: boolean;
};

/**
 * Detect phone type based on prefix
 */
export function detectPhoneType(number: string, config: PhoneConfig): PhoneType {
  const cleaned = number.replace(/\D/g, '');
  const prefix = cleaned.substring(0, 2);
  
  if (config.mobile_prefixes.includes(prefix)) return 'mobile';
  if (config.landline_prefixes.includes(prefix)) return 'landline';
  return 'unknown';
}

/**
 * Validate phone number
 */
export function validatePhone(
  number: string,
  config: PhoneConfig,
  expectedType?: PhoneType
): { valid: boolean; error?: string; type?: PhoneType } {
  const cleaned = number.replace(/\D/g, '');
  
  // Check length
  if (cleaned.length !== config.phone_length) {
    return {
      valid: false,
      error: `Phone number must be ${config.phone_length} digits`,
    };
  }
  
  // Detect type
  const type = detectPhoneType(cleaned, config);
  
  if (type === 'unknown') {
    return {
      valid: false,
      error: 'Invalid phone prefix',
    };
  }
  
  // Check if matches expected type
  if (expectedType && type !== expectedType) {
    return {
      valid: false,
      error: `Please enter a ${expectedType} number`,
      type,
    };
  }
  
  return { valid: true, type };
}

/**
 * Format phone number for display (local format)
 * Example: 70123456 -> 70 123 456
 */
export function formatPhoneLocal(number: string, config: PhoneConfig): string {
  const cleaned = number.replace(/\D/g, '');
  
  if (cleaned.length !== config.phone_length) return number;
  
  // Format: XX XXX XXX
  const prefix = cleaned.substring(0, 2);
  const middle = cleaned.substring(2, 5);
  const last = cleaned.substring(5, 8);
  
  return `${prefix} ${middle} ${last}`;
}

/**
 * Convert to E.164 format for storage (+961XXXXXXXX)
 */
export function toE164(number: string, countryCode: string): string {
  const cleaned = number.replace(/\D/g, '');
  return `+${countryCode}${cleaned}`;
}

/**
 * Convert from E.164 to local format
 * Example: +96170123456 -> 70123456
 */
export function fromE164(number: string, countryCode: string): string {
  if (!number) return '';
  const cleaned = number.replace(/\D/g, '');
  return cleaned.replace(countryCode, '');
}

/**
 * Auto-format as user types
 */
export function formatAsTyping(input: string, config: PhoneConfig): string {
  // Remove all non-digits
  const cleaned = input.replace(/\D/g, '');
  
  // Limit to phone length
  const limited = cleaned.substring(0, config.phone_length);
  
  // Format: XX XXX XXX
  if (limited.length <= 2) return limited;
  if (limited.length <= 5) return `${limited.substring(0, 2)} ${limited.substring(2)}`;
  return `${limited.substring(0, 2)} ${limited.substring(2, 5)} ${limited.substring(5)}`;
}

/**
 * Get user-friendly error message
 */
export function getPhoneErrorMessage(
  error: string,
  isRTL: boolean,
  expectedType?: PhoneType
): string {
  if (isRTL) {
    if (error.includes('must be')) return `يجب أن يتكون الرقم من 8 أرقام`;
    if (error.includes('prefix')) return `رمز الرقم غير صالح`;
    if (error.includes('mobile')) return `يرجى إدخال رقم موبايل`;
    if (error.includes('landline')) return `يرجى إدخال رقم أرضي`;
  }
  return error;
}
