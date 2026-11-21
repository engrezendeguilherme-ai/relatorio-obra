import { describe, expect, it } from 'vitest';
import { annotatedData, annotatedMap, arrowOf, buildShape, ellipseOf, isMeaningfulShape, strokeWidth } from '@/lib/photo-shapes';
import type { PiecePhoto } from '@/lib/report-model';

const photo = (patch: Partial<PiecePhoto> = {}): PiecePhoto => ({ id: 'f1', data: 'data:image/jpeg;base64,AAAA', caption: '', width: 1000, height: 500, ...patch });

describe('Marcações nas fotos', () => {
  it('mantém as coordenadas dentro da foto', () => {
    const s = buildShape('circle', '#dc2626', { x: -0.2, y: 0.1 }, { x: 1.4, y: 2 }, 'a');
    expect([s.x1, s.y1, s.x2, s.y2]).toEqual([0, 0.1, 1, 1]);
  });
  it('ignora toque ou arraste minúsculo', () => {
    const p = { x: 0.5, y: 0.5 };
    expect(isMeaningfulShape(buildShape('circle', '#000', p, p))).toBe(false);
    expect(isMeaningfulShape(buildShape('arrow', '#000', p, { x: 0.505, y: 0.505 }))).toBe(false);
    expect(isMeaningfulShape(buildShape('circle', '#000', p, { x: 0.6, y: 0.62 }))).toBe(true);
    expect(isMeaningfulShape(buildShape('circle', '#000', p, { x: 0.8, y: 0.501 }))).toBe(false); // faixa fina, não é círculo
    expect(isMeaningfulShape(buildShape('arrow', '#000', p, { x: 0.7, y: 0.5 }))).toBe(true);
  });
  it('calcula a elipse a partir dos cantos, em qualquer direção de arraste', () => {
    const a = ellipseOf(buildShape('circle', '#000', { x: 0.2, y: 0.4 }, { x: 0.6, y: 0.8 }, 'a'), 1000, 500);
    const b = ellipseOf(buildShape('circle', '#000', { x: 0.6, y: 0.8 }, { x: 0.2, y: 0.4 }, 'b'), 1000, 500);
    expect(a).toEqual(b);
    expect(a.cx).toBeCloseTo(400); expect(a.cy).toBeCloseTo(300); expect(a.rx).toBeCloseTo(200); expect(a.ry).toBeCloseTo(100);
  });
  it('a ponta da seta fica no ponto final e a cabeça aponta para ele', () => {
    const s = buildShape('arrow', '#000', { x: 0.1, y: 0.5 }, { x: 0.6, y: 0.5 }, 'a');
    const g = arrowOf(s, 1000, 500);
    expect(g.tip).toEqual({ x: 600, y: 250 });
    expect(g.x1).toBeCloseTo(100); expect(g.y1).toBeCloseTo(250);
    expect(g.left.x).toBeLessThan(600); expect(g.right.x).toBeLessThan(600);
    expect(g.left.y).toBeCloseTo(500 - g.right.y); // simétricas em relação à haste
    expect(g.bx).toBeGreaterThan(g.left.x); expect(g.bx).toBeLessThan(600);
  });
  it('a espessura acompanha a resolução da foto', () => {
    expect(strokeWidth(100, 100)).toBe(4);
    expect(strokeWidth(2000, 1000)).toBeCloseTo(14);
  });
  it('sem marcações devolve a foto original; o mapa só inclui fotos marcadas', async () => {
    const plain = photo();
    expect(await annotatedData(plain)).toBe(plain.data);
    const marked = photo({ id: 'f2', shapes: [] });
    const map = await annotatedMap([plain, marked]);
    expect(map.size).toBe(0);
  });
  it('se não conseguir desenhar, devolve a foto original em vez de falhar', async () => {
    const broken = photo({ id: 'f3', shapes: [buildShape('arrow', '#000', { x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, 's')] });
    expect(await annotatedData(broken)).toBe(broken.data); // jsdom não decodifica imagens
    expect((await annotatedMap([broken])).get('f3')).toBe(broken.data);
  });
});
