// Picks the language when the app starts and switches it from the profile menu.
//
// The first time, the app follows the phone's language (Hebrew phones get Hebrew). A choice made in
// the menu is saved on the phone and wins from then on. Hebrew is right to left: the layout flips
// only after a restart, so changing the language restarts the app.

import { getLocales } from 'expo-localization';
import { Storage } from 'expo-sqlite/kv-store';
import * as Updates from 'expo-updates';
import { DevSettings, I18nManager } from 'react-native';

import { setCurrentLanguage, type Language } from './core';

const KEY = 'shalev-gym:language';
// Set just before restarting to flip the layout, so a phone that refuses never restarts in a loop.
const FLIPPED_KEY = 'shalev-gym:direction-restart';

function read(key: string): string | null {
  try {
    return Storage.getItemSync(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) Storage.removeItemSync(key);
    else Storage.setItemSync(key, value);
  } catch {
    // Only the remembered choice is lost: the phone's language is used next time.
  }
}

export function phoneLanguage(): Language {
  try {
    const code = getLocales()[0]?.languageCode;
    return code === 'he' || code === 'iw' ? 'he' : 'en';
  } catch {
    return 'en';
  }
}

export function savedLanguage(): Language | null {
  const saved = read(KEY);
  return saved === 'en' || saved === 'he' ? saved : null;
}

async function restart() {
  try {
    await Updates.reloadAsync();
  } catch {
    // reloadAsync only works in a release build; while developing, the dev server reloads instead.
    DevSettings.reload();
  }
}

// Hebrew is switched off until its text is written (planned after 1.3.0, which ships in English).
// While off, the app is English and left to right on every phone, and the menu has no language choice.
export const HEBREW_READY = false;

// Called once before the first screen draws. Returns the language in use.
export function startLanguage(): Language {
  const language: Language = HEBREW_READY ? (savedLanguage() ?? phoneLanguage()) : 'en';
  setCurrentLanguage(language);
  const rtl = language === 'he';

  if (process.env.EXPO_OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
    }
    return language;
  }

  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
    // Restart once so the layout flips; if it still hasn't, carry on rather than loop.
    if (read(FLIPPED_KEY) !== language) {
      write(FLIPPED_KEY, language);
      restart();
    }
  } else {
    write(FLIPPED_KEY, null);
  }
  return language;
}

export async function changeLanguage(language: Language) {
  write(KEY, language);
  if (process.env.EXPO_OS === 'web') {
    window.location.reload();
    return;
  }
  const rtl = language === 'he';
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  write(FLIPPED_KEY, language);
  await restart();
}
