
import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../locales/en.json';
import es from '../locales/es.json';

type Language = 'en' | 'es';
type Translations = typeof en;

// Helper to access nested keys (e.g., 'system.sync_protocol')
const getNestedValue = (obj: any, path: string): string => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj) || path;
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>(() => {
        const saved = localStorage.getItem('phantom_language');
        return (saved === 'en' || saved === 'es') ? saved : 'en'; // Default to English
    });

    useEffect(() => {
        localStorage.setItem('phantom_language', language);
    }, [language]);

    const t = (key: string): string => {
        const translations = language === 'es' ? es : en;
        return getNestedValue(translations, key);
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useTranslation = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
};
