// Browser-only helpers: import dynamically from user actions.
import { compressPhoto, type Piece, type PlanSheet, type Segment } from './report-model';

export const PLAN_MAX_WIDTH = 2400;
export async function loadPlanFile(file: File): Promise<PlanSheet[]> {
  const base = file.name.replace(/\.[^.]+$/, '');
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist');
    const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const out: PlanSheet[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, 20); n++) {
      const page = await doc.getPage(n);
      const v1 = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(4, PLAN_MAX_WIDTH / v1.width) });
      const canvas = document.createElement('canvas'); canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d')!; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      out.push({ id: crypto.randomUUID(), name: doc.numPages > 1 ? `${base} — folha ${n}` : base, data: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height });
    }
    return out;
  }
  const photo = await compressPhoto(file, PLAN_MAX_WIDTH);
  return [{ id: photo.id, name: base, data: photo.data, width: photo.width, height: photo.height }];
}

/** Plan image with numbered code markers drawn on it, for PDF and Word. */
export async function planWithMarkers(plan: PlanSheet, pieces: Piece[], segments: Segment[]): Promise<string> {
  const img = new Image(); img.src = plan.data; await img.decode();
  const canvas = document.createElement('canvas'); canvas.width = plan.width; canvas.height = plan.height;
  const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
  const r = Math.max(14, plan.width / 65); ctx.font = `bold ${Math.round(r * 1.1)}px Arial`; ctx.textBaseline = 'middle';
  // Critical pieces are drawn last (on top), in red, with a halo and "!" so they stand out in print.
  const critical = (p: Piece) => p.issues.some(i => i.severity === 'Crítico');
  for (const p of [...pieces].sort((a, b) => Number(critical(a)) - Number(critical(b)))) {
    if (!p.marker) continue;
    const x = p.marker.x * plan.width, y = p.marker.y * plan.height;
    const crit = critical(p);
    const color = crit ? '#dc2626' : segments.find(s => s.id === p.segmentId)?.color ?? '#2059d2';
    const label = crit ? `! ${p.code}` : p.code;
    if (crit) { ctx.fillStyle = 'rgba(220, 38, 38, 0.28)'; ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = color; ctx.strokeStyle = 'white'; ctx.lineWidth = r * 0.25;
    ctx.beginPath(); ctx.arc(x, y, r * (crit ? 0.75 : 0.55), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const w = ctx.measureText(label).width + r;
    const lx = x + r * (crit ? 0.9 : 0.7);
    ctx.fillRect(lx, y - r * 0.75, w, r * 1.5); ctx.strokeRect(lx, y - r * 0.75, w, r * 1.5);
    ctx.fillStyle = 'white'; ctx.fillText(label, lx + r * 0.5, y + 1);
  }
  return canvas.toDataURL('image/jpeg', 0.85);
}
