import { translate as googleTranslate } from '@vitalets/google-translate-api';

export type Language = 'en' | 'am';

const translationCache: Record<string, string> = {};

/**
 * Translates text based on the target language with caching.
 */
export async function t(text: string, targetLang: Language): Promise<string> {
  if (targetLang === 'en') return text;
  
  const cacheKey = `${targetLang}:${text}`;
  if (translationCache[cacheKey]) return translationCache[cacheKey];
  
  try {
    const { text: translated } = await googleTranslate(text, { to: 'am' });
    translationCache[cacheKey] = translated;
    return translated;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Fallback to original text on error
  }
}
