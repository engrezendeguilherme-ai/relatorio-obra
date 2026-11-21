import { useRef, useState } from 'react';
import { ArrowUpRight, Check, Circle, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { arrowOf, buildShape, DEFAULT_SHAPE_COLOR, ellipseOf, isMeaningfulShape, SHAPE_COLORS, strokeWidth } from '@/lib/photo-shapes';
import type { PhotoShape, PiecePhoto, ShapeKind } from '@/lib/report-model';

function ShapesSvg({ shapes, w, h }: { shapes: PhotoShape[]; w: number; h: number }) {
  const sw = strokeWidth(w, h);
  return <>{[true, false].map(outline => shapes.map(s => {
    const stroke = outline ? 'rgba(255,255,255,0.92)' : s.color, width = outline ? sw * 1.9 : sw, key = `${s.id}-${outline}`;
    if (s.kind === 'circle') { const e = ellipseOf(s, w, h); return <ellipse key={key} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill="none" stroke={stroke} strokeWidth={width} />; }
    const a = arrowOf(s, w, h);
    return <g key={key} stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"><line x1={a.x1} y1={a.y1} x2={a.bx} y2={a.by} /><polygon points={a.points} fill={stroke} /></g>;
  }))}</>;
}

/** Draw circles and arrows over a photo. Coordinates are saved as fractions of the photo, so the original image is never changed. */
export function PhotoAnnotator({ photo, onSave, onClose }: { photo: PiecePhoto; onSave: (shapes: PhotoShape[]) => void; onClose: () => void }) {
  const w = photo.width || 1000, h = photo.height || 750;
  const [shapes, setShapes] = useState<PhotoShape[]>(photo.shapes ?? []);
  const [kind, setKind] = useState<ShapeKind>('circle');
  const [color, setColor] = useState<string>(DEFAULT_SHAPE_COLOR);
  const [draft, setDraft] = useState<PhotoShape | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drawing = useRef<{ pointer: number; x: number; y: number } | null>(null);
  const point = (e: React.PointerEvent) => { const r = box.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drawing.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
    const p = point(e); drawing.current = { pointer: e.pointerId, ...p }; setDraft(buildShape(kind, color, p, p));
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => { const d = drawing.current; if (d && d.pointer === e.pointerId) setDraft(buildShape(kind, color, d, point(e))); };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drawing.current; if (!d || d.pointer !== e.pointerId) return;
    drawing.current = null;
    const done = buildShape(kind, color, d, point(e));
    setDraft(null);
    if (isMeaningfulShape(done)) setShapes(list => [...list, done]);
  };
  const cancel = () => { drawing.current = null; setDraft(null); };
  const tool = (k: ShapeKind, label: string, icon: React.ReactNode) => <Button type="button" size="sm" variant={kind === k ? 'default' : 'outline'} aria-pressed={kind === k} onClick={() => setKind(k)}>{icon}{label}</Button>;
  return <Dialog open onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="annotator-dialog">
    <DialogHeader><DialogTitle>Marcar foto</DialogTitle><DialogDescription>Escolha círculo ou seta e arraste sobre a foto para destacar o problema.</DialogDescription></DialogHeader>
    <div className="annotator-toolbar">
      {tool('circle', 'Círculo', <Circle />)}{tool('arrow', 'Seta', <ArrowUpRight />)}
      <span className="annotator-colors" role="group" aria-label="Cor da marcação">{SHAPE_COLORS.map(c => <button type="button" key={c.value} className={color === c.value ? 'on' : ''} style={{ background: c.value }} aria-label={c.name} aria-pressed={color === c.value} title={c.name} onClick={() => setColor(c.value)} />)}</span>
      <Button type="button" size="sm" variant="outline" disabled={!shapes.length} onClick={() => setShapes(list => list.slice(0, -1))}><Undo2 />Desfazer</Button>
      <Button type="button" size="sm" variant="outline" disabled={!shapes.length} onClick={() => setShapes([])}><Trash2 />Limpar</Button>
    </div>
    <div ref={box} className="annotator-box" style={{ aspectRatio: `${w} / ${h}`, width: `min(100%, calc(58dvh * ${w / h}))` }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}>
      <img src={photo.data} alt="Foto para marcar" draggable={false} />
      <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><ShapesSvg shapes={draft ? [...shapes, draft] : shapes} w={w} h={h} /></svg>
    </div>
    <p className="text-xs text-muted-foreground">{shapes.length} {shapes.length === 1 ? 'marcação' : 'marcações'} nesta foto. A foto original não é alterada.</p>
    <div className="dialog-actions"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="button" onClick={() => onSave(shapes)}><Check />Aplicar marcações</Button></div>
  </DialogContent></Dialog>;
}
