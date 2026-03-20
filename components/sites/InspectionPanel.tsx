/* eslint-disable i18next/no-literal-string */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  PlusIcon, CheckCircleIcon, XCircleIcon, ClockIcon,
  PencilSquareIcon, XMarkIcon,
} from '@heroicons/react/24/outline';

interface InspectionPanelProps {
  siteId: string;
  canManage: boolean;
  role: string;
}

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  REQUESTED:   { label: '요청됨', class: 'status-warning' },
  SCHEDULED:   { label: '예정', class: 'status-info' },
  IN_PROGRESS: { label: '진행중', class: 'status-info' },
  PASSED:      { label: '합격', class: 'status-success' },
  FAILED:      { label: '불합격', class: 'status-danger' },
  CANCELLED:   { label: '취소', class: '' },
};

const TYPE_MAP: Record<string, string> = {
  DELIVERY: '납품검수', INSTALLATION: '시공검수', COMPLETION: '준공검수', DEFECT: '하자검수',
};

const InspectionPanel = ({ siteId, canManage, role }: InspectionPanelProps) => {
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showApprove, setShowApprove] = useState<any>(null);

  const isApprover = ['SUPER_ADMIN', 'OWNER', 'ADMIN_HR', 'ADMIN', 'MANAGER'].includes(role);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inspections?siteId=${siteId}`);
    if (res.ok) { const d = await res.json(); setInspections(d.data || []); }
    setLoading(false);
  }, [siteId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pending = inspections.filter(i => ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'].includes(i.status));
  const completed = inspections.filter(i => ['PASSED', 'FAILED', 'CANCELLED'].includes(i.status));

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{color:"var(--text-primary)"}}>검수 요청/승인</p>
          <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>
            대기 {pending.length}건 · 완료 {completed.length}건
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary btn-sm gap-1" onClick={() => setShowCreate(true)}>
            <PlusIcon className="h-4 w-4" />검수 요청
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center"><span className="loading loading-spinner loading-sm" /></div>
      ) : inspections.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed py-10 text-center" style={{borderColor:"var(--border-base)"}}>
          <p className="text-sm" style={{color:"var(--text-muted)"}}>검수 요청이 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 대기중 */}
          {pending.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold" style={{color:"var(--warning-text)"}}>대기중 ({pending.length})</p>
              {pending.map(insp => (
                <InspectionCard key={insp.id} insp={insp} isApprover={isApprover} onApprove={() => setShowApprove(insp)} onRefresh={fetchData} />
              ))}
            </div>
          )}

          {/* 완료 */}
          {completed.length > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-xs font-semibold" style={{color:"var(--text-muted)"}}>완료 ({completed.length})</p>
              {completed.map(insp => (
                <InspectionCard key={insp.id} insp={insp} isApprover={false} onRefresh={fetchData} />
              ))}
            </div>
          )}
        </>
      )}

      {/* 생성 모달 */}
      {showCreate && (
        <CreateInspectionModal siteId={siteId} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchData(); }} />
      )}

      {/* 승인/반려 모달 */}
      {showApprove && (
        <ApproveModal insp={showApprove} onClose={() => setShowApprove(null)} onDone={() => { setShowApprove(null); fetchData(); }} />
      )}
    </div>
  );
};

// ── 검수 카드 ──────────────────────────────────────────
const InspectionCard = ({ insp, isApprover, onApprove, onRefresh }: {
  insp: any; isApprover: boolean; onApprove?: () => void; onRefresh: () => void;
}) => {
  const st = STATUS_MAP[insp.status] || { label: insp.status, class: '' };
  return (
    <div className="rounded-xl p-3.5" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${st.class}`}>{st.label}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{backgroundColor:"var(--bg-hover)",color:"var(--text-muted)"}}>
              {TYPE_MAP[insp.inspectionType] || insp.inspectionType}
            </span>
          </div>
          <p className="text-sm font-semibold mt-1" style={{color:"var(--text-primary)"}}>{insp.title}</p>
          {insp.description && <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>{insp.description}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-[11px]" style={{color:"var(--text-muted)"}}>
            <span>요청: {insp.requestedBy?.name || '-'}</span>
            <span>{new Date(insp.requestedAt).toLocaleDateString('ko-KR')}</span>
            {insp.scheduledDate && <span>예정: {new Date(insp.scheduledDate).toLocaleDateString('ko-KR')}</span>}
          </div>
          {insp.resultNote && (
            <p className="text-xs mt-1.5 rounded-lg px-2 py-1.5" style={{backgroundColor:"var(--bg-hover)",color:"var(--text-secondary)"}}>
              {insp.result === 'PASS' ? '✅' : insp.result === 'FAIL' ? '❌' : '📝'} {insp.resultNote}
            </p>
          )}
        </div>
        {isApprover && ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'].includes(insp.status) && onApprove && (
          <button className="btn btn-sm gap-1" style={{border:"1px solid var(--brand)",color:"var(--brand)"}} onClick={onApprove}>
            <PencilSquareIcon className="h-3.5 w-3.5" />처리
          </button>
        )}
      </div>
    </div>
  );
};

// ── 검수 요청 생성 모달 ─────────────────────────────────
const CreateInspectionModal = ({ siteId, onClose, onCreated }: { siteId: string; onClose: () => void; onCreated: () => void }) => {
  const [form, setForm] = useState({ title: '', description: '', inspectionType: 'DELIVERY', scheduledDate: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('검수 제목을 입력하세요.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/inspections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, ...form, scheduledDate: form.scheduledDate || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || '등록 실패'); }
      onCreated();
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:"rgba(0,0,0,0.4)"}} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-5 space-y-4 slide-up" style={{backgroundColor:"var(--bg-elevated)",border:"1px solid var(--border-base)",boxShadow:"var(--shadow-elevated)"}} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold" style={{color:"var(--text-primary)"}}>검수 요청</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{color:"var(--text-muted)"}}><XMarkIcon className="h-5 w-5" /></button>
        </div>
        {error && <p className="text-sm rounded-lg px-3 py-2" style={{color:"var(--danger-text)",backgroundColor:"var(--danger-bg)"}}>{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>검수 유형</label>
            <select className="select select-bordered select-sm w-full" value={form.inspectionType} onChange={e => set('inspectionType', e.target.value)}>
              <option value="DELIVERY">납품검수</option>
              <option value="INSTALLATION">시공검수</option>
              <option value="COMPLETION">준공검수</option>
              <option value="DEFECT">하자검수</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>제목 *</label>
            <input className="input input-bordered input-sm w-full" placeholder="예) 2차 납품분 검수 요청" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>상세 내용</label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={3} placeholder="검수 내용, 확인 사항..." value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>검수 예정일</label>
            <input type="date" className="input input-bordered input-sm w-full" value={form.scheduledDate} onChange={e => set('scheduledDate', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2" style={{borderTop:"1px solid var(--border-subtle)"}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>취소</button>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : '요청'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── 승인/반려 모달 ──────────────────────────────────────
const ApproveModal = ({ insp, onClose, onDone }: { insp: any; onClose: () => void; onDone: () => void }) => {
  const [result, setResult] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // 간단 서명 캔버스
  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'var(--text-primary)';
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const endDraw = () => setIsDrawing(false);
  const clearSig = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSubmit = async (status: string) => {
    setSaving(true);
    const signatureData = canvasRef.current?.toDataURL('image/png') || null;
    await fetch('/api/inspections', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inspectionId: insp.id,
        status,
        result: status === 'PASSED' ? 'PASS' : status === 'FAILED' ? 'FAIL' : null,
        resultNote: note || null,
        signatureData: signatureData?.length > 100 ? signatureData : null,
      }),
    });
    setSaving(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:"rgba(0,0,0,0.4)"}} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-5 space-y-4 slide-up" style={{backgroundColor:"var(--bg-elevated)",border:"1px solid var(--border-base)",boxShadow:"var(--shadow-elevated)"}} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold" style={{color:"var(--text-primary)"}}>검수 처리</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{color:"var(--text-muted)"}}><XMarkIcon className="h-5 w-5" /></button>
        </div>

        <div className="rounded-lg p-3" style={{backgroundColor:"var(--bg-hover)"}}>
          <p className="text-sm font-semibold" style={{color:"var(--text-primary)"}}>{insp.title}</p>
          <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>{insp.description || '-'}</p>
        </div>

        <div>
          <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>검수 의견</label>
          <textarea className="textarea textarea-bordered w-full text-sm" rows={2} placeholder="검수 결과 의견..." value={note} onChange={e => setNote(e.target.value)} />
        </div>

        {/* 서명 영역 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs" style={{color:"var(--text-muted)"}}>서명 (선택)</label>
            <button className="text-xs" style={{color:"var(--brand)"}} onClick={clearSig}>초기화</button>
          </div>
          <canvas
            ref={canvasRef}
            width={360} height={100}
            className="w-full rounded-lg cursor-crosshair touch-none"
            style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-surface)", height: '100px'}}
            onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
            onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
          />
        </div>

        <div className="flex gap-2 justify-end pt-2" style={{borderTop:"1px solid var(--border-subtle)"}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>취소</button>
          <button className="btn btn-sm gap-1" style={{border:"1px solid var(--danger-border)",color:"var(--danger-text)"}}
            onClick={() => handleSubmit('FAILED')} disabled={saving}>
            <XCircleIcon className="h-3.5 w-3.5" />반려
          </button>
          <button className="btn btn-sm gap-1" style={{backgroundColor:"var(--success-text)",borderColor:"var(--success-text)",color:"#fff"}}
            onClick={() => handleSubmit('PASSED')} disabled={saving}>
            <CheckCircleIcon className="h-3.5 w-3.5" />승인
          </button>
        </div>
      </div>
    </div>
  );
};

export default InspectionPanel;
