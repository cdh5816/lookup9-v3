import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SiteLite {
  id: string;
  name: string;
  status?: string;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  company: string | null;
  department: string | null;
  position: string | null;
  phone: string | null;
  createdAt: string;
  teamMembers: { role: string; team: { name: string } }[];
  siteAssignments?: { siteId: string; site: SiteLite }[];
}

const departments = ['경영진', '경영지원부', '영업부', '수주팀', '생산관리팀', '도장팀', '출하팀', '공사팀', '협력사'];
const ROLE_LABEL: Record<string, string> = {
  ADMIN_HR: 'COMPANY_ADMIN',
  MANAGER: 'INTERNAL_MANAGER',
  USER: 'INTERNAL_USER',
  PARTNER: 'PARTNER',
  GUEST: 'GUEST',
  VIEWER: 'VIEWER',
};

const baseRoles = [
  { value: 'ADMIN_HR', label: 'COMPANY_ADMIN' },
  { value: 'MANAGER', label: 'INTERNAL_MANAGER' },
  { value: 'USER', label: 'INTERNAL_USER' },
  { value: 'PARTNER', label: 'PARTNER' },
  { value: 'GUEST', label: 'GUEST' },
  { value: 'VIEWER', label: 'VIEWER' },
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

  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    company: '',
    department: '',
    position: '',
    phone: '',
    role: 'USER',
    assignedSiteIds: [] as string[],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, sitesRes] = await Promise.all([fetch('/api/admin/users'), fetch('/api/sites')]);
      const usersJson = await usersRes.json();
      const sitesJson = await sitesRes.json();

      if (!usersRes.ok) throw new Error(usersJson?.error?.message || '계정 목록을 불러오지 못했습니다.');
      setUsers(usersJson.data || []);
      setSites(sitesRes.ok ? sitesJson.data || [] : []);
    } catch (err: any) {
      setError(err?.message || '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasCompanyAdmin = useMemo(
    () => users.some((user) => user.teamMembers?.[0]?.role === 'ADMIN_HR'),
    [users]
  );

  const visibleUsers = useMemo(() => {
    return users.filter((user) => {
      const role = user.teamMembers?.[0]?.role || 'USER';
      if (filter === 'internal') return !['PARTNER', 'GUEST', 'VIEWER'].includes(role);
      if (filter === 'external') return ['PARTNER', 'GUEST', 'VIEWER'].includes(role);
      return true;
    });
  }, [filter, users]);

  const availableRoles = useMemo(() => {
    return baseRoles.filter((role) => {
      if (role.value === 'ADMIN_HR' && hasCompanyAdmin) return false;
      return true;
    });
  }, [hasCompanyAdmin]);

  const isExternalRole = ['PARTNER', 'GUEST', 'VIEWER'].includes(form.role);

  const resetForm = () => {
    setForm({
      name: '',
      username: '',
      email: '',
      password: '',
      company: '',
      department: '',
      position: '',
      phone: '',
      role: 'USER',
      assignedSiteIds: [],
    });
  };

  const toggleAssignedSite = (siteId: string) => {
    setForm((prev) => ({
      ...prev,
      assignedSiteIds: prev.assignedSiteIds.includes(siteId)
        ? prev.assignedSiteIds.filter((id) => id !== siteId)
        : [...prev.assignedSiteIds, siteId],
    }));
  };

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '계정 생성에 실패했습니다.');
      setSuccess('계정이 생성되었습니다.');
      setShowCreate(false);
      resetForm();
      await fetchData();
    } catch (err: any) {
      setError(err?.message || '계정 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (user: UserData) => {
    if (!window.confirm(`${user.name} 계정을 삭제하시겠습니까?`)) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
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
      <Head>
        <title>{t('admin-users-title')}</title>
      </Head>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold">계정관리</h2>
            <p className="mt-1 text-sm text-gray-500">
              COMPANY_ADMIN은 회사당 1명만 생성됩니다. 협력사/게스트 계정은 반드시 현장을 지정해야 합니다.
            </p>
          </div>
          <Button color="primary" className="gap-2" onClick={() => setShowCreate(true)}>
            <PlusIcon className="h-4 w-4" /> 계정 생성
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: '전체' },
            { key: 'internal', label: '내부' },
            { key: 'external', label: '외부/협력사' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key as typeof filter)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                filter === item.key ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-gray-700 text-gray-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
        {success ? <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-300">{success}</div> : null}

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-black/20">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-900/70 text-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left">이름</th>
                  <th className="px-4 py-3 text-left">이메일</th>
                  <th className="px-4 py-3 text-left">부서/직책</th>
                  <th className="px-4 py-3 text-left">권한</th>
                  <th className="px-4 py-3 text-left">지정 현장</th>
                  <th className="px-4 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>불러오는 중...</td>
                  </tr>
                ) : visibleUsers.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>데이터가 없습니다.</td>
                  </tr>
                ) : (
                  visibleUsers.map((user) => {
                    const role = user.teamMembers?.[0]?.role || 'USER';
                    return (
                      <tr key={user.id} className="border-t border-gray-800 align-top">
                        <td className="px-4 py-3 font-medium">{user.name}</td>
                        <td className="px-4 py-3 text-gray-400">{(user as any).username || user.email}</td>
                        <td className="px-4 py-3">
                          <div>{user.department || '-'}</div>
                          <div className="mt-1 text-xs text-gray-500">{user.position || '-'}</div>
                        </td>
                        <td className="px-4 py-3">{ROLE_LABEL[role] || role}</td>
                        <td className="px-4 py-3">
                          {user.siteAssignments && user.siteAssignments.length > 0 ? (
                            <div className="flex max-w-[340px] flex-wrap gap-1">
                              {user.siteAssignments.map((item) => (
                                <span key={`${user.id}-${item.siteId}`} className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">
                                  {item.site?.name || item.siteId}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(user)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-red-300 hover:bg-red-500/10"
                          >
                            <TrashIcon className="h-4 w-4" /> 삭제
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showCreate ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-gray-800 bg-[#111] p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold">계정 생성</h3>
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="이름"><input className="input input-bordered w-full bg-[#1a1a1a]" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="아이디 (로그인용)"><input className="input input-bordered w-full bg-[#1a1a1a]" placeholder="영문/숫자 조합" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.trim() })} /></Field>
                <Field label="이메일 (선택)"><input className="input input-bordered w-full bg-[#1a1a1a]" placeholder="입력 안 하면 자동 생성" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="비밀번호"><input type="password" className="input input-bordered w-full bg-[#1a1a1a]" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
                <Field label="권한">
                  <select className="select select-bordered w-full bg-[#1a1a1a]" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, assignedSiteIds: ['PARTNER', 'GUEST', 'VIEWER'].includes(e.target.value) ? form.assignedSiteIds : [] })}>
                    {availableRoles.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="회사명"><input className="input input-bordered w-full bg-[#1a1a1a]" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
                <Field label="부서">
                  <select className="select select-bordered w-full bg-[#1a1a1a]" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                    <option value="">-</option>
                    {departments.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>
                <Field label="직책"><input className="input input-bordered w-full bg-[#1a1a1a]" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
                <Field label="연락처"><input className="input input-bordered w-full bg-[#1a1a1a]" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              </div>

              {isExternalRole ? (
                <div className="mt-5 rounded-2xl border border-gray-800 bg-black/20 p-4">
                  <h4 className="font-semibold">현장 지정</h4>
                  <p className="mt-1 text-sm text-gray-500">협력사/게스트 계정은 최소 1개 이상 현장을 지정해야 합니다. 다수 현장 지정 가능합니다.</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {sites.map((site) => (
                      <label key={site.id} className="flex items-start gap-3 rounded-xl border border-gray-800 px-3 py-2 text-sm">
                        <input type="checkbox" className="checkbox checkbox-sm mt-0.5" checked={form.assignedSiteIds.includes(site.id)} onChange={() => toggleAssignedSite(site.id)} />
                        <span className="break-words leading-6">{site.name} <span className="text-xs text-gray-500">{site.status || ''}</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex justify-end gap-2">
                <Button color="ghost" onClick={() => setShowCreate(false)}>취소</Button>
                <Button color="primary" loading={creating} onClick={handleCreate}>생성</Button>
              </div>
            </div>
          </div>
        ) : null}
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
  return {
    props: {
      ...(await serverSideTranslations(context.locale ?? 'ko', ['common'])),
    },
  };
}
