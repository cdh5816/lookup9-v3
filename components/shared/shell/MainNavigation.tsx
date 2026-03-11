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
import {
  isCompanyAdminRole,
  isInternalManagerRole,
  isInternalRole,
  isPartnerRole,
  isExternalViewerRole,
} from '@/lib/lookup9-role';

const MainNavigation = ({ activePathname }: NavigationProps) => {
  const { t } = useTranslation('common');
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const profile = profileData?.data;
  const userRole = profile?.teamMembers?.[0]?.role || 'USER';

  if (isExternalViewerRole(userRole)) {
    return (
      <NavigationItems
        menus={[
          { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: activePathname === '/dashboard' },
          { name: t('nav-my-sites'), href: '/my/sites', icon: BuildingOffice2Icon, active: activePathname?.startsWith('/my/sites') || false },
          { name: t('nav-messages'), href: '/messages', icon: EnvelopeIcon, active: activePathname?.startsWith('/messages') || false },
          { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: activePathname === '/my' },
        ]}
      />
    );
  }

  if (isPartnerRole(userRole)) {
    return (
      <NavigationItems
        menus={[
          { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: activePathname === '/dashboard' },
          { name: t('nav-my-sites'), href: '/my/sites', icon: BuildingOffice2Icon, active: activePathname?.startsWith('/my/sites') || false },
          { name: t('nav-production-dashboard'), href: '/production', icon: WrenchScrewdriverIcon, active: activePathname?.startsWith('/production') || false },
          { name: t('nav-guest-manage'), href: '/partner/guests', icon: UserPlusIcon, active: activePathname?.startsWith('/partner/guests') || false },
          { name: t('nav-messages'), href: '/messages', icon: EnvelopeIcon, active: activePathname?.startsWith('/messages') || false },
          { name: t('noti-title'), href: '/notifications', icon: BellAlertIcon, active: activePathname?.startsWith('/notifications') || false },
          { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: activePathname === '/my' },
        ]}
      />
    );
  }

  const menus: MenuItem[] = [
    { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: activePathname === '/dashboard' },
    { name: t('nav-sites'), href: '/sites', icon: BuildingOffice2Icon, active: activePathname?.startsWith('/sites') || false },
    { name: t('nav-production-dashboard'), href: '/production', icon: WrenchScrewdriverIcon, active: activePathname?.startsWith('/production') || false },
    { name: t('nav-messages'), href: '/messages', icon: EnvelopeIcon, active: activePathname?.startsWith('/messages') || false },
    { name: t('noti-title'), href: '/notifications', icon: BellAlertIcon, active: activePathname?.startsWith('/notifications') || false },
  ];

  if (isCompanyAdminRole(userRole)) {
    menus.splice(1, 0, { name: t('nav-admin-hr'), href: '/admin-hr', icon: BuildingLibraryIcon, active: activePathname?.startsWith('/admin-hr') || false });
    menus.push({ name: t('admin-users'), href: '/admin/users', icon: UsersIcon, active: activePathname?.startsWith('/admin') || false });
  } else if (isInternalManagerRole(userRole)) {
    menus.push({ name: t('admin-users'), href: '/admin/users', icon: UsersIcon, active: activePathname?.startsWith('/admin') || false });
  }

  if (isInternalRole(userRole)) {
    menus.push({ name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: activePathname === '/my' });
    menus.push({ name: t('security'), href: '/settings/security', icon: ShieldCheckIcon, active: activePathname === '/settings/security' });
  }

  return <NavigationItems menus={menus} />;
};

export default MainNavigation;
