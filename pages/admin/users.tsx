/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface UserData {
  id: string;
  name: string;
  email: string;
  company: string | null;
  department: string | null;
  position: string | null;
  phone: string | null;
  createdAt: string;
  siteAssignments?: { id: string; site: { id: string; name: string } }[];
  teamMembers: { role: string; team: { name: string } }[];
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

const allRoles = [
  { value: 'ADMIN_HR', label: 'COMPANY_ADMIN (회사 최고관리자)' },
  { value: 'MANAGER', label: 'INTERNAL_MANAGER (부서장)' },
  { value: 'USER', label: 'INTERNAL_USER (직원)' },
  { value: 'PARTNER', label: 'PARTNER (협력사)' },
  { value: 'GUEST', label: 'GUEST (외부고객)' },
  { value: 'VIEWER', label: 'VIEWER (열람전용)' },
];

type AdminTab = 'users' | 'guests';

const AdminUsers = () => {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  return (
    <>
      <Head><title>{t('admin-users-title')}</title></Head>
      <div className="space-y-6">
        <h2 className="text-xl font-bold">계정관리</h2>
        <div className="border-b border-gray-800">
          <div className="flex gap-1 overflow-x-auto">
            <button onClick={() => setActiveTab('users')} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'users' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400'}`}>내부계정</button>
            <button onClick={() => setActiveTab('guests')} className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'guests' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400'}`}>외부/게스트</button>
          </div>
        </div>
        <UsersPanel filter={activeTab} />
      </div>
    </>
  );
};

const UsersPanel = ({ filter }: { filter: AdminTab }) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [meta, setMeta] = useState<{ hasCompanyAdmin: boolean; sites: { id: string; name: string }[] }>({ hasCompanyAdmin: false, sites: [] });
  const defaultRole = filter === 'guests' ? 'GUEST' : 'USER';
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '', department: '', position: '', phone: '', role: defaultRole, siteIds: [] as string[] });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      setMeta(data.meta || { hasCompanyAdmin: false, sites: [] });
      const filtered = (data.data || []).filter((u: UserData) => {
        const role = u.teamMembers?.[0]?.role || 'USER';
        return filter === 'guests'
          ? ['GUEST', 'PARTNER', 'VIEWER'].includes(role)
          : !['GUEST', 'PARTNER', 'VIEWER'].includes(role);
      });
      setUsers(filtered);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setForm((prev) => ({ ...prev, role: defaultRole, siteIds: [] }));
  }, [defaultRole]);

  const availableRoles = allRoles.filter((r) => {
    if (filter === 'guests') return ['GUEST', 'PARTNER', 'VIEWER'].includes(r.value);
    if (r.value === 'ADMIN_HR' && meta.hasCompanyAdmin) return false;
    return !['GUEST', 'PARTNER', 'VIEWER'].includes(r.value);
  });

  const isExternal = ['PARTNER', 'GUEST', 'VIEWER'].includes(form.role);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    setSuccess('');
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setSuccess('계정이 생성되었습니다.');
      setForm({ name: '', email: '', password: '', company: '', department: '', position: '', phone: '', role: defaultRole, siteIds: [] });
      setShowCreate(false);
      fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error?.message || '생성 중 오류가 발생했습니다.');
    }
    setCreating(false);
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`${userName} 계정을 삭제하시겠습니까?`)) return;
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setSuccess('계정이 삭제되었습니다.');
      fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error?.message || '삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-400">
          {filter === 'guests' ? '외부 계정은 생성 시 현장을 반드시 지정해야 합니다.' : 'COMPANY_ADMIN은 회사당 1명만 허용됩니다.'}
        </div>
        <Button color="primary" size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
          <PlusIcon className="h-4 w-4" /> 계정 생성
        </Button>
      </div>

      {error ? <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
      {success ? <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-300">{success}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-black/20">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-900/60 text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left">이름</th>
                <th className="px-4 py-3 text-left">이메일</th>
                <th className="px-4 py-3 text-left">부서</th>
                <th className="px-4 py-3 text-left">권한</th>
                <th className="px-4 py-3 text-left">지정현장</th>
                <th className="px-4 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">불러오는 중...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">계정이 없습니다.</td></tr>
              ) : users.map((user) => {
                const role = user.teamMembers?.[0]?.role || '-';
                return (
                  <tr key={user.id} className="border-t border-gray-800 align-top">
                    <td className="px-4 py-3 whitespace-nowrap">{user.name}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{user.department || '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{role}</td>
                    <td className="px-4 py-3">
                      {user.siteAssignments?.length ? user.siteAssignments.map((item) => item.site.name).join(', ') : '-'}
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
          <div className="w-full max-w-3xl rounded-2xl border border-gray-800 bg-[#111] p-5 shadow-2xl">
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
                <select className="select select-bordered w-full bg-[#1a1a1a]" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, siteIds: [] })}>
                  {availableRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
            </div>

            {isExternal ? (
              <div className="mt-5 rounded-xl border border-gray-800 p-4">
                <div className="mb-3 text-sm font-semibold">현장 지정 (다중 선택 가능)</div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 max-h-56 overflow-y-auto">
                  {meta.sites.map((site) => {
                    const checked = form.siteIds.includes(site.id);
                    return (
                      <label key={site.id} className="flex items-start gap-3 rounded-lg border border-gray-800 px-3 py-2 text-sm hover:border-gray-600">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm mt-0.5"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setForm({ ...form, siteIds: [...form.siteIds, site.id] });
                            else setForm({ ...form, siteIds: form.siteIds.filter((id) => id !== site.id) });
                          }}
                        />
                        <span className="break-words leading-5">{site.name}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">외부 계정은 최소 1개 이상 현장을 지정해야 생성됩니다.</p>
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
  return { props: { ...(await serverSideTranslations(context.locale ?? 'ko', ['common'])) } };
}
