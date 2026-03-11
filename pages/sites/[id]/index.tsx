/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { Button } from 'react-daisyui';
import {
  PlusIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500',
  대기: 'bg-red-400',
  계약완료: 'bg-yellow-400',
  진행중: 'bg-green-500',
  부분완료: 'bg-green-300',
  완료: 'bg-gray-400',
  보류: 'bg-gray-600',
};

const StatusDot = ({ status }: { status: string }) => (
  <span
    className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${
      STATUS_DOT[status] || 'bg-gray-400'
    }`}
  />
);

const allTabs = [
  'overview',
  'sales',
  'contract',
  'production',
  'painting',
  'shipping',
  'documents',
  'requests',
  'issues',
  'changes',
  'schedule',
  'history',
  'comments',
];

const hiddenTabsByRole: Record<string, string[]> = {
  PARTNER: ['sales', 'contract'],
  GUEST: [
    'sales',
    'contract',
    'production',
    'painting',
    'shipping',
    'requests',
    'issues',
    'changes',
    'schedule',
    'history',
  ],
  VIEWER: [
    'sales',
    'contract',
    'production',
    'painting',
    'shipping',
    'requests',
    'issues',
    'changes',
    'schedule',
    'history',
  ],
};

const parseLabeledValue = (
  text: string | null | undefined,
  label: string
): string => {
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

const getDeadlineInfo = (deadlineText: string) => {
  if (!deadlineText) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(deadlineText);
  if (Number.isNaN(deadline.getTime())) return null;

  deadline.setHours(0, 0, 0, 0);

  const diff = Math.ceil(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    diff,
    overdue: diff < 0,
    urgent: diff >= 0 && diff <= 3,
  };
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
};

const ProgressBar = ({ value }: { value: number }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
    <div
      className="h-full rounded-full bg-blue-600 transition-all"
      style={{ width: `${clampPercent(value)}%` }}
    />
  </div>
);

const SiteDetail = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { id } = router.query;

  const [activeTab, setActiveTab] = useState('overview');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, mutate } = useSWR(id ? `/api/sites/${id}` : null, fetcher, {
    refreshInterval: 30000,
  });
  const site = data?.data;

  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const userRole =
    profileData?.data?.role ||
    profileData?.data?.teamMembers?.[0]?.role ||
    'USER';

  const hidden = hiddenTabsByRole[userRole] || [];
  const tabs = allTabs.filter((tab) => !hidden.includes(tab));

  const canManage = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(
    userRole
  );
  const canDelete = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN'].includes(
    userRole
  );

  const handleAddComment = useCallback(async () => {
    if (!comment.trim() || !id) return;

    setSubmitting(true);
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  if (!site) {
    return (
      <div className="py-10 text-center">
        <span className="loading loading-spinner loading-md"></span>
      </div>
    );
  }

  const siteType = parseLabeledValue(site.description, '현장구분');
  const specification = parseLabeledValue(site.description, '사양');
  const quantityText = parseLabeledValue(site.description, '물량');
  const unitPriceText = parseLabeledValue(site.description, '단가');
  const amountText = parseLabeledValue(site.description, '금액');
  const contractDateText = parseLabeledValue(site.description, '계약일');
  const deadlineText = parseLabeledValue(site.description, '납품기한');
  const installerText = parseLabeledValue(site.description, '전문시공사');
  const pipeRateText = parseLabeledValue(site.description, '하지파이프 설치율');

  const contractQuantity = toNumber(quantityText);
  const pipeRate = clampPercent(toNumber(pipeRateText));
  const shippedQuantity = Array.isArray(site.shipments)
    ? site.shipments.reduce((sum: number, item: any) => {
        const qty =
          item?.quantity ??
          item?.qty ??
          item?.amount ??
          item?.shippedQuantity ??
          0;
        return sum + toNumber(String(qty));
      }, 0)
    : 0;

  const shipmentRate =
    contractQuantity > 0
      ? clampPercent((shippedQuantity / contractQuantity) * 100)
      : 0;

  const totalProgress = clampPercent((pipeRate + shipmentRate) / 2);
  const deadlineInfo = getDeadlineInfo(deadlineText);

  return (
    <>
      <Head>
        <title>{site.name} | LOOKUP9</title>
      </Head>

      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-800 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center">
                  <StatusDot status={site.status} />
                  <h2 className="truncate text-xl font-bold">{site.name}</h2>
                </div>

                <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">
                  {site.status}
                </span>

                {siteType ? (
                  <span className="rounded-full border border-blue-900/60 bg-blue-950/30 px-2 py-0.5 text-xs text-blue-300">
                    {siteType}
                  </span>
                ) : null}
              </div>

              <p className="mt-2 break-words text-sm text-gray-400">
                {site.client?.name ? <span className="mr-3">{site.client.name}</span> : null}
                {site.address ? <span className="mr-3">{site.address}</span> : null}
                <span>
                  {site.createdBy?.position
                    ? `${site.createdBy.position} ${site.createdBy.name}`
                    : site.createdBy?.name}
                </span>
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-gray-900/40 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                    <span>하지파이프 설치율</span>
                    <span>{pipeRate}%</span>
                  </div>
                  <ProgressBar value={pipeRate} />
                </div>

                <div className="rounded-xl bg-gray-900/40 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                    <span>출고 진행률</span>
                    <span>{shipmentRate}%</span>
                  </div>
                  <ProgressBar value={shipmentRate} />
                  <p className="mt-2 text-xs text-gray-500">
                    출고량 {shippedQuantity.toLocaleString()} / 계약물량{' '}
                    {contractQuantity.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-xl bg-gray-900/40 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
                    <span>종합 공정률</span>
                    <span>{totalProgress}%</span>
                  </div>
                  <ProgressBar value={totalProgress} />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {site._count?.requests > 0 ? (
                <span className="badge badge-sm badge-warning">
                  {t('v2-open-requests')}: {site._count.requests}
                </span>
              ) : null}
              {canDelete ? (
                <Button color="error" size="xs" onClick={handleDeleteSite}>
                  {t('delete')}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <InfoCard label="사양" value={specification || '-'} />
            <InfoCard label="물량" value={quantityText || '-'} />
            <InfoCard label="단가" value={unitPriceText || '-'} />
            <InfoCard label="금액" value={amountText || '-'} />
            <InfoCard label="계약일" value={contractDateText || '-'} />
            <InfoCard label="전문시공사" value={installerText || '-'} />
            <InfoCard
              label="최근 수정일"
              value={new Date(site.updatedAt || site.createdAt).toLocaleDateString('ko-KR')}
            />
            <DeadlineCard deadlineText={deadlineText} deadlineInfo={deadlineInfo} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <CountCard label={t('v2-assignments')} value={site.assignments?.length || 0} />
            <CountCard label={t('v2-paint-specs')} value={site.paintSpecs?.length || 0} />
            <CountCard label={t('v2-shipments')} value={site.shipments?.length || 0} />
            <CountCard label={t('tab-documents')} value={site._count?.documents || 0} />
          </div>
        </div>

        <div className="border-b border-gray-800">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {t(`tab-${tab}`)}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'overview' && (
          <OverviewPanel
            site={site}
            siteId={id as string}
            canManage={canManage}
            onMutate={mutate}
          />
        )}
        {activeTab === 'sales' && (
          <SalesPanel
            siteId={id as string}
            sales={site.sales}
            canManage={canManage}
            onMutate={mutate}
          />
        )}
        {activeTab === 'contract' && (
          <ContractPanel
            siteId={id as string}
            contracts={site.contracts}
            canManage={canManage}
            onMutate={mutate}
          />
        )}
        {activeTab === 'production' && (
          <div className="rounded-lg border border-gray-800 p-6 text-center">
            <p className="text-gray-500">{t('coming-soon')}</p>
          </div>
        )}
        {activeTab === 'painting' && (
          <PaintPanel
            siteId={id as string}
            specs={site.paintSpecs || []}
            canManage={canManage}
            onMutate={mutate}
          />
        )}
        {activeTab === 'shipping' && (
          <ShipmentPanel
            siteId={id as string}
            shipments={site.shipments || []}
            canManage={canManage}
            onMutate={mutate}
          />
        )}
        {activeTab === 'documents' && (
          <DocumentPanel siteId={id as string} canManage={canManage} />
        )}
        {activeTab === 'requests' && (
          <RequestPanel
            siteId={id as string}
            requests={site.requests || []}
            canManage={canManage}
            onMutate={mutate}
          />
        )}
        {activeTab === 'issues' && (
          <IssuePanel
            siteId={id as string}
            issues={site.issues || []}
            canManage={canManage}
            onMutate={mutate}
          />
        )}
        {activeTab === 'changes' && (
          <ChangePanel
            siteId={id as string}
            changes={site.changeLogs || []}
            canManage={canManage}
            onMutate={mutate}
          />
        )}
        {activeTab === 'schedule' && (
          <SchedulePanel
            siteId={id as string}
            schedules={site.schedules || []}
            canManage={canManage}
            onMutate={mutate}
          />
        )}
        {activeTab === 'history' && <HistoryPanel history={site.statusHistory || []} />}
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
              <Button
                color="primary"
                size="sm"
                loading={submitting}
                onClick={handleAddComment}
              >
                {t('comment-submit')}
              </Button>
            </div>

            {(site.comments || []).length === 0 ? (
              <p className="text-sm text-gray-500">{t('comment-none')}</p>
            ) : (
              <div className="space-y-3">
                {site.comments.map((c: any) => (
                  <div key={c.id} className="rounded-lg border border-gray-800 p-4">
                    <div className="mb-2 flex justify-between">
                      <span className="text-sm font-medium">
                        {c.author.position ? `${c.author.position} ` : ''}
                        {c.author.name}
                        {c.author.department ? (
                          <span className="ml-1 text-gray-500">({c.author.department})</span>
                        ) : null}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(c.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{c.content}</p>

                    {c.replies?.length > 0 ? (
                      <div className="mt-3 ml-4 space-y-2 border-l-2 border-gray-800 pl-4">
                        {c.replies.map((r: any) => (
                          <div key={r.id}>
                            <span className="text-xs font-medium">
                              {r.author.position ? `${r.author.position} ` : ''}
                              {r.author.name}
                            </span>
                            <p className="text-sm">{r.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
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

const InfoCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-gray-800 bg-black/20 p-3">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="mt-1 break-words text-sm font-medium">{value}</p>
  </div>
);

const CountCard = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-xl bg-gray-900/40 p-3 text-center">
    <p className="text-xs text-gray-500">{label}</p>
    <p className="mt-1 text-lg font-bold">{value}</p>
  </div>
);

const DeadlineCard = ({
  deadlineText,
  deadlineInfo,
}: {
  deadlineText: string;
  deadlineInfo: { diff: number; overdue: boolean; urgent: boolean } | null;
}) => {
  const danger = deadlineInfo?.overdue || deadlineInfo?.urgent;

  return (
    <div
      className={`rounded-xl border p-3 ${
        danger
          ? 'border-red-500/40 bg-red-500/10'
          : 'border-gray-800 bg-black/20'
      }`}
    >
      <p className={`text-xs ${danger ? 'text-red-300' : 'text-gray-500'}`}>
        납품기한
      </p>
      <p className="mt-1 text-sm font-medium">
        {deadlineText || '미입력'}
      </p>
      {deadlineInfo ? (
        <p className={`mt-1 text-xs ${danger ? 'text-red-300' : 'text-gray-500'}`}>
          {deadlineInfo.overdue
            ? `기한 경과 ${Math.abs(deadlineInfo.diff)}일`
            : `D-${deadlineInfo.diff}`}
        </p>
      ) : null}
    </div>
  );
};

const siteStatuses = ['영업중', '대기', '계약완료', '진행중', '부분완료', '완료', '보류'];

const OverviewPanel = ({ site, siteId, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    status: site.status,
    description: site.description || '',
    statusReason: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/sites/${siteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setEditing(false);
    onMutate();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{t('tab-overview')}</h3>
            {canManage ? (
              <Button size="xs" onClick={() => setEditing(!editing)}>
                {editing ? t('cancel') : t('edit')}
              </Button>
            ) : null}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">{t('site-status')}</p>
              {editing ? (
                <select
                  className="select select-bordered select-sm mt-1 w-full"
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value })
                  }
                >
                  {siteStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-sm">{site.status}</p>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-500">{t('site-description')}</p>
              {editing ? (
                <textarea
                  className="textarea textarea-bordered mt-1 h-40 w-full"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              ) : (
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {site.description || '-'}
                </p>
              )}
            </div>
          </div>

          {editing ? (
            <div className="mt-3 flex justify-end gap-2">
              <Button size="xs" onClick={() => setEditing(false)}>
                {t('cancel')}
              </Button>
              <Button
                size="xs"
                color="primary"
                loading={saving}
                onClick={handleSave}
              >
                {t('save-changes')}
              </Button>
            </div>
          ) : null}
        </div>

        <AssignmentPanel
          siteId={siteId}
          assignments={site.assignments}
          canManage={canManage}
          onMutate={onMutate}
        />
      </div>
    </div>
  );
};

const AssignmentPanel = ({
  siteId,
  assignments,
  canManage,
  onMutate,
}: any) => {
  const { t } = useTranslation('common');
  const [showSearch, setShowSearch] = useState(false);
  const [sq, setSq] = useState('');
  const [sr, setSr] = useState<any[]>([]);

  const handleSearch = async (q: string) => {
    setSq(q);
    if (q.length < 1) {
      setSr([]);
      return;
    }

    const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (r.ok) {
      const d = await r.json();
      setSr(d.data || []);
    }
  };

  const handleAssign = async (userId: string) => {
    await fetch(`/api/sites/${siteId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    setSq('');
    setSr([]);
    setShowSearch(false);
    onMutate();
  };

  const handleRemove = async (userId: string) => {
    if (!confirm(t('assign-remove-confirm'))) return;
    await fetch(`/api/sites/${siteId}/assignments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    onMutate();
  };

  return (
    <div className="rounded-lg border border-gray-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {t('site-assigned-members')} ({assignments.length})
        </p>
        {canManage ? (
          <button
            className="btn btn-ghost btn-xs"
            onClick={() => setShowSearch(!showSearch)}
          >
            <PlusIcon className="h-4 w-4" /> {t('assign-add')}
          </button>
        ) : null}
      </div>

      {showSearch ? (
        <div className="mb-4 space-y-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input input-bordered input-sm w-full pl-9"
              placeholder={t('assign-search-placeholder')}
              value={sq}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {sr.length > 0 ? (
            <div className="max-h-40 overflow-y-auto rounded border border-gray-700">
              {sr.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleAssign(u.id)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-800"
                >
                  {u.position ? `${u.position} ` : ''}
                  {u.name}{' '}
                  <span className="text-gray-500">({u.email})</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {assignments.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-assignments')}</p>
      ) : (
        <div className="space-y-1">
          {assignments.map((a: any) => (
            <div
              key={a.id}
              className="flex items-center justify-between py-1"
            >
              <p className="text-sm">
                {a.user.position ? `${a.user.position} ` : ''}
                {a.user.name}
                <span className="ml-2 text-gray-500">
                  {a.user.department || ''}
                </span>
              </p>
              {canManage ? (
                <button
                  className="btn btn-ghost btn-xs text-error"
                  onClick={() => handleRemove(a.user.id)}
                >
                  <TrashIcon className="h-3 w-3" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const salesStatuses = [
  '영업접촉',
  '제안',
  '견적제출',
  '협상중',
  '수주확정',
  '실주',
];

const SalesPanel = ({ siteId, sales, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    status: '영업접촉',
    estimateAmount: '',
    meetingNotes: '',
  });
  const [sub, setSub] = useState(false);

  const handleSubmit = async () => {
    setSub(true);
    await fetch(`/api/sites/${siteId}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ status: '영업접촉', estimateAmount: '', meetingNotes: '' });
    setShowForm(false);
    setSub(false);
    onMutate();
  };

  const handleDel = async (salesId: string) => {
    if (!confirm(t('sales-delete-confirm'))) return;
    await fetch(`/api/sites/${siteId}/sales`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ salesId }),
    });
    onMutate();
  };

  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">{t('tab-sales')}</h3>
        {canManage ? (
          <Button
            size="xs"
            color="primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? (
              t('cancel')
            ) : (
              <>
                <PlusIcon className="mr-1 h-4 w-4" />
                {t('sales-add')}
              </>
            )}
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <div className="mb-4 space-y-3 rounded-lg border border-gray-700 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">
                <span className="label-text text-xs">{t('sales-status')}</span>
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value })
                }
              >
                {salesStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">
                <span className="label-text text-xs">{t('site-estimate')}</span>
              </label>
              <input
                type="number"
                className="input input-bordered input-sm w-full"
                value={form.estimateAmount}
                onChange={(e) =>
                  setForm({ ...form, estimateAmount: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="label">
              <span className="label-text text-xs">{t('sales-notes')}</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full text-sm"
              rows={2}
              value={form.meetingNotes}
              onChange={(e) =>
                setForm({ ...form, meetingNotes: e.target.value })
              }
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              color="primary"
              loading={sub}
              onClick={handleSubmit}
            >
              {t('save-changes')}
            </Button>
          </div>
        </div>
      ) : null}

      {sales.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-data')}</p>
      ) : (
        sales.map((s: any) => (
          <div key={s.id} className="border-b border-gray-800 py-3 last:border-0">
            <div className="flex items-center justify-between">
              <span className="badge badge-sm">{s.status}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                </span>
                {canManage ? (
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => handleDel(s.id)}
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
            {s.estimateAmount ? (
              <p className="mt-1 text-sm">
                {t('site-estimate')}: {Number(s.estimateAmount).toLocaleString()}
              </p>
            ) : null}
            {s.meetingNotes ? (
              <p className="mt-1 text-sm text-gray-400">{s.meetingNotes}</p>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
};

const contractStatuses = [
  '수주등록',
  '계약진행',
  '계약완료',
  '변경계약',
  '취소',
];

const ContractPanel = ({ siteId, contracts, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    status: '수주등록',
    contractAmount: '',
    specialNotes: '',
  });
  const [sub, setSub] = useState(false);

  const handleSubmit = async () => {
    setSub(true);
    await fetch(`/api/sites/${siteId}/contracts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ status: '수주등록', contractAmount: '', specialNotes: '' });
    setShowForm(false);
    setSub(false);
    onMutate();
  };

  const handleDel = async (contractId: string) => {
    if (!confirm(t('contract-delete-confirm'))) return;
    await fetch(`/api/sites/${siteId}/contracts`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId }),
    });
    onMutate();
  };

  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">{t('tab-contract')}</h3>
        {canManage ? (
          <Button
            size="xs"
            color="primary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? (
              t('cancel')
            ) : (
              <>
                <PlusIcon className="mr-1 h-4 w-4" />
                {t('contract-add')}
              </>
            )}
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <div className="mb-4 space-y-3 rounded-lg border border-gray-700 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">
                <span className="label-text text-xs">{t('contract-status')}</span>
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value })
                }
              >
                {contractStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">
                <span className="label-text text-xs">
                  {t('site-contract-amount')}
                </span>
              </label>
              <input
                type="number"
                className="input input-bordered input-sm w-full"
                value={form.contractAmount}
                onChange={(e) =>
                  setForm({ ...form, contractAmount: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="label">
              <span className="label-text text-xs">{t('contract-notes')}</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full text-sm"
              rows={2}
              value={form.specialNotes}
              onChange={(e) =>
                setForm({ ...form, specialNotes: e.target.value })
              }
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              color="primary"
              loading={sub}
              onClick={handleSubmit}
            >
              {t('save-changes')}
            </Button>
          </div>
        </div>
      ) : null}

      {contracts.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-data')}</p>
      ) : (
        contracts.map((c: any) => (
          <div key={c.id} className="border-b border-gray-800 py-3 last:border-0">
            <div className="flex items-center justify-between">
              <span className="badge badge-sm">{c.status}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {new Date(c.createdAt).toLocaleDateString('ko-KR')}
                </span>
                {canManage ? (
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => handleDel(c.id)}
                  >
                    <TrashIcon className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
            {c.contractAmount ? (
              <p className="mt-1 text-sm">
                {t('site-contract-amount')}:{' '}
                {Number(c.contractAmount).toLocaleString()}
              </p>
            ) : null}
            {c.specialNotes ? (
              <p className="mt-1 text-sm text-gray-400">{c.specialNotes}</p>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
};

const PaintPanel = ({ siteId, specs, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    colorName: '',
    colorCode: '',
    vendor: '',
    note: '',
  });

  const handleSubmit = async () => {
    await fetch(`/api/sites/${siteId}/paint-specs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ colorName: '', colorCode: '', vendor: '', note: '' });
    setShowForm(false);
    onMutate();
  };

  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">{t('tab-painting')}</h3>
        {canManage ? (
          <Button size="xs" color="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t('cancel') : '도장 사양 추가'}
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-700 p-4 md:grid-cols-2">
          <input
            className="input input-bordered input-sm w-full"
            placeholder="색상명"
            value={form.colorName}
            onChange={(e) => setForm({ ...form, colorName: e.target.value })}
          />
          <input
            className="input input-bordered input-sm w-full"
            placeholder="색상코드"
            value={form.colorCode}
            onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
          />
          <input
            className="input input-bordered input-sm w-full"
            placeholder="업체"
            value={form.vendor}
            onChange={(e) => setForm({ ...form, vendor: e.target.value })}
          />
          <input
            className="input input-bordered input-sm w-full"
            placeholder="비고"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <div className="md:col-span-2 flex justify-end">
            <Button size="sm" color="primary" onClick={handleSubmit}>
              저장
            </Button>
          </div>
        </div>
      ) : null}

      {specs.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-data')}</p>
      ) : (
        <div className="space-y-2">
          {specs.map((s: any) => (
            <div key={s.id} className="rounded-lg border border-gray-800 p-3">
              <p className="font-medium">{s.colorName || '-'}</p>
              <p className="text-sm text-gray-400">
                {s.colorCode || '-'} / {s.vendor || '-'}
              </p>
              {s.note ? <p className="mt-1 text-sm">{s.note}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ShipmentPanel = ({ siteId, shipments, canManage, onMutate }: any) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    quantity: '',
    shippedAt: '',
    note: '',
  });

  const handleSubmit = async () => {
    await fetch(`/api/sites/${siteId}/shipments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ quantity: '', shippedAt: '', note: '' });
    setShowForm(false);
    onMutate();
  };

  return (
    <div className="rounded-lg border border-gray-800 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">{t('tab-shipping')}</h3>
        {canManage ? (
          <Button size="xs" color="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t('cancel') : '출고 등록'}
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-700 p-4 md:grid-cols-3">
          <input
            className="input input-bordered input-sm w-full"
            placeholder="출고량"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          />
          <input
            type="date"
            className="input input-bordered input-sm w-full"
            value={form.shippedAt}
            onChange={(e) => setForm({ ...form, shippedAt: e.target.value })}
          />
          <input
            className="input input-bordered input-sm w-full"
            placeholder="비고"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <div className="md:col-span-3 flex justify-end">
            <Button size="sm" color="primary" onClick={handleSubmit}>
              저장
            </Button>
          </div>
        </div>
      ) : null}

      {shipments.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-data')}</p>
      ) : (
        <div className="space-y-2">
          {shipments.map((s: any) => (
            <div key={s.id} className="rounded-lg border border-gray-800 p-3">
              <p className="font-medium">
                {toNumber(String(s.quantity || s.qty || s.amount || 0)).toLocaleString()}
              </p>
              <p className="text-sm text-gray-400">
                {s.shippedAt
                  ? new Date(s.shippedAt).toLocaleDateString('ko-KR')
                  : new Date(s.createdAt).toLocaleDateString('ko-KR')}
              </p>
              {s.note ? <p className="mt-1 text-sm">{s.note}</p> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DocumentPanel = ({ siteId }: { siteId: string; canManage: boolean }) => {
  const { t } = useTranslation('common');
  const { data } = useSWR(`/api/sites/${siteId}/documents`, fetcher);
  const docs = data?.data || [];

  return (
    <div className="rounded-lg border border-gray-800 p-6">
      {docs.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-data')}</p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc: any) => (
            <div key={doc.id} className="rounded-lg border border-gray-800 p-3">
              <p className="font-medium">{doc.name || doc.title || '문서'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const RequestPanel = ({ requests }: any) => {
  const { t } = useTranslation('common');
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      {requests.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-data')}</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r: any) => (
            <div key={r.id} className="rounded-lg border border-gray-800 p-3">
              <p className="font-medium">{r.title || '요청사항'}</p>
              <p className="mt-1 text-sm text-gray-400">{r.content || r.note || ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const IssuePanel = ({ issues }: any) => {
  const { t } = useTranslation('common');
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      {issues.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-data')}</p>
      ) : (
        <div className="space-y-2">
          {issues.map((item: any) => (
            <div key={item.id} className="rounded-lg border border-gray-800 p-3">
              <p className="font-medium">{item.title || '이슈'}</p>
              <p className="mt-1 text-sm text-gray-400">{item.content || item.note || ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ChangePanel = ({ changes }: any) => {
  const { t } = useTranslation('common');
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      {changes.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-data')}</p>
      ) : (
        <div className="space-y-2">
          {changes.map((item: any) => (
            <div key={item.id} className="rounded-lg border border-gray-800 p-3">
              <p className="font-medium">{item.title || '변경사항'}</p>
              <p className="mt-1 text-sm text-gray-400">{item.content || item.note || ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SchedulePanel = ({ schedules }: any) => {
  const { t } = useTranslation('common');
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      {schedules.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-data')}</p>
      ) : (
        <div className="space-y-2">
          {schedules.map((item: any) => (
            <div key={item.id} className="rounded-lg border border-gray-800 p-3">
              <p className="font-medium">{item.title || '일정'}</p>
              <p className="mt-1 text-sm text-gray-400">
                {item.startDate
                  ? new Date(item.startDate).toLocaleDateString('ko-KR')
                  : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const HistoryPanel = ({ history }: any) => {
  const { t } = useTranslation('common');
  return (
    <div className="rounded-lg border border-gray-800 p-6">
      {history.length === 0 ? (
        <p className="text-sm text-gray-500">{t('site-no-data')}</p>
      ) : (
        <div className="space-y-2">
          {history.map((item: any) => (
            <div key={item.id} className="rounded-lg border border-gray-800 p-3">
              <p className="font-medium">
                {item.fromStatus || '-'} → {item.toStatus || '-'}
              </p>
              <p className="mt-1 text-sm text-gray-400">
                {item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString('ko-KR')
                  : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
}

export default SiteDetail;
