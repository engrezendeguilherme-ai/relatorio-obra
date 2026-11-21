import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Circle, Move, Trash2, Undo2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { arrowOf, buildShape, DEFAULT_SHAPE_COLOR, ellipseOf, hitShape, isMeaningfulShape, moveShape, SHAPE_COLORS, shapeBounds, strokeWidth } from '@/lib/photo-shapes';
import type { PhotoShape, PiecePhoto } from '@/lib/report-model';

type Tool = 'circle' | 'arrow' | 'move';
type Point = { x: number; y: number };
type Corner = { fx: 'x1' | 'x2'; fy: 'y1' | 'y2'; label: string };
type Drag =
  | { kind: 'draw'; pointer: number; from: Point; before: PhotoShape[] }
  | { kind: 'move'; pointer: number; from: Point; origin: PhotoShape; before: PhotoShape[] }
  | { kind: 'handle'; pointer: number; corner: Corner; origin: PhotoShape; before: PhotoShape[] };

const GRAB_PX = 22; // grab distance on screen, so small markings stay easy to touch
const handlesOf = (s: PhotoShape): Corner[] => s.kind === 'arrow'
  ? [{ fx: 'x1', fy: 'y1', label: 'Início da seta' }, { fx: 'x2', fy: 'y2', label: 'Ponta da seta' }]
  : [{ fx: 'x1', fy: 'y1', label: 'Canto superior esquerdo' }, { fx: 'x2', fy: 'y1', label: 'Canto superior direito' }, { fx: 'x2', fy: 'y2', label: 'Canto inferior direito' }, { fx: 'x1', fy: 'y2', label: 'Canto inferior esquerdo' }];

function ShapesSvg({ shapes, w, h, selected }: { shapes: PhotoShape[]; w: number; h: number; selected?: PhotoShape | undefined }) {
  const sw = strokeWidth(w, h);
  const b = selected ? shapeBounds(selected) : null;
  return <>{[true, false].map(outline => shapes.map(s => {
    const stroke = outline ? 'rgba(255,255,255,0.92)' : s.color, width = outline ? sw * 1.9 : sw, key = `${s.id}-${outline}`;
    if (s.kind === 'circle') { const e = ellipseOf(s, w, h); return <ellipse key={key} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill="none" stroke={stroke} strokeWidth={width} />; }
    const a = arrowOf(s, w, h);
    return <g key={key} stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"><line x1={a.x1} y1={a.y1} x2={a.bx} y2={a.by} /><polygon points={a.points} fill={stroke} /></g>;
  }))}
  {b && <rect x={b.minX * w} y={b.minY * h} width={(b.maxX - b.minX) * w} height={(b.maxY - b.minY) * h} fill="none" stroke="#0ea5e9" strokeWidth={sw * 0.5} strokeDasharray={`${sw * 2} ${sw * 1.5}`} />}</>;
}

/** Draw circles and arrows over a photo, then select, move, resize or delete them. Coordinates are saved as fractions of the photo, so the original image is never changed. */
export function PhotoAnnotator({ photo, onSave, onClose }: { photo: PiecePhoto; onSave: (shapes: PhotoShape[]) => void; onClose: () => void }) {
  const w = photo.width || 1000, h = photo.height || 750;
  const [shapes, setShapes] = useState<PhotoShape[]>(photo.shapes ?? []);
  const [past, setPast] = useState<PhotoShape[][]>([]);
  const [tool, setTool] = useState<Tool>('circle');
  const [color, setColor] = useState<string>(DEFAULT_SHAPE_COLOR);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PhotoShape | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const shapesRef = useRef(shapes); shapesRef.current = shapes;
  const selected = shapes.find(s => s.id === selectedId);

  const commit = (next: PhotoShape[]) => { setPast(p => [...p, shapesRef.current]); setShapes(next); };
  const replace = (next: PhotoShape) => { const list = shapesRef.current.map(s => s.id === next.id ? next : s); shapesRef.current = list; setShapes(list); };
  const remove = () => { if (!selectedId) return; commit(shapes.filter(s => s.id !== selectedId)); setSelectedId(null); };
  const undo = () => { const prev = past[past.length - 1]; if (!prev) return; setPast(p => p.slice(0, -1)); setShapes(prev); setSelectedId(id => prev.some(s => s.id === id) ? id : null); };
  const chooseColor = (c: string) => { setColor(c); if (selectedId) commit(shapes.map(s => s.id === selectedId ? { ...s, color: c } : s)); };
  const chooseTool = (t: Tool) => { setTool(t); if (t !== 'move') setSelectedId(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); setPast(p => [...p, shapesRef.current]); setShapes(l => l.filter(s => s.id !== selectedId)); setSelectedId(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const rect = () => box.current!.getBoundingClientRect();
  const point = (e: React.PointerEvent): Point => { const r = rect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  const grabPx = () => GRAB_PX * (w / (rect().width || w));
  const capture = (e: React.PointerEvent<HTMLElement>) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already released */ } };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const p = point(e);
    // Move tool: grab any marking (topmost first). Drawing tools: only the selected one, by its outline, so new shapes can start anywhere else.
    const candidates = tool === 'move' ? [...shapes].reverse() : selected ? [selected] : [];
    const grabbed = candidates.find(s => hitShape(s, p, w, h, grabPx(), tool === 'move'));
    if (grabbed) { capture(e); setSelectedId(grabbed.id); drag.current = { kind: 'move', pointer: e.pointerId, from: p, origin: grabbed, before: shapes }; return; }
    if (tool === 'move') { setSelectedId(null); return; }
    capture(e); drag.current = { kind: 'draw', pointer: e.pointerId, from: p, before: shapes }; setDraft(buildShape(tool, color, p, p));
  };
  const handleDown = (e: React.PointerEvent<HTMLDivElement>, corner: Corner) => {
    if (drag.current || !selected) return;
    e.stopPropagation(); capture(e);
    drag.current = { kind: 'handle', pointer: e.pointerId, corner, origin: selected, before: shapes };
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || d.pointer !== e.pointerId) return;
    const p = point(e);
    if (d.kind === 'draw') setDraft(buildShape(tool === 'move' ? 'circle' : tool, color, d.from, p));
    else if (d.kind === 'move') replace(moveShape(d.origin, p.x - d.from.x, p.y - d.from.y));
    else replace({ ...d.origin, [d.corner.fx]: Math.min(1, Math.max(0, p.x)), [d.corner.fy]: Math.min(1, Math.max(0, p.y)) });
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (d.kind === 'draw') {
      const done = buildShape(tool === 'move' ? 'circle' : tool, color, d.from, point(e));
      setDraft(null);
      if (isMeaningfulShape(done)) { setPast(p => [...p, d.before]); setShapes([...d.before, done]); setSelectedId(done.id); }
      return;
    }
    const now = shapesRef.current.find(s => s.id === d.origin.id);
    if (now && !isMeaningfulShape(now)) { setShapes(d.before); return; } // resized to nothing: keep the previous size
    if (JSON.stringify(shapesRef.current) !== JSON.stringify(d.before)) setPast(p => [...p, d.before]);
  };
  const cancel = () => { const d = drag.current; drag.current = null; setDraft(null); if (d && d.kind !== 'draw') setShapes(d.before); };

  const toolBtn = (t: Tool, label: string, icon: React.ReactNode) => <Button type="button" size="sm" variant={tool === t ? 'default' : 'outline'} aria-pressed={tool === t} onClick={() => chooseTool(t)}>{icon}{label}</Button>;
  const hint = tool === 'move'
    ? 'Toque numa marcação para selecionar e arraste para mover. Use as bolinhas para ajustar tamanho ou direção.'
    : 'Arraste sobre a foto para desenhar. Para ajustar uma marcação, use as bolinhas ou a ferramenta Mover.';
  return <Dialog open onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="annotator-dialog">
    <DialogHeader><DialogTitle>Marcar foto</DialogTitle><DialogDescription>{hint}</DialogDescription></DialogHeader>
    <div className="annotator-toolbar">
      {toolBtn('circle', 'Círculo', <Circle />)}{toolBtn('arrow', 'Seta', <ArrowUpRight />)}{toolBtn('move', 'Mover', <Move />)}
      <span className="annotator-colors" role="group" aria-label="Cor da marcação">{SHAPE_COLORS.map(c => <button type="button" key={c.value} className={(selected ? selected.color : color) === c.value ? 'on' : ''} style={{ background: c.value }} aria-label={c.name} aria-pressed={(selected ? selected.color : color) === c.value} title={selected ? `${c.name} (marcação selecionada)` : c.name} onClick={() => chooseColor(c.value)} />)}</span>
      <Button type="button" size="sm" variant="outline" disabled={!past.length} onClick={undo}><Undo2 />Desfazer</Button>
      <Button type="button" size="sm" variant="outline" disabled={!selected} onClick={remove}><X />Excluir</Button>
      <Button type="button" size="sm" variant="outline" disabled={!shapes.length} onClick={() => { commit([]); setSelectedId(null); }}><Trash2 />Limpar tudo</Button>
    </div>
    <div ref={box} className={`annotator-box ${tool === 'move' ? 'move' : ''}`} style={{ aspectRatio: `${w} / ${h}`, width: `min(100%, calc(58dvh * ${w / h}))` }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}>
      <img src={photo.data} alt="Foto para marcar" draggable={false} />
      <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><ShapesSvg shapes={draft ? [...shapes, draft] : shapes} w={w} h={h} selected={selected} /></svg>
      {selected && !draft && handlesOf(selected).map(c => <div key={c.label} role="button" tabIndex={-1} aria-label={c.label} title={c.label} className="annotator-handle" style={{ left: `${selected[c.fx] * 100}%`, top: `${selected[c.fy] * 100}%` }} onPointerDown={e => handleDown(e, c)} />)}
    </div>
    <p className="text-xs text-muted-foreground">{shapes.length} {shapes.length === 1 ? 'marcação' : 'marcações'} nesta foto. A foto original não é alterada.</p>
    <div className="dialog-actions"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="button" onClick={() => onSave(shapes)}><Check />Aplicar marcações</Button></div>
  </DialogContent></Dialog>;
}
