// Migração v1 — schema completo. Pragmas ficam em connection.ts.
export const SCHEMA_V1 = `
CREATE TABLE worlds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  theme TEXT NOT NULL DEFAULT 'dark',
  settings TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  world_id TEXT REFERENCES worlds(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  hash TEXT,
  size INTEGER,
  folder_id TEXT
);

CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE card_types (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  schema TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  type_id TEXT REFERENCES card_types(id) ON DELETE SET NULL,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '{}',
  image_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  properties TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE card_links (
  source_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  target_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  relation TEXT NOT NULL DEFAULT 'mention',
  PRIMARY KEY (source_card_id, target_card_id, relation)
);

CREATE TABLE maps (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  image_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  width INTEGER,
  height INTEGER
);

CREATE TABLE map_features (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  geometry TEXT NOT NULL,
  label TEXT,
  style TEXT NOT NULL DEFAULT '{}',
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
  child_map_id TEXT REFERENCES maps(id) ON DELETE SET NULL
);

CREATE TABLE timelines (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calendar TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE eras (
  id TEXT PRIMARY KEY,
  timeline_id TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  start_value REAL,
  end_value REAL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE timeline_events (
  id TEXT PRIMARY KEY,
  timeline_id TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  era_id TEXT REFERENCES eras(id) ON DELETE SET NULL,
  version TEXT NOT NULL DEFAULT 'canon',
  title TEXT NOT NULL,
  description TEXT,
  sort_value REAL NOT NULL,
  date_label TEXT,
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL
);

CREATE TABLE canvases (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'canvas',
  viewport TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE canvas_elements (
  id TEXT PRIMARY KEY,
  canvas_id TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  data TEXT NOT NULL,
  card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
  media_id TEXT REFERENCES media(id) ON DELETE SET NULL
);

CREATE TABLE sheets (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  columns TEXT NOT NULL DEFAULT '[]',
  rows TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE quill_books (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  synopsis TEXT,
  cover_media_id TEXT
);

CREATE TABLE quill_chapters (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES quill_books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '{}',
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE quill_revisions (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES quill_chapters(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE radio_stations (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  playlist TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE wiki_settings (
  world_id TEXT PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
  title TEXT,
  theme TEXT,
  output_dir TEXT,
  local_domain TEXT
);

CREATE TABLE wiki_pages (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  published INTEGER NOT NULL DEFAULT 0,
  slug TEXT NOT NULL
);

CREATE TABLE workshop_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT,
  manifest TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1
);

CREATE VIRTUAL TABLE search_index USING fts5(
  entity_type, entity_id UNINDEXED, world_id UNINDEXED, title, body,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE INDEX idx_cards_world ON cards(world_id, type_id, folder_id);
CREATE INDEX idx_links_target ON card_links(target_card_id);
CREATE INDEX idx_features_map ON map_features(map_id);
CREATE INDEX idx_events_timeline ON timeline_events(timeline_id, sort_value);
CREATE INDEX idx_folders_world ON folders(world_id, scope);
`
