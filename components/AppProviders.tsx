'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Login } from '@/components/Login';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { InventoryItem, View, Quote, Client, User, DocTemplate } from '@/types';
import { MOCK_USERS } from '@/constants';
import { Loader2, CloudOff } from 'lucide-react';
import { StorageService } from '@/services/storageService';

// Lazy load components
// const Dashboard = React.lazy(() => import('@/components/Dashboard').then(module => ({ default: module.Dashboard })));
const InventoryList = React.lazy(() => import('@/components/InventoryList').then(module => ({ default: module.InventoryList })));
const InventoryForm = React.lazy(() => import('@/components/InventoryForm'));
// const AIAssistant = React.lazy(() => import('@/components/AIAssistant').then(module => ({ default: module.AIAssistant })));
const QuoteGenerator = React.lazy(() => import('@/components/QuoteGenerator').then(module => ({ default: module.QuoteGenerator })));
const ClientRegistry = React.lazy(() => import('@/components/ClientRegistry').then(module => ({ default: module.ClientRegistry })));
const Settings = React.lazy(() => import('@/components/Settings').then(module => ({ default: module.Settings })));
const FileManager = React.lazy(() => import('@/components/FileManager').then(module => ({ default: module.FileManager })));

export function AppProviders() {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [dbConnectionError, setDbConnectionError] = useState(false);

  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [currentView, setCurrentView] = useState<View>('CLIENTS');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<Quote[]>([]);
  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>([]);
  const [companyDocuments, setCompanyDocuments] = useState<Record<string, unknown>[]>([]);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  
  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Firestore Subscriptions
  useEffect(() => {
    const unsubInventory = StorageService.subscribe('inventory', (data) => setInventory(data as InventoryItem[]));
    const unsubClients = StorageService.subscribe('clients', (data) => setClients(data as Client[]));
    const unsubQuotes = StorageService.subscribe('quotes', (data) => setSavedQuotes(data as Quote[]));
    const unsubUsers = StorageService.subscribe('users', (data) => setUsers(data as User[]));
    const unsubTemplates = StorageService.subscribe('templates', (data) => setDocTemplates(data as DocTemplate[]));
    const unsubCompanyDocuments = StorageService.subscribe('companyDocuments', (data) => setCompanyDocuments(data as any[]));

    const initDB = async () => {
      try {
        await StorageService.initializeDataIfEmpty('users', MOCK_USERS);
      } catch (err) {
        console.error("Failed to connect to Firebase:", err);
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

  // Handlers using server actions
  const handleAddItem = async (newItemData: Omit<InventoryItem, 'id'>) => {
    const newItem: InventoryItem = {
      ...newItemData,
      id: Date.now().toString(), 
    };
    setIsFormOpen(false);
    await StorageService.saveItem('inventory', newItem);
  };

  const handleUpdateItem = async (updatedItemData: Omit<InventoryItem, 'id'>) => {
    if (!editingItem) return;
    const updatedItem = { ...updatedItemData, id: editingItem.id };
    setIsFormOpen(false);
    setEditingItem(null);
    await StorageService.saveItem('inventory', updatedItem);
  };

  const handleDeleteItem = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Item',
      message: 'Are you sure you want to delete this item? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        await StorageService.deleteItem('inventory', id);
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleSaveQuote = async (quote: Quote) => {
    await StorageService.saveItem('quotes', quote);
  };

  const handleDeleteQuote = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Quote',
      message: 'Are you sure you want to delete this quote? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        await StorageService.deleteItem('quotes', id);
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleAddClient = async (newClient: Client) => {
    await StorageService.saveItem('clients', newClient);
  };

  const handleUpdateClient = async (updatedClient: Client) => {
    await StorageService.saveItem('clients', updatedClient);
  };

  const handleDeleteClient = async (id: string) => {
    const clientToDelete = clients.find(c => c.id === id);
    
    let message = 'Are you sure you want to delete this client? This will remove all associated data and cannot be undone.';
    
    // Enhanced warning for archived clients with projects
    if (clientToDelete?.status === 'CLOSED' && clientToDelete?.archivedProjects && clientToDelete.archivedProjects.length > 0) {
      message = `This archived client has ${clientToDelete.archivedProjects.length} archived project(s). Deleting will permanently remove all project data and cannot be undone. Are you sure you want to continue?`;
    }
    
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Client',
      message: message,
      variant: 'danger',
      onConfirm: async () => {
        await StorageService.deleteItem('clients', id);
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleAddUser = async (user: User) => {
    await StorageService.saveItem('users', user);
  };

  const handleDeleteUser = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove User',
      message: 'Are you sure you want to remove this user? They will lose access to the system.',
      variant: 'danger',
      onConfirm: async () => {
        await StorageService.deleteItem('users', id);
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleAddTemplate = async (template: DocTemplate) => {
    await StorageService.saveItem('templates', template);
  };

  const handleDeleteTemplate = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Template',
      message: 'Are you sure you want to remove this template? This action cannot be undone.',
      variant: 'danger',
      onConfirm: async () => {
        await StorageService.deleteItem('templates', id);
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleAddCompanyDocument = async (doc: any) => {
    await StorageService.saveItem('companyDocuments', doc);
  };

  const handleDeleteCompanyDocument = async (id: string) => {
    await StorageService.deleteItem('companyDocuments', id);
  };

  const handleUpdateCompanyDocument = async (id: string, updates: any) => {
    const existingDoc = companyDocuments.find(d => d.id === id);
    if (existingDoc) {
      const updatedDoc = { ...existingDoc, ...updates };
      await StorageService.saveItem('companyDocuments', updatedDoc);
    }
  };

  const handleLogin = (u: string, p: string) => {
    let user = users.find(user => user.username === u && user.password === p);
    
    if (!user) {
       user = MOCK_USERS.find(user => user.username === u && user.password === p);
    }

    if (user) {
      setCurrentUser(user);
      setIsAuthenticated(true);
    } else {
      throw new Error("Invalid credentials");
    }
  };

  const openAddForm = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const openEditForm = (item: InventoryItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const LoadingFallback = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
      <Loader2 size={40} className="animate-spin text-amber-500" />
      <p>Loading module...</p>
    </div>
  );

  if (!isAuthenticated) {
    return (
      <>
        {dbConnectionError && (
          <div className="bg-red-500 text-white text-center p-2 text-sm flex justify-center items-center gap-2">
             <CloudOff size={16} /> 
             Could not connect to database. Check your internet or Firebase Config.
          </div>
        )}
        <Login onLogin={handleLogin} />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        onLogout={() => setIsAuthenticated(false)}
      />
      
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <Suspense fallback={<LoadingFallback />}>
          {currentView === 'CLIENTS' && (
            <ClientRegistry 
              clients={clients} 
              currentUser={currentUser}
              onAddClient={handleAddClient}
              onUpdateClient={handleUpdateClient}
              onDeleteClient={handleDeleteClient}
              inventory={inventory}
              savedQuotes={savedQuotes}
              onSaveQuote={handleSaveQuote}
              onDeleteQuote={handleDeleteQuote}
              docTemplates={docTemplates}
            />
          )}

          {currentView === 'INVENTORY' && (
            <InventoryList 
              inventory={inventory} 
              currentUser={currentUser}
              onAddItem={openAddForm} 
              onEditItem={openEditForm}
              onDeleteItem={handleDeleteItem}
            />
          )}
          
          {currentView === 'QUOTE_GENERATOR' && (
            <QuoteGenerator 
              clients={clients}
              inventory={inventory} 
              savedQuotes={savedQuotes}
              onSaveQuote={handleSaveQuote}
            />
          )}

          {currentView === 'SETTINGS' && (
            <Settings 
              currentUser={currentUser!}
              users={users}
              onAddUser={handleAddUser}
              onDeleteUser={handleDeleteUser}
              docTemplates={docTemplates}
              onAddTemplate={handleAddTemplate}
              onDeleteTemplate={handleDeleteTemplate}
            />
          )}

          {currentView === 'FILE_MANAGER' && (
            <FileManager 
              documents={companyDocuments}
              onAddDocument={handleAddCompanyDocument}
              onDeleteDocument={handleDeleteCompanyDocument}
              onUpdateDocument={handleUpdateCompanyDocument}
            />
          )}
        </Suspense>
      </main>

      {isFormOpen && (
         <Suspense fallback={null}>
          <InventoryForm 
            initialData={editingItem}
            onSubmit={editingItem ? handleUpdateItem : handleAddItem}
            onCancel={() => setIsFormOpen(false)}
          />
        </Suspense>
      )}
      
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />
    </div>
  );
}
