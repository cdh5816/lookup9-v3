/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';

const ApprovalsPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string>('');
  const [error, setError] = useState('');

  const load = async () => {
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
  };

  useEffect(() => { load(); }, []);

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
      <Head><title>전자결재 승인함 | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">전자결재 승인함</h1>
          <p className="mt-2 text-sm text-gray-500">전자결재, 미팅요청, 변경승인 요청을 승인하거나 반려할 수 있습니다.</p>
        </div>
        {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}

        {loading ? (
          <div className="py-10 text-center"><span className="loading loading-spinner loading-md"></span></div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-700 py-12 text-center text-gray-500">승인 대기 중인 요청이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-800 bg-black/20 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-blue-900/60 bg-blue-950/30 px-2 py-0.5 text-xs text-blue-300">{item.type}</span>
                  <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{item.priority || '보통'}</span>
                  <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString('ko-KR')}</span>
                </div>
                <h3 className="mt-3 text-lg font-bold break-words">{item.title}</h3>
                <div className="mt-2 text-sm text-gray-400 space-y-1">
                  <p>현장: {item.site?.name || '-'}</p>
                  <p>작성자: {item.createdBy?.position ? `${item.createdBy.position} ` : ''}{item.createdBy?.name || '-'}</p>
                  <p>대상부서: {item.targetDept || '-'}</p>
                </div>
                {item.description ? <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{item.description}</p> : null}
                <div className="mt-4 flex gap-2">
                  <Button color="primary" size="sm" loading={processingId === item.id} onClick={() => handleAction(item.id, 'approve')}>승인</Button>
                  <Button color="ghost" size="sm" loading={processingId === item.id} onClick={() => handleAction(item.id, 'reject')}>반려</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default ApprovalsPage;
