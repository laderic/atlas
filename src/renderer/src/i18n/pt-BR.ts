import { bi } from '@/lib/i18n'
const pt_t = {
  app: 'Atlas',
  worlds: 'Mundos',
  newWorld: 'Novo mundo',
  newWorldName: 'Nome do mundo',
  newWorldDesc: 'Descrição (opcional)',
  create: 'Criar mundo',
  cancel: 'Cancelar',
  save: 'Salvar',
  rename: 'Renomear',
  remove: 'Excluir mundo',
  confirmRemove: (n: string) => `Excluir "${n}" e tudo que está dentro dele? Esta ação não pode ser desfeita.`,
  emptyTitle: 'Seu primeiro mundo começa aqui',
  emptyBody: 'Crie um mundo para guardar personagens, lugares, mapas e histórias. Tudo fica neste computador.',
  home: 'Início',
  noDescription: 'Adicione uma descrição ao mundo',
  graphEmpty: 'O grafo aparece conforme você cria cards e liga um ao outro com @menções.',
  stats: {
    cards: 'Cards', maps: 'Mapas', timelines: 'Linhas do tempo',
    canvases: 'Quadros', sheets: 'Tabelas', books: 'Livros'
  },
  modules: {
    cards: 'Cards', maps: 'Mapas', timelines: 'Linhas do tempo', canvas: 'Quadros',
    relations: 'Árvores de relações', tables: 'Tabelas', quill: 'Quill', wiki: 'Wiki',
    media: 'Mídia', import: 'Importar', workshop: 'Oficina'
  },
  soon: 'em breve',
  search: 'Busca global',
  searchPlaceholder: 'Buscar mundos e ações…',
  exported: 'Dados exportados.',
  imported: 'Dados importados.',
  exportFail: 'Não foi possível exportar',
  importFail: 'Não foi possível importar',
  closeTab: 'Fechar aba'
}

const en_t = {
  app: 'Atlas',
  worlds: 'Worlds',
  newWorld: 'New world',
  newWorldName: 'World name',
  newWorldDesc: 'Description (optional)',
  create: 'Create world',
  cancel: 'Cancel',
  save: 'Save',
  rename: 'Rename',
  remove: 'Delete world',
  confirmRemove: (n: string) => `Delete "${n}" and everything inside it? This cannot be undone.`,
  emptyTitle: 'Your first world starts here',
  emptyBody: 'Create a world to keep characters, places, maps and stories. Everything stays on this computer.',
  home: 'Home',
  noDescription: 'Add a description to the world',
  graphEmpty: 'The graph appears as you create cards and link them with @mentions.',
  stats: { cards: 'Cards', maps: 'Maps', timelines: 'Timelines', canvases: 'Boards', sheets: 'Tables', books: 'Books' },
  modules: { cards: 'Cards', maps: 'Maps', timelines: 'Timelines', canvas: 'Boards', relations: 'Relation trees', tables: 'Tables', quill: 'Writing', wiki: 'Wiki', media: 'Media', import: 'Import', workshop: 'Workshop' },
  soon: 'soon',
  search: 'Global search',
  searchPlaceholder: 'Search worlds and actions…',
  exported: 'Data exported.',
  imported: 'Data imported.',
  exportFail: 'Could not export',
  importFail: 'Could not import',
  closeTab: 'Close tab'
}

export const t = bi(pt_t, en_t)
