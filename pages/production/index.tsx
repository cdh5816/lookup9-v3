import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

interface SiteSummary {
  id: string;
  name: string;
  status: string;
  address: string | null;
  client: { name: string } | null;
  _count: { contracts: number; documents: number };
  createdAt: string;
}

const statusColors: Record<string, string> = {
  '대기': 'badge-ghost',
  '진행중': 'badge-info',
  '부분완료': 'badge-warning',
  '완료': 'badge-success',
  '보류': 'badge-error',
};

const ProductionDashboard = () => {
  const { t } = useTranslation('common');

  // 전체 현장 데이터 (30초 폴링)
  const { data } = useSWR('/api/sites?status=진행중', fetcher, {
    refreshInterval: 30000,
  });
  const activeSites: SiteSummary[] = data?.data || [];

  const { data: allData } = useSWR('/api/sites', fetcher, {
    refreshInterval: 30000,
  });
  const allSites: SiteSummary[] = allData?.data || [];

  // 상태별 카운트
  const statusCounts = allSites.reduce((acc, site) => {
    acc[site.status] = (acc[site.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <Head><title>{t('nav-production-dashboard')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        <h2 className="text-xl font-bold">{t('nav-production-dashboard')}</h2>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-gray-800 p-4 text-center">
            <p className="text-xs text-gray-500">{t('production-total')}</p>
            <p className="text-2xl font-bold mt-1">{allSites.length}</p>
          </div>
          <div className="rounded-lg border border-blue-800 bg-blue-900/20 p-4 text-center">
            <p className="text-xs text-blue-400">{t('site-status-active')}</p>
            <p className="text-2xl font-bold mt-1 text-blue-300">{statusCounts['진행중'] || 0}</p>
          </div>
          <div className="rounded-lg border border-yellow-800 bg-yellow-900/20 p-4 text-center">
            <p className="text-xs text-yellow-400">{t('site-status-partial')}</p>
            <p className="text-2xl font-bold mt-1 text-yellow-300">{statusCounts['부분완료'] || 0}</p>
          </div>
          <div className="rounded-lg border border-green-800 bg-green-900/20 p-4 text-center">
            <p className="text-xs text-green-400">{t('site-status-done')}</p>
            <p className="text-2xl font-bold mt-1 text-green-300">{statusCounts['완료'] || 0}</p>
          </div>
        </div>

        {/* 진행중 현장 목록 */}
        <div>
          <h3 className="text-lg font-semibold mb-4">{t('production-active-sites')}</h3>
          {activeSites.length === 0 ? (
            <div className="text-center py-10 text-gray-500">{t('site-no-sites')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>{t('site-name')}</th>
                    <th>{t('site-client')}</th>
                    <th>{t('site-status-label')}</th>
                    <th>{t('site-address')}</th>
                    <th>{t('created-at')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSites.map((site) => (
                    <tr key={site.id} className="hover">
                      <td>
                        <Link href={`/sites/${site.id}`} className="font-medium text-blue-400 hover:underline">
                          {site.name}
                        </Link>
                      </td>
                      <td>{site.client?.name || '-'}</td>
                      <td><span className={`badge badge-sm ${statusColors[site.status] || 'badge-ghost'}`}>{site.status}</span></td>
                      <td className="text-sm text-gray-400">{site.address || '-'}</td>
                      <td className="text-sm text-gray-500">{new Date(site.createdAt).toLocaleDateString('ko-KR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 전체 현장 목록 */}
        <div>
          <h3 className="text-lg font-semibold mb-4">{t('production-all-sites')}</h3>
          {allSites.length === 0 ? (
            <div className="text-center py-10 text-gray-500">{t('site-no-sites')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>{t('site-name')}</th>
                    <th>{t('site-client')}</th>
                    <th>{t('site-status-label')}</th>
                    <th>{t('site-address')}</th>
                    <th>{t('created-at')}</th>
                  </tr>
                </thead>
                <tbody>
                  {allSites.map((site) => (
                    <tr key={site.id} className="hover">
                      <td>
                        <Link href={`/sites/${site.id}`} className="font-medium text-blue-400 hover:underline">
                          {site.name}
                        </Link>
                      </td>
                      <td>{site.client?.name || '-'}</td>
                      <td><span className={`badge badge-sm ${statusColors[site.status] || 'badge-ghost'}`}>{site.status}</span></td>
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
