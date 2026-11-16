import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Api, MenuAction } from '@shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args)

const api: Api = {
  worlds: {
    list: () => invoke('worlds:list'),
    create: (name, description) => invoke('worlds:create', name, description),
    update: (id, patch) => invoke('worlds:update', id, patch),
    remove: (id) => invoke('worlds:remove', id),
    graph: (id) => invoke('worlds:graph', id),
    stats: (id) => invoke('worlds:stats', id)
  },
  cardTypes: {
    list: (worldId) => invoke('cardTypes:list', worldId),
    save: (worldId, input) => invoke('cardTypes:save', worldId, input),
    remove: (id) => invoke('cardTypes:remove', id)
  },
  cards: {
    removeWithUndo: (id) => invoke('cards:removeWithUndo', id),
    restore: (snap) => invoke('cards:restore', snap),
    list: (worldId) => invoke('cards:list', worldId),
    get: (id) => invoke('cards:get', id),
    create: (worldId, input) => invoke('cards:create', worldId, input),
    update: (id, patch) => invoke('cards:update', id, patch),
    remove: (id) => invoke('cards:remove', id),
    backlinks: (id) => invoke('cards:backlinks', id),
    createStub: (worldId, title) => invoke('cards:createStub', worldId, title)
  },
  folders: {
    list: (worldId) => invoke('folders:list', worldId),
    create: (worldId, name, parentId) => invoke('folders:create', worldId, name, parentId),
    color: (id, color) => invoke('folders:color', id, color),
    rename: (id, name) => invoke('folders:rename', id, name),
    remove: (id) => invoke('folders:remove', id)
  },
  search: {
    query: (worldId, q) => invoke('search:query', worldId, q)
  },
  media: {
    list: (worldId) => invoke('media:list', worldId),
    pick: (worldId, folderId) => invoke('media:pick', worldId, folderId),
    pickFolder: (worldId) => invoke('media:pickFolder', worldId),
    importPaths: (worldId, folderId, paths) => invoke('media:importPaths', worldId, folderId, paths),
    importUrls: (worldId, folderId, urls) => invoke('media:importUrls', worldId, folderId, urls),
    pathForFile: (file) => webUtils.getPathForFile(file),
    rename: (id, name) => invoke('media:rename', id, name),
    move: (id, folderId) => invoke('media:move', id, folderId),
    remove: (id) => invoke('media:remove', id),
    saveCrop: (id, bytes, mime, mode) => invoke('media:saveCrop', id, bytes, mime, mode)
  },
  maps: {
    list: (worldId) => invoke('maps:list', worldId),
    create: (worldId, input) => invoke('maps:create', worldId, input),
    rename: (id, name) => invoke('maps:rename', id, name),
    remove: (id) => invoke('maps:remove', id),
    features: (mapId) => invoke('maps:features', mapId),
    createFeature: (mapId, input) => invoke('maps:createFeature', mapId, input),
    updateFeature: (id, patch) => invoke('maps:updateFeature', id, patch),
    removeFeature: (id) => invoke('maps:removeFeature', id),
    featuresForCard: (cardId) => invoke('maps:featuresForCard', cardId)
  },
  lives: {
    forCard: (cardId) => invoke('lives:forCard', cardId),
    upsert: (timelineId, cardId, input) => invoke('lives:upsert', timelineId, cardId, input),
    patch: (id, patch) => invoke('lives:patch', id, patch),
    remove: (id) => invoke('lives:remove', id)
  },
  timelines: {
    list: (worldId) => invoke('timelines:list', worldId),
    create: (worldId, name) => invoke('timelines:create', worldId, name),
    update: (id, patch) => invoke('timelines:update', id, patch),
    remove: (id) => invoke('timelines:remove', id),
    detail: (id) => invoke('timelines:detail', id),
    eventsForCard: (cardId) => invoke('timelines:eventsForCard', cardId),
    createEra: (timelineId, input) => invoke('eras:create', timelineId, input),
    updateEra: (id, patch) => invoke('eras:update', id, patch),
    removeEra: (id) => invoke('eras:remove', id),
    createEvent: (timelineId, input) => invoke('events:create', timelineId, input),
    updateEvent: (id, patch) => invoke('events:update', id, patch),
    removeEvent: (id) => invoke('events:remove', id),
    createVersion: (worldId, name) => invoke('versions:create', worldId, name),
    renameVersion: (id, name) => invoke('versions:rename', id, name),
    removeVersion: (id) => invoke('versions:remove', id)
  },
  canvas: {
    list: (worldId) => invoke('canvas:list', worldId),
    create: (worldId, name, kind) => invoke('canvas:create', worldId, name, kind),
    rename: (id, name) => invoke('canvas:rename', id, name),
    remove: (id) => invoke('canvas:remove', id),
    get: (id) => invoke('canvas:get', id),
    saveViewport: (id, vp) => invoke('canvas:saveViewport', id, vp),
    syncRelations: (id) => invoke('canvas:syncRelations', id)
  },
  elements: {
    create: (canvasId, input) => invoke('elements:create', canvasId, input),
    update: (id, patch) => invoke('elements:update', id, patch),
    moveMany: (items) => invoke('elements:moveMany', items),
    remove: (id) => invoke('elements:remove', id),
    removeNode: (id) => invoke('elements:removeNode', id)
  },
  relations: {
    create: (canvasId, fromId, toId, relation) => invoke('relations:create', canvasId, fromId, toId, relation)
  },
  sheets: {
    list: (worldId) => invoke('sheets:list', worldId),
    forCard: (cardId) => invoke('sheets:forCard', cardId),
    get: (id) => invoke('sheets:get', id),
    create: (worldId, name, kind, cardId) => invoke('sheets:create', worldId, name, kind, cardId),
    rename: (id, name) => invoke('sheets:rename', id, name),
    save: (id, patch) => invoke('sheets:save', id, patch),
    remove: (id) => invoke('sheets:remove', id)
  },
  quill: {
    books: (worldId) => invoke('quill:books', worldId),
    createBook: (worldId, title) => invoke('quill:createBook', worldId, title),
    updateBook: (id, patch) => invoke('quill:updateBook', id, patch),
    removeBook: (id) => invoke('quill:removeBook', id),
    chapters: (bookId) => invoke('quill:chapters', bookId),
    createChapter: (bookId, title) => invoke('quill:createChapter', bookId, title),
    updateChapter: (id, patch) => invoke('quill:updateChapter', id, patch),
    moveChapter: (id, dir) => invoke('quill:moveChapter', id, dir),
    removeChapter: (id) => invoke('quill:removeChapter', id),
    revisions: (chapterId) => invoke('quill:revisions', chapterId),
    snapshot: (chapterId) => invoke('quill:snapshot', chapterId),
    restore: (revisionId) => invoke('quill:restore', revisionId),
    removeRevision: (id) => invoke('quill:removeRevision', id)
  },
  radio: {
    list: (worldId) => invoke('radio:list', worldId),
    create: (worldId, name) => invoke('radio:create', worldId, name),
    update: (id, patch) => invoke('radio:update', id, patch),
    remove: (id) => invoke('radio:remove', id)
  },
  wiki: {
    state: (worldId) => invoke('wiki:state', worldId),
    save: (worldId, patch) => invoke('wiki:save', worldId, patch),
    setPublished: (worldId, cardId, published) => invoke('wiki:setPublished', worldId, cardId, published),
    chooseDir: () => invoke('wiki:chooseDir'),
    publish: (worldId) => invoke('wiki:publish', worldId),
    serve: (worldId) => invoke('wiki:serve', worldId),
    stop: () => invoke('wiki:stop'),
    openFolder: (worldId) => invoke('wiki:openFolder', worldId)
  },
  import: {
    pick: (source, mode) => invoke('import:pick', source, mode),
    scan: (source, paths) => invoke('import:scan', source, paths),
    commit: (worldId, payload) => invoke('import:commit', worldId, payload)
  },
  workshop: {
    list: () => invoke('workshop:list'),
    install: () => invoke('workshop:install'),
    setEnabled: (id, enabled) => invoke('workshop:setEnabled', id, enabled),
    remove: (id) => invoke('workshop:remove', id),
    create: (worldId, toolId, templateId, title) => invoke('workshop:create', worldId, toolId, templateId, title)
  },
  tags: {
    map: (worldId) => invoke('tags:map', worldId),
    create: (worldId, name, color) => invoke('tags:create', worldId, name, color),
    update: (id, patch) => invoke('tags:update', id, patch),
    remove: (id) => invoke('tags:remove', id),
    setCardTags: (cardId, tagIds) => invoke('tags:setCardTags', cardId, tagIds)
  },
  config: {
    get: () => invoke('config:get'),
    setLang: (lang) => invoke('config:setLang', lang)
  },
  eventCards: {
    list: (worldId) => invoke('eventCards:list', worldId),
    participants: (eventId) => invoke('eventCards:participants', eventId),
    setParticipants: (eventId, cardIds) => invoke('eventCards:setParticipants', eventId, cardIds),
    setFlag: (cardId, on) => invoke('eventCards:setFlag', cardId, on)
  },
  highlights: {
    list: (worldId) => invoke('highlights:list', worldId),
    set: (worldId, cardIds) => invoke('highlights:set', worldId, cardIds)
  },
  inventory: {
    list: (cardId) => invoke('inventory:list', cardId),
    map: (worldId) => invoke('inventory:map', worldId),
    set: (cardId, itemIds) => invoke('inventory:set', cardId, itemIds)
  },
  stock: {
    index: () => invoke('stock:index'),
    import: (worldId, folderId, ids) => invoke('stock:import', worldId, folderId, ids)
  },
  mediaFolders: {
    list: (worldId) => invoke('mediaFolders:list', worldId),
    create: (worldId, name) => invoke('mediaFolders:create', worldId, name),
    rename: (id, name) => invoke('mediaFolders:rename', id, name),
    remove: (id) => invoke('mediaFolders:remove', id)
  },
  backup: {
    exportAll: () => invoke('backup:export'),
    importAll: () => invoke('backup:import')
  },
  onMenu: (cb) => {
    const handler = (_: unknown, action: MenuAction): void => cb(action)
    ipcRenderer.on('menu', handler)
    return () => ipcRenderer.removeListener('menu', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
