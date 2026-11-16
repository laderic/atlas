import type Database from 'better-sqlite3'
import { SCHEMA_V1 } from './schema.sql'

interface Migration {
  version: number
  sql: string
}

// Para evoluir o schema, adicione uma nova entrada (nunca edite as antigas).
const MIGRATIONS: Migration[] = [
  { version: 1, sql: SCHEMA_V1 },
  { version: 2, sql: 'ALTER TABLE map_features ADD COLUMN notes TEXT;' },
  {
    version: 3,
    sql: `CREATE TABLE timeline_versions (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      UNIQUE (world_id, name)
    );`
  },
  {
    version: 4,
    sql: `ALTER TABLE sheets ADD COLUMN kind TEXT NOT NULL DEFAULT 'tabela';
ALTER TABLE sheets ADD COLUMN card_id TEXT REFERENCES cards(id) ON DELETE SET NULL;`
  },
  {
    version: 5,
    sql: `CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#9a9cab',
      UNIQUE (world_id, name)
    );
    CREATE TABLE card_tags (
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (card_id, tag_id)
    );
    ALTER TABLE cards ADD COLUMN cover_media_id TEXT REFERENCES media(id) ON DELETE SET NULL;
    ALTER TABLE folders ADD COLUMN color TEXT;`
  },
  {
    version: 6,
    sql: `ALTER TABLE tags ADD COLUMN description TEXT;`
  },
  {
    version: 7,
    sql: `CREATE TABLE radio_online (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      youtube_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );`
  },
  {
    version: 8,
    sql: `ALTER TABLE cards ADD COLUMN is_event INTEGER NOT NULL DEFAULT 0;
CREATE TABLE event_participants (
  event_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, card_id)
);
DROP TABLE IF EXISTS radio_online;
INSERT INTO cards (id, world_id, type_id, folder_id, title, content, properties, created_at, updated_at, is_event)
SELECT e.id, t.world_id, NULL, NULL, e.title,
  CASE WHEN e.description IS NULL OR e.description = ''
    THEN '{"type":"doc","content":[{"type":"paragraph"}]}'
    ELSE json_object('type','doc','content', json_array(json_object('type','paragraph','content', json_array(json_object('type','text','text', e.description)))))
  END,
  '{}', strftime('%s','now')*1000, strftime('%s','now')*1000, 1
FROM timeline_events e JOIN timelines t ON t.id = e.timeline_id
WHERE e.card_id IS NULL AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.id = e.id);
UPDATE timeline_events SET card_id = id WHERE card_id IS NULL AND EXISTS (SELECT 1 FROM cards c WHERE c.id = timeline_events.id);`
  },
  {
    version: 9,
    sql: `CREATE TABLE timeline_lives (
      id TEXT PRIMARY KEY,
      timeline_id TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      start_value REAL NOT NULL,
      start_kind TEXT NOT NULL DEFAULT 'nascimento',
      end_value REAL,
      end_kind TEXT,
      UNIQUE (timeline_id, card_id)
    );`
  },
  {
    version: 10,
    sql: `CREATE TABLE highlights (
      world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (world_id, card_id)
    );`
  }
]

export function runMigrations(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  const pending = MIGRATIONS.filter((m) => m.version > current)
  for (const m of pending) {
    db.transaction(() => {
      db.exec(m.sql)
      db.pragma(`user_version = ${m.version}`)
    })()
  }
}
