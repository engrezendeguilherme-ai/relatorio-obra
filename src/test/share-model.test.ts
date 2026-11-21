import { describe, expect, it } from 'vitest';
import { photoReference, validShareToken } from '@/lib/share-model';
describe('Acesso por link', () => {
  it('aceita somente tokens aleatórios completos, não ids de relatório', () => {
    expect(validShareToken('a'.repeat(64))).toBe(true);
    expect(validShareToken('9d21ff50-e431-4ec9-8320-4c18a1120c51')).toBe(false);
    expect(validShareToken('a'.repeat(63))).toBe(false);
  });
  it('aceita somente referências de foto por hash sem caminhos arbitrários', () => {
    expect(photoReference(`photo-ref:${'a'.repeat(32)}`)).toBe('a'.repeat(32));
    expect(photoReference('photo-ref:../outra-conta/foto')).toBeUndefined();
  });
});