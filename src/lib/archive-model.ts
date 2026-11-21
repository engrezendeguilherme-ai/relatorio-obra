import type { SavedReport } from './correction-model';
import type { Report } from './report-model';

const clean = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
export function sameReport(a: Report, b: Report) {
  if (a.id && b.id) return a.id === b.id;
  return !!clean(a.title) && clean(a.title) === clean(b.title) && clean(a.client) === clean(b.client) && a.date === b.date;
}
export function updateArchive(list: SavedReport[], incoming: SavedReport) {
  const previous = [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).find(s => s.id === incoming.report.id || sameReport(s.report, incoming.report));
  const id = previous?.id ?? incoming.id;
  const saved = { ...incoming, id, report: { ...structuredClone(incoming.report), id } };
  return { saved, previous, reports: [saved, ...list.filter(s => s.id !== id)] };
}