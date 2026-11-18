import { describe, expect, it } from 'vitest';
import { emptyReport, type Piece } from '@/lib/report-model';
import { correctionRows, correctionStats, emptyCorrection, snapshot } from '@/lib/correction-model';
const base: Piece = { id: 'p', segmentId: 'seg-pilares', code: 'PL-001', name: '', location: '', condition: 'Ruim', quantity: 1, notes: '', issues: [], photos: [] };
const report = { ...emptyReport(), pieces: [{ ...base, issues: [{ id: 'i1', description: 'Corrosão', severity: 'Leve' as const }, { id: 'i2', description: 'Trinca', severity: 'Crítico' as const }] }] };
describe('Correções', () => {
  it('lista cada apontamento como pendente, mais grave primeiro', () => {
    const rows = correctionRows(report, emptyCorrection('r'));
    expect(rows.map(r => `${r.issueId}:${r.item.status}`)).toEqual(['i2:Pendente', 'i1:Pendente']);
  });
  it('conta corrigidos e pendentes', () => {
    const c = { ...emptyCorrection('r'), items: { i1: { status: 'Corrigido' as const, note: 'ok', date: '', photos: [] } } };
    expect(correctionStats(correctionRows(report, c))).toEqual({ total: 2, Pendente: 1, Corrigido: 1, 'Não se aplica': 0 });
  });
  it('salva uma cópia independente do relatório', () => {
    const s = snapshot(report); report.pieces[0]!.code = 'X';
    expect(s.report.pieces[0]!.code).toBe('PL-001');
  });
});
