export interface UndoEntry {
  label: string
  run: () => Promise<void>
}

const stack: UndoEntry[] = []
const LIMIT = 30

/** Guarda uma ação de exclusão que pode ser desfeita com Ctrl+Z. */
export function pushUndo(entry: UndoEntry): void {
  stack.push(entry)
  if (stack.length > LIMIT) stack.shift()
}

export const undoCount = (): number => stack.length

/** Desfaz a última exclusão e devolve o nome do que foi restaurado. */
export async function runUndo(): Promise<string | null> {
  const entry = stack.pop()
  if (!entry) return null
  await entry.run()
  return entry.label
}
