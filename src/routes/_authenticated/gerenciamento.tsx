import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Plus, Save, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useInspectionSettings } from '@/hooks/use-inspection-settings';
import { moveItem } from '@/lib/report-model';
import { validateDecisions } from '@/lib/inspection-settings';

export const Route = createFileRoute('/_authenticated/gerenciamento')({
  head: () => ({ meta: [
    { title: 'Gerenciamento | Relatórios da estrutura metálica' },
    { name: 'description', content: 'Gerencie as opções de avaliação das peças da sua conta.' },
    { property: 'og:title', content: 'Gerenciamento de inspeções | Relatórios da estrutura metálica' },
    { property: 'og:description', content: 'Configurações privadas das avaliações de inspeção.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }), component: Management,
});
function Management() {
  const { settings, ready, error, save } = useInspectionSettings();
  const [decisions, setDecisions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (ready) setDecisions([...settings.decisions]); }, [ready, settings]);
  const validation = validateDecisions(decisions);
  const dirty = JSON.stringify(decisions) !== JSON.stringify(settings.decisions);
  async function submit() {
    setBusy(true);
    try { await save(decisions); toast.success('Configurações protegidas neste aparelho'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  return <><header className="app-header"><div className="header-inner"><div className="brand"><div className="brand-symbol"><Settings /></div><div className="brand-name">Gerenciamento</div></div><Button asChild variant="outline"><Link to="/"><ArrowLeft />Voltar ao relatório</Link></Button></div></header>
    <main className="workspace"><div className="page-heading"><div><h1>Avaliação das peças</h1><p>Configurações da sua conta</p></div></div>
      {error ? <p role="alert" className="form-error">{error}</p> : !ready ? <Loader2 className="animate-spin" /> : <form className="max-w-2xl" onSubmit={e => { e.preventDefault(); void submit(); }}>
        <h2 className="section-title">Opções de avaliação</h2>
        <div className="flex flex-col gap-3">{decisions.map((value, index) => <div key={index} className="flex items-center gap-1"><label className="field min-w-0 flex-1">Opção {index + 1}<input value={value} maxLength={40} onChange={e => setDecisions(previous => previous.map((item, i) => i === index ? e.target.value : item))} /></label><div className="flex shrink-0 pt-5"><Button type="button" size="icon" variant="ghost" title="Mover para cima" aria-label={`Mover opção ${index + 1} para cima`} disabled={index === 0 || busy} onClick={() => setDecisions(moveItem(decisions, index, index - 1))}><ArrowUp /></Button><Button type="button" size="icon" variant="ghost" title="Mover para baixo" aria-label={`Mover opção ${index + 1} para baixo`} disabled={index === decisions.length - 1 || busy} onClick={() => setDecisions(moveItem(decisions, index, index + 1))}><ArrowDown /></Button><Button type="button" size="icon" variant="ghost" title="Remover opção" aria-label={`Remover opção ${index + 1}`} disabled={decisions.length === 1 || busy} onClick={() => setDecisions(decisions.filter((_, i) => i !== index))}><Trash2 /></Button></div></div>)}</div>
        {validation && <p role="alert" className="form-error mt-3">{validation}</p>}
        <div className="dialog-actions flex-wrap"><Button type="button" variant="outline" disabled={busy} onClick={() => setDecisions([...decisions, ''])}><Plus />Adicionar opção</Button><Button type="submit" disabled={!dirty || !!validation || busy}>{busy ? <Loader2 className="animate-spin" /> : <Save />}Salvar configurações</Button></div>
      </form>}
    </main></>;
}