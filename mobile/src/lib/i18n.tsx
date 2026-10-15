import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import am from '@/locales/am.json';
type Language = 'en' | 'am';
type Values = Record<string, string | number>;
const Context = createContext({
  language: 'en' as Language,
  setLanguage: (_: Language) => {},
  t: (text: string, _values?: Values) => text,
});
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>(
    getLocales()[0]?.languageCode === 'am' ? 'am' : 'en',
  );
  useEffect(() => {
    void AsyncStorage.getItem('flashgo.language').then((value) => {
      if (value === 'am' || value === 'en') setLang(value);
    });
  }, []);
  const setLanguage = (value: Language) => {
    setLang(value);
    void AsyncStorage.setItem('flashgo.language', value);
  };
  const t = (text: string, values?: Values) => {
    const translated =
      language === 'am' ? (am as Record<string, string>)[text] || text : text;
    return translated.replace(/\{(\w+)\}/g, (match, key: string) =>
      String(values?.[key] ?? match),
    );
  };
  return (
    <Context.Provider value={{ language, setLanguage, t }}>
      {children}
    </Context.Provider>
  );
}
export const useLanguage = () => useContext(Context);
