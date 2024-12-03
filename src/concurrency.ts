import { Mutex } from "async-mutex";

const mutexes = new Map<string, Mutex>();

export async function lock<T>(
  spreadsheetId: string,
  worker: () => T,
): Promise<T> {
  const mutex = mutexes.get(spreadsheetId) ?? new Mutex();
  mutexes.set(spreadsheetId, mutex);

  return mutex.runExclusive(worker);
}
