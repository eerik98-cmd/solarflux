'use client';

import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { FileManager as FileManagerComponent } from '@/components/FileManager';
import { useData } from '@/contexts/DataContext';
import { StorageService } from '@/services/storageService';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    </div>
  );
}

function FileManagerWrapper() {
  const { companyDocuments } = useData();

  const handleAddDocument = async (document: any) => {
    const newDoc = { ...document, id: document.id || Date.now().toString() };
    await StorageService.saveItem('companyDocuments', newDoc);
  };

  const handleDeleteDocument = async (id: string) => {
    await StorageService.deleteItem('companyDocuments', id);
  };

  const handleUpdateDocument = async (id: string, updates: any) => {
    const doc = companyDocuments.find((d: any) => d.id === id);
    if (doc) {
      await StorageService.saveItem('companyDocuments', { ...doc, ...updates });
    }
  };

  return (
    <FileManagerComponent
      documents={companyDocuments as any[]}
      onAddDocument={handleAddDocument}
      onDeleteDocument={handleDeleteDocument}
      onUpdateDocument={handleUpdateDocument}
    />
  );
}

export default function FileManagerPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <FileManagerWrapper />
    </Suspense>
  );
}
