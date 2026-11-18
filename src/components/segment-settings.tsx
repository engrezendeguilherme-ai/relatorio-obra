import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { moveItem, type Report, type Segment } from '@/lib/report-model';

export function SegmentSettings({ report, onChange, onClose }: { report: Report; onChange: (patch: Pick<Report, 'segments' | 'pieces'>) => void; onClose: () => void }) {
  const drag = useRef<number | null>(null);
  const [removing, setRemoving] = useState<Segment | null>(null);
  const [target, setTarget] = useState('');
  const segments = report.segments;
  const count = (id: string) => report.pieces.filter(p => p.segmentId === id).length;
  const set = (next: Segment[]) => onChange({ segments: next, pieces: report.pieces });
  const edit = (id: string, patch: Partial<Segment>) => set(segments.map(s => s.id === id ? { ...s, ...patch } : s));
  function remove(seg: Segment) {
    if (segments.length === 1) { toast.error('Mantenha pelo menos um segmento.'); return; }
    setTarget(segments.find(s => s.id !== seg.id)!.id); setRemoving(seg);
  }
  function confirmRemove() {
    if (!removing) return;
    onChange({ segments: segments.filter(s => s.id !== removing.id), pieces: report.pieces.map(p => p.segmentId === removing.id ? { ...p, segmentId: target } : p) });
    toast.success('Segmento excluído'); setRemoving(null);
  }
  return <><Dialog open onOpenChange={o => { if (!o) onClose(); }}><DialogContent className="piece-dialog"><DialogHeader><DialogTitle>Configurações dos segmentos</DialogTitle><DialogDescription>Arraste para reordenar. A ordem aqui define a ordem no relatório.</DialogDescription></DialogHeader>
    <div className="segment-settings">{segments.map((s, i) => <div className="segment-setting" key={s.id} draggable onDragStart={() => { drag.current = i; }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (drag.current !== null) set(moveItem(segments, drag.current, i)); drag.current = null; }}>
      <GripVertical size={16} className="drag-handle" />
      <input type="color" aria-label={`Cor de ${s.name}`} value={s.color} onChange={e => edit(s.id, { color: e.target.value })} />
      <input aria-label="Nome do segmento" value={s.name} onChange={e => edit(s.id, { name: e.target.value })} />
      <input aria-label={`Prefixo de ${s.name}`} className="prefix-input" value={s.prefix} maxLength={6} onChange={e => edit(s.id, { prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
      <span className="count-badge" title="Peças neste segmento">{count(s.id)}</span>
      <Button type="button" variant="ghost" size="icon" aria-label={`Mover ${s.name} para cima`} disabled={i === 0} onClick={() => set(moveItem(segments, i, i - 1))}><ArrowUp /></Button>
      <Button type="button" variant="ghost" size="icon" aria-label={`Mover ${s.name} para baixo`} disabled={i === segments.length - 1} onClick={() => set(moveItem(segments, i, i + 1))}><ArrowDown /></Button>
      <Button type="button" variant="ghost" size="icon" aria-label={`Excluir ${s.name}`} onClick={() => remove(s)}><Trash2 /></Button>
    </div>)}</div>
    <div className="dialog-actions"><Button variant="outline" onClick={() => set([...segments, { id: crypto.randomUUID(), name: 'Novo segmento', prefix: 'NS', color: '#2059d2' }])}><Plus />Adicionar segmento</Button><Button onClick={onClose}>Concluir</Button></div>
  </DialogContent></Dialog>
  <Dialog open={removing !== null} onOpenChange={o => { if (!o) setRemoving(null); }}><DialogContent><DialogHeader><DialogTitle>Excluir o segmento “{removing?.name}”?</DialogTitle><DialogDescription>{removing && count(removing.id) ? `Este segmento tem ${count(removing.id)} peça(s). Escolha para onde movê-las.` : 'Este segmento não tem peças cadastradas.'}</DialogDescription></DialogHeader>
    {removing && count(removing.id) > 0 && <label className="field">Mover peças para<select value={target} onChange={e => setTarget(e.target.value)}>{segments.filter(s => s.id !== removing.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    <div className="dialog-actions"><Button variant="outline" onClick={() => setRemoving(null)}>Cancelar</Button><Button variant="destructive" onClick={confirmRemove}>Excluir segmento</Button></div></DialogContent></Dialog></>;
}
