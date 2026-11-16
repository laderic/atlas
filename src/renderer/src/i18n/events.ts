import { bi } from '@/lib/i18n'

const pt_te = {
  events: 'Eventos',
  newEvent: 'Novo evento',
  eventName: 'Nome do evento',
  create: 'Criar',
  markEvent: 'Este card é um evento',
  involved: 'Envolvidos',
  involvedHelp: 'Marque os cards envolvidos neste evento. Eles aparecem aqui e no livro.',
  noEvents: 'Nenhum evento ainda. Crie um com o +.',
  pickEvent: 'Escolher evento',
  noAvailable: 'Nenhum evento disponível. Crie um na seção Eventos.',
  searchCards: 'Buscar card…',
  count: (n: number) => (n === 1 ? '1 envolvido' : `${n} envolvidos`),
  openEvent: 'Abrir evento',
  removeFromLine: 'Remover do eixo',
  dateLabel: 'Data ou rótulo',
  positionLabel: 'Posição na linha',
  noEventsInBook: 'Nenhum evento criado ainda.',
  eventsInBook: 'Eventos do mundo'
}

const en_te = {
  events: 'Events',
  newEvent: 'New event',
  eventName: 'Event name',
  create: 'Create',
  markEvent: 'This card is an event',
  involved: 'Involved',
  involvedHelp: 'Check the cards involved in this event. They appear here and in the book.',
  noEvents: 'No events yet. Create one with +.',
  pickEvent: 'Choose event',
  noAvailable: 'No events available. Create one in the Events section.',
  searchCards: 'Search card…',
  count: (n: number) => (n === 1 ? '1 involved' : `${n} involved`),
  openEvent: 'Open event',
  removeFromLine: 'Remove from line',
  dateLabel: 'Date or label',
  positionLabel: 'Position on the line',
  noEventsInBook: 'No events created yet.',
  eventsInBook: 'World events'
}

export const te = bi(pt_te, en_te)
