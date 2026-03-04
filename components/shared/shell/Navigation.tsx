import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import MainNavigation from './MainNavigation';

const Navigation = () => {
  const { asPath, isReady } = useRouter();
  const [activePathname, setActivePathname] = useState<null | string>(null);

  useEffect(() => {
    if (isReady && asPath) {
      const activePathname = new URL(asPath, location.href).pathname;
      setActivePathname(activePathname);
    }
  }, [asPath, isReady]);

  return (
    <nav className="flex flex-1 flex-col">
      <MainNavigation activePathname={activePathname} />
    </nav>
  );
};

export default Navigation;
