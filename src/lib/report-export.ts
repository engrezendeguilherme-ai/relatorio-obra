import { planWithMarkers } from './plan-files';
import { consolidatedIssues, countSeverity, criticalBySegment, DEFAULT_APP_NAME, figureLabel, figureNumbers, formatDate, groupBySegment, segmentStats, SEVERITIES, type Piece, type Report, type ReportFilter, type SegmentGroup } from './report-model';

export function filename(report: Report, extension: string) {
  const base = (report.title || 'relatorio-estrutura-metalica').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '');
  return `${base || 'relatorio'}.${extension}`;
}
export async function deliverFile(blob: Blob, name: string) {
  const file = new File([blob], name, { type: blob.type });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (error) { if ((error as DOMException).name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
type RGB = [number, number, number];
const rgb = (hex: string): RGB => { const v = hex.replace('#', ''); return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16) || 0) as RGB; };
const footerText = (report: Report) => report.footer.trim() || report.title || DEFAULT_APP_NAME;
const coverName = (report: Report) => (report.appName?.trim() || DEFAULT_APP_NAME).toUpperCase();
export interface TocEntry { kind: 'segment' | 'piece'; label: string; color?: string; code?: string; name?: string; location?: string; condition?: string; issues?: number; page: number }

const TOC_FIRST = 32, TOC_OTHER = 36;
export async function buildPdf(report: Report, filter: ReportFilter) {
  const { jsPDF } = await import('jspdf');
  const groups = groupBySegment(report, filter);
  const figures = figureNumbers(groupBySegment(report).flatMap(g => g.pieces));
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 18, width = 174, bottom = 270;
  const ink: RGB = [35, 47, 62], muted: RGB = [110, 119, 130], blue: RGB = [32, 89, 210];
  const pageSegment: Record<number, string> = {};
  let current = '';
  let y = 30;
  const newPage = () => { pdf.addPage(); y = 23; pageSegment[pdf.getNumberOfPages()] = current; };
  const ensure = (h: number) => { if (y + h > bottom) newPage(); };
  const text = (value: string, size = 11, bold = false, x = margin, max = width, color: RGB = ink) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(...color);
    for (const line of pdf.splitTextToSize(value, max) as string[]) { ensure(size * .45); pdf.text(line, x, y); y += size * .45 + 1.5; }
  };
  const table = (headers: string[], widths: number[], rows: string[][], fills?: (RGB | null)[]) => {
    const drawHead = () => { pdf.setFillColor(35, 47, 62); pdf.rect(margin, y, width, 8, 'F'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(255, 255, 255); let x = margin; headers.forEach((h, i) => { pdf.text(h, x + 2, y + 5.4); x += widths[i]!; }); y += 8; };
    ensure(16); drawHead();
    rows.forEach((row, r) => {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
      const cells = row.map((c, i) => pdf.splitTextToSize(c, widths[i]! - 4) as string[]);
      const h = Math.max(...cells.map(c => c.length)) * 4 + 3.5;
      if (y + h > bottom) { newPage(); drawHead(); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); }
      if (r % 2) { pdf.setFillColor(245, 247, 250); pdf.rect(margin, y, width, h, 'F'); }
      let x = margin;
      cells.forEach((c, i) => { const fill = i === 0 ? fills?.[r] : null; pdf.setTextColor(...(fill ?? ink)); pdf.setFont('helvetica', fill ? 'bold' : 'normal'); pdf.text(c, x + 2, y + 4.6); x += widths[i]!; });
      y += h;
    });
    y += 6;
  };
  const sevColor: Record<'Leve' | 'Moderado' | 'Crítico', RGB> = { Leve: [183, 121, 31], Moderado: [194, 65, 12], 'Crítico': [190, 18, 60] };

  // Cover
  pageSegment[1] = '';
  if (report.logo) {
    const h = Math.min(24, 60 * report.logo.height / report.logo.width); const w = h * report.logo.width / report.logo.height;
    pdf.addImage(report.logo.data, 'JPEG', margin, 18, w, h);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(...ink);
    pdf.text(coverName(report), margin + w + 6, 18 + h / 2 + 1.8);
    y = 18 + h + 14;
  } else { pdf.setDrawColor(...blue); pdf.setLineWidth(1); pdf.line(margin, 22, 42, 22); y = 40; text(coverName(report), 10, true); }
  y += 14;
  text(report.title || 'Relatório de peças', 28, true); y += 14;
  for (const [label, value] of [['Local / cliente', report.client], ['Data', formatDate(report.date)], ['Responsável', report.responsible]] as [string, string][]) { text(label.toUpperCase(), 9, true); text(value || 'Não informado', 12); y += 8; }
  const all = groups.flatMap(g => g.pieces);
  text(`${groups.length} segmentos  |  ${all.length} peças  |  ${all.reduce((n, p) => n + p.photos.length, 0)} fotos`, 11); y += 10;
  if (report.notes) { text('OBSERVAÇÕES GERAIS', 9, true); text(report.notes); }

  // Reserve summary pages
  const tocLines = groups.length + all.length + 1;
  const tocPages = tocLines <= TOC_FIRST ? 1 : 1 + Math.ceil((tocLines - TOC_FIRST) / TOC_OTHER);
  const tocStart = pdf.getNumberOfPages() + 1;
  for (let i = 0; i < tocPages; i++) newPage();
  const toc: TocEntry[] = [];

  const planImages = await planPages(report, all);
  const planLinks: { page: number; x: number; y: number; w: number; h: number; code: string }[] = [];
  for (const pi of planImages) {
    current = 'Plantas'; newPage();
    text(`PLANTA — ${pi.plan.name}`.toUpperCase(), 12, true, margin, width, blue); y += 2;
    const h = Math.min(bottom - y - 8, width * pi.plan.height / pi.plan.width); const w = h * pi.plan.width / pi.plan.height;
    const x0 = margin + (width - w) / 2, y0 = y;
    pdf.addImage(pi.data, 'JPEG', x0, y0, w, h); y += h + 5;
    const r = Math.max(14, pi.plan.width / 65), s = w / pi.plan.width;
    for (const p of all.filter(q => q.marker?.planId === pi.plan.id)) {
      const mx = x0 + p.marker!.x * w, my = y0 + p.marker!.y * h;
      planLinks.push({ page: pdf.getNumberOfPages(), x: mx - r * 0.6 * s, y: my - r * 0.8 * s, w: r * (2 + p.code.length * 0.75) * s, h: r * 1.6 * s, code: p.code });
    }
    text(`${pi.count} peças marcadas nesta planta — toque em uma marcação para ir até a peça`, 9, false, margin, width, muted);
  }
  for (const g of groups) {
    current = g.segment.name; newPage();
    toc.push({ kind: 'segment', label: g.segment.name, color: g.segment.color, page: pdf.getNumberOfPages() });
    const c = rgb(g.segment.color);
    pdf.setFillColor(...c); pdf.rect(margin, y - 5, width, 16, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor(255, 255, 255); pdf.text(g.segment.name.toUpperCase(), margin + 5, y + 5.2);
    pdf.setFontSize(9); pdf.text(`Prefixo ${g.segment.prefix}`, margin + width - 5, y + 5, { align: 'right' }); y += 19;
    const s = segmentStats(g.pieces);
    const boxes: [string, string][] = [['Peças', String(s.pieces)], ['Unidades', String(s.units)], ...Object.entries(s.conditions).map(([k, v]) => [k, String(v)] as [string, string]), ...SEVERITIES.map(k => [`Apont. ${k.toLowerCase()}`, String(s.severities[k])] as [string, string])];
    const bw = width / 3;
    boxes.forEach(([label, value], i) => {
      const x = margin + (i % 3) * bw, by = y + Math.floor(i / 3) * 15;
      pdf.setDrawColor(220, 225, 232); pdf.setLineWidth(.2); pdf.rect(x, by, bw, 15);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...muted); pdf.text(label.toUpperCase(), x + 3, by + 5);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.setTextColor(...ink); pdf.text(value, x + 3, by + 12);
    });
    y += Math.ceil(boxes.length / 3) * 15 + 10;
    for (const piece of g.pieces) renderPiece(piece, c);
  }

  function renderPiece(piece: Piece, color: RGB) {
    ensure(60);
    toc.push({ kind: 'piece', label: piece.code, code: piece.code, name: piece.name, location: piece.location, condition: piece.condition, issues: piece.issues.length, page: pdf.getNumberOfPages() });
    pdf.setFillColor(...color); pdf.rect(margin, y - 4.5, 1.6, 7, 'F');
    text(`${piece.code} — ${piece.name || 'Peça sem descrição'}`, 15, true, margin + 4, width - 4); y += 3;
    for (const [label, value] of [['Localização / setor', piece.location || 'Não informado'], ['Avaliação', piece.condition], ['Quantidade', String(piece.quantity)], ...(piece.marker ? [['Planta', report.plans.find(x => x.id === piece.marker!.planId)?.name ?? '—']] : [])] as [string, string][]) {
      ensure(12);
      const lines = pdf.splitTextToSize(value, 110) as string[]; const rowHeight = Math.max(9, lines.length * 5 + 4);
      pdf.setFillColor(245, 247, 250); pdf.rect(margin, y - 4.5, width, rowHeight, 'F');
      pdf.setFontSize(9.5); pdf.setTextColor(...ink); pdf.setFont('helvetica', 'bold'); pdf.text(label, margin + 3, y + 1.5);
      pdf.setFont('helvetica', 'normal'); pdf.text(lines, margin + 58, y + 1.5); y += rowHeight + 1;
    }
    if (piece.notes) { y += 4; text('Observações', 10, true); text(piece.notes, 10); }
    if (piece.issues.length) { y += 4; text('Apontamentos', 10, true); for (const i of piece.issues) { ensure(6); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...sevColor[i.severity]); pdf.text(i.severity.toUpperCase(), margin, y); const yy = y; text(i.description || 'Sem descrição', 10, false, margin + 24, width - 24); if (y === yy) y += 5; } }
    y += 7;
    for (const photo of piece.photos) {
      const caption = pdf.splitTextToSize(figureLabel(figures.get(photo.id)!, photo.caption), width) as string[];
      const capH = caption.length * 4.5 + 8;
      let h = Math.min(108, width * photo.height / photo.width);
      const room = bottom - y - capH;
      if (h > room && room >= 65) h = room;
      const w = h * photo.width / photo.height;
      const x = margin + (width - w) / 2;
      ensure(h + capH);
      pdf.addImage(photo.data, 'JPEG', x, y, w, h);
      pdf.setDrawColor(198, 205, 214); pdf.setLineWidth(.3); pdf.rect(x, y, w, h);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...ink); pdf.text(caption, margin + width / 2, y + h + 5, { align: 'center' });
      y += h + capH + 6;
    }
    if (y + 8 <= bottom) { pdf.setDrawColor(220, 225, 232); pdf.setLineWidth(.2); pdf.line(margin, y, margin + width, y); } y += 9;
  }

  // Final problem summary
  current = 'Resumo de problemas'; newPage();
  const summaryPage = pdf.getNumberOfPages();
  text('RESUMO GERAL DE PROBLEMAS', 16, true); y += 3;
  const totals = countSeverity(all);
  text(`${all.length} peças inspecionadas  ·  ${all.filter(p => p.issues.length).length} com problema  ·  ${totals.Leve} leves  ·  ${totals.Moderado} moderados  ·  ${totals['Crítico']} críticos`, 10, false, margin, width, muted); y += 4;
  text('Problemas por segmento', 12, true); y += 1;
  table(['Segmento', 'Inspecionadas', 'Com problema', 'Leves', 'Moderados', 'Críticos'], [54, 26, 26, 20, 26, 22], groups.map(g => { const s = segmentStats(g.pieces); return [g.segment.name, String(s.pieces), String(s.withProblem), String(s.severities.Leve), String(s.severities.Moderado), String(s.severities['Crítico'])]; }));
  const issues = consolidatedIssues(groups);
  text('Apontamentos consolidados', 12, true); y += 1;
  if (issues.length) table(['Gravidade', 'Segmento', 'Peça', 'Setor', 'Descrição'], [22, 32, 24, 32, 64], issues.map(r => [r.severity, r.segment, r.code, r.location || '—', r.description || '—']), issues.map(r => sevColor[r.severity]));
  else { text('Nenhum apontamento registrado.', 10, false, margin, width, muted); y += 5; }
  text('Ação imediata — peças com problema crítico', 12, true); y += 1;
  const critical = criticalBySegment(groups);
  if (!critical.length) text('Nenhuma peça com problema crítico.', 10, false, margin, width, muted);
  for (const g of critical) { ensure(12); text(g.segment.name, 10, true, margin, width, rgb(g.segment.color)); for (const p of g.pieces) text(`• ${p.code} — ${p.name || 'Sem descrição'} (${p.location || 'setor não informado'}): ${p.issues.filter(i => i.severity === 'Crítico').map(i => i.description).join('; ')}`, 9.5, false, margin + 3, width - 3); y += 3; }
  toc.push({ kind: 'segment', label: 'Resumo geral de problemas', color: '#232f3e', page: summaryPage });

  // Plan markers become links to each piece's page
  for (const l of planLinks) {
    const target = toc.find(e => e.kind === 'piece' && e.code === l.code);
    if (!target) continue;
    pdf.setPage(l.page);
    pdf.link(l.x, l.y, l.w, l.h, { pageNumber: target.page });
  }

  // Fill summary pages
  let page = tocStart, line = 0; pdf.setPage(page); y = 26;
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.setTextColor(...ink); pdf.text('Sumário', margin, y); y += 12;
  for (const e of toc) {
    if (line >= (page === tocStart ? TOC_FIRST : TOC_OTHER)) { page++; line = 0; pdf.setPage(page); y = 26; }
    line++;
    pdf.setFontSize(e.kind === 'segment' ? 10.5 : 8.5);
    if (e.kind === 'segment') {
      y += 1.5; pdf.setFillColor(...rgb(e.color!)); pdf.rect(margin, y - 3.4, 3, 4, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...ink); pdf.text(e.label, margin + 5, y);
    } else {
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...ink);
      const cut = (s: string | undefined, w: number) => (pdf.splitTextToSize(s || '—', w) as string[])[0] ?? '';
      pdf.text(cut(e.code!, 22), margin + 5, y); pdf.text(cut(e.name!, 52), margin + 29, y); pdf.text(cut(e.location!, 40), margin + 83, y); pdf.text(cut(e.condition, 22), margin + 125, y); pdf.setTextColor(...muted); pdf.text(`${e.issues} apont.`, margin + 145, y);
    }
    pdf.setTextColor(...ink); pdf.text(String(e.page), margin + width, y, { align: 'right' });
    pdf.link(margin, y - 4, width, 5.5, { pageNumber: e.page });
    y += e.kind === 'segment' ? 6.5 : 5;
  }

  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p); pdf.setDrawColor(220, 225, 232); pdf.setLineWidth(.2); pdf.line(margin, 280, 192, 280);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(...muted);
    pdf.text((pdf.splitTextToSize(footerText(report), 80) as string[])[0] ?? '', margin, 286);
    const segName = pageSegment[p]; if (segName) pdf.text(segName, 105, 286, { align: 'center' });
    pdf.text(`${p} / ${pages}`, 192, 286, { align: 'right' });
  }
  return { pdf, toc };
}
export async function generatePdf(report: Report, filter: ReportFilter): Promise<Blob> { return (await buildPdf(report, filter)).pdf.output('blob'); }

async function planPages(report: Report, pieces: Piece[]) {
  const marked = report.plans.map(plan => ({ plan, pieces: pieces.filter(p => p.marker?.planId === plan.id) })).filter(x => x.pieces.length);
  if (!marked.length) return [];
  return Promise.all(marked.map(async x => ({ plan: x.plan, count: x.pieces.length, data: await planWithMarkers(x.plan, x.pieces, report.segments) })));
}
export async function generateWord(report: Report, filter: ReportFilter): Promise<Blob> {
  const d = await import('docx');
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType } = d;
  const groups = groupBySegment(report, filter); const all = groups.flatMap(g => g.pieces);
  const figures = figureNumbers(groupBySegment(report).flatMap(g => g.pieces));
  const para = (value: string, bold = false, color?: string) => new Paragraph({ children: [new TextRun(color ? { text: value, bold, color } : { text: value, bold })], spacing: { after: 120 } });
  const cell = (text: string, w: number, opts: { bold?: boolean; fill?: string; color?: string } = {}) => new TableCell({ width: { size: w, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 110, right: 110 }, shading: { type: ShadingType.CLEAR, fill: opts.fill ?? 'FFFFFF' }, children: [new Paragraph({ children: [new TextRun({ text, bold: !!opts.bold, size: 18, ...(opts.color ? { color: opts.color } : {}) })] })] });
  const grid = (headers: string[], widths: number[], rows: string[][]) => new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: widths, rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i]!, { bold: true, fill: '232F3E', color: 'FFFFFF' })) }), ...rows.map((r, n) => new TableRow({ cantSplit: true, children: r.map((t, i) => cell(t, widths[i]!, { fill: n % 2 ? 'F5F7FA' : 'FFFFFF' })) }))] });
  const info = (pairs: [string, string][]) => new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: [2800, 6226], rows: pairs.map(([l, v]) => new TableRow({ children: [cell(l, 2800, { bold: true, fill: 'F3F5F8' }), cell(v, 6226)] })) });
  const bm = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const footer = (segment: string) => ({ default: new d.Footer({ children: [new Paragraph({ tabStops: [{ type: d.TabStopType.CENTER, position: 4513 }, { type: d.TabStopType.RIGHT, position: 9026 }], children: [new TextRun({ text: footerText(report), size: 16, color: '6E7782' }), new TextRun({ text: `\t${segment}\t`, size: 16, color: '6E7782' }), new TextRun({ children: ['Página ', d.PageNumber.CURRENT, ' de ', d.PageNumber.TOTAL_PAGES], size: 16, color: '6E7782' })] })] }) });
  const page = { page: { size: { width: 11906, height: 16838 }, margin: { top: 1300, right: 1440, bottom: 1300, left: 1440 } } };
  const toBytes = (data: string) => Uint8Array.from(atob(data.split(',')[1] ?? ''), c => c.charCodeAt(0));

  const cover: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [];
  if (report.logo) {
    const h = Math.min(90, 220 * report.logo.height / report.logo.width);
    cover.push(new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: [3400, 5626], rows: [new TableRow({ children: [
      new TableCell({ width: { size: 3400, type: WidthType.DXA }, verticalAlign: 'center' as never, children: [new Paragraph({ children: [new d.ImageRun({ type: 'jpg', data: toBytes(report.logo.data), transformation: { width: Math.round(h * report.logo.width / report.logo.height), height: Math.round(h) } })] })] }),
      new TableCell({ width: { size: 5626, type: WidthType.DXA }, verticalAlign: 'center' as never, children: [new Paragraph({ children: [new TextRun({ text: coverName(report), bold: true })] })] }),
    ] })] }), para(''));
  } else cover.push(para(coverName(report), true));
  cover.push(new Paragraph({ heading: d.HeadingLevel.TITLE, children: [new TextRun(report.title || 'Relatório de peças')], spacing: { before: 400, after: 400 } }),
    info([['Local / cliente', report.client || 'Não informado'], ['Data', formatDate(report.date)], ['Responsável', report.responsible || 'Não informado'], ['Segmentos', String(groups.length)], ['Total de peças', String(all.length)]]), para(''), para('Observações gerais', true), para(report.notes || 'Nenhuma observação.'));

  const tocRow = (label: string, anchor: string, bold: boolean, indent = 0) => new Paragraph({ tabStops: [{ type: d.TabStopType.RIGHT, position: 9026, leader: d.LeaderType.DOT }], indent: { left: indent }, spacing: { after: bold ? 80 : 30, before: bold ? 160 : 0 }, children: [new d.InternalHyperlink({ anchor, children: [new TextRun({ text: label, bold, size: bold ? 22 : 18 })] }), new TextRun({ text: '\t', size: 18 }), new d.PageReference(anchor)] });
  const toc = [new Paragraph({ heading: d.HeadingLevel.HEADING_1, children: [new TextRun('Sumário')] }), para('Clique em um item para ir até a página. Se os números não aparecerem, pressione F9 no Word para atualizar.', false, '6E7782')];
  for (const g of groups) { toc.push(tocRow(g.segment.name, bm(`s_${g.segment.id}`), true)); for (const p of g.pieces) toc.push(tocRow(`${p.code} — ${p.name || 'Sem descrição'} · ${p.location || '—'} · ${p.condition} · ${p.issues.length} apont.`, bm(`p_${p.id}`), false, 280)); }
  toc.push(tocRow('Resumo geral de problemas', 'resumo_problemas', true));

  const sections = [{ properties: page, footers: footer(''), children: cover }, { properties: page, footers: footer(''), children: toc }];
  for (const pi of await planPages(report, all)) {
    const scale = Math.min(600 / pi.plan.width, 820 / pi.plan.height);
    sections.push({ properties: page, footers: footer('Plantas'), children: [new Paragraph({ heading: d.HeadingLevel.HEADING_1, children: [new TextRun(`Planta — ${pi.plan.name}`)] }), new Paragraph({ children: [new d.ImageRun({ type: 'jpg', data: toBytes(pi.data), transformation: { width: Math.round(pi.plan.width * scale), height: Math.round(pi.plan.height * scale) } })] }), para(`${pi.count} peças marcadas nesta planta`, false, '6E7782')] });
  }
  for (const g of groups) {
    const color = g.segment.color.replace('#', '').toUpperCase(); const s = segmentStats(g.pieces);
    const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
      new Paragraph({ shading: { type: ShadingType.CLEAR, fill: color }, spacing: { after: 240 }, children: [new d.Bookmark({ id: bm(`s_${g.segment.id}`), children: [new TextRun({ text: `  ${g.segment.name.toUpperCase()}`, bold: true, color: 'FFFFFF', size: 34 })] })] }),
      info([['Peças', String(s.pieces)], ['Unidades', String(s.units)], ...Object.entries(s.conditions).map(([label, value]) => [label, String(value)] as [string, string])]), para(''),
      grid(SEVERITIES.map(v => `Apontamentos ${v.toLowerCase()}`), [3009, 3009, 3008], [SEVERITIES.map(v => String(s.severities[v]))]), para(''),
    ];
    for (const piece of g.pieces) {
      children.push(new Paragraph({ heading: d.HeadingLevel.HEADING_2, keepNext: true, border: { left: { style: d.BorderStyle.SINGLE, size: 24, color, space: 6 } }, children: [new d.Bookmark({ id: bm(`p_${piece.id}`), children: [new TextRun(`${piece.code} — ${piece.name || 'Peça sem descrição'}`)] })] }),
        info([['Localização / setor', piece.location || 'Não informado'], ['Avaliação', piece.condition], ['Quantidade', String(piece.quantity)], ...(piece.marker ? [['Planta', report.plans.find(x => x.id === piece.marker!.planId)?.name ?? '—']] : []) as [string, string][]]));
      if (piece.notes) children.push(para(''), para('Observações', true), para(piece.notes));
      if (piece.issues.length) { children.push(para(''), para('Apontamentos', true)); for (const i of piece.issues) children.push(new Paragraph({ children: [new TextRun({ text: `${i.severity.toUpperCase()}  `, bold: true, color: i.severity === 'Crítico' ? 'BE123C' : i.severity === 'Moderado' ? 'C2410C' : 'B7791F' }), new TextRun(i.description)] })); }
      for (const photo of piece.photos) {
        const scale = Math.min(590 / photo.width, 440 / photo.height);
        const w = Math.round(photo.width * scale), h = Math.round(photo.height * scale), dxa = w * 15;
        const line = { style: d.BorderStyle.SINGLE, size: 6, color: 'C6CDD6' };
        const off = { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
        const noBorder = { top: off, bottom: off, left: off, right: off, insideHorizontal: off, insideVertical: off };
        children.push(new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: [9026], alignment: d.AlignmentType.CENTER, borders: noBorder, rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: 9026, type: WidthType.DXA }, borders: noBorder, margins: { top: 0, bottom: 160, left: 0, right: 0 }, children: [
          new Table({ width: { size: dxa, type: WidthType.DXA }, columnWidths: [dxa], alignment: d.AlignmentType.CENTER, borders: noBorder, rows: [new TableRow({ cantSplit: true, children: [new TableCell({ width: { size: dxa, type: WidthType.DXA }, borders: { top: line, bottom: line, left: line, right: line }, margins: { top: 60, bottom: 60, left: 60, right: 60 }, children: [new Paragraph({ spacing: { after: 0 }, children: [new d.ImageRun({ type: 'jpg', data: toBytes(photo.data), transformation: { width: w, height: h }, altText: { title: piece.code, description: photo.caption || piece.name, name: photo.id } })] })] })] })] }),
          new Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { before: 100, after: 0 }, children: [new TextRun({ text: figureLabel(figures.get(photo.id)!, photo.caption), bold: true })] }),
        ] })] })] }), para(''));
      }
    }
    sections.push({ properties: page, footers: footer(g.segment.name), children });
  }
  const totals = countSeverity(all); const issues = consolidatedIssues(groups); const critical = criticalBySegment(groups);
  const final: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({ heading: d.HeadingLevel.HEADING_1, children: [new d.Bookmark({ id: 'resumo_problemas', children: [new TextRun('Resumo geral de problemas')] })] }),
    para(`${all.length} peças inspecionadas · ${all.filter(p => p.issues.length).length} com problema · ${totals.Leve} leves · ${totals.Moderado} moderados · ${totals['Crítico']} críticos`),
    para('Problemas por segmento', true),
    grid(['Segmento', 'Inspecionadas', 'Com problema', 'Leves', 'Moderados', 'Críticos'], [2526, 1300, 1300, 1300, 1300, 1300], groups.map(g => { const s = segmentStats(g.pieces); return [g.segment.name, String(s.pieces), String(s.withProblem), String(s.severities.Leve), String(s.severities.Moderado), String(s.severities['Crítico'])]; })),
    para(''), para('Apontamentos consolidados', true),
    issues.length ? grid(['Gravidade', 'Segmento', 'Peça', 'Setor', 'Descrição'], [1200, 1700, 1300, 1700, 3126], issues.map(r => [r.severity, r.segment, r.code, r.location || '—', r.description || '—'])) : para('Nenhum apontamento registrado.'),
    para(''), para('Ação imediata — peças com problema crítico', true),
  ];
  if (!critical.length) final.push(para('Nenhuma peça com problema crítico.'));
  for (const g of critical) { final.push(para(g.segment.name, true, g.segment.color.replace('#', ''))); for (const p of g.pieces) final.push(para(`• ${p.code} — ${p.name || 'Sem descrição'} (${p.location || 'setor não informado'}): ${p.issues.filter(i => i.severity === 'Crítico').map(i => i.description).join('; ')}`)); }
  sections.push({ properties: page, footers: footer('Resumo de problemas'), children: final });
  return d.Packer.toBlob(new d.Document({ features: { updateFields: true }, styles: { default: { document: { run: { font: 'Arial', size: 22, color: '23303E' } } }, paragraphStyles: [{ id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 36, bold: true }, paragraph: { spacing: { before: 200, after: 240 }, outlineLevel: 0 } }, { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 28, bold: true }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 1 } }] }, sections }));
}

export async function generateExcel(report: Report, filter: ReportFilter): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const groups: SegmentGroup[] = groupBySegment(report, filter);
  const head = (labels: string[]) => labels.map(value => ({ value, fontWeight: 'bold' as const, backgroundColor: '#E8EDF5' }));
  const pieces = [head(['Segmento', 'Código', 'Nome / descrição', 'Localização / setor', 'Avaliação', 'Quantidade', 'Fotos', 'Apontamentos', 'Leves', 'Moderados', 'Críticos', 'Observações']),
    ...groups.flatMap(g => g.pieces.map(p => { const s = countSeverity([p]); return [g.segment.name, p.code, p.name, p.location, p.condition, p.quantity, p.photos.length, p.issues.length, s.Leve, s.Moderado, s['Crítico'], p.notes].map(value => ({ value })); }))];
  const issues = [head(['Gravidade', 'Segmento', 'Código', 'Peça', 'Setor', 'Descrição']), ...consolidatedIssues(groups).map(r => [r.severity, r.segment, r.code, r.name, r.location, r.description].map(value => ({ value })))];
  return writeXlsxFile([
    { sheet: 'Peças', data: pieces, columns: [18, 12, 30, 24, 28, 11, 8, 13, 8, 11, 9, 50].map(width => ({ width })) },
    { sheet: 'Apontamentos', data: issues, columns: [12, 18, 12, 30, 24, 60].map(width => ({ width })) },
  ]).toBlob();
}
