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
  ClipboardDocumentCheckIcon,
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

  const isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'OWNER';
  const isAdminHR = userRole === 'ADMIN_HR' || isSuperAdmin;
  const isManager = userRole === 'MANAGER' || isAdminHR;
  const isUser = userRole === 'USER' || isManager;
  const isPartner = userRole === 'PARTNER';
  const isGuest = userRole === 'GUEST' || userRole === 'VIEWER';

  if (isGuest) {
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

  if (isPartner) {
    return (
      <NavigationItems
        menus={[
          { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon, active: activePathname === '/dashboard' },
          { name: t('nav-my-sites'), href: '/my/sites', icon: BuildingOffice2Icon, active: activePathname?.startsWith('/my/sites') || false },
          { name: t('nav-production-dashboard'), href: '/production', icon: WrenchScrewdriverIcon, active: activePathname?.startsWith('/production') || false },
          { name: '게스트 관리', href: '/admin/users', icon: UserPlusIcon, active: activePathname?.startsWith('/admin/users') || false },
          { name: t('nav-messages'), href: '/messages', icon: EnvelopeIcon, active: activePathname?.startsWith('/messages') || false },
          { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: activePathname === '/my' },
          { name: t('security'), href: '/settings/security', icon: ShieldCheckIcon, active: activePathname === '/settings/security' },
        ]}
      />
    );
  }

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

  if (permissions.canOpenApprovals) {
    menus.push({ name: '전자결재', href: '/approvals', icon: ClipboardDocumentCheckIcon, active: activePathname?.startsWith('/approvals') || false });
  }

  menus.push(
    { name: t('nav-messages'), href: '/messages', icon: EnvelopeIcon, active: activePathname?.startsWith('/messages') || false },
    { name: t('noti-title'), href: '/notifications', icon: BellAlertIcon, active: activePathname?.startsWith('/notifications') || false }
  );

  if (permissions.canManageAccounts) {
    menus.push({ name: t('admin-users'), href: '/admin/users', icon: UsersIcon, active: activePathname?.startsWith('/admin') || false });
  }

  menus.push(
    { name: t('my-page-title'), href: '/my', icon: UserCircleIcon, active: activePathname === '/my' },
    { name: t('security'), href: '/settings/security', icon: ShieldCheckIcon, active: activePathname === '/settings/security' }
  );

  return <NavigationItems menus={menus} />;
};

export default MainNavigation;
