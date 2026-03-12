import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import app from '@/lib/app';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import Navigation from './Navigation';
import { useTranslation } from 'next-i18next';
import { useSession } from 'next-auth/react';

interface DrawerProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Drawer = ({ sidebarOpen, setSidebarOpen }: DrawerProps) => {
  const { t } = useTranslation('common');
  const { data } = useSession();
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const companyDisplayName = profileData?.data?.companyDisplayName || app.name;

  return (
    <>
      {sidebarOpen && (
        <div className="relative z-50 lg:hidden" aria-modal="true" role="dialog">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setSidebarOpen(false)}
          />

          <div className="fixed inset-0 flex">
            <div className="relative flex w-full max-w-xs flex-1">
              <div className="absolute right-0 top-0 z-10 flex w-16 justify-center pt-5 translate-x-full">
                <button
                  type="button"
                  className="-m-2.5 rounded-md p-2.5"
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="sr-only">{t('close-sidebar')}</span>
                  <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>

              <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-800 bg-black px-5 pb-4 shadow-2xl">
                <div className="flex min-w-0 shrink-0 items-center pt-6 text-xl font-bold tracking-tight dark:text-gray-100"><span className="block max-w-[190px] truncate lg:max-w-[220px]">{companyDisplayName}</span></div>
                {data?.user && (
                  <div className="-mt-3 break-words text-xs leading-5 text-gray-500">
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
          <div className="flex min-w-0 shrink-0 items-center pt-6 text-xl font-bold tracking-tight dark:text-gray-100"><span className="block max-w-[190px] truncate lg:max-w-[220px]">{companyDisplayName}</span></div>
          {data?.user && (
            <div className="-mt-3 break-words text-xs leading-5 text-gray-500">
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
