'use server';
import { revalidatePath } from 'next/cache';
import { hashPassword, verifyPassword } from '@/lib/auth';
import type { User, SafeUser } from '@/types';
import { getDb } from '@/services/mongodb';
import { MOCK_USERS } from '@/constants';

async function getStorageService() {
  const { StorageService } = await import('@/services/storageService');
  return StorageService;
}

export async function saveItemAction(collection: string, item: Record<string, unknown>) {
  try {
    const StorageService = await getStorageService();

    // Hash password if saving a user with a new password
    if (collection === 'users' && item.password && typeof item.password === 'string') {
      // Only hash if password doesn't start with $2 (bcrypt hash indicator)
      if (!item.password.startsWith('$2')) {
        item.password = await hashPassword(item.password);
      }
    }
    
    await StorageService.saveItem(collection, item);
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error saving item:', error);
    return { success: false, error: 'Failed to save item' };
  }
}

export async function deleteItemAction(collection: string, id: string) {
  try {
    const StorageService = await getStorageService();
    await StorageService.deleteItem(collection, id);
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error deleting item:', error);
    return { success: false, error: 'Failed to delete item' };
  }
}

export async function initializeDataAction(collection: string, data: Record<string, unknown>[]) {
  try {
    const StorageService = await getStorageService();
    await StorageService.initializeDataIfEmpty(collection, data);
    return { success: true };
  } catch (error) {
    console.error('Error initializing data:', error);
    return { success: false, error: 'Failed to initialize data' };
  }
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  const normalizedInput = username.trim();
  const escapedInput = normalizedInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const caseInsensitiveExact = new RegExp(`^${escapedInput}$`, 'i');

  const fallbackUser =
    MOCK_USERS.find((u) => u.username.toLowerCase() === normalizedInput.toLowerCase()) || null;

  const normalizeRole = (role: unknown): User['role'] => {
    if (role === 'SUPER_ADMIN' || role === 'WAREHOUSEMAN' || role === 'INSTALLER') {
      return role;
    }
    return 'WAREHOUSEMAN';
  };

  const normalizeUserDoc = (doc: Record<string, any>): User | null => {
    const resolvedUsername =
      (typeof doc.username === 'string' && doc.username) ||
      (typeof doc.userName === 'string' && doc.userName) ||
      (typeof doc.email === 'string' && doc.email) ||
      (typeof doc.nickname === 'string' && doc.nickname) ||
      '';

    const resolvedPassword =
      (typeof doc.password === 'string' && doc.password) ||
      (typeof doc.pass === 'string' && doc.pass) ||
      (typeof doc.passwordHash === 'string' && doc.passwordHash) ||
      (typeof doc.hash === 'string' && doc.hash) ||
      '';

    if (!resolvedUsername || !resolvedPassword) {
      return null;
    }

    const resolvedNickname =
      (typeof doc.nickname === 'string' && doc.nickname) ||
      (typeof doc.name === 'string' && doc.name) ||
      resolvedUsername;

    return {
      id: String(doc.id ?? doc._id ?? resolvedUsername),
      username: resolvedUsername,
      password: resolvedPassword,
      nickname: resolvedNickname,
      role: normalizeRole(doc.role),
    };
  };

  try {
    const db = await getDb();
    const doc = await db.collection('users').findOne({
      $or: [
        { username: caseInsensitiveExact },
        { userName: caseInsensitiveExact },
        { nickname: caseInsensitiveExact },
        { email: caseInsensitiveExact },
      ],
    });

    if (!doc) return fallbackUser;

    return normalizeUserDoc(doc) || fallbackUser;
  } catch (error) {
    console.error('Error getting user:', error);
    return fallbackUser;
  }
}

/**
 * Validate user credentials
 * Returns safe user data (without password) if valid
 */
export async function validateCredentials(
  username: string,
  password: string
): Promise<{ success: boolean; user?: SafeUser; error?: string }> {
  try {
    const normalizedUsername = username.trim();
    const user = await getUserByUsername(normalizedUsername);
    
    if (!user) {
      return { success: false, error: 'Invalid username or password' };
    }
    
    const isValid = await verifyPassword(password, user.password);
    
    if (!isValid) {
      return { success: false, error: 'Invalid username or password' };
    }
    
    // Return safe user data without password
    const safeUser: SafeUser = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      role: user.role,
    };
    
    return { success: true, user: safeUser };
  } catch (error) {
    console.error('Error validating credentials:', error);
    return { success: false, error: 'Authentication failed' };
  }
}
