import type { ReactNode } from 'react';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500',
  대기: 'bg-red-400',
  계약완료: 'bg-yellow-400',
  진행중: 'bg-green-500',
  부분완료: 'bg-green-300',
  완료: 'bg-gray-400',
  보류: 'bg-gray-600',
};

const parseLabeledValue = (text: string | null | undefined, label: string): string => {
  if (!text) return '';
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${escaped}\\s*[:：]\\s*([^\\n\\r]+)`, 'i');
  const match = text.match(pattern);
  return match?.[1]?.trim() || '';
};

const toNumber = (value: string | null | undefined): number => {
  if (!value) return 0;
  const num = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const ProductionDashboard = () => {
  const { data: allData } = useSWR('/api/sites', fetcher, { refreshInterval: 30000 });
  const allSites: any[] = allData?.data || [];

  const activeSites = allSites.filter((s) => ['계약완료', '진행중', '부분완료'].includes(s.status));

  const cards = [
    { label: '전체 현장', value: allSites.length },
    { label: '생산 진행', value: activeSites.filter((site) => site.status === '진행중').length },
    { label: '부분 완료', value: activeSites.filter((site) => site.status === '부분완료').length },
    { label: '도장대기', value: allSites.filter((site) => (site.paintSpecs || []).some((spec: any) => spec.status === '도료발주대기')).length },
  ];

  return (
    <>
      <Head><title>생산관리 | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <h2 className="text-2xl font-bold break-words">생산관리</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400 break-words">
            현장별 공정률, 도장 발주, 출하 준비, 요청사항을 한 화면에서 빠르게 확인하고 이동할 수 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-800 bg-black/20 p-4">
              <p className="text-sm text-gray-400">{card.label}</p>
              <p className="mt-2 text-2xl font-bold">{card.value}</p>
            </div>
          ))}
        </div>

        {activeSites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-700 py-12 text-center text-gray-500">생산 관련 현장이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {activeSites.map((site) => {
              const pipeRate = clampPercent(toNumber(parseLabeledValue(site.description, '하지파이프 진행률')));
              const caulkingRate = clampPercent(toNumber(parseLabeledValue(site.description, '코킹작업 진행률')));
              const contractQuantity = toNumber(parseLabeledValue(site.description, '물량'));
              const shipmentTotal = Array.isArray(site.shipments)
                ? site.shipments.reduce((sum: number, item: any) => sum + toNumber(String(item.quantity || 0)), 0)
                : 0;
              const panelRate = contractQuantity > 0 ? clampPercent((shipmentTotal / contractQuantity) * 100) : 0;
              const startDoc = parseLabeledValue(site.description, '착수서류 완료') === 'Y' ? 100 : 0;
              const finishDoc = parseLabeledValue(site.description, '준공서류 완료') === 'Y' ? 100 : 0;
              const totalProgress = clampPercent((pipeRate + panelRate + caulkingRate + startDoc + finishDoc) / 5);

              return (
                <div key={site.id} className="rounded-2xl border border-gray-800 bg-black/10 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                        <h3 className="break-words text-lg font-bold">{site.name}</h3>
                        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{site.status}</span>
                      </div>
                      <p className="mt-2 break-words text-sm leading-6 text-gray-400">{site.client?.name || '-'} · {site.address || '주소 미입력'}</p>
                    </div>
                    <div className="rounded-xl bg-gray-900/40 px-3 py-2 text-center">
                      <p className="text-xs text-gray-500">최종 공정률</p>
                      <p className="mt-1 text-2xl font-bold">{totalProgress}%</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <MiniCard label="하지파이프" value={`${pipeRate}%`} />
                    <MiniCard label="판넬 입고" value={`${panelRate}%`} />
                    <MiniCard label="코킹" value={`${caulkingRate}%`} />
                    <MiniCard label="도료발주" value={`${(site.paintSpecs || []).length}건`} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <QuickLink href={`/sites/${site.id}`}>현장상세</QuickLink>
                    <QuickLink href={`/sites/${site.id}?tab=production`}>생산탭</QuickLink>
                    <QuickLink href={`/sites/${site.id}?tab=painting`}>도장탭</QuickLink>
                    <QuickLink href={`/sites/${site.id}?tab=shipping`}>출하탭</QuickLink>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

const MiniCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-gray-900/40 p-3 text-center">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="mt-1 text-base font-bold">{value}</p>
  </div>
);

const QuickLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:border-gray-500 hover:bg-gray-900/50">
    <span>{children}</span>
    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
  </Link>
);

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default ProductionDashboard;
