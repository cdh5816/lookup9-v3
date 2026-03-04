import app from '@/lib/app';
import { useTranslation } from 'next-i18next';

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

  return (
    <div className="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8 bg-base-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-4xl font-extrabold tracking-tight">
          {app.name}
        </h1>
        {heading && (
          <p className="mt-4 text-center text-sm text-gray-400">
            {t(heading)}
          </p>
        )}
        {description && (
          <p className="text-center text-xs text-gray-500 mt-1">
            {t(description)}
          </p>
        )}
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">{children}</div>
    </div>
  );
}
