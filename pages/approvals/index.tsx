/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Button } from 'react-daisyui';

const ApprovalsPage = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingId, setSubmittingId] = useState('');

  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/approvals');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '전자결재 목록을 불러오지 못했습니다.');
      setItems(json.data || []);
    } catch (err: any) {
      setError(err?.message || '전자결재 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    const result = window.prompt(action === 'approve' ? '승인 의견을 입력하세요.' : '반려 사유를 입력하세요.', '');
    setSubmittingId(requestId);
    try {
      const res = await fetch('/api/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, result }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '처리에 실패했습니다.');
      await loadItems();
    } catch (err: any) {
      setError(err?.message || '처리에 실패했습니다.');
    } finally {
      setSubmittingId('');
    }
  };

  return (
    <>
      <Head><title>전자결재 | LOOKUP9</title></Head>
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <h1 className="text-2xl font-bold break-words">전자결재</h1>
          <p className="mt-2 text-sm leading-6 text-gray-400 break-words">
            현장별 결재 요청, 변경 승인, 미팅 요청을 한 화면에서 확인하고 승인/반려할 수 있습니다.
          </p>
        </div>

        {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}

        {loading ? (
          <div className="py-10 text-center text-gray-500">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-700 py-12 text-center text-gray-500">결재 문서가 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-800 bg-black/10 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-blue-900/60 bg-blue-950/30 px-2 py-0.5 text-xs text-blue-300">{item.type}</span>
                      <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{item.status}</span>
                      <span className="text-lg font-semibold break-words">{item.title}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-400 break-words">현장: {item.site?.name || '-'}</p>
                    <p className="mt-1 text-sm leading-6 text-gray-400 break-words">요청부서: {item.targetDept || '-'}</p>
                    <p className="mt-1 text-sm leading-6 text-gray-400 break-words">요청자: {item.createdBy?.position ? `${item.createdBy.position} ` : ''}{item.createdBy?.name || '-'}</p>
                    {item.description ? <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{item.description}</p> : null}
                  </div>
                  <div className="flex shrink-0 gap-2 md:flex-col">
                    <Button size="sm" color="primary" loading={submittingId === item.id} onClick={() => handleAction(item.id, 'approve')}>승인</Button>
                    <Button size="sm" color="error" loading={submittingId === item.id} onClick={() => handleAction(item.id, 'reject')}>반려</Button>
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

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
}

export default ApprovalsPage;
