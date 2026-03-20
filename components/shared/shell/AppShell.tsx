import { useState } from 'react';
import { Loading } from '@/components/shared';
import { useSession } from 'next-auth/react';
import React from 'react';
import Header from './Header';
import Drawer from './Drawer';
import BottomNav from './BottomNav';
import { useRouter } from 'next/navigation';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (status === 'loading') {
    return <Loading />;
  }

  if (status === 'unauthenticated') {
    router.push('/auth/login');
    return null;
  }

  return (
    <div>
      <Drawer sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="lg:pl-64" style={{backgroundColor:"var(--bg-base)",minHeight:"100vh",transition:"background-color 0.2s ease"}}>
        <Header setSidebarOpen={setSidebarOpen} />
        <main className="py-4 sm:py-5 main-with-bottomnav lg:!pb-5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
      {/* 모바일 하단 네비게이션 (lg 미만에서만 표시) */}
      <BottomNav onMoreClick={() => setSidebarOpen(true)} />
    </div>
  );
}
