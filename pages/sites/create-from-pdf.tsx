/* eslint-disable i18next/no-literal-string */
import { GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useState, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  DocumentArrowUpIcon, CheckCircleIcon, XCircleIcon,
  ArrowLeftIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline';

// ── 파싱 결과 타입 ──────────────────────────────────
interface ProductItem {
  seq: string;
  productName: string;
  spec: string;
  unit: string;
  unitPrice?: number;
  contractQuantity?: number;
  amount?: number;
  deliveryDeadline?: string;
}

interface ParsedData {
  contractNo?: string;
  procurementNo?: string;
  contractDate?: string;
  clientName?: string;
  name?: string;
  contractAmount?: number;
  contractQuantity?: number;
  unitPrice?: number;
  deliveryDeadline?: string;
  warrantyPeriod?: number;
  siteType?: string;
  specification?: string;
  inspectionAgency?: string;
  inspectionAgencyType?: string;
  inspectionBody?: string;
  acceptanceAgency?: string;
  productItems?: ProductItem[];
}

const fmtNum = (v: any) => {
  if (!v) return '';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('ko-KR') : String(v);
};
const fmtMoney = (v: any) => {
  if (!v) return '';
  const n = Number(v);
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억원`;
  return `${Math.round(n / 10000).toLocaleString()}만원`;
};

// ── 메인 ──────────────────────────────────────────────
type Step = 'upload' | 'preview' | 'done';

const CreateFromPdf = () => {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState('');
  const [form, setForm] = useState<ParsedData & { address?: string; salesNote?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── 파일 선택 → 파싱 ──
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setParseError('PDF 파일만 업로드 가능합니다.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setParseError('10MB 이하 파일만 업로드 가능합니다.');
      return;
    }

    setParseError('');
    setParsing(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = (reader.result as string).split(',')[1];
      setFileData(b64);

      try {
        const res = await fetch('/api/sites/parse-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileData: b64, fileName: file.name }),
        });
        const json = await res.json();

        if (!res.ok) throw new Error(json?.error?.message || '스캔 실패');

        const data: ParsedData = json.data;
        setParsed(data);
        // form 초기화 (파싱값 그대로)
        setForm({ ...data });
        setStep('preview');
      } catch (err: any) {
        setParseError(err.message || '스캔 중 오류가 발생했습니다.');
      } finally {
        setParsing(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  // ── 현장 생성 (파싱 확정) ──
  const handleCreate = async () => {
    if (!form.name) { setSaveError('사업명이 없습니다. 직접 입력해주세요.'); return; }
    setSaving(true); setSaveError('');

    try {
      // 1. 현장 생성
      const siteRes = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          status: 'CONTRACT_ACTIVE',
          contractQuantity: form.contractQuantity ? Number(form.contractQuantity) : undefined,
          contractAmount: form.contractAmount ? Number(form.contractAmount) : undefined,
          unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
        }),
      });
      const siteJson = await siteRes.json();
      if (!siteRes.ok) throw new Error(siteJson?.error?.message || '현장 생성 실패');

      const siteId = siteJson.data?.id;

      // 2. 분할납품요구서 PDF를 서류 탭에 자동 업로드
      if (fileData && siteId) {
        await fetch(`/api/sites/${siteId}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: fileName || '분할납품요구서.pdf',
            fileData,
            mimeType: 'application/pdf',
          }),
        });
      }

      setStep('done');
      // 2초 후 현장 상세로 이동
      setTimeout(() => router.push(`/sites/${siteId}`), 2000);
    } catch (err: any) {
      setSaveError(err.message || '현장 생성 실패');
      setSaving(false);
    }
  };

  return (
    <>
      <Head><title>분할납품요구서로 현장 생성 | LOOKUP9</title></Head>
      <div className="max-w-2xl mx-auto space-y-4">

        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <button className="btn btn-ghost btn-sm gap-1" onClick={() => router.back()}>
            <ArrowLeftIcon className="h-4 w-4" />뒤로
          </button>
          <div>
            <h2 className="text-lg font-bold">분할납품요구서로 현장 생성</h2>
            <p className="text-xs text-gray-500">조달청 분할납품요구서 PDF를 업로드하면 자동으로 현장이 생성됩니다.</p>
          </div>
        </div>

        {/* 단계 표시 */}
        <div className="flex items-center gap-2">
          {[
            { key: 'upload', label: '1. PDF 업로드' },
            { key: 'preview', label: '2. 내용 확인' },
            { key: 'done', label: '3. 완료' },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-6 bg-gray-700" />}
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                step === s.key ? 'bg-blue-600 text-white' :
                ['upload','preview','done'].indexOf(step) > i ? 'bg-green-700 text-green-200' :
                'bg-gray-800 text-gray-400'
              }`}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── STEP 1: 업로드 ── */}
        {step === 'upload' && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-blue-950/40 border border-blue-800/40 p-6">
                  <DocumentArrowUpIcon className="h-12 w-12 text-blue-400" />
                </div>
              </div>
              <div>
                <h3 className="text-base font-semibold mb-1">분할납품요구서 PDF 업로드</h3>
                <p className="text-xs text-gray-400">
                  조달청에서 발행한 분할납품요구서를 업로드하면<br />
                  사업명, 계약금액, 납품기한 등이 자동으로 입력됩니다.
                </p>
              </div>

              {parseError && (
                <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
                  <XCircleIcon className="h-4 w-4 flex-shrink-0" />
                  {parseError}
                </div>
              )}

              <label className={`btn btn-primary btn-md gap-2 cursor-pointer ${parsing ? 'loading' : ''}`}>
                {parsing ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <DocumentArrowUpIcon className="h-5 w-5" />
                    PDF 파일 선택
                  </>
                )}
                <input type="file" accept=".pdf" className="hidden" onChange={handleFileChange} disabled={parsing} />
              </label>

              <p className="text-xs text-gray-600">
                지원 형식: PDF · 최대 10MB<br />
                조달청 나라장터 분할납품요구서만 지원됩니다.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 2: 미리보기 + 수정 ── */}
        {step === 'preview' && parsed && (
          <div className="space-y-3">
            {/* 파싱 성공 안내 */}
            <div className="rounded-lg border border-green-800/40 bg-green-950/20 px-4 py-3 flex items-start gap-3">
              <CheckCircleIcon className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-300">스캔 완료</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  아래 내용을 확인하고 수정이 필요한 경우 직접 편집 후 현장을 생성하세요.
                  <span className="text-blue-400 ml-1">PDF는 서류 탭에 자동 저장됩니다.</span>
                </p>
              </div>
            </div>

            {/* 파싱 결과 편집 폼 */}
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 space-y-4">

              {/* 사업명 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-semibold">
                  사업명 (현장명) <span className="text-red-400">*</span>
                </label>
                <input type="text" className="input input-bordered input-sm w-full"
                  value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>

              {/* 계약 정보 그리드 */}
              <div>
                <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wider">계약 정보</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <FieldRow label="납품요구번호" value={form.contractNo}
                    onChange={v => setForm({ ...form, contractNo: v })} mono />
                  <FieldRow label="계약번호" value={form.procurementNo}
                    onChange={v => setForm({ ...form, procurementNo: v })} mono />
                  <FieldRow label="납품요구일" value={form.contractDate} type="date"
                    onChange={v => setForm({ ...form, contractDate: v })} />
                  <FieldRow label="납품기한" value={form.deliveryDeadline} type="date"
                    onChange={v => setForm({ ...form, deliveryDeadline: v })}
                    highlight={!form.deliveryDeadline} />
                  <FieldRow label="계약물량 (m²)" value={form.contractQuantity ? String(form.contractQuantity) : ''}
                    onChange={v => setForm({ ...form, contractQuantity: v ? Number(v) : undefined })}
                    highlight={!form.contractQuantity} />
                  <FieldRow label="단가 (원/m²)" value={form.unitPrice ? String(form.unitPrice) : ''}
                    onChange={v => setForm({ ...form, unitPrice: v ? Number(v) : undefined })} />
                </div>
              </div>

              {/* 복수 품목 테이블 (productItems가 있을 때만 표시) */}
              {form.productItems && form.productItems.length > 1 && (
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wider">
                    품목 상세 <span className="text-blue-400 font-normal normal-case ml-1">({form.productItems.length}건 · 계약물량은 합산값)</span>
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-gray-800">
                    <table className="table table-xs w-full text-xs">
                      <thead className="bg-gray-900/60">
                        <tr>
                          <th className="w-8 text-gray-500">순</th>
                          <th className="text-gray-500">품명</th>
                          <th className="text-gray-500">규격</th>
                          <th className="text-right text-gray-500">단가</th>
                          <th className="text-right text-gray-500">물량</th>
                          <th className="text-right text-gray-500">금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.productItems.map((item: any) => (
                          <tr key={item.seq} className="border-t border-gray-800/60">
                            <td className="text-gray-600 text-center">{item.seq}</td>
                            <td className="text-gray-300">{item.productName || '-'}</td>
                            <td className="text-gray-500 max-w-[180px] truncate" title={item.spec}>{item.spec || '-'}</td>
                            <td className="text-right tabular-nums text-gray-400">{item.unitPrice ? Number(item.unitPrice).toLocaleString() : '-'}</td>
                            <td className="text-right tabular-nums font-semibold text-blue-300">
                              {item.contractQuantity ? Number(item.contractQuantity).toLocaleString() : '-'} {item.unit}
                            </td>
                            <td className="text-right tabular-nums text-gray-400">
                              {item.amount ? Number(item.amount).toLocaleString() : '-'}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-gray-700 bg-gray-900/40 font-semibold">
                          <td colSpan={4} className="text-right text-gray-500 text-[10px]">합계</td>
                          <td className="text-right tabular-nums text-blue-300">
                            {form.productItems.reduce((s: number, i: any) => s + Number(i.contractQuantity || 0), 0).toLocaleString()} ㎡
                          </td>
                          <td className="text-right tabular-nums text-gray-400">
                            {form.productItems.reduce((s: number, i: any) => s + Number(i.amount || 0), 0).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 계약금액 강조 + 직접 수정 가능 */}
              <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">계약금액 (품대계)</span>
                  {form.contractAmount ? (
                    <span className="text-base font-bold text-blue-300">
                      {fmtMoney(form.contractAmount)} <span className="text-xs text-gray-500">({fmtNum(form.contractAmount)}원)</span>
                    </span>
                  ) : (
                    <span className="text-xs text-red-400">파싱 실패 — 아래에서 직접 입력</span>
                  )}
                </div>
                {/* 계약금액 직접 수정 */}
                <input
                  type="text"
                  className="input input-bordered input-sm w-full bg-black/30"
                  placeholder="계약금액 직접 입력 (예: 27000000)"
                  value={form.contractAmount ? Number(form.contractAmount).toLocaleString() : ''}
                  onChange={e => {
                    const v = e.target.value.replace(/,/g, '');
                    setForm({ ...form, contractAmount: v ? Number(v) : undefined });
                  }}
                />
                {form.contractQuantity && form.unitPrice && (
                  <p className="text-[11px] text-gray-500">
                    계산: {fmtNum(form.contractQuantity)} m² × {fmtNum(form.unitPrice)}원 = {fmtMoney(Number(form.contractQuantity) * Number(form.unitPrice))}
                  </p>
                )}
              </div>

              {/* 수요기관 + 주소 */}
              <div>
                <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wider">수요기관</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <FieldRow label="수요기관명" value={form.clientName}
                    onChange={v => setForm({ ...form, clientName: v })}
                    highlight={!form.clientName} />
                  <FieldRow label="현장 주소 (직접 입력)" value={form.address || ''}
                    onChange={v => setForm({ ...form, address: v })} />
                  <FieldRow label="담당부서" value={(form as any).clientDept || ''}
                    onChange={v => setForm({ ...form, clientDept: v } as any)} />
                  <FieldRow label="담당자명" value={(form as any).clientManager || ''}
                    onChange={v => setForm({ ...form, clientManager: v } as any)} />
                  <FieldRow label="담당자 전화번호" value={(form as any).clientManagerPhone || ''}
                    onChange={v => setForm({ ...form, clientManagerPhone: v } as any)} />
                </div>
              </div>

              {/* 검사/검수 */}
              <div>
                <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wider">검사 · 검수</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">검사기관 유형</label>
                    <select className="select select-bordered select-sm w-full"
                      value={form.inspectionAgencyType || ''}
                      onChange={e => setForm({ ...form, inspectionAgencyType: e.target.value })}>
                      <option value="">미정</option>
                      <option>수요기관 자체</option>
                      <option>전문검사기관</option>
                      <option>조달청</option>
                    </select>
                    {form.inspectionAgency && (
                      <p className="text-[10px] text-gray-500 mt-0.5">스캔값: {form.inspectionAgency}</p>
                    )}
                  </div>
                  <FieldRow label="검수기관" value={form.acceptanceAgency || ''}
                    onChange={v => setForm({ ...form, acceptanceAgency: v })} />
                  {form.inspectionAgencyType === '전문검사기관' && (
                    <div className="sm:col-span-2">
                      <FieldRow label="전문검사기관명" value={form.inspectionBody || ''}
                        onChange={v => setForm({ ...form, inspectionBody: v })} />
                    </div>
                  )}
                </div>
              </div>

              {/* 계약 유형 + 하자기간 + 규격 */}
              <div>
                <p className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wider">기타</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">계약 유형</label>
                    <select className="select select-bordered select-sm w-full"
                      value={form.siteType || '납품설치도'}
                      onChange={e => setForm({ ...form, siteType: e.target.value })}>
                      <option>납품설치도</option>
                      <option>납품하차도</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">하자담보기간 (년)</label>
                    <input type="number" className="input input-bordered input-sm w-full"
                      value={form.warrantyPeriod || 2}
                      onChange={e => setForm({ ...form, warrantyPeriod: Number(e.target.value) })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-gray-400 mb-1">규격/사양</label>
                    <input type="text" className="input input-bordered input-sm w-full"
                      value={form.specification || ''}
                      onChange={e => setForm({ ...form, specification: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            {saveError && (
              <div className="rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
                <XCircleIcon className="h-4 w-4 flex-shrink-0" />{saveError}
              </div>
            )}

            {/* 하단 버튼 */}
            <div className="flex items-center justify-between gap-3">
              <button className="btn btn-ghost btn-sm gap-1" onClick={() => { setStep('upload'); setParsed(null); }}>
                <ArrowPathIcon className="h-4 w-4" />다시 업로드
              </button>
              <button className="btn btn-primary btn-md gap-2 min-w-[140px]"
                onClick={handleCreate} disabled={saving || !form.name}>
                {saving ? (
                  <><span className="loading loading-spinner loading-sm" />생성 중...</>
                ) : (
                  <><CheckCircleIcon className="h-5 w-5" />현장 생성</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: 완료 ── */}
        {step === 'done' && (
          <div className="rounded-xl border border-green-800/40 bg-green-950/10 p-8 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircleIcon className="h-16 w-16 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-green-300">현장이 생성되었습니다!</h3>
              <p className="text-sm text-gray-400 mt-1">
                분할납품요구서도 서류 탭에 자동 저장되었습니다.<br />
                잠시 후 현장 상세로 이동합니다...
              </p>
            </div>
            <span className="loading loading-dots loading-md text-green-400" />
          </div>
        )}
      </div>
    </>
  );
};

// ── 필드 입력 컴포넌트 ──────────────────────────────
const FieldRow = ({ label, value, onChange, type, mono, highlight }: {
  label: string; value?: string; onChange: (v: string) => void;
  type?: string; mono?: boolean; highlight?: boolean;
}) => (
  <div>
    <label className="block text-[11px] text-gray-400 mb-1">
      {label}
      {highlight && <span className="ml-1 text-orange-400 text-[10px]">확인 필요</span>}
    </label>
    <input
      type={type || 'text'}
      className={`input input-bordered input-sm w-full ${mono ? 'font-mono text-xs' : ''} ${highlight && !value ? 'border-orange-700/60' : ''}`}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return { props: { ...(locale ? await serverSideTranslations(locale, ['common']) : {}) } };
}

export default CreateFromPdf;
