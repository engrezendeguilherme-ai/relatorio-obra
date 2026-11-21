import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clampMarker, hasCritical, type Piece, type PlanMarker, type PlanSheet, type Segment } from '@/lib/report-model';

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

type Anchor = { rx: number; ry: number; px: number; py: number };

/** Zoomable plan with piece markers. Pinch, wheel or +/− zoom around the touched point. onPlace makes a tap set a position; onSelect opens a marker. */
export function PlanBoard({ plans, pieces, segments, planId, onPlanChange, activeId, onPlace, onSelect }: { plans: PlanSheet[]; pieces: Piece[]; segments: Segment[]; planId: string; onPlanChange: (id: string) => void; activeId?: string; onPlace?: (m: PlanMarker) => void; onSelect?: (p: Piece) => void }) {
  const [zoom, setZoom] = useState(1);
  const [onlyCritical, setOnlyCritical] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const anchorRef = useRef<Anchor | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ d0: number; z0: number } | null>(null);
  const suppressClickRef = useRef(0);

  /** Zoom keeping the container point (px, py) — in scroll-container coordinates — visually fixed. */
  const applyZoom = (next: number, px: number, py: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (z === zoomRef.current) return;
    anchorRef.current = { rx: (el.scrollLeft + px) / el.scrollWidth, ry: (el.scrollTop + py) / el.scrollHeight, px, py };
    setZoom(z);
  };
  const applyZoomRef = useRef(applyZoom);
  applyZoomRef.current = applyZoom;

  // After the sheet resizes, restore the scroll so the anchored point stays put.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const a = anchorRef.current;
    if (!el || !a) return;
    anchorRef.current = null;
    el.scrollLeft = a.rx * el.scrollWidth - a.px;
    el.scrollTop = a.ry * el.scrollHeight - a.py;
  }, [zoom]);

  // Native non-passive wheel listener: React's onWheel is passive and cannot preventDefault.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const dy = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 100 : 1);
      const r = el.getBoundingClientRect();
      applyZoomRef.current(zoomRef.current * Math.exp(-dy * 0.002), ev.clientX - r.left, ev.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const pinchPair = () => {
    const [a, b] = [...pointersRef.current.values()];
    return a && b ? ([a, b] as const) : null;
  };

  const pinchDistance = () => {
    const pair = pinchPair();
    return pair ? Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y) : 0;
  };

  const pinchMidpoint = () => {
    const pair = pinchPair();
    const r = scrollRef.current!.getBoundingClientRect();
    return pair ? { x: (pair[0].x + pair[1].x) / 2 - r.left, y: (pair[0].y + pair[1].y) / 2 - r.top } : { x: 0, y: 0 };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') return;
    try { scrollRef.current?.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) pinchRef.current = { d0: pinchDistance(), z0: zoomRef.current };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const mid = pinchMidpoint();
      applyZoom(pinchRef.current.z0 * (pinchDistance() / pinchRef.current.d0), mid.x, mid.y);
    }
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.delete(e.pointerId);
    if (pinchRef.current && pointersRef.current.size < 2) {
      pinchRef.current = null;
      suppressClickRef.current = Date.now(); // swallow the synthetic tap after a pinch
    }
  };

  const buttonZoom = (factor: number) => {
    const el = scrollRef.current;
    if (!el) return;
    applyZoom(zoomRef.current * factor, el.clientWidth / 2, el.clientHeight / 2);
  };

  const plan = plans.find(p => p.id === planId) ?? plans[0];
  if (!plan) return null;
  const onPlan = pieces.filter(p => p.marker?.planId === plan.id);
  const criticalCount = onPlan.filter(hasCritical).length;
  const filterCritical = onlyCritical && criticalCount > 0;
  // Critical markers are drawn last so they stay on top of neighbours.
  const shown = (filterCritical ? onPlan.filter(hasCritical) : onPlan).slice().sort((a, b) => Number(hasCritical(a)) - Number(hasCritical(b)));
  const color = (p: Piece) => segments.find(s => s.id === p.segmentId)?.color ?? '#2059d2';
  return <div className="plan-board">
    <div className="plan-toolbar">
      {plans.length > 1 ? <select aria-label="Planta" value={plan.id} onChange={e => onPlanChange(e.target.value)}>{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select> : <strong className="text-sm">{plan.name}</strong>}
      {criticalCount > 0 && <Button type="button" size="sm" variant={filterCritical ? 'destructive' : 'outline'} aria-pressed={filterCritical} onClick={() => setOnlyCritical(v => !v)}><AlertTriangle />{filterCritical ? 'Mostrar todas' : `Só críticas (${criticalCount})`}</Button>}
      <div className="flex items-center gap-1"><Button type="button" variant="outline" size="icon" aria-label="Diminuir zoom" onClick={() => buttonZoom(1 / 1.5)} disabled={zoom <= MIN_ZOOM}><Minus /></Button><span className="w-12 text-center text-xs">{Math.round(zoom * 100)}%</span><Button type="button" variant="outline" size="icon" aria-label="Aumentar zoom" onClick={() => buttonZoom(1.5)} disabled={zoom >= MAX_ZOOM}><Plus /></Button></div>
    </div>
    <div className="plan-scroll" ref={scrollRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
      <div className={`plan-sheet ${onPlace ? 'placing' : ''}`} style={{ width: `${zoom * 100}%` }} onClick={e => { if (!onPlace || Date.now() - suppressClickRef.current < 350) return; const r = e.currentTarget.getBoundingClientRect(); onPlace({ planId: plan.id, ...clampMarker((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height) }); }}>
        <img src={plan.data} alt={plan.name} draggable={false} />
        {shown.map(p => <button type="button" key={p.id} className={`plan-marker ${hasCritical(p) ? 'critical' : ''} ${p.id === activeId ? 'active' : ''} ${activeId && p.id !== activeId ? 'dim' : ''}`} style={{ left: `${p.marker!.x * 100}%`, top: `${p.marker!.y * 100}%`, ['--marker' as string]: color(p) }} onClick={e => { if (onSelect) { e.stopPropagation(); onSelect(p); } }} aria-label={hasCritical(p) ? `Peça ${p.code} — problema crítico` : `Peça ${p.code}`}><i>{hasCritical(p) ? '!' : null}</i><span>{p.code}</span></button>)}
      </div>
    </div>
    {criticalCount > 0 && <p className="plan-legend"><i className="plan-legend-dot">!</i> Problema crítico — {criticalCount} {criticalCount === 1 ? 'peça' : 'peças'} nesta planta</p>}
  </div>;
}
