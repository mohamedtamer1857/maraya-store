import { asc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import { staffMembers } from './schema.ts';

export type StaffRole = 'admin' | 'manager' | 'operations' | 'viewer';
export type StaffPermissionKey =
  | 'canViewOrders'
  | 'canUpdateOrderStatus'
  | 'canViewSales'
  | 'canManageStaff';

export interface StaffMemberDTO {
  id: number;
  email: string;
  displayName: string | null;
  role: StaffRole;
  canViewOrders: boolean;
  canUpdateOrderStatus: boolean;
  canViewSales: boolean;
  canManageStaff: boolean;
  isActive: boolean;
  isBootstrapAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const BOOTSTRAP_ADMIN_EMAIL = (
  process.env.STAFF_ADMIN_EMAIL || 'tameermohamed17@gmail.com'
)
  .trim()
  .toLowerCase();

export function normalizeRole(raw: unknown): StaffRole {
  if (raw === 'admin' || raw === 'manager' || raw === 'operations' || raw === 'viewer') {
    return raw;
  }
  return 'operations';
}

function toDto(row: typeof staffMembers.$inferSelect): StaffMemberDTO {
  const normalizedEmail = row.email.trim().toLowerCase();
  return {
    id: row.id,
    email: normalizedEmail,
    displayName: row.displayName,
    role: normalizeRole(row.role),
    canViewOrders: row.canViewOrders === 1,
    canUpdateOrderStatus: row.canUpdateOrderStatus === 1,
    canViewSales: row.canViewSales === 1,
    canManageStaff: row.canManageStaff === 1,
    isActive: row.isActive === 1,
    isBootstrapAdmin: normalizedEmail === BOOTSTRAP_ADMIN_EMAIL,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function ensureBootstrapAdmin(displayName?: string | null): Promise<StaffMemberDTO> {
  const existing = await db
    .select()
    .from(staffMembers)
    .where(eq(staffMembers.email, BOOTSTRAP_ADMIN_EMAIL))
    .limit(1);

  if (existing[0]) {
    if (
      existing[0].role !== 'admin' ||
      existing[0].canViewOrders !== 1 ||
      existing[0].canUpdateOrderStatus !== 1 ||
      existing[0].canViewSales !== 1 ||
      existing[0].canManageStaff !== 1 ||
      existing[0].isActive !== 1
    ) {
      const [updated] = await db
        .update(staffMembers)
        .set({
          role: 'admin',
          displayName: displayName ?? existing[0].displayName,
          canViewOrders: 1,
          canUpdateOrderStatus: 1,
          canViewSales: 1,
          canManageStaff: 1,
          isActive: 1,
          updatedAt: new Date(),
        })
        .where(eq(staffMembers.id, existing[0].id))
        .returning();
      return toDto(updated);
    }
    if (displayName && !existing[0].displayName) {
      const [updated] = await db
        .update(staffMembers)
        .set({ displayName, updatedAt: new Date() })
        .where(eq(staffMembers.id, existing[0].id))
        .returning();
      return toDto(updated);
    }
    return toDto(existing[0]);
  }

  const [created] = await db
    .insert(staffMembers)
    .values({
      email: BOOTSTRAP_ADMIN_EMAIL,
      displayName: displayName ?? 'MARAYA Admin',
      role: 'admin',
      canViewOrders: 1,
      canUpdateOrderStatus: 1,
      canViewSales: 1,
      canManageStaff: 1,
      isActive: 1,
    })
    .onConflictDoUpdate({
      target: staffMembers.email,
      set: {
        role: 'admin',
        canViewOrders: 1,
        canUpdateOrderStatus: 1,
        canViewSales: 1,
        canManageStaff: 1,
        isActive: 1,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toDto(created);
}

export async function getStaffMemberByEmail(
  rawEmail: string,
  displayName?: string | null
): Promise<StaffMemberDTO | null> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return null;

  if (email === BOOTSTRAP_ADMIN_EMAIL) {
    return ensureBootstrapAdmin(displayName);
  }

  const rows = await db
    .select()
    .from(staffMembers)
    .where(eq(staffMembers.email, email))
    .limit(1);

  if (!rows[0]) return null;

  if (displayName && rows[0].displayName !== displayName) {
    const [updated] = await db
      .update(staffMembers)
      .set({ displayName, updatedAt: new Date() })
      .where(eq(staffMembers.id, rows[0].id))
      .returning();
    return toDto(updated);
  }

  return toDto(rows[0]);
}

export async function listStaffMembers(): Promise<StaffMemberDTO[]> {
  await ensureBootstrapAdmin();
  const rows = await db
    .select()
    .from(staffMembers)
    .orderBy(asc(staffMembers.id));
  return rows.map(toDto);
}

export interface UpsertStaffInput {
  email: string;
  displayName?: string | null;
  role: StaffRole;
  canViewOrders: boolean;
  canUpdateOrderStatus: boolean;
  canViewSales: boolean;
  canManageStaff: boolean;
  isActive: boolean;
}

export async function upsertStaffMember(input: UpsertStaffInput): Promise<StaffMemberDTO> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Valid Google email is required.');
  }

  if (email === BOOTSTRAP_ADMIN_EMAIL) {
    return ensureBootstrapAdmin(input.displayName);
  }

  const [saved] = await db
    .insert(staffMembers)
    .values({
      email,
      displayName: input.displayName?.trim() || null,
      role: normalizeRole(input.role),
      canViewOrders: input.canViewOrders ? 1 : 0,
      canUpdateOrderStatus: input.canUpdateOrderStatus ? 1 : 0,
      canViewSales: input.canViewSales ? 1 : 0,
      canManageStaff: input.canManageStaff ? 1 : 0,
      isActive: input.isActive ? 1 : 0,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: staffMembers.email,
      set: {
        displayName: input.displayName?.trim() || null,
        role: normalizeRole(input.role),
        canViewOrders: input.canViewOrders ? 1 : 0,
        canUpdateOrderStatus: input.canUpdateOrderStatus ? 1 : 0,
        canViewSales: input.canViewSales ? 1 : 0,
        canManageStaff: input.canManageStaff ? 1 : 0,
        isActive: input.isActive ? 1 : 0,
        updatedAt: new Date(),
      },
    })
    .returning();

  return toDto(saved);
}

export async function updateStaffMemberById(
  id: number,
  patch: Partial<Omit<UpsertStaffInput, 'email'>>
): Promise<StaffMemberDTO | null> {
  const rows = await db
    .select()
    .from(staffMembers)
    .where(eq(staffMembers.id, id))
    .limit(1);

  const existing = rows[0];
  if (!existing) return null;

  if (existing.email.trim().toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) {
    return ensureBootstrapAdmin(patch.displayName ?? existing.displayName);
  }

  const nextCanManageStaff =
    typeof patch.canManageStaff === 'boolean'
      ? patch.canManageStaff
      : existing.canManageStaff === 1;
  const nextIsActive =
    typeof patch.isActive === 'boolean' ? patch.isActive : existing.isActive === 1;

  if (!nextCanManageStaff || !nextIsActive) {
    const all = await listStaffMembers();
    const otherActiveAdmins = all.filter(
      (m) => m.id !== id && m.isActive && m.canManageStaff
    );
    if (otherActiveAdmins.length === 0) {
      throw new Error('Cannot disable the last active administrator.');
    }
  }

  const [updated] = await db
    .update(staffMembers)
    .set({
      displayName:
        patch.displayName !== undefined
          ? patch.displayName?.trim() || null
          : existing.displayName,
      role: patch.role !== undefined ? normalizeRole(patch.role) : existing.role,
      canViewOrders:
        typeof patch.canViewOrders === 'boolean'
          ? patch.canViewOrders
            ? 1
            : 0
          : existing.canViewOrders,
      canUpdateOrderStatus:
        typeof patch.canUpdateOrderStatus === 'boolean'
          ? patch.canUpdateOrderStatus
            ? 1
            : 0
          : existing.canUpdateOrderStatus,
      canViewSales:
        typeof patch.canViewSales === 'boolean'
          ? patch.canViewSales
            ? 1
            : 0
          : existing.canViewSales,
      canManageStaff: nextCanManageStaff ? 1 : 0,
      isActive: nextIsActive ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(staffMembers.id, id))
    .returning();

  return toDto(updated);
}

export async function deleteStaffMemberById(id: number, actorEmail: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(staffMembers)
    .where(eq(staffMembers.id, id))
    .limit(1);

  const existing = rows[0];
  if (!existing) return false;

  const targetEmail = existing.email.trim().toLowerCase();
  if (targetEmail === BOOTSTRAP_ADMIN_EMAIL) {
    throw new Error('Primary administrator cannot be removed.');
  }
  if (targetEmail === actorEmail.trim().toLowerCase()) {
    throw new Error('You cannot remove your own active staff account.');
  }

  await db.delete(staffMembers).where(eq(staffMembers.id, id));
  return true;
}
