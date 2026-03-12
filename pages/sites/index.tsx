/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Button } from 'react-daisyui';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

interface ShipmentLite {
  quantity?: string | number | null;
}

interface SiteData {
  id: string;
  name: string;
  address: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
  description?: string | null;
  client: { name: string } | null;
  createdBy: { name: string; position: string | null };
  shipments?: ShipmentLite[];
  _count: { assignments: number; comments: number };
}

const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500',
  대기: 'bg-red-400',
  계약완료: 'bg-yellow-400',
  진행중: 'bg-green-500',
  부분완료: 'bg-green-300',
  완료: 'bg-gray-400',
  보류: 'bg-gray-600',
};

const parseLabeledValue = (text: string | null | undefined, label: string) => {
  if (!text) return '';
  const line = String(text)
    .split(/\r?\n/)
    .find((row) => row.trim().startsWith(`${label}:`) || row.trim().startsWith(`${label}：`));
  if (!line) return '';
  const value = line.split(/[:：]/).slice(1).join(':').trim();
  return value || '';
};

const parseNumberValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return 0;
  const num = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
};

const parsePercentValue = (value: string | null | undefined) => clampPercent(parseNumberValue(value));
const parseBooleanValue = (value: string | null | undefined) => ['y', 'yes', 'true', '1', '완료', 'checked'].includes(String(value || '').trim().toLowerCase());

const getDeadlineInfo = (deadlineText: string) => {
  if (!deadlineText) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineText);
  if (Number.isNaN(deadline.getTime())) return null;
  deadline.setHours(0, 0, 0, 0);
  const diff = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
  return { diff, overdue: diff < 0, urgent: diff >= 0 && diff <= 3 };
};

const getFinalProgress = (site: SiteData) => {
  const description = site.description || '';
  const contractQuantity = parseNumberValue(parseLabeledValue(description, '물량'));
  const pipeRate = parsePercentValue(parseLabeledValue(description, '하지파이프 진행률') || parseLabeledValue(description, '하지파이프 설치율'));
  const caulkingRate = parsePercentValue(parseLabeledValue(description, '코킹작업 진행률'));
  const startDocsDone = parseBooleanValue(parseLabeledValue(description, '착수서류 완료'));
  const completionDocsDone = parseBooleanValue(parseLabeledValue(description, '준공서류 완료'));
  const shippedQuantity = (site.shipments || []).reduce((sum, item) => sum + parseNumberValue(item?.quantity), 0);
  const panelRate = contractQuantity > 0 ? clampPercent((shippedQuantity / contractQuantity) * 100) : 0;
  return clampPercent((pipeRate + panelRate + caulkingRate + (startDocsDone ? 100 : 0) + (completionDocsDone ? 100 : 0)) / 5);
};

const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
    <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${value}%` }} />
  </div>
);

const SitesList = () => {
  const { t } = useTranslation('common');
  const [sites, setSites] = useState<SiteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: profileData } = useSWR('/api/my/profile', fetcher);

  const role = profileData?.data?.role || profileData?.data?.teamMembers?.[0]?.role || 'USER';
  const companyDisplayName = profileData?.data?.companyDisplayName || 'LOOKUP9';
  const canCreate = !['PARTNER', 'GUEST', 'VIEWER'].includes(role);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const res = await fetch(`/api/sites?${params}`);
    if (res.ok) {
      const data = await res.json();
      setSites(data.data || []);
    }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { fetchSites(); }, [fetchSites]);
  useEffect(() => {
    const interval = setInterval(fetchSites, 30000);
    return () => clearInterval(interval);
  }, [fetchSites]);

  const counts = useMemo(() => ({
    total: sites.length,
    urgent: sites.filter((site) => {
      const deadline = parseLabeledValue(site.description, '납품기한');
      const info = getDeadlineInfo(deadline);
      return !!info?.urgent;
    }).length,
    active: sites.filter((site) => ['진행중', '부분완료'].includes(site.status)).length,
    salesDone: sites.filter((site) => site.status === '계약완료').length,
  }), [sites]);

  return (
    <>
      <Head><title>{t('nav-sites')} | {companyDisplayName}</title></Head>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-black/20 p-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-gray-400">{companyDisplayName}</p>
            <h2 className="mt-1 text-2xl font-bold">{['PARTNER', 'GUEST', 'VIEWER'].includes(role) ? '배정된 현장' : '회사 전체 현장'}</h2>
          </div>
          {canCreate && (
            <Link href="/sites/create">
              <Button color="primary" size="sm"><PlusIcon className="mr-1 h-4 w-4" />{t('site-create')}</Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard title="전체 현장" value={counts.total} />
          <SummaryCard title="계약완료" value={counts.salesDone} />
          <SummaryCard title="진행중" value={counts.active} />
          <SummaryCard title="납기 임박" value={counts.urgent} danger={counts.urgent > 0} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" className="input input-bordered w-full pl-10" placeholder={t('site-search-placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select select-bordered" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">전체 상태</option>
            <option value="영업중">영업중</option>
            <option value="계약완료">계약완료</option>
            <option value="진행중">진행중</option>
            <option value="부분완료">부분완료</option>
            <option value="완료">완료</option>
            <option value="보류">보류</option>
          </select>
        </div>

        {loading ? (
          <div className="py-10 text-center"><span className="loading loading-spinner loading-md"></span></div>
        ) : sites.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-700 py-12 text-center text-gray-500">조회된 현장이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {sites.map((site) => {
              const finalProgress = getFinalProgress(site);
              const deadlineText = parseLabeledValue(site.description, '납품기한');
              const deadlineInfo = getDeadlineInfo(deadlineText);
              const siteType = parseLabeledValue(site.description, '현장구분');
              return (
                <Link key={site.id} href={`/sites/${site.id}`}>
                  <div className="cursor-pointer rounded-2xl border border-gray-800 bg-black/20 p-5 transition hover:border-gray-600 hover:bg-black/30">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                          <h3 className="truncate text-lg font-bold">{site.name}</h3>
                          <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{site.status}</span>
                          {siteType ? <span className="rounded-full border border-blue-900/60 bg-blue-950/30 px-2 py-0.5 text-xs text-blue-300">{siteType}</span> : null}
                        </div>
                        {site.address ? <p className="mt-2 break-words text-sm text-gray-400">{site.address}</p> : null}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                          <span>수요처: {site.client?.name || '-'}</span>
                          <span>최근수정: {new Date(site.updatedAt || site.createdAt).toLocaleDateString('ko-KR')}</span>
                          <span>작성자: {site.createdBy.position ? `${site.createdBy.position} ` : ''}{site.createdBy.name}</span>
                        </div>
                      </div>
                      <div className={`w-full rounded-xl border px-3 py-2 text-xs md:w-[210px] ${deadlineInfo?.overdue || deadlineInfo?.urgent ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-gray-700 bg-gray-900/40 text-gray-300'}`}>
                        <div className="font-semibold">납품기한</div>
                        <div className="mt-1">{deadlineText ? `${deadlineText}${deadlineInfo ? ` · ${deadlineInfo.overdue ? '지남' : `D-${deadlineInfo.diff}`}` : ''}` : '미입력'}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl bg-gray-900/40 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                        <span>최종 공정률</span>
                        <span>{finalProgress}%</span>
                      </div>
                      <ProgressBar value={finalProgress} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

const SummaryCard = ({ title, value, danger = false }: { title: string; value: number; danger?: boolean }) => (
  <div className={`rounded-2xl border p-4 ${danger ? 'border-red-500/40 bg-red-500/10' : 'border-gray-800 bg-black/20'}`}>
    <p className={`text-sm ${danger ? 'text-red-300' : 'text-gray-400'}`}>{title}</p>
    <p className="mt-2 text-2xl font-bold">{value}</p>
  </div>
);

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SitesList;
