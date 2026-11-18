import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Boxes, Camera, Download, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useArchive } from '@/hooks/use-archive';
import { CORRECTION_STATUSES, correctionRows, correctionStats, emptyCorrection, itemOf, type Correction, type CorrectionItem } from '@/lib/correction-model';
import { compressPhoto, formatDate } from '@/lib/report-model';

export const Route = createFileRoute('/correcao/$id')({
  head: () => ({ meta: [
    { title: 'Registro de correções | Relatórios da estrutura metálica' },
    { name: 'description', content: 'Registre foto e observação da correção de cada apontamento e gere o relatório de correções.' },
    { property: 'og:title', content: 'Registro de correções' },
    { property: 'og:description', content: 'Fotos e observações das correções de cada apontamento.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }), component: CorrectionPage,
});

function CorrectionPage() {
  const { id } = Route.useParams();
  const { reports, corrections, ready, saveCorrection } = useArchive();
  const saved = reports.find(r => r.id === id);
  const [c, setC] = useState<Correction | null>(null);
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);
  useEffect(() => { if (ready && !loaded.current) { loaded.current = true; setC(corrections[id] ?? { ...emptyCorrection(id), date: new Date().toLocaleDateString('sv-SE') }); } }, [ready, corrections, id]);
  useEffect(() => { if (c && loaded.current) { const t = setTimeout(() => void saveCorrection(c), 300); return () => clearTimeout(t); } return undefined; }, [c, saveCorrection]);
  const header = <header className="app-header"><div className="header-inner"><div className="brand"><div className="brand-symbol"><Boxes strokeWidth={1.7} /></div><div><div className="brand-name">Relatórios da estrutura metálica</div><div className="brand-subtitle">Registro de correções</div></div></div><Button asChild variant="outline" size="sm"><Link to="/relatorios"><ArrowLeft />Relatórios salvos</Link></Button></div></header>;
  if (!ready || !c) return <>{header}<main className="workspace"><Loader2 className="animate-spin" /></main></>;
  if (!saved) return <>{header}<main className="workspace"><h1 className="text-2xl font-bold">Relatório não encontrado</h1><p className="mt-2 text-muted-foreground">Ele pode ter sido excluído deste aparelho.</p></main></>;
  const report = saved.report;
  const rows = correctionRows(report, c); const st = correctionStats(rows);
  const setItem = (issueId: string, patch: Partial<CorrectionItem>) => setC(prev => prev && ({ ...prev, items: { ...prev.items, [issueId]: { ...itemOf(prev, issueId), ...patch } } }));
  async function addPhotos(issueId: string, files: FileList | null) {
    if (!files?.length) return;
    try { const photos = await Promise.all([...files].map(f => compressPhoto(f))); setC(prev => prev && ({ ...prev, items: { ...prev.items, [issueId]: { ...itemOf(prev, issueId), photos: [...itemOf(prev, issueId).photos, ...photos], status: 'Corrigido' } } })); }
    catch { toast.error('Não foi possível abrir a imagem. Use JPG, PNG ou WebP.'); }
  }
  async function exportPdf() {
    setBusy(true);
    try { const [{ generateCorrectionPdf }, { deliverFile, filename }] = await Promise.all([import('@/lib/correction-export'), import('@/lib/report-export')]); const blob = await generateCorrectionPdf(report, c!); await deliverFile(blob, filename(report, 'pdf').replace(/\.pdf$/, '-correcoes.pdf')); }
    catch (e) { console.error(e); toast.error('Não foi possível gerar o PDF. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <>{header}<main className="workspace">
    <div className="page-heading"><div><h1>{report.title || 'Relatório sem título'}</h1><p>{report.client || 'Local não informado'} · Vistoria {formatDate(report.date)}</p></div><Button size="lg" disabled={busy || !rows.length} onClick={() => void exportPdf()}>{busy ? <Loader2 className="animate-spin" /> : <Download />}Gerar PDF de correções</Button></div>
    <div className="correction-stats"><div><strong>{st.total}</strong>Apontamentos</div><div className="ok"><strong>{st.Corrigido}</strong>Corrigidos</div><div className="pending"><strong>{st.Pendente}</strong>Pendentes</div><div><strong>{st['Não se aplica']}</strong>Não se aplica</div></div>
    <div className="form-grid mb-8"><label className="field">Responsável pelas correções<input value={c.responsible} onChange={e => setC({ ...c, responsible: e.target.value })} placeholder="Nome do responsável" /></label><label className="field">Data das correções<input type="date" value={c.date} onChange={e => setC({ ...c, date: e.target.value })} /></label><label className="field full">Observações gerais<textarea rows={2} value={c.notes} onChange={e => setC({ ...c, notes: e.target.value })} placeholder="Opcional" /></label></div>
    {!rows.length && <p className="text-muted-foreground">Este relatório não tem apontamentos para corrigir.</p>}
    <div className="correction-list">{rows.map(r => <article key={r.issueId} className={`correction-card status-${r.item.status === 'Corrigido' ? 'ok' : r.item.status === 'Pendente' ? 'pending' : 'na'}`}>
      <div className="correction-head"><div><h3>{r.code}{r.name ? ` — ${r.name}` : ''}</h3><p><span className="segment-tag" style={{ background: r.color }}>{r.segment}</span> <span className={`severity ${r.severity === 'Crítico' ? 'critico' : r.severity.toLowerCase()}`}>{r.severity}</span>{r.location ? ` · ${r.location}` : ''}</p><p className="correction-problem"><strong>Problema:</strong> {r.description || 'Sem descrição'}</p></div>
        <select aria-label={`Situação de ${r.code}`} value={r.item.status} onChange={e => setItem(r.issueId, { status: e.target.value as CorrectionItem['status'] })}>{CORRECTION_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
      <div className="correction-body">
        <div><div className="eyebrow">Antes</div>{r.originalPhotos[0] ? <img src={r.originalPhotos[0].data} alt={`Antes — ${r.code}`} /> : <div className="no-photo">Sem foto original</div>}</div>
        <div><div className="eyebrow">Depois</div>
          <div className="after-photos">{r.item.photos.map(p => <div key={p.id} className="after-photo"><img src={p.data} alt={`Depois — ${r.code}`} /><Button variant="secondary" size="icon" aria-label="Remover foto" onClick={() => setItem(r.issueId, { photos: r.item.photos.filter(x => x.id !== p.id) })}><Trash2 /></Button></div>)}</div>
          <label className="add-photo"><Camera size={18} />Adicionar foto da correção<input type="file" accept="image/*" multiple className="sr-only" onChange={e => { void addPhotos(r.issueId, e.target.files); e.target.value = ''; }} /></label>
          <label className="field mt-3">Observação da correção<textarea rows={2} value={r.item.note} onChange={e => setItem(r.issueId, { note: e.target.value })} placeholder="Ex.: Base lixada, tratada e repintada." /></label>
          <label className="field mt-3">Data<input type="date" value={r.item.date} onChange={e => setItem(r.issueId, { date: e.target.value })} /></label>
        </div>
      </div>
    </article>)}</div>
  </main></>;
}
