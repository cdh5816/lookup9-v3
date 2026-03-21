/* eslint-disable i18next/no-literal-string */
import { useState, useMemo } from 'react';
import useSWR from 'swr';
import fetcher from '@/lib/fetcher';
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon, TruckIcon, TableCellsIcon, ListBulletIcon, CameraIcon } from '@heroicons/react/24/outline';

const fmt = (v: any) => {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isFinite(n) && v !== '' && v !== null && v !== undefined ? n.toLocaleString('ko-KR') : '-';
};
const fmtDate = (v: any) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
};
const fmtDateISO = (v: any) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
};
const parseNum = (v: string) => v.replace(/,/g, '');
const elapsedDays = (date: string | null) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

export default function ProductionProgressPanel({
  site, canManage, onMutate, userRole,
}: { site: any; canManage: boolean; onMutate: () => void; userRole?: string }) {
  const siteId = site?.id;
  const { data: ordersData, mutate: mutateOrders } = useSWR(
    siteId ? `/api/sites/${siteId}/production` : null, fetcher, { refreshInterval: 30000 }
  );
  const orders: any[] = ordersData?.data || [];
  const shipments: any[] = site?.shipments || [];

  const contract = site?.contracts?.find((c: any) => !c.isAdditional);
  const contractQty = Number(contract?.quantity ?? site?.contractQuantity ?? 0);
  const orderedQty = useMemo(() => orders.reduce((s, o) => s + Number(o.quantity ?? 0), 0), [orders]);
  const shippedQty = useMemo(() => shipments.reduce((s, r) => s + Number(r.quantity ?? 0), 0), [shipments]);
  const remainQty = contractQty - orderedQty;
  const progressRate = contractQty > 0 ? Math.min(100, Math.round((shippedQty / contractQty) * 100)) : 0;

  const shipBySeq = useMemo(() => {
    const m: Record<number, any[]> = {};
    shipments.forEach(s => { if (!m[s.sequence]) m[s.sequence] = []; m[s.sequence].push(s); });
    return m;
  }, [shipments]);

  const [viewMode, setViewMode] = useState<'list' | 'table'>('list');
  const [uploading, setUploading] = useState(false);
  const [refImage, setRefImage] = useState<string | null>(null);
  const [showRefImage, setShowRefImage] = useState(true);

  const canUploadPhoto = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(userRole || '');

  // 사진 참고 업로드 → SitePhoto에 저장 + 접이식 패널로 표시 + 자동으로 엑셀뷰 전환
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('이미지 파일만 업로드 가능합니다.'); return; }
    if (file.size > 8 * 1024 * 1024) { alert('파일 크기가 8MB를 초과합니다.'); return; }
    setUploading(true);
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    // 미리보기 표시 + 엑셀뷰 자동 전환
    setRefImage(base64);
    setShowRefImage(true);
    setViewMode('table');
    // SitePhoto에 저장 (사진탭에서도 확인 가능)
    await fetch(`/api/sites/${siteId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileData: base64, fileName: file.name, category: 'DELIVERY', caption: '생산 데이터 참고' }),
    }).catch(() => {});
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* 요약 지표 */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '계약물량', value: contractQty > 0 ? contractQty.toLocaleString('ko-KR') : '-', unit: contractQty > 0 ? 'm²' : '', cVar: '--text-primary', bgVar: '--bg-card', bVar: '--border-base' },
          { label: '발주물량', value: orderedQty > 0 ? orderedQty.toLocaleString('ko-KR') : '-', unit: orderedQty > 0 ? 'm²' : '', cVar: '--info-text', bgVar: '--info-bg', bVar: '--info-border' },
          { label: '출하물량', value: shippedQty > 0 ? shippedQty.toLocaleString('ko-KR') : '-', unit: shippedQty > 0 ? 'm²' : '', cVar: '--success-text', bgVar: '--success-bg', bVar: '--success-border' },
          { label: '잔여', value: contractQty > 0 ? remainQty.toLocaleString('ko-KR') : '-', unit: contractQty > 0 ? 'm²' : '', cVar: remainQty > 0 ? '--warning-text' : remainQty < 0 ? '--danger-text' : '--text-muted', bgVar: remainQty > 0 ? '--warning-bg' : remainQty < 0 ? '--danger-bg' : '--bg-card', bVar: remainQty > 0 ? '--warning-border' : remainQty < 0 ? '--danger-border' : '--border-base' },
        ].map(item => (
          <div key={item.label} className="rounded-xl p-3 text-center" style={{backgroundColor:`var(${item.bgVar})`,border:`1px solid var(${item.bVar})`}}>
            <p className="text-[10px] mb-1" style={{color:'var(--text-muted)'}}>{item.label}</p>
            <p className="text-sm font-bold" style={{color:`var(${item.cVar})`}}>{item.value}</p>
            {item.unit && <p className="text-[10px]" style={{color:'var(--text-muted)'}}>{item.unit}</p>}
          </div>
        ))}
      </div>

      {/* 공정률 바 */}
      <div className="rounded-xl p-4" style={{backgroundColor:'var(--bg-card)',border:'1px solid var(--border-base)'}}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs" style={{color:'var(--text-muted)'}}>출하 공정률</span>
          <span className="text-2xl font-extrabold tabular-nums" style={{color: progressRate >= 100 ? 'var(--info-text)' : progressRate >= 60 ? 'var(--success-text)' : progressRate >= 30 ? 'var(--warning-text)' : 'var(--text-muted)'}}>{progressRate}%</span>
        </div>
        <div className="relative h-3 w-full overflow-hidden rounded-full" style={{backgroundColor:'var(--border-base)'}}>
          <div className={`h-full rounded-full transition-all duration-700 ${progressRate >= 100 ? 'bg-gradient-to-r from-blue-600 to-blue-400' : progressRate >= 60 ? 'bg-gradient-to-r from-green-700 to-green-400' : progressRate >= 30 ? 'bg-gradient-to-r from-yellow-700 to-yellow-400' : 'bg-gradient-to-r from-gray-700 to-gray-500'}`} style={{ width: `${progressRate}%` }} />
          {[25,50,75].map(p => <div key={p} className="absolute top-0 h-full w-px" style={{left:`${p}%`,backgroundColor:'var(--border-base)'}} />)}
        </div>
        <div className="flex justify-between text-[10px] mt-1" style={{color:'var(--text-muted)'}}><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
      </div>

      {/* 뷰 모드 토글 + 테이블 */}
      <div className="rounded-xl overflow-hidden" style={{backgroundColor:'var(--bg-card)',border:'1px solid var(--border-base)'}}>
        <div className="flex items-center justify-between px-4 py-3" style={{borderBottom:'1px solid var(--border-base)'}}>
          <div>
            <p className="text-xs font-semibold" style={{color:'var(--text-primary)'}}>생산 발주 차수</p>
            <p className="text-[10px] mt-0.5" style={{color:'var(--text-muted)'}}>공급일 입력 시 출하탭에서 출하 정보를 등록해주세요</p>
          </div>
          <div className="flex items-center gap-1">
            {canUploadPhoto && (
              <label className={`btn btn-ghost btn-xs gap-1 cursor-pointer ${uploading ? 'loading' : ''}`} title="생산 데이터 참고 사진 업로드">
                <CameraIcon className="h-3.5 w-3.5" style={{color:'var(--brand)'}} />
                <span className="text-[10px]" style={{color:'var(--brand)'}}>{uploading ? '저장 중...' : '참고사진'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            )}
            <button className={`btn btn-ghost btn-xs ${viewMode === 'list' ? '' : 'opacity-40'}`} onClick={() => setViewMode('list')} title="리스트"><ListBulletIcon className="h-4 w-4" /></button>
            <button className={`btn btn-ghost btn-xs ${viewMode === 'table' ? '' : 'opacity-40'}`} onClick={() => setViewMode('table')} title="엑셀"><TableCellsIcon className="h-4 w-4" /></button>
          </div>
        </div>

        {viewMode === 'table' ? (
          <ExcelEditTable siteId={siteId} orders={orders} shipBySeq={shipBySeq} contractQty={contractQty} canManage={canManage} onMutate={() => { mutateOrders(); onMutate(); }} />
        ) : (
          <ListViewOrders siteId={siteId} orders={orders} shipBySeq={shipBySeq} canManage={canManage} onMutate={() => { mutateOrders(); onMutate(); }} />
        )}
      </div>

      {/* 참고 사진 패널 (접이식 — 사진 보면서 아래 테이블에 입력) */}
      {refImage && (
        <div className="rounded-xl overflow-hidden" style={{border:'1px solid var(--info-border)',backgroundColor:'var(--info-bg)'}}>
          <div className="px-4 py-2.5 flex items-center justify-between cursor-pointer" onClick={() => setShowRefImage(!showRefImage)}>
            <div className="flex items-center gap-2">
              <CameraIcon className="h-4 w-4" style={{color:'var(--info-text)'}} />
              <p className="text-xs font-semibold" style={{color:'var(--info-text)'}}>참고 사진</p>
              <p className="text-[10px]" style={{color:'var(--text-muted)'}}>사진을 보면서 위 엑셀뷰에서 데이터를 입력하세요</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); setRefImage(null); }} title="닫기">
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
              <span className="text-[10px]" style={{color:'var(--text-muted)'}}>{showRefImage ? '접기' : '펼치기'}</span>
            </div>
          </div>
          {showRefImage && (
            <div className="px-3 pb-3">
              <img src={refImage} alt="참고 사진" className="w-full rounded-lg" style={{maxHeight:'50vh',objectFit:'contain',backgroundColor:'#fff'}} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 엑셀식 편집 테이블 ──
function ExcelEditTable({ siteId, orders, shipBySeq, contractQty, canManage, onMutate }: {
  siteId: string; orders: any[]; shipBySeq: Record<number, any[]>; contractQty: number; canManage: boolean; onMutate: () => void;
}) {
  const buildRows = () => orders.map(o => ({
    id: o.id, sequence: o.sequence,
    quantity: o.quantity ? String(Number(o.quantity)) : '',
    orderDate: fmtDateISO(o.orderDate), supplyDate: fmtDateISO(o.supplyDate),
    notes: o.notes || '', dirty: false,
  }));
  const [rows, setRows] = useState(buildRows);
  const [saving, setSaving] = useState(false);
  const [newRows, setNewRows] = useState<any[]>([]);

  useMemo(() => { setRows(buildRows()); }, [orders]);

  const updateRow = (idx: number, field: string, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value, dirty: true } : r));
  };
  const updateNewRow = (idx: number, field: string, value: string) => {
    setNewRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };
  const addNewRow = () => setNewRows(prev => [...prev, { quantity: '', orderDate: '', supplyDate: '', notes: '' }]);
  const removeNewRow = (idx: number) => setNewRows(prev => prev.filter((_, i) => i !== idx));

  // 엑셀 붙여넣기 — 자동 컬럼 감지
  // 지원 형식:
  // A) 물량\t발주일\t공급일\t비고 (4열)
  // B) 차수\t물량\t발주일\t공급일\t경과일\t비고 (6열 — 실제 엑셀 캡처 형식)
  // C) 차수\t물량\t물량업\t발주일\t공급일\t경과일\t비고 (7열)
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain').trim();
    if (!text) return;
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 1) return;
    const hasTabs = lines.some(l => l.includes('\t'));
    if (!hasTabs && lines.length === 1) return;
    e.preventDefault();

    const isDate = (s: string) => /^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(s.trim());
    const isNum = (s: string) => /^[\d,.]+$/.test(s.replace(/\s/g, ''));
    const hasSeq = (s: string) => /차|샘플|실물/.test(s);

    const parsed = lines.map(line => {
      const cols = line.split('\t').map(c => c.trim());
      // 헤더행/합계행/공제행 스킵
      if (cols[0] === '차수' || cols[0] === '합계' || cols[0] === '공제') return null;
      // 빈 행 스킵
      if (cols.every(c => !c || c === '-')) return null;

      let seq = '', qty = '', orderDate = '', supplyDate = '', notes = '';

      if (cols.length >= 6 && hasSeq(cols[0])) {
        // B/C 형식: 차수\t물량\t[물량업]\t발주일\t공급일\t경과일\t비고
        seq = cols[0];
        qty = cols[1] || '';
        // cols[2]가 날짜면 발주일, 아니면 물량업(스킵)
        let dateStart = 2;
        if (!isDate(cols[2]) && cols.length >= 7) dateStart = 3; // 물량업 컬럼 있음
        orderDate = cols[dateStart] || '';
        supplyDate = cols[dateStart + 1] || '';
        // 경과일 스킵 — 비고는 마지막 비숫자 컬럼에서 찾기
        notes = '';
        for (let i = cols.length - 1; i >= dateStart + 2; i--) {
          const v = cols[i];
          if (v && v !== '-' && !/^[\d,.]+$/.test(v) && !isDate(v)) { notes = v; break; }
        }
      } else if (cols.length >= 4 && isNum(cols[0])) {
        // A 형식: 물량\t발주일\t공급일\t비고
        qty = cols[0];
        orderDate = cols[1] || '';
        supplyDate = cols[2] || '';
        notes = cols[3] || '';
      } else if (cols.length >= 2) {
        // 기타: 첫 번째 숫자를 물량으로, 날짜 찾기
        for (const c of cols) {
          if (!qty && isNum(c)) { qty = c; continue; }
          if (!orderDate && isDate(c)) { orderDate = c; continue; }
          if (orderDate && !supplyDate && isDate(c)) { supplyDate = c; continue; }
          if (!notes && c && !isNum(c) && !isDate(c) && !hasSeq(c)) notes = c;
        }
        if (!qty && hasSeq(cols[0])) seq = cols[0];
      }

      // 물량 정리
      qty = qty.replace(/[^0-9.]/g, '');
      if (!qty || Number(qty) <= 0) return null;

      return {
        quantity: qty,
        orderDate: parseKorDate(orderDate),
        supplyDate: parseKorDate(supplyDate),
        notes: (seq ? seq + ' ' : '') + notes,
      };
    }).filter(Boolean) as any[];

    if (parsed.length > 0) {
      setNewRows(prev => [...prev, ...parsed]);
    }
  };

  // 날짜 파싱: 2025-09-08, 2025.09.08, 2025/09/08 형태 모두 지원
  const parseKorDate = (s: string): string => {
    if (!s) return '';
    const cleaned = s.replace(/[.\/ ]/g, '-').replace(/[^0-9-]/g, '');
    const m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    return '';
  };

  const dirtyCount = rows.filter(r => r.dirty).length + newRows.length;

  const handleSaveAll = async () => {
    setSaving(true);
    for (const row of rows.filter(r => r.dirty)) {
      await fetch(`/api/sites/${siteId}/production`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: row.id, quantity: row.quantity ? Number(parseNum(row.quantity)) : null, orderDate: row.orderDate || null, supplyDate: row.supplyDate || null, notes: row.notes || null }),
      });
    }
    for (const row of newRows) {
      if (!row.quantity && !row.orderDate) continue;
      await fetch(`/api/sites/${siteId}/production`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: row.quantity ? Number(parseNum(row.quantity)) : null, orderDate: row.orderDate || null, supplyDate: row.supplyDate || null, notes: row.notes || null }),
      });
    }
    setNewRows([]); setSaving(false); onMutate();
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm('이 차수를 삭제합니다.')) return;
    await fetch(`/api/sites/${siteId}/production`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) });
    onMutate();
  };

  const totalOrdered = rows.reduce((s, r) => s + Number(parseNum(r.quantity) || 0), 0);
  const totalNew = newRows.reduce((s, r) => s + Number(parseNum(r.quantity) || 0), 0);

  const cs: React.CSSProperties = { padding: '6px 8px', fontSize: '12px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)' };
  const hs: React.CSSProperties = { ...cs, fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', backgroundColor: 'var(--bg-hover)' };
  const is: React.CSSProperties = { width: '100%', border: 'none', background: 'transparent', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', padding: '2px 0' };

  return (
    <div onPaste={canManage ? handlePaste : undefined}>
      <div className="overflow-x-auto" style={{maxHeight:'500px',overflowY:'auto'}}>
        <table className="w-full" style={{borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th style={{...hs,width:'50px',textAlign:'center'}}>차수</th>
              <th style={{...hs,width:'100px',textAlign:'right'}}>물량(m²)</th>
              <th style={{...hs,width:'120px'}}>발주일</th>
              <th style={{...hs,width:'120px'}}>공급일</th>
              <th style={{...hs,width:'60px',textAlign:'center'}}>경과일</th>
              <th style={hs}>비고</th>
              {canManage && <th style={{...hs,width:'40px'}}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const days = elapsedDays(row.orderDate);
              const hasShip = (shipBySeq[row.sequence] || []).length > 0;
              return (
                <tr key={row.id} style={{backgroundColor: row.dirty ? 'var(--warning-bg)' : hasShip ? 'var(--success-bg)' : 'transparent'}}>
                  <td style={{...cs,textAlign:'center',fontWeight:600}}>{row.sequence}</td>
                  <td style={cs}>{canManage ? <input style={{...is,textAlign:'right'}} value={row.quantity ? Number(parseNum(row.quantity)).toLocaleString('ko-KR') : ''} onChange={e => updateRow(idx, 'quantity', e.target.value.replace(/[^0-9.]/g, ''))} /> : <span style={{float:'right'}}>{fmt(row.quantity)}</span>}</td>
                  <td style={cs}>{canManage ? <input type="date" style={is} value={row.orderDate} onChange={e => updateRow(idx, 'orderDate', e.target.value)} /> : fmtDate(row.orderDate)}</td>
                  <td style={cs}>{canManage ? <input type="date" style={is} value={row.supplyDate} onChange={e => updateRow(idx, 'supplyDate', e.target.value)} /> : fmtDate(row.supplyDate)}</td>
                  <td style={{...cs,textAlign:'center',color:'var(--text-muted)'}}>{days !== null ? days : '-'}</td>
                  <td style={cs}>{canManage ? <input style={is} placeholder="비고" value={row.notes} onChange={e => updateRow(idx, 'notes', e.target.value)} /> : (row.notes || '-')}</td>
                  {canManage && <td style={cs}><button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(row.id)}><TrashIcon className="h-3 w-3" /></button></td>}
                </tr>
              );
            })}
            {newRows.map((row, idx) => (
              <tr key={`new-${idx}`} style={{backgroundColor:'var(--info-bg)'}}>
                <td style={{...cs,textAlign:'center',fontWeight:600,color:'var(--info-text)'}}>New</td>
                <td style={cs}><input style={{...is,textAlign:'right'}} placeholder="물량" value={row.quantity ? Number(parseNum(row.quantity)).toLocaleString('ko-KR') : ''} onChange={e => updateNewRow(idx, 'quantity', e.target.value.replace(/[^0-9.]/g, ''))} /></td>
                <td style={cs}><input type="date" style={is} value={row.orderDate} onChange={e => updateNewRow(idx, 'orderDate', e.target.value)} /></td>
                <td style={cs}><input type="date" style={is} value={row.supplyDate} onChange={e => updateNewRow(idx, 'supplyDate', e.target.value)} /></td>
                <td style={{...cs,textAlign:'center'}}>-</td>
                <td style={cs}><input style={is} placeholder="비고" value={row.notes} onChange={e => updateNewRow(idx, 'notes', e.target.value)} /></td>
                <td style={cs}><button className="btn btn-ghost btn-xs text-error" onClick={() => removeNewRow(idx)}><XMarkIcon className="h-3 w-3" /></button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{backgroundColor:'var(--bg-hover)'}}>
              <td style={{...cs,fontWeight:600,textAlign:'center'}}>합계</td>
              <td style={{...cs,textAlign:'right',fontWeight:700}}>{(totalOrdered + totalNew).toLocaleString('ko-KR')} m²</td>
              <td colSpan={canManage ? 5 : 4} style={cs}>
                {contractQty > 0 && <span style={{color:'var(--text-muted)',fontSize:'11px'}}>계약 {contractQty.toLocaleString()} · 오차 {(contractQty - totalOrdered - totalNew).toLocaleString()} · {((totalOrdered + totalNew) / contractQty * 100).toFixed(1)}%</span>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {canManage && (
        <div className="flex items-center justify-between px-4 py-2.5" style={{borderTop:'1px solid var(--border-base)'}}>
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost btn-xs gap-1" onClick={addNewRow}><PlusIcon className="h-3.5 w-3.5" />행 추가</button>
            <span className="text-[10px]" style={{color:'var(--text-muted)'}}>엑셀에서 Ctrl+V로 일괄 붙여넣기 가능 (물량 · 발주일 · 공급일 · 비고)</span>
          </div>
          {dirtyCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{color:'var(--warning-text)'}}>{dirtyCount}건 변경</span>
              <button className={`btn btn-primary btn-xs ${saving ? 'loading' : ''}`} disabled={saving} onClick={handleSaveAll}><CheckIcon className="h-3.5 w-3.5 mr-1" />일괄 저장</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 리스트 뷰 (기존 방식, 테마 적용) ──
function ListViewOrders({ siteId, orders, shipBySeq, canManage, onMutate }: {
  siteId: string; orders: any[]; shipBySeq: Record<number, any[]>; canManage: boolean; onMutate: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ quantity: '', orderDate: '', supplyDate: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [expandedSeq, setExpandedSeq] = useState<number | null>(null);

  const handleAdd = async () => {
    setSubmitting(true);
    await fetch(`/api/sites/${siteId}/production`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: form.quantity ? Number(parseNum(form.quantity)) : null, orderDate: form.orderDate || null, supplyDate: form.supplyDate || null, notes: form.notes || null }),
    });
    setForm({ quantity: '', orderDate: '', supplyDate: '', notes: '' });
    setShowForm(false); setSubmitting(false); onMutate();
  };

  const handleEdit = async (orderId: string) => {
    await fetch(`/api/sites/${siteId}/production`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, quantity: editForm.quantity ? Number(parseNum(editForm.quantity)) : null, orderDate: editForm.orderDate || null, supplyDate: editForm.supplyDate || null, notes: editForm.notes || null }),
    });
    setEditId(null); onMutate();
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm('이 차수를 삭제합니다.')) return;
    await fetch(`/api/sites/${siteId}/production`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) });
    onMutate();
  };

  const startEdit = (o: any) => {
    setEditId(o.id);
    setEditForm({ quantity: o.quantity ? String(Number(o.quantity)) : '', orderDate: o.orderDate ? new Date(o.orderDate).toISOString().split('T')[0] : '', supplyDate: o.supplyDate ? new Date(o.supplyDate).toISOString().split('T')[0] : '', notes: o.notes || '' });
  };

  const totalOrdered = orders.reduce((s, o) => s + Number(o.quantity ?? 0), 0);

  return (
    <div>
      {/* 추가 폼 */}
      {canManage && (
        <div className="px-4 py-2" style={{borderBottom:'1px solid var(--border-subtle)'}}>
          {showForm ? (
            <div className="space-y-2 p-2 rounded-lg" style={{backgroundColor:'var(--bg-hover)'}}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div><label className="block text-[10px] mb-1" style={{color:'var(--text-muted)'}}>물량 (m²)</label><input className="input input-bordered input-xs w-full" placeholder="1,200" value={form.quantity ? Number(parseNum(form.quantity)).toLocaleString('ko-KR') : ''} onChange={e => setForm({ ...form, quantity: e.target.value.replace(/,/g, '') })} /></div>
                <div><label className="block text-[10px] mb-1" style={{color:'var(--text-muted)'}}>발주일</label><input type="date" className="input input-bordered input-xs w-full" value={form.orderDate} onChange={e => setForm({ ...form, orderDate: e.target.value })} /></div>
                <div><label className="block text-[10px] mb-1" style={{color:'var(--text-muted)'}}>공급예정일</label><input type="date" className="input input-bordered input-xs w-full" value={form.supplyDate} onChange={e => setForm({ ...form, supplyDate: e.target.value })} /></div>
                <div><label className="block text-[10px] mb-1" style={{color:'var(--text-muted)'}}>메모</label><input className="input input-bordered input-xs w-full" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn btn-ghost btn-xs" onClick={() => setShowForm(false)}>취소</button>
                <button className={`btn btn-primary btn-xs ${submitting ? 'loading' : ''}`} disabled={submitting} onClick={handleAdd}>저장</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-ghost btn-xs gap-1" onClick={() => setShowForm(true)}><PlusIcon className="h-3.5 w-3.5" />차수 추가</button>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm" style={{color:'var(--text-muted)'}}>등록된 차수가 없습니다.</p>
      ) : (
        <div>
          {orders.map(o => {
            const linked = shipBySeq[o.sequence] || [];
            const hasShip = linked.length > 0;
            const mainShip = linked[0];
            const isEditing = editId === o.id;
            const isExpanded = expandedSeq === o.sequence;
            const daysSinceOrder = elapsedDays(o.orderDate);

            return (
              <div key={o.id} style={{borderBottom:'1px solid var(--border-subtle)'}}>
                <div className="px-4 py-3" style={{backgroundColor: hasShip ? 'var(--success-bg)' : 'transparent'}}>
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div><label className="block text-[10px] mb-1" style={{color:'var(--text-muted)'}}>물량 (m²)</label><input className="input input-bordered input-xs w-full" value={editForm.quantity ? Number(parseNum(editForm.quantity)).toLocaleString('ko-KR') : ''} onChange={e => setEditForm({ ...editForm, quantity: e.target.value.replace(/,/g, '') })} /></div>
                        <div><label className="block text-[10px] mb-1" style={{color:'var(--text-muted)'}}>발주일</label><input type="date" className="input input-bordered input-xs w-full" value={editForm.orderDate} onChange={e => setEditForm({ ...editForm, orderDate: e.target.value })} /></div>
                        <div><label className="block text-[10px] mb-1" style={{color:'var(--text-muted)'}}>공급일</label><input type="date" className="input input-bordered input-xs w-full" value={editForm.supplyDate} onChange={e => setEditForm({ ...editForm, supplyDate: e.target.value })} /></div>
                        <div><label className="block text-[10px] mb-1" style={{color:'var(--text-muted)'}}>메모</label><input className="input input-bordered input-xs w-full" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /></div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button className="btn btn-primary btn-xs" onClick={() => handleEdit(o.id)}>저장</button>
                        <button className="btn btn-ghost btn-xs" onClick={() => setEditId(null)}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{backgroundColor: hasShip ? 'var(--success-bg)' : 'var(--bg-hover)', color: hasShip ? 'var(--success-text)' : 'var(--text-muted)', border: `1px solid ${hasShip ? 'var(--success-border)' : 'var(--border-base)'}`}}>
                        {o.sequence}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                          <span className="font-bold" style={{color:'var(--text-primary)'}}>{fmt(o.quantity)} m²</span>
                          {o.orderDate && <span style={{color:'var(--text-muted)'}}>발주: {fmtDate(o.orderDate)}</span>}
                          {o.supplyDate ? <span style={{color:'var(--success-text)'}}>공급: {fmtDate(o.supplyDate)}</span> : <span style={{color:'var(--text-muted)'}}>공급예정 미입력</span>}
                          {daysSinceOrder !== null && <span style={{color:'var(--text-muted)'}}>경과 {daysSinceOrder}일</span>}
                          {o.notes && <span className="truncate" style={{color:'var(--text-muted)'}}>{o.notes}</span>}
                        </div>
                        {hasShip && (
                          <button onClick={() => setExpandedSeq(isExpanded ? null : o.sequence)} className="mt-1 flex items-center gap-1.5 text-[11px]" style={{color:'var(--success-text)'}}>
                            <TruckIcon className="w-3 h-3" />{linked.length}차 출하 연계됨
                            {mainShip?.status && <span className="px-1.5 py-0.5 rounded text-[10px]" style={{border:'1px solid var(--success-border)'}}>{mainShip.status}</span>}
                            <span style={{color:'var(--text-muted)'}}>{isExpanded ? '▲' : '▼'}</span>
                          </button>
                        )}
                      </div>
                      {canManage && (
                        <div className="flex gap-1 shrink-0">
                          <button className="btn btn-ghost btn-xs" onClick={() => startEdit(o)}><PencilIcon className="h-3 w-3" /></button>
                          <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(o.id)}><TrashIcon className="h-3 w-3" /></button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {isExpanded && linked.length > 0 && (
                  <div className="px-4 pb-3" style={{backgroundColor:'var(--success-bg)',borderTop:'1px solid var(--success-border)'}}>
                    <div className="ml-11 space-y-1.5 mt-2">
                      {linked.map(ship => (
                        <div key={ship.id} className="flex items-center gap-3 text-xs rounded-lg px-3 py-2" style={{backgroundColor:'var(--bg-card)',border:'1px solid var(--border-base)'}}>
                          <TruckIcon className="w-3.5 h-3.5 shrink-0" style={{color:'var(--text-muted)'}} />
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{border:'1px solid var(--success-border)',color:'var(--success-text)'}}>{ship.status}</span>
                          <span style={{color:'var(--text-secondary)'}}>{ship.quantity ? `${fmt(ship.quantity)} m²` : '-'}</span>
                          {ship.shippedAt && <span style={{color:'var(--text-muted)'}}>출고: {fmtDate(ship.shippedAt)}</span>}
                          {ship.vehicleInfo && <span className="truncate" style={{color:'var(--text-muted)'}}>{ship.vehicleInfo}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="px-4 py-2.5 flex justify-between text-xs" style={{backgroundColor:'var(--bg-hover)'}}>
            <span style={{color:'var(--text-muted)'}}>총 발주물량</span>
            <span className="font-bold" style={{color:'var(--text-primary)'}}>{totalOrdered.toLocaleString('ko-KR')} m²</span>
          </div>
        </div>
      )}
    </div>
  );
}
