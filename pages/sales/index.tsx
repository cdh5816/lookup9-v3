/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useMemo, useRef, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import {
  PlusIcon, MagnifyingGlassIcon, PencilIcon,
  TrashIcon, ArrowRightIcon, LockClosedIcon,
  XMarkIcon, CheckIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline';

// ── 상수 ─────────────────────────────────────────────
const STAGE_OPTIONS = ['영업접촉', '제안', '협의중', '수주확정', '실패'];
const STAGE_COLOR: Record<string, string> = {
  '영업접촉': 'text-gray-300 bg-gray-800/60 border-gray-700',
  '제안':     'text-orange-300 bg-orange-900/40 border-orange-800/50',
  '협의중':   'text-yellow-300 bg-yellow-900/40 border-yellow-800/50',
  '수주확정': 'text-green-300 bg-green-900/40 border-green-800/50',
  '실패':     'text-red-400 bg-red-900/20 border-red-900/40',
};
const SECTOR_OPTIONS = ['관(공공)', '민(민간)'];

// ── 유틸 ─────────────────────────────────────────────
const fmtMoney = (v: any) => {
  if (!v) return '-';
  const n = Number(v);
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  return `${Math.round(n / 10000).toLocaleString()}만`;
};

// ── 인라인 편집 셀 ────────────────────────────────────
const EditableCell = ({
  value, onSave, type = 'text', options,
}: {
  value: string; onSave: (v: string) => void;
  type?: 'text' | 'select' | 'textarea';
  options?: string[];
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<any>(null);

  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);

  const commit = () => { setEditing(false); if (draft !== value) onSave(draft); };
  const cancel = () => { setEditing(false); setDraft(value); };

  if (!editing) {
    return (
      <span
        className="block min-h-[20px] cursor-pointer rounded px-1 hover:bg-gray-700/40 transition text-sm"
        onClick={() => { setDraft(value); setEditing(true); }}
        title="클릭하여 편집"
      >
        {value || <span className="text-gray-600">-</span>}
      </span>
    );
  }

  if (type === 'select' && options) {
    return (
      <select
        ref={ref}
        className="select select-bordered select-xs w-full text-sm"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
      >
        <option value="">-</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={ref}
        type="text"
        className="input input-bordered input-xs flex-1 text-sm"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
        onBlur={commit}
      />
    </div>
  );
};

// ── 영업관리 메인 ─────────────────────────────────────
const SalesPage = () => {
  const router = useRouter();
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const { data: sitesData, mutate } = useSWR('/api/sites?salesOnly=true', fetcher, { refreshInterval: 30000 });

  const profile = profileData?.data;
  const role = profile?.role || 'USER';
  const permissions = profile?.permissions || {};
  const canAccessSales = permissions.canAccessSalesMenu ?? false;
  const canCreate = canAccessSales && !['PARTNER', 'GUEST', 'VIEWER'].includes(role);
  const canDelete = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR'].includes(role);
  const canConvert = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(role);

  const sites: any[] = sitesData?.data ?? [];
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // 필터링
  const filtered = useMemo(() => {
    let list = [...sites];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.client?.name?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q) ||
        s.salesOwner?.toLowerCase().includes(q) ||
        s.designOffice?.toLowerCase().includes(q)
      );
    }
    if (stageFilter !== 'all') list = list.filter(s => s.salesStage === stageFilter);
    return list;
  }, [sites, search, stageFilter]);

  // 영업합산
  const summary = useMemo(() => {
    const active = sites.filter(s => ['SALES_PIPELINE', 'SALES_CONFIRMED'].includes(s.status));
    const failed = sites.filter(s => s.status === 'FAILED');
    const total = sites.length;
    const stageCounts: Record<string, number> = {};
    STAGE_OPTIONS.forEach(s => { stageCounts[s] = 0; });
    active.forEach(s => { if (s.salesStage) stageCounts[s.salesStage] = (stageCounts[s.salesStage] || 0) + 1; });
    return { total, activeCount: active.length, failedCount: failed.length, stageCounts };
  }, [sites]);

  // 인라인 필드 저장
  const saveField = async (siteId: string, field: string, value: string) => {
    setSaving(siteId);
    await fetch(`/api/sites/${siteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value || null }),
    });
    setSaving(null);
    mutate();
  };

  // 삭제
  const handleDelete = async (site: any) => {
    if (!confirm(`"${site.name}" 영업현장을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setDeletingId(site.id);
    await fetch(`/api/sites/${site.id}`, { method: 'DELETE' });
    setDeletingId(null);
    mutate();
  };

  // 현장 전환
  const handleConvert = async (site: any) => {
    if (!confirm(`"${site.name}"을 정식 현장으로 전환하시겠습니까?`)) return;
    await fetch(`/api/sites/${site.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CONTRACT_ACTIVE' }),
    });
    mutate();
  };

  if (!profileData) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="loading loading-spinner loading-lg text-gray-500" />
      </div>
    );
  }

  if (!canAccessSales) {
    return (
      <>
        <Head><title>영업관리 | LOOKUP9</title></Head>
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <LockClosedIcon className="h-12 w-12 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-400">접근 권한이 없습니다</h2>
          <p className="text-sm text-gray-600 text-center max-w-xs">
            영업관리 메뉴는 영업부서 소속 임직원만 이용할 수 있습니다.
          </p>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard')}>
            대시보드로 돌아가기
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>영업관리 | LOOKUP9</title></Head>
      <div className="space-y-4">

        {/* ── 영업합산 (상단 고정) ── */}
        <div className="rounded-2xl border border-gray-800 bg-black/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">영업관리</h2>
            {canCreate && (
              <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="h-4 w-4" />영업현장 등록
              </button>
            )}
          </div>
          {/* 합산 카드 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            <div
              onClick={() => setStageFilter('all')}
              className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center transition ${stageFilter === 'all' ? 'border-blue-500 bg-blue-950/30' : 'border-gray-800 bg-black/20 hover:border-gray-700'}`}
            >
              <p className="text-lg font-bold text-white">{summary.activeCount}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">전체 진행</p>
            </div>
            {STAGE_OPTIONS.filter(s => s !== '실패').map(stage => (
              <div
                key={stage}
                onClick={() => setStageFilter(stageFilter === stage ? 'all' : stage)}
                className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center transition ${stageFilter === stage ? 'border-blue-500 bg-blue-950/30' : 'border-gray-800 bg-black/20 hover:border-gray-700'}`}
              >
                <p className="text-lg font-bold text-white">{summary.stageCounts[stage] || 0}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{stage}</p>
              </div>
            ))}
            <div
              onClick={() => setStageFilter(stageFilter === '실패' ? 'all' : '실패')}
              className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center transition ${stageFilter === '실패' ? 'border-red-800 bg-red-950/30' : 'border-gray-800 bg-black/20 hover:border-gray-700'}`}
            >
              <p className="text-lg font-bold text-red-400">{summary.failedCount}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">실패/보류</p>
            </div>
          </div>
        </div>

        {/* ── 검색 ── */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input input-bordered input-sm w-full pl-9 bg-black/20"
              placeholder="PJ명, 발주처, 설계사무소, 담당자 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {(search || stageFilter !== 'all') && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStageFilter('all'); }}>
              초기화
            </button>
          )}
        </div>

        {/* ── 테이블 ── */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-16 text-center">
            <p className="text-sm text-gray-500">
              {search || stageFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 영업현장이 없습니다.'}
            </p>
            {canCreate && !search && stageFilter === 'all' && (
              <button className="btn btn-ghost btn-sm mt-3 gap-1" onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="h-4 w-4" />영업현장 등록
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="table table-sm w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/60 text-xs text-gray-400">
                  <th className="w-8 px-3 py-3 text-center">NO</th>
                  <th className="min-w-[180px] px-3 py-3">PJ명</th>
                  <th className="min-w-[100px] px-3 py-3">설계사무소</th>
                  <th className="min-w-[80px] px-3 py-3">담당PM</th>
                  <th className="min-w-[120px] px-3 py-3">자재규모 및 사양</th>
                  <th className="w-[70px] px-3 py-3 text-center">구분</th>
                  <th className="min-w-[70px] px-3 py-3">영업담당</th>
                  <th className="min-w-[100px] px-3 py-3">발주처 및 담당자</th>
                  <th className="min-w-[120px] px-3 py-3">주소</th>
                  <th className="min-w-[80px] px-3 py-3">비고</th>
                  <th className="w-[90px] px-3 py-3 text-center">단계</th>
                  <th className="w-[80px] px-3 py-3 text-center">작업</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((site, idx) => {
                  const isFailed = site.status === 'FAILED';
                  const isConfirmed = site.status === 'SALES_CONFIRMED';
                  const isSaving = saving === site.id;

                  return (
                    <tr
                      key={site.id}
                      className={`border-b border-gray-800/50 transition ${
                        isFailed ? 'opacity-50' :
                        isConfirmed ? 'bg-green-950/10' :
                        'hover:bg-gray-800/20'
                      } ${isSaving ? 'opacity-60' : ''}`}
                    >
                      {/* NO */}
                      <td className="px-3 py-2 text-center text-gray-500 text-xs">{idx + 1}</td>

                      {/* PJ명 */}
                      <td className="px-3 py-2 font-medium">
                        <EditableCell
                          value={site.name || ''}
                          onSave={v => saveField(site.id, 'name', v)}
                        />
                        {site.client?.name && (
                          <span className="block text-[11px] text-gray-500 mt-0.5 px-1">{site.client.name}</span>
                        )}
                      </td>

                      {/* 설계사무소 */}
                      <td className="px-3 py-2">
                        <EditableCell
                          value={site.designOffice || ''}
                          onSave={v => saveField(site.id, 'designOffice', v)}
                        />
                      </td>

                      {/* 담당PM */}
                      <td className="px-3 py-2">
                        <EditableCell
                          value={site.salesPm || ''}
                          onSave={v => saveField(site.id, 'salesPm', v)}
                        />
                      </td>

                      {/* 자재규모 및 사양 */}
                      <td className="px-3 py-2">
                        <EditableCell
                          value={site.materialSpec || ''}
                          onSave={v => saveField(site.id, 'materialSpec', v)}
                        />
                      </td>

                      {/* 구분 관/민 */}
                      <td className="px-3 py-2 text-center">
                        <EditableCell
                          value={site.sectorType || ''}
                          onSave={v => saveField(site.id, 'sectorType', v)}
                          type="select"
                          options={SECTOR_OPTIONS}
                        />
                      </td>

                      {/* 영업담당 */}
                      <td className="px-3 py-2">
                        <EditableCell
                          value={site.salesOwner || ''}
                          onSave={v => saveField(site.id, 'salesOwner', v)}
                        />
                      </td>

                      {/* 발주처 및 담당자 */}
                      <td className="px-3 py-2">
                        <EditableCell
                          value={site.clientContact || ''}
                          onSave={v => saveField(site.id, 'clientContact', v)}
                        />
                      </td>

                      {/* 주소 */}
                      <td className="px-3 py-2">
                        <EditableCell
                          value={site.address || ''}
                          onSave={v => saveField(site.id, 'address', v)}
                        />
                      </td>

                      {/* 비고 */}
                      <td className="px-3 py-2">
                        <EditableCell
                          value={site.salesNote || ''}
                          onSave={v => saveField(site.id, 'salesNote', v)}
                        />
                      </td>

                      {/* 단계 */}
                      <td className="px-3 py-2 text-center">
                        <select
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold bg-transparent cursor-pointer ${STAGE_COLOR[site.salesStage] || 'text-gray-400 border-gray-700'}`}
                          value={site.salesStage || ''}
                          onChange={e => saveField(site.id, 'salesStage', e.target.value)}
                        >
                          <option value="">-</option>
                          {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>

                      {/* 작업 버튼 */}
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {canConvert && isConfirmed && (
                            <button
                              title="현장 전환"
                              className="btn btn-success btn-xs gap-0.5"
                              onClick={() => handleConvert(site)}
                            >
                              <ArrowRightIcon className="h-3 w-3" />전환
                            </button>
                          )}
                          {canDelete && (
                            <button
                              title="삭제"
                              className="btn btn-ghost btn-xs text-red-500 hover:bg-red-900/20"
                              onClick={() => handleDelete(site)}
                              disabled={deletingId === site.id}
                            >
                              {deletingId === site.id
                                ? <span className="loading loading-spinner loading-xs" />
                                : <TrashIcon className="h-3.5 w-3.5" />
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 테이블 하단 안내 */}
        {filtered.length > 0 && (
          <p className="text-[11px] text-gray-600 text-center">
            셀을 클릭하면 바로 수정할 수 있습니다 · 단계 변경은 드롭다운으로 즉시 반영됩니다
          </p>
        )}

        {/* 등록 모달 */}
        {showCreateModal && (
          <CreateSalesModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => { setShowCreateModal(false); mutate(); }}
          />
        )}
      </div>
    </>
  );
};

// ── 영업현장 등록 모달 ────────────────────────────────
const CreateSalesModal = ({
  onClose, onCreated,
}: {
  onClose: () => void; onCreated: () => void;
}) => {
  const [form, setForm] = useState({
    name: '',
    clientName: '',
    designOffice: '',
    salesPm: '',
    materialSpec: '',
    sectorType: '',
    salesOwner: '',
    clientContact: '',
    address: '',
    salesNote: '',
    salesStage: '영업접촉',
    estimatedAmount: '',
    siteType: '납품설치도',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('PJ명(현장명)은 필수입니다.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          status: 'SALES_PIPELINE',
          estimatedAmount: form.estimatedAmount ? Number(form.estimatedAmount.replace(/,/g, '')) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '등록 실패');
      onCreated();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900 p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">영업현장 등록</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="text-sm text-red-400 bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-400 mb-1">PJ명 (사업명) *</label>
            <input className="input input-bordered input-sm w-full"
              placeholder="예) ○○초등학교 그린리모델링 공사"
              value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">발주처</label>
            <input className="input input-bordered input-sm w-full"
              placeholder="발주처명"
              value={form.clientName} onChange={e => set('clientName', e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">발주처 담당자</label>
            <input className="input input-bordered input-sm w-full"
              placeholder="담당자명 / 연락처"
              value={form.clientContact} onChange={e => set('clientContact', e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">설계사무소</label>
            <input className="input input-bordered input-sm w-full"
              value={form.designOffice} onChange={e => set('designOffice', e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">담당PM</label>
            <input className="input input-bordered input-sm w-full"
              value={form.salesPm} onChange={e => set('salesPm', e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">자재규모 및 사양</label>
            <input className="input input-bordered input-sm w-full"
              placeholder="예) MS-G01-01 / 2,820㎡"
              value={form.materialSpec} onChange={e => set('materialSpec', e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">구분</label>
            <select className="select select-bordered select-sm w-full"
              value={form.sectorType} onChange={e => set('sectorType', e.target.value)}>
              <option value="">선택</option>
              {SECTOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">영업담당</label>
            <input className="input input-bordered input-sm w-full"
              value={form.salesOwner} onChange={e => set('salesOwner', e.target.value)} />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">영업 단계</label>
            <select className="select select-bordered select-sm w-full"
              value={form.salesStage} onChange={e => set('salesStage', e.target.value)}>
              {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">예상 계약금액 (원)</label>
            <input className="input input-bordered input-sm w-full"
              placeholder="예) 27000000"
              value={form.estimatedAmount} onChange={e => set('estimatedAmount', e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-400 mb-1">주소</label>
            <input className="input input-bordered input-sm w-full"
              value={form.address} onChange={e => set('address', e.target.value)} />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-400 mb-1">비고</label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2}
              placeholder="영업 메모, 특이사항..."
              value={form.salesNote} onChange={e => set('salesNote', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 justify-end border-t border-gray-800 pt-3">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>취소</button>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default SalesPage;
