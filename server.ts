import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import { optionalAuth, requireAuth } from './src/middleware/auth.ts';
import type { AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { createOrderRecord, getOrdersForUid } from './src/db/orders.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json({ limit: '15mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get('/api/maps/key', (_req: Request, res: Response) => {
  const apiKey =
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    '';
  res.json({ apiKey });
});

app.post('/api/me/sync', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const dbUser = await getOrCreateUser(
      uid,
      req.user?.email ?? `${uid}@maraya.local`,
      typeof req.user?.name === 'string' ? req.user.name : null
    );
    res.json({ user: dbUser });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to sync user.';
    res.status(500).json({ error: message });
  }
});

app.get('/api/orders', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await getOrCreateUser(
      uid,
      req.user?.email ?? `${uid}@maraya.local`,
      typeof req.user?.name === 'string' ? req.user.name : null
    );
    const list = await getOrdersForUid(uid);
    res.json({ orders: list });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to fetch orders.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/orders', optionalAuth, async (req: AuthRequest, res: Response) => {
  const body = req.body as {
    fullName?: unknown;
    phone?: unknown;
    address?: unknown;
    notes?: unknown;
    paymentMethod?: unknown;
    currency?: unknown;
    totalAmount?: unknown;
    items?: unknown;
  };

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const paymentMethod = body.paymentMethod === 'card' ? 'card' : 'cod';
  const currency = body.currency === 'USD' ? 'USD' : 'EGP';
  const totalAmount =
    typeof body.totalAmount === 'number' && Number.isFinite(body.totalAmount)
      ? Math.max(0, Math.round(body.totalAmount))
      : 0;

  if (!fullName || !phone || !address || !Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({ error: 'Missing required order fields.' });
    return;
  }

  const parsedItems = body.items
    .map((item) => {
      if (typeof item !== 'object' || item === null) return null;
      const obj = item as Record<string, unknown>;
      const sku = typeof obj.sku === 'string' ? obj.sku.trim() : '';
      const title = typeof obj.title === 'string' ? obj.title.trim() : '';
      const size = typeof obj.size === 'string' ? obj.size.trim() : '';
      const quantity = typeof obj.quantity === 'number' && obj.quantity > 0 ? Math.round(obj.quantity) : 0;
      if (!sku || !title || !size || quantity <= 0) return null;
      return { sku, title, size, quantity };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (parsedItems.length === 0) {
    res.status(400).json({ error: 'Invalid order items.' });
    return;
  }

  const orderRef = `MRY-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    let userId: number | null = null;
    if (req.user?.uid) {
      const dbUser = await getOrCreateUser(
        req.user.uid,
        req.user.email ?? `${req.user.uid}@maraya.local`,
        typeof req.user.name === 'string' ? req.user.name : null
      );
      userId = dbUser?.id ?? null;
    }

    await createOrderRecord({
      orderRef,
      userId,
      fullName,
      phone,
      address,
      notes,
      paymentMethod,
      currency,
      totalAmount,
      items: parsedItems,
    });

    res.status(201).json({
      orderRef,
      fullName,
      phone,
      address,
      notes,
    });
  } catch (error: unknown) {
    console.error('Order persistence failed:', error);
    res.status(500).json({ error: 'Unable to save order right now.' });
  }
});

async function startServer() {
  const isDev = process.env.VITE_DEV === 'true';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MARAYA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
