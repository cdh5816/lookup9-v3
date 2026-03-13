/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';

const badgeClass = (status: string) => {
  if (status === '승인완료') return 'border-green-500/30 bg-green-500/10 text-green-300';
  if (status === '반려') return 'border-red-500/30 bg-red-500/10 text-red-300';
  return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300';
};

const ApprovalsPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState('');

  const fetchItems = async () => {
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

  useEffect(() => {
    fetchItems();
  }, []);

  const grouped = useMemo(() => ({
    pending: items.filter((i) => !['승인완료', '반려'].includes(i.status)),
    done: items.filter((i) => ['승인완료', '반려'].includes(i.status)),
  }), [items]);

  const act = async (requestId: string, action: 'approve' | 'reject') => {
    const note = window.prompt(action === 'approve' ? '승인 코멘트' : '반려 사유', '') || '';
    setWorkingId(requestId);
    try {
      const res = await fetch('/api/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, result: note }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '처리에 실패했습니다.');
      await fetchItems();
    } catch (err: any) {
      setError(err?.message || '처리에 실패했습니다.');
    } finally {
      setWorkingId('');
    }
  };

  return (
    <>
      <Head><title>전자결재 / 승인함 | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <h1 className="text-2xl font-bold">전자결재 / 승인함</h1>
          <p className="mt-2 text-sm text-gray-400">전자결재, 미팅요청, 변경승인 요청을 한 곳에서 검토하고 승인/반려할 수 있습니다.</p>
        </div>

        {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}

        {loading ? (
          <div className="py-10 text-center text-gray-500">불러오는 중...</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ApprovalColumn title="처리 대기" items={grouped.pending} workingId={workingId} onApprove={act} />
            <ApprovalColumn title="처리 완료" items={grouped.done} workingId={workingId} onApprove={act} readOnly />
          </div>
        )}
      </div>
    </>
  );
};

const ApprovalColumn = ({ title, items, workingId, onApprove, readOnly = false }: any) => (
  <div className="rounded-2xl border border-gray-800 bg-black/20 p-4">
    <h2 className="mb-4 text-lg font-semibold">{title}</h2>
    {items.length === 0 ? (
      <div className="py-8 text-center text-sm text-gray-500">요청이 없습니다.</div>
    ) : (
      <div className="space-y-3">
        {items.map((item: any) => (
          <div key={item.id} className="rounded-2xl border border-gray-800 bg-black/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-xs ${badgeClass(item.status)}`}>{item.status}</span>
              <span className="rounded-full border border-blue-900/60 bg-blue-950/30 px-2 py-0.5 text-xs text-blue-300">{item.type}</span>
              <span className="text-sm font-semibold">{item.title}</span>
            </div>
            <div className="mt-2 space-y-1 text-sm text-gray-400">
              <p>현장: {item.site?.name || '-'}</p>
              <p>작성자: {item.createdBy?.position ? `${item.createdBy.position} ` : ''}{item.createdBy?.name || '-'}</p>
              <p>대상부서: {item.targetDept || '-'}</p>
              <p>등록일: {new Date(item.createdAt).toLocaleString('ko-KR')}</p>
            </div>
            {item.description ? <div className="mt-3 whitespace-pre-wrap break-words rounded-xl bg-gray-900/40 p-3 text-sm leading-6">{item.description}</div> : null}
            {item.result ? <div className="mt-3 rounded-xl border border-gray-800 p-3 text-sm text-gray-300">처리결과: {item.result}</div> : null}
            {!readOnly ? (
              <div className="mt-4 flex justify-end gap-2">
                <Button size="sm" color="error" loading={workingId === item.id} onClick={() => onApprove(item.id, 'reject')}>반려</Button>
                <Button size="sm" color="primary" loading={workingId === item.id} onClick={() => onApprove(item.id, 'approve')}>승인</Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    )}
  </div>
);

export default ApprovalsPage;

export async function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: {
      ...(await serverSideTranslations(context.locale ?? 'ko', ['common'])),
    },
  };
}
