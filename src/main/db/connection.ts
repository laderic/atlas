import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { runMigrations } from './migrations'

let db: Database.Database

export const dataDir = (): string => join(app.getPath('userData'), 'dados')
export const mediaDir = (): string => join(dataDir(), 'media')

export function openDatabase(): Database.Database {
  mkdirSync(mediaDir(), { recursive: true })
  db = new Database(join(dataDir(), 'atlas.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

export const getDb = (): Database.Database => db
