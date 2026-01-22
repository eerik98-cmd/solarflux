'use client';

import React, { Suspense } from 'react';
import { FileManager as FileManagerComponent } from '@/components/FileManager';
import { useData } from '@/contexts/DataContext';
import { StorageService } from '@/services/storageService';
import Loading from '@/components/Loading';

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
    <Suspense fallback={<Loading />}>
      <FileManagerWrapper />
    </Suspense>
  );
}
