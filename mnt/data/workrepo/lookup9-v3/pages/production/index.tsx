import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500',
  대기: 'bg-red-400',
  계약완료: 'bg-yellow-400',
  진행중: 'bg-green-500',
  부분완료: 'bg-green-300',
  완료: 'bg-gray-400',
  보류: 'bg-gray-600',
};

const STATUS_PROGRESS: Record<string, number> = {
  영업중: 10,
  대기: 5,
  계약완료: 30,
  진행중: 70,
  부분완료: 85,
  완료: 100,
  보류: 0,
};

const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
    <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

const ProductionDashboard = () => {
  const { t } = useTranslation('common');
  const { data: allData } = useSWR('/api/sites', fetcher, { refreshInterval: 30000 });
  const allSites: any[] = allData?.data || [];

  const statusCounts = allSites.reduce((acc: Record<string, number>, site: any) => {
    acc[site.status] = (acc[site.status] || 0) + 1;
    return acc;
  }, {});

  const activeSites = allSites.filter((s) => ['진행중', '부분완료', '계약완료'].includes(s.status));

  return (
    <>
      <Head>
        <title>{t('nav-production-dashboard')} | LOOKUP9</title>
      </Head>
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <h2 className="text-xl font-bold break-words leading-7">{t('nav-production-dashboard')}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400 break-words">
            생산·도장·출하 흐름을 현장 기준으로 빠르게 확인하고 이동할 수 있도록 정리했습니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            { label: t('production-total'), value: allSites.length, color: 'border-gray-800' },
            { label: t('site-status-active'), value: statusCounts['진행중'] || 0, color: 'border-green-800 bg-green-900/10' },
            { label: t('site-status-partial'), value: statusCounts['부분완료'] || 0, color: 'border-yellow-800 bg-yellow-900/10' },
            { label: t('site-status-done'), value: statusCounts['완료'] || 0, color: 'border-gray-700' },
            { label: t('site-status-hold'), value: statusCounts['보류'] || 0, color: 'border-gray-800' },
          ].map((c) => (
            <div key={c.label} className={`rounded-2xl border p-4 text-center ${c.color}`}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="mt-1 break-words text-xs leading-5 text-gray-500">{c.label}</p>
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-4 text-lg font-semibold break-words leading-7">{t('production-active-sites')}</h3>
          {activeSites.length === 0 ? (
            <div className="py-10 text-center text-gray-500">{t('site-no-sites')}</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {activeSites.map((site) => {
                const progress = STATUS_PROGRESS[site.status] || 0;
                return (
                  <div key={site.id} className="rounded-2xl border border-gray-800 bg-black/10 p-4 hover:border-gray-600 transition-colors">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                        <span className="break-words text-base font-bold leading-6">{site.name}</span>
                        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{site.status}</span>
                      </div>
                      <div className="text-sm leading-6 text-gray-400 break-words">
                        {site.client?.name || '-'} · {site.address || '-'}
                      </div>
                      <div className="rounded-xl bg-gray-900/40 p-3">
                        <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                          <span>최종 공정률</span>
                          <span>{progress}%</span>
                        </div>
                        <ProgressBar value={progress} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Link href={`/sites/${site.id}`} className="rounded-lg border border-gray-700 px-3 py-2 text-center text-sm hover:border-gray-500">현장상세</Link>
                        <Link href={`/sites/${site.id}?tab=production`} className="rounded-lg border border-gray-700 px-3 py-2 text-center text-sm hover:border-gray-500">생산</Link>
                        <Link href={`/sites/${site.id}?tab=painting`} className="rounded-lg border border-gray-700 px-3 py-2 text-center text-sm hover:border-gray-500">도장</Link>
                        <Link href={`/sites/${site.id}?tab=shipping`} className="rounded-lg border border-gray-700 px-3 py-2 text-center text-sm hover:border-gray-500">출하</Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default ProductionDashboard;
