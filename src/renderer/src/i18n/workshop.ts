import { bi } from '@/lib/i18n'
const pt_to = {
  title: 'Oficina',
  intro: 'Extensões trazem modelos prontos de personagens, cenas e fichas. Cada extensão é um arquivo de dados (.json): ela não executa código.',
  install: 'Instalar extensão (.json)',
  installed: 'Extensões instaladas',
  none: 'Nenhuma extensão instalada. Use o botão acima para instalar, ou o arquivo de exemplo oficina-literaria.json que vem com o Atlas.',
  enabled: 'Ligada',
  remove: 'Remover',
  confirmRemove: (n: string) => `Remover a extensão "${n}"? Os cards e fichas já criados continuam no mundo.`,
  templates: 'Modelos',
  kind: { card: 'Card', ficha: 'Ficha' },
  create: 'Criar',
  createTitle: (n: string) => `Novo: ${n}`,
  titleLabel: 'Nome',
  disabledHint: 'Ligue a extensão para usar os modelos.',
  installed_ok: (n: string) => `Extensão "${n}" instalada.`,
  created: 'Criado.',
  failed: 'Não foi possível concluir'
}

const en_to = {
  title: 'Workshop',
  intro: 'Extensions bring ready-made templates for characters, scenes and sheets. Each extension is a data file (.json): it does not run code.',
  install: 'Install extension (.json)',
  installed: 'Installed extensions',
  none: 'No extensions installed. Use the button above, or the sample file oficina-literaria.json that comes with Atlas.',
  enabled: 'On',
  remove: 'Remove',
  templates: 'Templates',
  kind: { card: 'Card', ficha: 'Sheet' },
  create: 'Create',
  createTitle: (n: string) => `New: ${n}`,
  titleLabel: 'Name',
  disabledHint: 'Turn the extension on to use its templates.',
  created: 'Created.',
  failed: 'Could not complete'
}

export const to = bi(pt_to, en_to)
