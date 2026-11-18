import { consolidatedIssues, groupBySegment, naturalCompare, SEVERITIES, type PiecePhoto, type Report, type Severity } from './report-model';

export const CORRECTION_STATUSES = ['Pendente', 'Corrigido', 'Não se aplica'] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];
export interface SavedReport { id: string; savedAt: string; report: Report }
export interface CorrectionItem { status: CorrectionStatus; note: string; date: string; photos: PiecePhoto[] }
export interface Correction { reportId: string; responsible: string; date: string; notes: string; items: Record<string, CorrectionItem> }

export function snapshot(report: Report, now = new Date()): SavedReport {
  return { id: crypto.randomUUID(), savedAt: now.toISOString(), report: structuredClone(report) };
}
export function emptyCorrection(reportId: string): Correction { return { reportId, responsible: '', date: '', notes: '', items: {} }; }
export function itemOf(c: Correction, issueId: string): CorrectionItem { return c.items[issueId] ?? { status: 'Pendente', note: '', date: '', photos: [] }; }

export interface CorrectionRow { issueId: string; severity: Severity; segment: string; color: string; code: string; name: string; location: string; description: string; originalPhotos: PiecePhoto[]; item: CorrectionItem }
/** Every issue of the original report, most severe first, then segment order and code. */
export function correctionRows(report: Report, c: Correction): CorrectionRow[] {
  const rows: (CorrectionRow & { order: number })[] = [];
  groupBySegment(report).forEach((g, order) => g.pieces.forEach(p => p.issues.forEach(i => rows.push({ order, issueId: i.id, severity: i.severity, segment: g.segment.name, color: g.segment.color, code: p.code, name: p.name, location: p.location, description: i.description, originalPhotos: p.photos, item: itemOf(c, i.id) }))));
  return rows.sort((a, b) => SEVERITIES.indexOf(b.severity) - SEVERITIES.indexOf(a.severity) || a.order - b.order || naturalCompare(a.code, b.code)).map(({ order: _o, ...r }) => r);
}
export function correctionStats(rows: CorrectionRow[]) {
  const out: Record<CorrectionStatus, number> = { Pendente: 0, Corrigido: 0, 'Não se aplica': 0 };
  for (const r of rows) out[r.item.status]++;
  return { total: rows.length, ...out };
}
export const issueCount = (report: Report) => consolidatedIssues(groupBySegment(report)).length;
