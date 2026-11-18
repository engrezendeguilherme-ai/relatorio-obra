import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowLeft, Boxes, ClipboardCheck, FolderOpen, Trash2, Wrench } from 'lucide-react';
import { set } from 'idb-keyval';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useArchive } from '@/hooks/use-archive';
import { correctionRows, correctionStats, emptyCorrection, issueCount } from '@/lib/correction-model';
import { formatDate } from '@/lib/report-model';

export const Route = createFileRoute('/relatorios')({
  head: () => ({ meta: [
    { title: 'Relatórios salvos | Relatórios da estrutura metálica' },
    { name: 'description', content: 'Consulte relatórios de vistoria salvos e registre as correções de cada apontamento.' },
    { property: 'og:title', content: 'Relatórios salvos' },
    { property: 'og:description', content: 'Relatórios de vistoria salvos e acompanhamento das correções.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }), component: SavedReports,
});

function SavedReports() {
  const { reports, corrections, ready, saveReports, removeCorrection } = useArchive();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'open'; id: string } | null>(null);
  const target = reports.find(r => r.id === confirm?.id);
  async function act() {
    if (!confirm || !target) return;
    if (confirm.kind === 'delete') { await saveReports(reports.filter(r => r.id !== confirm.id)); await removeCorrection(confirm.id); toast.success('Relatório excluído'); setConfirm(null); }
    else { await set('peca-a-peca-report-v1', structuredClone(target.report)); toast.success('Relatório aberto na área de trabalho'); void navigate({ to: '/' }); }
  }
  return <>
    <header className="app-header"><div className="header-inner"><div className="brand"><div className="brand-symbol"><Boxes strokeWidth={1.7} /></div><div><div className="brand-name">Relatórios da estrutura metálica</div><div className="brand-subtitle">Relatórios salvos</div></div></div><Button asChild variant="outline" size="sm"><Link to="/"><ArrowLeft />Área de trabalho</Link></Button></div></header>
    <main className="workspace">
      <div className="page-heading"><div><h1>Relatórios salvos</h1><p>Escolha um relatório para registrar as correções de cada apontamento.</p></div></div>
      {ready && !reports.length && <div className="archive-empty"><FolderOpen size={32} /><p>Nenhum relatório salvo ainda.</p><p className="text-sm text-muted-foreground">Na área de trabalho, use “Salvar relatório” para guardar uma cópia aqui.</p></div>}
      <div className="archive-list">{reports.map(s => {
        const c = corrections[s.id]; const st = correctionStats(correctionRows(s.report, c ?? emptyCorrection(s.id))); const total = issueCount(s.report);
        return <article className="archive-card" key={s.id}>
          <div className="min-w-0 flex-1"><h3>{s.report.title || 'Relatório sem título'}</h3><p>{s.report.client || 'Local não informado'} · Vistoria {formatDate(s.report.date)}</p><p className="archive-meta">{s.report.pieces.length} peças · {total} apontamentos{c ? ` · ${st.Corrigido} corrigidos, ${st.Pendente} pendentes` : ''} · Salvo em {new Date(s.savedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p></div>
          <div className="archive-actions">
            <Button asChild disabled={!total}><Link to="/correcao/$id" params={{ id: s.id }}>{c ? <ClipboardCheck /> : <Wrench />}{c ? 'Continuar correções' : 'Registrar correções'}</Link></Button>
            <Button variant="outline" onClick={() => setConfirm({ kind: 'open', id: s.id })}><FolderOpen />Abrir</Button>
            <Button variant="ghost" size="icon" aria-label="Excluir relatório" title="Excluir relatório" onClick={() => setConfirm({ kind: 'delete', id: s.id })}><Trash2 /></Button>
          </div>
        </article>; })}</div>
    </main>
    <Dialog open={!!confirm} onOpenChange={o => { if (!o) setConfirm(null); }}><DialogContent><DialogHeader><DialogTitle>{confirm?.kind === 'delete' ? 'Excluir este relatório salvo?' : 'Abrir na área de trabalho?'}</DialogTitle><DialogDescription>{confirm?.kind === 'delete' ? 'O relatório e as correções registradas nele serão apagados deste aparelho.' : 'O relatório que está na área de trabalho agora será substituído por esta cópia. Salve-o antes se quiser mantê-lo.'}</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirm(null)}>Cancelar</Button><Button variant={confirm?.kind === 'delete' ? 'destructive' : 'default'} onClick={() => void act()}>{confirm?.kind === 'delete' ? 'Excluir' : 'Abrir'}</Button></div></DialogContent></Dialog>
  </>;
}
