/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import Link from 'next/link';
import classNames from 'classnames';

export interface MenuItem {
  name: string;
  href: string;
  icon?: any;
  active?: boolean;
  items?: Omit<MenuItem, 'icon' | 'items'>[];
  className?: string;
}

export interface NavigationProps {
  activePathname: string | null;
}

interface NavigationItemsProps {
  menus: MenuItem[];
  onNavigate?: () => void;
}

interface NavigationItemProps {
  menu: MenuItem;
  className?: string;
  onNavigate?: () => void;
}

const baseItemClassName =
  'group flex items-start rounded-lg px-2 py-2.5 gap-2 text-sm text-gray-900 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-100 dark:hover:text-gray-100 dark:hover:bg-gray-800';

const NavigationItems = ({ menus, onNavigate }: NavigationItemsProps) => {
  return (
    <ul role="list" className="flex flex-1 flex-col gap-1">
      {menus.map((menu) => (
        <li key={menu.name}>
          <NavigationItem menu={menu} onNavigate={onNavigate} />
          {menu.items && (
            <ul className="mt-1 flex flex-col gap-1">
              {menu.items.map((subitem) => (
                <li key={subitem.name}>
                  <NavigationItem menu={subitem} className="pl-9" onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
};

const NavigationItem = ({ menu, className, onNavigate }: NavigationItemProps) => {
  return (
    <Link
      href={menu.href}
      onClick={onNavigate}
      className={`${baseItemClassName} ${
        menu.active ? 'bg-gray-800 font-semibold text-white' : ''
      } ${className || ''}`}
    >
      {menu.icon && (
        <menu.icon
          className={classNames({
            'mt-0.5 h-5 w-5 shrink-0 group-hover:text-gray-900 dark:group-hover:text-gray-100': true,
            'text-gray-100': menu.active,
          })}
          aria-hidden="true"
        />
      )}
      <span className="min-w-0 flex-1 break-words leading-5">{menu.name}</span>
    </Link>
  );
};

export default NavigationItems;
