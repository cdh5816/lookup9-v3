import {
  HomeIcon,
  BuildingOffice2Icon,
  BuildingLibraryIcon,
  UsersIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  UserCircleIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import NavigationItems from './NavigationItems';
import { MenuItem, NavigationProps } from './NavigationItems';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const MainNavigation = ({ activePathname, onNavigate }: NavigationProps & { onNavigate?: () => void }) => {
  const { t } = useTranslation('common');
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const profile = profileData?.data;
  const userRole = profile?.role || profile?.teamMembers?.[0]?.role || 'USER';
  const permissions = profile?.permissions || {};

  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'OWNER';
  const isAdminHR = permissions.isCompanyAdmin || isSuperAdmin;
  const isManager = permissions.isManager || isAdminHR;
  const isInternal = permissions.isInternal || isManager;
  const isPartner = userRole === 'PARTNER';
  const isGuest = userRole === 'GUEST' || userRole === 'VIEWER';

  const nav = (href: string) => activePathname?.startsWith(href) || false;

  if (isGuest) {
    return (
      <NavigationItems
        onNavigate={onNavigate}
        menus={[
          { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: activePathname === '/dashboard' },
          { name: t('nav-my-sites'), href: '/my/sites', icon: BuildingOffice2Icon, active: nav('/my/sites') },
          { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: activePathname === '/my' },
        ]}
      />
    );
  }

  if (isPartner) {
    return (
      <NavigationItems
        onNavigate={onNavigate}
        menus={[
          { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: activePathname === '/dashboard' },
          { name: t('nav-my-sites'), href: '/my/sites', icon: BuildingOffice2Icon, active: nav('/my/sites') },
          { name: t('nav-production-dashboard'), href: '/production', icon: WrenchScrewdriverIcon, active: nav('/production') },
          { name: '게스트 관리', href: '/guests', icon: UserPlusIcon, active: nav('/guests') },
          { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: activePathname === '/my' },
          { name: t('security'), href: '/settings/security', icon: ShieldCheckIcon, active: activePathname === '/settings/security' },
        ]}
      />
    );
  }

  const menus: MenuItem[] = [
    { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: activePathname === '/dashboard' },
  ];

  // 경영지원 — 대시보드 바로 아래
  if (isAdminHR) {
    menus.push({
      name: t('nav-admin-hr'),
      href: '/admin-hr',
      icon: BuildingLibraryIcon,
      active: nav('/admin-hr'),
    });
  }

  if (isInternal) {
    menus.push(
      { name: t('nav-sites'), href: '/sites', icon: BuildingOffice2Icon, active: nav('/sites') },
      { name: t('nav-production-dashboard'), href: '/production', icon: WrenchScrewdriverIcon, active: nav('/production') }
    );
  }

  // 계정관리 (MANAGER 이상)
  if (isManager) {
    menus.push({
      name: t('admin-users'),
      href: '/admin/users',
      icon: UsersIcon,
      active: nav('/admin'),
    });
  }

  menus.push(
    { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: activePathname === '/my' },
    { name: t('security'), href: '/settings/security', icon: ShieldCheckIcon, active: activePathname === '/settings/security' }
  );

  return <NavigationItems menus={menus} onNavigate={onNavigate} />;
};

export default MainNavigation;
