import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  HomeIcon,
  BuildingOffice2Icon,
  BellIcon,
  ChartBarIcon,
  WrenchScrewdriverIcon,
  Bars3BottomLeftIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  BuildingOffice2Icon as BuildingOffice2IconSolid,
  BellIcon as BellIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  WrenchScrewdriverIcon as WrenchScrewdriverIconSolid,
} from '@heroicons/react/24/solid';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

interface BottomNavProps {
  onMoreClick: () => void;
}

const BottomNav = ({ onMoreClick }: BottomNavProps) => {
  const router = useRouter();
  const path = router.pathname;

  const { data: profileData } = useSWR('/api/my/profile', fetcher, { refreshInterval: 30000 });
  const profile = profileData?.data;
  const unreadNotifications = profile?.unreadNotifications || 0;
  const userRole = profile?.role || profile?.teamMembers?.[0]?.role || 'USER';
  const permissions = profile?.permissions || {};

  const isGuest = userRole === 'GUEST' || userRole === 'VIEWER';
  const isPartner = userRole === 'PARTNER';
  const isManager = permissions.isManager || permissions.isCompanyAdmin || ['SUPER_ADMIN', 'OWNER'].includes(userRole);
  const dept = profile?.department || '';
  const canSeeSales = !isGuest && !isPartner && (isManager || ['영업', '영업팀', '영업부'].includes(dept));

  type NavItem = {
    key: string;
    label: string;
    href: string;
    icon: React.ElementType;
    iconActive: React.ElementType;
    badge?: number;
    isMore?: boolean;
  };

  const items: NavItem[] = [];

  // 대시보드
  items.push({
    key: 'dashboard',
    label: '대시보드',
    href: '/dashboard',
    icon: HomeIcon,
    iconActive: HomeIconSolid,
  });

  // 현장 (모든 역할)
  items.push({
    key: 'sites',
    label: '현장',
    href: '/sites',
    icon: BuildingOffice2Icon,
    iconActive: BuildingOffice2IconSolid,
  });

  // 협력사: 시공내역
  if (isPartner) {
    items.push({
      key: 'partner-dashboard',
      label: '시공내역',
      href: '/partner/dashboard',
      icon: WrenchScrewdriverIcon,
      iconActive: WrenchScrewdriverIconSolid,
    });
  }

  // 내부직원 중 영업 권한: 영업
  if (canSeeSales) {
    items.push({
      key: 'sales',
      label: '영업',
      href: '/sales',
      icon: ChartBarIcon,
      iconActive: ChartBarIconSolid,
    });
  }

  // 알림
  items.push({
    key: 'notifications',
    label: '알림',
    href: '/notifications',
    icon: BellIcon,
    iconActive: BellIconSolid,
    badge: unreadNotifications,
  });

  // 더보기
  items.push({
    key: 'more',
    label: '더보기',
    href: '#',
    icon: Bars3BottomLeftIcon,
    iconActive: Bars3BottomLeftIcon,
    isMore: true,
  });

  const isActive = (href: string) => {
    if (href === '/dashboard') return path === '/dashboard';
    if (href === '/sites') return path.startsWith('/sites');
    if (href === '/sales') return path.startsWith('/sales');
    if (href === '/partner/dashboard') return path === '/partner/dashboard';
    if (href === '/notifications') return path.startsWith('/notifications');
    return false;
  };

  return (
    <nav className="bottom-nav" role="tablist">
      {items.map((item) => {
        const active = !item.isMore && isActive(item.href);
        const Icon = active ? item.iconActive : item.icon;

        if (item.isMore) {
          return (
            <button
              key={item.key}
              className="bottom-nav-item"
              onClick={onMoreClick}
              role="tab"
              aria-label={item.label}
            >
              <Icon className="icon" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        }

        return (
          <Link key={item.key} href={item.href} className={`bottom-nav-item ${active ? 'active' : ''}`} role="tab" aria-selected={active}>
            <Icon className="icon" aria-hidden="true" />
            <span>{item.label}</span>
            {(item.badge ?? 0) > 0 && (
              <span className="nav-badge bg-red-500 text-white">
                {item.badge! > 99 ? '99+' : item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
