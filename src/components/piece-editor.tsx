import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Camera, GripVertical, ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { compressPhoto, CONDITIONS, moveItem, validatePiece, type Piece, type PiecePhoto } from '@/lib/report-model';

export function PieceEditor({ initial, onSave, onClose }: { initial: Piece; onSave: (piece: Piece) => void; onClose: () => void }) {
  const [piece, setPiece] = useState(initial);
  const [uploading, setUploading] = useState(false);
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
        <label className="field">Código / número da peça <span className="required">*</span><input autoFocus value={piece.code} onChange={e => field('code', e.target.value)} placeholder="Ex.: PM-001" aria-required="true" /></label>
        <label className="field">Nome / descrição<input value={piece.name} onChange={e => field('name', e.target.value)} placeholder="Ex.: Viga metálica" /></label>
        <label className="field">Localização / setor<input value={piece.location} onChange={e => field('location', e.target.value)} placeholder="Ex.: Galpão A" /></label>
        <div className="form-grid compact"><label className="field">Condição<select value={piece.condition} onChange={e => field('condition', e.target.value)}>{CONDITIONS.map(c => <option key={c}>{c}</option>)}</select></label><label className="field">Quantidade<input type="number" min={1} step={1} value={piece.quantity} onChange={e => field('quantity', Number(e.target.value))} /></label></div>
        <label className="field full">Observações<textarea rows={2} value={piece.notes} onChange={e => field('notes', e.target.value)} placeholder="Detalhes sobre esta peça..." /></label>
      </div>
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