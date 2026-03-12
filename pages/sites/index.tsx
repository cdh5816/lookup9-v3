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
import useSWR from 'swr';
import { Button } from 'react-daisyui';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import fetcher from '@/lib/fetcher';

type SiteData = {
  id: string;
  name: string;
  address: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
  description?: string | null;
  client: { name: string } | null;
  createdBy: { name: string; position: string | null };
  _count: { assignments: number; comments: number };
};

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
  영업중: 12,
  대기: 8,
  계약완료: 35,
  진행중: 68,
  부분완료: 85,
  완료: 100,
  보류: 0,
};

const getDeadlineText = (description?: string | null) => {
  if (!description) return null;
  const match = description.match(/납품기한\s*[:：]\s*(\d{4}-\d{2}-\d{2})/);
  return match?.[1] || null;
};

const getSiteType = (description?: string | null) => {
  if (!description) return null;
  const match = description.match(/현장구분\s*[:：]\s*([^\n]+)/);
  return match?.[1]?.trim() || null;
};

const getDdayState = (deadlineText?: string | null) => {
  if (!deadlineText) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineText);
  deadline.setHours(0, 0, 0, 0);
  const diff = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
  return {
    diff,
    urgent: diff <= 3,
    overdue: diff < 0,
  };
};

const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
    <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

const SitesList = () => {
  const { t } = useTranslation('common');
  const [sites, setSites] = useState<SiteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: profileData } = useSWR('/api/my/profile', fetcher);

  const profile = profileData?.data;
  const companyDisplayName = profile?.companyDisplayName || 'LOOKUP9';
  const role = profile?.role || 'USER';
  const canCreate = !['PARTNER', 'GUEST', 'VIEWER'].includes(role);
  const listTitle = ['PARTNER', 'GUEST', 'VIEWER'].includes(role)
    ? '배정된 현장'
    : '회사 전체 현장';

  const fetchSites = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    const res = await fetch(`/api/sites?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setSites(data.data || []);
    }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const counts = useMemo(() => {
    return {
      total: sites.length,
      urgent: sites.filter((site) => {
        const state = getDdayState(getDeadlineText(site.description));
        return !!state?.urgent && !state.overdue;
      }).length,
      active: sites.filter((site) => ['진행중', '부분완료'].includes(site.status)).length,
      sales: sites.filter((site) => site.status === '영업중').length,
    };
  }, [sites]);

  return (
    <>
      <Head>
        <title>{t('nav-sites')} | {companyDisplayName}</title>
      </Head>

      <div className="space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-gray-800 bg-black/30 p-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-gray-400">{companyDisplayName}</p>
            <h2 className="mt-1 text-xl font-bold">{listTitle}</h2>
            <p className="mt-1 text-xs text-gray-500">
              내부 직원은 회사 전체 현장을 보고, 외부 계정은 배정 현장만 조회합니다.
            </p>
          </div>
          {canCreate && (
            <Link href="/sites/create">
              <Button color="primary" size="sm" className="gap-2">
                <PlusIcon className="h-4 w-4" />
                현장 등록
              </Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard title="전체" value={counts.total} />
          <SummaryCard title="영업중" value={counts.sales} />
          <SummaryCard title="진행중" value={counts.active} />
          <SummaryCard title="납기 임박" value={counts.urgent} danger={counts.urgent > 0} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input input-bordered w-full pl-10"
              placeholder={t('site-search-placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="select select-bordered w-full sm:w-[180px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
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
          <div className="rounded-2xl border border-dashed border-gray-700 py-12 text-center text-gray-500">
            조회된 현장이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {sites.map((site) => {
              const progress = STATUS_PROGRESS[site.status] ?? 0;
              const deadlineText = getDeadlineText(site.description);
              const deadlineState = getDdayState(deadlineText);
              const siteType = getSiteType(site.description);

              return (
                <Link key={site.id} href={`/sites/${site.id}`}>
                  <div className="cursor-pointer rounded-xl border border-gray-800 bg-black/20 p-4 transition hover:border-gray-600 hover:bg-black/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                          <h3 className="truncate text-base font-bold">{site.name}</h3>
                          <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-300">{site.status}</span>
                          {siteType && (
                            <span className="rounded-full border border-blue-900/60 bg-blue-950/30 px-2 py-0.5 text-[11px] text-blue-300">
                              {siteType}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-1 break-words text-xs text-gray-400">{site.address || '주소 미입력'}</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                          <span>수요처: {site.client?.name || '-'}</span>
                          <span>수정: {new Date(site.updatedAt || site.createdAt).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </div>

                      <div className={`rounded-lg border px-2 py-1.5 text-[11px] ${deadlineState?.overdue || deadlineState?.urgent ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-gray-700 bg-gray-900/40 text-gray-300'}`}>
                        <div className="font-semibold">납기</div>
                        <div className="mt-0.5 whitespace-nowrap">
                          {deadlineText
                            ? `${deadlineText}${deadlineState ? ` · ${deadlineState.overdue ? '지남' : `D-${deadlineState.diff}`}` : ''}`
                            : '미입력'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_92px_92px] gap-2">
                      <div className="rounded-lg bg-gray-900/40 p-2.5">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-gray-400">
                          <span>진행률</span>
                          <span>{progress}%</span>
                        </div>
                        <ProgressBar value={progress} />
                      </div>
                      <MiniStat title="인원" value={site._count?.assignments || 0} />
                      <MiniStat title="코멘트" value={site._count?.comments || 0} />
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
  <div className={`rounded-xl border p-3 ${danger ? 'border-red-500/40 bg-red-500/10' : 'border-gray-800 bg-black/20'}`}>
    <p className={`text-xs ${danger ? 'text-red-300' : 'text-gray-400'}`}>{title}</p>
    <p className="mt-1 text-xl font-bold">{value}</p>
  </div>
);

const MiniStat = ({ title, value }: { title: string; value: number }) => (
  <div className="rounded-lg bg-gray-900/40 p-2.5 text-center">
    <p className="text-[11px] text-gray-500">{title}</p>
    <p className="mt-1 text-sm font-bold">{value}</p>
  </div>
);

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SitesList;
