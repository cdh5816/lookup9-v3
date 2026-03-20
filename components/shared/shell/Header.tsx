import React, { useState, useRef, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  SunIcon,
  MoonIcon,
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
  const { toggleTheme, theme } = useTheme();
  const { t } = useTranslation('common');
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: profileData } = useSWR('/api/my/profile', fetcher, { refreshInterval: 30000 });
  const unreadMessageCount = profileData?.data?.unreadMessages || 0;
  const unreadNotificationCount = profileData?.data?.unreadNotifications || 0;
  const companyDisplayName = profileData?.data?.companyDisplayName || app.name;

  // 현재 테마 감지 (data-theme 속성 기반)
  const isDark = typeof document !== 'undefined'
    ? document.documentElement.getAttribute('data-theme') === 'black'
    : true;

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
    <div className="top-header px-4 sm:px-6 lg:px-8 flex shrink-0 items-center gap-2">
      {/* 모바일 햄버거 — 하단 네비게이션이 있으므로 lg에서만 숨김 */}
      <button
        type="button"
        className="hidden -m-2.5 p-2.5" style={{color:"var(--header-icon)"}}
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">{t('open-sidebar')}</span>
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* 회사명 */}
      <span className="block max-w-[200px] truncate text-sm font-semibold lg:hidden" style={{color:"var(--text-primary)"}}>
        {companyDisplayName}
      </span>

      {/* 우측 액션 영역 */}
      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        {/* 검색 */}
        <div className="relative" ref={searchRef}>
          <button
            className="rounded-lg p-2.5 transition-colors" style={{color:"var(--header-icon)"}}
            onClick={() => setShowSearch(!showSearch)}
            aria-label="검색"
          >
            {showSearch ? <XMarkIcon className="h-5 w-5" /> : <MagnifyingGlassIcon className="h-5 w-5" />}
          </button>
          {showSearch && (
            <div className="absolute right-0 top-full mt-2 w-[min(24rem,92vw)] rounded-xl shadow-2xl slide-up" style={{background:"var(--bg-elevated)",border:"1px solid var(--border-base)"}}>
              <input
                type="text"
                autoFocus
                className="w-full px-4 py-3.5 text-sm outline-none bg-transparent rounded-t-xl" style={{borderBottom:"1px solid var(--border-base)",color:"var(--text-primary)"}}
                placeholder={t('search-placeholder')}
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {results && (
                <div className="max-h-72 overflow-y-auto p-2">
                  {results.sites?.length > 0 && (
                    <div className="mb-2">
                      <p className="px-2 py-1.5 text-xs font-semibold" style={{color:"var(--text-muted)"}}>{t('nav-sites')}</p>
                      {results.sites.map((s: any) => (
                        <Link
                          key={s.id}
                          href={`/sites/${s.id}`}
                          onClick={() => { setShowSearch(false); setResults(null); setQuery(''); }}
                        >
                          <div className="cursor-pointer rounded-lg px-3 py-2.5 text-sm transition-colors" style={{color:"var(--text-primary)"}}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <span className="font-medium">{s.name}</span>
                            <span className="ml-2 text-xs" style={{color:"var(--text-muted)"}}>{s.status}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {results.users?.length > 0 && (
                    <div className="mb-2">
                      <p className="px-2 py-1.5 text-xs font-semibold" style={{color:"var(--text-muted)"}}>{t('members')}</p>
                      {results.users.map((u: any) => (
                        <div key={u.id} className="rounded-lg px-3 py-2.5 text-sm">
                          <span className="font-medium">{u.position ? `${u.position} ` : ''}{u.name}</span>
                          <span className="ml-2 text-xs" style={{color:"var(--text-muted)"}}>{u.department || ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!results.sites?.length && !results.users?.length && (
                    <p className="px-3 py-6 text-center text-sm" style={{color:"var(--text-muted)"}}>검색 결과가 없습니다.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 알림 — 모바일에서는 하단 네비에 있으므로 데스크탑만 */}
        <Link
          href="/notifications"
          className="relative rounded-lg p-2.5 transition-colors hidden sm:block" style={{color:"var(--header-icon)"}}
          aria-label="알림"
        >
          <BellIcon className="h-5 w-5" />
          {unreadNotificationCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white">
              {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
            </span>
          )}
        </Link>

        {/* 쪽지 */}
        <Link
          href="/messages"
          className="relative rounded-lg p-2.5 transition-colors" style={{color:"var(--header-icon)"}}
          aria-label="쪽지"
        >
          <EnvelopeIcon className="h-5 w-5" />
          {unreadMessageCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500 px-0.5 text-[10px] font-bold leading-none text-white">
              {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
            </span>
          )}
        </Link>

        {/* 다크모드 토글 — 아이콘이 현재 테마 반대로 표시 */}
        {env.darkModeEnabled && (
          <button
            className="rounded-lg p-2.5 transition-colors" style={{color:"var(--header-icon)"}}
            onClick={toggleTheme}
            aria-label="테마 변경"
          >
            {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button>
        )}

        {/* 내 정보 */}
        <Link href="/my" className="rounded-lg p-2.5 transition-colors hidden sm:block" style={{color:"var(--header-icon)"}} aria-label="내 정보">
          <UserCircleIcon className="h-5 w-5" />
        </Link>

        {/* 로그아웃 */}
        <button
          className="rounded-lg p-2.5 transition-colors hidden sm:block" style={{color:"var(--header-icon)"}}
          onClick={handleLogout}
          aria-label="로그아웃"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default Header;
