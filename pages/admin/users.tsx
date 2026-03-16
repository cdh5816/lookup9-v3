import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';

interface SiteLite { id: string; name: string; status?: string; }
interface UserData {
  id: string; name: string; email: string; company: string | null;
  department: string | null; position: string | null; phone: string | null;
  createdAt: string;
  teamMembers: { role: string; team: { name: string } }[];
  siteAssignments?: { siteId: string; site: SiteLite }[];
}

const departments = ['경영진', '경영지원부', '영업부', '수주팀', '생산관리팀', '도장팀', '출하팀', '공사팀', '협력사'];

const ROLE_LABEL: Record<string, string> = {
  ADMIN_HR: 'COMPANY_ADMIN', MANAGER: 'MANAGER', USER: 'USER',
  PARTNER: 'PARTNER', GUEST: 'GUEST', VIEWER: 'VIEWER',
};

// 기본 역할 목록 (ADMIN_HR 제외 - SUPER_ADMIN 전용으로 동적 추가)
const BASE_ROLES = [
  { value: 'MANAGER', label: 'MANAGER (내부 관리자)' },
  { value: 'USER',    label: 'USER (내부 직원)' },
  { value: 'PARTNER', label: 'PARTNER (협력사)' },
  { value: 'GUEST',   label: 'GUEST (게스트)' },
];

const AdminUsers = () => {
  const { t } = useTranslation('common');
  const [users, setUsers] = useState<UserData[]>([]);
  const [sites, setSites] = useState<SiteLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [meta, setMeta] = useState<{ actorRole: string; canDelete: boolean; canCreateAdmin: boolean }>({
    actorRole: 'USER', canDelete: false, canCreateAdmin: false,
  });

  // 현재 로그인 사용자 정보
  const { data: profileData } = useSWR('/api/my/profile', fetcher);
  const currentUserId = profileData?.data?.id;

  const [form, setForm] = useState({
    name: '', username: '', email: '', password: '',
    company: '', department: '', position: '', phone: '',
    role: 'USER', assignedSiteIds: [] as string[],
  });

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [usersRes, sitesRes] = await Promise.all([fetch('/api/admin/users'), fetch('/api/sites')]);
      const usersJson = await usersRes.json();
      const sitesJson = await sitesRes.json();
      if (!usersRes.ok) throw new Error(usersJson?.error?.message || '계정 목록을 불러오지 못했습니다.');
      setUsers(usersJson.data || []);
      setSites(sitesRes.ok ? sitesJson.data || [] : []);
      if (usersJson.meta) setMeta(usersJson.meta);
    } catch (err: any) {
      setError(err?.message || '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visibleUsers = useMemo(() => {
    return users.filter((user) => {
      const role = user.teamMembers?.[0]?.role || 'USER';
      if (filter === 'internal') return !['PARTNER', 'GUEST', 'VIEWER'].includes(role);
      if (filter === 'external') return ['PARTNER', 'GUEST', 'VIEWER'].includes(role);
      return true;
    });
  }, [filter, users]);

  // SUPER_ADMIN만 ADMIN_HR 생성 옵션 표시
  const availableRoles = useMemo(() => {
    const roles = [...BASE_ROLES];
    if (meta.canCreateAdmin) {
      roles.unshift({ value: 'ADMIN_HR', label: 'COMPANY_ADMIN (회사 관리자)' });
    }
    return roles;
  }, [meta.canCreateAdmin]);

  const isExternalRole = ['PARTNER', 'GUEST', 'VIEWER'].includes(form.role);

  const resetForm = () => {
    setForm({ name: '', username: '', email: '', password: '', company: '', department: '', position: '', phone: '', role: 'USER', assignedSiteIds: [] });
  };

  const toggleAssignedSite = (siteId: string) => {
    setForm(prev => ({
      ...prev,
      assignedSiteIds: prev.assignedSiteIds.includes(siteId)
        ? prev.assignedSiteIds.filter(id => id !== siteId)
        : [...prev.assignedSiteIds, siteId],
    }));
  };

  const handleCreate = async () => {
    setCreating(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '계정 생성에 실패했습니다.');
      setSuccess('계정이 생성되었습니다.');
      setShowCreate(false); resetForm(); await fetchData();
    } catch (err: any) {
      setError(err?.message || '계정 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (user: UserData) => {
    // 자기 자신 삭제 방지
    if (user.id === currentUserId) {
      alert('자기 자신의 계정은 삭제할 수 없습니다.');
      return;
    }
    if (!window.confirm(`${user.name} 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '계정 삭제에 실패했습니다.');
      setSuccess('계정이 삭제되었습니다.');
      await fetchData();
    } catch (err: any) {
      setError(err?.message || '계정 삭제에 실패했습니다.');
    }
  };

  return (
    <>
      <Head><title>{t('admin-users-title')}</title></Head>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold">계정관리</h2>
            <p className="mt-1 text-sm text-gray-500">
              {meta.canCreateAdmin
                ? 'COMPANY_ADMIN 계정을 포함한 모든 역할을 생성할 수 있습니다.'
                : '내부 직원, 협력사, 게스트 계정을 관리합니다. 협력사/게스트 계정은 현장 지정이 필수입니다.'}
            </p>
          </div>
          <Button color="primary" className="gap-2" onClick={() => setShowCreate(true)}>
            <PlusIcon className="h-4 w-4" /> 계정 생성
          </Button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</div>
        )}
        {success && (
          <div className="rounded-xl border border-green-800/50 bg-green-950/30 px-4 py-3 text-sm text-green-300">{success}</div>
        )}

        {/* 필터 탭 */}
        <div className="flex flex-wrap gap-2">
          {(['all', 'internal', 'external'] as const).map(f => (
            <button key={f} type="button"
              className={`rounded-lg border px-4 py-1.5 text-sm transition ${filter === f ? 'border-blue-600 bg-blue-950/40 text-blue-300' : 'border-gray-800 text-gray-400 hover:border-gray-700'}`}
              onClick={() => setFilter(f)}>
              {f === 'all' ? '전체' : f === 'internal' ? '내부 직원' : '외부 (협력사/게스트)'}
            </button>
          ))}
          <span className="ml-auto self-center text-xs text-gray-600">{visibleUsers.length}명</span>
        </div>

        {/* 사용자 테이블 */}
        <div className="rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/60 text-xs text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">이름</th>
                  <th className="px-4 py-3 text-left">아이디</th>
                  <th className="px-4 py-3 text-left">부서 / 직책</th>
                  <th className="px-4 py-3 text-left">권한</th>
                  <th className="px-4 py-3 text-left">지정 현장</th>
                  <th className="px-4 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={6}>불러오는 중...</td></tr>
                ) : visibleUsers.length === 0 ? (
                  <tr><td className="px-4 py-8 text-center text-gray-500" colSpan={6}>데이터가 없습니다.</td></tr>
                ) : (
                  visibleUsers.map((user) => {
                    const role = user.teamMembers?.[0]?.role || 'USER';
                    const isSelf = user.id === currentUserId;
                    const isCompanyAdmin = role === 'ADMIN_HR' || role === 'ADMIN';
                    // 삭제 버튼: canDelete(ADMIN_HR 이상)이고, 자기 자신 아니고, COMPANY_ADMIN 아닌 경우
                    const showDelete = meta.canDelete && !isSelf && !isCompanyAdmin;
                    // SUPER_ADMIN은 COMPANY_ADMIN도 삭제 가능
                    const showDeleteAdmin = meta.actorRole === 'SUPER_ADMIN' && !isSelf && isCompanyAdmin;

                    return (
                      <tr key={user.id} className="border-t border-gray-800 align-top hover:bg-gray-900/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          {user.name}
                          {isSelf && <span className="ml-1.5 text-[10px] text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">나</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400">{(user as any).username || user.email}</td>
                        <td className="px-4 py-3">
                          <div>{user.department || '-'}</div>
                          <div className="mt-0.5 text-xs text-gray-500">{user.position || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            isCompanyAdmin ? 'bg-orange-900/40 text-orange-300' :
                            role === 'MANAGER' ? 'bg-blue-900/30 text-blue-300' :
                            role === 'PARTNER' ? 'bg-purple-900/30 text-purple-300' :
                            role === 'GUEST' ? 'bg-gray-800 text-gray-400' :
                            'bg-gray-800/50 text-gray-300'
                          }`}>
                            {ROLE_LABEL[role] || role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {user.siteAssignments && user.siteAssignments.length > 0 ? (
                            <div className="flex max-w-[280px] flex-wrap gap-1">
                              {user.siteAssignments.map(item => (
                                <span key={`${user.id}-${item.siteId}`} className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">
                                  {item.site?.name || item.siteId}
                                </span>
                              ))}
                            </div>
                          ) : <span className="text-gray-600">-</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(showDelete || showDeleteAdmin) ? (
                            <button type="button" onClick={() => handleDelete(user)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10 transition-colors">
                              <TrashIcon className="h-3.5 w-3.5" /> 삭제
                            </button>
                          ) : (
                            <span className="text-xs text-gray-700">
                              {isSelf ? '(본인)' : isCompanyAdmin ? '(보호됨)' : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 계정 생성 모달 */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-800 bg-[#111] p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">계정 생성</h3>
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-800">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {error && <div className="mb-3 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">{error}</div>}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="이름 *"><input className="input input-bordered w-full bg-[#1a1a1a]" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="아이디 (로그인용) *"><input className="input input-bordered w-full bg-[#1a1a1a]" placeholder="영문/숫자 조합" value={form.username} onChange={e => setForm({ ...form, username: e.target.value.trim() })} /></Field>
                <Field label="이메일 (선택)"><input className="input input-bordered w-full bg-[#1a1a1a]" placeholder="미입력 시 자동 생성" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="비밀번호 *"><input type="password" className="input input-bordered w-full bg-[#1a1a1a]" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field>
                <Field label="권한 *">
                  <select className="select select-bordered w-full bg-[#1a1a1a]" value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value, assignedSiteIds: ['PARTNER', 'GUEST', 'VIEWER'].includes(e.target.value) ? form.assignedSiteIds : [] })}>
                    {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </Field>
                <Field label="부서">
                  <select className="select select-bordered w-full bg-[#1a1a1a]" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                    <option value="">-</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="직책"><input className="input input-bordered w-full bg-[#1a1a1a]" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} /></Field>
                <Field label="연락처"><input className="input input-bordered w-full bg-[#1a1a1a]" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
                <Field label="회사명"><input className="input input-bordered w-full bg-[#1a1a1a]" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></Field>
              </div>

              {isExternalRole && (
                <div className="mt-5 rounded-xl border border-gray-800 bg-black/20 p-4">
                  <h4 className="font-semibold mb-1">현장 지정 <span className="text-red-400 text-sm">*필수</span></h4>
                  <p className="text-xs text-gray-500 mb-3">협력사/게스트 계정은 최소 1개 이상 현장을 지정해야 합니다.</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 max-h-48 overflow-y-auto">
                    {sites.map(site => (
                      <label key={site.id} className="flex items-start gap-3 rounded-lg border border-gray-800 px-3 py-2 text-sm cursor-pointer hover:border-gray-700">
                        <input type="checkbox" className="checkbox checkbox-sm mt-0.5" checked={form.assignedSiteIds.includes(site.id)} onChange={() => toggleAssignedSite(site.id)} />
                        <span className="break-words leading-5">{site.name}<span className="text-xs text-gray-500 ml-1">{site.status}</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <Button color="ghost" onClick={() => { setShowCreate(false); resetForm(); }}>취소</Button>
                <Button color="primary" loading={creating} onClick={handleCreate}>생성</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="form-control">
    <span className="mb-1 text-sm text-gray-300">{label}</span>
    {children}
  </label>
);

export default AdminUsers;

export async function getServerSideProps(context: GetServerSidePropsContext) {
  return { props: { ...(await serverSideTranslations(context.locale ?? 'ko', ['common'])) } };
}
