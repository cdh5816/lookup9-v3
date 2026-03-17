import Link from 'next/link';

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
  onNavigate?: () => void;
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

const NavigationItems = ({ menus, onNavigate }: NavigationItemsProps) => {
  return (
    <ul role="list" className="flex flex-1 flex-col gap-0.5">
      {menus.map((menu) => (
        <li key={menu.name}>
          <NavigationItem menu={menu} onNavigate={onNavigate} />
          {menu.items && (
            <ul className="mt-0.5 flex flex-col gap-0.5">
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
      className={`sidebar-link ${menu.active ? 'active' : ''} ${className || ''}`}
    >
      {menu.icon && (
        <menu.icon className="icon" aria-hidden="true" />
      )}
      <span className="min-w-0 break-words leading-6">{menu.name}</span>
    </Link>
  );
};

export default NavigationItems;
