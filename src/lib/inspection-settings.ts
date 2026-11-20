export const DEFAULT_DECISIONS = ['Aprovado', 'Aprovado com ressalvas', 'Refazer', 'Substituir'];
export interface InspectionSettings { decisions: string[] }
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