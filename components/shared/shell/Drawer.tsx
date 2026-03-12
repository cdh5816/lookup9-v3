/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import React, { useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Brand from './Brand';
import Navigation from './Navigation';
import { useTranslation } from 'next-i18next';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

interface DrawerProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Drawer = ({ sidebarOpen, setSidebarOpen }: DrawerProps) => {
  const { t } = useTranslation('common');
  const { data } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [router.asPath, sidebarOpen, setSidebarOpen]);

  return (
    <>
      {sidebarOpen && (
        <div className="relative z-50 lg:hidden">
          <div className="fixed inset-0 bg-gray-600/80" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-0 flex">
            <div className="relative mr-16 flex w-full max-w-xs flex-1">
              <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                <button
                  type="button"
                  className="-m-2.5 p-2.5"
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="sr-only">{t('close-sidebar')}</span>
                  <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>

              <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-800 bg-black px-5 pb-4">
                <Brand />
                {data?.user && (
                  <div className="-mt-3 break-words text-xs text-gray-500 leading-5">
                    {data.user.name}
                  </div>
                )}
                <Navigation onNavigate={() => setSidebarOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-800 bg-black px-6">
          <Brand />
          {data?.user && (
            <div className="-mt-3 break-words text-xs text-gray-500 leading-5">
              {data.user.name}
            </div>
          )}
          <Navigation />
        </div>
      </div>
    </>
  );
};

export default Drawer;
