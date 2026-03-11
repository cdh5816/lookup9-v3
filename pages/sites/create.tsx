/*
 * AIRX (individual business) proprietary source.
 * Owner: AIRX / choe DONGHYUN. All rights reserved.
 */

import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Button } from 'react-daisyui';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

const STATUS_DOT: Record<string, string> = {
  영업중: 'bg-red-500',
  대기: 'bg-red-400',
  계약완료: 'bg-yellow-400',
  진행중: 'bg-green-500',
  부분완료: 'bg-green-300',
  완료: 'bg-gray-400',
  보류: 'bg-gray-600',
};

const siteStatuses = ['영업중', '대기', '계약완료', '진행중', '부분완료', '완료', '보류'];
const siteTypes = ['납품하차도', '현장설치도'];

const buildDescription = (input: {
  baseDescription?: string;
  siteType?: string;
  specification?: string;
  quantity?: string;
  unitPrice?: string;
  amount?: string;
  contractDate?: string;
  deliveryDeadline?: string;
  installer?: string;
  clientName?: string;
}) => {
  const lines = [
    input.siteType ? `현장구분: ${input.siteType}` : '',
    input.clientName ? `수요처/발주처: ${input.clientName}` : '',
    input.specification ? `사양: ${input.specification}` : '',
    input.quantity ? `물량: ${input.quantity}` : '',
    input.unitPrice ? `단가: ${input.unitPrice}` : '',
    input.amount ? `금액: ${input.amount}` : '',
    input.contractDate ? `계약일: ${input.contractDate}` : '',
    input.deliveryDeadline ? `납품기한: ${input.deliveryDeadline}` : '',
    input.installer ? `전문시공사: ${input.installer}` : '',
    input.baseDescription || '',
  ].filter(Boolean);

  return lines.join('\n');
};

const CreateSite = () => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [form, setForm] = useState({
    name: '',
    address: '',
    clientId: '',
    status: '영업중',
    description: '',
    siteType: '현장설치도',
    specification: '',
    quantity: '',
    unitPrice: '',
    amount: '',
    contractDate: '',
    deliveryDeadline: '',
    installer: '',
  });

  const [assignees, setAssignees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [bulkText, setBulkText] = useState('');

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((d) => setClients(d.data || []));
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) {
      setSearchResults([]);
      return;
    }
    const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const d = await res.json();
      setSearchResults(d.data || []);
    }
  };

  const addAssignee = (user: any) => {
    if (!assignees.find((a) => a.id === user.id)) setAssignees([...assignees, user]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeAssignee = (userId: string) => setAssignees(assignees.filter((a) => a.id !== userId));

  const ensureClient = async (clientName: string) => {
    if (!clientName) return '';
    const found = clients.find((c) => c.name === clientName);
    if (found) return found.id;

    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: clientName, type: '발주처' }),
    });

    if (!res.ok) return '';
    const json = await res.json();
    const newClient = json.data;
    setClients((prev) => [newClient, ...prev]);
    return newClient.id;
  };

  const createSite = async (payload: any, selectedAssignees: any[] = []) => {
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error?.message || t('unknown-error'));
    }

    const { data: site } = await res.json();

    for (const user of selectedAssignees) {
      await fetch(`/api/sites/${site.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
    }

    return site;
  };

  const handleSingleSubmit = async () => {
    if (!form.name.trim()) {
      setError(t('site-name-required'));
      return;
    }

    setCreating(true);
    setError('');
    setSuccess('');

    try {
      const clientName = clients.find((c) => c.id === form.clientId)?.name || '';
      const site = await createSite(
        {
          name: form.name,
          address: form.address,
          clientId: form.clientId,
          status: form.status,
          description: buildDescription({
            baseDescription: form.description,
            siteType: form.siteType,
            specification: form.specification,
            quantity: form.quantity,
            unitPrice: form.unitPrice,
            amount: form.amount,
            contractDate: form.contractDate,
            deliveryDeadline: form.deliveryDeadline,
            installer: form.installer,
            clientName,
          }),
        },
        assignees
      );

      router.push(`/sites/${site.id}`);
    } catch (err: any) {
      setError(err?.message || '현장 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const parseBulkRows = () => {
    return bulkText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const cells = line.includes('\t') ? line.split('\t') : line.split(',');
        const [orderNo, name, clientName, salesStatus, specification, quantity, unitPrice, amount, contractDate, deliveryDeadline, installation, installer] = cells.map((cell) => (cell || '').trim());
        return {
          orderNo,
          name,
          clientName,
          salesStatus,
          specification,
          quantity,
          unitPrice,
          amount,
          contractDate,
          deliveryDeadline,
          installation,
          installer,
        };
      })
      .filter((row) => row.name);
  };

  const handleBulkSubmit = async () => {
    const rows = parseBulkRows();
    if (rows.length === 0) {
      setError('붙여넣은 엑셀 데이터가 없습니다.');
      return;
    }

    setCreating(true);
    setError('');
    setSuccess('');

    try {
      let count = 0;
      for (const row of rows) {
        const clientId = row.clientName ? await ensureClient(row.clientName) : '';
        await createSite({
          name: row.name,
          address: '',
          clientId,
          status: row.salesStatus || '영업중',
          description: buildDescription({
            siteType: row.installation || '현장설치도',
            specification: row.specification,
            quantity: row.quantity,
            unitPrice: row.unitPrice,
            amount: row.amount,
            contractDate: row.contractDate,
            deliveryDeadline: row.deliveryDeadline,
            installer: row.installer,
            clientName: row.clientName,
            baseDescription: row.orderNo ? `순번: ${row.orderNo}` : '',
          }),
        });
        count += 1;
      }

      setSuccess(`${count}개 현장을 일괄 등록했습니다.`);
      setBulkText('');
    } catch (err: any) {
      setError(err?.message || '일괄등록에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Head><title>{t('site-create')} | LOOKUP9</title></Head>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">현장 등록</h2>
          <p className="mt-2 text-sm text-gray-500">수동 등록과 엑셀 붙여넣기 일괄등록을 같이 지원합니다.</p>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-gray-800">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${mode === 'single' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400'}`}
          >
            단건 등록
          </button>
          <button
            type="button"
            onClick={() => setMode('bulk')}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${mode === 'bulk' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400'}`}
          >
            엑셀 일괄등록
          </button>
        </div>

        {error && <div className="alert alert-error text-sm"><span>{error}</span></div>}
        {success && <div className="alert alert-success text-sm"><span>{success}</span></div>}

        {mode === 'single' ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4 rounded-2xl border border-gray-800 p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label"><span className="label-text">현장명 *</span></label>
                  <input type="text" className="input input-bordered w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="label"><span className="label-text">현장구분</span></label>
                  <select className="select select-bordered w-full" value={form.siteType} onChange={(e) => setForm({ ...form, siteType: e.target.value })}>
                    {siteTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label"><span className="label-text">주소</span></label>
                <input type="text" className="input input-bordered w-full" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label"><span className="label-text">수요처 / 발주처</span></label>
                  <select className="select select-bordered w-full" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                    <option value="">-</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label"><span className="label-text">상태</span></label>
                  <div className="flex flex-wrap gap-2">
                    {siteStatuses.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm({ ...form, status: s })}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${form.status === s ? 'border-blue-500 bg-blue-900/30 text-blue-400' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                      >
                        <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[s] || 'bg-gray-400'}`} />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="label"><span className="label-text">사양</span></label>
                  <input type="text" className="input input-bordered w-full" value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} />
                </div>
                <div>
                  <label className="label"><span className="label-text">물량</span></label>
                  <input type="text" className="input input-bordered w-full" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
                <div>
                  <label className="label"><span className="label-text">전문시공사</span></label>
                  <input type="text" className="input input-bordered w-full" value={form.installer} onChange={(e) => setForm({ ...form, installer: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className="label"><span className="label-text">단가</span></label>
                  <input type="text" className="input input-bordered w-full" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} />
                </div>
                <div>
                  <label className="label"><span className="label-text">금액</span></label>
                  <input type="text" className="input input-bordered w-full" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <label className="label"><span className="label-text">계약일</span></label>
                  <input type="date" className="input input-bordered w-full" value={form.contractDate} onChange={(e) => setForm({ ...form, contractDate: e.target.value })} />
                </div>
                <div>
                  <label className="label"><span className="label-text">납품기한</span></label>
                  <input type="date" className="input input-bordered w-full" value={form.deliveryDeadline} onChange={(e) => setForm({ ...form, deliveryDeadline: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="label"><span className="label-text">추가 설명</span></label>
                <textarea className="textarea textarea-bordered h-24 w-full" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-gray-800 p-5">
              <div>
                <h3 className="font-semibold">담당자 배정</h3>
                <p className="mt-1 text-sm text-gray-500">내부 직원/협력사를 검색해서 바로 배정할 수 있습니다.</p>
              </div>

              {assignees.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {assignees.map((u) => (
                    <span key={u.id} className="badge badge-lg gap-1">
                      {u.position ? `${u.position} ` : ''}{u.name}
                      <button type="button" onClick={() => removeAssignee(u.id)}>
                        <XMarkIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="input input-bordered w-full pl-9"
                  placeholder={t('assign-search-placeholder')}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded border border-gray-700">
                  {searchResults.map((u) => (
                    <button key={u.id} type="button" onClick={() => addAssignee(u)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-800">
                      {u.position ? `${u.position} ` : ''}{u.name} <span className="text-gray-500">({u.email})</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="rounded-xl bg-gray-900/40 p-4 text-sm text-gray-400">
                등록 시 description에 현장구분/물량/단가/금액/납품기한이 같이 저장되어 목록과 상세에서 바로 보이게 됩니다.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-gray-800 p-5">
            <div className="rounded-xl bg-gray-900/40 p-4 text-sm text-gray-300">
              엑셀에서 아래 순서로 셀을 복사해서 그대로 붙여넣으면 여러 현장이 한 번에 등록됩니다.<br />
              순번 / 현장명 / 수요처·발주처 / 영업 / 사양 / 물량 / 단가 / 금액 / 계약일 / 납품기한 / 설치 / 전문시공사
            </div>
            <textarea
              className="textarea textarea-bordered h-[320px] w-full font-mono text-sm"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={['1\t대구 A현장\tOO건설\t영업중\tAL 3T\t1200\t220000\t264000000\t2026-03-11\t2026-04-15\t현장설치도\tAIRX', '2\t구미 B현장\tXX종합건설\t계약완료\tAL 2T\t800\t210000\t168000000\t2026-03-12\t2026-04-20\t납품하차도\t덕인금속'].join('\n')}
            />
          </div>
        )}

        <div className="flex gap-3">
          <Button color="primary" loading={creating} onClick={mode === 'single' ? handleSingleSubmit : handleBulkSubmit}>
            {mode === 'single' ? '현장 등록' : '일괄 등록'}
          </Button>
          <Button color="ghost" onClick={() => router.back()}>취소</Button>
        </div>
      </div>
    </>
  );
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default CreateSite;
