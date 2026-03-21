/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useCallback } from 'react';
import {
  BuildingOffice2Icon, ExclamationTriangleIcon,
  EnvelopeIcon, ClipboardDocumentListIcon,
  MegaphoneIcon, ChevronRightIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import PullToRefresh from '@/components/shared/PullToRefresh';

const STATUS_DOT: Record<string, string> = {
  SALES_PIPELINE: 'bg-orange-500',
  SALES_CONFIRMED: 'bg-yellow-400',
  CONTRACT_ACTIVE: 'bg-green-500',
  COMPLETED: 'bg-blue-400',
  WARRANTY: 'bg-purple-400',
  FAILED: 'bg-gray-500',
};

// ── 공지사항 모달 ──
const NoticeModal = ({ notice, onClose }: { notice: any; onClose: () => void }) => {
  if (!notice) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl p-6 slide-up"
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-base)', boxShadow: 'var(--shadow-elevated)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {notice.isPinned && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold status-warning">공지</span>
            )}
            <h3 className="text-base font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{notice.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          {notice.author?.name && <span>{notice.author.name}</span>}
          {notice.author?.position && <span>{notice.author.position}</span>}
          <span>{new Date(notice.createdAt).toLocaleDateString('ko-KR')}</span>
        </div>

        <div
          className="text-sm leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--text-secondary)' }}
        >
          {notice.content}
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="btn btn-sm btn-ghost">닫기</button>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [selectedNotice, setSelectedNotice] = useState<any>(null);

  const { data: profileData, mutate: mutateProfile } = useSWR('/api/my/profile', fetcher, { refreshInterval: 30000 });
  const profile = profileData?.data || {};
  const userRole = profile.role || profile.teamMembers?.[0]?.role || 'USER';
  const isGuest = userRole === 'GUEST' || userRole === 'VIEWER';
  const isPartner = userRole === 'PARTNER';

  const { data, mutate: mutateStats } = useSWR('/api/dashboard/stats', fetcher, { refreshInterval: 30000 });
  const stats = data?.data;

  const companyName = profile.company || profile.teamMembers?.[0]?.team?.name || 'LOOKUP9';

  const handleRefresh = useCallback(async () => {
    await Promise.all([mutateProfile(), mutateStats()]);
  }, [mutateProfile, mutateStats]);

  if (isGuest) return <GuestDashboard profile={profile} onRefresh={handleRefresh} />;
  if (isPartner) return <PartnerQuickDashboard profile={profile} stats={stats} onRefresh={handleRefresh} />;

  const summaryCards = [
    {
      label: '진행중 현장', value: stats?.activeSites ?? '-',
      icon: BuildingOffice2Icon,
      colorVar: '--info-text', bgVar: '--info-bg', borderVar: '--info-border',
      href: '/sites',
    },
    {
      label: '이슈 현장', value: stats?.issueSites ?? '-',
      icon: ExclamationTriangleIcon,
      colorVar: (stats?.issueSites ?? 0) > 0 ? '--danger-text' : '--text-muted',
      bgVar: (stats?.issueSites ?? 0) > 0 ? '--danger-bg' : '--bg-card',
      borderVar: (stats?.issueSites ?? 0) > 0 ? '--danger-border' : '--border-base',
      href: '/sites',
    },
    {
      label: '미처리 요청', value: stats?.openRequests ?? '-',
      icon: ClipboardDocumentListIcon,
      colorVar: (stats?.openRequests ?? 0) > 0 ? '--warning-text' : '--text-muted',
      bgVar: (stats?.openRequests ?? 0) > 0 ? '--warning-bg' : '--bg-card',
      borderVar: (stats?.openRequests ?? 0) > 0 ? '--warning-border' : '--border-base',
      href: '/sites',
    },
    {
      label: '안읽은 쪽지', value: stats?.unreadMessages ?? '-',
      icon: EnvelopeIcon,
      colorVar: '--brand-text', bgVar: '--brand-light', borderVar: '--border-base',
      href: '/messages',
    },
  ];

  return (
    <>
      <Head><title>대시보드 | LOOKUP9</title></Head>

      {selectedNotice && (
        <NoticeModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />
      )}

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="space-y-5">
          {/* 헤더 */}
          <div>
            <p className="text-xs" style={{color:"var(--text-muted)"}}>{companyName}</p>
            <h2 className="mt-0.5 text-xl font-bold" style={{color:"var(--text-primary)"}}>대시보드</h2>
          </div>

          {/* 요약 카드 — CSS 변수 기반으로 테마 자동 전환 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaryCards.map((c) => (
              <Link key={c.label} href={c.href}>
                <div
                  className="cursor-pointer rounded-xl p-4 transition-all hover:shadow-md active:scale-[0.98]"
                  style={{
                    backgroundColor: `var(${c.bgVar})`,
                    border: `1px solid var(${c.borderVar})`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <c.icon className="h-4 w-4" style={{ color: `var(${c.colorVar})` }} />
                    <p className="text-xs" style={{color:"var(--text-secondary)"}}>{c.label}</p>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: `var(${c.colorVar})` }}>{c.value}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* 공지 + 현장 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* 공지사항 */}
            <div className="rounded-xl p-4" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-surface)"}}>
              <div className="mb-3 flex items-center gap-2">
                <MegaphoneIcon className="h-4 w-4" style={{color:"var(--text-muted)"}} />
                <h3 className="text-sm font-semibold" style={{color:"var(--text-primary)"}}>공지사항</h3>
              </div>
              {!stats?.notices?.length ? (
                <p className="text-sm py-6 text-center" style={{color:"var(--text-muted)"}}>공지사항이 없습니다.</p>
              ) : (
                <div className="divide-y" style={{borderColor:"var(--border-subtle)"}}>
                  {stats.notices.map((n: any) => (
                    <div
                      key={n.id}
                      className="py-3 cursor-pointer rounded-lg px-2 -mx-2 transition-colors"
                      style={{ minHeight: '44px' }}
                      onClick={() => setSelectedNotice(n)}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {n.isPinned && <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold status-warning flex-shrink-0">공지</span>}
                          <span className="text-sm truncate" style={{color:"var(--text-primary)"}}>{n.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[11px]" style={{color:"var(--text-muted)"}}>
                            {new Date(n.createdAt).toLocaleDateString('ko-KR')}
                          </span>
                          <ChevronRightIcon className="h-3 w-3" style={{color:"var(--text-muted)"}} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 최근 진행 현장 */}
            <div className="rounded-xl p-4" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-surface)"}}>
              <div className="mb-3 flex items-center gap-2">
                <BuildingOffice2Icon className="h-4 w-4" style={{color:"var(--info-text)"}} />
                <h3 className="text-sm font-semibold" style={{color:"var(--text-primary)"}}>진행중 현장</h3>
              </div>
              {!stats?.recentSites?.length ? (
                <p className="text-sm py-6 text-center" style={{color:"var(--text-muted)"}}>진행중인 현장이 없습니다.</p>
              ) : (
                <div className="divide-y" style={{borderColor:"var(--border-subtle)"}}>
                  {stats.recentSites.map((s: any) => {
                    const hasIssue = (s._count?.issues ?? 0) > 0;
                    return (
                      <Link key={s.id} href={`/sites/${s.id}`}>
                        <div
                          className="flex items-center gap-3 py-3 cursor-pointer rounded-lg px-2 -mx-2 transition-colors"
                          style={{color:"var(--text-primary)", minHeight: '44px'}}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[s.status] || 'bg-gray-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium truncate">{s.name}</span>
                              {hasIssue && (
                                <span className="flex-shrink-0 text-[10px] rounded-full px-1.5 py-0.5 font-medium status-danger">
                                  이슈 {s._count.issues}
                                </span>
                              )}
                            </div>
                            {s.client?.name && <p className="text-[11px]" style={{color:"var(--text-muted)"}}>{s.client.name}</p>}
                          </div>
                          <ChevronRightIcon className="h-3.5 w-3.5 flex-shrink-0" style={{color:"var(--text-muted)"}} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
              <Link href="/sites">
                <p className="mt-3 text-center text-xs cursor-pointer font-medium" style={{color:"var(--brand)"}}>전체 현장 보기 →</p>
              </Link>
            </div>

            {/* 하자보수 만료 임박 */}
            {(stats?.warrantyExpiring?.length ?? 0) > 0 && (
              <div className="rounded-xl p-4" style={{backgroundColor:"var(--warning-bg)",border:"1px solid var(--warning-border)"}}>
                <div className="mb-3 flex items-center gap-2">
                  <ClipboardDocumentListIcon className="h-4 w-4" style={{color:"var(--warning-text)"}} />
                  <h3 className="text-sm font-semibold" style={{color:"var(--warning-text)"}}>하자보수 만료 임박</h3>
                  <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold status-warning">{stats.warrantyExpiring.length}</span>
                </div>
                <div className="divide-y" style={{borderColor:"var(--warning-border)"}}>
                  {stats.warrantyExpiring.map((s: any) => (
                    <Link key={s.id} href={`/sites/${s.id}`}>
                      <div className="flex items-center justify-between py-3 cursor-pointer rounded-lg px-2 -mx-2 transition-colors"
                        style={{ minHeight: '44px' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{color:"var(--text-primary)"}}>{s.name}</p>
                          <p className="text-[11px]" style={{color:"var(--text-muted)"}}>
                            만료: {new Date(s.expiryDate).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                        <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ml-2 ${
                          s.daysLeft <= 30 ? 'status-danger' : 'status-warning'
                        }`}>
                          D-{s.daysLeft}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
    </>
  );
};

// ── 게스트 전용 대시보드 ──
const GuestDashboard = ({ profile, onRefresh }: { profile: any; onRefresh: () => Promise<void> }) => {
  const mySites = profile.mySites || profile.siteAssignments?.map((a: any) => a.site).filter(Boolean) || [];
  return (
    <>
      <Head><title>대시보드 | LOOKUP9</title></Head>
      <PullToRefresh onRefresh={onRefresh}>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold" style={{color:"var(--text-primary)"}}>안녕하세요, {profile.name}님</h2>
            <p className="text-sm mt-1" style={{color:"var(--text-secondary)"}}>배정된 현장 {mySites.length}건</p>
          </div>
          {mySites.length === 0 ? (
            <div className="rounded-xl py-12 text-center" style={{border:"2px dashed var(--border-base)",color:"var(--text-muted)"}}>
              <BuildingOffice2Icon className="h-10 w-10 mx-auto mb-3" style={{color:"var(--text-muted)"}} />
              <p className="text-sm font-medium">배정된 현장이 없습니다.</p>
              <p className="text-xs mt-1" style={{color:"var(--text-muted)"}}>관리자에게 현장 배정을 요청해주세요.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {mySites.map((site: any) => (
                <Link key={site.id} href={`/sites/${site.id}`}>
                  <div className="cursor-pointer rounded-xl p-4 transition-all active:scale-[0.98]" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-surface)"}}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                      <h3 className="font-bold flex-1 min-w-0 truncate" style={{color:"var(--text-primary)"}}>{site.name}</h3>
                      <ChevronRightIcon className="h-4 w-4 shrink-0" style={{color:"var(--text-muted)"}} />
                    </div>
                    {site.address && <p className="text-sm mt-1.5 pl-4" style={{color:"var(--text-secondary)"}}>{site.address}</p>}
                    <div className="flex items-center gap-3 mt-2 pl-4">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        backgroundColor: site.status === 'CONTRACT_ACTIVE' ? 'var(--success-bg)' : 'var(--bg-hover)',
                        color: site.status === 'CONTRACT_ACTIVE' ? 'var(--success-text)' : 'var(--text-muted)',
                        border: `1px solid ${site.status === 'CONTRACT_ACTIVE' ? 'var(--success-border)' : 'var(--border-base)'}`,
                      }}>
                        {site.status === 'CONTRACT_ACTIVE' ? '진행중' : site.status === 'COMPLETED' ? '준공완료' : site.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </PullToRefresh>
    </>
  );
};

// ── 협력사 전용 대시보드 ──
const PartnerQuickDashboard = ({ profile, stats, onRefresh }: { profile: any; stats: any; onRefresh: () => Promise<void> }) => {
  const mySites = profile.mySites || [];
  const activeSites = mySites.filter((s: any) => ['CONTRACT_ACTIVE', 'SALES_CONFIRMED'].includes(s.status));
  const companyName = profile.company || '';
  const [selectedNotice, setSelectedNotice] = useState<any>(null);

  // 간단 집계
  const totalQty = activeSites.reduce((s: number, site: any) => s + Number(site.contractQuantity || 0), 0);

  return (
    <>
      <Head><title>대시보드 | LOOKUP9</title></Head>
      <PullToRefresh onRefresh={onRefresh}>
        <div className="space-y-4">
          <div>
            {companyName && <p className="text-xs" style={{color:"var(--text-muted)"}}>{companyName}</p>}
            <h2 className="text-lg font-bold" style={{color:"var(--text-primary)"}}>안녕하세요, {profile.name}님</h2>
          </div>

          {/* 공지사항 */}
          {stats?.notices?.length > 0 && (
            <div className="rounded-xl p-4" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
              <p className="text-xs font-semibold mb-2" style={{color:"var(--text-primary)"}}>공지사항</p>
              <div className="space-y-1.5">
                {stats.notices.slice(0, 5).map((n: any) => (
                  <div key={n.id} className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-2 transition-colors"
                    style={{backgroundColor:'transparent'}}
                    onClick={() => setSelectedNotice(n)}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    {n.isPinned && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                    <span className="text-sm truncate flex-1" style={{color:"var(--text-primary)"}}>{n.title}</span>
                    <span className="text-[10px] shrink-0" style={{color:"var(--text-muted)"}}>{new Date(n.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-2.5">
            <Link href="/partner/dashboard">
              <div className="rounded-xl p-4 text-center cursor-pointer transition-all active:scale-[0.98]" style={{border:"1px solid var(--info-border)",backgroundColor:"var(--info-bg)"}}>
                <p className="text-2xl font-bold" style={{color:"var(--info-text)"}}>{activeSites.length}</p>
                <p className="text-[11px] mt-1" style={{color:"var(--text-muted)"}}>진행중 현장</p>
              </div>
            </Link>
            <Link href="/partner/dashboard">
              <div className="rounded-xl p-4 text-center cursor-pointer transition-all active:scale-[0.98]" style={{border:"1px solid var(--success-border)",backgroundColor:"var(--success-bg)"}}>
                <p className="text-2xl font-bold" style={{color:"var(--success-text)"}}>{totalQty > 0 ? totalQty.toLocaleString() : '-'}</p>
                <p className="text-[11px] mt-1" style={{color:"var(--text-muted)"}}>계약물량(m²)</p>
              </div>
            </Link>
            <Link href="/sites">
              <div className="rounded-xl p-4 text-center cursor-pointer transition-all active:scale-[0.98]" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
                <p className="text-2xl font-bold" style={{color:"var(--text-primary)"}}>{mySites.length}</p>
                <p className="text-[11px] mt-1" style={{color:"var(--text-muted)"}}>전체 현장</p>
              </div>
            </Link>
          </div>

          {/* 배정 현장 목록 */}
          <div>
            <p className="text-sm font-semibold mb-2" style={{color:"var(--text-primary)"}}>배정 현장</p>
            {mySites.length === 0 ? (
              <div className="rounded-xl py-10 text-center" style={{border:"2px dashed var(--border-base)",color:"var(--text-muted)"}}>
                <p className="text-sm">배정된 현장이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mySites.map((site: any) => (
                  <Link key={site.id} href={`/sites/${site.id}`}>
                    <div className="rounded-xl p-3.5 cursor-pointer transition-all active:scale-[0.99]" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
                        <p className="text-sm font-medium truncate flex-1" style={{color:"var(--text-primary)"}}>{site.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                          backgroundColor: site.status === 'CONTRACT_ACTIVE' ? 'var(--success-bg)' : 'var(--bg-hover)',
                          color: site.status === 'CONTRACT_ACTIVE' ? 'var(--success-text)' : 'var(--text-muted)',
                          border: `1px solid ${site.status === 'CONTRACT_ACTIVE' ? 'var(--success-border)' : 'var(--border-base)'}`,
                        }}>
                          {site.status === 'CONTRACT_ACTIVE' ? '진행중' : site.status === 'COMPLETED' ? '준공완료' : site.status}
                        </span>
                        <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" style={{color:"var(--text-muted)"}} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </PullToRefresh>
      {selectedNotice && <NoticeModal notice={selectedNotice} onClose={() => setSelectedNotice(null)} />}
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default Dashboard;
