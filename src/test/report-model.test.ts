import { describe, expect, it } from 'vitest';
import { CONDITIONS, IMAGE_QUALITY, imageDimensions, MAX_IMAGE_WIDTH, moveItem, validatePiece, type Piece } from '@/lib/report-model';
const piece: Piece = { id: '1', code: 'PC-001', name: '', location: '', condition: 'Boa', quantity: 1, notes: '', photos: [] };
describe('Regras das peças e fotos', () => {
  it('exige código da peça', () => { expect(validatePiece({ ...piece, code: ' ' })).toBe('Informe o código da peça.'); expect(validatePiece(piece)).toBeNull(); });
  it('aceita apenas quantidades inteiras positivas', () => { expect(validatePiece({ ...piece, quantity: 0 })).toBe('A quantidade deve ser um número inteiro maior que zero.'); expect(validatePiece({ ...piece, quantity: 1.5 })).toBe('A quantidade deve ser um número inteiro maior que zero.'); expect(validatePiece({ ...piece, quantity: 2 })).toBeNull(); });
  it('limita a largura a 1600px mantendo proporção', () => { expect(MAX_IMAGE_WIDTH).toBe(1600); expect(imageDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 }); expect(imageDimensions(800, 600)).toEqual({ width: 800, height: 600 }); });
  it('comprime com qualidade 0.8', () => { expect(IMAGE_QUALITY).toBe(0.8); });
  it('oferece as quatro condições solicitadas', () => { expect(CONDITIONS).toEqual(['Boa', 'Regular', 'Ruim', 'Danificada']); });
  it('reordena preservando todas as peças e fotos', () => { expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']); });
});