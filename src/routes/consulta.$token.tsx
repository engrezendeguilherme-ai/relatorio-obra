import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { readSharedReport } from '@/lib/sharing.functions';
import { validShareToken } from '@/lib/share-model';
import { ReportReader } from '@/components/report-reader';
const reportQuery = (token: string) => queryOptions({ queryKey: ['shared-report', token], queryFn: () => validShareToken(token) ? readSharedReport({ data: { token } }) : Promise.resolve(null), staleTime: 0, gcTime: 0 });
export const Route = createFileRoute('/consulta/$token')({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(reportQuery(params.token)),
  head: () => ({ meta: [
    { title: 'Consulta de vistoria | Relatórios da estrutura metálica' },
    { name: 'description', content: 'Consulta autorizada de peças, plantas e relatório de vistoria.' },
    { property: 'og:title', content: 'Consulta de vistoria — Estrutura metálica' },
    { property: 'og:description', content: 'Relatório compartilhado para consulta de peças e plantas.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex, nofollow, noarchive' }, { name: 'referrer', content: 'no-referrer' },
  ] }),
  errorComponent: () => <main className="workspace"><h1>Consulta indisponível</h1><p>Não foi possível abrir o relatório. Verifique a conexão e tente novamente.</p></main>,
  notFoundComponent: () => <main className="workspace"><h1>Link indisponível</h1></main>,
  component: SharedReport,
});
function SharedReport() {
  const { token } = Route.useParams();
  const { data: report } = useSuspenseQuery(reportQuery(token));
  if (!report) return <main className="workspace"><h1>Link indisponível</h1><p>O link foi desativado ou o relatório não está mais disponível.</p></main>;
  return <><header className="app-header"><div className="header-inner"><div className="brand"><div><div className="brand-name">{report.appName}</div><div className="brand-subtitle">Somente leitura</div></div></div></div></header><main className="workspace"><div className="page-heading"><div><h1>{report.title || 'Relatório de vistoria'}</h1><p>{report.client} · {report.pieces.length} peças</p></div></div><ReportReader report={report} /></main></>;
}