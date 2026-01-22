'use client';

import React, { Suspense } from 'react';
import { QuoteGenerator as QuoteGeneratorComponent } from '@/components/QuoteGenerator';
import { useData } from '@/contexts/DataContext';
import { StorageService } from '@/services/storageService';
import { Quote } from '@/types';
import Loading from '@/components/Loading';

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
    <Suspense fallback={<Loading />}>
      <QuoteGeneratorWrapper />
    </Suspense>
  );
}
