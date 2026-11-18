// Antrean order offline untuk POS.
// Disimpan sebagai JSON di documentDirectory (fallback cacheDirectory).
import * as FileSystem from 'expo-file-system/legacy';

const QUEUE_FILENAME = 'seroo-offline-orders.json';

function queueUri() {
  const directory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!directory) return null;
  return `${directory}${QUEUE_FILENAME}`;
}

export async function readQueue() {
  const uri = queueUri();
  if (!uri) return [];
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeQueue(queue) {
  const uri = queueUri();
  if (!uri) throw new Error('Penyimpanan lokal tidak tersedia.');
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(queue), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function enqueueOrder(payload) {
  const queue = await readQueue();
  const entry = {
    id: `${Date.now()}-${payload.clientTransactionId}`,
    createdAt: new Date().toISOString(),
    payload,
  };
  await writeQueue([...queue, entry]);
  return entry;
}

export async function removeQueuedOrder(id) {
  const queue = await readQueue();
  await writeQueue(queue.filter((entry) => entry.id !== id));
}

export async function clearQueue() {
  await writeQueue([]);
}
