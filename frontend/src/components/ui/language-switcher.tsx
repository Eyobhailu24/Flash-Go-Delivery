'use client';

import * as React from 'react';
import { Languages } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function setAppLanguage(lang: 'en' | 'am') {
  // Google Translate uses a cookie to handle transformation
  // Format: /pageLanguage/targetLanguage
  const value = lang === 'en' ? '/en/en' : '/en/am';

  // Clear existing cookies to avoid duplicates/mismatches
  document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

  // Set the new cookie
  document.cookie = `googtrans=${value}; path=/`;

  // Refresh the page to apply the translation
  window.location.reload();
}

export function getAppLanguage(): 'en' | 'am' {
  const cookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith('googtrans='));
  if (cookie) {
    const lang = cookie.split('/').pop();
    if (lang === 'am') return 'am';
  }
  return 'en';
}

export function LanguageSwitcher() {
  const [currentLang, setCurrentLang] = React.useState<'en' | 'am'>('en');

  React.useEffect(() => {
    setCurrentLang(getAppLanguage());
  }, []);

  const changeLanguage = setAppLanguage;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex h-11 items-center gap-2 rounded-xl bg-orange-50 px-3 text-sm font-medium text-orange-700 shadow-sm transition-all hover:bg-orange-100"
        >
          <Languages className="size-4" />
          <span>{currentLang === 'en' ? 'English' : 'አማርኛ'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32 rounded-xl border-none p-1 shadow-lg">
        <DropdownMenuItem
          onClick={() => changeLanguage('en')}
          className="cursor-pointer rounded-lg focus:bg-orange-50 focus:text-orange-700"
        >
          English
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => changeLanguage('am')}
          className="cursor-pointer rounded-lg focus:bg-orange-50 focus:text-orange-700"
        >
          አማርኛ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
