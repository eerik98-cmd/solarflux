'use client';

import React, { Suspense } from 'react';
import { Settings as SettingsComponent } from '@/components/Settings';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { StorageService } from '@/services/storageService';
import { User, DocTemplate } from '@/types';
import Loading from '@/components/Loading';

function SettingsWrapper() {
  const { users, docTemplates } = useData();
  const { currentUser } = useAuth();

  const handleAddUser = async (user: User) => {
    const newUser = { ...user, id: user.id || Date.now().toString() };
    await StorageService.saveItem('users', newUser);
  };

  const handleDeleteUser = async (id: string) => {
    await StorageService.deleteItem('users', id);
  };

  const handleAddTemplate = async (template: DocTemplate) => {
    const newTemplate = { ...template, id: template.id || Date.now().toString() };
    await StorageService.saveItem('templates', newTemplate);
  };

  const handleDeleteTemplate = async (id: string) => {
    await StorageService.deleteItem('templates', id);
  };

  if (!currentUser) {
    return <Loading />;
  }

  return (
    <SettingsComponent
      currentUser={currentUser}
      users={users}
      onAddUser={handleAddUser}
      onDeleteUser={handleDeleteUser}
      docTemplates={docTemplates}
      onAddTemplate={handleAddTemplate}
      onDeleteTemplate={handleDeleteTemplate}
    />
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SettingsWrapper />
    </Suspense>
  );
}
