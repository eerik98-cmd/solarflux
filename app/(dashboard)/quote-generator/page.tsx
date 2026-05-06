'use client';

import React, { Suspense } from 'react';
import { QuoteGenerator as QuoteGeneratorComponent } from '@/components/QuoteGenerator';
import { useData } from '@/contexts/DataContext';
import { StorageService } from '@/services/storageService';
import { Quote } from '@/types';
import Loading from '@/components/Loading';

function QuoteGeneratorWrapper() {
  const { inventory, clients, savedQuotes, docTemplates, companyDocuments } = useData();

  const handleSaveQuote = async (quote: Quote) => {
    await StorageService.saveItem('quotes', quote);
  };

  const handleDeleteQuote = async (id: string) => {
    await StorageService.deleteItem('quotes', id);
  };

  const handleSaveDocument = async (doc: { id: string; name: string; url: string; date: Date; description?: string }) => {
    await StorageService.saveItem('companyDocuments', doc);
  };

  const handleDeleteDocument = async (id: string) => {
    await StorageService.deleteItem('companyDocuments', id);
  };

  const handleUpdateQuoteDocuments = async (quoteId: string, doc: { id: string; name: string; url: string; date: Date; generatedBy?: string }) => {
    const existing = savedQuotes.find(q => q.id === quoteId);
    if (!existing) return;
    const updatedQuote: Quote = {
      ...existing,
      generatedDocuments: [...(existing.generatedDocuments || []), doc]
    };
    await StorageService.saveItem('quotes', updatedQuote);
  };

  return (
    <QuoteGeneratorComponent
      inventory={inventory}
      clients={clients}
      savedQuotes={savedQuotes}
      onSaveQuote={handleSaveQuote}
      onDeleteQuote={handleDeleteQuote}
      docTemplates={docTemplates}
      companyDocuments={companyDocuments as any}
      onSaveDocument={handleSaveDocument}
      onDeleteDocument={handleDeleteDocument}
      onUpdateQuoteDocuments={handleUpdateQuoteDocuments}
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
