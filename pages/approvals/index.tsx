/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Button } from 'react-daisyui';

const ApprovalsPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string>('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/approvals');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '승인함을 불러오지 못했습니다.');
      setItems(json.data || []);
    } catch (err: any) {
      setError(err?.message || '승인함을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    const result = window.prompt(action === 'approve' ? '승인 코멘트' : '반려 사유');
    setProcessingId(requestId);
    try {
      const res = await fetch('/api/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, result: result || '' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '처리에 실패했습니다.');
      await load();
    } catch (err: any) {
      setError(err?.message || '처리에 실패했습니다.');
    } finally {
      setProcessingId('');
    }
  };

  return (
    <>
      <Head><title>전자결재 | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <h1 className="text-2xl font-bold">전자결재</h1>
          <p className="mt-2 text-sm text-gray-400">미팅요청, 변경승인, 전자결재 요청을 승인하거나 반려할 수 있습니다.</p>
        </div>

        {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}

        <div className="rounded-2xl border border-gray-800 bg-black/20 p-4">
          {loading ? (
            <div className="py-10 text-center text-sm text-gray-500">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">승인 대기 항목이 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-800 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-blue-800/50 bg-blue-900/20 px-2 py-0.5 text-xs text-blue-300">{item.type}</span>
                        <span className="font-semibold">{item.title}</span>
                        <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{item.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{item.site?.name} · {item.createdBy?.position ? `${item.createdBy.position} ` : ''}{item.createdBy?.name}</p>
                    </div>
                    <div className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString('ko-KR')}</div>
                  </div>

                  {item.description ? <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-200">{item.description}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.site?.id ? <Link href={`/sites/${item.site.id}`} className="btn btn-ghost btn-sm">현장 보기</Link> : null}
                    <Button size="sm" color="success" loading={processingId === item.id} onClick={() => handleAction(item.id, 'approve')}>승인</Button>
                    <Button size="sm" color="error" loading={processingId === item.id} onClick={() => handleAction(item.id, 'reject')}>반려</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default ApprovalsPage;
