'use client';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { QuoteGenerator as QuoteGeneratorComponent } from '@/components/QuoteGenerator';
import { useData } from '@/contexts/DataContext';
import { StorageService } from '@/services/storageService';
import { Quote } from '@/types';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    </div>
  );
}

function QuoteGeneratorWrapper() {
  const { inventory, clients, savedQuotes, docTemplates } = useData();

  const handleSaveQuote = async (quote: Quote) => {
    await StorageService.saveItem('quotes', quote);
  };

  const handleDeleteQuote = async (id: string) => {
    await StorageService.deleteItem('quotes', id);
  };

  return (
    <QuoteGeneratorComponent
      inventory={inventory}
      clients={clients}
      savedQuotes={savedQuotes}
      onSaveQuote={handleSaveQuote}
      onDeleteQuote={handleDeleteQuote}
      docTemplates={docTemplates}
    />
  );
}

export default function QuoteGeneratorPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <QuoteGeneratorWrapper />
    </Suspense>
  );
}
