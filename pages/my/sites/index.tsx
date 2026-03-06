import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const statusColors: Record<string, string> = {
  '대기': 'badge-ghost',
  '진행중': 'badge-info',
  '부분완료': 'badge-warning',
  '완료': 'badge-success',
  '보류': 'badge-error',
};

const MySitesPage = () => {
  const { t } = useTranslation('common');

  const { data } = useSWR('/api/my/profile', fetcher, { refreshInterval: 30000 });
  const mySites = data?.data?.mySites || [];

  return (
    <>
      <Head><title>{t('nav-my-sites')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{t('nav-my-sites')}</h2>

        {mySites.length === 0 ? (
          <div className="text-center py-10 text-gray-500">{t('my-no-sites')}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mySites.map((site: any) => (
              <Link key={site.id} href={`/sites/${site.id}`}>
                <div className="rounded-lg border border-gray-800 p-5 hover:border-gray-600 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">{site.name}</h3>
                    <span className={`badge badge-sm ${statusColors[site.status] || 'badge-ghost'}`}>
                      {site.status}
                    </span>
                  </div>
                  {site.address && <p className="text-sm text-gray-400">{site.address}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default MySitesPage;
