/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import {
  BuildingOffice2Icon, ExclamationTriangleIcon,
  EnvelopeIcon, ClipboardDocumentListIcon,
  MegaphoneIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500', 대기: 'bg-red-400', 계약완료: 'bg-yellow-400',
  진행중: 'bg-green-500', 부분완료: 'bg-green-300', 완료: 'bg-gray-400', 보류: 'bg-gray-600',
};

const Dashboard = () => {
  const { data: profileData } = useSWR('/api/my/profile', fetcher, { refreshInterval: 30000 });
  const profile = profileData?.data || {};
  const userRole = profile.role || profile.teamMembers?.[0]?.role || 'USER';
  const isGuest = userRole === 'GUEST' || userRole === 'VIEWER';

  const { data } = useSWR('/api/dashboard/stats', fetcher, { refreshInterval: 30000 });
  const stats = data?.data;

  const companyName = profile.company || profile.teamMembers?.[0]?.team?.name || 'LOOKUP9';

  if (isGuest) return <GuestDashboard profile={profile} />;

  const summaryCards = [
    {
      label: '진행중 현장', value: stats?.activeSites ?? '-',
      icon: BuildingOffice2Icon, color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-900/40',
      href: '/sites',
    },
    {
      label: '이슈 현장', value: stats?.issueSites ?? '-',
      icon: ExclamationTriangleIcon,
      color: (stats?.issueSites ?? 0) > 0 ? 'text-red-400' : 'text-gray-400',
      bg: (stats?.issueSites ?? 0) > 0 ? 'bg-red-900/20 border-red-800/50' : 'bg-black/20 border-gray-800',
      href: '/sites',
    },
    {
      label: '미처리 요청', value: stats?.openRequests ?? '-',
      icon: ClipboardDocumentListIcon,
      color: (stats?.openRequests ?? 0) > 0 ? 'text-yellow-400' : 'text-gray-400',
      bg: (stats?.openRequests ?? 0) > 0 ? 'bg-yellow-900/20 border-yellow-800/40' : 'bg-black/20 border-gray-800',
      href: '/sites',
    },
    {
      label: '안읽은 쪽지', value: stats?.unreadMessages ?? '-',
      icon: EnvelopeIcon, color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-900/40',
      href: '/messages',
    },
  ];

  return (
    <>
      <Head><title>대시보드 | LOOKUP9</title></Head>
      <div className="space-y-5">
        {/* 헤더 */}
        <div>
          <p className="text-xs text-gray-500">{companyName}</p>
          <h2 className="mt-0.5 text-xl font-bold">대시보드</h2>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaryCards.map((c) => (
            <Link key={c.label} href={c.href}>
              <div className={`cursor-pointer rounded-xl border p-4 transition hover:opacity-80 ${c.bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <c.icon className={`h-4 w-4 ${c.color}`} />
                  <p className="text-xs text-gray-400">{c.label}</p>
                </div>
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* 공지 + 이슈현장 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* 공지사항 */}
          <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <MegaphoneIcon className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-semibold">공지사항</h3>
            </div>
            {!stats?.notices?.length ? (
              <p className="text-sm text-gray-500 py-4 text-center">공지사항이 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-800">
                {stats.notices.map((n: any) => (
                  <div key={n.id} className="py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {n.isPinned && <span className="badge badge-xs badge-warning mr-1.5">공지</span>}
                        <span className="text-sm">{n.title}</span>
                      </div>
                      <span className="text-[11px] text-gray-500 flex-shrink-0">
                        {new Date(n.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 이슈 현장 목록 */}
          <div className="rounded-xl border border-gray-800 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-4 w-4 text-red-400" />
              <h3 className="text-sm font-semibold">이슈 현장</h3>
            </div>
            {!stats?.recentSites?.length ? (
              <p className="text-sm text-gray-500 py-4 text-center">진행중인 현장이 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-800">
                {stats.recentSites.map((s: any) => {
                  const hasIssue = (s._count?.issues ?? 0) > 0;
                  return (
                    <Link key={s.id} href={`/sites/${s.id}`}>
                      <div className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-gray-800/30 rounded px-1 -mx-1 transition">
                        <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[s.status] || 'bg-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">{s.name}</span>
                            {hasIssue && (
                              <span className="flex-shrink-0 text-[10px] rounded-full bg-red-900/40 px-1.5 text-red-300">
                                이슈 {s._count.issues}
                              </span>
                            )}
                          </div>
                          {s.client?.name && <p className="text-[11px] text-gray-500">{s.client.name}</p>}
                        </div>
                        <ChevronRightIcon className="h-3.5 w-3.5 text-gray-600 flex-shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            <Link href="/sites">
              <p className="mt-3 text-center text-xs text-gray-500 hover:text-gray-300 cursor-pointer">전체 현장 보기 →</p>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

// ── 게스트 전용 대시보드 ──
const GuestDashboard = ({ profile }: { profile: any }) => {
  const mySites = profile.siteAssignments?.map((a: any) => a.site).filter(Boolean) || [];
  return (
    <>
      <Head><title>대시보드 | LOOKUP9</title></Head>
      <div className="space-y-4">
        <h2 className="text-lg font-bold">안녕하세요, {profile.name}님</h2>
        <p className="text-sm text-gray-400">배정된 현장을 확인하세요.</p>
        {mySites.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-12 text-center text-sm text-gray-500">
            배정된 현장이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {mySites.map((site: any) => (
              <Link key={site.id} href={`/sites/${site.id}`}>
                <div className="cursor-pointer rounded-xl border border-gray-800 bg-black/20 p-4 transition hover:border-gray-600">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                    <h3 className="font-bold">{site.name}</h3>
                    <span className="text-xs text-gray-400 ml-auto">{site.status}</span>
                  </div>
                  {site.address && <p className="text-sm text-gray-400 mt-1">{site.address}</p>}
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

export default Dashboard;
