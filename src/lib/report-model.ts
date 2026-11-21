export const MAX_IMAGE_WIDTH = 1280;
export const IMAGE_QUALITY = 0.8;
import { DEFAULT_DECISIONS } from './inspection-settings';
export const CONDITIONS = DEFAULT_DECISIONS;
export type Condition = string;
export const SEVERITIES = ['Leve', 'Moderado', 'Crítico'] as const;
export type Severity = (typeof SEVERITIES)[number];
export interface PiecePhoto { id: string; data: string; caption: string; width: number; height: number }
export interface Issue { id: string; description: string; severity: Severity }
export interface Segment { id: string; name: string; prefix: string; color: string }
export interface PlanSheet { id: string; name: string; data: string; width: number; height: number }
/** Position on a plan sheet, x/y as fractions (0–1) of the sheet size. */
export interface PlanMarker { planId: string; x: number; y: number }
export interface Piece { marker?: PlanMarker | null; id: string; segmentId: string; code: string; name: string; location: string; condition: Condition; quantity: number; notes: string; issues: Issue[]; photos: PiecePhoto[] }
export interface Logo { data: string; width: number; height: number }
export const DEFAULT_APP_NAME = 'Relatórios da estrutura metálica';
export interface Report { id?: string; appName: string; title: string; client: string; date: string; responsible: string; notes: string; footer: string; logo: Logo | null; plans: PlanSheet[]; segments: Segment[]; pieces: Piece[] }

export const DEFAULT_SEGMENTS: Segment[] = [
  { id: 'seg-pilares', name: 'Pilares', prefix: 'PL', color: '#2059d2' },
  { id: 'seg-tesouras', name: 'Tesouras', prefix: 'TS', color: '#0f8a6a' },
  { id: 'seg-tercas', name: 'Terças', prefix: 'TR', color: '#b7791f' },
  { id: 'seg-viga-painel', name: 'Viga painel', prefix: 'VP', color: '#7c3aed' },
  { id: 'seg-vigas', name: 'Vigas', prefix: 'VG', color: '#c2410c' },
  { id: 'seg-contraventamento', name: 'Contraventamento', prefix: 'CT', color: '#be123c' },
  { id: 'seg-calhas', name: 'Calhas', prefix: 'CL', color: '#0e7490' },
  { id: 'seg-outros', name: 'Outros', prefix: 'OU', color: '#4b5563' },
];
export function emptyReport(): Report { return { appName: DEFAULT_APP_NAME, title: '', client: '', date: '', responsible: '', notes: '', footer: '', logo: null, plans: [], segments: structuredClone(DEFAULT_SEGMENTS), pieces: [] }; }
/** Fills in fields added after the first version so previously saved reports keep working. */
export function normalizeReport(stored: Partial<Report>): Report {
  const base = emptyReport();
  const segments = stored.segments?.length ? stored.segments : base.segments;
  const fallback = segments.find(s => s.name === 'Outros')?.id ?? segments[segments.length - 1]!.id;
  const plans = stored.plans ?? [];
  return { ...base, ...stored, appName: stored.appName ?? base.appName, segments, plans, pieces: (stored.pieces ?? []).map(p => ({ ...p, marker: p.marker && plans.some(pl => pl.id === p.marker!.planId) ? p.marker : null, segmentId: p.segmentId && segments.some(s => s.id === p.segmentId) ? p.segmentId : fallback, issues: p.issues ?? [] })) };
}
export function shouldInitializeExample(report: Report | undefined, initialized: boolean | undefined): boolean {
  return !initialized && (!report || (!report.title && !report.client && !report.responsible && !report.notes && report.pieces.length === 0));
}
export function newPiece(segmentId = ''): Piece { return { id: crypto.randomUUID(), segmentId, code: '', name: '', location: '', condition: 'Aprovado', quantity: 1, notes: '', issues: [], photos: [] }; }
export function validatePiece(piece: Piece): string | null {
  if (!piece.segmentId) return 'Escolha o segmento da peça.';
  if (!piece.code.trim()) return 'Informe o código da peça.';
  if (!Number.isInteger(piece.quantity) || piece.quantity < 1) return 'A quantidade deve ser um número inteiro maior que zero.';
  return null;
}
const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
export function naturalCompare(a: string, b: string) { return collator.compare(a, b); }
export function nextCode(prefix: string, pieces: Piece[], ignoreId?: string) {
  const used = new Set(pieces.filter(p => p.id !== ignoreId).map(p => p.code.trim().toUpperCase()));
  const clean = prefix.trim().toUpperCase();
  for (let n = 1; ; n++) { const code = `${clean}-${String(n).padStart(3, '0')}`; if (!used.has(code)) return code; }
}
export function isDuplicateCode(code: string, pieces: Piece[], ignoreId?: string) {
  const value = code.trim().toUpperCase();
  return !!value && pieces.some(p => p.id !== ignoreId && p.code.trim().toUpperCase() === value);
}
export interface ReportFilter { segmentIds: string[] | null; onlyProblems: boolean }
export const hasProblem = (p: Piece) => p.issues.length > 0;
export const hasCritical = (p: Piece) => p.issues.some(i => i.severity === 'Crítico');
export interface SegmentGroup { segment: Segment; pieces: Piece[] }
/** Segments in configured order, empty ones omitted, pieces sorted naturally by code. */
export function groupBySegment(report: Report, filter: ReportFilter = { segmentIds: null, onlyProblems: false }): SegmentGroup[] {
  return report.segments
    .filter(s => !filter.segmentIds || filter.segmentIds.includes(s.id))
    .map(segment => ({ segment, pieces: report.pieces.filter(p => p.segmentId === segment.id && (!filter.onlyProblems || hasProblem(p))).sort((a, b) => naturalCompare(a.code, b.code)) }))
    .filter(g => g.pieces.length > 0);
}
export function countSeverity(pieces: Piece[]) {
  const out: Record<Severity, number> = { Leve: 0, Moderado: 0, 'Crítico': 0 };
  for (const p of pieces) for (const i of p.issues) out[i.severity]++;
  return out;
}
export function segmentStats(pieces: Piece[]) {
  const conditions: Record<string, number> = {};
  for (const p of pieces) conditions[p.condition] = (conditions[p.condition] ?? 0) + 1;
  return { pieces: pieces.length, units: pieces.reduce((n, p) => n + p.quantity, 0), conditions, severities: countSeverity(pieces), withProblem: pieces.filter(hasProblem).length };
}
export interface IssueRow { severity: Severity; segment: string; code: string; name: string; location: string; description: string }
export function consolidatedIssues(groups: SegmentGroup[]): IssueRow[] {
  const rows: (IssueRow & { order: number })[] = [];
  groups.forEach((g, order) => g.pieces.forEach(p => p.issues.forEach(i => rows.push({ order, severity: i.severity, segment: g.segment.name, code: p.code, name: p.name, location: p.location, description: i.description }))));
  return rows.sort((a, b) => SEVERITIES.indexOf(b.severity) - SEVERITIES.indexOf(a.severity) || a.order - b.order || naturalCompare(a.code, b.code)).map(({ order: _o, ...r }) => r);
}
export function criticalBySegment(groups: SegmentGroup[]) {
  return groups.map(g => ({ segment: g.segment, pieces: g.pieces.filter(p => p.issues.some(i => i.severity === 'Crítico')) })).filter(g => g.pieces.length);
}
export function imageDimensions(width: number, height: number, max = MAX_IMAGE_WIDTH) {
  const scale = Math.min(1, max / width);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items;
  const next = [...items]; const removed = next.splice(from, 1); next.splice(to, 0, ...removed); return next;
}
export function formatDate(value: string) { return value ? value.split('-').reverse().join('/') : 'Não informada'; }
export async function compressPhoto(file: File, max = MAX_IMAGE_WIDTH): Promise<PiecePhoto> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione apenas imagens.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const { width, height } = imageDimensions(image.naturalWidth, image.naturalHeight, max);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Não foi possível processar a imagem.');
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, width, height); ctx.drawImage(image, 0, 0, width, height);
    return { id: crypto.randomUUID(), data: canvas.toDataURL('image/jpeg', IMAGE_QUALITY), caption: '', width, height };
  } finally { URL.revokeObjectURL(url); }
}
export function piecesOnPlan(pieces: Piece[], planId: string) { return pieces.filter(p => p.marker?.planId === planId).sort((a, b) => naturalCompare(a.code, b.code)); }
export function removePlan(report: Report, planId: string): Report { return { ...report, plans: report.plans.filter(p => p.id !== planId), pieces: report.pieces.map(p => p.marker?.planId === planId ? { ...p, marker: null } : p) }; }
export function clampMarker(x: number, y: number) { const c = (v: number) => Math.min(1, Math.max(0, v)); return { x: c(x), y: c(y) }; }

/** Numbers every photo in the order it appears in the report, so the preview, the PDF and the Word agree. */
export function figureNumbers(pieces: Piece[]) {
  const numbers = new Map<string, number>();
  for (const p of pieces) for (const photo of p.photos) numbers.set(photo.id, numbers.size + 1);
  return numbers;
}
export const figureNumber = (n: number) => `Figura ${String(n).padStart(2, '0')}`;
export const figureLabel = (n: number, caption?: string) => { const text = caption?.trim(); return text ? `${figureNumber(n)}: ${text}` : figureNumber(n); };
