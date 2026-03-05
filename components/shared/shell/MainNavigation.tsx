import {
  HomeIcon,
  BuildingOffice2Icon,
  BuildingLibraryIcon,
  CurrencyDollarIcon,
  ClipboardDocumentCheckIcon,
  CogIcon,
  PaintBrushIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
  DocumentTextIcon,
  BuildingStorefrontIcon,
  UserGroupIcon,
  UsersIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import { useSession } from 'next-auth/react';
import NavigationItems from './NavigationItems';
import { MenuItem, NavigationProps } from './NavigationItems';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const MainNavigation = ({ activePathname }: NavigationProps) => {
  const { t } = useTranslation('common');
  const { data: session } = useSession();

  // 현재 유저의 팀 역할 가져오기
  const { data: teamsData } = useSWR('/api/teams', fetcher);
  const teams = teamsData?.data || [];
  const userRole = teams[0]?.members?.[0]?.role || session?.user?.role || 'USER';

  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'OWNER';
  const isAdminHR = userRole === 'ADMIN_HR' || isSuperAdmin;
  const isManager = userRole === 'MANAGER' || isAdminHR;
  const isPartner = userRole === 'PARTNER';
  const isGuest = userRole === 'GUEST';

  // GUEST 메뉴
  if (isGuest) {
    const guestMenus: MenuItem[] = [
      {
        name: t('nav-my-sites'),
        href: '/my/sites',
        icon: BuildingOffice2Icon,
        active: activePathname?.startsWith('/my/sites') || false,
      },
    ];
    return <NavigationItems menus={guestMenus} />;
  }

  // PARTNER 메뉴
  if (isPartner) {
    const partnerMenus: MenuItem[] = [
      {
        name: t('nav-my-sites'),
        href: '/my/sites',
        icon: BuildingOffice2Icon,
        active: activePathname?.startsWith('/my/sites') || false,
      },
      {
        name: t('nav-production'),
        href: '/production',
        icon: CogIcon,
        active: activePathname?.startsWith('/production') || false,
      },
      {
        name: t('nav-construction'),
        href: '/construction',
        icon: WrenchScrewdriverIcon,
        active: activePathname?.startsWith('/construction') || false,
      },
      {
        name: t('nav-documents'),
        href: '/documents',
        icon: DocumentTextIcon,
        active: activePathname?.startsWith('/documents') || false,
      },
      {
        name: t('nav-guests'),
        href: '/guests',
        icon: UserGroupIcon,
        active: activePathname?.startsWith('/guests') || false,
      },
      {
        name: t('nav-messages'),
        href: '/messages',
        icon: EnvelopeIcon,
        active: activePathname?.startsWith('/messages') || false,
      },
    ];
    return <NavigationItems menus={partnerMenus} />;
  }

  // 일반 직원 이상 메뉴
  const menus: MenuItem[] = [
    {
      name: t('nav-dashboard'),
      href: '/dashboard',
      icon: HomeIcon,
      active: activePathname === '/dashboard',
    },
  ];

  // 경영지원 (ADMIN_HR, SUPER_ADMIN)
  if (isAdminHR) {
    menus.push({
      name: t('nav-admin-hr'),
      href: '/admin-hr',
      icon: BuildingLibraryIcon,
      active: activePathname?.startsWith('/admin-hr') || false,
    });
  }

  // 전체현장
  menus.push({
    name: t('nav-sites'),
    href: '/sites',
    icon: BuildingOffice2Icon,
    active: activePathname?.startsWith('/sites') || false,
  });

  // 부서별 메뉴
  menus.push(
    {
      name: t('nav-sales'),
      href: '/sales',
      icon: CurrencyDollarIcon,
      active: activePathname?.startsWith('/sales') || false,
    },
    {
      name: t('nav-orders'),
      href: '/orders',
      icon: ClipboardDocumentCheckIcon,
      active: activePathname?.startsWith('/orders') || false,
    },
    {
      name: t('nav-production'),
      href: '/production',
      icon: CogIcon,
      active: activePathname?.startsWith('/production') || false,
    },
    {
      name: t('nav-painting'),
      href: '/painting',
      icon: PaintBrushIcon,
      active: activePathname?.startsWith('/painting') || false,
    },
    {
      name: t('nav-shipping'),
      href: '/shipping',
      icon: TruckIcon,
      active: activePathname?.startsWith('/shipping') || false,
    },
    {
      name: t('nav-construction'),
      href: '/construction',
      icon: WrenchScrewdriverIcon,
      active: activePathname?.startsWith('/construction') || false,
    },
  );

  // 문서/거래처
  menus.push(
    {
      name: t('nav-documents'),
      href: '/documents',
      icon: DocumentTextIcon,
      active: activePathname?.startsWith('/documents') || false,
    },
    {
      name: t('nav-clients'),
      href: '/clients',
      icon: BuildingStorefrontIcon,
      active: activePathname?.startsWith('/clients') || false,
    },
  );

  // 쪽지
  menus.push({
    name: t('nav-messages'),
    href: '/messages',
    icon: EnvelopeIcon,
    active: activePathname?.startsWith('/messages') || false,
  });

  // 게스트관리
  if (isManager) {
    menus.push({
      name: t('nav-guests'),
      href: '/guests',
      icon: UserGroupIcon,
      active: activePathname?.startsWith('/guests') || false,
    });
  }

  // 계정관리 (SUPER_ADMIN, ADMIN_HR)
  if (isAdminHR) {
    menus.push({
      name: t('admin-users'),
      href: '/admin/users',
      icon: UsersIcon,
      active: activePathname?.startsWith('/admin') || false,
    });
  }

  // 보안
  menus.push({
    name: t('security'),
    href: '/settings/security',
    icon: ShieldCheckIcon,
    active: activePathname === '/settings/security',
  });

  return <NavigationItems menus={menus} />;
};

export default MainNavigation;
