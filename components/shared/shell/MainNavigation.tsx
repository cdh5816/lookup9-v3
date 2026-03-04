import {
  HomeIcon,
  BuildingOffice2Icon,
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
  UserCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import NavigationItems from './NavigationItems';
import { MenuItem, NavigationProps } from './NavigationItems';

const MainNavigation = ({ activePathname }: NavigationProps) => {
  const { t } = useTranslation('common');

  const menus: MenuItem[] = [
    {
      name: t('nav-dashboard'),
      href: '/dashboard',
      icon: HomeIcon,
      active: activePathname === '/dashboard',
    },
    {
      name: t('nav-sites'),
      href: '/sites',
      icon: BuildingOffice2Icon,
      active: activePathname?.startsWith('/sites') || false,
    },
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
    {
      name: t('nav-guests'),
      href: '/guests',
      icon: UserGroupIcon,
      active: activePathname?.startsWith('/guests') || false,
    },
    {
      name: t('admin-users'),
      href: '/admin/users',
      icon: UsersIcon,
      active: activePathname?.startsWith('/admin') || false,
    },
    {
      name: t('account'),
      href: '/settings/account',
      icon: UserCircleIcon,
      active: activePathname === '/settings/account',
    },
    {
      name: t('security'),
      href: '/settings/security',
      icon: ShieldCheckIcon,
      active: activePathname === '/settings/security',
    },
  ];

  return <NavigationItems menus={menus} />;
};

export default MainNavigation;
