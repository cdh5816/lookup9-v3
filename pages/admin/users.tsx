import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { getRoleDisplayName } from '@/lib/lookup9-role';
import { Button } from 'react-daisyui';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

// ========= Types =========
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

interface ClientData {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  type: string;
  notes: string | null;
  _count: { sites: number };
}

// ========= Constants =========
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
  { value: 'ADMIN_HR', label: 'COMPANY_ADMIN (회사 관리자)' },
  { value: 'MANAGER', label: 'INTERNAL_MANAGER (팀장급 내부)' },
  { value: 'USER', label: 'INTERNAL_USER (팀원급 내부)' },
  { value: 'PARTNER', label: 'PARTNER (협력사)' },
  { value: 'GUEST', label: 'CLIENT/GUEST (외부 열람)' },
  { value: 'VIEWER', label: 'CLIENT/GUEST VIEWER (열람전용)' },
];

type AdminTab = 'users' | 'guests' | 'clients';

// ========= Main Component =========
const AdminUsers = () => {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  const adminTabs: { key: AdminTab; label: string }[] = [
    { key: 'users', label: t('admin-tab-users') },
    { key: 'guests', label: t('admin-tab-guests') },
    { key: 'clients', label: t('admin-tab-clients') },
  ];

  return (
    <>
      <Head>
        <title>{t('admin-users-title')}</title>
      </Head>

      <div className="space-y-6">
        <h2 className="text-xl font-bold">{t('admin-users')}</h2>

        <div className="border-b border-gray-800">
          <div className="flex gap-1 overflow-x-auto">
            {adminTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
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

        {activeTab === 'users' && <UsersPanel filter="internal" />}
        {activeTab === 'guests' && <UsersPanel filter="guest" />}
        {activeTab === 'clients' && <ClientsPanel />}
      </div>
    </>
  );
};

// ========= Users Panel =========
const UsersPanel = ({ filter }: { filter: 'internal' | 'guest' }) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
  });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/users?filter=${filter}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || '사용자 목록을 불러오지 못했습니다.');
      }

      setUsers(json.data || []);
    } catch (err: any) {
      setError(err?.message || '사용자 목록을 불러오지 못했습니다.');
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
    }));
  }, [filter]);

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      password: '',
      company: '',
      department: '',
      position: '',
      phone: '',
      role: filter === 'guest' ? 'GUEST' : 'USER',
    });
  };

  const onCreate = async () => {
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

      if (!res.ok) {
        throw new Error(json?.error || '계정 생성에 실패했습니다.');
      }

      setSuccess('계정이 생성되었습니다.');
      setShowCreate(false);
      resetForm();
      await fetchUsers();
    } catch (err: any) {
      setError(err?.message || '계정 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (id: string) => {
    const ok = window.confirm('정말 삭제하시겠습니까?');
    if (!ok) return;

    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/admin/users?id=${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || '삭제에 실패했습니다.');
      }

      setSuccess('삭제되었습니다.');
      await fetchUsers();
    } catch (err: any) {
      setError(err?.message || '삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-400">
            {filter === 'guest'
              ? '외부 열람/게스트 계정을 관리합니다.'
              : '내부 사용자 및 협력사 계정을 관리합니다.'}
          </p>
        </div>

        <Button
          color="primary"
          className="gap-2"
          onClick={() => {
            setShowCreate(true);
            setError('');
            setSuccess('');
          }}
        >
          <PlusIcon className="h-4 w-4" />
          계정 생성
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {success}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-black/30">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-900/70 text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left">이름</th>
                <th className="px-4 py-3 text-left">이메일</th>
                <th className="px-4 py-3 text-left">부서</th>
                <th className="px-4 py-3 text-left">직책</th>
                <th className="px-4 py-3 text-left">권한</th>
                <th className="px-4 py-3 text-left">생성일</th>
                <th className="px-4 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={7}>
                    불러오는 중...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={7}>
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const role = user.teamMembers?.[0]?.role || '-';

                  return (
                    <tr key={user.id} className="border-t border-gray-800">
                      <td className="px-4 py-3">{user.name}</td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">{user.department || '-'}</td>
                      <td className="px-4 py-3">{user.position || '-'}</td>
                      <td className="px-4 py-3">{getRoleDisplayName(role)}</td>
                      <td className="px-4 py-3">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onDelete(user.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-red-300 hover:bg-red-500/10"
                        >
                          <TrashIcon className="h-4 w-4" />
                          삭제
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
          <div className="w-full max-w-2xl rounded-2xl border border-gray-800 bg-[#111] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">계정 생성</h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="form-control">
                <span className="mb-1 text-sm text-gray-300">이름</span>
                <input
                  className="input input-bordered w-full bg-[#1a1a1a]"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>

              <label className="form-control">
                <span className="mb-1 text-sm text-gray-300">이메일</span>
                <input
                  className="input input-bordered w-full bg-[#1a1a1a]"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>

              <label className="form-control">
                <span className="mb-1 text-sm text-gray-300">비밀번호</span>
                <input
                  type="password"
                  className="input input-bordered w-full bg-[#1a1a1a]"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>

              <label className="form-control">
                <span className="mb-1 text-sm text-gray-300">회사명</span>
                <input
                  className="input input-bordered w-full bg-[#1a1a1a]"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </label>

              <label className="form-control">
                <span className="mb-1 text-sm text-gray-300">부서</span>
                <select
                  className="select select-bordered w-full bg-[#1a1a1a]"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                >
                  {departments.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-control">
                <span className="mb-1 text-sm text-gray-300">직책</span>
                <input
                  className="input input-bordered w-full bg-[#1a1a1a]"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </label>

              <label className="form-control">
                <span className="mb-1 text-sm text-gray-300">연락처</span>
                <input
                  className="input input-bordered w-full bg-[#1a1a1a]"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>

              <label className="form-control">
                <span className="mb-1 text-sm text-gray-300">권한</span>
                <select
                  className="select select-bordered w-full bg-[#1a1a1a]"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {roles
                    .filter((r) => (filter === 'guest' ? ['GUEST', 'VIEWER'].includes(r.value) : !['GUEST', 'VIEWER'].includes(r.value)))
                    .map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button color="ghost" onClick={() => setShowCreate(false)}>
                취소
              </Button>
              <Button color="primary" loading={creating} onClick={onCreate}>
                생성
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ========= Clients Panel =========
const ClientsPanel = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/users?entity=clients');
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || '수요처 목록을 불러오지 못했습니다.');
      }

      setClients(json.data || []);
    } catch (err: any) {
      setError(err?.message || '수요처 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-gray-800 bg-black/30">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-900/70 text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left">업체명</th>
                <th className="px-4 py-3 text-left">담당자</th>
                <th className="px-4 py-3 text-left">연락처</th>
                <th className="px-4 py-3 text-left">이메일</th>
                <th className="px-4 py-3 text-left">유형</th>
                <th className="px-4 py-3 text-left">현장 수</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>
                    불러오는 중...
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={6}>
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="border-t border-gray-800">
                    <td className="px-4 py-3">{client.name}</td>
                    <td className="px-4 py-3">{client.contact || '-'}</td>
                    <td className="px-4 py-3">{client.phone || '-'}</td>
                    <td className="px-4 py-3">{client.email || '-'}</td>
                    <td className="px-4 py-3">{client.type}</td>
                    <td className="px-4 py-3">{client._count?.sites ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
