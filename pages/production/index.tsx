/* eslint-disable i18next/no-literal-string */
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

const ProductionDashboard = () => {
  const { t } = useTranslation('common');
  const { data: allData } = useSWR('/api/sites', fetcher, { refreshInterval: 30000 });
  const allSites: any[] = allData?.data || [];
  const activeSites = allSites.filter((s) => ['진행중', '부분완료', '계약완료'].includes(s.status));

  return (
    <>
      <Head><title>{t('nav-production-dashboard')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <h2 className="text-2xl font-bold">생산관리</h2>
          <p className="mt-2 text-sm text-gray-400">생산/도장/출하 부서가 바로 움직일 수 있게 현장 상태, 요청, 도장, 출하 흐름을 한 화면에서 확인합니다.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="전체 현장" value={allSites.length} />
          <StatCard title="계약완료" value={allSites.filter((site) => site.status === '계약완료').length} />
          <StatCard title="진행중" value={allSites.filter((site) => site.status === '진행중').length} />
          <StatCard title="부분완료" value={allSites.filter((site) => site.status === '부분완료').length} />
        </div>

        <div className="grid grid-cols-1 gap-4">
          {activeSites.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-700 py-16 text-center text-gray-500">진행할 생산 대상 현장이 없습니다.</div>
          ) : activeSites.map((site) => (
            <div key={site.id} className="rounded-2xl border border-gray-800 bg-black/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                    <h3 className="text-lg font-bold break-words">{site.name}</h3>
                    <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{site.status}</span>
                  </div>
                  <p className="mt-2 break-words text-sm leading-6 text-gray-400">{site.client?.name || '-'} · {site.address || '주소 미입력'}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 sm:grid-cols-4">
                    <span>배정인원 {site._count?.assignments || 0}</span>
                    <span>코멘트 {site._count?.comments || 0}</span>
                    <span>도장 {site.paintSpecs?.length || 0}</span>
                    <span>출하 {site.shipments?.length || 0}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                  <Link href={`/sites/${site.id}?tab=production`} className="rounded-xl border border-gray-700 px-3 py-2 text-center text-sm hover:border-blue-500">생산관리</Link>
                  <Link href={`/sites/${site.id}?tab=painting`} className="rounded-xl border border-gray-700 px-3 py-2 text-center text-sm hover:border-blue-500">도장관리</Link>
                  <Link href={`/sites/${site.id}?tab=shipping`} className="rounded-xl border border-gray-700 px-3 py-2 text-center text-sm hover:border-blue-500">출하관리</Link>
                  <Link href={`/sites/${site.id}?tab=requests`} className="rounded-xl border border-gray-700 px-3 py-2 text-center text-sm hover:border-blue-500">요청사항</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

const StatCard = ({ title, value }: { title: string; value: number }) => (
  <div className="rounded-2xl border border-gray-800 bg-black/10 p-4">
    <p className="text-sm text-gray-400">{title}</p>
    <p className="mt-2 text-2xl font-bold">{value}</p>
  </div>
);

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default ProductionDashboard;
