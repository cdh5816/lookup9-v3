/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { Button } from 'react-daisyui';

const ApprovalsPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [memoMap, setMemoMap] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/approvals');
    const json = await res.json();
    if (res.ok) setItems(json.data || []);
    else setError(json?.error?.message || '승인함을 불러오지 못했습니다.');
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessingId(requestId);
    const res = await fetch('/api/approvals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action, result: memoMap[requestId] || '' }),
    });
    if (res.ok) {
      await load();
    } else {
      const json = await res.json();
      setError(json?.error?.message || '처리에 실패했습니다.');
    }
    setProcessingId(null);
  };

  return (
    <>
      <Head><title>전자결재 / 승인함 | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <h1 className="text-2xl font-bold">전자결재 / 승인함</h1>
          <p className="mt-2 text-sm text-gray-400">전자결재, 변경승인, 미팅요청을 한 곳에서 승인/반려할 수 있습니다.</p>
        </div>

        {error ? <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-black/20 py-12 text-center text-sm text-gray-500">대기 중인 승인 요청이 없습니다.</div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-800 bg-black/20 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300">{item.type}</span>
                      <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{item.status}</span>
                      <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString('ko-KR')}</span>
                    </div>
                    <h3 className="mt-2 break-words text-lg font-bold leading-6">{item.title}</h3>
                    <p className="mt-2 text-sm text-gray-400">현장: {item.site?.name || '-'} / 요청자: {item.createdBy?.name || '-'}</p>
                    {item.targetDept ? <p className="mt-1 text-sm text-gray-500">대상부서: {item.targetDept}</p> : null}
                    {item.description ? <div className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-gray-900/40 p-3 text-sm leading-6">{item.description}</div> : null}
                    {item.result ? <div className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm leading-6 text-green-200">처리메모: {item.result}</div> : null}
                  </div>
                  <div className="w-full md:w-[300px]">
                    <textarea
                      className="textarea textarea-bordered h-28 w-full"
                      placeholder="승인/반려 메모"
                      value={memoMap[item.id] || ''}
                      onChange={(e) => setMemoMap((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                    <div className="mt-3 flex gap-2">
                      <Button color="success" size="sm" className="flex-1" loading={processingId === item.id} onClick={() => handleAction(item.id, 'approve')}>승인</Button>
                      <Button color="error" size="sm" className="flex-1" loading={processingId === item.id} onClick={() => handleAction(item.id, 'reject')}>반려</Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  return { props: { ...(await serverSideTranslations(context.locale ?? 'ko', ['common'])) } };
}

export default ApprovalsPage;
