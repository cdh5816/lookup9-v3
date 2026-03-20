import React from 'react';
import { XMarkIcon, ArrowRightOnRectangleIcon, UserCircleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import Brand from './Brand';
import Navigation from './Navigation';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

interface DrawerProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const Drawer = ({ sidebarOpen, setSidebarOpen }: DrawerProps) => {
  const { data } = useSession();

  const closeSidebar = () => setSidebarOpen(false);

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

  return (
    <>
      {/* 모바일 오버레이 Drawer */}
      {sidebarOpen && (
        <div className="relative z-50 lg:hidden" aria-modal="true" role="dialog">
          {/* 바깥 클릭 → 닫힘 */}
          <div
            className="fixed inset-0 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={closeSidebar}
          />

          <div className="fixed inset-0 flex">
            <div
              className="relative flex w-full max-w-[280px] flex-1 slide-up"
              style={{ animation: 'slide-in-left 0.2s ease' }}
            >
              {/* X 버튼 */}
              <div className="absolute right-0 top-0 z-10 flex w-16 justify-center pt-5 translate-x-full">
                <button
                  type="button"
                  className="-m-2.5 rounded-lg p-2.5"
                  onClick={closeSidebar}
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span className="sr-only">사이드바 닫기</span>
                  <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                </button>
              </div>

              <div className="sidebar-wrapper flex grow flex-col overflow-y-auto px-5 pb-4 shadow-2xl">
                <Brand />
                {data?.user && (
                  <div className="mt-1 mb-3 break-words text-xs leading-5" style={{color:"var(--text-muted)"}}>
                    {data.user.name}
                  </div>
                )}
                {/* onNavigate: 메뉴 클릭 시 자동 닫힘 */}
                <Navigation onNavigate={closeSidebar} />

                {/* 하단 퀵 액션 — 모바일 전용 */}
                <div className="mt-auto pt-4" style={{borderTop:"1px solid var(--border-subtle)"}}>
                  <Link href="/my" onClick={closeSidebar}>
                    <div className="sidebar-link">
                      <UserCircleIcon className="icon" />
                      <span>내 정보</span>
                    </div>
                  </Link>
                  <Link href="/settings/security" onClick={closeSidebar}>
                    <div className="sidebar-link">
                      <ShieldCheckIcon className="icon" />
                      <span>보안</span>
                    </div>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="sidebar-link w-full text-left"
                    style={{ color: 'var(--danger-text)' }}
                  >
                    <ArrowRightOnRectangleIcon className="icon" />
                    <span>로그아웃</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 데스크탑 고정 사이드바 */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col sidebar-wrapper">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto px-5">
          <Brand />
          {data?.user && (
            <div className="-mt-3 break-words text-xs leading-5" style={{color:"var(--text-muted)"}}>
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
