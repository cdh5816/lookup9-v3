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

const MainNavigation = ({ activePathname }: NavigationProps) => {
  const { t } = useTranslation('common');

  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const profile = profileData?.data;
  const userRole = profile?.teamMembers?.[0]?.role || 'USER';

  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'OWNER';
  const isAdminHR = userRole === 'ADMIN_HR' || isSuperAdmin;
  const isManager = userRole === 'MANAGER' || isAdminHR;
  const isUser = userRole === 'USER' || isManager;
  const isPartner = userRole === 'PARTNER';
  const isGuest = userRole === 'GUEST';

  // GUEST
  if (isGuest) {
    return <NavigationItems menus={[
      { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: activePathname === '/dashboard' },
      { name: t('nav-my-sites'), href: '/my/sites', icon: BuildingOffice2Icon, active: activePathname?.startsWith('/my/sites') || false },
      { name: t('nav-messages'), href: '/messages', icon: EnvelopeIcon, active: activePathname?.startsWith('/messages') || false },
      { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: activePathname === '/my' },
    ]} />;
  }

  // PARTNER — 게스트 생성 메뉴 추가
  if (isPartner) {
    return <NavigationItems menus={[
      { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: activePathname === '/dashboard' },
      { name: t('nav-my-sites'), href: '/my/sites', icon: BuildingOffice2Icon, active: activePathname?.startsWith('/my/sites') || false },
      { name: t('nav-production-dashboard'), href: '/production', icon: WrenchScrewdriverIcon, active: activePathname?.startsWith('/production') || false },
      { name: t('nav-guest-manage'), href: '/partner/guests', icon: UserPlusIcon, active: activePathname?.startsWith('/partner/guests') || false },
      { name: t('nav-messages'), href: '/messages', icon: EnvelopeIcon, active: activePathname?.startsWith('/messages') || false },
      { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: activePathname === '/my' },
      { name: t('security'), href: '/settings/security', icon: ShieldCheckIcon, active: activePathname === '/settings/security' },
    ]} />;
  }

  // USER 이상
  const menus: MenuItem[] = [
    { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: activePathname === '/dashboard' },
  ];

  if (isAdminHR) {
    menus.push({ name: t('nav-admin-hr'), href: '/admin-hr', icon: BuildingLibraryIcon, active: activePathname?.startsWith('/admin-hr') || false });
  }

  if (isUser) {
    menus.push({ name: t('nav-sites'), href: '/sites', icon: BuildingOffice2Icon, active: activePathname?.startsWith('/sites') || false });
    menus.push({ name: t('nav-production-dashboard'), href: '/production', icon: WrenchScrewdriverIcon, active: activePathname?.startsWith('/production') || false });
  }

  menus.push(
    { name: t('nav-messages'), href: '/messages', icon: EnvelopeIcon, active: activePathname?.startsWith('/messages') || false },
    { name: t('noti-title'), href: '/notifications', icon: BellAlertIcon, active: activePathname?.startsWith('/notifications') || false },
  );

  if (isAdminHR) {
    menus.push({ name: t('admin-users'), href: '/admin/users', icon: UsersIcon, active: activePathname?.startsWith('/admin') || false });
  }

  menus.push(
    { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: activePathname === '/my' },
    { name: t('security'), href: '/settings/security', icon: ShieldCheckIcon, active: activePathname === '/settings/security' },
  );

  return <NavigationItems menus={menus} />;
};

export default MainNavigation;
