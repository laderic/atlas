import { bi } from '@/lib/i18n'
import type { ImportSource } from '@shared/types'

const pt_ti = {
  title: 'Importar',
  intro: 'Traga textos e tabelas de outras ferramentas. Nada é apagado: tudo é adicionado ao mundo atual.',
  sources: {
    obsidian: { label: 'Obsidian', help: 'Escolha a pasta do cofre (vault). Cada nota vira um card; pastas viram pastas; [[links]] viram @menções; o campo "type:" do frontmatter escolhe o tipo do card.', modes: ['folder'] },
    notion: { label: 'Notion', help: 'Exporte como "Markdown & CSV" e escolha a pasta extraída ou o arquivo .zip. Páginas viram cards e bancos em CSV viram tabelas.', modes: ['folder', 'zip'] },
    worldanvil: { label: 'World Anvil', help: 'Escolha a pasta com os artigos exportados (HTML ou Markdown). Cada artigo vira um card. Se o formato do seu export for diferente, me envie um exemplo que eu ajusto.', modes: ['folder'] },
    googledocs: { label: 'Google Docs', help: 'Baixe os documentos como Word (.docx) ou HTML (Arquivo → Fazer download). Cada documento vira um livro; títulos de nível 1 viram capítulos.', modes: ['files'] },
    word: { label: 'Word', help: 'Escolha um ou mais arquivos .docx. Cada arquivo vira um livro; títulos de nível 1 viram capítulos.', modes: ['files'] }
  } as Record<ImportSource, { label: string; help: string; modes: ('folder' | 'files' | 'zip')[] }>,
  pick: { folder: 'Escolher pasta', files: 'Escolher arquivos', zip: 'Escolher arquivo .zip' },
  picked: (n: number) => (n === 1 ? '1 item escolhido' : `${n} itens escolhidos`),
  scanning: 'Lendo arquivos…',
  preview: 'Prévia',
  willImport: 'Serão criados:',
  cards: (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`,
  tables: (n: number) => `${n} ${n === 1 ? 'tabela' : 'tabelas'}`,
  books: (n: number, c: number) => `${n} ${n === 1 ? 'livro' : 'livros'} (${c} capítulos)`,
  nothing: 'Nada para importar.',
  warnings: 'Avisos',
  start: 'Importar',
  importing: 'Importando…',
  done: (c: { cards: number; tables: number; books: number }) =>
    `Importação concluída: ${c.cards} cards, ${c.tables} tabelas, ${c.books} livros.`,
  back: 'Voltar',
  close: 'Fechar',
  failed: 'Não foi possível importar'
}

const en_ti = {
  title: 'Import',
  intro: 'Bring texts and tables from other tools. Nothing is deleted: everything is added to the current world.',
  sources: {
    obsidian: { label: 'Obsidian', help: 'Choose the vault folder. Each note becomes a card, folders become folders, [[links]] become @mentions, and the type: field in the frontmatter picks the card type.' },
    notion: { label: 'Notion', help: 'Export as Markdown and CSV, then choose the extracted folder or the .zip file. Pages become cards and CSV databases become tables.' },
    worldanvil: { label: 'World Anvil', help: 'Choose the folder with exported articles (HTML or Markdown). Each article becomes a card.' },
    googledocs: { label: 'Google Docs', help: 'Download the documents as Word (.docx) or HTML (File, Download). Each document becomes a book; level-1 headings become chapters.' },
    word: { label: 'Word', help: 'Choose one or more .docx files. Each file becomes a book; level-1 headings become chapters.' }
  },
  pick: { folder: 'Choose folder', files: 'Choose files', zip: 'Choose .zip file' },
  picked: (n: number) => (n === 1 ? '1 item chosen' : `${n} items chosen`),
  scanning: 'Reading files…',
  preview: 'Preview',
  willImport: 'Will create:',
  cards: (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`,
  tables: (n: number) => `${n} ${n === 1 ? 'table' : 'tables'}`,
  books: (n: number, c: number) => `${n} ${n === 1 ? 'book' : 'books'} (${c} chapters)`,
  nothing: 'Nothing to import.',
  warnings: 'Warnings',
  start: 'Import',
  importing: 'Importing…',
  done: (c: { cards: number; tables: number; books: number }) => `Import finished: ${c.cards} cards, ${c.tables} tables, ${c.books} books.`,
  back: 'Back',
  close: 'Close',
  failed: 'Could not import'
}

export const ti = bi(pt_ti, en_ti)
