import { getStoreSnapshot, withStoreMutation } from './jsonStore.ts';
import {
  getEnvAdminConfig,
  hashPassword,
  isValidUsername,
  normalizeUsername,
  timingSafeStringEqual,
  verifyPassword,
} from '../lib/staffAuth.ts';
import type { StoredStaffMember } from '../data/initialStoreData.ts';

export type StaffRole = 'admin' | 'manager' | 'operations' | 'viewer';
export type StaffPermissionKey =
  | 'canViewOrders'
  | 'canUpdateOrderStatus'
  | 'canViewSales'
  | 'canManageStaff'
  | 'canManageProducts';

export interface StaffMemberDTO {
  id: number;
  username: string;
  displayName: string | null;
  role: StaffRole;
  canViewOrders: boolean;
  canUpdateOrderStatus: boolean;
  canViewSales: boolean;
  canManageStaff: boolean;
  canManageProducts: boolean;
  isActive: boolean;
  isPrimaryAdmin: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export function normalizeRole(raw: unknown): StaffRole {
  if (raw === 'admin' || raw === 'manager' || raw === 'operations' || raw === 'viewer') {
    return raw;
  }
  return 'operations';
}

function toDto(row: StoredStaffMember): StaffMemberDTO {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: normalizeRole(row.role),
    canViewOrders: row.canViewOrders,
    canUpdateOrderStatus: row.canUpdateOrderStatus,
    canViewSales: row.canViewSales,
    canManageStaff: row.canManageStaff,
    canManageProducts: row.canManageProducts,
    isActive: row.isActive,
    isPrimaryAdmin: row.isPrimaryAdmin,
    hasPassword: Boolean(row.passwordHash),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function getStaffAuthStatus(): {
  needsInitialSetup: boolean;
  defaultUsername: string;
} {
  const envAdmin = getEnvAdminConfig();
  if (envAdmin.password) {
    return {
      needsInitialSetup: false,
      defaultUsername: envAdmin.username,
    };
  }

  const store = getStoreSnapshot();
  const hasClaimedAdmin = store.staffMembers.some(
    (m) => m.isActive && m.canManageStaff && Boolean(m.passwordHash)
  );

  return {
    needsInitialSetup: !hasClaimedAdmin,
    defaultUsername: envAdmin.username,
  };
}

export async function claimInitialAdmin(input: {
  username?: string;
  password: string;
  displayName?: string | null;
}): Promise<StaffMemberDTO> {
  const envAdmin = getEnvAdminConfig();
  if (envAdmin.password) {
    throw new Error(
      'Primary administrator password is already configured via environment variables.'
    );
  }

  const username = normalizeUsername(input.username || envAdmin.username);
  if (!isValidUsername(username)) {
    throw new Error('Username must be at least 2 characters (letters, numbers, ., _, @, -).');
  }
  if (typeof input.password !== 'string' || input.password.length < 6 || input.password.length > 128) {
    throw new Error('Password must be between 6 and 128 characters.');
  }

  const passwordHash = hashPassword(input.password);
  const now = new Date().toISOString();

  return withStoreMutation((store) => {
    const alreadyClaimed = store.staffMembers.some(
      (m) => m.isActive && m.canManageStaff && Boolean(m.passwordHash)
    );
    if (alreadyClaimed) {
      throw new Error('Initial administrator setup has already been completed.');
    }

    const existing = store.staffMembers.find((m) => m.username === username);
    if (existing) {
      existing.displayName = input.displayName?.trim().slice(0, 120) || existing.displayName || 'MARAYA Admin';
      existing.passwordHash = passwordHash;
      existing.role = 'admin';
      existing.canViewOrders = true;
      existing.canUpdateOrderStatus = true;
      existing.canViewSales = true;
      existing.canManageStaff = true;
      existing.canManageProducts = true;
      existing.isActive = true;
      existing.isPrimaryAdmin = true;
      existing.updatedAt = now;
      return toDto(existing);
    }

    const created: StoredStaffMember = {
      id: store.nextStaffSeq++,
      username,
      displayName: input.displayName?.trim().slice(0, 120) || 'MARAYA Admin',
      passwordHash,
      role: 'admin',
      canViewOrders: true,
      canUpdateOrderStatus: true,
      canViewSales: true,
      canManageStaff: true,
      canManageProducts: true,
      isActive: true,
      isPrimaryAdmin: true,
      createdAt: now,
      updatedAt: now,
    };
    store.staffMembers.push(created);
    return toDto(created);
  });
}

export async function authenticateStaffCredentials(
  rawUsername: string,
  rawPassword: string
): Promise<StaffMemberDTO | null> {
  const username = normalizeUsername(rawUsername);
  if (!username || typeof rawPassword !== 'string' || !rawPassword) {
    return null;
  }

  const envAdmin = getEnvAdminConfig();
  if (
    envAdmin.password &&
    username === envAdmin.username &&
    timingSafeStringEqual(rawPassword, envAdmin.password)
  ) {
    return withStoreMutation((store) => {
      const now = new Date().toISOString();
      const existing = store.staffMembers.find((m) => m.username === envAdmin.username);
      if (existing) {
        existing.role = 'admin';
        existing.canViewOrders = true;
        existing.canUpdateOrderStatus = true;
        existing.canViewSales = true;
        existing.canManageStaff = true;
        existing.canManageProducts = true;
        existing.isActive = true;
        existing.isPrimaryAdmin = true;
        existing.updatedAt = now;
        return toDto(existing);
      }

      const created: StoredStaffMember = {
        id: store.nextStaffSeq++,
        username: envAdmin.username,
        displayName: 'MARAYA Admin',
        passwordHash: null,
        role: 'admin',
        canViewOrders: true,
        canUpdateOrderStatus: true,
        canViewSales: true,
        canManageStaff: true,
        canManageProducts: true,
        isActive: true,
        isPrimaryAdmin: true,
        createdAt: now,
        updatedAt: now,
      };
      store.staffMembers.push(created);
      return toDto(created);
    });
  }

  const store = getStoreSnapshot();
  const member = store.staffMembers.find((m) => m.username === username);
  if (!member || !member.isActive || !member.passwordHash) {
    return null;
  }

  if (!verifyPassword(rawPassword, member.passwordHash)) {
    return null;
  }

  return toDto(member);
}

export function getStaffMemberByUsername(rawUsername: string): StaffMemberDTO | null {
  const username = normalizeUsername(rawUsername);
  if (!username) return null;

  const store = getStoreSnapshot();
  const member = store.staffMembers.find((m) => m.username === username);
  if (member) {
    return toDto(member);
  }

  const envAdmin = getEnvAdminConfig();
  if (envAdmin.password && username === envAdmin.username) {
    return {
      id: 0,
      username: envAdmin.username,
      displayName: 'MARAYA Admin',
      role: 'admin',
      canViewOrders: true,
      canUpdateOrderStatus: true,
      canViewSales: true,
      canManageStaff: true,
      canManageProducts: true,
      isActive: true,
      isPrimaryAdmin: true,
      hasPassword: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return null;
}

export async function listStaffMembers(): Promise<StaffMemberDTO[]> {
  const store = getStoreSnapshot();
  return store.staffMembers
    .slice()
    .sort((a, b) => a.id - b.id)
    .map(toDto);
}

export interface UpsertStaffInput {
  username: string;
  displayName?: string | null;
  password?: string;
  role: StaffRole;
  canViewOrders: boolean;
  canUpdateOrderStatus: boolean;
  canViewSales: boolean;
  canManageStaff: boolean;
  canManageProducts: boolean;
  isActive: boolean;
}

export async function upsertStaffMember(input: UpsertStaffInput): Promise<StaffMemberDTO> {
  const username = normalizeUsername(input.username);
  if (!isValidUsername(username)) {
    throw new Error('Username must be at least 2 characters (letters, numbers, ., _, @, -).');
  }

  const envAdmin = getEnvAdminConfig();
  if (envAdmin.password && username === envAdmin.username) {
    throw new Error('Primary environment-configured administrator cannot be modified here.');
  }

  const cleanPassword = typeof input.password === 'string' ? input.password : '';
  if (cleanPassword && (cleanPassword.length < 6 || cleanPassword.length > 128)) {
    throw new Error('Password must be between 6 and 128 characters.');
  }

  return withStoreMutation((store) => {
    const now = new Date().toISOString();
    const existing = store.staffMembers.find((m) => m.username === username);

    if (existing) {
      if (existing.isPrimaryAdmin) {
        if (cleanPassword) {
          existing.passwordHash = hashPassword(cleanPassword);
        }
        if (input.displayName !== undefined) {
          existing.displayName = input.displayName?.trim().slice(0, 120) || existing.displayName;
        }
        existing.updatedAt = now;
        return toDto(existing);
      }

      existing.displayName = input.displayName?.trim().slice(0, 120) || null;
      existing.role = normalizeRole(input.role);
      existing.canViewOrders = input.canViewOrders;
      existing.canUpdateOrderStatus = input.canUpdateOrderStatus;
      existing.canViewSales = input.canViewSales;
      existing.canManageStaff = input.canManageStaff;
      existing.canManageProducts = input.canManageProducts;
      existing.isActive = input.isActive;
      if (cleanPassword) {
        existing.passwordHash = hashPassword(cleanPassword);
      }
      existing.updatedAt = now;
      return toDto(existing);
    }

    if (!cleanPassword) {
      throw new Error('Password (at least 6 characters) is required for a new staff member.');
    }

    const created: StoredStaffMember = {
      id: store.nextStaffSeq++,
      username,
      displayName: input.displayName?.trim().slice(0, 120) || null,
      passwordHash: hashPassword(cleanPassword),
      role: normalizeRole(input.role),
      canViewOrders: input.canViewOrders,
      canUpdateOrderStatus: input.canUpdateOrderStatus,
      canViewSales: input.canViewSales,
      canManageStaff: input.canManageStaff,
      canManageProducts: input.canManageProducts,
      isActive: input.isActive,
      isPrimaryAdmin: false,
      createdAt: now,
      updatedAt: now,
    };

    store.staffMembers.push(created);
    return toDto(created);
  });
}

export async function updateStaffMemberById(
  id: number,
  patch: Partial<Omit<UpsertStaffInput, 'username'>>
): Promise<StaffMemberDTO | null> {
  const cleanPassword = typeof patch.password === 'string' ? patch.password : '';
  if (cleanPassword && (cleanPassword.length < 6 || cleanPassword.length > 128)) {
    throw new Error('Password must be between 6 and 128 characters.');
  }

  return withStoreMutation((store) => {
    const existing = store.staffMembers.find((m) => m.id === id);
    if (!existing) return null;

    const now = new Date().toISOString();

    if (existing.isPrimaryAdmin) {
      if (patch.displayName !== undefined) {
        existing.displayName = patch.displayName?.trim().slice(0, 120) || existing.displayName;
      }
      if (cleanPassword) {
        existing.passwordHash = hashPassword(cleanPassword);
      }
      existing.updatedAt = now;
      return toDto(existing);
    }

    const nextCanManageStaff =
      typeof patch.canManageStaff === 'boolean'
        ? patch.canManageStaff
        : existing.canManageStaff;
    const nextIsActive =
      typeof patch.isActive === 'boolean' ? patch.isActive : existing.isActive;

    if (!nextCanManageStaff || !nextIsActive) {
      const envAdmin = getEnvAdminConfig();
      const hasEnvAdmin = Boolean(envAdmin.password);
      const otherActiveAdmins = store.staffMembers.filter(
        (m) => m.id !== id && m.isActive && m.canManageStaff
      );
      if (!hasEnvAdmin && otherActiveAdmins.length === 0) {
        throw new Error('Cannot disable the last active administrator.');
      }
    }

    if (patch.displayName !== undefined) {
      existing.displayName = patch.displayName?.trim().slice(0, 120) || null;
    }
    if (patch.role !== undefined) {
      existing.role = normalizeRole(patch.role);
    }
    if (typeof patch.canViewOrders === 'boolean') existing.canViewOrders = patch.canViewOrders;
    if (typeof patch.canUpdateOrderStatus === 'boolean') {
      existing.canUpdateOrderStatus = patch.canUpdateOrderStatus;
    }
    if (typeof patch.canViewSales === 'boolean') existing.canViewSales = patch.canViewSales;
    existing.canManageStaff = nextCanManageStaff;
    if (typeof patch.canManageProducts === 'boolean') {
      existing.canManageProducts = patch.canManageProducts;
    }
    existing.isActive = nextIsActive;
    if (cleanPassword) {
      existing.passwordHash = hashPassword(cleanPassword);
    }
    existing.updatedAt = now;

    return toDto(existing);
  });
}

export async function deleteStaffMemberById(id: number, actorUsername: string): Promise<boolean> {
  return withStoreMutation((store) => {
    const idx = store.staffMembers.findIndex((m) => m.id === id);
    if (idx === -1) return false;

    const existing = store.staffMembers[idx];
    if (existing.isPrimaryAdmin) {
      throw new Error('Primary administrator cannot be removed.');
    }
    if (existing.username === normalizeUsername(actorUsername)) {
      throw new Error('You cannot remove your own active staff account.');
    }

    store.staffMembers.splice(idx, 1);
    return true;
  });
}
