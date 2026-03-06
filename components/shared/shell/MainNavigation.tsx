import {
  HomeIcon,
  BuildingOffice2Icon,
  BuildingLibraryIcon,
  UsersIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
  WrenchScrewdriverIcon,
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

  // GUEST: 대시보드 + 내 현장 + 쪽지
  if (isGuest) {
    const guestMenus: MenuItem[] = [
      { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon,
        active: activePathname === '/dashboard' },
      { name: t('nav-my-sites'), href: '/my/sites', icon: BuildingOffice2Icon,
        active: activePathname?.startsWith('/my/sites') || false },
      { name: t('nav-messages'), href: '/messages', icon: EnvelopeIcon,
        active: activePathname?.startsWith('/messages') || false },
    ];
    return <NavigationItems menus={guestMenus} />;
  }

  // PARTNER: 대시보드 + 내 현장 + 생산관리 + 쪽지 + 보안
  if (isPartner) {
    const partnerMenus: MenuItem[] = [
      { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon,
        active: activePathname === '/dashboard' },
      { name: t('nav-my-sites'), href: '/my/sites', icon: BuildingOffice2Icon,
        active: activePathname?.startsWith('/my/sites') || false },
      { name: t('nav-production-dashboard'), href: '/production', icon: WrenchScrewdriverIcon,
        active: activePathname?.startsWith('/production') || false },
      { name: t('nav-messages'), href: '/messages', icon: EnvelopeIcon,
        active: activePathname?.startsWith('/messages') || false },
      { name: t('security'), href: '/settings/security', icon: ShieldCheckIcon,
        active: activePathname === '/settings/security' },
    ];
    return <NavigationItems menus={partnerMenus} />;
  }

  // USER 이상: 전체 메뉴 (최종안 기준)
  const menus: MenuItem[] = [
    { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon,
      active: activePathname === '/dashboard' },
  ];

  // 경영지원 (ADMIN_HR 이상)
  if (isAdminHR) {
    menus.push({ name: t('nav-admin-hr'), href: '/admin-hr', icon: BuildingLibraryIcon,
      active: activePathname?.startsWith('/admin-hr') || false });
  }

  // 현장관리 (USER 이상)
  if (isUser) {
    menus.push({ name: t('nav-sites'), href: '/sites', icon: BuildingOffice2Icon,
      active: activePathname?.startsWith('/sites') || false });
  }

  // 생산관리 (USER 이상)
  if (isUser) {
    menus.push({ name: t('nav-production-dashboard'), href: '/production', icon: WrenchScrewdriverIcon,
      active: activePathname?.startsWith('/production') || false });
  }

  // 쪽지 (전원)
  menus.push({ name: t('nav-messages'), href: '/messages', icon: EnvelopeIcon,
    active: activePathname?.startsWith('/messages') || false });

  // 계정관리 (ADMIN_HR 이상)
  if (isAdminHR) {
    menus.push({ name: t('admin-users'), href: '/admin/users', icon: UsersIcon,
      active: activePathname?.startsWith('/admin') || false });
  }

  // 보안 (전원)
  menus.push({ name: t('security'), href: '/settings/security', icon: ShieldCheckIcon,
    active: activePathname === '/settings/security' });

  return <NavigationItems menus={menus} />;
};

export default MainNavigation;
