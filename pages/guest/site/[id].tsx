import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { Button } from 'react-daisyui';
import { PlusIcon, ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';

const STATUS_DOT: Record<string, string> = {
  '영업중': 'bg-red-500', '대기': 'bg-red-400', '계약완료': 'bg-yellow-400',
  '진행중': 'bg-green-500', '부분완료': 'bg-green-300', '완료': 'bg-gray-400', '보류': 'bg-gray-600',
};

type GuestTab = 'progress' | 'schedule' | 'documents' | 'requests';

const GuestSiteView = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { id } = router.query;
  const [activeTab, setActiveTab] = useState<GuestTab>('progress');

  const { data, mutate } = useSWR(id ? `/api/guest/sites/${id}` : null, fetcher, { refreshInterval: 30000 });
  const site = data?.data;

  if (!site) return <div className="text-center py-10"><span className="loading loading-spinner loading-md"></span></div>;

  const tabs: { key: GuestTab; label: string }[] = [
    { key: 'progress', label: t('guest-tab-progress') },
    { key: 'schedule', label: t('guest-tab-schedule') },
    { key: 'documents', label: t('tab-documents') },
    { key: 'requests', label: t('guest-tab-requests') },
  ];

  return (
    <>
      <Head><title>{site.name} | LOOKUP9</title></Head>
      <div className="space-y-5">
        {/* 상단 요약 */}
        <div className="rounded-lg border border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-block w-3 h-3 rounded-full ${STATUS_DOT[site.status] || 'bg-gray-400'}`} />
            <h2 className="text-xl font-bold">{site.name}</h2>
            <span className="text-sm text-gray-400">{site.status}</span>
          </div>
          <p className="text-sm text-gray-400">{site.client?.name}{site.address && ` · ${site.address}`}</p>

          {/* 진행률 바 */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">{t('guest-progress-label')}</span>
              <span className="font-bold text-blue-400">{site.progress.percent}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-3">
              <div className="bg-blue-500 h-3 rounded-full transition-all" style={{ width: `${site.progress.percent}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('guest-progress-detail', { completed: site.progress.completedShipments, total: site.progress.totalShipments })}
            </p>
          </div>
        </div>

        {/* 탭 */}
        <div className="border-b border-gray-800">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 탭 내용 */}
        {activeTab === 'progress' && <ProgressTab site={site} />}
        {activeTab === 'schedule' && <ScheduleTab shipments={site.shipments} />}
        {activeTab === 'documents' && <DocumentsTab documents={site.documents} />}
        {activeTab === 'requests' && <RequestsTab siteId={id as string} requests={site.requests} onMutate={mutate} />}
      </div>
    </>
  );
};

// ========= 공정 진행률 =========
const ProgressTab = ({ site }: { site: any }) => {
  const { t } = useTranslation('common');
  const shipStatColors: Record<string, string> = {
    '출하예정': 'badge-ghost', '상차완료': 'badge-info', '출발': 'badge-info',
    '현장도착': 'badge-warning', '인수완료': 'badge-success', '반송': 'badge-error', '취소': 'badge-error',
  };

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-800 p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{site.progress.totalShipments}</p>
          <p className="text-xs text-gray-500 mt-1">{t('guest-total-shipments')}</p>
        </div>
        <div className="rounded-lg border border-green-800 bg-green-900/10 p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{site.progress.completedShipments}</p>
          <p className="text-xs text-gray-500 mt-1">{t('guest-completed')}</p>
        </div>
        <div className="rounded-lg border border-gray-800 p-4 text-center">
          <p className="text-2xl font-bold">{site.progress.totalShipments - site.progress.completedShipments}</p>
          <p className="text-xs text-gray-500 mt-1">{t('guest-remaining')}</p>
        </div>
      </div>

      {/* 출하 현황 */}
      {site.shipments.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">{t('guest-no-shipments')}</p>
      ) : (
        <div className="space-y-2">
          {site.shipments.map((s: any) => (
            <div key={s.id} className="rounded border border-gray-800 p-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">{s.shipmentNo || `#${s.sequence}`}</span>
                <span className="text-xs text-gray-500 ml-2">{t('v2-sequence')} {s.sequence}</span>
                {s.quantity && <span className="text-xs text-gray-500 ml-2">{Number(s.quantity).toLocaleString()}</span>}
              </div>
              <div className="flex items-center gap-2">
                {s.shippedAt && <span className="text-xs text-gray-500">{new Date(s.shippedAt).toLocaleDateString('ko-KR')}</span>}
                <span className={`badge badge-sm ${shipStatColors[s.status] || 'badge-ghost'}`}>{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 납품 일정 =========
const ScheduleTab = ({ shipments }: { shipments: any[] }) => {
  const { t } = useTranslation('common');
  const upcoming = shipments.filter((s) => s.status !== '인수완료' && s.status !== '취소' && s.status !== '반송');
  const completed = shipments.filter((s) => s.status === '인수완료');

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">{t('guest-upcoming')}</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-4">{t('guest-no-upcoming')}</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((s: any) => (
              <div key={s.id} className="rounded border border-blue-800/50 bg-blue-900/10 p-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{s.shipmentNo || `${t('v2-sequence')} ${s.sequence}`}</span>
                  <span className="badge badge-sm badge-info">{s.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-400">
                  <div>{t('v2-ship-date')}: {s.shippedAt ? new Date(s.shippedAt).toLocaleDateString('ko-KR') : t('guest-tbd')}</div>
                  <div>{t('v2-destination')}: {s.destination || '-'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {completed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-3">{t('guest-completed-list')}</h3>
          <div className="space-y-1">
            {completed.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded bg-gray-800/20 text-sm">
                <span>{s.shipmentNo || `#${s.sequence}`}</span>
                <span className="text-gray-500">{s.shippedAt ? new Date(s.shippedAt).toLocaleDateString('ko-KR') : '-'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ========= 문서 =========
const DocumentsTab = ({ documents }: { documents: any[] }) => {
  const { t } = useTranslation('common');
  const fmtSize = (b: number | null) => { if (!b) return '-'; if (b < 1024) return `${b}B`; if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`; return `${(b / (1024 * 1024)).toFixed(1)}MB`; };

  return (
    <div>
      {documents.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">{t('site-no-data')}</p>
      ) : (
        <div className="space-y-2">
          {documents.map((d: any) => (
            <a key={d.id} href={`/api/documents/${d.id}`} target="_blank" rel="noreferrer"
              className="flex items-center justify-between rounded border border-gray-800 p-3 hover:border-gray-600 transition-colors">
              <div className="flex items-center gap-3">
                <ArrowDownTrayIcon className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-400">{d.fileName}</p>
                  <p className="text-xs text-gray-500">{d.uploadedBy?.position ? `${d.uploadedBy.position} ` : ''}{d.uploadedBy?.name} · {new Date(d.createdAt).toLocaleDateString('ko-KR')}</p>
                </div>
              </div>
              <span className="text-xs text-gray-500">{fmtSize(d.fileSize)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

// ========= 요청사항 + 미팅 요청 =========
const reqTypes = ['고객 요청', '미팅 요청', '문의', '기타'];
const RequestsTab = ({ siteId, requests, onMutate }: { siteId: string; requests: any[]; onMutate: () => void }) => {
  const { t } = useTranslation('common');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: '고객 요청', description: '', deadline: '' });
  const [sub, setSub] = useState(false);

  const handleSubmit = async () => {
    if (!form.title) return;
    setSub(true);
    await fetch(`/api/guest/sites/${siteId}/requests`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ title: '', type: '고객 요청', description: '', deadline: '' });
    setShowForm(false); setSub(false); onMutate();
  };

  const statusColors: Record<string, string> = {
    '등록': 'badge-ghost', '확인중': 'badge-info', '처리중': 'badge-warning', '완료': 'badge-success', '반려': 'badge-error', '보류': 'badge-ghost',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" color="primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><XMarkIcon className="w-4 h-4 mr-1" />{t('cancel')}</> : <><PlusIcon className="w-4 h-4 mr-1" />{t('guest-request-add')}</>}
        </Button>
      </div>

      {showForm && (
        <div className="border border-gray-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="label"><span className="label-text text-xs">{t('v2-req-title')} *</span></label>
              <input type="text" className="input input-bordered input-sm w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="label"><span className="label-text text-xs">{t('v2-req-type')}</span></label>
              <select className="select select-bordered select-sm w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {reqTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
            <div><label className="label"><span className="label-text text-xs">{t('guest-meeting-date')}</span></label>
              <input type="date" className="input input-bordered input-sm w-full" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
          </div>
          <div><label className="label"><span className="label-text text-xs">{t('site-description')}</span></label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex justify-end"><Button size="sm" color="primary" loading={sub} onClick={handleSubmit}>{t('guest-request-submit')}</Button></div>
        </div>
      )}

      {requests.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">{t('guest-no-requests')}</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r: any) => (
            <div key={r.id} className="rounded border border-gray-800 p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.title}</span>
                  <span className="text-xs text-gray-500">{r.type}</span>
                </div>
                <span className={`badge badge-sm ${statusColors[r.status] || 'badge-ghost'}`}>{r.status}</span>
              </div>
              {r.deadline && <p className="text-xs text-gray-500">{t('guest-meeting-date')}: {new Date(r.deadline).toLocaleDateString('ko-KR')}</p>}
              {r.result && <p className="text-sm text-green-400 mt-1">{t('guest-result')}: {r.result}</p>}
              <p className="text-xs text-gray-600 mt-1">{new Date(r.createdAt).toLocaleDateString('ko-KR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default GuestSiteView;
