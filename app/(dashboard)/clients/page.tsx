'use client';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ClientRegistry as ClientRegistryComponent } from '@/components/ClientRegistry';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { StorageService } from '@/services/storageService';
import { Client, Quote } from '@/types';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    </div>
  );
}

function ClientRegistryWrapper() {
  const { clients, inventory, savedQuotes, docTemplates } = useData();
  const { currentUser } = useAuth();

  // Don't render until data is loaded
  if (!currentUser) {
    return <LoadingSpinner />;
  }

  const handleAddClient = async (client: Client) => {
    const newClient = { ...client, id: client.id || Date.now().toString() };
    await StorageService.saveItem('clients', newClient);
  };

  const handleUpdateClient = async (client: Client) => {
    await StorageService.saveItem('clients', client);
  };

  const handleDeleteClient = async (id: string) => {
    await StorageService.deleteItem('clients', id);
  };

  const handleSaveQuote = async (quote: Quote) => {
    await StorageService.saveItem('quotes', quote);
  };

  const handleDeleteQuote = async (id: string) => {
    await StorageService.deleteItem('quotes', id);
  };

  return (
    <ClientRegistryComponent
      clients={clients || []}
      currentUser={currentUser}
      onAddClient={handleAddClient}
      onUpdateClient={handleUpdateClient}
      onDeleteClient={handleDeleteClient}
      inventory={inventory || []}
      savedQuotes={savedQuotes || []}
      onSaveQuote={handleSaveQuote}
      onDeleteQuote={handleDeleteQuote}
      docTemplates={docTemplates || []}
    />
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ClientRegistryWrapper />
    </Suspense>
  );
}
