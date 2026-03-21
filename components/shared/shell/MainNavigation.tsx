import {
  HomeIcon,
  BuildingOffice2Icon,
  BuildingLibraryIcon,
  UsersIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  ChartBarIcon,
  UserPlusIcon,
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
  const isAdminHR    = permissions.isCompanyAdmin || isSuperAdmin;
  const isManager    = permissions.isManager || isAdminHR;
  const isUser       = permissions.isInternal || isManager;
  const isPartner    = userRole === 'PARTNER';
  const isGuest      = userRole === 'GUEST' || userRole === 'VIEWER';

  const active = (path: string) => activePathname?.startsWith(path) || false;
  const exact  = (path: string) => activePathname === path;

  // ── GUEST ──
  if (isGuest) {
    return (
      <NavigationItems onNavigate={onNavigate} menus={[
        { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: exact('/dashboard') },
        { name: t('nav-sites'), href: '/sites', icon: BuildingOffice2Icon, active: active('/sites') },
        { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: exact('/my') },
      ]} />
    );
  }

  // ── PARTNER ──
  if (isPartner) {
    return (
      <NavigationItems onNavigate={onNavigate} menus={[
        { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: exact('/dashboard') },
        { name: '시공내역', href: '/partner/dashboard', icon: ChartBarIcon, active: active('/partner/dashboard') },
        { name: t('nav-sites'), href: '/sites', icon: BuildingOffice2Icon, active: active('/sites') },
        { name: '게스트 관리', href: '/guests', icon: UserPlusIcon, active: active('/guests') },
        { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: exact('/my') },
        { name: t('security'), href: '/settings/security', icon: ShieldCheckIcon, active: exact('/settings/security') },
      ]} />
    );
  }

  // ── 내부 직원 ──
  const menus: MenuItem[] = [
    { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: exact('/dashboard') },
  ];

  // 경영지원 (ADMIN_HR 이상)
  if (isAdminHR) {
    menus.push({ name: t('nav-admin-hr'), href: '/admin-hr', icon: BuildingLibraryIcon, active: active('/admin-hr') });
  }

  if (isUser) {
    // 영업관리: 영업부서 or 관리자
    const dept = profile?.department || '';
    const canSeeSales = isManager || ['영업', '영업팀', '영업부'].includes(dept);
    if (canSeeSales) {
      menus.push({ name: '영업관리', href: '/sales', icon: ChartBarIcon, active: active('/sales') });
    }
    menus.push({ name: t('nav-sites'), href: '/sites', icon: BuildingOffice2Icon, active: active('/sites') });
  }

  // 계정관리: MANAGER 이상 (MANAGER는 협력업체 탭만, ADMIN_HR는 직원 탭도)
  if (isManager) {
    menus.push({ name: '계정 관리', href: '/admin/users', icon: UsersIcon, active: active('/admin/users') });
    menus.push({ name: '게스트 관리', href: '/guests', icon: UserPlusIcon, active: active('/guests') });
  }

  menus.push(
    { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: exact('/my') },
    { name: t('security'), href: '/settings/security', icon: ShieldCheckIcon, active: exact('/settings/security') },
  );

  return <NavigationItems onNavigate={onNavigate} menus={menus} />;
};

export default MainNavigation;
