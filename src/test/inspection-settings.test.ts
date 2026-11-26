import { describe, expect, it } from 'vitest';
import { upgradeInspectionSettings } from '@/lib/inspection-settings';

describe('Novas opções de inspeção', () => {
  it('acrescenta Necessita retoque às configurações existentes', () => {
    expect(upgradeInspectionSettings({ decisions: ['Aprovado', 'Inspecionar'] }).decisions).toEqual(['Aprovado', 'Inspecionar', 'Necessita retoque', 'Soldagem irregular']);
  });
  it('inclui Soldagem irregular nas opções iniciais', () => {
    expect(upgradeInspectionSettings().decisions).toContain('Soldagem irregular');
  });
  it('não duplica opções personalizadas equivalentes', () => {
    expect(upgradeInspectionSettings({ decisions: [' Necessita retoque ', 'SOLDAGEM IRREGULAR'] }).decisions).toEqual([' Necessita retoque ', 'SOLDAGEM IRREGULAR']);
  });
  it('não restaura opções removidas no gerenciamento após a atualização', () => {
    const updated = upgradeInspectionSettings({ decisions: ['Aprovado'] });
    expect(upgradeInspectionSettings({ ...updated, decisions: ['Aprovado'] }).decisions).toEqual(['Aprovado']);
  });
});