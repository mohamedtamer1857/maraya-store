import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { optionalAuth, requireAuth } from './middleware/auth.ts';
import type { AuthRequest } from './middleware/auth.ts';
import { ensureDatabaseSchema } from './db/index.ts';
import { getOrCreateUser } from './db/users.ts';
import {
  addOrderStaffNote,
  createOrderRecord,
  deleteOrderStaffNote,
  getAllOrdersForStaff,
  getOrdersForUid,
  getSalesSummaryForStaff,
  InsufficientStockError,
  isValidOrderStatus,
  updateOrderStatusByRef,
} from './db/orders.ts';
import {
  createProductForStaff,
  isValidProductCategory,
  listAllProductsForStaff,
  listPublicProducts,
  updateProductByIdForStaff,
} from './db/products.ts';
import {
  createCategoryForStaff,
  deleteCategoryBySlugForStaff,
  listAllCategoriesForStaff,
  listPublicCategories,
  normalizeCategorySlug,
  updateCategoryBySlugForStaff,
} from './db/categories.ts';
import {
  deleteStaffMemberById,
  getStaffMemberByEmail,
  listStaffMembers,
  normalizeRole,
  updateStaffMemberById,
  upsertStaffMember,
} from './db/staff.ts';
import type { StaffMemberDTO, StaffPermissionKey } from './db/staff.ts';

const PRODUCT_UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'products');

function parseSizeStockPayload(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const cleanKey = k.trim().slice(0, 12);
    const num = Number(v);
    if (cleanKey && Number.isFinite(num)) {
      result[cleanKey] = Math.max(0, Math.round(num));
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

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

export function createApiApp() {
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

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
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

  app.get('/api/products', async (_req: Request, res: Response) => {
    try {
      await ensureDatabaseSchema();
      const [products, categories] = await Promise.all([
        listPublicProducts(),
        listPublicCategories(),
      ]);
      res.json({ products, categories });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load catalog.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/me/sync', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSchema();
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
      await ensureDatabaseSchema();
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
        const quantity =
          typeof obj.quantity === 'number' && obj.quantity > 0 ? Math.round(obj.quantity) : 0;
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
      await ensureDatabaseSchema();
      let userId: number | null = null;
      if (req.user?.uid) {
        const dbUser = await getOrCreateUser(
          req.user.uid,
          req.user.email ?? `${req.user.uid}@maraya.local`,
          typeof req.user.name === 'string' ? req.user.name : null
        );
        userId = dbUser?.id ?? null;
      }

      const createdOrder = await createOrderRecord({
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
        totalAmount: createdOrder.totalAmount,
      });
    } catch (error: unknown) {
      if (error instanceof InsufficientStockError) {
        res.status(409).json({ error: error.message });
        return;
      }
      console.error('Order persistence failed:', error);
      const message = error instanceof Error ? error.message : 'Unable to save order right now.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/staff/me', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSchema();
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
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, 'canViewOrders');
      if (!staff) return;

      const ordersList = await getAllOrdersForStaff();
      res.json({ orders: ordersList });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load staff orders.';
      res.status(500).json({ error: message });
    }
  });

  app.patch(
    '/api/staff/orders/:orderRef/status',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        await ensureDatabaseSchema();
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
    }
  );

  app.post(
    '/api/staff/orders/:orderRef/notes',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        await ensureDatabaseSchema();
        const staff = await resolveVerifiedStaff(req, res, 'canUpdateOrderStatus');
        if (!staff) return;

        const orderRef = typeof req.params.orderRef === 'string' ? req.params.orderRef.trim() : '';
        if (!orderRef || orderRef.length > 40) {
          res.status(400).json({ error: 'Invalid order reference.' });
          return;
        }

        const body = req.body as { note?: unknown };
        const note = typeof body.note === 'string' ? body.note.trim() : '';
        if (!note || note.length > 1000) {
          res.status(400).json({ error: 'Please provide a valid note (1-1000 characters).' });
          return;
        }

        const created = await addOrderStaffNote({
          orderRef,
          staffEmail: staff.email,
          staffName:
            staff.displayName || (typeof req.user?.name === 'string' ? req.user.name : null),
          note,
        });

        if (!created) {
          res.status(404).json({ error: 'Order not found.' });
          return;
        }

        res.status(201).json({ note: created });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to save staff note.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.delete(
    '/api/staff/orders/:orderRef/notes/:noteId',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        await ensureDatabaseSchema();
        const staff = await resolveVerifiedStaff(req, res, 'canUpdateOrderStatus');
        if (!staff) return;

        const orderRef = typeof req.params.orderRef === 'string' ? req.params.orderRef.trim() : '';
        const noteId = Number(req.params.noteId);
        if (!orderRef || orderRef.length > 40 || !Number.isInteger(noteId) || noteId <= 0) {
          res.status(400).json({ error: 'Invalid note parameters.' });
          return;
        }

        const deleted = await deleteOrderStaffNote({ orderRef, noteId });
        if (!deleted) {
          res.status(404).json({ error: 'Staff note not found.' });
          return;
        }

        res.json({ deleted: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to delete staff note.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.get('/api/staff/sales', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSchema();
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
      await ensureDatabaseSchema();
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
      await ensureDatabaseSchema();
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
        canManageProducts: body.canManageProducts === true,
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
      await ensureDatabaseSchema();
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
        canManageStaff: typeof body.canManageStaff === 'boolean' ? body.canManageStaff : undefined,
        canManageProducts:
          typeof body.canManageProducts === 'boolean' ? body.canManageProducts : undefined,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      });

      if (!updated) {
        res.status(404).json({ error: 'Staff member not found.' });
        return;
      }

      res.json({ member: updated });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unable to update staff permissions.';
      res.status(400).json({ error: message });
    }
  });

  app.delete('/api/staff/members/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSchema();
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

  app.get('/api/staff/products', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, 'canManageProducts');
      if (!staff) return;

      const [products, categories] = await Promise.all([
        listAllProductsForStaff(),
        listAllCategoriesForStaff(),
      ]);
      res.json({ products, categories });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load products catalog.';
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/staff/categories', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, 'canManageProducts');
      if (!staff) return;

      const categories = await listAllCategoriesForStaff();
      res.json({ categories });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load categories.';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/staff/categories', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, 'canManageProducts');
      if (!staff) return;

      const body = req.body as Record<string, unknown>;
      const created = await createCategoryForStaff({
        nameAr: typeof body.nameAr === 'string' ? body.nameAr : '',
        nameEn: typeof body.nameEn === 'string' ? body.nameEn : '',
        slug: typeof body.slug === 'string' ? body.slug : undefined,
      });
      res.status(201).json({ category: created });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to create category.';
      res.status(400).json({ error: message });
    }
  });

  app.patch(
    '/api/staff/categories/:slug',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        await ensureDatabaseSchema();
        const staff = await resolveVerifiedStaff(req, res, 'canManageProducts');
        if (!staff) return;

        const slug = normalizeCategorySlug(
          typeof req.params.slug === 'string' ? req.params.slug : ''
        );
        if (!slug) {
          res.status(400).json({ error: 'Invalid category slug.' });
          return;
        }

        const body = req.body as Record<string, unknown>;
        const updated = await updateCategoryBySlugForStaff(slug, {
          nameAr: typeof body.nameAr === 'string' ? body.nameAr : undefined,
          nameEn: typeof body.nameEn === 'string' ? body.nameEn : undefined,
          isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        });
        if (!updated) {
          res.status(404).json({ error: 'Category not found.' });
          return;
        }
        res.json({ category: updated });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to update category.';
        res.status(400).json({ error: message });
      }
    }
  );

  app.delete(
    '/api/staff/categories/:slug',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        await ensureDatabaseSchema();
        const staff = await resolveVerifiedStaff(req, res, 'canManageProducts');
        if (!staff) return;

        const slug = normalizeCategorySlug(
          typeof req.params.slug === 'string' ? req.params.slug : ''
        );
        if (!slug) {
          res.status(400).json({ error: 'Invalid category slug.' });
          return;
        }

        const deleted = await deleteCategoryBySlugForStaff(slug);
        if (!deleted) {
          res.status(404).json({ error: 'Category not found.' });
          return;
        }
        res.json({ deleted: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to delete category.';
        res.status(400).json({ error: message });
      }
    }
  );

  app.post(
    '/api/staff/products/upload-image',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        await ensureDatabaseSchema();
        const staff = await resolveVerifiedStaff(req, res, 'canManageProducts');
        if (!staff) return;

        const body = req.body as { dataUrl?: unknown };
        const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl.trim() : '';
        const match = dataUrl.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
        if (!match) {
          res.status(400).json({ error: 'Only JPEG, PNG, and WebP images are supported.' });
          return;
        }

        const buffer = Buffer.from(match[2], 'base64');
        if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
          res.status(400).json({ error: 'Image file must be under 5 MB.' });
          return;
        }

        const isJpeg =
          buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        const isPng =
          buffer.length >= 4 &&
          buffer[0] === 0x89 &&
          buffer[1] === 0x50 &&
          buffer[2] === 0x4e &&
          buffer[3] === 0x47;
        const isWebp =
          buffer.length >= 12 &&
          buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
          buffer.subarray(8, 12).toString('ascii') === 'WEBP';

        let ext: 'jpg' | 'png' | 'webp' | null = null;
        if (isJpeg) ext = 'jpg';
        else if (isPng) ext = 'png';
        else if (isWebp) ext = 'webp';

        if (!ext) {
          res.status(400).json({ error: 'Invalid image binary signature.' });
          return;
        }

        // On Vercel serverless, filesystem is read-only; return validated inline data URL (< 1.8 MB)
        if (process.env.VERCEL) {
          if (dataUrl.length > 2_500_000) {
            res.status(400).json({
              error: 'On serverless hosting, uploaded images must be under 1.8 MB or linked by HTTPS URL.',
            });
            return;
          }
          res.status(201).json({ imageUrl: dataUrl });
          return;
        }

        try {
          fs.mkdirSync(PRODUCT_UPLOADS_DIR, { recursive: true });
          const filename = `prod-${crypto.randomUUID()}.${ext}`;
          const targetPath = path.resolve(PRODUCT_UPLOADS_DIR, filename);
          if (!targetPath.startsWith(PRODUCT_UPLOADS_DIR + path.sep)) {
            res.status(400).json({ error: 'Invalid target file path.' });
            return;
          }
          fs.writeFileSync(targetPath, buffer);
          res.status(201).json({ imageUrl: `/uploads/products/${filename}` });
        } catch (fsErr: unknown) {
          const fsCode =
            fsErr && typeof fsErr === 'object' && 'code' in fsErr
              ? String((fsErr as { code?: unknown }).code || '')
              : '';
          if ((fsCode === 'EROFS' || fsCode === 'EACCES') && dataUrl.length <= 2_500_000) {
            res.status(201).json({ imageUrl: dataUrl });
            return;
          }
          throw fsErr;
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unable to upload product image.';
        res.status(500).json({ error: message });
      }
    }
  );

  app.post('/api/staff/products', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      await ensureDatabaseSchema();
      const staff = await resolveVerifiedStaff(req, res, 'canManageProducts');
      if (!staff) return;

      const body = req.body as Record<string, unknown>;
      const sizes = Array.isArray(body.sizes)
        ? body.sizes.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        : ['S', 'M', 'L', 'XL'];

      const created = await createProductForStaff({
        sku: typeof body.sku === 'string' ? body.sku : '',
        category: isValidProductCategory(body.category) ? body.category : 'outerwear',
        image: typeof body.image === 'string' ? body.image : '',
        priceEgp: typeof body.priceEgp === 'number' ? body.priceEgp : Number(body.priceEgp),
        stockQty:
          body.stockQty !== undefined && Number.isFinite(Number(body.stockQty))
            ? Number(body.stockQty)
            : undefined,
        sizeStock: parseSizeStockPayload(body.sizeStock),
        sizes,
        titleAr: typeof body.titleAr === 'string' ? body.titleAr : '',
        titleEn: typeof body.titleEn === 'string' ? body.titleEn : '',
        subtitleAr: typeof body.subtitleAr === 'string' ? body.subtitleAr : '',
        subtitleEn: typeof body.subtitleEn === 'string' ? body.subtitleEn : '',
        descriptionAr: typeof body.descriptionAr === 'string' ? body.descriptionAr : undefined,
        descriptionEn: typeof body.descriptionEn === 'string' ? body.descriptionEn : undefined,
        tagAr: typeof body.tagAr === 'string' ? body.tagAr : null,
        tagEn: typeof body.tagEn === 'string' ? body.tagEn : null,
      });

      res.status(201).json({ product: created });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to create product.';
      res.status(400).json({ error: message });
    }
  });

  app.patch(
    '/api/staff/products/:productId',
    requireAuth,
    async (req: AuthRequest, res: Response) => {
      try {
        await ensureDatabaseSchema();
        const staff = await resolveVerifiedStaff(req, res, 'canManageProducts');
        if (!staff) return;

        const productId =
          typeof req.params.productId === 'string' ? req.params.productId.trim() : '';
        if (!productId || productId.length > 80) {
          res.status(400).json({ error: 'Invalid product ID.' });
          return;
        }

        const body = req.body as Record<string, unknown>;
        const updated = await updateProductByIdForStaff(productId, {
          titleAr: typeof body.titleAr === 'string' ? body.titleAr : undefined,
          titleEn: typeof body.titleEn === 'string' ? body.titleEn : undefined,
          subtitleAr: typeof body.subtitleAr === 'string' ? body.subtitleAr : undefined,
          subtitleEn: typeof body.subtitleEn === 'string' ? body.subtitleEn : undefined,
          priceEgp:
            body.priceEgp !== undefined && Number.isFinite(Number(body.priceEgp))
              ? Number(body.priceEgp)
              : undefined,
          stockQty:
            body.stockQty !== undefined && Number.isFinite(Number(body.stockQty))
              ? Number(body.stockQty)
              : undefined,
          sizeStock: parseSizeStockPayload(body.sizeStock),
          image: typeof body.image === 'string' ? body.image : undefined,
          category: isValidProductCategory(body.category) ? body.category : undefined,
          sizes: Array.isArray(body.sizes)
            ? body.sizes.filter((s): s is string => typeof s === 'string')
            : undefined,
          tagAr:
            body.tagAr !== undefined ? (typeof body.tagAr === 'string' ? body.tagAr : null) : undefined,
          tagEn:
            body.tagEn !== undefined ? (typeof body.tagEn === 'string' ? body.tagEn : null) : undefined,
          descriptionAr: typeof body.descriptionAr === 'string' ? body.descriptionAr : undefined,
          descriptionEn: typeof body.descriptionEn === 'string' ? body.descriptionEn : undefined,
          isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        });

        if (!updated) {
          res.status(404).json({ error: 'Product not found.' });
          return;
        }

        res.json({ product: updated });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unable to update product.';
        res.status(400).json({ error: message });
      }
    }
  );

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Unexpected server error.';
    res.status(500).json({ error: message });
  });

  return app;
}
