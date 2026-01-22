'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Client, ClientNote, InventoryItem, Quote, DocTemplate } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { StorageService } from '@/services/storageService';

interface ClientContextType {
  client: Client | null;
  setClient: (client: Client | null) => void;
  hasChanges: boolean;
  setHasChanges: (hasChanges: boolean) => void;
  updateClient: (updates: Partial<Client>) => Promise<void>;
  saveClient: () => Promise<void>;
  addNote: (content: string) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  uploadDocument: (file: File, docType: string, description?: string, docInput?: string) => Promise<void>;
  deleteDocument: (docId: string) => Promise<void>;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children, clientId }: { children: ReactNode; clientId: string }) {
  const { clients } = useData();
  const { currentUser } = useAuth();
  const [client, setClient] = useState<Client | null>(() => 
    clients.find(c => c.id === clientId) || null
  );
  const [hasChanges, setHasChanges] = useState(false);

  const updateClient = async (updates: Partial<Client>) => {
    if (!client) return;
    const updatedClient = { ...client, ...updates };
    setClient(updatedClient);
    await StorageService.saveItem('clients', updatedClient);
  };

  const saveClient = async () => {
    if (!client) return;
    await StorageService.saveItem('clients', client);
    setHasChanges(false);
  };

  const addNote = async (content: string) => {
    if (!client || !content.trim()) return;
    const newNote: ClientNote = {
      id: Date.now().toString(),
      content,
      date: new Date(),
      author: currentUser?.nickname || 'Unknown'
    };
    const updatedClient = {
      ...client,
      notes: [newNote, ...(client.notes || [])]
    };
    await StorageService.saveItem('clients', updatedClient);
    setClient(updatedClient);
  };

  const deleteNote = async (noteId: string) => {
    if (!client) return;
    const updatedClient = {
      ...client,
      notes: client.notes?.filter(n => n.id !== noteId)
    };
    await StorageService.saveItem('clients', updatedClient);
    setClient(updatedClient);
  };

  const uploadDocument = async (file: File, docType: string, description?: string, docInput?: string) => {
    if (!client) return;
    // Implementation will use FileSystem service
    // For now, just a placeholder
  };

  const deleteDocument = async (docId: string) => {
    if (!client) return;
    const updatedClient = {
      ...client,
      documents: client.documents?.filter(d => d.id !== docId)
    };
    await StorageService.saveItem('clients', updatedClient);
    setClient(updatedClient);
  };

  return (
    <ClientContext.Provider
      value={{
        client,
        setClient,
        hasChanges,
        setHasChanges,
        updateClient,
        saveClient,
        addNote,
        deleteNote,
        uploadDocument,
        deleteDocument,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error('useClient must be used within a ClientProvider');
  }
  return context;
}
