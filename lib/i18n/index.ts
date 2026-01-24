import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { I18nManager } from 'react-native';
import { en, TranslationKeys } from './en';
import { ar } from './ar';

type Language = 'en' | 'ar';

type I18nContextType = {
  language: Language;
  isRTL: boolean;
  t: TranslationKeys;
  setLanguage: (lang: Language) => Promise<void>;
  toggleLanguage: () => Promise<void>;
};

const translations: Record<Language, TranslationKeys> = { 
  en: en, 
  ar: ar as TranslationKeys 
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const LANGUAGE_KEY = '@app_language';

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider(props: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLang === 'en' || savedLang === 'ar') {
        setLanguageState(savedLang);
        
        const shouldBeRTL = savedLang === 'ar';
        if (I18nManager.isRTL !== shouldBeRTL) {
          I18nManager.allowRTL(shouldBeRTL);
          I18nManager.forceRTL(shouldBeRTL);
        }
      }
    } catch (error) {
      console.error('Error loading language:', error);
    } finally {
      setIsReady(true);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
      setLanguageState(lang);
      
      const shouldBeRTL = lang === 'ar';
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
      }
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const toggleLanguage = async () => {
    const newLang: Language = language === 'en' ? 'ar' : 'en';
    await setLanguage(newLang);
  };

  const value: I18nContextType = {
    language: language,
    isRTL: language === 'ar',
    t: translations[language],
    setLanguage: setLanguage,
    toggleLanguage: toggleLanguage,
  };

  if (!isReady) {
    return null;
  }

  return React.createElement(
    I18nContext.Provider,
    { value: value },
    props.children
  );
}

export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export function useTextAlign() {
  const { isRTL } = useI18n();
  return {
    textAlign: isRTL ? 'right' as const : 'left' as const,
    flexDirection: isRTL ? 'row-reverse' as const : 'row' as const,
    alignSelf: isRTL ? 'flex-end' as const : 'flex-start' as const,
  };
}
