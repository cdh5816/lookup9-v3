/* eslint-disable i18next/no-literal-string */
import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  PlusIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

interface CalendarPanelProps {
  siteId: string;
  canManage: boolean;
}

const EVENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  DELIVERY:     { bg: 'var(--info-bg)', text: 'var(--info-text)', label: '납품' },
  INSPECTION:   { bg: 'var(--warning-bg)', text: 'var(--warning-text)', label: '검수' },
  MEETING:      { bg: '#FAF5FF', text: '#7C3AED', label: '회의' },
  INSTALLATION: { bg: 'var(--success-bg)', text: 'var(--success-text)', label: '시공' },
  MILESTONE:    { bg: 'var(--danger-bg)', text: 'var(--danger-text)', label: '마일스톤' },
  GENERAL:      { bg: 'var(--bg-hover)', text: 'var(--text-secondary)', label: '일반' },
};

const CalendarPanel = ({ siteId, canManage }: CalendarPanelProps) => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const monthStr = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}`;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/calendar?siteId=${siteId}&month=${monthStr}`);
    if (res.ok) { const d = await res.json(); setEvents(d.data || []); }
    setLoading(false);
  }, [siteId, monthStr]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const prevMonth = () => setCurrentMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
  const nextMonth = () => setCurrentMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
  const goToday = () => { const now = new Date(); setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() }); };

  // 달력 데이터 생성
  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const days: { date: number; dateStr: string; isToday: boolean; events: any[] }[] = [];

    // 이전 달 빈칸
    for (let i = 0; i < firstDay; i++) days.push({ date: 0, dateStr: '', isToday: false, events: [] });

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = events.filter(e => {
        const eDate = new Date(e.startDate).toISOString().split('T')[0];
        return eDate === dateStr;
      });
      days.push({ date: d, dateStr, isToday: dateStr === todayStr, events: dayEvents });
    }

    return days;
  }, [currentMonth, events]);

  const selectedEvents = selectedDate ? events.filter(e => new Date(e.startDate).toISOString().split('T')[0] === selectedDate) : [];

  const handleDelete = async (eventId: string) => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    await fetch(`/api/calendar?eventId=${eventId}`, { method: 'DELETE' });
    fetchEvents();
    setSelectedDate(null);
  };

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1.5 rounded-lg" style={{color:"var(--text-muted)"}}><ChevronLeftIcon className="h-4 w-4" /></button>
          <h3 className="text-base font-bold" style={{color:"var(--text-primary)"}}>
            {currentMonth.year}년 {currentMonth.month + 1}월
          </h3>
          <button onClick={nextMonth} className="p-1.5 rounded-lg" style={{color:"var(--text-muted)"}}><ChevronRightIcon className="h-4 w-4" /></button>
          <button onClick={goToday} className="text-xs px-2 py-0.5 rounded" style={{color:"var(--brand)",border:"1px solid var(--brand)"}}>오늘</button>
        </div>
        {canManage && (
          <button className="btn btn-primary btn-sm gap-1" onClick={() => setShowCreate(true)}>
            <PlusIcon className="h-4 w-4" />일정 추가
          </button>
        )}
      </div>

      {/* 달력 그리드 */}
      <div className="rounded-xl overflow-hidden" style={{border:"1px solid var(--border-base)"}}>
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7" style={{backgroundColor:"var(--bg-hover)"}}>
          {WEEKDAYS.map((d, i) => (
            <div key={d} className="text-center py-2 text-xs font-semibold" style={{
              color: i === 0 ? 'var(--danger-text)' : i === 6 ? 'var(--info-text)' : 'var(--text-muted)'
            }}>{d}</div>
          ))}
        </div>

        {/* 날짜 */}
        <div className="grid grid-cols-7" style={{backgroundColor:"var(--bg-card)"}}>
          {calendarDays.map((day, idx) => (
            <div
              key={idx}
              className={`min-h-[48px] sm:min-h-[72px] p-0.5 sm:p-1 cursor-pointer transition-colors ${day.date === 0 ? '' : 'active:scale-[0.97]'}`}
              style={{
                borderTop: "1px solid var(--border-subtle)",
                borderRight: (idx + 1) % 7 !== 0 ? "1px solid var(--border-subtle)" : "none",
                backgroundColor: selectedDate === day.dateStr ? 'var(--brand-light)' : day.isToday ? 'var(--info-bg)' : 'transparent',
              }}
              onClick={() => day.date > 0 && setSelectedDate(day.dateStr === selectedDate ? null : day.dateStr)}
            >
              {day.date > 0 && (
                <>
                  <span className="text-xs font-medium block text-center sm:text-left sm:pl-1" style={{
                    color: day.isToday ? 'var(--brand)' : idx % 7 === 0 ? 'var(--danger-text)' : idx % 7 === 6 ? 'var(--info-text)' : 'var(--text-primary)',
                    fontWeight: day.isToday ? 700 : 400,
                  }}>{day.date}</span>
                  {/* 이벤트 도트 (모바일: 점만, 데스크탑: 라벨) */}
                  <div className="flex flex-wrap gap-0.5 mt-0.5 px-0.5">
                    {day.events.slice(0, 3).map((e: any, ei: number) => {
                      const ec = EVENT_COLORS[e.eventType] || EVENT_COLORS.GENERAL;
                      return (
                        <div key={ei}>
                          {/* 모바일: 점 */}
                          <div className="w-1.5 h-1.5 rounded-full sm:hidden" style={{backgroundColor: ec.text}} />
                          {/* 데스크탑: 라벨 */}
                          <div className="hidden sm:block text-[9px] px-1 py-0.5 rounded truncate max-w-full font-medium" style={{backgroundColor: ec.bg, color: ec.text}}>
                            {e.title}
                          </div>
                        </div>
                      );
                    })}
                    {day.events.length > 3 && (
                      <span className="text-[9px] hidden sm:block" style={{color:"var(--text-muted)"}}>+{day.events.length - 3}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 선택된 날짜의 이벤트 목록 */}
      {selectedDate && (
        <div className="rounded-xl p-4 slide-up" style={{border:"1px solid var(--border-base)",backgroundColor:"var(--bg-card)"}}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{color:"var(--text-primary)"}}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
            <button className="text-xs" style={{color:"var(--text-muted)"}} onClick={() => setSelectedDate(null)}>닫기</button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-sm py-3 text-center" style={{color:"var(--text-muted)"}}>일정이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map(e => {
                const ec = EVENT_COLORS[e.eventType] || EVENT_COLORS.GENERAL;
                return (
                  <div key={e.id} className="flex items-start gap-2 rounded-lg p-2" style={{backgroundColor:"var(--bg-hover)"}}>
                    <div className="w-1 h-8 rounded-full mt-0.5" style={{backgroundColor: ec.text}} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] px-1 py-0.5 rounded font-medium" style={{backgroundColor: ec.bg, color: ec.text}}>{ec.label}</span>
                        <span className="text-sm font-medium truncate" style={{color:"var(--text-primary)"}}>{e.title}</span>
                      </div>
                      {e.description && <p className="text-xs mt-0.5" style={{color:"var(--text-muted)"}}>{e.description}</p>}
                      <div className="flex items-center gap-2 mt-1 text-[10px]" style={{color:"var(--text-muted)"}}>
                        {e.location && <span>📍 {e.location}</span>}
                        <span>{e.createdBy?.name || ''}</span>
                      </div>
                    </div>
                    {canManage && (
                      <button className="text-xs shrink-0" style={{color:"var(--danger-text)"}} onClick={() => handleDelete(e.id)}>삭제</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 생성 모달 */}
      {showCreate && (
        <CreateEventModal siteId={siteId} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchEvents(); }} defaultDate={selectedDate} />
      )}
    </div>
  );
};

// ── 일정 생성 모달 ──────────────────────────────────────
const CreateEventModal = ({ siteId, onClose, onCreated, defaultDate }: {
  siteId: string; onClose: () => void; onCreated: () => void; defaultDate?: string | null;
}) => {
  const [form, setForm] = useState({
    title: '', description: '', eventType: 'GENERAL',
    startDate: defaultDate || new Date().toISOString().split('T')[0],
    endDate: '', allDay: true, location: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('일정 제목을 입력하세요.'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, ...form, endDate: form.endDate || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error?.message || '등록 실패'); }
      onCreated();
    } catch (e: any) { setError(e.message); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:"rgba(0,0,0,0.4)"}} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-5 space-y-4 slide-up" style={{backgroundColor:"var(--bg-elevated)",border:"1px solid var(--border-base)",boxShadow:"var(--shadow-elevated)"}} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold" style={{color:"var(--text-primary)"}}>일정 추가</h3>
          <button onClick={onClose} className="p-1 rounded-lg" style={{color:"var(--text-muted)"}}><XMarkIcon className="h-5 w-5" /></button>
        </div>
        {error && <p className="text-sm rounded-lg px-3 py-2" style={{color:"var(--danger-text)",backgroundColor:"var(--danger-bg)"}}>{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>일정 유형</label>
            <select className="select select-bordered select-sm w-full" value={form.eventType} onChange={e => set('eventType', e.target.value)}>
              <option value="GENERAL">일반</option>
              <option value="DELIVERY">납품</option>
              <option value="INSPECTION">검수</option>
              <option value="MEETING">회의</option>
              <option value="INSTALLATION">시공</option>
              <option value="MILESTONE">마일스톤</option>
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>제목 *</label>
            <input className="input input-bordered input-sm w-full" placeholder="일정 제목" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>시작일 *</label>
              <input type="date" className="input input-bordered input-sm w-full" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>종료일</label>
              <input type="date" className="input input-bordered input-sm w-full" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>장소</label>
            <input className="input input-bordered input-sm w-full" placeholder="장소 (선택)" value={form.location} onChange={e => set('location', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{color:"var(--text-muted)"}}>메모</label>
            <textarea className="textarea textarea-bordered w-full text-sm" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2" style={{borderTop:"1px solid var(--border-subtle)"}}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>취소</button>
          <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarPanel;
