import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Brand from './Brand';
import Navigation from './Navigation';
import { useSession } from 'next-auth/react';

interface DrawerProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Drawer = ({ sidebarOpen, setSidebarOpen }: DrawerProps) => {
  const { data } = useSession();

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <>
      {/* 모바일 오버레이 Drawer */}
      {sidebarOpen && (
        <div className="relative z-50 lg:hidden" aria-modal="true" role="dialog">
          {/* 바깥 클릭 → 닫힘 */}
          <div
            className="fixed inset-0 bg-black/70 transition-opacity"
            onClick={closeSidebar}
          />

          <div className="fixed inset-0 flex">
            <div className="relative flex w-full max-w-xs flex-1">
              {/* X 버튼 */}
              <div className="absolute right-0 top-0 z-10 flex w-16 justify-center pt-5 translate-x-full">
                <button
                  type="button"
                  className="-m-2.5 rounded-md p-2.5"
                  onClick={closeSidebar}
                >
                  <span className="sr-only">사이드바 닫기</span>
                  <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>

              <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-800 bg-black px-5 pb-4 shadow-2xl">
                <Brand />
                {data?.user && (
                  <div className="-mt-3 break-words text-xs leading-5 text-gray-500">
                    {data.user.name}
                  </div>
                )}
                {/* onNavigate: 메뉴 클릭 시 자동 닫힘 */}
                <Navigation onNavigate={closeSidebar} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 데스크탑 고정 사이드바 */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-800 bg-black px-6">
          <Brand />
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
