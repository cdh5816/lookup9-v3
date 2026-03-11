/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

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

  const { data: profileData } = useSWR('/api/my/profile', fetcher, {
    refreshInterval: 30000,
  });

  const unreadCount = profileData?.data?.unreadMessages || 0;
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

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

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
    <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center border-b border-gray-800 bg-black px-4 text-white sm:px-6 lg:px-8">
      <div className="min-w-0 items-center gap-3 lg:hidden flex">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-gray-400"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="sr-only">{t('open-sidebar')}</span>
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>
        <span className="max-w-[180px] truncate text-base font-bold">
          {companyDisplayName}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-end">
        <div className="flex items-center gap-x-1">
          <div className="relative" ref={searchRef}>
            <button
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
              onClick={() => setShowSearch(!showSearch)}
            >
              {showSearch ? (
                <XMarkIcon className="h-5 w-5" />
              ) : (
                <MagnifyingGlassIcon className="h-5 w-5" />
              )}
            </button>

            {showSearch && (
              <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-gray-700 bg-gray-900 shadow-xl">
                <input
                  type="text"
                  autoFocus
                  className="w-full border-b border-gray-700 bg-transparent px-4 py-3 text-sm outline-none"
                  placeholder={t('search-placeholder')}
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                />

                {results && (
                  <div className="max-h-72 overflow-y-auto p-2">
                    {results.sites?.length > 0 && (
                      <div className="mb-2">
                        <p className="px-2 py-1 text-xs text-gray-500">{t('nav-sites')}</p>
                        {results.sites.map((s: any) => (
                          <Link
                            key={s.id}
                            href={`/sites/${s.id}`}
                            onClick={() => {
                              setShowSearch(false);
                              setResults(null);
                              setQuery('');
                            }}
                          >
                            <div className="cursor-pointer rounded px-3 py-2 text-sm hover:bg-gray-800">
                              {s.name}{' '}
                              <span className="text-xs text-gray-500">{s.status}</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {results.users?.length > 0 && (
                      <div className="mb-2">
                        <p className="px-2 py-1 text-xs text-gray-500">{t('members')}</p>
                        {results.users.map((u: any) => (
                          <div key={u.id} className="rounded px-3 py-2 text-sm hover:bg-gray-800">
                            {u.position ? `${u.position} ` : ''}
                            {u.name}
                            <span className="ml-2 text-xs text-gray-500">
                              {u.department || ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {results.clients?.length > 0 && (
                      <div>
                        <p className="px-2 py-1 text-xs text-gray-500">
                          {t('admin-tab-clients')}
                        </p>
                        {results.clients.map((c: any) => (
                          <div key={c.id} className="rounded px-3 py-2 text-sm hover:bg-gray-800">
                            {c.name}{' '}
                            <span className="text-xs text-gray-500">{c.type}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {results.sites?.length === 0 &&
                      results.users?.length === 0 &&
                      results.clients?.length === 0 && (
                        <p className="px-3 py-4 text-center text-sm text-gray-500">
                          {t('search-no-results')}
                        </p>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>

          <Link
            href="/notifications"
            className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <BellIcon className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
            title="테마 변경"
          >
            <SunIcon className="h-5 w-5" />
          </button>

          <Link
            href="/my"
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <UserCircleIcon className="h-5 w-5" />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
            title={t('logout')}
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {!env.isSaasMode && <div className="hidden" />}
    </div>
  );
};

export default Header;
