import { useEffect, useState } from 'react';
import { Boxes, Eye, Map, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportPreview } from './report-preview';
import { PlanBoard } from './plan-board';
import { figureLabel, figureNumbers, groupBySegment, type Piece, type Report } from '@/lib/report-model';
import type { TocEntry } from '@/lib/report-export';

export function ReportReader({ report }: { report: Report }) {
  const [view, setView] = useState('lista');
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [plan, setPlan] = useState('');
  const [selected, setSelected] = useState<Piece | null>(null);
  const [toc, setToc] = useState<TocEntry[] | null>(null);
  const numbers = figureNumbers(groupBySegment(report).flatMap(g => g.pieces));
  const pieces = report.pieces.filter(p => (!segment || p.segmentId === segment) && `${p.code} ${p.name} ${p.location}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
  useEffect(() => {
    if (view !== 'relatorio') return;
    let active = true;
    void import('@/lib/report-export').then(m => m.buildPdf(report, { segmentIds: null, onlyProblems: false })).then(r => { if (active) setToc(r.toc); }).catch(() => {});
    return () => { active = false; };
  }, [view, report]);
  const detail = (p: Piece) => <section className="report-paper piece-paper mt-4" aria-label={`Detalhes de ${p.code}`}>
    <h2>{p.code} — {p.name}</h2><p className="mb-4 text-sm">{p.condition} · {p.location || 'Setor não informado'} · Quantidade {p.quantity}</p>
    {p.notes && <p className="mb-4 whitespace-pre-wrap text-sm">{p.notes}</p>}
    {p.issues.map(i => <p key={i.id} className="mb-2 text-sm"><b>{i.severity}</b> — {i.description}</p>)}
    <div className="paper-photos mt-4">{p.photos.map(f => <figure key={f.id}><img src={f.data} alt={f.caption || p.code} /><figcaption>{figureLabel(numbers.get(f.id) ?? 1, f.caption)}</figcaption></figure>)}</div>
    <Button variant="outline" onClick={() => setSelected(null)}>Fechar detalhes</Button>
  </section>;
  return <>
    <nav className="flex flex-wrap gap-2 mb-6" aria-label="Consulta do relatório">
      <Button variant={view === 'lista' ? 'default' : 'outline'} onClick={() => { setView('lista'); setSelected(null); }}><Boxes />Lista de peças</Button>
      <Button variant={view === 'planta' ? 'default' : 'outline'} disabled={!report.plans.length} onClick={() => { setView('planta'); setSelected(null); }}><Map />Na planta</Button>
      <Button variant={view === 'relatorio' ? 'default' : 'outline'} onClick={() => { setView('relatorio'); setSelected(null); }}><Eye />Visualizar relatório</Button>
    </nav>
    {view === 'relatorio' ? <ReportPreview report={report} toc={toc} /> : <>
      <div className="grid gap-3 sm:grid-cols-2 mb-5"><div className="search-field"><Search /><input aria-label="Buscar peças" placeholder="Código, descrição ou setor" value={search} onChange={e => setSearch(e.target.value)} /></div><select aria-label="Segmento" value={segment} onChange={e => setSegment(e.target.value)}><option value="">Todos os segmentos</option>{report.segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      {view === 'planta' ? <PlanBoard plans={report.plans} pieces={pieces} segments={report.segments} planId={plan} onPlanChange={id => { setPlan(id); setSelected(null); }} onSelect={setSelected} /> : <div className="piece-list">{pieces.map(p => <article key={p.id} className="piece-row">{p.photos[0] && <img className="piece-thumb" src={p.photos[0].data} alt={p.code} />}<div className="piece-detail"><h3>{p.code}</h3><p>{p.name}</p><div className="piece-meta"><span>{p.condition}</span><span>{p.location}</span><span>{p.photos.length} fotos · {p.issues.length} apontamentos</span></div></div><Button variant="outline" size="sm" onClick={() => setSelected(p)}><Eye />Ver peça</Button></article>)}</div>}
      {!pieces.length && <p className="text-muted-foreground">Nenhuma peça encontrada.</p>}
      {selected && detail(selected)}
    </>}
  </>;
}