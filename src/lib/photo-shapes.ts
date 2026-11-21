import type { PhotoShape, PiecePhoto, ShapeKind } from './report-model';

export const SHAPE_COLORS = [
  { name: 'Vermelho', value: '#dc2626' },
  { name: 'Amarelo', value: '#facc15' },
  { name: 'Azul', value: '#2563eb' },
] as const;
export const DEFAULT_SHAPE_COLOR: string = SHAPE_COLORS[0].value;
/** Smallest drag (as a fraction of the photo) that counts as a marking, so a stray tap does not add one. */
export const MIN_SHAPE_SIZE = 0.02;

type Point = { x: number; y: number };
const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function buildShape(kind: ShapeKind, color: string, from: Point, to: Point, id: string = crypto.randomUUID()): PhotoShape {
  return { id, kind, color, x1: clamp(from.x), y1: clamp(from.y), x2: clamp(to.x), y2: clamp(to.y) };
}
export function isMeaningfulShape(s: PhotoShape) {
  const dx = Math.abs(s.x2 - s.x1), dy = Math.abs(s.y2 - s.y1);
  return s.kind === 'circle' ? dx >= MIN_SHAPE_SIZE && dy >= MIN_SHAPE_SIZE : Math.hypot(dx, dy) >= MIN_SHAPE_SIZE;
}
/** Line thickness in image pixels, proportional to the photo so markings read the same at any resolution. */
export const strokeWidth = (w: number, h: number) => Math.max(4, Math.max(w, h) * 0.007);

export function ellipseOf(s: PhotoShape, w: number, h: number) {
  return { cx: ((s.x1 + s.x2) / 2) * w, cy: ((s.y1 + s.y2) / 2) * h, rx: (Math.abs(s.x2 - s.x1) / 2) * w, ry: (Math.abs(s.y2 - s.y1) / 2) * h };
}
/** Shaft from the tail to the base of the head, plus the head triangle ("tip left right"). */
export function arrowOf(s: PhotoShape, w: number, h: number) {
  const x1 = s.x1 * w, y1 = s.y1 * h, x2 = s.x2 * w, y2 = s.y2 * h;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const head = Math.min(strokeWidth(w, h) * 5, len * 0.6), half = head * 0.5;
  const px = -uy, py = ux;
  const tip = { x: x2, y: y2 };
  const left = { x: x2 - ux * head + px * half, y: y2 - uy * head + py * half };
  const right = { x: x2 - ux * head - px * half, y: y2 - uy * head - py * half };
  return { x1, y1, bx: x2 - ux * head * 0.8, by: y2 - uy * head * 0.8, tip, left, right, points: `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}` };
}

/** Draws markings on a canvas of the photo's size: a white outline first, then the colour, so they read on any background. */
export function drawShapes(ctx: CanvasRenderingContext2D, w: number, h: number, shapes: PhotoShape[]) {
  const sw = strokeWidth(w, h);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const outline of [true, false]) for (const s of shapes) {
    ctx.strokeStyle = ctx.fillStyle = outline ? 'rgba(255,255,255,0.92)' : s.color;
    ctx.lineWidth = outline ? sw * 1.9 : sw;
    if (s.kind === 'circle') {
      const e = ellipseOf(s, w, h);
      ctx.beginPath(); ctx.ellipse(e.cx, e.cy, Math.max(e.rx, 1), Math.max(e.ry, 1), 0, 0, Math.PI * 2); ctx.stroke();
    } else {
      const a = arrowOf(s, w, h);
      ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.bx, a.by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(a.tip.x, a.tip.y); ctx.lineTo(a.left.x, a.left.y); ctx.lineTo(a.right.x, a.right.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
}

const cache = new Map<string, Promise<string>>();
async function bake(photo: PiecePhoto): Promise<string> {
  const img = new Image();
  if (!photo.data.startsWith('data:')) img.crossOrigin = 'anonymous';
  img.src = photo.data; await img.decode();
  const w = img.naturalWidth || photo.width, h = img.naturalHeight || photo.height;
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('canvas');
  ctx.drawImage(img, 0, 0, w, h); drawShapes(ctx, w, h, photo.shapes ?? []);
  return canvas.toDataURL('image/jpeg', 0.9);
}
/** The photo with its markings burned in (for screen and for PDF/Word). Without markings, or if drawing fails, the original is returned. */
export function annotatedData(photo: PiecePhoto): Promise<string> {
  if (!photo.shapes?.length) return Promise.resolve(photo.data);
  const key = `${photo.id}|${photo.data.length}|${JSON.stringify(photo.shapes)}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = bake(photo).catch(() => photo.data);
    cache.set(key, pending);
    if (cache.size > 80) cache.delete(cache.keys().next().value!);
  }
  return pending;
}
/** photo id → annotated data, only for photos that have markings. Exports look photos up here and fall back to photo.data. */
export async function annotatedMap(photos: PiecePhoto[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(photos.filter(p => p.shapes?.length).map(async p => { out.set(p.id, await annotatedData(p)); }));
  return out;
}
