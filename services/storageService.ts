
import { db, storage } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { 
  ref, 
  uploadString, 
  getDownloadURL
} from 'firebase/storage';

// Helper to check if string is Base64
const isBase64 = (str: string) => {
  return typeof str === 'string' && str.startsWith('data:');
};

// Helper to upload a single Base64 string to Storage and return the URL
const uploadBase64ToStorage = async (base64Data: string, path: string): Promise<string> => {
  if (!storage) return base64Data; // Fallback if storage not init
  try {
    if (!isBase64(base64Data)) return base64Data; // Already a URL
    
    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64Data, 'data_url');
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading to storage:", error);
    // Continue without upload if storage fails, just to save the data
    return base64Data;
  }
};

/**
 * DEEP CLEANER
 * Iterates through an object. If it finds a Base64 string in specific fields, 
 * it uploads it to Firebase Storage and swaps the Base64 for the URL.
 */
const prepareDataForFirestore = async (collectionName: string, data: any) => {
  const processed = { ...data };
  const timestamp = Date.now();

  // 1. Handle Inventory Documents
  if (collectionName === 'inventory' && processed.documents) {
    if (processed.documents.dataSheet && isBase64(processed.documents.dataSheet)) {
      processed.documents.dataSheet = await uploadBase64ToStorage(
        processed.documents.dataSheet, 
        `inventory/${processed.id}/datasheet_${timestamp}`
      );
    }
    if (processed.documents.certificate && isBase64(processed.documents.certificate)) {
      processed.documents.certificate = await uploadBase64ToStorage(
        processed.documents.certificate, 
        `inventory/${processed.id}/certificate_${timestamp}`
      );
    }
  }

  // 2. Handle Client Documents
  if (collectionName === 'clients') {
    // A. Main Documents array
    if (processed.documents && Array.isArray(processed.documents)) {
      const updatedDocs = await Promise.all(processed.documents.map(async (doc: any) => {
        if (doc.url && isBase64(doc.url)) {
          const newUrl = await uploadBase64ToStorage(doc.url, `clients/${processed.id}/docs/${doc.id}_${timestamp}`);
          return { ...doc, url: newUrl };
        }
        return doc;
      }));
      processed.documents = updatedDocs;
    }

    // B. Site Images
    if (processed.needs && processed.needs.siteImages && Array.isArray(processed.needs.siteImages)) {
      const updatedImages = await Promise.all(processed.needs.siteImages.map(async (img: any) => {
        if (img.url && isBase64(img.url)) {
          const newUrl = await uploadBase64ToStorage(img.url, `clients/${processed.id}/site/${img.id}_${timestamp}`);
          return { ...img, url: newUrl };
        }
        return img;
      }));
      processed.needs.siteImages = updatedImages;
    }
  }

  // 3. Handle Doc Templates
  if (collectionName === 'templates' && processed.content && isBase64(processed.content)) {
    processed.content = await uploadBase64ToStorage(
      processed.content,
      `templates/${processed.id}_${timestamp}.docx`
    );
  }

  return processed;
};

// Robust function to remove undefined values and break circular references
function sanitizeForFirestore(obj: any, seen = new WeakSet()): any {
  if (obj === null || typeof obj !== 'object') {
    return obj === undefined ? null : obj;
  }

  if (obj instanceof Date) return obj;

  if (seen.has(obj)) {
    return null; // Break circular reference
  }
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(v => sanitizeForFirestore(v, seen)).filter(v => v !== undefined);
  }

  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = sanitizeForFirestore(obj[key], seen);
      if (value !== undefined) {
        result[key] = value;
      }
    }
  }
  return result;
}

export const StorageService = {
  // Subscribe to a collection (Real-time updates)
  subscribe: (collectionName: string, callback: (data: any[]) => void) => {
    if (!db) return () => {};
    
    const q = query(collection(db, collectionName));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => doc.data());
      callback(items);
    }, (error) => {
      console.error(`Error subscribing to ${collectionName}:`, error);
      if (error.code === 'permission-denied') {
        console.warn("Permission denied. Check Firestore Console -> Rules.");
      }
    });
  },

  // Save (Create or Update)
  saveItem: async (collectionName: string, item: any) => {
    if (!db) {
      alert("Database not configured. Please check services/firebase.ts");
      return;
    }

    try {
      // 1. Upload files first to avoid Firestore size limits
      const cleanItem = await prepareDataForFirestore(collectionName, item);
      
      // 2. Sanitize to remove undefined values and circular refs (Firestore rejects undefined)
      const sanitizedItem = sanitizeForFirestore(cleanItem);

      // 3. Save metadata to Firestore
      await setDoc(doc(db, collectionName, sanitizedItem.id), sanitizedItem);
    } catch (error: any) {
      console.error(`Error saving to ${collectionName}:`, error);
      
      if (error.code === 'permission-denied') {
         alert("PERMISSION DENIED: You cannot save data.\n\nPlease go to Firebase Console > Firestore Database > Rules and change 'allow read, write: if false;' to 'if true;'.");
      } else {
         alert(`Failed to save data. Error: ${error.message}`);
      }
      throw error;
    }
  },

  // Delete
  deleteItem: async (collectionName: string, itemId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, collectionName, itemId));
    } catch (error: any) {
      console.error(`Error deleting from ${collectionName}:`, error);
      if (error.code === 'permission-denied') {
        alert("PERMISSION DENIED: Check your Firestore Security Rules.");
      } else {
        alert("Failed to delete item.");
      }
      throw error;
    }
  },

  // Batch Save (Save entire collection)
  batchSave: async (collectionName: string, items: any[]) => {
    if (!db) return;
    
    try {
      const batch = writeBatch(db);
      for (const item of items) {
        const cleanItem = await prepareDataForFirestore(collectionName, item);
        const sanitized = sanitizeForFirestore(cleanItem);
        const ref = doc(db, collectionName, sanitized.id);
        batch.set(ref, sanitized);
      }
      await batch.commit();
    } catch (error: any) {
      console.error(`Error batch saving to ${collectionName}:`, error);
      if (error.code === 'permission-denied') {
        alert('PERMISSION DENIED: Check your Firestore Security Rules.');
      }
      throw error;
    }
  },

  // Bulk Load (Used for initializing Mock Data if DB is empty)
  initializeDataIfEmpty: async (collectionName: string, mockData: any[]) => {
    if (!db) return;
    
    const q = query(collection(db, collectionName));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty && mockData.length > 0) {
      console.log(`Initializing ${collectionName} with mock data...`);
      const batch = writeBatch(db);
      mockData.forEach(item => {
        const sanitized = sanitizeForFirestore(item);
        const ref = doc(db, collectionName, item.id);
        batch.set(ref, sanitized);
      });
      await batch.commit();
    }
  }
};
