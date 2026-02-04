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
    try {
      const response = await fetch('/api/admin/manage-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-user',
          user: { ...user, id: user.id || Date.now().toString() },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add user');
      }

      alert('User created successfully!');
    } catch (error) {
      console.error('Error adding user:', error);
      alert(`Error creating user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await StorageService.deleteItem('users', id);
      alert('User deleted successfully!');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user. Please try again.');
    }
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
