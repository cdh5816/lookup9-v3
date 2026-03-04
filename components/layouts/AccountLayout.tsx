import app from '@/lib/app';
import { useTranslation } from 'next-i18next';
import useTheme from 'hooks/useTheme';

interface AuthLayoutProps {
  children: React.ReactNode;
  heading?: string;
  description?: string;
}

export default function AuthLayout({
  children,
  heading,
  description,
}: AuthLayoutProps) {
  const { t } = useTranslation('common');
  const { theme } = useTheme();

  return (
    <>
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-20 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={theme === 'dark' ? '/logowhite.png' : app.logoUrl}
            className="mx-auto"
            alt={app.name}
            width={48}
            height={48}
            style={{ width: 48, height: 48, objectFit: 'contain' }}
          />
          {heading && (
            <p className="mt-6 text-center text-base text-gray-500 dark:text-gray-400">
              {t(heading)}
            </p>
          )}
          {description && (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500">
              {t(description)}
            </p>
          )}
        </div>
        <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">{children}</div>
      </div>
    </>
  );
}
