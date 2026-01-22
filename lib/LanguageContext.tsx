import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import ar from './i18n/ar';
import en from './i18n/en';

type Language = 'en' | 'ar';
type Translations = typeof en;

type LanguageContextType = {
  language: Language;
  isRTL: boolean;
  t: Translations;
  setLanguage: (lang: Language) => Promise<void>;
  toggleLanguage: () => Promise<void>;
};

const translations = { en, ar };

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  isRTL: false,
  t: en,
  setLanguage: async () => {},
  toggleLanguage: async () => {},
});

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isRTL, setIsRTL] = useState(false);

  // Load saved language on app start
  useEffect(() => {
    loadSavedLanguage();
  }, []);

  const loadSavedLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('app_language');
      if (savedLanguage === 'ar' || savedLanguage === 'en') {
        setLanguageState(savedLanguage);
        const rtl = savedLanguage === 'ar';
        setIsRTL(rtl);
        
        // Set RTL layout
        if (I18nManager.isRTL !== rtl) {
          I18nManager.allowRTL(rtl);
          I18nManager.forceRTL(rtl);
        }
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem('app_language', lang);
      setLanguageState(lang);
      
      const rtl = lang === 'ar';
      setIsRTL(rtl);
      
      // Set RTL layout - requires app restart for full effect
      if (I18nManager.isRTL !== rtl) {
        I18nManager.allowRTL(rtl);
        I18nManager.forceRTL(rtl);
      }
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const toggleLanguage = async () => {
    const newLang = language === 'en' ? 'ar' : 'en';
    await setLanguage(newLang);
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, isRTL, t, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
