import { bi } from '@/lib/i18n'

const pt_tl = {
  lanesTitle: 'Nascimentos e origens',
  lanesHelp: 'Personagens nascem; locais são fundados. Marque o fim quando alguém morrer ou um lugar for abandonado.',
  addLife: '+ Adicionar',
  pickLife: 'Escolher card',
  noCardsLeft: 'Todos os cards já estão nesta faixa.',
  kinds: { nascimento: 'Nascimento', fundacao: 'Fundação', morte: 'Morte', abandono: 'Abandono', destruicao: 'Destruição', dissolucao: 'Dissolução', fim: 'Fim' },
  searchCards: 'Buscar card…',
  markEnd: 'Marcar fim',
  removeEnd: 'Remover fim',
  removeLife: 'Remover da faixa',
  startLabel: 'Início',
  endLabel: 'Fim',
  cardLinesTitle: 'Linhas do tempo',
  noLanes: 'Nenhum nascimento ou fundação nesta linha ainda.'
}

const en_tl = {
  lanesTitle: 'Births and origins',
  lanesHelp: 'Characters are born; places are founded. Mark the end when someone dies or a place is abandoned.',
  addLife: '+ Add',
  pickLife: 'Choose card',
  noCardsLeft: 'All cards are already in this lane.',
  kinds: { nascimento: 'Birth', fundacao: 'Founded', morte: 'Death', abandono: 'Abandoned', destruicao: 'Destroyed', dissolucao: 'Dissolved', fim: 'End' },
  searchCards: 'Search card…',
  markEnd: 'Mark end',
  removeEnd: 'Remove end',
  removeLife: 'Remove from lane',
  startLabel: 'Start',
  endLabel: 'End',
  cardLinesTitle: 'Timelines',
  noLanes: 'No births or foundations on this line yet.'
}

export const tl = bi(pt_tl, en_tl)
