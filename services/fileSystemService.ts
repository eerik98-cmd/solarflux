import { Client, ClientDocument } from '../types';

export const DEFAULT_CLIENT_FOLDERS = [
  { id: 'legal', name: 'Legal & Contracts', description: 'Contracts, GDPR, IDs', icon: 'Scale' },
  { id: 'technical', name: 'Technical & Site', description: 'Plans, Diagrams, Site Surveys', icon: 'Wrench' },
  { id: 'financial', name: 'Financial', description: 'Invoices, Receipts, Offers', icon: 'DollarSign' },
  { id: 'permits', name: 'Permits & ATR', description: 'ATR, City Hall Permits', icon: 'Home' },
  { id: 'photos', name: 'Site Photos', description: 'Installation & Survey Photos', icon: 'Image' }
];

export const getFolderForDocType = (type: string): string => {
  switch (type) {
    case 'CI': return 'legal';
    case 'CF': return 'legal';
    case 'Fact': return 'financial';
    default: return 'legal';
  }
};

export const FileSystem = {
  createClientRepository: async (client: Client) => {
    // In a real app, this would create folders in AWS S3 or Google Drive
    // Here we just ensure the structure exists in our local logic
    return true;
  },

  saveFile: async (client: Client, fileData: File | Blob, folderId: string, type: 'CI' | 'CF' | 'Fact' | 'Other', customName?: string): Promise<ClientDocument> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        const name = customName || (fileData instanceof File ? fileData.name : `${type}_${Date.now()}.pdf`);
        
        const newDoc: ClientDocument = {
          id: Date.now().toString(),
          name: name,
          type: type,
          url: url,
          date: new Date(),
          folder: folderId
        };
        resolve(newDoc);
      };
      
      if (fileData instanceof File) {
        reader.readAsDataURL(fileData);
      } else {
        // Handle Blob (e.g. from doc generator)
        reader.readAsDataURL(fileData);
      }
    });
  },

  getFiles: (client: Client, folderId: string | null): ClientDocument[] => {
    if (!client.documents) return [];
    if (!folderId) {
       // If folderId is null (root), maybe show unassigned files or nothing?
       // For this UI, root shows folders, so this might not be called for file lists often
       return [];
    }
    return client.documents.filter(doc => doc.folder === folderId || (!doc.folder && folderId === 'legal')); 
  }
};