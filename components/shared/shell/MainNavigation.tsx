import {
  HomeIcon,
  BuildingOffice2Icon,
  BuildingLibraryIcon,
  UsersIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  UserCircleIcon,
  UserPlusIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import NavigationItems from './NavigationItems';
import { MenuItem, NavigationProps } from './NavigationItems';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const MainNavigation = ({ activePathname }: NavigationProps) => {
  const { t } = useTranslation('common');
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const profile = profileData?.data;
  const userRole = profile?.role || profile?.teamMembers?.[0]?.role || 'USER';
  const permissions = profile?.permissions || {};

  const isGuest = userRole === 'GUEST' || userRole === 'VIEWER';
  const isPartner = userRole === 'PARTNER';

  if (isGuest) {
    return (
      <NavigationItems
        menus={[
          { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: activePathname === '/dashboard' },
          { name: t('nav-my-sites'), href: '/my/sites', icon: BuildingOffice2Icon, active: activePathname?.startsWith('/my/sites') || false },
          { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: activePathname === '/my' },
          { name: t('security'), href: '/settings/security', icon: ShieldCheckIcon, active: activePathname === '/settings/security' },
        ]}
      />
    );
  }

  const menus: MenuItem[] = [
    { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: activePathname === '/dashboard' },
  ];

  if (permissions.canViewSupport) {
    menus.push({ name: t('nav-admin-hr'), href: '/admin-hr', icon: BuildingLibraryIcon, active: activePathname?.startsWith('/admin-hr') || false });
  }

  menus.push(
    { name: t('nav-sites'), href: '/sites', icon: BuildingOffice2Icon, active: activePathname?.startsWith('/sites') || false },
    { name: t('nav-production-dashboard'), href: '/production', icon: WrenchScrewdriverIcon, active: activePathname?.startsWith('/production') || false },
  );

  if (permissions.canViewWorklogs) {
    menus.push({ name: '업무일지', href: '/worklogs', icon: MagnifyingGlassIcon, active: activePathname?.startsWith('/worklogs') || false });
  }

  if (permissions.canManageGuests || isPartner) {
    menus.push({ name: '게스트관리', href: '/guests', icon: UserPlusIcon, active: activePathname?.startsWith('/guests') || false });
  }

  if (permissions.canManageAccounts) {
    menus.push({ name: t('admin-users'), href: '/admin/users', icon: UsersIcon, active: activePathname?.startsWith('/admin/users') || false });
  }

  menus.push(
    { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: activePathname === '/my' },
    { name: t('security'), href: '/settings/security', icon: ShieldCheckIcon, active: activePathname === '/settings/security' },
  );

  return <NavigationItems menus={menus} />;
};

export default MainNavigation;
