import React, { useState, useRef, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BellIcon,
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

  // 안읽은 쪽지 카운트
  const { data: profileData } = useSWR('/api/my/profile', fetcher, { refreshInterval: 30000 });
  const unreadCount = profileData?.data?.unreadMessages || 0;

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

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 1) { setResults(null); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) { const data = await res.json(); setResults(data.data); }
    }, 300);
  }, []);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false); setResults(null); setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-gray-800 px-4 sm:px-6 lg:px-8 bg-black text-white">
      {/* 모바일: 사이드바 토글 + LOOKUP9 */}
      <div className="flex items-center gap-3 lg:hidden">
        <button type="button" className="-m-2.5 p-2.5 text-gray-400" onClick={() => setSidebarOpen(true)}>
          <span className="sr-only">{t('open-sidebar')}</span>
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>
        <span className="text-lg font-bold">{app.name}</span>
      </div>

      <div className="flex flex-1 items-center justify-end">
        <div className="flex items-center gap-x-1">
          {/* 검색 */}
          <div className="relative" ref={searchRef}>
            <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
              onClick={() => setShowSearch(!showSearch)}>
              {showSearch ? <XMarkIcon className="w-5 h-5" /> : <MagnifyingGlassIcon className="w-5 h-5" />}
            </button>
            {showSearch && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
                <input type="text" autoFocus className="w-full bg-transparent border-b border-gray-700 px-4 py-3 text-sm outline-none"
                  placeholder={t('search-placeholder')} value={query} onChange={(e) => handleSearch(e.target.value)} />
                {results && (
                  <div className="max-h-72 overflow-y-auto p-2">
                    {results.sites?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 px-2 py-1">{t('nav-sites')}</p>
                        {results.sites.map((s: any) => (
                          <Link key={s.id} href={`/sites/${s.id}`} onClick={() => { setShowSearch(false); setResults(null); setQuery(''); }}>
                            <div className="px-3 py-2 text-sm hover:bg-gray-800 rounded cursor-pointer">
                              {s.name} <span className="text-xs text-gray-500">{s.status}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                    {results.users?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-500 px-2 py-1">{t('members')}</p>
                        {results.users.map((u: any) => (
                          <div key={u.id} className="px-3 py-2 text-sm hover:bg-gray-800 rounded">
                            {u.position ? `${u.position} ` : ''}{u.name}
                            <span className="text-xs text-gray-500 ml-2">{u.department || ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {results.clients?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 px-2 py-1">{t('admin-tab-clients')}</p>
                        {results.clients.map((c: any) => (
                          <div key={c.id} className="px-3 py-2 text-sm hover:bg-gray-800 rounded">
                            {c.name} <span className="text-xs text-gray-500">{c.type}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {results.sites?.length === 0 && results.users?.length === 0 && results.clients?.length === 0 && (
                      <p className="px-3 py-4 text-sm text-gray-500 text-center">{t('search-no-results')}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 알림 */}
          <Link href="/notifications" className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 relative">
            <BellIcon className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>

          {env.darkModeEnabled && (
            <button className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800" onClick={toggleTheme}>
              <SunIcon className="w-5 h-5" />
            </button>
          )}
          <Link href="/my" className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800">
            <UserCircleIcon className="w-5 h-5" />
          </Link>
          <button className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-gray-800" onClick={handleLogout}>
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;
