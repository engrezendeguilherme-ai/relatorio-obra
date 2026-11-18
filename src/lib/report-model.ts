export const MAX_IMAGE_WIDTH = 1600;
export const IMAGE_QUALITY = 0.8;
export const CONDITIONS = ['Boa', 'Regular', 'Ruim', 'Danificada'] as const;
export type Condition = (typeof CONDITIONS)[number];
export interface PiecePhoto { id: string; data: string; caption: string; width: number; height: number }
export interface Piece { id: string; code: string; name: string; location: string; condition: Condition; quantity: number; notes: string; photos: PiecePhoto[] }
export interface Report { title: string; client: string; date: string; responsible: string; notes: string; pieces: Piece[] }
export function emptyReport(): Report { return { title: '', client: '', date: '', responsible: '', notes: '', pieces: [] }; }
export function shouldInitializeExample(report: Report | undefined, initialized: boolean | undefined): boolean {
  return !initialized && (!report || (!report.title && !report.client && !report.responsible && !report.notes && report.pieces.length === 0));
}
export function newPiece(): Piece { return { id: crypto.randomUUID(), code: '', name: '', location: '', condition: 'Boa', quantity: 1, notes: '', photos: [] }; }
export function validatePiece(piece: Piece): string | null {
  if (!piece.code.trim()) return 'Informe o código da peça.';
  if (!Number.isInteger(piece.quantity) || piece.quantity < 1) return 'A quantidade deve ser um número inteiro maior que zero.';
  return null;
}
export function imageDimensions(width: number, height: number) {
  const scale = Math.min(1, MAX_IMAGE_WIDTH / width);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return items;
  const next = [...items]; const removed = next.splice(from, 1); next.splice(to, 0, ...removed); return next;
}
export function formatDate(value: string) { return value ? value.split('-').reverse().join('/') : 'Não informada'; }
export async function compressPhoto(file: File): Promise<PiecePhoto> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione apenas imagens.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const { width, height } = imageDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Não foi possível processar a imagem.');
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, width, height); ctx.drawImage(image, 0, 0, width, height);
    return { id: crypto.randomUUID(), data: canvas.toDataURL('image/jpeg', IMAGE_QUALITY), caption: '', width, height };
  } finally { URL.revokeObjectURL(url); }
}