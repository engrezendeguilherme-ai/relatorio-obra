import { formatDate, type Report } from './report-model';

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
export async function generatePdf(report: Report): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 18, width = 174, bottom = 273;
  const ink: [number, number, number] = [35, 47, 62], blue: [number, number, number] = [32, 89, 210];
  let y = 30;
  const text = (value: string, size = 11, bold = false, x = margin, max = width) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(size); pdf.setTextColor(...ink);
    const lines = pdf.splitTextToSize(value, max) as string[];
    for (const line of lines) { if (y + size * .45 > bottom) { pdf.addPage(); y = 23; } pdf.text(line, x, y); y += size * .45 + 1.5; }
  };
  pdf.setDrawColor(...blue); pdf.setLineWidth(1); pdf.line(margin, 22, 42, 22);
  y = 40; text('RELATÓRIO DE ESTRUTURA METÁLICA', 10, true); y += 14;
  text(report.title || 'Relatório de peças', 28, true); y += 14;
  const coverInfo: [string, string][] = [['Local / cliente', report.client], ['Data', formatDate(report.date)], ['Responsável', report.responsible]];
  for (const [label, value] of coverInfo) { text(label.toUpperCase(), 9, true); text(value || 'Não informado', 12); y += 8; }
  text(`${report.pieces.length} peças  |  ${report.pieces.reduce((n, p) => n + p.photos.length, 0)} fotos`, 11); y += 10;
  if (report.notes) { text('OBSERVAÇÕES GERAIS', 9, true); text(report.notes); }
  for (const piece of report.pieces) {
    pdf.addPage(); y = 24;
    text(`${piece.code} — ${piece.name || 'Peça sem descrição'}`, 18, true); y += 6;
    const pieceInfo: [string, string][] = [['Localização / setor', piece.location || 'Não informado'], ['Condição', piece.condition], ['Quantidade', String(piece.quantity)]];
    for (const [label, value] of pieceInfo) {
      if (y + 15 > bottom) { pdf.addPage(); y = 23; }
      const lines = pdf.splitTextToSize(value, 110) as string[];
      const rowHeight = Math.max(11, lines.length * 5 + 5);
      pdf.setFillColor(245, 247, 250); pdf.rect(margin, y - 5, width, rowHeight, 'F');
      pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.text(label, margin + 3, y + 2);
      pdf.setFont('helvetica', 'normal'); pdf.text(lines, margin + 58, y + 2); y += rowHeight + 1;
    }
    if (piece.notes) { y += 5; text('Observações', 10, true); text(piece.notes); }
    y += 9;
    for (let i = 0; i < piece.photos.length; i += 2) {
      const pair = piece.photos.slice(i, i + 2); const cellWidth = 83;
      const cells = pair.map(photo => {
        const h = Math.min(100, cellWidth * photo.height / photo.width);
        const w = h * photo.width / photo.height;
        const caption = pdf.splitTextToSize(photo.caption || 'Sem legenda', cellWidth) as string[];
        return { photo, h, w, caption, total: h + caption.length * 4.5 + 8 };
      });
      const height = Math.max(...cells.map(c => c.total));
      if (y + height > bottom) { pdf.addPage(); y = 23; }
      cells.forEach((cell, col) => {
        const x = margin + col * 91;
        pdf.addImage(cell.photo.data, 'JPEG', x + (cellWidth - cell.w) / 2, y, cell.w, cell.h);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text(cell.caption, x, y + cell.h + 5);
      }); y += height + 6;
    }
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setDrawColor(220, 225, 232); pdf.setLineWidth(.2); pdf.line(margin, 282, 192, 282);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(110, 119, 130);
    pdf.text('Relatórios da estrutura metálica', margin, 288); pdf.text(`${page} / ${pages}`, 192, 288, { align: 'right' });
  }
  return pdf.output('blob');
}
export async function generateWord(report: Report): Promise<Blob> {
  const d = await import('docx');
  const { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType } = d;
  const para = (value: string, bold = false) => new Paragraph({ children: [new TextRun({ text: value, bold })], spacing: { after: 120 } });
  const info = (pairs: [string, string][]) => new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: [2800, 6226], rows: pairs.map(([label, value]) => new TableRow({ children: [label, value].map((text, i) => new TableCell({ width: { size: i === 0 ? 2800 : 6226, type: WidthType.DXA }, margins: { top: 100, bottom: 100, left: 140, right: 140 }, shading: { type: ShadingType.CLEAR, fill: i === 0 ? 'F3F5F8' : 'FFFFFF' }, children: [para(text, i === 0)] })) })) });
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    para('RELATÓRIO DE ESTRUTURA METÁLICA', true),
    new Paragraph({ heading: d.HeadingLevel.TITLE, children: [new TextRun(report.title || 'Relatório de peças')], spacing: { before: 600, after: 400 } }),
    info([['Local / cliente', report.client || 'Não informado'], ['Data', formatDate(report.date)], ['Responsável', report.responsible || 'Não informado'], ['Total de peças', String(report.pieces.length)]]),
    para(''), para('Observações gerais', true), para(report.notes || 'Nenhuma observação.'),
  ];
  for (const piece of report.pieces) {
    children.push(new Paragraph({ pageBreakBefore: true, heading: d.HeadingLevel.HEADING_1, children: [new TextRun(`${piece.code} — ${piece.name || 'Peça sem descrição'}`)] }),
      info([['Localização / setor', piece.location || 'Não informado'], ['Condição', piece.condition], ['Quantidade', String(piece.quantity)]]), para(''), para(piece.notes));
    const rows = [];
    for (let i = 0; i < piece.photos.length; i += 2) {
      const cells = [];
      for (let col = 0; col < 2; col++) {
        const photo = piece.photos[i + col];
        const content = [];
        if (photo) {
          const scale = Math.min(270 / photo.width, 330 / photo.height);
          const encoded = photo.data.split(',')[1];
          if (!encoded) throw new Error('Foto inválida.');
          const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
          content.push(new Paragraph({ children: [new d.ImageRun({ type: 'jpg', data: bytes, transformation: { width: Math.round(photo.width * scale), height: Math.round(photo.height * scale) }, altText: { title: piece.code, description: photo.caption || piece.name, name: photo.id } })], keepNext: true }), para(photo.caption || 'Sem legenda'));
        } else content.push(para(''));
        cells.push(new TableCell({ width: { size: 4513, type: WidthType.DXA }, margins: { top: 120, bottom: 120, left: 100, right: 100 }, children: content }));
      }
      rows.push(new TableRow({ cantSplit: true, children: cells }));
    }
    if (rows.length) children.push(new Table({ width: { size: 9026, type: WidthType.DXA }, columnWidths: [4513, 4513], rows }));
  }
  return d.Packer.toBlob(new d.Document({ styles: { default: { document: { run: { font: 'Arial', size: 22, color: '23303E' } } }, paragraphStyles: [{ id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 36, bold: true }, paragraph: { spacing: { before: 200, after: 240 }, outlineLevel: 0 } }] }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, footers: { default: new d.Footer({ children: [new Paragraph({ alignment: d.AlignmentType.RIGHT, children: [new TextRun('Página '), new TextRun({ children: [d.PageNumber.CURRENT] }), new TextRun(' de '), new TextRun({ children: [d.PageNumber.TOTAL_PAGES] })] })] }) }, children }] }));
}