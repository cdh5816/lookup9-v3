import app from '@/lib/app';
import useTheme from 'hooks/useTheme';

const Brand = () => {
  const { theme } = useTheme();
  return (
    <div className="flex pt-6 shrink-0 items-center text-xl font-bold gap-2 dark:text-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={theme === 'dark' ? '/logowhite.png' : app.logoUrl}
        alt={app.name}
        width={30}
        height={30}
        style={{ width: 30, height: 30, objectFit: 'contain' }}
      />
      {app.name}
    </div>
  );
};

export default Brand;
