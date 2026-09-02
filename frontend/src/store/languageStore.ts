import { create } from 'zustand';

export type Language = 'en' | 'hi';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const getStoredLanguage = (): Language => {
  try {
    const saved = localStorage.getItem('samadhanx_language');
    if (saved === 'hi' || saved === 'en') {
      return saved;
    }
  } catch (e) {
    console.error('Error reading language from localStorage:', e);
  }
  return 'en';
};

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: getStoredLanguage(),
  setLanguage: (lang: Language) => {
    try {
      localStorage.setItem('samadhanx_language', lang);
    } catch (e) {
      console.error('Error saving language to localStorage:', e);
    }
    set({ language: lang });
  },
  toggleLanguage: () => {
    const current = get().language;
    const next: Language = current === 'en' ? 'hi' : 'en';
    get().setLanguage(next);
  },
}));
