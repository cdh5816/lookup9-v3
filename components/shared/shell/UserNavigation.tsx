import {
  RectangleStackIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'next-i18next';
import NavigationItems from './NavigationItems';
import { MenuItem, NavigationProps } from './NavigationItems';

const UserNavigation = ({ activePathname }: NavigationProps) => {
  const { t } = useTranslation('common');

  const menus: MenuItem[] = [
    {
      name: t('all-teams'),
      href: '/teams',
      icon: RectangleStackIcon,
      active: activePathname === '/teams',
    },
    {
      name: t('admin-users'),
      href: '/admin/users',
      icon: UsersIcon,
      active: activePathname === '/admin/users',
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

export default UserNavigation;
