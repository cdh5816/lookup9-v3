/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import {
  PlusIcon, TrashIcon, XMarkIcon, BuildingOffice2Icon,
  UserPlusIcon, ChevronDownIcon, ChevronRightIcon,
  PencilIcon, CheckIcon,
} from '@heroicons/react/24/outline';

const STATUS_LABEL: Record<string, string> = {
  CONTRACT_ACTIVE: '진행중', COMPLETED: '준공완료', WARRANTY: '하자기간',
  SALES_PIPELINE: '영업중', SALES_CONFIRMED: '수주확정',
};

const PartnerCompaniesPage = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 업체 생성 모달
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', bizNo: '', contact: '', phone: '', email: '', address: '', notes: '' });
  const [creating, setCreating] = useState(false);

  // 업체 수정
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // 멤버 추가 모달
  const [showMemberForm, setShowMemberForm] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState({ name: '', username: '', password: '', position: '', phone: '' });
  const [addingMember, setAddingMember] = useState(false);

  // 현장 배정 모달
  const [showSiteAssign, setShowSiteAssign] = useState<string | null>(null);
  const [assigningSite, setAssigningSite] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/partner-companies');
    if (res.ok) {
      const json = await res.json();
      setCompanies(json.data || []);
      setSites(json.meta?.sites || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── 업체 생성 ──
  const handleCreate = async () => {
    if (!form.name.trim()) { setError('회사명을 입력하세요.'); return; }
    setCreating(true); setError(''); setSuccess('');
    const res = await fetch('/api/partner-companies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) { setError(json?.error?.message || '생성 실패'); }
    else {
      setSuccess('협력업체가 등록되었습니다.');
      setShowCreate(false);
      setForm({ name: '', bizNo: '', contact: '', phone: '', email: '', address: '', notes: '' });
      load();
    }
    setCreating(false);
  };

  // ── 업체 수정 ──
  const handleSave = async (companyId: string) => {
    setSaving(true); setError('');
    const res = await fetch('/api/partner-companies', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, ...editForm }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json?.error?.message || '수정 실패'); }
    else { setEditId(null); load(); }
    setSaving(false);
  };

  // ── 업체 삭제 ──
  const handleDeleteCompany = async (companyId: string, name: string) => {
    if (!confirm(`"${name}" 협력업체를 삭제하시겠습니까?\n소속 계정의 협력업체 연결이 해제됩니다.`)) return;
    const res = await fetch('/api/partner-companies', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    });
    if (res.ok) { setSuccess('삭제되었습니다.'); load(); }
    else { const j = await res.json(); setError(j?.error?.message || '삭제 실패'); }
  };

  // ── 멤버 추가 ──
  const handleAddMember = async () => {
    if (!memberForm.name || !memberForm.username || !memberForm.password) {
      setError('이름, 아이디, 비밀번호는 필수입니다.'); return;
    }
    setAddingMember(true); setError(''); setSuccess('');
    const res = await fetch('/api/partner-companies?action=add-member', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...memberForm, companyId: showMemberForm }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json?.error?.message || '계정 생성 실패'); }
    else {
      setSuccess('협력사 계정이 생성되었습니다.');
      setShowMemberForm(null);
      setMemberForm({ name: '', username: '', password: '', position: '', phone: '' });
      load();
    }
    setAddingMember(false);
  };

  // ── 멤버 제거 ──
  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!confirm(`"${name}" 계정을 이 업체에서 제거하시겠습니까?`)) return;
    const res = await fetch('/api/partner-companies', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    });
    if (res.ok) { load(); }
    else { const j = await res.json(); setError(j?.error?.message || '제거 실패'); }
  };

  // ── 현장 배정/해제 ──
  const handleAssignSite = async (companyId: string, siteId: string, isAssigned: boolean) => {
    setAssigningSite(true);
    const res = await fetch('/api/partner-companies?action=assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, siteId, remove: isAssigned }),
    });
    if (res.ok) { load(); }
    else { const j = await res.json(); setError(j?.error?.message || '배정 실패'); }
    setAssigningSite(false);
  };

  return (
    <>
      <Head><title>협력업체 관리 | LOOKUP9</title></Head>
      <div className="space-y-4">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">협력업체 관리</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              설치 시공 협력업체를 등록하고, 소속 계정을 관리합니다.
              업체에 현장을 배정하면 소속 계정이 자동으로 해당 현장에 접근할 수 있습니다.
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm gap-1.5"
            onClick={() => { setShowCreate(true); setError(''); setSuccess(''); }}
          >
            <PlusIcon className="h-4 w-4" />업체 등록
          </button>
        </div>

        {/* 알림 */}
        {error && (
          <div className="rounded-lg border border-red-800/50 bg-red-950/20 px-4 py-2.5 text-sm text-red-300 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')}><XMarkIcon className="h-4 w-4" /></button>
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-green-800/50 bg-green-950/20 px-4 py-2.5 text-sm text-green-300 flex items-center justify-between">
            {success}
            <button onClick={() => setSuccess('')}><XMarkIcon className="h-4 w-4" /></button>
          </div>
        )}

        {/* 업체 목록 */}
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : companies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-16 text-center">
            <BuildingOffice2Icon className="mx-auto h-10 w-10 text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">등록된 협력업체가 없습니다.</p>
            <button className="btn btn-outline btn-sm mt-4 gap-1.5" onClick={() => setShowCreate(true)}>
              <PlusIcon className="h-4 w-4" />첫 번째 업체 등록
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {companies.map(company => {
              const isExpanded = expandedId === company.id;
              const isEditing = editId === company.id;
              const assignedSiteIds = company.sites?.map((s: any) => s.siteId) ?? [];

              return (
                <div key={company.id} className="rounded-xl border border-gray-700/50 bg-gray-900/50 overflow-hidden">

                  {/* 업체 헤더 행 */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      className="text-gray-400 hover:text-white transition flex-shrink-0"
                      onClick={() => setExpandedId(isExpanded ? null : company.id)}
                    >
                      {isExpanded
                        ? <ChevronDownIcon className="h-4 w-4" />
                        : <ChevronRightIcon className="h-4 w-4" />}
                    </button>

                    <BuildingOffice2Icon className="h-5 w-5 text-blue-400 flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          className="input input-bordered input-sm w-full max-w-sm bg-gray-800"
                          value={editForm.name}
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-white">{company.name}</span>
                          {company.bizNo && <span className="text-xs text-gray-500">{company.bizNo}</span>}
                          <span className="text-xs text-gray-500">
                            계정 {company.members?.length ?? 0}명
                          </span>
                          <span className="text-xs text-gray-500">
                            현장 {assignedSiteIds.length}건
                          </span>
                          {/* 배정된 현장 뱃지 */}
                          {company.sites?.slice(0, 2).map((sa: any) => (
                            <span key={sa.siteId} className="rounded-full border border-gray-700 bg-gray-800/60 px-2 py-0.5 text-xs text-gray-300">
                              {sa.site?.name || sa.siteId}
                            </span>
                          ))}
                          {(company.sites?.length ?? 0) > 2 && (
                            <span className="text-xs text-gray-500">+{company.sites.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isEditing ? (
                        <>
                          <button className="btn btn-ghost btn-xs gap-1 text-green-400" onClick={() => handleSave(company.id)} disabled={saving}>
                            {saving ? <span className="loading loading-spinner loading-xs" /> : <><CheckIcon className="h-3.5 w-3.5" />저장</>}
                          </button>
                          <button className="btn btn-ghost btn-xs" onClick={() => setEditId(null)}>취소</button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-ghost btn-xs gap-1 text-blue-400"
                            onClick={() => {
                              setShowSiteAssign(showSiteAssign === company.id ? null : company.id);
                              setExpandedId(company.id);
                            }}
                          >
                            현장배정
                          </button>
                          <button
                            className="btn btn-ghost btn-xs gap-1"
                            onClick={() => {
                              setShowMemberForm(company.id);
                              setMemberForm({ name: '', username: '', password: '', position: '', phone: '' });
                              setError('');
                            }}
                          >
                            <UserPlusIcon className="h-3.5 w-3.5" />계정추가
                          </button>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => { setEditId(company.id); setEditForm({ name: company.name, bizNo: company.bizNo || '', contact: company.contact || '', phone: company.phone || '', email: company.email || '', address: company.address || '', notes: company.notes || '' }); }}
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                          <button className="btn btn-ghost btn-xs text-red-400" onClick={() => handleDeleteCompany(company.id, company.name)}>
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 현장 배정 패널 */}
                  {showSiteAssign === company.id && (
                    <div className="border-t border-gray-700/50 bg-blue-950/10 px-4 py-3">
                      <p className="text-xs font-bold text-blue-300 uppercase tracking-wide mb-2">현장 배정</p>
                      <p className="text-xs text-gray-400 mb-3">
                        체크한 현장에 이 업체의 모든 계정이 자동으로 접근할 수 있습니다.
                      </p>
                      {sites.length === 0 ? (
                        <p className="text-xs text-gray-500">진행중인 현장이 없습니다.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                          {sites.map((site: any) => {
                            const assigned = assignedSiteIds.includes(site.id);
                            return (
                              <label key={site.id} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${assigned ? 'border-blue-700/50 bg-blue-950/20' : 'border-gray-700/40 hover:border-gray-600'}`}>
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm checkbox-primary"
                                  checked={assigned}
                                  disabled={assigningSite}
                                  onChange={() => handleAssignSite(company.id, site.id, assigned)}
                                />
                                <div className="min-w-0">
                                  <p className="font-medium truncate text-xs">{site.name}</p>
                                  <p className="text-[10px] text-gray-500">{STATUS_LABEL[site.status] || site.status}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      <button className="btn btn-ghost btn-xs mt-3" onClick={() => setShowSiteAssign(null)}>닫기</button>
                    </div>
                  )}

                  {/* 소속 계정 목록 (펼침) */}
                  {isExpanded && (
                    <div className="border-t border-gray-700/50 px-4 py-3">

                      {/* 수정 폼 */}
                      {isEditing && (
                        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-lg border border-gray-700/40 bg-gray-800/30 p-3">
                          <Field label="사업자번호">
                            <input className="input input-bordered input-sm w-full" value={editForm.bizNo} onChange={e => setEditForm({ ...editForm, bizNo: e.target.value })} />
                          </Field>
                          <Field label="대표자명">
                            <input className="input input-bordered input-sm w-full" value={editForm.contact} onChange={e => setEditForm({ ...editForm, contact: e.target.value })} />
                          </Field>
                          <Field label="연락처">
                            <input className="input input-bordered input-sm w-full" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                          </Field>
                          <Field label="이메일">
                            <input className="input input-bordered input-sm w-full" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                          </Field>
                          <Field label="주소" className="sm:col-span-2">
                            <input className="input input-bordered input-sm w-full" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} />
                          </Field>
                          <Field label="메모" className="sm:col-span-3">
                            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
                          </Field>
                        </div>
                      )}

                      {/* 기본 정보 (뷰) */}
                      {!isEditing && (company.contact || company.phone || company.email) && (
                        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                          {company.contact && <span>대표자: <span className="text-gray-200">{company.contact}</span></span>}
                          {company.phone && <span>연락처: <span className="text-gray-200">{company.phone}</span></span>}
                          {company.email && <span>이메일: <span className="text-gray-200">{company.email}</span></span>}
                          {company.address && <span>주소: <span className="text-gray-200">{company.address}</span></span>}
                        </div>
                      )}

                      {/* 소속 계정 */}
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">소속 계정 ({company.members?.length ?? 0}명)</p>
                        {(!company.members || company.members.length === 0) ? (
                          <div className="flex items-center justify-between rounded-lg border border-dashed border-gray-700/50 px-3 py-3">
                            <p className="text-xs text-gray-500">아직 등록된 계정이 없습니다.</p>
                            <button
                              className="btn btn-outline btn-xs gap-1"
                              onClick={() => { setShowMemberForm(company.id); setMemberForm({ name: '', username: '', password: '', position: '', phone: '' }); }}
                            >
                              <UserPlusIcon className="h-3 w-3" />계정 추가
                            </button>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-700/30">
                            {company.members.map((m: any) => (
                              <div key={m.id} className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-900/40 text-blue-300 text-xs font-bold flex-shrink-0">
                                    {m.user?.name?.[0] || '?'}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white">{m.user?.name}</p>
                                    <p className="text-xs text-gray-500">
                                      @{m.user?.username}
                                      {m.user?.position && ` · ${m.user.position}`}
                                      {m.user?.phone && ` · ${m.user.phone}`}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  className="btn btn-ghost btn-xs text-red-400 flex-shrink-0"
                                  onClick={() => handleRemoveMember(m.id, m.user?.name || '')}
                                >
                                  <TrashIcon className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 업체 생성 모달 ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">협력업체 등록</h3>
              <button onClick={() => { setShowCreate(false); setError(''); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            {error && <div className="mb-3 rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2 text-sm text-red-300">{error}</div>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="업체명 *" className="sm:col-span-2">
                <input className="input input-bordered w-full" placeholder="예: (주)덕인설치" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="사업자등록번호">
                <input className="input input-bordered w-full" placeholder="000-00-00000" value={form.bizNo} onChange={e => setForm({ ...form, bizNo: e.target.value })} />
              </Field>
              <Field label="대표자명">
                <input className="input input-bordered w-full" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
              </Field>
              <Field label="연락처">
                <input className="input input-bordered w-full" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="이메일">
                <input className="input input-bordered w-full" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="주소" className="sm:col-span-2">
                <input className="input input-bordered w-full" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </Field>
              <Field label="메모" className="sm:col-span-2">
                <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowCreate(false); setError(''); }}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreate} disabled={creating}>
                {creating ? <span className="loading loading-spinner loading-xs" /> : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 계정 추가 모달 ── */}
      {showMemberForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">협력사 계정 추가</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {companies.find(c => c.id === showMemberForm)?.name} 소속으로 등록됩니다.
                </p>
              </div>
              <button onClick={() => { setShowMemberForm(null); setError(''); }} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            {error && <div className="mb-3 rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2 text-sm text-red-300">{error}</div>}

            <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 px-3 py-2 mb-4">
              <p className="text-xs text-blue-300">
                이 업체에 배정된 현장에 자동으로 접근 권한이 부여됩니다.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="이름 *" className="sm:col-span-2">
                <input className="input input-bordered w-full" value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} />
              </Field>
              <Field label="아이디 *">
                <input className="input input-bordered w-full" placeholder="영문/숫자" value={memberForm.username} onChange={e => setMemberForm({ ...memberForm, username: e.target.value.trim() })} />
              </Field>
              <Field label="비밀번호 *">
                <input type="password" className="input input-bordered w-full" value={memberForm.password} onChange={e => setMemberForm({ ...memberForm, password: e.target.value })} />
              </Field>
              <Field label="직책">
                <input className="input input-bordered w-full" placeholder="예: 소장" value={memberForm.position} onChange={e => setMemberForm({ ...memberForm, position: e.target.value })} />
              </Field>
              <Field label="연락처">
                <input className="input input-bordered w-full" value={memberForm.phone} onChange={e => setMemberForm({ ...memberForm, phone: e.target.value })} />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowMemberForm(null); setError(''); }}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={handleAddMember} disabled={addingMember}>
                {addingMember ? <span className="loading loading-spinner loading-xs" /> : '계정 생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Field = ({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) => (
  <div className={className}>
    <label className="block text-xs text-gray-400 mb-1 font-semibold">{label}</label>
    {children}
  </div>
);

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default PartnerCompaniesPage;
