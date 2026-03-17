import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';

import { ThemesProps, applyTheme } from '@/lib/theme';

const useTheme = () => {
  const [theme, setTheme] = useState<string | null>(null);
  const { t } = useTranslation('common');

  useEffect(() => {
    setTheme(localStorage.getItem('theme'));
  }, []);

  const themes: ThemesProps[] = [
    {
      id: 'system',
      name: t('system'),
      icon: ComputerDesktopIcon,
    },
    {
      id: 'dark',
      name: t('dark'),
      icon: MoonIcon,
    },
    {
      id: 'light',
      name: t('light'),
      icon: SunIcon,
    },
  ];

  const selectedTheme = themes.find((t) => t.id === theme) || themes[0];

  const toggleTheme = () => {
    // data-theme 속성 직접 읽어서 현재 테마 판단 (가장 정확)
    const currentDataTheme = document.documentElement.getAttribute('data-theme');
    if (currentDataTheme === 'corporate') {
      applyTheme('dark');
      setTheme('dark');
    } else {
      applyTheme('light');
      setTheme('light');
    }
  };

  return { theme, setTheme, selectedTheme, toggleTheme, themes, applyTheme };
};

export default useTheme;
