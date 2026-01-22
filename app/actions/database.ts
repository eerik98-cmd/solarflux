'use server';

import { StorageService } from '@/services/storageService';
import { revalidatePath } from 'next/cache';
import { hashPassword, verifyPassword } from '@/lib/auth';
import type { User, SafeUser } from '@/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';

export async function saveItemAction(collection: string, item: Record<string, unknown>) {
  'use server';
  try {
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
  'use server';
  try {
    await StorageService.deleteItem(collection, id);
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error deleting item:', error);
    return { success: false, error: 'Failed to delete item' };
  }
}

export async function initializeDataAction(collection: string, data: Record<string, unknown>[]) {
  'use server';
  try {
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
  'use server';
  try {
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const userData = querySnapshot.docs[0].data();
    return {
      id: querySnapshot.docs[0].id,
      ...userData,
    } as User;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
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
  'use server';
  try {
    const user = await getUserByUsername(username);
    
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
