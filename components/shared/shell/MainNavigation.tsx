import {
  HomeIcon,
  BuildingOffice2Icon,
  BuildingLibraryIcon,
  CurrencyDollarIcon,
  ClipboardDocumentCheckIcon,
  CogIcon,
  TruckIcon,
  DocumentTextIcon,
  BuildingStorefrontIcon,
  UserGroupIcon,
  UsersIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
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
  const isPartner = userRole === 'PARTNER';
  const isGuest = userRole === 'GUEST';

  if (isGuest) {
    const guestMenus: MenuItem[] = [
      { name: t('nav-my-sites'), href: '/my/sites', icon: BuildingOffice2Icon,
        active: activePathname?.startsWith('/my/sites') || false },
    ];
    return <NavigationItems menus={guestMenus} />;
  }

  if (isPartner) {
    const partnerMenus: MenuItem[] = [
      { name: t('nav-my-sites'), href: '/my/sites', icon: BuildingOffice2Icon,
        active: activePathname?.startsWith('/my/sites') || false },
      { name: t('nav-production'), href: '/production', icon: CogIcon,
        active: activePathname?.startsWith('/production') || false },
      { name: t('nav-documents'), href: '/documents', icon: DocumentTextIcon,
        active: activePathname?.startsWith('/documents') || false },
      { name: t('nav-guests'), href: '/guests', icon: UserGroupIcon,
        active: activePathname?.startsWith('/guests') || false },
      { name: t('nav-messages'), href: '/messages', icon: EnvelopeIcon,
        active: activePathname?.startsWith('/messages') || false },
    ];
    return <NavigationItems menus={partnerMenus} />;
  }

  const menus: MenuItem[] = [
    { name: t('nav-dashboard'), href: '/dashboard', icon: HomeIcon,
      active: activePathname === '/dashboard' },
  ];

  if (isAdminHR) {
    menus.push({ name: t('nav-admin-hr'), href: '/admin-hr', icon: BuildingLibraryIcon,
      active: activePathname?.startsWith('/admin-hr') || false });
  }

  menus.push(
    { name: t('nav-sites'), href: '/sites', icon: BuildingOffice2Icon,
      active: activePathname?.startsWith('/sites') || false },
    { name: t('nav-sales'), href: '/sales', icon: CurrencyDollarIcon,
      active: activePathname?.startsWith('/sales') || false },
    { name: t('nav-orders'), href: '/orders', icon: ClipboardDocumentCheckIcon,
      active: activePathname?.startsWith('/orders') || false },
    { name: t('nav-production'), href: '/production', icon: CogIcon,
      active: activePathname?.startsWith('/production') || false },
    { name: t('nav-shipping'), href: '/shipping', icon: TruckIcon,
      active: activePathname?.startsWith('/shipping') || false },
    { name: t('nav-documents'), href: '/documents', icon: DocumentTextIcon,
      active: activePathname?.startsWith('/documents') || false },
    { name: t('nav-clients'), href: '/clients', icon: BuildingStorefrontIcon,
      active: activePathname?.startsWith('/clients') || false },
    { name: t('nav-messages'), href: '/messages', icon: EnvelopeIcon,
      active: activePathname?.startsWith('/messages') || false },
  );

  if (isManager) {
    menus.push({ name: t('nav-guests'), href: '/guests', icon: UserGroupIcon,
      active: activePathname?.startsWith('/guests') || false });
  }

  if (isAdminHR) {
    menus.push({ name: t('admin-users'), href: '/admin/users', icon: UsersIcon,
      active: activePathname?.startsWith('/admin') || false });
  }

  menus.push({ name: t('security'), href: '/settings/security', icon: ShieldCheckIcon,
    active: activePathname === '/settings/security' });

  return <NavigationItems menus={menus} />;
};

export default MainNavigation;
