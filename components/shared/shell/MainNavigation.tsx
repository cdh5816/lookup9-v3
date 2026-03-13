import {
  HomeIcon,
  BuildingOffice2Icon,
  BuildingLibraryIcon,
  UsersIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
  UserCircleIcon,
  UserPlusIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import NavigationItems from './NavigationItems';
import { MenuItem, NavigationProps } from './NavigationItems';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const MainNavigation = ({ activePathname, onNavigate }: NavigationProps) => {
  const { t } = useTranslation('common');
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const profile = profileData?.data;
  const userRole = profile?.role || profile?.teamMembers?.[0]?.role || 'USER';
  const permissions = profile?.permissions || {};

  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'OWNER';
  const isAdminHR = permissions.isCompanyAdmin || isSuperAdmin;
  const isManager = permissions.isManager || isAdminHR;
  const isUser = permissions.isInternal || isManager;
  const isPartner = userRole === 'PARTNER';
  const isGuest = userRole === 'GUEST' || userRole === 'VIEWER';

  const active = (path: string) => activePathname?.startsWith(path) || false;
  const exact = (path: string) => activePathname === path;

  // ── GUEST ──
  if (isGuest) {
    return (
      <NavigationItems
        onNavigate={onNavigate}
        menus={[
          { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: exact('/dashboard') },
          { name: '내 현장', href: '/my', icon: BuildingOffice2Icon, active: exact('/my') },
          { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: exact('/my') },
        ]}
      />
    );
  }

  // ── PARTNER ──
  if (isPartner) {
    return (
      <NavigationItems
        onNavigate={onNavigate}
        menus={[
          { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: exact('/dashboard') },
          { name: t('nav-sites'), href: '/sites', icon: BuildingOffice2Icon, active: active('/sites') },
          { name: t('nav-production-dashboard'), href: '/production', icon: WrenchScrewdriverIcon, active: active('/production') },
          { name: '게스트 관리', href: '/guests', icon: UserPlusIcon, active: active('/guests') },
          { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: exact('/my') },
          { name: t('security'), href: '/settings/security', icon: ShieldCheckIcon, active: exact('/settings/security') },
        ]}
      />
    );
  }

  // ── 내부 직원 (USER 이상) ──
  const menus: MenuItem[] = [
    { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: exact('/dashboard') },
  ];

  // 경영지원 (ADMIN_HR 이상)
  if (isAdminHR) {
    menus.push({
      name: t('nav-admin-hr'),
      href: '/admin-hr',
      icon: BuildingLibraryIcon,
      active: active('/admin-hr'),
    });
  }

  // 현장관리 (USER 이상)
  if (isUser) {
    menus.push({
      name: t('nav-sites'),
      href: '/sites',
      icon: BuildingOffice2Icon,
      active: active('/sites'),
    });
    menus.push({
      name: t('nav-production-dashboard'),
      href: '/production',
      icon: WrenchScrewdriverIcon,
      active: active('/production'),
    });
  }

  // 업무일지 열람 (매니저 이상)
  if (isManager) {
    menus.push({
      name: '업무일지',
      href: '/worklogs',
      icon: DocumentTextIcon,
      active: active('/worklogs'),
    });
  }

  // 전자결재 (권한 있는 경우)
  if (permissions.canApprove) {
    menus.push({
      name: '전자결재',
      href: '/approvals',
      icon: ClipboardDocumentCheckIcon,
      active: active('/approvals'),
    });
  }

  // 계정관리 (매니저 이상)
  if (isManager) {
    menus.push({
      name: t('admin-users'),
      href: '/admin/users',
      icon: UsersIcon,
      active: active('/admin'),
    });
  }

  menus.push(
    { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: exact('/my') },
    { name: t('security'), href: '/settings/security', icon: ShieldCheckIcon, active: exact('/settings/security') },
  );

  return <NavigationItems menus={menus} onNavigate={onNavigate} />;
};

export default MainNavigation;
