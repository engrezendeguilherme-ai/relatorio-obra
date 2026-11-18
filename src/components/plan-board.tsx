import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clampMarker, type Piece, type PlanMarker, type PlanSheet, type Segment } from '@/lib/report-model';

/** Zoomable plan with piece markers. onPlace makes a tap set a position; onSelect opens a marker. */
export function PlanBoard({ plans, pieces, segments, planId, onPlanChange, activeId, onPlace, onSelect }: { plans: PlanSheet[]; pieces: Piece[]; segments: Segment[]; planId: string; onPlanChange: (id: string) => void; activeId?: string; onPlace?: (m: PlanMarker) => void; onSelect?: (p: Piece) => void }) {
  const [zoom, setZoom] = useState(1);
  const plan = plans.find(p => p.id === planId) ?? plans[0];
  if (!plan) return null;
  const shown = pieces.filter(p => p.marker?.planId === plan.id);
  const color = (p: Piece) => segments.find(s => s.id === p.segmentId)?.color ?? '#2059d2';
  return <div className="plan-board">
    <div className="plan-toolbar">
      {plans.length > 1 ? <select aria-label="Planta" value={plan.id} onChange={e => onPlanChange(e.target.value)}>{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select> : <strong className="text-sm">{plan.name}</strong>}
      <div className="flex items-center gap-1"><Button type="button" variant="outline" size="icon" aria-label="Diminuir zoom" onClick={() => setZoom(z => Math.max(1, z / 1.5))} disabled={zoom <= 1}><Minus /></Button><span className="w-12 text-center text-xs">{Math.round(zoom * 100)}%</span><Button type="button" variant="outline" size="icon" aria-label="Aumentar zoom" onClick={() => setZoom(z => Math.min(6, z * 1.5))} disabled={zoom >= 6}><Plus /></Button></div>
    </div>
    <div className="plan-scroll">
      <div className={`plan-sheet ${onPlace ? 'placing' : ''}`} style={{ width: `${zoom * 100}%` }} onClick={e => { if (!onPlace) return; const r = e.currentTarget.getBoundingClientRect(); onPlace({ planId: plan.id, ...clampMarker((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height) }); }}>
        <img src={plan.data} alt={plan.name} draggable={false} />
        {shown.map(p => <button type="button" key={p.id} className={`plan-marker ${p.id === activeId ? 'active' : ''} ${activeId && p.id !== activeId ? 'dim' : ''}`} style={{ left: `${p.marker!.x * 100}%`, top: `${p.marker!.y * 100}%`, ['--marker' as string]: color(p) }} onClick={e => { if (onSelect) { e.stopPropagation(); onSelect(p); } }} aria-label={`Peça ${p.code}`}><i /><span>{p.code}</span></button>)}
      </div>
    </div>
  </div>;
}
