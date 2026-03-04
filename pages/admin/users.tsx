import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';
import {
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

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

const AdminUsers = () => {
  const { t } = useTranslation('common');
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    company: '',
    department: '',
    position: '',
    phone: '',
    role: 'MEMBER',
  });

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    setSuccess('');

    // 첫 번째 팀 ID 가져오기
    const teamsRes = await fetch('/api/teams');
    const teamsData = await teamsRes.json();
    const teamId = teamsData.data?.[0]?.id || null;

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, teamId }),
    });

    if (res.ok) {
      setSuccess(t('admin-user-created'));
      setForm({
        name: '',
        email: '',
        password: '',
        company: '',
        department: '',
        position: '',
        phone: '',
        role: 'MEMBER',
      });
      setShowCreate(false);
      fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error?.message || t('unknown-error'));
    }
    setCreating(false);
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`${userName} ${t('admin-delete-confirm')}`)) {
      return;
    }

    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (res.ok) {
      setSuccess(t('admin-user-deleted'));
      fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error?.message || t('unknown-error'));
    }
  };

  return (
    <>
      <Head>
        <title>{t('admin-users-title')}</title>
      </Head>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{t('admin-users')}</h2>
          <Button
            color="primary"
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
          >
            {showCreate ? (
              <XMarkIcon className="w-4 h-4 mr-1" />
            ) : (
              <PlusIcon className="w-4 h-4 mr-1" />
            )}
            {showCreate ? t('cancel') : t('admin-create-user')}
          </Button>
        </div>

        {error && (
          <div className="alert alert-error text-sm">
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success text-sm">
            <span>{success}</span>
          </div>
        )}

        {/* 계정 생성 폼 */}
        {showCreate && (
          <div className="border rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">{t('admin-create-user')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  <span className="label-text">{t('name')} *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">{t('email')} *</span>
                </label>
                <input
                  type="email"
                  className="input input-bordered w-full"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">{t('password')} *</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">{t('admin-company')}</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">{t('admin-department')}</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={form.department}
                  onChange={(e) =>
                    setForm({ ...form, department: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">{t('admin-position')}</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={form.position}
                  onChange={(e) =>
                    setForm({ ...form, position: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">{t('admin-phone')}</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">
                  <span className="label-text">{t('role')}</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="OWNER">OWNER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="MEMBER">MEMBER</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                color="primary"
                loading={creating}
                onClick={handleCreate}
              >
                {t('create-account')}
              </Button>
            </div>
          </div>
        )}

        {/* 유저 목록 테이블 */}
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('email')}</th>
                <th>{t('admin-company')}</th>
                <th>{t('admin-department')}</th>
                <th>{t('admin-position')}</th>
                <th>{t('role')}</th>
                <th>{t('created-at')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center">
                    <span className="loading loading-spinner loading-sm"></span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-gray-500">
                    {t('admin-no-users')}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.company || '-'}</td>
                    <td>{user.department || '-'}</td>
                    <td>{user.position || '-'}</td>
                    <td>
                      <span className="badge badge-sm">
                        {user.teamMembers?.[0]?.role || '-'}
                      </span>
                    </td>
                    <td>
                      {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => handleDelete(user.id, user.name)}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps({
  locale,
}: GetServerSidePropsContext) {
  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
}

export default AdminUsers;
