/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { getFinalProgress, parseLabeledValue } from '@/lib/site-progress';

const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500', 대기: 'bg-red-400', 계약완료: 'bg-yellow-400', 진행중: 'bg-green-500', 부분완료: 'bg-green-300', 완료: 'bg-gray-400', 보류: 'bg-gray-600',
};

const getDeadlineInfo = (description?: string | null) => {
  const deadline = parseLabeledValue(description, '납품기한');
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  return { deadline, diff, urgent: diff <= 3 };
};

const ProductionDashboard = () => {
  const { t } = useTranslation('common');
  const { data: allData } = useSWR('/api/sites', fetcher, { refreshInterval: 30000 });
  const allSites: any[] = allData?.data || [];
  const productionSites = allSites.filter((s) => ['계약완료', '진행중', '부분완료'].includes(s.status));

  return (
    <>
      <Head><title>{t('nav-production-dashboard')} | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <h2 className="text-2xl font-bold">생산관리</h2>
          <p className="mt-2 break-words text-sm leading-6 text-gray-400">
            생산/도장/출하 현장을 한 번에 보고, 필요한 탭으로 바로 이동합니다. 모바일에서도 카드형으로 읽히게 정리했습니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="생산 대상 현장" value={productionSites.length} />
          <StatCard title="공정률 70% 이상" value={productionSites.filter((site) => getFinalProgress(site).finalRate >= 70).length} />
          <StatCard title="납기 임박" value={productionSites.filter((site) => getDeadlineInfo(site.description)?.urgent).length} />
          <StatCard title="도장/출하 대기" value={productionSites.filter((site) => ['계약완료', '진행중'].includes(site.status)).length} />
        </div>

        <div className="space-y-4">
          {productionSites.length === 0 ? (
            <div className="rounded-2xl border border-gray-800 bg-black/20 p-10 text-center text-gray-500">생산관리 대상 현장이 없습니다.</div>
          ) : (
            productionSites.map((site) => {
              const progress = getFinalProgress(site);
              const deadline = getDeadlineInfo(site.description);
              return (
                <div key={site.id} className="rounded-2xl border border-gray-800 bg-black/20 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                        <h3 className="truncate text-lg font-bold">{site.name}</h3>
                        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{site.status}</span>
                      </div>
                      <p className="mt-2 break-words text-sm leading-6 text-gray-400">{site.client?.name || '-'} · {site.address || '주소 미입력'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 lg:w-[320px]">
                      <MiniStat title="최종 공정률" value={`${progress.finalRate}%`} />
                      <MiniStat title="판넬 입고" value={`${progress.panelRate}%`} />
                      <MiniStat title="코킹" value={`${progress.caulkingRate}%`} />
                      <MiniStat title="납품기한" value={deadline ? `${deadline.deadline}${deadline.urgent ? ' · 임박' : ''}` : '-'} danger={!!deadline?.urgent} />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <QuickLink href={`/sites/${site.id}`} label="현장상세" />
                    <QuickLink href={`/sites/${site.id}?tab=production`} label="세부 공정률" />
                    <QuickLink href={`/sites/${site.id}?tab=painting`} label="도료발주" />
                    <QuickLink href={`/sites/${site.id}?tab=shipping`} label="출하/배차" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

const StatCard = ({ title, value }: { title: string; value: number }) => (
  <div className="rounded-2xl border border-gray-800 bg-black/20 p-4">
    <p className="text-sm text-gray-400">{title}</p>
    <p className="mt-2 text-2xl font-bold">{value}</p>
  </div>
);

const MiniStat = ({ title, value, danger = false }: { title: string; value: string; danger?: boolean }) => (
  <div className={`rounded-xl border p-3 ${danger ? 'border-red-500/40 bg-red-500/10' : 'border-gray-800 bg-black/10'}`}>
    <p className={`text-xs ${danger ? 'text-red-300' : 'text-gray-500'}`}>{title}</p>
    <p className="mt-1 break-words text-sm font-semibold">{value}</p>
  </div>
);

const QuickLink = ({ href, label }: { href: string; label: string }) => (
  <Link href={href} className="rounded-xl border border-gray-800 px-3 py-2 text-center text-sm hover:border-blue-500/40 hover:bg-blue-950/20">
    {label}
  </Link>
);

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default ProductionDashboard;
