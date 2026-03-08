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

const ProductionDashboard = () => {
  const { t } = useTranslation('common');

  const { data: allData } = useSWR('/api/sites', fetcher, { refreshInterval: 30000 });
  const allSites: any[] = allData?.data || [];

  // 상태별 카운트
  const statusCounts = allSites.reduce((acc: Record<string, number>, site: any) => {
    acc[site.status] = (acc[site.status] || 0) + 1;
    return acc;
  }, {});

  const activeSites = allSites.filter((s) => s.status === '진행중' || s.status === '부분완료');

  return (
    <>
      <Head><title>{t('nav-production-dashboard')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{t('nav-production-dashboard')}</h2>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: t('production-total'), value: allSites.length, color: 'border-gray-800' },
            { label: t('site-status-active'), value: statusCounts['진행중'] || 0, color: 'border-green-800 bg-green-900/10' },
            { label: t('site-status-partial'), value: statusCounts['부분완료'] || 0, color: 'border-yellow-800 bg-yellow-900/10' },
            { label: t('site-status-done'), value: statusCounts['완료'] || 0, color: 'border-gray-700' },
            { label: t('site-status-hold'), value: statusCounts['보류'] || 0, color: 'border-gray-800' },
          ].map((c) => (
            <div key={c.label} className={`rounded-lg border p-4 text-center ${c.color}`}>
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-gray-500 mt-1">{c.label}</p>
            </div>
          ))}
        </div>

        {/* 진행중 현장 — 출하 진행률 포함 */}
        <div>
          <h3 className="text-lg font-semibold mb-4">{t('production-active-sites')}</h3>
          {activeSites.length === 0 ? (
            <div className="text-center py-10 text-gray-500">{t('site-no-sites')}</div>
          ) : (
            <div className="space-y-3">
              {activeSites.map((site) => (
                <Link key={site.id} href={`/sites/${site.id}`}>
                  <div className="rounded-lg border border-gray-800 p-4 hover:border-gray-600 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                        <span className="font-bold">{site.name}</span>
                        <span className="text-xs text-gray-500">{site.status}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {site.client?.name && <span className="mr-2">{site.client.name}</span>}
                        {site.address && <span>{site.address}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{t('site-assigned-members')}: {site._count?.assignments || 0}</span>
                      <span>{t('tab-comments')}: {site._count?.comments || 0}</span>
                      <span>{new Date(site.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 전체 현장 테이블 */}
        <div>
          <h3 className="text-lg font-semibold mb-4">{t('production-all-sites')}</h3>
          {allSites.length === 0 ? (
            <div className="text-center py-10 text-gray-500">{t('site-no-sites')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr><th></th><th>{t('site-name')}</th><th>{t('site-client')}</th><th>{t('site-status-label')}</th><th>{t('site-address')}</th><th>{t('created-at')}</th></tr>
                </thead>
                <tbody>
                  {allSites.map((site) => (
                    <tr key={site.id} className="hover">
                      <td><span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} /></td>
                      <td><Link href={`/sites/${site.id}`} className="font-medium text-blue-400 hover:underline">{site.name}</Link></td>
                      <td className="text-sm">{site.client?.name || '-'}</td>
                      <td className="text-sm">{site.status}</td>
                      <td className="text-sm text-gray-400">{site.address || '-'}</td>
                      <td className="text-sm text-gray-500">{new Date(site.createdAt).toLocaleDateString('ko-KR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
