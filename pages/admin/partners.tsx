/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';
import { PlusIcon, TrashIcon, XMarkIcon, BuildingOffice2Icon, UserPlusIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const STATUS_LABEL: Record<string, string> = {
  CONTRACT_ACTIVE: '진행중', COMPLETED: '준공완료', WARRANTY: '하자기간',
};

const PartnerCompaniesPage = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', bizNo: '', contact: '', phone: '', email: '', address: '', notes: '', siteIds: [] as string[] });
  const [creating, setCreating] = useState(false);

  const [memberForm, setMemberForm] = useState({ companyId: '', name: '', username: '', password: '', position: '', phone: '' });
  const [showMemberForm, setShowMemberForm] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);

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

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('회사명을 입력하세요.'); return; }
    setCreating(true); setError(''); setSuccess('');
    const res = await fetch('/api/partner-companies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) { setError(json?.error?.message || '생성 실패'); }
    else { setSuccess('협력사가 등록되었습니다.'); setShowCreate(false); setForm({ name: '', bizNo: '', contact: '', phone: '', email: '', address: '', notes: '', siteIds: [] }); load(); }
    setCreating(false);
  };

  const handleAddMember = async () => {
    if (!memberForm.name || !memberForm.username || !memberForm.password) { setError('이름, 아이디, 비밀번호는 필수입니다.'); return; }
    setAddingMember(true); setError(''); setSuccess('');
    const res = await fetch('/api/partner-companies?action=add-member', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...memberForm, companyId: showMemberForm }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json?.error?.message || '추가 실패'); }
    else { setSuccess('직원 계정이 생성되었습니다.'); setShowMemberForm(null); setMemberForm({ companyId: '', name: '', username: '', password: '', position: '', phone: '' }); load(); }
    setAddingMember(false);
  };

  const handleAssignSite = async (companyId: string, siteId: string, remove = false) => {
    await fetch('/api/partner-companies?action=assign', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, siteId, remove }),
    });
    load();
  };

  const handleDeleteCompany = async (companyId: string, name: string) => {
    if (!confirm(`"${name}" 협력사를 삭제합니다. 소속 직원 계정도 함께 삭제됩니다.`)) return;
    await fetch('/api/partner-companies', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    });
    load();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('직원을 협력사에서 제거합니다.')) return;
    await fetch('/api/partner-companies', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    });
    load();
  };

  const toggleSiteId = (siteId: string) => {
    setForm(prev => ({
      ...prev,
      siteIds: prev.siteIds.includes(siteId) ? prev.siteIds.filter(id => id !== siteId) : [...prev.siteIds, siteId],
    }));
  };

  return (
    <>
      <Head><title>협력사 관리 | LOOKUP9</title></Head>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">협력사 관리</h2>
            <p className="text-xs text-gray-500 mt-0.5">회사 단위로 등록하면 소속 직원 전체가 배정 현장에 자동 접근합니다.</p>
          </div>
          <button className="btn btn-primary btn-sm gap-1.5" onClick={() => setShowCreate(true)}>
            <PlusIcon className="h-4 w-4" />협력사 등록
          </button>
        </div>

        {error && <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div>}
        {success && <div className="rounded-xl border border-green-800/50 bg-green-950/30 px-4 py-3 text-sm text-green-300">{success}</div>}

        {/* 협력사 등록 모달 */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-gray-700 bg-gray-900 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">협력사 등록</h3>
                <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowCreate(false)}><XMarkIcon className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">회사명 *</label>
                  <input className="input input-bordered w-full bg-gray-800" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">사업자번호</label>
                  <input className="input input-bordered w-full bg-gray-800" placeholder="000-00-00000" value={form.bizNo} onChange={e => setForm({ ...form, bizNo: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">담당자명</label>
                  <input className="input input-bordered w-full bg-gray-800" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">연락처</label>
                  <input className="input input-bordered w-full bg-gray-800" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">이메일</label>
                  <input className="input input-bordered w-full bg-gray-800" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">주소</label>
                  <input className="input input-bordered w-full bg-gray-800" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>

              {sites.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-2">배정 현장 (선택)</label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
                    {sites.map(site => (
                      <label key={site.id} className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm cursor-pointer hover:border-gray-600">
                        <input type="checkbox" className="checkbox checkbox-sm" checked={form.siteIds.includes(site.id)} onChange={() => toggleSiteId(site.id)} />
                        <span className="truncate">{site.name}</span>
                        <span className="text-xs text-gray-500 shrink-0">{STATUS_LABEL[site.status] || site.status}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>취소</button>
                <button className={`btn btn-primary btn-sm ${creating ? 'loading' : ''}`} disabled={creating} onClick={handleCreate}>등록</button>
              </div>
            </div>
          </div>
        )}

        {/* 직원 추가 모달 */}
        {showMemberForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">직원 계정 추가</h3>
                <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowMemberForm(null)}><XMarkIcon className="h-5 w-5" /></button>
              </div>
              <p className="text-xs text-gray-500">생성된 계정은 협력사(PARTNER) 권한으로 배정된 현장에 자동 접근합니다.</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-gray-400 mb-1">이름 *</label><input className="input input-bordered w-full bg-gray-800" value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} /></div>
                <div><label className="block text-xs text-gray-400 mb-1">아이디 *</label><input className="input input-bordered w-full bg-gray-800" value={memberForm.username} onChange={e => setMemberForm({ ...memberForm, username: e.target.value })} /></div>
                <div><label className="block text-xs text-gray-400 mb-1">비밀번호 *</label><input type="password" className="input input-bordered w-full bg-gray-800" value={memberForm.password} onChange={e => setMemberForm({ ...memberForm, password: e.target.value })} /></div>
                <div><label className="block text-xs text-gray-400 mb-1">직책</label><input className="input input-bordered w-full bg-gray-800" value={memberForm.position} onChange={e => setMemberForm({ ...memberForm, position: e.target.value })} /></div>
                <div className="col-span-2"><label className="block text-xs text-gray-400 mb-1">연락처</label><input className="input input-bordered w-full bg-gray-800" value={memberForm.phone} onChange={e => setMemberForm({ ...memberForm, phone: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button className="btn btn-ghost btn-sm" onClick={() => setShowMemberForm(null)}>취소</button>
                <button className={`btn btn-primary btn-sm ${addingMember ? 'loading' : ''}`} disabled={addingMember} onClick={handleAddMember}>생성</button>
              </div>
            </div>
          </div>
        )}

        {/* 협력사 목록 */}
        {loading ? (
          <div className="py-12 text-center"><span className="loading loading-spinner loading-md text-gray-500" /></div>
        ) : companies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 py-16 text-center">
            <BuildingOffice2Icon className="h-10 w-10 mx-auto text-gray-600 mb-3" />
            <p className="text-sm text-gray-500">등록된 협력사가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {companies.map(company => {
              const isExpanded = expandedId === company.id;
              const assignedSiteIds = company.sites.map((s: any) => s.siteId);
              return (
                <div key={company.id} className="rounded-xl border border-gray-800 bg-black/20 overflow-hidden">
                  {/* 회사 헤더 */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button onClick={() => setExpandedId(isExpanded ? null : company.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      {isExpanded ? <ChevronDownIcon className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronRightIcon className="h-4 w-4 text-gray-500 shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-200 truncate">{company.name}</p>
                        <p className="text-xs text-gray-500">
                          직원 {company.members.length}명 · 배정 현장 {company.sites.length}개
                          {company.contact && ` · ${company.contact}`}
                          {company.phone && ` · ${company.phone}`}
                        </p>
                      </div>
                    </button>
                    <div className="flex gap-2 shrink-0">
                      <button className="btn btn-ghost btn-xs gap-1" onClick={() => { setShowMemberForm(company.id); setMemberForm({ companyId: company.id, name: '', username: '', password: '', position: '', phone: '' }); }}>
                        <UserPlusIcon className="h-3.5 w-3.5" />직원 추가
                      </button>
                      <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDeleteCompany(company.id, company.name)}>
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 펼쳐진 상세 */}
                  {isExpanded && (
                    <div className="border-t border-gray-800 px-4 py-4 space-y-4">
                      {/* 배정 현장 관리 */}
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-2">배정 현장</p>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {sites.map(site => {
                            const assigned = assignedSiteIds.includes(site.id);
                            return (
                              <label key={site.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${assigned ? 'border-blue-700/50 bg-blue-950/10' : 'border-gray-800 hover:border-gray-700'}`}>
                                <input type="checkbox" className="checkbox checkbox-sm" checked={assigned}
                                  onChange={() => handleAssignSite(company.id, site.id, assigned)} />
                                <span className="truncate flex-1">{site.name}</span>
                                <span className="text-[10px] text-gray-500 shrink-0">{STATUS_LABEL[site.status]}</span>
                              </label>
                            );
                          })}
                          {sites.length === 0 && <p className="text-xs text-gray-600">배정 가능한 현장이 없습니다.</p>}
                        </div>
                      </div>

                      {/* 소속 직원 */}
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-2">소속 직원 ({company.members.length}명)</p>
                        {company.members.length === 0 ? (
                          <p className="text-xs text-gray-600">등록된 직원이 없습니다.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {company.members.map((m: any) => (
                              <div key={m.id} className="flex items-center justify-between rounded-lg border border-gray-800 px-3 py-2">
                                <div>
                                  <p className="text-sm font-medium text-gray-200">
                                    {m.position ? `${m.position} ` : ''}{m.user.name}
                                  </p>
                                  <p className="text-xs text-gray-500">{m.user.username}{m.user.phone ? ` · ${m.user.phone}` : ''}</p>
                                </div>
                                <button className="btn btn-ghost btn-xs text-error" onClick={() => handleRemoveMember(m.id)}>
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
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default PartnerCompaniesPage;
