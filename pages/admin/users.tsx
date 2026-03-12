/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useCallback, useMemo } from 'react';
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
  assignedSites?: SiteLite[];
}

const departments = [
  { value: '', label: '-' },
  { value: '경영진', label: '경영진' },
  { value: '경영지원부', label: '경영지원부' },
  { value: '영업부', label: '영업부' },
  { value: '수주팀', label: '수주팀' },
  { value: '생산관리팀', label: '생산관리팀' },
  { value: '도장팀', label: '도장팀' },
  { value: '출하팀', label: '출하팀' },
  { value: '공사팀', label: '공사팀' },
  { value: '협력사', label: '협력사' },
];

const roles = [
  { value: 'ADMIN_HR', label: 'COMPANY_ADMIN' },
  { value: 'MANAGER', label: 'INTERNAL_MANAGER' },
  { value: 'USER', label: 'INTERNAL_USER' },
  { value: 'PARTNER', label: 'PARTNER' },
  { value: 'GUEST', label: 'GUEST' },
  { value: 'VIEWER', label: 'VIEWER' },
];

type AdminTab = 'users' | 'guests';

const roleLabel = (role: string) => roles.find((r) => r.value === role)?.label || role;

const AdminUsers = () => {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  return (
    <>
      <Head>
        <title>{t('admin-users-title')}</title>
      </Head>
      <div className="space-y-6">
        <h2 className="text-xl font-bold">계정관리</h2>
        <div className="border-b border-gray-800">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { key: 'users', label: '내부/관리자' },
              { key: 'guests', label: '외부/게스트' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as AdminTab)}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <UsersPanel filter={activeTab === 'guests' ? 'guest' : 'internal'} />
      </div>
    </>
  );
};

const UsersPanel = ({ filter }: { filter: 'internal' | 'guest' }) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [sites, setSites] = useState<SiteLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [companyAdminExists, setCompanyAdminExists] = useState(false);
  const [actorRole, setActorRole] = useState('USER');

  const defaultRole = filter === 'guest' ? 'GUEST' : 'USER';
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
    department: '',
    position: '',
    phone: '',
    role: defaultRole,
    siteIds: [] as string[],
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '계정 목록을 불러오지 못했습니다.');
      const allUsers = json.data || [];
      setSites(json.meta?.sites || []);
      setCompanyAdminExists(!!json.meta?.companyAdminExists);
      setActorRole(json.meta?.actorRole || 'USER');
      const filtered = allUsers.filter((u: UserData) => {
        const role = u.teamMembers?.[0]?.role || 'USER';
        return filter === 'guest'
          ? ['PARTNER', 'GUEST', 'VIEWER'].includes(role)
          : !['PARTNER', 'GUEST', 'VIEWER'].includes(role);
      });
      setUsers(filtered);
    } catch (err: any) {
      setError(err?.message || '계정 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, role: defaultRole, siteIds: [] }));
  }, [defaultRole]);

  const availableRoles = useMemo(() => {
    const base = filter === 'guest'
      ? roles.filter((r) => ['PARTNER', 'GUEST', 'VIEWER'].includes(r.value))
      : roles.filter((r) => !['PARTNER', 'GUEST', 'VIEWER'].includes(r.value));

    return base.filter((r) => {
      if (r.value === 'ADMIN_HR') {
        return actorRole === 'ADMIN_HR' && !companyAdminExists;
      }
      if (actorRole === 'MANAGER') {
        return ['USER', 'PARTNER', 'GUEST', 'VIEWER'].includes(r.value);
      }
      return true;
    });
  }, [filter, actorRole, companyAdminExists]);

  const isExternalSelected = ['PARTNER', 'GUEST', 'VIEWER'].includes(form.role);

  const handleToggleSite = (siteId: string) => {
    setForm((prev) => ({
      ...prev,
      siteIds: prev.siteIds.includes(siteId)
        ? prev.siteIds.filter((id) => id !== siteId)
        : [...prev.siteIds, siteId],
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
      setForm({
        name: '', email: '', password: '', company: '', department: '', position: '', phone: '', role: defaultRole, siteIds: [],
      });
      await fetchUsers();
    } catch (err: any) {
      setError(err?.message || '계정 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`${userName} 계정을 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '삭제에 실패했습니다.');
      setSuccess('삭제되었습니다.');
      await fetchUsers();
    } catch (err: any) {
      setError(err?.message || '삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-400">
          {filter === 'guest'
            ? '협력사/게스트는 현장을 반드시 지정해서 생성합니다.'
            : 'COMPANY_ADMIN은 회사당 1개만 생성 가능합니다.'}
        </div>
        <Button color="primary" size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
          <PlusIcon className="h-4 w-4" /> 계정 생성
        </Button>
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
                <th className="px-4 py-3 text-left">권한</th>
                <th className="px-4 py-3 text-left">부서/직책</th>
                <th className="px-4 py-3 text-left">지정 현장</th>
                <th className="px-4 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">불러오는 중...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">계정이 없습니다.</td></tr>
              ) : users.map((user) => {
                const role = user.teamMembers?.[0]?.role || 'USER';
                return (
                  <tr key={user.id} className="border-t border-gray-800">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{roleLabel(role)}</td>
                    <td className="px-4 py-3">{[user.department, user.position].filter(Boolean).join(' / ') || '-'}</td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <div className="flex flex-wrap gap-1">
                        {user.assignedSites?.length ? user.assignedSites.map((site) => (
                          <span key={site.id} className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{site.name}</span>
                        )) : <span className="text-gray-500">-</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" onClick={() => handleDelete(user.id, user.name)} className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-red-300 hover:bg-red-500/10">
                        <TrashIcon className="h-4 w-4" /> 삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
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
              <Field label="이메일"><input className="input input-bordered w-full bg-[#1a1a1a]" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="비밀번호"><input type="password" className="input input-bordered w-full bg-[#1a1a1a]" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
              <Field label="회사명"><input className="input input-bordered w-full bg-[#1a1a1a]" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
              <Field label="부서">
                <select className="select select-bordered w-full bg-[#1a1a1a]" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                  {departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </Field>
              <Field label="직책"><input className="input input-bordered w-full bg-[#1a1a1a]" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
              <Field label="연락처"><input className="input input-bordered w-full bg-[#1a1a1a]" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="권한">
                <select className="select select-bordered w-full bg-[#1a1a1a]" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, siteIds: ['PARTNER', 'GUEST', 'VIEWER'].includes(e.target.value) ? form.siteIds : [] })}>
                  {availableRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
            </div>

            {isExternalSelected ? (
              <div className="mt-5 rounded-2xl border border-gray-800 p-4">
                <p className="mb-3 text-sm font-semibold">접근 현장 지정</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {sites.map((site) => (
                    <label key={site.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-800 px-3 py-2 hover:border-gray-700">
                      <input type="checkbox" className="checkbox checkbox-sm" checked={form.siteIds.includes(site.id)} onChange={() => handleToggleSite(site.id)} />
                      <span className="min-w-0 flex-1 break-words text-sm">{site.name}</span>
                      <span className="text-xs text-gray-500">{site.status || '-'}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">게스트/협력사는 최소 1개 현장을 선택해야 생성됩니다.</p>
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
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
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
