import { describe, expect, it } from 'vitest';
import { CONDITIONS, DEFAULT_SEGMENTS, IMAGE_QUALITY, imageDimensions, MAX_IMAGE_WIDTH, moveItem, validatePiece, emptyReport, shouldInitializeExample, nextCode, isDuplicateCode, naturalCompare, groupBySegment, consolidatedIssues, segmentStats, criticalBySegment, normalizeReport, type Piece } from '@/lib/report-model';
const piece: Piece = { id: '1', segmentId: 'seg-pilares', code: 'PC-001', name: '', location: '', condition: 'Boa', quantity: 1, notes: '', issues: [], photos: [] };
describe('Regras das peças e fotos', () => {
  it('preenche exemplo apenas no primeiro relatório vazio', () => { expect(shouldInitializeExample(undefined, undefined)).toBe(true); expect(shouldInitializeExample(emptyReport(), undefined)).toBe(true); expect(shouldInitializeExample(emptyReport(), true)).toBe(false); });
  it('preserva registros existentes ao oferecer exemplo', () => { expect(shouldInitializeExample({ ...emptyReport(), title: 'Meu relatório' }, undefined)).toBe(false); expect(shouldInitializeExample({ ...emptyReport(), pieces: [piece] }, undefined)).toBe(false); });
  it('exige código da peça', () => { expect(validatePiece({ ...piece, code: ' ' })).toBe('Informe o código da peça.'); expect(validatePiece(piece)).toBeNull(); });
  it('exige segmento da peça', () => { expect(validatePiece({ ...piece, segmentId: '' })).toBe('Escolha o segmento da peça.'); });
  it('aceita apenas quantidades inteiras positivas', () => { expect(validatePiece({ ...piece, quantity: 0 })).toBe('A quantidade deve ser um número inteiro maior que zero.'); expect(validatePiece({ ...piece, quantity: 1.5 })).not.toBeNull(); expect(validatePiece({ ...piece, quantity: 2 })).toBeNull(); });
  it('limita a largura a 1600px mantendo proporção', () => { expect(MAX_IMAGE_WIDTH).toBe(1600); expect(imageDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 }); expect(imageDimensions(800, 600)).toEqual({ width: 800, height: 600 }); });
  it('comprime com qualidade 0.8', () => { expect(IMAGE_QUALITY).toBe(0.8); });
  it('oferece as quatro condições solicitadas', () => { expect(CONDITIONS).toEqual(['Boa', 'Regular', 'Ruim', 'Danificada']); });
  it('reordena preservando todas as peças e fotos', () => { expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']); });
});
describe('Segmentos', () => {
  it('lista inicial com prefixos', () => { expect(DEFAULT_SEGMENTS.map(s => `${s.name}=${s.prefix}`)).toEqual(['Pilares=PL', 'Tesouras=TS', 'Terças=TR', 'Viga painel=VP', 'Vigas=VG', 'Contraventamento=CT', 'Calhas=CL', 'Outros=OU']); });
  it('sugere o próximo código livre com três dígitos', () => { expect(nextCode('PL', [])).toBe('PL-001'); expect(nextCode('PL', [{ ...piece, code: 'PL-001' }, { ...piece, id: '2', code: 'PL-003' }])).toBe('PL-002'); });
  it('avisa código repetido', () => { expect(isDuplicateCode('pc-001', [piece], 'x')).toBe(true); expect(isDuplicateCode('PC-001', [piece], '1')).toBe(false); });
  it('ordena códigos de forma natural', () => { expect(['PL-10', 'PL-2'].sort(naturalCompare)).toEqual(['PL-2', 'PL-10']); });
  it('agrupa na ordem dos segmentos, sem segmentos vazios', () => {
    const r = { ...emptyReport(), pieces: [{ ...piece, id: 'a', segmentId: 'seg-vigas', code: 'VG-10' }, { ...piece, id: 'b', segmentId: 'seg-vigas', code: 'VG-2' }, { ...piece, id: 'c', code: 'PL-1' }] };
    const g = groupBySegment(r);
    expect(g.map(x => x.segment.name)).toEqual(['Pilares', 'Vigas']);
    expect(g[1]!.pieces.map(p => p.code)).toEqual(['VG-2', 'VG-10']);
    expect(groupBySegment(r, { segmentIds: ['seg-vigas'], onlyProblems: false }).length).toBe(1);
    expect(groupBySegment(r, { segmentIds: null, onlyProblems: true }).length).toBe(0);
  });
  it('ordena apontamentos por gravidade e depois segmento', () => {
    const r = { ...emptyReport(), pieces: [{ ...piece, id: 'a', segmentId: 'seg-vigas', code: 'VG-1', issues: [{ id: '1', description: 'x', severity: 'Crítico' as const }] }, { ...piece, id: 'b', code: 'PL-1', issues: [{ id: '2', description: 'y', severity: 'Leve' as const }, { id: '3', description: 'z', severity: 'Crítico' as const }] }] };
    const g = groupBySegment(r);
    expect(consolidatedIssues(g).map(i => `${i.severity}/${i.segment}`)).toEqual(['Crítico/Pilares', 'Crítico/Vigas', 'Leve/Pilares']);
    expect(segmentStats(g[0]!.pieces).severities).toEqual({ Leve: 1, Moderado: 0, 'Crítico': 1 });
    expect(criticalBySegment(g).map(x => x.segment.name)).toEqual(['Pilares', 'Vigas']);
  });
  it('relatórios antigos recebem segmentos e vão para Outros', () => { const r = normalizeReport({ title: 'x', pieces: [{ ...piece, segmentId: undefined as unknown as string }] }); expect(r.pieces[0]!.segmentId).toBe('seg-outros'); expect(r.segments.length).toBe(8); });
});
import { removePlan, clampMarker, piecesOnPlan, figureLabel, figureNumbers } from '@/lib/report-model';
describe('Plantas', () => {
  const plan = { id: 'pl1', name: 'Planta', data: '', width: 10, height: 10 };
  it('excluir planta remove só as marcações dela', () => {
    const r = { ...emptyReport(), plans: [plan], pieces: [{ ...piece, marker: { planId: 'pl1', x: .5, y: .5 } }, { ...piece, id: '2', marker: { planId: 'outra', x: .1, y: .1 } }] };
    const out = removePlan(r, 'pl1');
    expect(out.plans).toEqual([]); expect(out.pieces[0]!.marker).toBeNull(); expect(out.pieces[1]!.marker?.planId).toBe('outra');
  });
  it('posição fica dentro da planta', () => { expect(clampMarker(1.2, -0.1)).toEqual({ x: 1, y: 0 }); });
  it('marcação de planta inexistente é descartada ao abrir', () => { expect(normalizeReport({ pieces: [{ ...piece, marker: { planId: 'x', x: 0, y: 0 } }] }).pieces[0]!.marker).toBeNull(); });
  it('lista peças da planta em ordem de código', () => { expect(piecesOnPlan([{ ...piece, id: 'a', code: 'PL-10', marker: { planId: 'pl1', x: 0, y: 0 } }, { ...piece, id: 'b', code: 'PL-2', marker: { planId: 'pl1', x: 0, y: 0 } }], 'pl1').map(p => p.code)).toEqual(['PL-2', 'PL-10']); });
});
describe('Numeração das figuras', () => {
  const photo = (id: string, caption = '') => ({ id, data: '', caption, width: 10, height: 10 });
  it('numera as fotos na ordem em que aparecem, com dois dígitos', () => {
    const numbers = figureNumbers([{ ...piece, id: 'a', photos: [photo('f1'), photo('f2')] }, { ...piece, id: 'b', photos: [photo('f3')] }]);
    expect([...numbers.values()]).toEqual([1, 2, 3]);
    expect(figureLabel(numbers.get('f3')!, 'Trinca na solda')).toBe('Figura 03: Trinca na solda');
  });
  it('mantém o número quando a foto não tem legenda', () => {
    expect(figureLabel(1, '   ')).toBe('Figura 01');
    expect(figureLabel(12, 'X')).toBe('Figura 12: X');
    expect(figureLabel(1, '  solda  ')).toBe('Figura 01: solda');
  });
});
