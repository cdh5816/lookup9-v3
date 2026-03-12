/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'react-daisyui';

const statusTone: Record<string, string> = {
  등록: 'badge-warning',
  승인: 'badge-success',
  반려: 'badge-error',
  완료: 'badge-info',
};

export default function ApprovalsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [box, setBox] = useState<'inbox' | 'dept' | 'mine'>('inbox');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState('');
  const [error, setError] = useState('');

  const fetchItems = useCallback(async (nextBox = box) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/approvals?box=${nextBox}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '승인함을 불러오지 못했습니다.');
      setItems(json.data || []);
    } catch (err: any) {
      setError(err?.message || '승인함을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [box]);

  useEffect(() => {
    fetchItems(box);
  }, [box, fetchItems]);

  const pendingCount = useMemo(() => items.filter((item) => item.status === '등록').length, [items]);

  const handleProcess = async (requestId: string, status: '승인' | '반려') => {
    const result = window.prompt(status === '반려' ? '반려 사유를 입력하세요.' : '처리 메모를 입력하세요.', '') || '';
    setProcessingId(requestId);
    try {
      const res = await fetch('/api/approvals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, status, result }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || '처리에 실패했습니다.');
      fetchItems(box);
    } catch (err: any) {
      setError(err?.message || '처리에 실패했습니다.');
    } finally {
      setProcessingId('');
    }
  };

  return (
    <>
      <Head>
        <title>전자결재 / 승인함 | LOOKUP9</title>
      </Head>

      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-800 bg-black/20 p-5">
          <h1 className="text-2xl font-bold">전자결재 / 승인함</h1>
          <p className="mt-2 break-words text-sm leading-6 text-gray-400">
            현장 변경승인, 미팅요청, 전자결재 요청을 한 곳에서 처리합니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-blue-800 px-3 py-1 text-sm text-blue-300">대기 {pendingCount}건</span>
            <span className="rounded-full border border-gray-700 px-3 py-1 text-sm text-gray-300">전체 {items.length}건</span>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          {[
            { key: 'inbox', label: '전체 승인함' },
            { key: 'dept', label: '내 부서 요청' },
            { key: 'mine', label: '내가 올린 요청' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-full px-4 py-2 text-sm ${box === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}
              onClick={() => setBox(tab.key as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}

        {loading ? (
          <div className="py-12 text-center text-gray-500">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-700 py-12 text-center text-gray-500">승인 요청이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-800 bg-black/20 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge ${statusTone[item.status] || 'badge-ghost'}`}>{item.status}</span>
                      <span className="rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-300">{item.type}</span>
                      {item.targetDept ? <span className="rounded-full border border-indigo-800 px-2 py-0.5 text-xs text-indigo-300">{item.targetDept}</span> : null}
                    </div>
                    <h2 className="mt-3 break-words text-lg font-semibold leading-6">{item.title}</h2>
                    <p className="mt-2 text-sm text-gray-400">현장: {item.site?.name || '-'} · 우선순위: {item.priority || '보통'}</p>
                  </div>
                  <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleString('ko-KR')}</span>
                </div>

                {item.description ? <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-gray-100">{item.description}</p> : null}
                {item.result ? <div className="mt-4 rounded-xl border border-gray-800 bg-black/10 p-3 text-sm text-gray-300">처리 메모: {item.result}</div> : null}

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
                  <span>요청자: {item.createdBy?.position ? `${item.createdBy.position} ` : ''}{item.createdBy?.name || '-'}</span>
                  <span>처리자: {item.handledBy?.position ? `${item.handledBy.position} ` : ''}{item.handledBy?.name || '-'}</span>
                </div>

                {item.status === '등록' ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button color="primary" size="sm" loading={processingId === item.id} onClick={() => handleProcess(item.id, '승인')}>
                      승인
                    </Button>
                    <Button color="error" size="sm" loading={processingId === item.id} onClick={() => handleProcess(item.id, '반려')}>
                      반려
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  return {
    props: {
      ...(await serverSideTranslations(context.locale ?? 'ko', ['common'])),
    },
  };
}
