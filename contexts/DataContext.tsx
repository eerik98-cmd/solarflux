'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { InventoryItem, Client, Quote, User, DocTemplate } from '@/types';
import { StorageService } from '@/services/storageService';
import { MOCK_USERS } from '@/constants';

interface DataContextType {
  inventory: InventoryItem[];
  clients: Client[];
  savedQuotes: Quote[];
  users: User[];
  docTemplates: DocTemplate[];
  companyDocuments: Record<string, unknown>[];
  dbConnectionError: boolean;
  setInventory: (inventory: InventoryItem[]) => void;
  setClients: (clients: Client[]) => void;
  setSavedQuotes: (quotes: Quote[]) => void;
  setUsers: (users: User[]) => void;
  setDocTemplates: (templates: DocTemplate[]) => void;
  setCompanyDocuments: (docs: Record<string, unknown>[]) => void;
  saveQuote: (quote: Quote) => Promise<void>;
  deleteQuote: (quoteId: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<Quote[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>([]);
  const [companyDocuments, setCompanyDocuments] = useState<Record<string, unknown>[]>([]);
  const [dbConnectionError, setDbConnectionError] = useState(false);

  // Firestore Subscriptions
  useEffect(() => {
    const unsubInventory = StorageService.subscribe('inventory', (data) => 
      setInventory(data as InventoryItem[])
    );
    const unsubClients = StorageService.subscribe('clients', (data) => 
      setClients(data as Client[])
    );
    const unsubQuotes = StorageService.subscribe('quotes', (data) => 
      setSavedQuotes(data as Quote[])
    );
    const unsubUsers = StorageService.subscribe('users', (data) => 
      setUsers(data as User[])
    );
    const unsubTemplates = StorageService.subscribe('templates', (data) => 
      setDocTemplates(data as DocTemplate[])
    );
    const unsubCompanyDocuments = StorageService.subscribe('companyDocuments', (data) => 
      setCompanyDocuments(data as any[])
    );

    const initDB = async () => {
      try {
        await StorageService.initializeDataIfEmpty('users', MOCK_USERS);
      } catch (err) {
        console.error('Failed to connect to Firebase:', err);
        setDbConnectionError(true);
      }
    };
    initDB();

    return () => {
      unsubInventory();
      unsubClients();
      unsubQuotes();
      unsubUsers();
      unsubTemplates();
      unsubCompanyDocuments();
    };
  }, []);

  const saveQuote = async (quote: Quote) => {
    await StorageService.saveItem('quotes', quote);
  };

  const deleteQuote = async (quoteId: string) => {
    await StorageService.deleteItem('quotes', quoteId);
  };

  return (
    <DataContext.Provider
      value={{
        inventory,
        clients,
        savedQuotes,
        users,
        docTemplates,
        companyDocuments,
        dbConnectionError,
        setInventory,
        setClients,
        setSavedQuotes,
        setUsers,
        setDocTemplates,
        setCompanyDocuments,
        saveQuote,
        deleteQuote,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
