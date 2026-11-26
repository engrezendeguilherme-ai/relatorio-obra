const ADDITIONAL_DECISIONS = ['Necessita retoque', 'Soldagem irregular'];
export const DEFAULT_DECISIONS = ['Aprovado', 'Aprovado com ressalvas', 'Refazer', 'Substituir', ...ADDITIONAL_DECISIONS];
export const INSPECTION_SETTINGS_VERSION = 2;
export interface InspectionSettings { decisions: string[]; version?: number }
/** Append new choices once, preserving custom choices and subsequent removals. */
export function upgradeInspectionSettings(stored?: InspectionSettings): InspectionSettings {
  if (!stored) return { decisions: [...DEFAULT_DECISIONS], version: INSPECTION_SETTINGS_VERSION };
  if ((stored.version ?? 1) >= INSPECTION_SETTINGS_VERSION) return stored;
  const labels = new Set(stored.decisions.map(value => value.trim().toLocaleLowerCase('pt-BR')));
  return { ...stored, decisions: [...stored.decisions, ...ADDITIONAL_DECISIONS.filter(value => !labels.has(value.toLocaleLowerCase('pt-BR')))], version: INSPECTION_SETTINGS_VERSION };
}
export function validateDecisions(decisions: string[]): string | null {
  if (!decisions.length) return 'Mantenha pelo menos uma opção.';
  if (decisions.some(value => !value.trim())) return 'Preencha o nome de todas as opções.';
  if (decisions.some(value => value.trim().length > 40)) return 'Use até 40 caracteres por opção.';
  if (new Set(decisions.map(value => value.trim().toLocaleLowerCase('pt-BR'))).size !== decisions.length) return 'Não repita o nome das opções.';
  return null;
}
export function decisionOptions(decisions: string[], current: string) {
  return current && !decisions.includes(current) ? [current, ...decisions] : decisions;
}