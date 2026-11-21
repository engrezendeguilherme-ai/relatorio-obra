import { describe, expect, it } from 'vitest';
import { updateArchive } from '@/lib/archive-model';
import { emptyReport } from '@/lib/report-model';
const report = { ...emptyReport(), title: 'Inspeção do terminal', client: 'Terminal', date: '2026-11-18' };
describe('Atualização dos relatórios salvos', () => {
  it('atualiza o mesmo relatório sem adicionar uma duplicata e preserva o id das correções', () => {
    const old = { id: 'original', savedAt: '2026-11-19', report };
    const result = updateArchive([old], { id: 'novo', savedAt: '2026-11-20', report: { ...report, notes: 'Correções de hoje' } });
    expect(result.reports).toHaveLength(1);
    expect(result.saved.id).toBe('original');
    expect(result.saved.report.notes).toBe('Correções de hoje');
    expect(result.previous?.report.notes).toBe('');
  });
  it('usa a identidade para atualizar mesmo depois de alterar o título', () => {
    const old = { id: 'original', savedAt: 'ontem', report: { ...report, id: 'original' } };
    const result = updateArchive([old], { id: 'novo', savedAt: 'hoje', report: { ...report, id: 'original', title: 'Novo título' } });
    expect(result.reports).toHaveLength(1);
    expect(result.saved.report.title).toBe('Novo título');
  });
  it('não une inspeções de datas diferentes', () => {
    expect(updateArchive([{ id: 'original', savedAt: 'ontem', report }], { id: 'novo', savedAt: 'hoje', report: { ...report, date: '2026-11-21' } }).reports).toHaveLength(2);
  });
});