import { usePathname } from 'next/navigation';
import MainNavigation from './MainNavigation';

interface NavigationProps {
  onNavigate?: () => void;
}

const Navigation = ({ onNavigate }: NavigationProps) => {
  const pathname = usePathname();

  return <MainNavigation activePathname={pathname} onNavigate={onNavigate} />;
};

export default Navigation;
