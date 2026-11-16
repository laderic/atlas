export interface World {
  id: string
  name: string
  description: string | null
  cover_media_id: string | null
  theme: string
  settings: string
  created_at: number
  updated_at: number
}

export interface GraphNode {
  id: string
  label: string
  type: string | null
  color: string | null
}
export interface GraphLink {
  source: string
  target: string
}
export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export interface WorldStats {
  cards: number
  maps: number
  timelines: number
  canvases: number
  sheets: number
  books: number
}

export type BackupResult = { ok: boolean; path?: string; message?: string }


// ---------- Cards (Fase 2) ----------
export type FieldKind = 'text' | 'longtext' | 'number' | 'select' | 'card' | 'chips'
export interface CardField {
  key: string
  label: string
  kind: FieldKind
  options?: string[]
}
export interface CardType {
  id: string
  world_id: string
  name: string
  icon: string | null
  color: string | null
  fields: CardField[]
}
export interface CardTypeInput {
  id?: string
  name: string
  icon?: string | null
  color?: string | null
  fields: CardField[]
}
export interface CardSummary {
  id: string
  world_id: string
  type_id: string | null
  folder_id: string | null
  title: string
  updated_at: number
  image_id: string | null
  cover_media_id: string | null
  is_event: number
}
export interface Card extends CardSummary {
  content: Record<string, unknown>
  properties: Record<string, unknown>
  image_id: string | null
  created_at: number
}
export interface CardPatch {
  title?: string
  type_id?: string | null
  folder_id?: string | null
  image_id?: string | null
  cover_media_id?: string | null
  content?: Record<string, unknown>
  properties?: Record<string, unknown>
}
export interface Folder {
  id: string
  world_id: string
  parent_id: string | null
  scope: string
  name: string
  position: number
  color: string | null
}
export interface Tag {
  id: string
  world_id: string
  name: string
  color: string
  description: string | null
}
export interface TagMap {
  tags: Tag[]
  links: [string, string][]
}
export interface SearchHit {
  id: string
  title: string
  snippet: string
}


// ---------- Mídia (Fase 3) ----------
export type MediaType = 'image' | 'gif' | 'video' | 'audio'
export interface MediaItem {
  id: string
  world_id: string | null
  file_path: string
  type: MediaType
  name: string
  hash: string | null
  size: number | null
  folder_id: string | null
}
export interface ImportResult {
  items: MediaItem[]
  skipped: number
  failed: number
}


// ---------- Mapas (Fase 4) ----------
export type FeatureKind = 'pin' | 'region' | 'zone' | 'label' | 'path'
export type Geometry = { x: number; y: number } | { points: [number, number][] }
export interface FeatureStyle {
  color?: string
  size?: 'sm' | 'md' | 'lg'
  dash?: boolean
}
export interface MapSummary {
  id: string
  world_id: string
  name: string
  image_id: string | null
  width: number | null
  height: number | null
}
export interface MapFeature {
  id: string
  map_id: string
  kind: FeatureKind
  geometry: Geometry
  label: string | null
  notes: string | null
  style: FeatureStyle
  card_id: string | null
  child_map_id: string | null
}
export interface MapFeatureInput {
  kind: FeatureKind
  geometry: Geometry
  label?: string | null
  style?: FeatureStyle
}
export interface MapFeaturePatch {
  geometry?: Geometry
  label?: string | null
  notes?: string | null
  style?: FeatureStyle
  card_id?: string | null
  child_map_id?: string | null
}
export interface CardMapRef {
  id: string
  map_id: string
  map_name: string
  label: string | null
  kind: FeatureKind
}


// ---------- Linhas do tempo (Fase 5) ----------
export interface TimelineSummary {
  id: string
  world_id: string
  name: string
  unit: string
}
export interface Era {
  id: string
  timeline_id: string
  name: string
  color: string | null
  start_value: number | null
  end_value: number | null
  position: number
}
export interface TimelineEvent {
  id: string
  timeline_id: string
  era_id: string | null
  version: string
  title: string
  description: string | null
  sort_value: number
  date_label: string | null
  card_id: string | null
}
export interface TimelineVersion {
  id: string
  world_id: string
  name: string
  position: number
}
export type LifeStart = 'nascimento' | 'fundacao'
export type LifeEnd = 'morte' | 'abandono' | 'destruicao' | 'dissolucao' | 'fim'
export interface TimelineLife {
  id: string
  timeline_id: string
  card_id: string
  start_value: number
  start_kind: LifeStart
  end_value: number | null
  end_kind: LifeEnd | null
}
export interface TimelineDetail {
  timeline: TimelineSummary
  eras: Era[]
  lives: TimelineLife[]
  events: TimelineEvent[]
  versions: TimelineVersion[]
}
export interface EventRef {
  id: string
  timeline_id: string
  timeline_name: string
  title: string
  date_label: string | null
  version: string
}
export interface EraInput {
  name: string
  color: string | null
  start_value: number | null
  end_value: number | null
}
export interface EraPatch {
  name?: string
  color?: string | null
  start_value?: number | null
  end_value?: number | null
}
export interface EventInput {
  title: string
  description: string | null
  sort_value: number
  date_label: string | null
  era_id: string | null
  version: string
  card_id: string | null
}
export interface EventPatch {
  title?: string
  description?: string | null
  sort_value?: number
  date_label?: string | null
  era_id?: string | null
  version?: string
  card_id?: string | null
}


// ---------- Quadros e árvores de relações (Fase 6) ----------
export type CanvasKind = 'canvas' | 'relation_tree'
export type CanvasElementKind = 'note' | 'card' | 'image' | 'shape' | 'edge'
export interface CanvasSummary {
  id: string
  world_id: string
  name: string
  kind: CanvasKind
}
export interface CanvasNodeData {
  x: number
  y: number
  w?: number
  h?: number
  text?: string
  color?: string
  shape?: 'rect' | 'ellipse'
  label?: string
  from?: string
  to?: string
}
export interface CanvasElement {
  id: string
  canvas_id: string
  kind: CanvasElementKind
  data: CanvasNodeData
  card_id: string | null
  media_id: string | null
}
export interface Viewport {
  s: number
  x: number
  y: number
}
export interface CanvasDetail {
  canvas: CanvasSummary
  elements: CanvasElement[]
  viewport: Viewport | null
}
export interface ElementInput {
  kind: CanvasElementKind
  data: CanvasNodeData
  card_id?: string | null
  media_id?: string | null
}
export interface ElementPatch {
  data?: CanvasNodeData
  card_id?: string | null
  media_id?: string | null
}
export interface MoveItem {
  id: string
  x: number
  y: number
}


// ---------- Fichas e tabelas (Fase 7) ----------
export type SheetKind = 'ficha' | 'tabela'
export interface SheetSummary {
  id: string
  world_id: string
  name: string
  kind: SheetKind
  card_id: string | null
}
export interface SheetAttr {
  key: string
  label: string
  options: string[]
}
export interface FichaValue {
  value: string | null
  note: string
}
export interface SheetCol {
  key: string
  label: string
  type: 'text' | 'number'
}
export type SheetRow = Record<string, string | number | null>
export interface SheetDetail {
  sheet: SheetSummary
  attrs: SheetAttr[]
  cols: SheetCol[]
  values: Record<string, FichaValue>
  rows: SheetRow[]
}
export interface SheetSavePatch {
  name?: string
  attrs?: SheetAttr[]
  values?: Record<string, FichaValue>
  cols?: SheetCol[]
  rows?: SheetRow[]
}


// ---------- Quill: escrita (Fase 8) ----------
export interface QuillBook {
  id: string
  world_id: string
  title: string
  synopsis: string | null
  cover_media_id: string | null
  chapters: number
  words: number
}
export interface QuillChapter {
  id: string
  book_id: string
  title: string
  content: Record<string, unknown>
  notes: string
  position: number
  word_count: number
}
export interface QuillChapterPatch {
  title?: string
  content?: Record<string, unknown>
  notes?: string
  word_count?: number
}
export interface QuillRevision {
  id: string
  chapter_id: string
  content: Record<string, unknown>
  created_at: number
  words: number
}
export interface RadioStation {
  id: string
  world_id: string
  name: string
  playlist: string[]
}


// ---------- Wiki estática (Fase 9) ----------
export type WikiTheme = 'escuro' | 'claro' | 'pergaminho'
export interface WikiSettings {
  title: string
  theme: WikiTheme
  output_dir: string
  local_domain: string
  port: number
}
export interface WikiCardRow {
  card_id: string
  title: string
  type: string | null
  published: boolean
}
export interface WikiState {
  settings: WikiSettings
  cards: WikiCardRow[]
  serving: string | null
}
export interface WikiPublishResult {
  pages: number
  dir: string
}


// ---------- Importação (Fase 10) ----------
export type ImportSource = 'obsidian' | 'notion' | 'worldanvil' | 'googledocs' | 'word'
export type ImportPickMode = 'folder' | 'files' | 'zip'
export interface RawNote {
  title: string
  folder: string[]
  format: 'md' | 'html'
  text: string
  asBook: boolean
}
export interface RawTable {
  name: string
  csv: string
}
export interface RawImport {
  source: ImportSource
  notes: RawNote[]
  tables: RawTable[]
  warnings: string[]
}
export interface ImportPayload {
  cards: {
    removeWithUndo(id: string): Promise<CardSnapshot>
    restore(snap: CardSnapshot): Promise<void>
    title: string
    folder: string[]
    typeName: string | null
    props: Record<string, string>
    content: Record<string, unknown>
  }[]
  tables: { name: string; columns: string[]; rows: string[][] }[]
  books: { title: string; chapters: { title: string; content: Record<string, unknown> }[] }[]
}
export interface ImportCounts {
  cards: number
  tables: number
  books: number
}


// ---------- Oficina de extensões (Fase 11) ----------
export interface WorkshopField {
  key: string
  label: string
  kind: 'text' | 'longtext' | 'number' | 'select'
  options: string[]
}
export interface WorkshopSection {
  title: string
  prompt: string
}
export interface WorkshopTemplate {
  id: string
  name: string
  kind: 'card' | 'ficha'
  typeName: string
  fields: WorkshopField[]
  sections: WorkshopSection[]
}
export interface WorkshopTool {
  id: string
  name: string
  version: string
  description: string
  enabled: boolean
  templates: WorkshopTemplate[]
}


// ---------- Estoque de arte ----------
export interface StockItem {
  id: string
  genre: string
  genreLabel: string
  subgenre: string
  file: string
  width: number
  height: number
}
export interface StockIndex {
  genres: { slug: string; label: string }[]
  items: StockItem[]
}

// ---------- Desfazer exclusão de card ----------
export interface CardSnapshot {
  card: Record<string, unknown>
  cascade: { table: string; rows: Record<string, unknown>[] }[]
  nulled: { table: string; col: string; rowids: number[] }[]
}

export type MenuAction = 'novo-mundo' | 'exportar' | 'importar' | 'paleta'

export interface Api {
  worlds: {
    list(): Promise<World[]>
    create(name: string, description?: string): Promise<World>
    update(
      id: string,
      patch: { name?: string; description?: string | null; cover_media_id?: string | null; theme?: string }
    ): Promise<World>
    remove(id: string): Promise<void>
    graph(id: string): Promise<GraphData>
    stats(id: string): Promise<WorldStats>
  }
  cardTypes: {
    list(worldId: string): Promise<CardType[]>
    save(worldId: string, input: CardTypeInput): Promise<CardType>
    remove(id: string): Promise<void>
  }
  cards: {
    list(worldId: string): Promise<CardSummary[]>
    get(id: string): Promise<Card | null>
    create(
      worldId: string,
      input: { title?: string; type_id?: string | null; folder_id?: string | null }
    ): Promise<Card>
    update(id: string, patch: CardPatch): Promise<CardSummary>
    remove(id: string): Promise<void>
    backlinks(id: string): Promise<CardSummary[]>
    createStub(worldId: string, title: string): Promise<CardSummary>
  }
  folders: {
    list(worldId: string): Promise<Folder[]>
    create(worldId: string, name: string, parentId: string | null): Promise<Folder>
    color(id: string, color: string | null): Promise<void>
    rename(id: string, name: string): Promise<void>
    remove(id: string): Promise<void>
  }
  search: {
    query(worldId: string, q: string): Promise<SearchHit[]>
  }
  media: {
    list(worldId: string): Promise<MediaItem[]>
    pick(worldId: string, folderId: string | null): Promise<ImportResult>
    pickFolder(worldId: string): Promise<ImportResult & { folders: Folder[] }>
    importPaths(worldId: string, folderId: string | null, paths: string[]): Promise<ImportResult>
    importUrls(
      worldId: string,
      folderId: string | null,
      urls: string[]
    ): Promise<ImportResult & { errors: string[] }>
    pathForFile(file: File): string
    rename(id: string, name: string): Promise<MediaItem>
    move(id: string, folderId: string | null): Promise<MediaItem>
    remove(id: string): Promise<void>
    saveCrop(id: string, bytes: Uint8Array, mime: string, mode: 'copy' | 'replace'): Promise<MediaItem>
  }
  maps: {
    list(worldId: string): Promise<MapSummary[]>
    create(
      worldId: string,
      input: { name: string; image_id: string | null; width: number | null; height: number | null }
    ): Promise<MapSummary>
    rename(id: string, name: string): Promise<MapSummary>
    remove(id: string): Promise<void>
    features(mapId: string): Promise<MapFeature[]>
    createFeature(mapId: string, input: MapFeatureInput): Promise<MapFeature>
    updateFeature(id: string, patch: MapFeaturePatch): Promise<MapFeature>
    removeFeature(id: string): Promise<void>
    featuresForCard(cardId: string): Promise<CardMapRef[]>
  }
  lives: {
    forCard(cardId: string): Promise<(TimelineLife & { timeline_name: string })[]>
    upsert(timelineId: string, cardId: string, input: { start_value: number; start_kind: LifeStart; end_value: number | null; end_kind: LifeEnd | null }): Promise<TimelineLife>
    patch(id: string, patch: Partial<Omit<TimelineLife, 'id' | 'timeline_id' | 'card_id'>>): Promise<void>
    remove(id: string): Promise<void>
  }
  timelines: {
    list(worldId: string): Promise<TimelineSummary[]>
    create(worldId: string, name: string): Promise<TimelineSummary>
    update(id: string, patch: { name?: string; unit?: string }): Promise<TimelineSummary>
    remove(id: string): Promise<void>
    detail(id: string): Promise<TimelineDetail>
    eventsForCard(cardId: string): Promise<EventRef[]>
    createEra(timelineId: string, input: EraInput): Promise<Era>
    updateEra(id: string, patch: EraPatch): Promise<Era>
    removeEra(id: string): Promise<void>
    createEvent(timelineId: string, input: EventInput): Promise<TimelineEvent>
    updateEvent(id: string, patch: EventPatch): Promise<TimelineEvent>
    removeEvent(id: string): Promise<void>
    createVersion(worldId: string, name: string): Promise<TimelineVersion>
    renameVersion(id: string, name: string): Promise<void>
    removeVersion(id: string): Promise<void>
  }
  canvas: {
    list(worldId: string): Promise<CanvasSummary[]>
    create(worldId: string, name: string, kind: CanvasKind): Promise<CanvasSummary>
    rename(id: string, name: string): Promise<CanvasSummary>
    remove(id: string): Promise<void>
    get(id: string): Promise<CanvasDetail>
    saveViewport(id: string, vp: Viewport): Promise<void>
    syncRelations(id: string): Promise<void>
  }
  elements: {
    create(canvasId: string, input: ElementInput): Promise<CanvasElement>
    update(id: string, patch: ElementPatch): Promise<CanvasElement>
    moveMany(items: MoveItem[]): Promise<void>
    remove(id: string): Promise<void>
    removeNode(id: string): Promise<void>
  }
  relations: {
    create(canvasId: string, fromId: string, toId: string, relation: string): Promise<CanvasElement>
  }
  sheets: {
    list(worldId: string): Promise<SheetSummary[]>
    forCard(cardId: string): Promise<SheetSummary[]>
    get(id: string): Promise<SheetDetail>
    create(worldId: string, name: string, kind: SheetKind, cardId: string | null): Promise<SheetDetail>
    rename(id: string, name: string): Promise<void>
    save(id: string, patch: SheetSavePatch): Promise<void>
    remove(id: string): Promise<void>
  }
  quill: {
    books(worldId: string): Promise<QuillBook[]>
    createBook(worldId: string, title: string): Promise<QuillBook>
    updateBook(id: string, patch: { title?: string; synopsis?: string | null }): Promise<void>
    removeBook(id: string): Promise<void>
    chapters(bookId: string): Promise<QuillChapter[]>
    createChapter(bookId: string, title: string): Promise<QuillChapter>
    updateChapter(id: string, patch: QuillChapterPatch): Promise<void>
    moveChapter(id: string, dir: -1 | 1): Promise<void>
    removeChapter(id: string): Promise<void>
    revisions(chapterId: string): Promise<QuillRevision[]>
    snapshot(chapterId: string): Promise<void>
    restore(revisionId: string): Promise<void>
    removeRevision(id: string): Promise<void>
  }
  radio: {
    list(worldId: string): Promise<RadioStation[]>
    create(worldId: string, name: string): Promise<RadioStation>
    update(id: string, patch: { name?: string; playlist?: string[] }): Promise<RadioStation>
    remove(id: string): Promise<void>
  }
  wiki: {
    state(worldId: string): Promise<WikiState>
    save(worldId: string, patch: Partial<WikiSettings>): Promise<WikiState>
    setPublished(worldId: string, cardId: string, published: boolean): Promise<void>
    chooseDir(): Promise<string | null>
    publish(worldId: string): Promise<WikiPublishResult>
    serve(worldId: string): Promise<string>
    stop(): Promise<void>
    openFolder(worldId: string): Promise<void>
  }
  import: {
    pick(source: ImportSource, mode: ImportPickMode): Promise<string[]>
    scan(source: ImportSource, paths: string[]): Promise<RawImport>
    commit(worldId: string, payload: ImportPayload): Promise<ImportCounts>
  }
  workshop: {
    list(): Promise<WorkshopTool[]>
    install(): Promise<WorkshopTool | null>
    setEnabled(id: string, enabled: boolean): Promise<void>
    remove(id: string): Promise<void>
    create(worldId: string, toolId: string, templateId: string, title: string): Promise<{ kind: 'card' | 'ficha'; id: string }>
  }
  tags: {
    map(worldId: string): Promise<TagMap>
    create(worldId: string, name: string, color: string): Promise<Tag>
    update(id: string, patch: { name?: string; color?: string; description?: string | null }): Promise<void>
    remove(id: string): Promise<void>
    setCardTags(cardId: string, tagIds: string[]): Promise<void>
  }
  config: {
    get(): Promise<{ lang: 'pt-BR' | 'en' }>
    setLang(lang: 'pt-BR' | 'en'): Promise<void>
  }
  eventCards: {
    list(worldId: string): Promise<CardSummary[]>
    participants(eventId: string): Promise<CardSummary[]>
    setParticipants(eventId: string, cardIds: string[]): Promise<void>
    setFlag(cardId: string, on: boolean): Promise<void>
  }
  highlights: {
    list(worldId: string): Promise<CardSummary[]>
    set(worldId: string, cardIds: string[]): Promise<void>
  }
  inventory: {
    list(cardId: string): Promise<CardSummary[]>
    map(worldId: string): Promise<{ links: [string, string][]; unique: string[]; titles: Record<string, string> }>
    set(cardId: string, itemIds: string[]): Promise<void>
  }
  stock: {
    index(): Promise<StockIndex>
    import(worldId: string, folderId: string | null, ids: string[]): Promise<ImportResult>
  }
  mediaFolders: {
    list(worldId: string): Promise<Folder[]>
    create(worldId: string, name: string): Promise<Folder>
    rename(id: string, name: string): Promise<void>
    remove(id: string): Promise<void>
  }
  backup: {
    exportAll(): Promise<BackupResult>
    importAll(): Promise<BackupResult>
  }
  onMenu(cb: (action: MenuAction) => void): () => void
}
