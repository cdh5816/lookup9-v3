/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import {
  BuildingOffice2Icon,
  TruckIcon,
  EnvelopeIcon,
  BellIcon,
  MegaphoneIcon,
  ChatBubbleLeftIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500', 대기: 'bg-red-400', 계약완료: 'bg-yellow-400',
  진행중: 'bg-green-500', 부분완료: 'bg-green-300', 완료: 'bg-gray-400', 보류: 'bg-gray-600',
};

function getDeadlineText(desc?: string | null): string | null {
  if (!desc) return null;
  const m = desc.match(/납품기한\s*[:：]\s*(\d{4}-\d{2}-\d{2})/);
  return m?.[1] || null;
}

function getDday(dateStr: string | null): { diff: number; label: string; urgent: boolean } | null {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  return {
    diff,
    label: diff < 0 ? `D+${Math.abs(diff)}` : diff === 0 ? 'D-Day' : `D-${diff}`,
    urgent: diff <= 7,
  };
}

const Dashboard = () => {
  const { data: profileData } = useSWR('/api/my/profile', fetcher, { refreshInterval: 30000 });
  const profile = profileData?.data || {};
  const userRole = profile.role || profile.teamMembers?.[0]?.role || 'USER';
  const companyDisplayName = profile.companyDisplayName || 'LOOKUP9';

  const isExternal = ['PARTNER', 'GUEST', 'VIEWER'].includes(userRole);

  const { data: statsData } = useSWR('/api/dashboard/stats', fetcher, { refreshInterval: 30000 });
  const stats = statsData?.data;

  const { data: noticeData } = useSWR(!isExternal ? '/api/notices?limit=5' : null, fetcher);
  const notices = noticeData?.data || [];

  if (isExternal) return <ExternalDashboard profile={profile} userRole={userRole} />;

  const summaryCards = [
    {
      label: '진행중 현장',
      value: stats?.activeSites ?? '-',
      icon: BuildingOffice2Icon,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      href: '/sites?status=진행중',
    },
    {
      label: '미처리 요청',
      value: stats?.openRequests ?? '-',
      icon: ClipboardDocumentCheckIcon,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      href: '/sites',
      alert: (stats?.openRequests ?? 0) > 0,
    },
    {
      label: '납기 임박 (7일)',
      value: stats?.deadlineUrgent ?? '-',
      icon: ExclamationTriangleIcon,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      href: '/sites',
      alert: (stats?.deadlineUrgent ?? 0) > 0,
    },
    {
      label: '안읽은 쪽지',
      value: stats?.unreadMessages ?? '-',
      icon: EnvelopeIcon,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      href: '/messages',
    },
  ];

  return (
    <>
      <Head><title>대시보드 | {companyDisplayName}</title></Head>
      <div className="space-y-5">

        {/* 인사말 */}
        <div>
          <p className="text-xs text-gray-500">{companyDisplayName}</p>
          <h2 className="mt-0.5 text-xl font-bold">
            안녕하세요, {profile.position ? `${profile.position} ` : ''}{profile.name}님
          </h2>
        </div>

        {/* 요약 카드 4개 */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaryCards.map((c) => (
            <Link key={c.label} href={c.href}>
              <div className={`relative rounded-xl border p-4 transition hover:border-gray-600 cursor-pointer ${c.alert ? 'border-red-800/60 bg-red-900/10' : 'border-gray-800 bg-black/20'}`}>
                {c.alert && (
                  <span className="absolute right-3 top-3 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                )}
                <div className={`inline-flex rounded-lg p-2 ${c.bg} mb-2`}>
                  <c.icon className={`h-4 w-4 ${c.color}`} />
                </div>
                <p className="text-xs text-gray-400">{c.label}</p>
                <p className={`text-2xl font-bold mt-0.5 ${c.alert ? c.color : ''}`}>{c.value}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* 하단 2단 레이아웃 */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">

          {/* 왼쪽: 최근 활성 현장 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300">최근 활성 현장</h3>
              <Link href="/sites" className="text-xs text-blue-400 hover:underline">전체 보기</Link>
            </div>
            {!stats?.recentSites?.length ? (
              <div className="rounded-xl border border-dashed border-gray-700 py-10 text-center text-sm text-gray-500">
                진행중인 현장이 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {stats.recentSites.map((site: any) => {
                  const deadline = getDeadlineText(site.description);
                  const dday = getDday(deadline);
                  return (
                    <Link key={site.id} href={`/sites/${site.id}`}>
                      <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-black/20 px-4 py-3 transition hover:border-gray-600 cursor-pointer">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-500'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{site.name}</p>
                          {site.address && (
                            <p className="truncate text-xs text-gray-500">{site.address}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs text-gray-500">
                          {site._count?.requests > 0 && (
                            <span className="badge badge-xs badge-warning">{site._count.requests}</span>
                          )}
                          {dday && (
                            <span className={`font-mono ${dday.urgent ? 'text-red-400' : 'text-gray-400'}`}>
                              {dday.label}
                            </span>
                          )}
                          <span className="rounded-full border border-gray-700 px-1.5 py-0.5">{site.status}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* 최근 댓글 */}
            {stats?.recentComments?.length > 0 && (
              <div className="mt-2 space-y-1">
                <h3 className="text-sm font-semibold text-gray-300 pt-1">최근 댓글</h3>
                {stats.recentComments.map((c: any) => (
                  <Link key={c.id} href={`/sites/${c.site?.id}`}>
                    <div className="flex items-start gap-3 rounded-lg border border-gray-800 px-3 py-2.5 hover:bg-gray-800/30 cursor-pointer">
                      <ChatBubbleLeftIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 mb-0.5">[{c.site?.name}]</p>
                        <p className="truncate text-sm text-gray-300">
                          {c.content.length > 50 ? c.content.slice(0, 50) + '…' : c.content}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-600">
                        {c.author?.position ? `${c.author.position} ` : ''}{c.author?.name}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 오른쪽: 공지사항 + 상태별 카운트 */}
          <div className="space-y-4">
            {/* 공지사항 */}
            <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <MegaphoneIcon className="h-4 w-4 text-red-400" />
                <h3 className="text-sm font-semibold">공지사항</h3>
              </div>
              {notices.length === 0 ? (
                <p className="text-xs text-gray-500">등록된 공지가 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {notices.map((n: any) => (
                    <div key={n.id} className="border-b border-gray-800 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center gap-1.5">
                        {n.isPinned && <span className="badge badge-xs badge-error">PIN</span>}
                        <p className="text-sm font-medium line-clamp-1">{n.title}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {n.author?.position ? `${n.author.position} ` : ''}{n.author?.name}
                        {' · '}{new Date(n.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 현장 상태별 요약 */}
            <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
              <h3 className="mb-3 text-sm font-semibold">현장 상태 현황</h3>
              <div className="space-y-2">
                {[
                  { label: '영업중', color: 'bg-red-500' },
                  { label: '계약완료', color: 'bg-yellow-400' },
                  { label: '진행중', color: 'bg-green-500' },
                  { label: '부분완료', color: 'bg-green-300' },
                  { label: '완료', color: 'bg-gray-400' },
                  { label: '보류', color: 'bg-gray-600' },
                ].map(({ label, color }) => {
                  const count = stats?.statusCounts?.[label] ?? 0;
                  const total = stats?.totalSites ?? 1;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
                      <span className="w-16 text-xs text-gray-400">{label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-800">
                        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-6 text-right text-xs text-gray-400">{count}</span>
                    </div>
                  );
                })}
              </div>
              <Link href="/sites" className="mt-3 block text-right text-xs text-blue-400 hover:underline">
                전체 현장 →
              </Link>
            </div>

            {/* 알림/쪽지 바로가기 */}
            <div className="grid grid-cols-2 gap-2">
              <Link href="/notifications">
                <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-black/20 px-3 py-2.5 hover:border-gray-600 cursor-pointer">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <BellIcon className="h-4 w-4 text-yellow-400" />
                    알림
                  </div>
                  {(stats?.unreadNotifications ?? 0) > 0 && (
                    <span className="badge badge-xs badge-warning">{stats.unreadNotifications}</span>
                  )}
                </div>
              </Link>
              <Link href="/messages">
                <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-black/20 px-3 py-2.5 hover:border-gray-600 cursor-pointer">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <EnvelopeIcon className="h-4 w-4 text-blue-400" />
                    쪽지
                  </div>
                  {(stats?.unreadMessages ?? 0) > 0 && (
                    <span className="badge badge-xs badge-primary">{stats.unreadMessages}</span>
                  )}
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ========= 외부 계정 (PARTNER / GUEST) 대시보드 =========
const ExternalDashboard = ({ profile, userRole }: { profile: any; userRole: string }) => {
  const isGuest = userRole === 'GUEST' || userRole === 'VIEWER';
  const mySites = profile.mySites || [];
  const { data: noticeData } = useSWR('/api/notices?limit=3', fetcher);
  const notices = noticeData?.data || [];

  return (
    <>
      <Head><title>대시보드 | LOOKUP9</title></Head>
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold">
            {profile.position ? `${profile.position} ` : ''}{profile.name}님
          </h2>
          <p className="mt-0.5 text-sm text-gray-400">
            {isGuest ? '배정된 현장을 확인하세요.' : '담당 현장 현황입니다.'}
          </p>
        </div>

        {notices.length > 0 && (
          <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <MegaphoneIcon className="h-4 w-4 text-red-400" />
              <h3 className="text-sm font-semibold">공지사항</h3>
            </div>
            <div className="space-y-2">
              {notices.map((n: any) => (
                <p key={n.id} className="text-sm text-gray-300 border-b border-gray-800 pb-2 last:border-0 last:pb-0">
                  {n.isPinned && <span className="badge badge-xs badge-error mr-1">PIN</span>}
                  {n.title}
                </p>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">배정된 현장 ({mySites.length})</h3>
          {mySites.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-700 py-10 text-center text-sm text-gray-500">
              배정된 현장이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {mySites.map((site: any) => (
                <Link key={site.id} href={isGuest ? `/guest/site/${site.id}` : `/sites/${site.id}`}>
                  <div className="rounded-xl border border-gray-800 bg-black/20 p-4 transition hover:border-gray-600 cursor-pointer">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                      <h4 className="font-semibold truncate">{site.name}</h4>
                      <span className="ml-auto shrink-0 text-xs text-gray-400">{site.status}</span>
                    </div>
                    {site.address && <p className="text-xs text-gray-500 truncate">{site.address}</p>}
                  </div>
                </Link>
              ))}
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

export default Dashboard;
