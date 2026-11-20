import { useRef, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Camera, GripVertical, ImagePlus, Loader2, MapPin, Plus, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { compressPhoto, isDuplicateCode, moveItem, nextCode, SEVERITIES, validatePiece, type Piece, type PiecePhoto, type PlanSheet, type Segment, type Severity } from '@/lib/report-model';
import { decisionOptions, DEFAULT_DECISIONS } from '@/lib/inspection-settings';
import { PlanBoard } from '@/components/plan-board';

export function PieceEditor({ initial, segments, pieces, plans = [], decisions = DEFAULT_DECISIONS, onSave, onClose }: { initial: Piece; segments: Segment[]; pieces: Piece[]; plans?: PlanSheet[]; decisions?: string[]; onSave: (piece: Piece) => void; onClose: () => void }) {
  const [piece, setPiece] = useState(() => { initial = initial.code ? initial : { ...initial, condition: decisions[0] ?? 'Aprovado' }; const seg = segments.find(s => s.id === initial.segmentId); return !initial.code && seg ? { ...initial, code: nextCode(seg.prefix, pieces, initial.id) } : initial; });
  const suggested = useRef(initial.code ? '' : piece.code);
  const duplicate = isDuplicateCode(piece.code, pieces, piece.id);
  function chooseSegment(segmentId: string) {
    const seg = segments.find(s => s.id === segmentId);
    setPiece(p => { const auto = !p.code.trim() || p.code === suggested.current; const code = auto && seg ? nextCode(seg.prefix, pieces, p.id) : p.code; if (auto) suggested.current = code; return { ...p, segmentId, code }; });
  }
  const setIssue = (id: string, patch: { description?: string; severity?: Severity }) => setPiece(p => ({ ...p, issues: p.issues.map(i => i.id === id ? { ...i, ...patch } : i) }));
  const [uploading, setUploading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [planId, setPlanId] = useState(initial.marker?.planId ?? plans[0]?.id ?? '');
  const markedPlan = plans.find(pl => pl.id === piece.marker?.planId);
  const [error, setError] = useState('');
  const gallery = useRef<HTMLInputElement>(null), camera = useRef<HTMLInputElement>(null);
  const dragPhoto = useRef<number | null>(null);
  const field = (key: keyof Piece, value: string | number) => setPiece(p => ({ ...p, [key]: value }));
  async function upload(files: FileList | File[] | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const photos: PiecePhoto[] = [];
      for (const file of Array.from(files)) { try { photos.push(await compressPhoto(file)); } catch { toast.error(`Não foi possível abrir ${file.name}. Use JPG, PNG ou WebP.`); } }
      setPiece(p => ({ ...p, photos: [...p.photos, ...photos] }));
    } finally { setUploading(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !uploading) onClose(); }}><DialogContent className="piece-dialog"><DialogHeader><DialogTitle>{initial.code ? 'Editar peça' : 'Adicionar peça'}</DialogTitle><DialogDescription>Identificação, condição e registro fotográfico.</DialogDescription></DialogHeader>
    <form onSubmit={e => { e.preventDefault(); const message = validatePiece(piece); if (message) { setError(message); return; } onSave({ ...piece, code: piece.code.trim() }); }}>
      <div className="form-grid">
        <label className="field">Segmento <span className="required">*</span><select autoFocus value={piece.segmentId} onChange={e => chooseSegment(e.target.value)} aria-required="true"><option value="" disabled>Escolha o segmento</option>{segments.map(s => <option key={s.id} value={s.id}>{s.name} ({s.prefix})</option>)}</select></label>
        <label className="field">Código / número da peça <span className="required">*</span><input value={piece.code} onChange={e => field('code', e.target.value)} placeholder="Ex.: PL-001" aria-required="true" aria-invalid={duplicate} />{duplicate && <span className="field-warning"><AlertTriangle size={13} />Já existe uma peça com este código.</span>}</label>
        <label className="field">Localização / setor<input value={piece.location} onChange={e => field('location', e.target.value)} placeholder="Ex.: Galpão A" /></label>
        <div className="flex min-w-0 flex-col gap-4"><label className="field">Avaliação<select aria-label="Avaliação" value={piece.condition} onChange={e => field('condition', e.target.value)}>{decisionOptions(decisions, piece.condition).map(c => <option key={c}>{c}</option>)}</select></label><label className="field">Quantidade<input type="number" min={1} step={1} value={piece.quantity} onChange={e => field('quantity', Number(e.target.value))} /></label></div>
        <label className="field">Nome / descrição<input value={piece.name} onChange={e => field('name', e.target.value)} placeholder="Ex.: Pilar metálico" /></label>
        <label className="field full">Observações<textarea rows={2} value={piece.notes} onChange={e => field('notes', e.target.value)} placeholder="Detalhes sobre esta peça..." /></label>
      </div>
      <div className="section-label"><h3>Localização na planta</h3></div>
      {plans.length === 0 ? <p className="text-sm text-muted-foreground">Envie a planta do projeto em “Dados do relatório” para marcar onde fica esta peça.</p> : <>
        <div className="marker-field"><span>{markedPlan ? <>Marcada em <b>{markedPlan.name}</b></> : 'Ainda não marcada na planta.'}</span><Button type="button" variant="outline" size="sm" onClick={() => setPlacing(v => !v)}><MapPin />{placing ? 'Fechar planta' : markedPlan ? 'Alterar posição' : 'Marcar na planta'}</Button>{piece.marker && <Button type="button" variant="ghost" size="sm" onClick={() => setPiece(p => ({ ...p, marker: null }))}>Remover marcação</Button>}</div>
        {placing && <div className="mt-3"><p className="mb-2 text-xs text-muted-foreground">Toque no ponto da peça na planta. Aproxime com dois dedos ou com + e −.</p><PlanBoard plans={plans} pieces={[...pieces.filter(p => p.id !== piece.id), piece]} segments={segments} planId={planId} onPlanChange={setPlanId} activeId={piece.id} onPlace={m => setPiece(p => ({ ...p, marker: m }))} /></div>}
      </>}
      <div className="section-label"><h3>Apontamentos <span className="count-badge">{piece.issues.length}</span></h3></div>
      <div className="issue-list">{piece.issues.map((issue, n) => <div className="issue-row" key={issue.id}><select aria-label={`Gravidade do apontamento ${n + 1}`} value={issue.severity} onChange={e => setIssue(issue.id, { severity: e.target.value as Severity })}>{SEVERITIES.map(v => <option key={v}>{v}</option>)}</select><input aria-label={`Descrição do apontamento ${n + 1}`} value={issue.description} onChange={e => setIssue(issue.id, { description: e.target.value })} placeholder="Descreva o problema encontrado..." /><Button type="button" variant="ghost" size="icon" aria-label={`Remover apontamento ${n + 1}`} onClick={() => setPiece(p => ({ ...p, issues: p.issues.filter(i => i.id !== issue.id) }))}><X /></Button></div>)}<Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setPiece(p => ({ ...p, issues: [...p.issues, { id: crypto.randomUUID(), description: '', severity: 'Leve' }] }))}><Plus />Adicionar apontamento</Button></div>
      <div className="section-label"><h3>Fotos da peça <span className="count-badge">{piece.photos.length}</span></h3></div>
      <div className="photo-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files); }}>
        {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        <strong>{uploading ? 'Preparando fotos...' : 'Adicione suas fotos'}</strong><span>Arraste as imagens ou selecione do dispositivo</span>
        <div className="flex flex-wrap justify-center gap-2"><Button type="button" variant="outline" onClick={() => gallery.current?.click()} disabled={uploading}><Upload />Selecionar fotos</Button><Button type="button" variant="outline" onClick={() => camera.current?.click()} disabled={uploading}><Camera />Câmera</Button></div>
        <input ref={gallery} type="file" accept="image/*" multiple hidden onChange={e => { void upload(e.target.files); e.target.value = ''; }} /><input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e => { void upload(e.target.files); e.target.value = ''; }} />
      </div>
      <div className="photo-editor-grid">{piece.photos.map((photo, index) => <div className="photo-editor" key={photo.id} draggable onDragStart={() => { dragPhoto.current = index; }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); e.stopPropagation(); const from = dragPhoto.current; dragPhoto.current = null; if (from !== null) setPiece(p => ({ ...p, photos: moveItem(p.photos, from, index) })); }}><img src={photo.data} alt={`Foto ${index + 1} da peça`} /><div className="photo-controls"><GripVertical size={15} /><span>Foto {index + 1}</span><Button type="button" variant="ghost" size="icon" title="Mover foto para cima" aria-label={`Mover foto ${index + 1} para cima`} disabled={index === 0} onClick={() => setPiece(p => ({ ...p, photos: moveItem(p.photos, index, index - 1) }))}><ArrowUp /></Button><Button type="button" variant="ghost" size="icon" title="Mover foto para baixo" aria-label={`Mover foto ${index + 1} para baixo`} disabled={index === piece.photos.length - 1} onClick={() => setPiece(p => ({ ...p, photos: moveItem(p.photos, index, index + 1) }))}><ArrowDown /></Button><Button type="button" variant="ghost" size="icon" title="Remover foto" aria-label={`Remover foto ${index + 1}`} onClick={() => setPiece(p => ({ ...p, photos: p.photos.filter(f => f.id !== photo.id) }))}><X /></Button></div><input aria-label={`Legenda da foto ${index + 1}`} placeholder="Adicione uma legenda..." value={photo.caption} onChange={e => setPiece(p => ({ ...p, photos: p.photos.map(f => f.id === photo.id ? { ...f, caption: e.target.value } : f) }))} /></div>)}</div>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="dialog-actions"><Button type="button" variant="outline" onClick={onClose} disabled={uploading}>Cancelar</Button><Button type="submit" disabled={uploading}>Salvar peça</Button></div>
    </form>
  </DialogContent></Dialog>;
}