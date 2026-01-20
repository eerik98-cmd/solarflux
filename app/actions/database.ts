'use server';

import { StorageService } from '@/services/storageService';
import { revalidatePath } from 'next/cache';

export async function saveItemAction(collection: string, item: Record<string, unknown>) {
  'use server';
  try {
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
