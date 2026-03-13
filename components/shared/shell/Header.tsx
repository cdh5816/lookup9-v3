import React, { useState, useRef, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  SunIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import useTheme from 'hooks/useTheme';
import env from '@/lib/env';
import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import app from '@/lib/app';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

interface HeaderProps {
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Header = ({ setSidebarOpen }: HeaderProps) => {
  const { toggleTheme } = useTheme();
  const { t } = useTranslation('common');
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: profileData } = useSWR('/api/my/profile', fetcher, { refreshInterval: 30000 });
  const unreadMessageCount = profileData?.data?.unreadMessages || 0;
  const unreadNotificationCount = profileData?.data?.unreadNotifications || 0;
  const companyDisplayName = profileData?.data?.companyDisplayName || app.name;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/custom-signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      void error;
    }
    await signOut({ callbackUrl: '/auth/login' });
  };

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 1) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.data);
      }
    }, 300);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
        setResults(null);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-gray-800 bg-black px-4 sm:px-6 lg:px-8">
      {/* 모바일 햄버거 */}
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-400 lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">{t('open-sidebar')}</span>
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* 회사명 (모바일) */}
      <span className="block max-w-[160px] truncate text-sm font-semibold text-white lg:hidden">
        {companyDisplayName}
      </span>

      {/* 우측 액션 영역 */}
      <div className="ml-auto flex items-center gap-1">
        {/* 검색 */}
        <div className="relative" ref={searchRef}>
          <button
            className="rounded-md p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
            onClick={() => setShowSearch(!showSearch)}
          >
            {showSearch ? <XMarkIcon className="h-5 w-5" /> : <MagnifyingGlassIcon className="h-5 w-5" />}
          </button>
          {showSearch && (
            <div className="absolute right-0 top-full mt-2 w-[min(22rem,90vw)] rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
              <input
                type="text"
                autoFocus
                className="w-full border-b border-gray-700 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-gray-500"
                placeholder={t('search-placeholder')}
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {results && (
                <div className="max-h-72 overflow-y-auto p-2">
                  {results.sites?.length > 0 && (
                    <div className="mb-2">
                      <p className="px-2 py-1 text-xs font-medium text-gray-500">{t('nav-sites')}</p>
                      {results.sites.map((s: any) => (
                        <Link
                          key={s.id}
                          href={`/sites/${s.id}`}
                          onClick={() => { setShowSearch(false); setResults(null); setQuery(''); }}
                        >
                          <div className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-gray-800">
                            {s.name}
                            <span className="ml-2 text-xs text-gray-500">{s.status}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {results.users?.length > 0 && (
                    <div className="mb-2">
                      <p className="px-2 py-1 text-xs font-medium text-gray-500">{t('members')}</p>
                      {results.users.map((u: any) => (
                        <div key={u.id} className="rounded px-3 py-2 text-sm hover:bg-gray-800">
                          {u.position ? `${u.position} ` : ''}{u.name}
                          <span className="ml-2 text-xs text-gray-500">{u.department || ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!results.sites?.length && !results.users?.length && (
                    <p className="px-3 py-4 text-center text-sm text-gray-500">검색 결과가 없습니다.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 알림 아이콘 — 배지 포함 */}
        <Link
          href="/notifications"
          className="relative rounded-md p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
        >
          <BellIcon className="h-5 w-5" />
          {unreadNotificationCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white">
              {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
            </span>
          )}
        </Link>

        {/* 쪽지 아이콘 — 배지 포함 */}
        <Link
          href="/messages"
          className="relative rounded-md p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
        >
          <EnvelopeIcon className="h-5 w-5" />
          {unreadMessageCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-0.5 text-[10px] font-bold leading-none text-white">
              {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
            </span>
          )}
        </Link>

        {/* 다크모드 */}
        {env.darkModeEnabled && (
          <button
            className="rounded-md p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
            onClick={toggleTheme}
          >
            <SunIcon className="h-5 w-5" />
          </button>
        )}

        {/* 내 정보 */}
        <Link href="/my" className="rounded-md p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white">
          <UserCircleIcon className="h-5 w-5" />
        </Link>

        {/* 로그아웃 */}
        <button
          className="rounded-md p-2 text-gray-400 transition hover:bg-gray-800 hover:text-red-400"
          onClick={handleLogout}
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default Header;
