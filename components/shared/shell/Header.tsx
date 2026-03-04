import React from 'react';
import { signOut } from 'next-auth/react';
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  MagnifyingGlassIcon,
  SunIcon,
} from '@heroicons/react/24/outline';
import useTheme from 'hooks/useTheme';
import env from '@/lib/env';
import { useTranslation } from 'next-i18next';

interface HeaderProps {
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Header = ({ setSidebarOpen }: HeaderProps) => {
  const { toggleTheme } = useTheme();
  const { t } = useTranslation('common');

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/custom-signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // 실패해도 진행
    }
    await signOut({ callbackUrl: '/auth/login' });
  };

  return (
    <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-gray-800 px-4 sm:px-6 lg:px-8 bg-black text-white">
      {/* 모바일 사이드바 토글 */}
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-400 lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">{t('open-sidebar')}</span>
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>

      <div className="flex flex-1 items-center justify-between">
        {/* 좌측: 빈 공간 (사이드바에 LOOKUP9 있음) */}
        <div className="flex-1" />

        {/* 우측: 도구들 */}
        <div className="flex items-center gap-x-3">
          {/* 검색 */}
          <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
            <MagnifyingGlassIcon className="w-5 h-5" />
          </button>

          {/* 알림 */}
          <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
            <BellIcon className="w-5 h-5" />
          </button>

          {/* 다크모드 */}
          {env.darkModeEnabled && (
            <button
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
              onClick={toggleTheme}
            >
              <SunIcon className="w-5 h-5" />
            </button>
          )}

          {/* 로그아웃 */}
          <button
            className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800"
            onClick={handleLogout}
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;
