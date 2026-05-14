// Helper to check if string is Base64
const isBase64 = (str: string) => {
  return typeof str === 'string' && str.startsWith('data:');
};

// Convert Firestore Timestamp-like values to plain JS Date recursively.
const normalizeFirestoreDates = (value: any): any => {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeFirestoreDates);
  }

  if (typeof value === 'object') {
    const maybeTimestamp = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };

    if (typeof maybeTimestamp.toDate === 'function') {
      return maybeTimestamp.toDate();
    }

    if (
      typeof maybeTimestamp.seconds === 'number' &&
      typeof maybeTimestamp.nanoseconds === 'number' &&
      Object.keys(value).every((key) => key === 'seconds' || key === 'nanoseconds')
    ) {
      return new Date(maybeTimestamp.seconds * 1000 + Math.floor(maybeTimestamp.nanoseconds / 1_000_000));
    }

    const normalized: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      normalized[key] = normalizeFirestoreDates(nestedValue);
    }
    return normalized;
  }

  return value;
};

// Helper to upload a single Base64 string to local filesystem and return the URL
const uploadBase64ToStorage = async (base64Data: string, filePath: string): Promise<string> => {
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: base64Data, filePath }),
    });
    if (!res.ok) {
      console.error('Upload failed, falling back to base64 storage');
      return base64Data;
    }
    const { url } = await res.json();
    return url;
  } catch (error) {
    console.error('Upload error, falling back to base64 storage:', error);
    return base64Data;
  }
};

/**
 * DEEP CLEANER
 * Iterates through an object and normalizes binary/document payload fields
 * before persistence to MongoDB.
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

  // 4. Handle Company Documents (generated files like quotes, docs)
  if (collectionName === 'companyDocuments' && processed.url && isBase64(processed.url)) {
    const isPdf = typeof processed.name === 'string' && processed.name.toLowerCase().endsWith('.pdf');
    const ext = isPdf ? 'pdf' : 'docx';
    processed.url = await uploadBase64ToStorage(
      processed.url,
      `companyDocuments/${processed.id}_${timestamp}.${ext}`
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
  // Upload a file (Mongo mode: keeps data URL as-is)
  uploadFile: async (base64Data: string, path: string): Promise<string> => {
    return await uploadBase64ToStorage(base64Data, path);
  },

  // Poll a collection every 5 seconds and call callback with latest data.
  // Returns a cleanup function (mirrors Firestore onSnapshot API).
  subscribe: (collectionName: string, callback: (data: any[]) => void): (() => void) => {
    let active = true;

    const fetchData = async () => {
      try {
        const res = await fetch(`/api/db/${collectionName}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (active) callback(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(`Error polling ${collectionName}:`, error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  },

  // Save (Create or Update)
  saveItem: async (collectionName: string, item: any) => {
    try {
      const cleanItem = await prepareDataForFirestore(collectionName, item);
      const sanitizedItem = sanitizeForFirestore(cleanItem);

      const res = await fetch(`/api/db/${collectionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: sanitizedItem }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Failed to save');
      }
    } catch (error: any) {
      console.error(`Error saving to ${collectionName}:`, error);
      alert(`Failed to save data. Error: ${error.message}`);
      throw error;
    }
  },

  // Delete
  deleteItem: async (collectionName: string, itemId: string) => {
    try {
      const res = await fetch(`/api/db/${collectionName}?id=${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Failed to delete');
      }
    } catch (error: any) {
      console.error(`Error deleting from ${collectionName}:`, error);
      alert('Failed to delete item.');
      throw error;
    }
  },

  // Batch Save (Save entire collection)
  batchSave: async (collectionName: string, items: any[]) => {
    try {
      await Promise.all(items.map(async (item) => {
        const cleanItem = await prepareDataForFirestore(collectionName, item);
        const sanitized = sanitizeForFirestore(cleanItem);
        const res = await fetch(`/api/db/${collectionName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item: sanitized }),
        });
        if (!res.ok) throw new Error(`Failed to save item ${sanitized.id}`);
      }));
    } catch (error: any) {
      console.error(`Error batch saving to ${collectionName}:`, error);
      throw error;
    }
  },

  // Bulk Load (initialize collection with mock data if empty)
  initializeDataIfEmpty: async (collectionName: string, mockData: any[]) => {
    try {
      const res = await fetch(`/api/db/${collectionName}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const existing = await res.json();

      if (Array.isArray(existing) && existing.length === 0 && mockData.length > 0) {
        console.log(`Initializing ${collectionName} with mock data...`);
        await Promise.all(mockData.map(async (item) => {
          const sanitized = sanitizeForFirestore(item);
          await fetch(`/api/db/${collectionName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: sanitized }),
          });
        }));
      }
    } catch (error: any) {
      console.error(`Error initializing ${collectionName}:`, error);
      throw error;
    }
  },

  // Get a single item by ID
  getItem: async (collectionName: string, itemId: string): Promise<any | null> => {
    try {
      const res = await fetch(`/api/db/${collectionName}?id=${encodeURIComponent(itemId)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (error: any) {
      console.error(`Error getting item from ${collectionName}:`, error);
      return null;
    }
  },

  // Get all items from a collection (non-realtime)
  getAllItems: async (collectionName: string): Promise<any[]> => {
    try {
      const res = await fetch(`/api/db/${collectionName}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (error: any) {
      console.error(`Error getting items from ${collectionName}:`, error);
      return [];
    }
  }
};
