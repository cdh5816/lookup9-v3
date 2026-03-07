import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const STATUS_DOT: Record<string, string> = {
  '영업중': 'bg-red-500', '대기': 'bg-red-400', '계약완료': 'bg-yellow-400',
  '진행중': 'bg-green-500', '부분완료': 'bg-green-300', '완료': 'bg-gray-400', '보류': 'bg-gray-600',
};

const MySitesPage = () => {
  const { t } = useTranslation('common');
  const { data } = useSWR('/api/my/profile', fetcher, { refreshInterval: 30000 });
  const profile = data?.data || {};
  const mySites = profile.mySites || [];
  const userRole = profile.teamMembers?.[0]?.role || 'USER';
  const isGuest = userRole === 'GUEST';

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
              <Link key={site.id} href={isGuest ? `/guest/site/${site.id}` : `/sites/${site.id}`}>
                <div className="rounded-lg border border-gray-800 p-5 hover:border-gray-600 transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                    <h3 className="font-bold">{site.name}</h3>
                    <span className="text-xs text-gray-400 ml-auto">{site.status}</span>
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
