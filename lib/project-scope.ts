export type ScopeSection = 'contract' | 'workforce' | 'legal' | 'cfi';
export type ScopeRow = Record<string, string> & { id: string };
export type ProjectScope = Record<ScopeSection, ScopeRow[]>;

export const scopeColumns: Record<ScopeSection, { key: string; label: string }[]> = {
  contract: [{ key: 'field', label: 'Informação' }, { key: 'value', label: 'Valor' }, { key: 'note', label: 'Observação' }],
  workforce: [{ key: 'category', label: 'Direta / indireta' }, { key: 'role', label: 'Função' }, { key: 'name', label: 'Nome' }, { key: 'quantity', label: 'Qtd.' }, { key: 'shift', label: 'Turno / regime' }, { key: 'note', label: 'Observação' }],
  legal: [{ key: 'entity', label: 'Empresa' }, { key: 'field', label: 'Campo' }, { key: 'value', label: 'Informação' }, { key: 'note', label: 'Observação' }],
  cfi: [{ key: 'item', label: 'Item de custo' }, { key: 'quantity', label: 'Qtd.' }, { key: 'monthlyValue', label: 'Valor unit./mês (R$)' }, { key: 'fleet', label: 'Frota' }, { key: 'note', label: 'Observação' }],
};

const contractFields = [
  'Contrato / projeto', 'RM', 'Centro de custo', 'Centro de trabalho', 'Cliente (contratante)',
  'CNPJ do cliente', 'Site / localidade', 'Vigência do contrato', 'Prazo de mobilização',
  'Prazo de manutenção', 'Data de pré-vistoria', 'Responsável MAKRO pelo contrato',
  'Responsável MAKRO pela documentação', 'Responsável do cliente', 'Endereço do projeto',
];
const legalFields = [
  ['Contratada', 'Nome fantasia'], ['Contratada', 'CNPJ'], ['Contratada', 'Inscrição estadual'],
  ['Contratada', 'Endereço'], ['Contratada', 'CNAE'], ['Contratada', 'Grau de risco'],
  ['Contratada', 'Responsável pelo contrato'], ['Contratada', 'Número do contrato'],
  ['Contratada', 'Prazo contratual'], ['Contratada', 'Objeto contratual'], ['Contratada', 'Horário de trabalho'],
  ['Cliente', 'CNPJ'], ['Cliente', 'Nome fantasia'], ['Cliente', 'Endereço'],
  ['Cliente', 'Grau de risco'], ['Cliente', 'Gestor do contrato'], ['Cliente', 'Local dos serviços'],
  ['MAKRO', 'Razão social'], ['MAKRO', 'CNPJ'], ['MAKRO', 'Responsável pelo contrato'],
  ['MAKRO', 'Número do contrato'], ['MAKRO', 'Prazo contratual'], ['MAKRO', 'Jornada de trabalho'],
];

export function emptyProjectScope(): ProjectScope {
  return {
    contract: contractFields.map((field, index) => ({ id: `contract:${index}`, field, value: '', note: '' })),
    workforce: [],
    legal: legalFields.map(([entity, field], index) => ({ id: `legal:${index}`, entity, field, value: '', note: '' })),
    cfi: [],
  };
}

export function normalizeProjectScope(value: unknown): ProjectScope {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const defaults = emptyProjectScope();
  const result = {} as ProjectScope;
  for (const section of Object.keys(scopeColumns) as ScopeSection[]) {
    const rows = Array.isArray(data[section]) ? data[section] : defaults[section];
    if (rows.length > 150) throw new Error('O limite é de 150 linhas por seção.');
    result[section] = rows.map((row: unknown, index: number) => {
      const source = row && typeof row === 'object' ? row as Record<string, unknown> : {};
      const entry: ScopeRow = { id: String(source.id || `${section}:${index}`).slice(0, 80) };
      for (const { key } of scopeColumns[section]) entry[key] = String(source[key] ?? '').trim().slice(0, 1000);
      return entry;
    });
  }
  return result;
}
