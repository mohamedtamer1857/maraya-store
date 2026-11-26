import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import { optionalAuth, requireAuth } from './src/middleware/auth.ts';
import type { AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  createOrderRecord,
  getAllOrdersForStaff,
  getOrdersForUid,
  getSalesSummaryForStaff,
  isValidOrderStatus,
  updateOrderStatusByRef,
} from './src/db/orders.ts';
import {
  deleteStaffMemberById,
  getStaffMemberByEmail,
  listStaffMembers,
  normalizeRole,
  updateStaffMemberById,
  upsertStaffMember,
} from './src/db/staff.ts';
import type { StaffMemberDTO, StaffPermissionKey } from './src/db/staff.ts';

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

app.get('/api/maps/reverse-geocode', async (req: Request, res: Response) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const lang = req.query.lang === 'en' ? 'en' : 'ar';

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'Invalid coordinates.' });
    return;
  }

  const inEgypt = lat >= 21.99 && lat <= 31.92 && lng >= 24.7 && lng <= 36.9;
  const coordsLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const fallbackAddress =
    lang === 'ar'
      ? `موقعي الحالي (${coordsLabel})`
      : `Current GPS Location (${coordsLabel})`;

  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    '';

  if (!apiKey) {
    res.json({
      address: fallbackAddress,
      lat,
      lng,
      inEgypt,
      coordinatesOnly: true,
    });
    return;
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${lat},${lng}`);
    url.searchParams.set('language', lang);
    url.searchParams.set('region', 'eg');
    url.searchParams.set('key', apiKey);

    const geoRes = await fetch(url.toString());
    if (geoRes.status === 429) {
      res.status(429).json({
        error: 'RESOURCE_EXHAUSTED',
        quotaExceeded: true,
        address: fallbackAddress,
        lat,
        lng,
        inEgypt,
        coordinatesOnly: true,
      });
      return;
    }

    const data = (await geoRes.json()) as {
      status?: string;
      results?: Array<{ formatted_address?: string }>;
      error_message?: string;
    };

    if (data.status === 'OVER_QUERY_LIMIT') {
      res.status(429).json({
        error: 'OVER_QUERY_LIMIT',
        quotaExceeded: true,
        address: fallbackAddress,
        lat,
        lng,
        inEgypt,
        coordinatesOnly: true,
      });
      return;
    }

    const formatted = data.results?.[0]?.formatted_address?.trim();
    if (data.status === 'OK' && formatted) {
      res.json({
        address: formatted,
        lat,
        lng,
        inEgypt,
        coordinatesOnly: false,
      });
      return;
    }

    res.json({
      address: fallbackAddress,
      lat,
      lng,
      inEgypt,
      coordinatesOnly: true,
    });
  } catch {
    res.json({
      address: fallbackAddress,
      lat,
      lng,
      inEgypt,
      coordinatesOnly: true,
    });
  }
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

async function resolveVerifiedStaff(
  req: AuthRequest,
  res: Response,
  requiredPermission?: StaffPermissionKey
): Promise<StaffMemberDTO | null> {
  const email = typeof req.user?.email === 'string' ? req.user.email.trim().toLowerCase() : '';
  const emailVerified = req.user?.email_verified === true;
  if (!email || !emailVerified) {
    res.status(403).json({ error: 'Verified Google account email is required for staff access.' });
    return null;
  }

  const displayName = typeof req.user?.name === 'string' ? req.user.name : null;
  const staff = await getStaffMemberByEmail(email, displayName);
  if (!staff || !staff.isActive) {
    res.status(403).json({
      error: 'Access denied: Your Google account does not have active staff permissions.',
    });
    return null;
  }

  if (requiredPermission && !staff[requiredPermission]) {
    res.status(403).json({
      error: `Access denied: Missing required permission (${requiredPermission}).`,
    });
    return null;
  }

  return staff;
}

app.get('/api/staff/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const email = typeof req.user?.email === 'string' ? req.user.email.trim().toLowerCase() : '';
    const emailVerified = req.user?.email_verified === true;
    if (!email || !emailVerified) {
      res.json({ isStaff: false, staff: null, email: email || null, emailVerified });
      return;
    }

    const displayName = typeof req.user?.name === 'string' ? req.user.name : null;
    const staff = await getStaffMemberByEmail(email, displayName);
    if (!staff || !staff.isActive) {
      res.json({ isStaff: false, staff: null, email, emailVerified });
      return;
    }

    res.json({ isStaff: true, staff, email, emailVerified });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to verify staff profile.';
    res.status(500).json({ error: message });
  }
});

app.get('/api/staff/orders', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const staff = await resolveVerifiedStaff(req, res, 'canViewOrders');
    if (!staff) return;

    const ordersList = await getAllOrdersForStaff();
    res.json({ orders: ordersList });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to load staff orders.';
    res.status(500).json({ error: message });
  }
});

app.patch('/api/staff/orders/:orderRef/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const staff = await resolveVerifiedStaff(req, res, 'canUpdateOrderStatus');
    if (!staff) return;

    const orderRef = typeof req.params.orderRef === 'string' ? req.params.orderRef.trim() : '';
    if (!orderRef || orderRef.length > 40) {
      res.status(400).json({ error: 'Invalid order reference.' });
      return;
    }

    const body = req.body as { status?: unknown };
    if (!isValidOrderStatus(body.status)) {
      res.status(400).json({ error: 'Invalid order status value.' });
      return;
    }

    const updated = await updateOrderStatusByRef(orderRef, body.status);
    if (!updated) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    res.json({ order: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to update order status.';
    res.status(500).json({ error: message });
  }
});

app.get('/api/staff/sales', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const staff = await resolveVerifiedStaff(req, res, 'canViewSales');
    if (!staff) return;

    const summary = await getSalesSummaryForStaff();
    res.json({ summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to compute sales summary.';
    res.status(500).json({ error: message });
  }
});

app.get('/api/staff/members', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const staff = await resolveVerifiedStaff(req, res, 'canManageStaff');
    if (!staff) return;

    const members = await listStaffMembers();
    res.json({ members });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to load staff members.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/staff/members', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const staff = await resolveVerifiedStaff(req, res, 'canManageStaff');
    if (!staff) return;

    const body = req.body as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
      res.status(400).json({ error: 'Please provide a valid Google email address.' });
      return;
    }

    const displayName =
      typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 120) : null;

    const created = await upsertStaffMember({
      email,
      displayName,
      role: normalizeRole(body.role),
      canViewOrders: body.canViewOrders !== false,
      canUpdateOrderStatus: body.canUpdateOrderStatus === true,
      canViewSales: body.canViewSales === true,
      canManageStaff: body.canManageStaff === true,
      isActive: body.isActive !== false,
    });

    res.status(201).json({ member: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to save staff member.';
    res.status(400).json({ error: message });
  }
});

app.patch('/api/staff/members/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const staff = await resolveVerifiedStaff(req, res, 'canManageStaff');
    if (!staff) return;

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid staff member ID.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const updated = await updateStaffMemberById(id, {
      displayName:
        typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 120) : undefined,
      role: body.role !== undefined ? normalizeRole(body.role) : undefined,
      canViewOrders: typeof body.canViewOrders === 'boolean' ? body.canViewOrders : undefined,
      canUpdateOrderStatus:
        typeof body.canUpdateOrderStatus === 'boolean' ? body.canUpdateOrderStatus : undefined,
      canViewSales: typeof body.canViewSales === 'boolean' ? body.canViewSales : undefined,
      canManageStaff:
        typeof body.canManageStaff === 'boolean' ? body.canManageStaff : undefined,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
    });

    if (!updated) {
      res.status(404).json({ error: 'Staff member not found.' });
      return;
    }

    res.json({ member: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to update staff permissions.';
    res.status(400).json({ error: message });
  }
});

app.delete('/api/staff/members/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const staff = await resolveVerifiedStaff(req, res, 'canManageStaff');
    if (!staff) return;

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid staff member ID.' });
      return;
    }

    const deleted = await deleteStaffMemberById(id, staff.email);
    if (!deleted) {
      res.status(404).json({ error: 'Staff member not found.' });
      return;
    }

    res.json({ deleted: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to delete staff member.';
    res.status(400).json({ error: message });
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
