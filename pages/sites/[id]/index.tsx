import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { Button } from 'react-daisyui';

// 전체 탭 목록 (설계서 최종안)
const allTabs = ['overview', 'sales', 'contract', 'production', 'painting', 'shipping', 'documents', 'memo', 'schedule', 'comments'];

// Role별 숨길 탭
const hiddenTabsByRole: Record<string, string[]> = {
  PARTNER: ['sales', 'contract'],
  GUEST: ['sales', 'contract', 'production', 'painting', 'shipping', 'memo', 'schedule'],
};

const SiteDetail = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState('overview');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 현장 데이터 (30초 폴링)
  const { data, mutate } = useSWR(id ? `/api/sites/${id}` : null, fetcher, {
    refreshInterval: 30000,
  });
  const site = data?.data;

  // 유저 프로필 (Role 확인용)
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const userRole = profileData?.data?.teamMembers?.[0]?.role || 'USER';

  // Role별 탭 필터
  const hidden = hiddenTabsByRole[userRole] || [];
  const tabs = allTabs.filter((tab) => !hidden.includes(tab));

  const handleAddComment = useCallback(async () => {
    if (!comment.trim() || !id) return;
    setSubmitting(true);
    await fetch('/api/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: id, content: comment }),
    });
    setComment('');
    setSubmitting(false);
    mutate();
  }, [comment, id, mutate]);

  const handleDeleteSite = async () => {
    if (!confirm(t('site-delete-confirm'))) return;
    await fetch(`/api/sites/${id}`, { method: 'DELETE' });
    router.push('/sites');
  };

  if (!site) return <div className="text-center py-10"><span className="loading loading-spinner loading-md"></span></div>;

  // ADMIN_HR 이상만 삭제 가능
  const canDelete = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'].includes(userRole);

  return (
    <>
      <Head><title>{site.name} | LOOKUP9</title></Head>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{site.name}</h2>
            <p className="text-sm text-gray-400 mt-1">
              {site.address && `${site.address} · `}
              {site.createdBy.position ? `${site.createdBy.position} ${site.createdBy.name}` : site.createdBy.name}
              {` · ${new Date(site.createdAt).toLocaleDateString('ko-KR')}`}
            </p>
          </div>
          <div className="flex gap-2">
            <span className={`badge ${site.status === '진행중' ? 'badge-info' : site.status === '완료' ? 'badge-success' : 'badge-ghost'}`}>
              {site.status}
            </span>
            {canDelete && (
              <Button color="error" size="xs" onClick={handleDeleteSite}>{t('delete')}</Button>
            )}
          </div>
        </div>

        {/* 탭 */}
        <div className="border-b border-gray-800">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {t(`tab-${tab}`)}
              </button>
            ))}
          </div>
        </div>

        {/* 탭 내용 */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-gray-800 p-4">
                <p className="text-xs text-gray-500 mb-1">{t('site-client')}</p>
                <p className="font-medium">{site.client?.name || '-'}</p>
              </div>
              <div className="rounded-lg border border-gray-800 p-4">
                <p className="text-xs text-gray-500 mb-1">{t('site-status-label')}</p>
                <p className="font-medium">{site.status}</p>
              </div>
            </div>
            {site.description && (
              <div className="rounded-lg border border-gray-800 p-4">
                <p className="text-xs text-gray-500 mb-1">{t('site-description')}</p>
                <p className="text-sm whitespace-pre-wrap">{site.description}</p>
              </div>
            )}
            <div className="rounded-lg border border-gray-800 p-4">
              <p className="text-xs text-gray-500 mb-2">{t('site-assigned-members')}</p>
              {site.assignments.length === 0 ? (
                <p className="text-sm text-gray-500">{t('site-no-assignments')}</p>
              ) : (
                <div className="space-y-1">
                  {site.assignments.map((a: any) => (
                    <p key={a.id} className="text-sm">
                      {a.user.position ? `${a.user.position} ` : ''}{a.user.name}
                      <span className="text-gray-500 ml-2">{a.user.department || ''}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="rounded-lg border border-gray-800 p-6">
            <h3 className="font-semibold mb-3">{t('tab-sales')}</h3>
            {site.sales.length === 0 ? (
              <p className="text-sm text-gray-500">{t('site-no-data')}</p>
            ) : (
              site.sales.map((s: any) => (
                <div key={s.id} className="border-b border-gray-800 py-3 last:border-0">
                  <div className="flex justify-between">
                    <span className="badge badge-sm">{s.status}</span>
                    <span className="text-xs text-gray-500">{new Date(s.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  {s.estimateAmount && <p className="text-sm mt-1">{t('site-estimate')}: {Number(s.estimateAmount).toLocaleString()}</p>}
                  {s.meetingNotes && <p className="text-sm text-gray-400 mt-1">{s.meetingNotes}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'contract' && (
          <div className="rounded-lg border border-gray-800 p-6">
            <h3 className="font-semibold mb-3">{t('tab-contract')}</h3>
            {site.contracts.length === 0 ? (
              <p className="text-sm text-gray-500">{t('site-no-data')}</p>
            ) : (
              site.contracts.map((c: any) => (
                <div key={c.id} className="border-b border-gray-800 py-3 last:border-0">
                  <div className="flex justify-between">
                    <span className="badge badge-sm">{c.status}</span>
                    <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  {c.contractAmount && <p className="text-sm mt-1">{t('site-contract-amount')}: {Number(c.contractAmount).toLocaleString()}</p>}
                  {c.specialNotes && <p className="text-sm text-gray-400 mt-1">{c.specialNotes}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {(activeTab === 'production' || activeTab === 'painting' || activeTab === 'shipping') && (
          <div className="rounded-lg border border-gray-800 p-6 text-center">
            <p className="text-gray-500">{t('coming-soon')}</p>
          </div>
        )}

        {(activeTab === 'memo' || activeTab === 'schedule') && (
          <div className="rounded-lg border border-gray-800 p-6 text-center">
            <p className="text-gray-500">{t('coming-soon')}</p>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="rounded-lg border border-gray-800 p-6">
            <h3 className="font-semibold mb-3">{t('tab-documents')}</h3>
            <p className="text-sm text-gray-500">{site._count.documents} {t('site-documents-count')}</p>
            <p className="text-xs text-gray-500 mt-2">{t('coming-soon')}</p>
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <textarea
                className="textarea textarea-bordered flex-1"
                placeholder={t('comment-placeholder')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
              />
              <Button color="primary" size="sm" loading={submitting} onClick={handleAddComment}>
                {t('comment-submit')}
              </Button>
            </div>
            {site.comments.length === 0 ? (
              <p className="text-sm text-gray-500">{t('comment-none')}</p>
            ) : (
              <div className="space-y-3">
                {site.comments.map((c: any) => (
                  <div key={c.id} className="rounded-lg border border-gray-800 p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">
                        {c.author.position ? `${c.author.position} ` : ''}{c.author.name}
                        {c.author.department && <span className="text-gray-500 ml-1">({c.author.department})</span>}
                      </span>
                      <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                    {c.replies && c.replies.length > 0 && (
                      <div className="mt-3 ml-4 space-y-2 border-l-2 border-gray-800 pl-4">
                        {c.replies.map((r: any) => (
                          <div key={r.id}>
                            <span className="text-xs font-medium">{r.author.position ? `${r.author.position} ` : ''}{r.author.name}</span>
                            <p className="text-sm">{r.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SiteDetail;
