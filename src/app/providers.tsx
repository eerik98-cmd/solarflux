/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
// import { InventoryItem, Quote, Client, Installer, User, DocTemplate } from '@/types';
import { db } from '@/services/firebase';
import { collection, getDocs, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';

// TODO
type InventoryItem = any; // Replace with actual type
type Quote = any; // Replace with actual type
type Client = any; // Replace with actual type
type Installer = any; // Replace with actual type
type User = any; // Replace with actual type
type DocTemplate = any; // Replace with actual type

interface AppContextType {
  inventory: InventoryItem[];
  clients: Client[];
  savedQuotes: Quote[];
  installers: Installer[];
  users: User[];
  docTemplates: DocTemplate[];
  currentUser: User | null;
  isLoading: boolean;
  handleAddItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  handleUpdateItem: (id: string, item: Omit<InventoryItem, 'id'>) => Promise<void>;
  handleDeleteItem: (id: string) => Promise<void>;
  handleSaveQuote: (quote: Quote) => Promise<void>;
  handleDeleteQuote: (id: string) => Promise<void>;
  handleAddClient: (client: Client) => Promise<void>;
  handleUpdateClient: (client: Client) => Promise<void>;
  handleDeleteClient: (id: string) => Promise<void>;
  handleAddUser: (user: User) => Promise<void>;
  handleDeleteUser: (id: string) => Promise<void>;
  handleAddTemplate: (template: DocTemplate) => Promise<void>;
  handleDeleteTemplate: (id: string) => Promise<void>;
  setCurrentUser: (user: User | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<Quote[]>([]);
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const invSnapshot = await getDocs(collection(db, 'inventory'));
        setInventory(invSnapshot.docs.map(d => d.data() as InventoryItem));

        const cliSnapshot = await getDocs(collection(db, 'clients'));
        setClients(cliSnapshot.docs.map(d => d.data() as Client));

        const quoSnapshot = await getDocs(collection(db, 'quotes'));
        setSavedQuotes(quoSnapshot.docs.map(d => d.data() as Quote));

        const instSnapshot = await getDocs(collection(db, 'installers'));
        setInstallers(instSnapshot.docs.map(d => d.data() as Installer));

        const usersSnapshot = await getDocs(collection(db, 'users'));
        setUsers(usersSnapshot.docs.map(d => d.data() as User));

        const docsSnapshot = await getDocs(collection(db, 'doc_templates'));
        setDocTemplates(docsSnapshot.docs.map(d => d.data() as DocTemplate));
      } catch (err) {
        console.error("Error fetching data from Firestore", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAddItem = async (newItemData: Omit<InventoryItem, 'id'>) => {
    const newItem: InventoryItem = { ...newItemData, id: Date.now().toString() };
    try {
      await setDoc(doc(db, 'inventory', newItem.id), newItem);
      setInventory(prev => [...prev, newItem]);
    } catch (error: any) {
      alert("Error saving item: " + error.message);
    }
  };

  const handleUpdateItem = async (id: string, updatedItemData: Omit<InventoryItem, 'id'>) => {
    const updatedItem = { ...updatedItemData, id };
    try {
      await updateDoc(doc(db, 'inventory', id), updatedItem);
      setInventory(prev => prev.map(item => item.id === id ? updatedItem : item));
    } catch (error: any) {
      alert("Error updating item: " + error.message);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteDoc(doc(db, 'inventory', id));
        setInventory(prev => prev.filter(item => item.id !== id));
      } catch (error: any) {
        alert("Error deleting item: " + error.message);
      }
    }
  };

  const handleSaveQuote = async (quote: Quote) => {
    try {
      await setDoc(doc(db, 'quotes', quote.id), quote);
      setSavedQuotes(prev => {
        const existingIndex = prev.findIndex(q => q.id === quote.id);
        if (existingIndex >= 0) {
          const newQuotes = [...prev];
          newQuotes[existingIndex] = quote;
          return newQuotes;
        }
        return [...prev, quote];
      });
    } catch (error: any) {
      alert("Error saving quote: " + error.message);
    }
  };

  const handleDeleteQuote = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this quote?')) {
      try {
        await deleteDoc(doc(db, 'quotes', id));
        setSavedQuotes(prev => prev.filter(q => q.id !== id));
      } catch (error: any) {
        alert("Error deleting quote: " + error.message);
      }
    }
  };

  const handleAddClient = async (newClient: Client) => {
    try {
      await setDoc(doc(db, 'clients', newClient.id), newClient);
      setClients(prev => [...prev, newClient]);
    } catch (error: any) {
      alert("Error adding client: " + error.message);
    }
  };

  const handleUpdateClient = async (updatedClient: Client) => {
    try {
      await updateDoc(doc(db, 'clients', updatedClient.id), updatedClient);
      setClients(prev => prev.map(client => client.id === updatedClient.id ? updatedClient : client));
    } catch (error: any) {
      alert("Error updating client: " + error.message);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        await deleteDoc(doc(db, 'clients', id));
        setClients(prev => prev.filter(client => client.id !== id));
      } catch (error: any) {
        alert("Error deleting client: " + error.message);
      }
    }
  };

  const handleAddUser = async (user: User) => {
    try {
      await setDoc(doc(db, 'users', user.id), user);
      setUsers(prev => [...prev, user]);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm("Remove this user?")) {
      try {
        await deleteDoc(doc(db, 'users', id));
        setUsers(prev => prev.filter(u => u.id !== id));
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleAddTemplate = async (template: DocTemplate) => {
    try {
      await setDoc(doc(db, 'doc_templates', template.id), template);
      setDocTemplates(prev => [...prev, template]);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (window.confirm("Remove this template?")) {
      try {
        await deleteDoc(doc(db, 'doc_templates', id));
        setDocTemplates(prev => prev.filter(t => t.id !== id));
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <AppContext.Provider value={{
      inventory, clients, savedQuotes, installers, users, docTemplates, currentUser, isLoading,
      handleAddItem, handleUpdateItem, handleDeleteItem,
      handleSaveQuote, handleDeleteQuote,
      handleAddClient, handleUpdateClient, handleDeleteClient,
      handleAddUser, handleDeleteUser,
      handleAddTemplate, handleDeleteTemplate,
      setCurrentUser
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};