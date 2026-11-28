import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_STORE_DATA } from '../data/initialStoreData.ts';
import type { StoreDatabase } from '../data/initialStoreData.ts';

const REPO_SEED_PATH = path.resolve(process.cwd(), 'data', 'maraya-store.json');
const SERVERLESS_STORE_PATH = '/tmp/maraya-store.json';

declare global {
  var _marayaStoreCache: StoreDatabase | undefined;
  var _marayaStoreMutex: Promise<void> | undefined;
}

function cloneInitialData(): StoreDatabase {
  return JSON.parse(JSON.stringify(INITIAL_STORE_DATA)) as StoreDatabase;
}

function resolveStoreFilePath(): string {
  if (process.env.VERCEL) {
    return SERVERLESS_STORE_PATH;
  }
  return REPO_SEED_PATH;
}

function readSeedFromDisk(): StoreDatabase {
  const candidates = process.env.VERCEL
    ? [SERVERLESS_STORE_PATH, REPO_SEED_PATH]
    : [REPO_SEED_PATH];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<StoreDatabase>;
        if (
          Array.isArray(parsed.products) &&
          Array.isArray(parsed.categories) &&
          Array.isArray(parsed.orders) &&
          Array.isArray(parsed.staffMembers)
        ) {
          return {
            nextProductSeq: parsed.nextProductSeq ?? parsed.products.length + 1,
            nextCategorySeq: parsed.nextCategorySeq ?? parsed.categories.length + 1,
            nextOrderSeq: parsed.nextOrderSeq ?? parsed.orders.length + 1,
            nextOrderItemSeq: parsed.nextOrderItemSeq ?? 10,
            nextNoteSeq: parsed.nextNoteSeq ?? 10,
            nextStaffSeq: parsed.nextStaffSeq ?? parsed.staffMembers.length + 1,
            categories: parsed.categories,
            products: parsed.products,
            orders: parsed.orders,
            staffMembers: parsed.staffMembers,
          };
        }
      }
    } catch {
      // Fallback to next source
    }
  }

  return cloneInitialData();
}

function persistStore(data: StoreDatabase): void {
  const targetPath = resolveStoreFilePath();
  const dir = path.dirname(targetPath);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${targetPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, targetPath);
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';
    if (code === 'EROFS' || code === 'EACCES') {
      if (targetPath !== SERVERLESS_STORE_PATH) {
        try {
          fs.mkdirSync(path.dirname(SERVERLESS_STORE_PATH), { recursive: true });
          fs.writeFileSync(SERVERLESS_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
          return;
        } catch {
          // Keep in-memory state if filesystem is completely locked
        }
      }
      return;
    }
    throw err;
  }
}

export function getStoreSnapshot(): StoreDatabase {
  if (!global._marayaStoreCache) {
    global._marayaStoreCache = readSeedFromDisk();
  }
  return global._marayaStoreCache;
}

export async function withStoreMutation<T>(
  mutator: (store: StoreDatabase) => Promise<T> | T
): Promise<T> {
  const prev = global._marayaStoreMutex ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  global._marayaStoreMutex = prev.then(() => current);

  await prev;
  try {
    const store = getStoreSnapshot();
    const workingCopy = JSON.parse(JSON.stringify(store)) as StoreDatabase;
    const result = await mutator(workingCopy);
    persistStore(workingCopy);
    global._marayaStoreCache = workingCopy;
    return result;
  } finally {
    release();
  }
}
