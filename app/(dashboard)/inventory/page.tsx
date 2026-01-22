'use client';

import React, { Suspense, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { InventoryItem } from '@/types';
import { InventoryList as InventoryListComponent } from '@/components/InventoryList';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { StorageService } from '@/services/storageService';

const InventoryForm = React.lazy(() => import('@/components/InventoryForm'));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    </div>
  );
}

function InventoryWrapper() {
  const { inventory } = useData();
  const { currentUser } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    await StorageService.deleteItem('inventory', id);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingItem(null);
  };

  return (
    <div className="h-full">
      <InventoryListComponent
        inventory={inventory}
        currentUser={currentUser || undefined}
        onAddItem={() => setIsFormOpen(true)}
        onEditItem={handleEditItem}
        onDeleteItem={handleDeleteItem}
      />
      {isFormOpen && (
        <Suspense fallback={<LoadingSpinner />}>
          <InventoryForm
            initialData={editingItem}
            onSubmit={async (item) => {
              const itemToSave = editingItem
                ? { ...item, id: editingItem.id }
                : { ...item, id: Date.now().toString() };
              await StorageService.saveItem('inventory', itemToSave);
              handleCloseForm();
            }}
            onCancel={handleCloseForm}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <InventoryWrapper />
    </Suspense>
  );
}
