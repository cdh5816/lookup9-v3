/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

type RoleValue = 'ADMIN_HR' | 'MANAGER' | 'USER' | 'PARTNER' | 'GUEST' | 'VIEWER';

type SiteOption = { id: string; name: string; status: string };

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
}

const departments = ['', '경영진', '경영지원부', '영업부', '수주팀', '생산관리팀', '도장팀', '출하팀', '공사팀', '협력사'];
const roles: { value: RoleValue; label: string }[] = [
  { value: 'ADMIN_HR', label: 'COMPANY_ADMIN' },
  { value: 'MANAGER', label: 'INTERNAL_MANAGER' },
  { value: 'USER', label: 'INTERNAL_USER' },
  { value: 'PARTNER', label: 'PARTNER' },
  { value: 'GUEST', label: 'GUEST' },
  { value: 'VIEWER', label: 'VIEWER' },
];

const AdminUsers = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [companyAdminExists, setCompanyAdminExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'internal' | 'guest'>('internal');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
    department: '',
    position: '',
    phone: '',
    role: 'USER' as RoleValue,
    assignedSiteIds: [] as string[],
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/users?filter=${filter}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '계정 목록을 불러오지 못했습니다.');
      setUsers(json.data || []);
      setSites(json.meta?.sites || []);
      setCompanyAdminExists(Boolean(json.meta?.companyAdminExists));
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
    setForm((prev) => ({
      ...prev,
      role: filter === 'guest' ? 'GUEST' : 'USER',
      assignedSiteIds: filter === 'guest' ? prev.assignedSiteIds : [],
    }));
  }, [filter]);

  const isExternal = ['PARTNER', 'GUEST', 'VIEWER'].includes(form.role);

  const availableRoles = roles.filter((r) => {
    if (filter === 'guest') return ['PARTNER', 'GUEST', 'VIEWER'].includes(r.value);
    if (r.value === 'ADMIN_HR' && companyAdminExists) return false;
    return ['ADMIN_HR', 'MANAGER', 'USER'].includes(r.value);
  });

  const toggleSite = (siteId: string) => {
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
      setForm({
        name: '', email: '', password: '', company: '', department: '', position: '', phone: '', role: filter === 'guest' ? 'GUEST' : 'USER', assignedSiteIds: [],
      });
      fetchUsers();
    } catch (err: any) {
      setError(err?.message || '계정 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`${userName} 계정을 삭제할까요?`)) return;
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '삭제에 실패했습니다.');
      setSuccess('계정이 삭제되었습니다.');
      fetchUsers();
    } catch (err: any) {
      setError(err?.message || '삭제에 실패했습니다.');
    }
  };

  return (
    <>
      <Head>
        <title>계정관리 | LOOKUP9</title>
      </Head>

      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-800 bg-black/20 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">계정관리</h1>
            <p className="mt-2 break-words text-sm leading-6 text-gray-400">
              COMPANY_ADMIN은 회사당 1명만 생성됩니다. 외부 계정은 생성할 때 현장을 반드시 지정해야 합니다.
            </p>
          </div>
          <Button color="primary" className="gap-2" onClick={() => setShowCreate(true)}>
            <PlusIcon className="h-4 w-4" /> 계정 생성
          </Button>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm ${filter === 'internal' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}
            onClick={() => setFilter('internal')}
          >
            내부 계정
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm ${filter === 'guest' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}
            onClick={() => setFilter('guest')}
          >
            외부/게스트 계정
          </button>
        </div>

        {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
        {success ? <div className="rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-300">{success}</div> : null}

        {showCreate ? (
          <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">새 계정 생성</h2>
              <button type="button" className="rounded-lg p-2 hover:bg-gray-800" onClick={() => setShowCreate(false)}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input className="input input-bordered w-full" placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="이메일" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input type="password" className="input input-bordered w-full" placeholder="비밀번호" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="회사명" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <select className="select select-bordered w-full" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                {departments.map((d) => <option key={d} value={d}>{d || '-'}</option>)}
              </select>
              <input className="input input-bordered w-full" placeholder="직책" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              <input className="input input-bordered w-full" placeholder="휴대폰번호" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <select className="select select-bordered w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as RoleValue, assignedSiteIds: [] })}>
                {availableRoles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {companyAdminExists && filter === 'internal' ? (
              <p className="mt-3 text-xs text-amber-300">이 회사는 이미 COMPANY_ADMIN이 있습니다. 추가 생성은 차단됩니다.</p>
            ) : null}

            {isExternal ? (
              <div className="mt-5 rounded-2xl border border-gray-800 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">현장 지정</h3>
                    <p className="mt-1 text-xs text-gray-500">외부 계정은 접근 가능한 현장을 먼저 지정해야 합니다. 여러 현장 지정 가능합니다.</p>
                  </div>
                  <span className="rounded-full border border-blue-800 px-2 py-1 text-xs text-blue-300">{form.assignedSiteIds.length}개 선택</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {sites.map((site) => {
                    const checked = form.assignedSiteIds.includes(site.id);
                    return (
                      <label key={site.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${checked ? 'border-blue-500/50 bg-blue-500/10' : 'border-gray-800 bg-black/10'}`}>
                        <input type="checkbox" className="checkbox checkbox-sm mt-0.5" checked={checked} onChange={() => toggleSite(site.id)} />
                        <span className="min-w-0 text-sm">
                          <span className="block break-words font-medium leading-5">{site.name}</span>
                          <span className="mt-1 block text-xs text-gray-500">상태: {site.status}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button color="ghost" onClick={() => setShowCreate(false)}>취소</Button>
              <Button color="primary" loading={creating} onClick={handleCreate}>생성</Button>
            </div>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-black/20">
          <div className="overflow-x-auto">
            <table className="table w-full text-sm">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>부서</th>
                  <th>직책</th>
                  <th>권한</th>
                  <th>생성일</th>
                  <th className="text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="py-10 text-center text-gray-500">불러오는 중...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={7} className="py-10 text-center text-gray-500">계정이 없습니다.</td></tr>
                ) : users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.department || '-'}</td>
                    <td>{user.position || '-'}</td>
                    <td><span className="badge badge-sm">{user.teamMembers?.[0]?.role || '-'}</span></td>
                    <td>{new Date(user.createdAt).toLocaleDateString('ko-KR')}</td>
                    <td className="text-right">
                      <button type="button" className="inline-flex items-center rounded-lg p-2 text-red-300 hover:bg-red-500/10" onClick={() => handleDelete(user.id, user.name)}>
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminUsers;

export async function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: {
      ...(await serverSideTranslations(context.locale ?? 'ko', ['common'])),
    },
  };
}
