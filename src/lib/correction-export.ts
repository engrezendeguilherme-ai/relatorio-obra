import { formatDate, type PiecePhoto, type Report } from './report-model';
import { correctionRows, correctionStats, type Correction } from './correction-model';

type RGB = [number, number, number];
export async function generateCorrectionPdf(report: Report, c: Correction): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 18, width = 174, bottom = 270;
  const ink: RGB = [35, 47, 62], muted: RGB = [110, 119, 130], blue: RGB = [32, 89, 210];
  const statusColor: Record<string, RGB> = { Pendente: [194, 65, 12], Corrigido: [15, 138, 106], 'Não se aplica': [110, 119, 130] };
  const sevColor: Record<string, RGB> = { Leve: [183, 121, 31], Moderado: [194, 65, 12], 'Crítico': [190, 18, 60] };
  let y = 24;
  const ensure = (h: number) => { if (y + h > bottom) { pdf.addPage(); y = 23; } };
  const text = (v: string, size = 11, bold = false, x = margin, max = width, color: RGB = ink) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(...color);
    for (const line of pdf.splitTextToSize(v, max) as string[]) { ensure(size * .45); pdf.text(line, x, y); y += size * .45 + 1.5; }
  };
  const photo = (p: PiecePhoto | undefined, x: number, w: number, top: number, label: string) => {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...muted); pdf.text(label, x, top);
    if (!p) { pdf.setDrawColor(210, 215, 222); pdf.rect(x, top + 2, w, 50); pdf.setFont('helvetica', 'normal'); pdf.text('Sem foto', x + w / 2, top + 28, { align: 'center' }); return 54; }
    const h = Math.min(70, w * p.height / p.width); const pw = h * p.width / p.height;
    pdf.addImage(p.data, 'JPEG', x, top + 2, pw, h); return h + 4;
  };
  if (report.logo) { const h = Math.min(18, 50 * report.logo.height / report.logo.width); pdf.addImage(report.logo.data, 'JPEG', margin, 16, h * report.logo.width / report.logo.height, h); y = 16 + h + 10; }
  text('RELATÓRIO DE CORREÇÕES', 10, true, margin, width, blue); y += 4;
  text(report.title || 'Relatório de peças', 20, true); y += 4;
  for (const [l, v] of [['Local / cliente', report.client], ['Vistoria original', formatDate(report.date)], ['Data das correções', formatDate(c.date)], ['Responsável pelas correções', c.responsible || 'Não informado']] as [string, string][]) { text(`${l}: ${v || 'Não informado'}`, 10); }
  if (c.notes.trim()) { y += 3; text(c.notes, 10, false, margin, width, muted); }
  const rows = correctionRows(report, c); const st = correctionStats(rows);
  y += 5; ensure(18);
  const boxes: [string, number, RGB][] = [['Apontamentos', st.total, ink], ['Corrigidos', st.Corrigido, statusColor['Corrigido']!], ['Pendentes', st.Pendente, statusColor['Pendente']!], ['Não se aplica', st['Não se aplica'], muted]];
  boxes.forEach(([l, n, col], i) => { const x = margin + i * 44; pdf.setDrawColor(220, 225, 232); pdf.rect(x, y, 41, 17); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor(...col); pdf.text(String(n), x + 4, y + 8); pdf.setFontSize(8); pdf.setTextColor(...muted); pdf.text(l, x + 4, y + 14); });
  y += 26;
  rows.forEach((r, idx) => {
    ensure(100);
    pdf.setFillColor(245, 247, 250); pdf.rect(margin, y - 5, width, 9, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(...ink); pdf.text(`${idx + 1}. ${r.code}${r.name ? ' — ' + r.name : ''}`, margin + 2, y + 1);
    const sc = statusColor[r.item.status]!; pdf.setTextColor(...sc); pdf.text(r.item.status.toUpperCase(), margin + width - 2, y + 1, { align: 'right' });
    y += 9;
    text(`${r.segment}${r.location ? ' · ' + r.location : ''}`, 9, false, margin, width, muted);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...sevColor[r.severity]!); ensure(6); pdf.text(r.severity.toUpperCase(), margin, y); y += 5;
    text(`Problema: ${r.description || 'Sem descrição'}`, 10);
    text(`Correção${r.item.date ? ' (' + formatDate(r.item.date) + ')' : ''}: ${r.item.note || 'Sem observação'}`, 10);
    y += 3; ensure(76);
    const half = (width - 6) / 2;
    const h = Math.max(photo(r.originalPhotos[0], margin, half, y, 'ANTES'), photo(r.item.photos[0], margin + half + 6, half, y, 'DEPOIS'));
    y += h + 4;
    for (const extra of r.item.photos.slice(1)) { ensure(76); y += photo(extra, margin + half + 6, half, y, 'DEPOIS') + 4; }
    y += 6;
  });
  if (!rows.length) text('O relatório original não possui apontamentos.', 11, false, margin, width, muted);
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { pdf.setPage(i); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...muted); pdf.text(report.footer.trim() || 'Relatórios da estrutura metálica', margin, 287); pdf.text(`Página ${i} de ${pages}`, margin + width, 287, { align: 'right' }); }
  return pdf.output('blob');
}
