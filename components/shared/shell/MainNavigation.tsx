/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import {
  HomeIcon,
  BuildingOffice2Icon,
  BuildingLibraryIcon,
  UsersIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
  WrenchScrewdriverIcon,
  UserCircleIcon,
  UserPlusIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import NavigationItems from './NavigationItems';
import { MenuItem, NavigationProps } from './NavigationItems';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

interface MainNavigationProps extends NavigationProps {
  onNavigate?: () => void;
}

const MainNavigation = ({ activePathname, onNavigate }: MainNavigationProps) => {
  const { t } = useTranslation('common');
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const profile = profileData?.data;
  const userRole = profile?.role || profile?.teamMembers?.[0]?.role || 'USER';

  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'OWNER';
  const isCompanyAdmin = userRole === 'ADMIN_HR' || userRole === 'ADMIN' || isSuperAdmin;
  const isManager = userRole === 'MANAGER';
  const isInternalUser = ['USER', 'MEMBER'].includes(userRole);
  const isPartner = userRole === 'PARTNER';
  const isGuest = ['GUEST', 'VIEWER'].includes(userRole);
  const isInternal = isCompanyAdmin || isManager || isInternalUser || isSuperAdmin;

  const menus: MenuItem[] = [
    {
      name: t('nav-dashboard'),
      href: '/dashboard',
      icon: HomeIcon,
      active: activePathname === '/dashboard',
    },
  ];

  if (isInternal) {
    menus.push({
      name: t('nav-admin-hr'),
      href: '/admin-hr',
      icon: BuildingLibraryIcon,
      active: activePathname?.startsWith('/admin-hr') || false,
    });

    menus.push({
      name: t('nav-sites'),
      href: '/sites',
      icon: BuildingOffice2Icon,
      active: activePathname?.startsWith('/sites') || false,
    });

    menus.push({
      name: t('nav-production-dashboard'),
      href: '/production',
      icon: WrenchScrewdriverIcon,
      active: activePathname?.startsWith('/production') || false,
    });
  }

  if (isPartner || isGuest) {
    menus.push({
      name: t('nav-my-sites'),
      href: '/my/sites',
      icon: BuildingOffice2Icon,
      active: activePathname?.startsWith('/my/sites') || false,
    });
  }

  if (isPartner) {
    menus.push({
      name: t('nav-production-dashboard'),
      href: '/production',
      icon: WrenchScrewdriverIcon,
      active: activePathname?.startsWith('/production') || false,
    });
  }

  if (isCompanyAdmin || isManager || isPartner) {
    menus.push({
      name: t('nav-guest-manage'),
      href: '/partner/guests',
      icon: UserPlusIcon,
      active: activePathname?.startsWith('/partner/guests') || false,
    });
  }

  menus.push(
    {
      name: t('nav-messages'),
      href: '/messages',
      icon: EnvelopeIcon,
      active: activePathname?.startsWith('/messages') || false,
    },
    {
      name: t('noti-title'),
      href: '/notifications',
      icon: BellAlertIcon,
      active: activePathname?.startsWith('/notifications') || false,
    }
  );

  if (isCompanyAdmin) {
    menus.push({
      name: t('admin-users'),
      href: '/admin/users',
      icon: UsersIcon,
      active: activePathname?.startsWith('/admin/users') || false,
    });
  }

  menus.push(
    {
      name: t('my-page-title'),
      href: '/my',
      icon: UserCircleIcon,
      active: activePathname === '/my',
    },
    {
      name: t('security'),
      href: '/settings/security',
      icon: ShieldCheckIcon,
      active: activePathname?.startsWith('/settings/security') || false,
    }
  );

  return <NavigationItems menus={menus} onNavigate={onNavigate} />;
};

export default MainNavigation;
