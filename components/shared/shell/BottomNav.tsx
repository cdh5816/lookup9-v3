import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  HomeIcon,
  BuildingOffice2Icon,
  BellIcon,
  ChartBarIcon,
  Bars3BottomLeftIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  BuildingOffice2Icon as BuildingOffice2IconSolid,
  BellIcon as BellIconSolid,
  ChartBarIcon as ChartBarIconSolid,
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
  const canSeeSales = isManager || ['영업', '영업팀', '영업부'].includes(dept);

  // 게스트: 대시보드, 현장, 알림, 더보기
  // 파트너: 대시보드, 현장, 알림, 더보기
  // 내부직원 (영업O): 대시보드, 현장, 영업, 알림, 더보기
  // 내부직원 (영업X): 대시보드, 현장, 알림, 더보기

  const items: {
    key: string;
    label: string;
    href: string;
    icon: React.ElementType;
    iconActive: React.ElementType;
    badge?: number;
    isMore?: boolean;
  }[] = [];

  items.push({
    key: 'dashboard',
    label: '대시보드',
    href: '/dashboard',
    icon: HomeIcon,
    iconActive: HomeIconSolid,
  });

  items.push({
    key: 'sites',
    label: '현장',
    href: '/sites',
    icon: BuildingOffice2Icon,
    iconActive: BuildingOffice2IconSolid,
  });

  if (!isGuest && !isPartner && canSeeSales) {
    items.push({
      key: 'sales',
      label: '영업',
      href: '/sales',
      icon: ChartBarIcon,
      iconActive: ChartBarIconSolid,
    });
  }

  items.push({
    key: 'notifications',
    label: '알림',
    href: '/notifications',
    icon: BellIcon,
    iconActive: BellIconSolid,
    badge: unreadNotifications,
  });

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
              className={`bottom-nav-item`}
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
