import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import MainNavigation from './MainNavigation';

interface NavigationProps {
  onNavigate?: () => void;
}

const Navigation = ({ onNavigate }: NavigationProps) => {
  const { asPath, isReady } = useRouter();
  const [activePathname, setActivePathname] = useState<null | string>(null);

  useEffect(() => {
    if (isReady && asPath) {
      const currentPathname = new URL(asPath, location.href).pathname;
      setActivePathname(currentPathname);
    }
  }, [asPath, isReady]);

  return (
    <nav className="flex flex-1 flex-col">
      <MainNavigation activePathname={activePathname} onNavigate={onNavigate} />
    </nav>
  );
};

export default Navigation;
