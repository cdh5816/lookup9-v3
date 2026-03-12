/* eslint-disable i18next/no-literal-string */
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Button } from 'react-daisyui';

type ApprovalItem = {
  id: string;
  title: string;
  type: string;
  priority: string;
  targetDept: string | null;
  status: string;
  description: string | null;
  result: string | null;
  createdAt: string;
  updatedAt: string;
  site: { id: string; name: string; status: string };
  createdBy: { id: string; name: string; department?: string | null; position?: string | null };
  handledBy?: { id: string; name: string; department?: string | null; position?: string | null } | null;
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [resultMap, setResultMap] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/approvals');
    const json = await res.json();
    if (res.ok) setItems(json.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (id: string, status: string) => {
    setBusyId(id);
    await fetch('/api/approvals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: id, status, result: resultMap[id] || '' }),
    });
    setBusyId('');
    load();
  };

  return (
    <>
      <Head><title>전자결재 | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <h1 className="text-2xl font-bold">전자결재 / 승인함</h1>
          <p className="mt-2 text-sm text-gray-400">ERPNext/Odoo 스타일로, 결재대상 부서 기준으로 승인 요청을 모아보는 경량 승인함입니다.</p>
        </div>
        {loading ? <div className="py-10 text-center text-gray-500">불러오는 중...</div> : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-800 bg-black/10 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{item.type}</span>
                  <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{item.priority}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${item.status === '승인' ? 'bg-green-500/15 text-green-300' : item.status === '반려' ? 'bg-red-500/15 text-red-300' : 'bg-yellow-500/15 text-yellow-200'}`}>{item.status}</span>
                </div>
                <h2 className="mt-3 text-lg font-bold leading-7 break-words">{item.title}</h2>
                <div className="mt-2 text-sm text-gray-400 leading-6 break-words">
                  <p>현장: {item.site.name}</p>
                  <p>요청자: {item.createdBy.position ? `${item.createdBy.position} ` : ''}{item.createdBy.name}</p>
                  <p>대상부서: {item.targetDept || '공통'}</p>
                  <p>등록일: {new Date(item.createdAt).toLocaleString('ko-KR')}</p>
                </div>
                {item.description ? <div className="mt-3 rounded-xl bg-gray-900/50 p-3 text-sm leading-6 whitespace-pre-wrap break-words">{item.description}</div> : null}
                <textarea className="mt-4 textarea textarea-bordered h-24 w-full" placeholder="승인/반려 의견" value={resultMap[item.id] || ''} onChange={(e) => setResultMap((prev) => ({ ...prev, [item.id]: e.target.value }))} />
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button size="sm" color="success" loading={busyId === item.id} onClick={() => handleAction(item.id, '승인')}>승인</Button>
                  <Button size="sm" color="error" loading={busyId === item.id} onClick={() => handleAction(item.id, '반려')}>반려</Button>
                  <Button size="sm" color="primary" loading={busyId === item.id} onClick={() => handleAction(item.id, '완료')}>완료</Button>
                </div>
              </div>
            ))}
            {!items.length ? <div className="rounded-2xl border border-dashed border-gray-700 py-16 text-center text-gray-500 xl:col-span-2">결재함이 비어 있습니다.</div> : null}
          </div>
        )}
      </div>
    </>
  );
}

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}
