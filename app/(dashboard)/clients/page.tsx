'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Building2, User, Plus, Trash2, Loader, Bell, MessageSquare, CheckCircle2 } from 'lucide-react';
import { Client, ClientType } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { StorageService } from '@/services/storageService';
import { FileSystem } from '@/services/fileSystemService';

export default function ClientsListPage() {
  const router = useRouter();
  const { clients, savedQuotes } = useData();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ClientType>(ClientType.PRIVATE);
  const [newClientFormData, setNewClientFormData] = useState<Partial<Client>>({ country: 'Romania' });
  const [loadingClientId, setLoadingClientId] = useState<string | null>(null);

  const filteredClients = (clients || []).filter(client => {
    const searchLower = searchTerm.toLowerCase();
    return (
      client.name.toLowerCase().includes(searchLower) ||
      client.email.toLowerCase().includes(searchLower) ||
      (client.internalId && client.internalId.toLowerCase().includes(searchLower)) ||
      (client.companyName && client.companyName.toLowerCase().includes(searchLower))
    );
  });

  const installerFinishNotifications = (() => {
    const declared = (savedQuotes || []).filter((quote) => quote.installerDeclaredFinishedAt);
    const latestByProject = new Map<string, typeof declared[number]>();

    declared.forEach((quote) => {
      const key = `${quote.clientId || 'no-client'}::${(quote.title || '').trim().toLowerCase()}`;
      const existing = latestByProject.get(key);
      if (!existing) {
        latestByProject.set(key, quote);
        return;
      }

      const existingTs = new Date(existing.installerDeclaredFinishedAt as any).getTime();
      const currentTs = new Date(quote.installerDeclaredFinishedAt as any).getTime();
      if (currentTs > existingTs) {
        latestByProject.set(key, quote);
      }
    });

    return Array.from(latestByProject.values())
      .sort((a, b) => new Date(b.installerDeclaredFinishedAt as any).getTime() - new Date(a.installerDeclaredFinishedAt as any).getTime());
  })();

  const installerMentionNotifications = (savedQuotes || [])
    .flatMap((quote) => (quote.installerMentions || []).map((mention) => ({ quote, mention })))
    .sort((a, b) => new Date(b.mention.createdAt as any).getTime() - new Date(a.mention.createdAt as any).getTime());

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ACTIVE': return 'bg-green-500 text-green-50';
      case 'LEAD': return 'bg-amber-500 text-amber-50';
      case 'CLOSED': return 'bg-slate-600 text-slate-200';
      default: return 'bg-slate-700 text-slate-400';
    }
  };

  const generateNextInternalId = (type: ClientType): string => {
    const prefix = "SI_";
    const isCorp = type === ClientType.CORPORATE;
    const min = isCorp ? 2000 : 3000;
    const max = isCorp ? 2999 : 3999;
    const existingIds = clients
      .filter(c => c.type === type && c.internalId && c.internalId.startsWith(prefix))
      .map(c => parseInt(c.internalId!.replace(prefix, ''), 10))
      .filter(n => !isNaN(n) && n >= min && n <= max);
    const nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : min;
    return `${prefix}${nextNum}`;
  };

  const handleSaveNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const displayName = selectedType === ClientType.PRIVATE 
      ? `${newClientFormData.lastName || ''} ${newClientFormData.firstName || ''}`.trim()
      : newClientFormData.companyName || 'Unknown Company';
    
    const addressString = [
      newClientFormData.street, 
      newClientFormData.streetNumber ? `Nr. ${newClientFormData.streetNumber}` : '',
      newClientFormData.city,
      newClientFormData.county,
      newClientFormData.country
    ].filter(Boolean).join(', ');
    
    const newClient: Client = {
      id: Date.now().toString(),
      internalId: generateNextInternalId(selectedType),
      type: selectedType,
      status: 'LEAD',
      name: displayName,
      address: addressString,
      email: newClientFormData.email || '',
      phone: newClientFormData.phone || '',
      needs: {},
      notes: [],
      documents: [],
      ...newClientFormData
    } as Client;
    
    await FileSystem.createClientRepository(newClient);
    await StorageService.saveItem('clients', newClient);
    setIsModalOpen(false);
    setNewClientFormData({ country: 'Romania' });
  };

  const handleDeleteClient = async (id: string) => {
    if (confirm('Are you sure you want to delete this client?')) {
      await StorageService.deleteItem('clients', id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 p-8">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Client Registry</h1>
          <p className="text-slate-400">Manage your customer base</p>
        </div>
        {currentUser?.role !== 'INSTALLER' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20"
          >
            <Plus size={20} /> New Client
          </button>
        )}
      </header>

      {currentUser?.role === 'SUPER_ADMIN' && installerFinishNotifications.length > 0 && (
        <div className="mb-6 bg-slate-800 border border-amber-500/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={18} className="text-amber-400" />
            <h2 className="text-sm font-bold text-amber-300">Installer Finish Notifications</h2>
          </div>
          <div className="space-y-2">
            {installerFinishNotifications.slice(0, 8).map((quote) => {
              const quoteClient = clients.find(c => c.id === quote.clientId);
              const isConfirmed = !!quote.adminApprovedAt || quote.phase === 'completed';
              return (
                <button
                  key={quote.id}
                  onClick={() => router.push(`/clients/${quote.clientId}/installation`)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                    isConfirmed
                      ? 'border-green-500/40 bg-green-500/10 hover:border-green-500/70'
                      : 'border-slate-700 bg-slate-900/70 hover:border-amber-500/50'
                  }`}
                >
                  <p className="text-sm text-white">
                    <span className="font-bold text-amber-300">{quote.installerDeclaredFinishedBy || quote.allocatedInstallerId || 'Installer'}</span>{' '}
                    finished{' '}
                    <span className="font-bold">{quote.title || 'Untitled Project'}</span>{' '}
                    for{' '}
                    <span className="font-bold">{quoteClient?.name || quote.customerName}</span>.
                  </p>
                  {isConfirmed && (
                    <p className="text-xs text-green-300 mt-1 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Successfully installed (admin confirmed)
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    {quote.installerDeclaredFinishedAt ? new Date(quote.installerDeclaredFinishedAt).toLocaleString('ro-RO') : ''}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {currentUser?.role === 'SUPER_ADMIN' && installerMentionNotifications.length > 0 && (
        <div className="mb-6 bg-slate-800 border border-blue-500/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={18} className="text-blue-400" />
            <h2 className="text-sm font-bold text-blue-300">Installer Mentions</h2>
          </div>
          <div className="space-y-2">
            {installerMentionNotifications.slice(0, 8).map(({ quote, mention }) => {
              const quoteClient = clients.find(c => c.id === quote.clientId);
              return (
                <button
                  key={`${quote.id}-${mention.id}`}
                  onClick={() => router.push(`/clients/${quote.clientId}/installation`)}
                  className="w-full text-left rounded-lg border border-slate-700 bg-slate-900/70 hover:border-blue-500/50 px-3 py-2 transition-colors"
                >
                  <p className="text-sm text-white">
                    <span className="font-bold text-blue-300">{mention.createdBy || quote.allocatedInstallerId || 'Installer'}</span>{' '}
                    added a mention for project{' '}
                    <span className="font-bold">{quote.title || 'Untitled Project'}</span>{' '}
                    for{' '}
                    <span className="font-bold">{quoteClient?.name || quote.customerName}</span>.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">{mention.message}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {mention.createdAt ? new Date(mention.createdAt).toLocaleString('ro-RO') : ''}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col flex-1">
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white outline-none"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {filteredClients.map(client => (
            <div
              key={client.id}
              className="bg-slate-900 border border-slate-700 rounded-xl p-4 hover:border-amber-500/50 transition-all cursor-pointer group relative"
              onClick={() => {
                setLoadingClientId(client.id);
                router.push(`/clients/${client.id}`);
              }}
            >
              {loadingClientId === client.id && (
                <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center z-10">
                  <Loader className="text-amber-500 animate-spin" size={32} />
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-3 bg-slate-800 rounded-lg">
                    {client.type === ClientType.CORPORATE ? (
                      <Building2 className="text-amber-500" size={24} />
                    ) : (
                      <User className="text-amber-500" size={24} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-bold text-white">{client.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${getStatusColor(client.status)}`}>
                        {client.status}
                      </span>
                      {client.internalId && (
                        <span className="text-xs text-slate-500 font-mono">{client.internalId}</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-400">
                      {client.email} • {client.phone}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLoadingClientId(client.id);
                      router.push(`/clients/${client.id}`);
                    }}
                    disabled={loadingClientId === client.id}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-2 rounded-lg font-bold disabled:opacity-50"
                  >
                    Open
                  </button>
                  {currentUser?.role === 'SUPER_ADMIN' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClient(client.id);
                      }}
                      className="bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-500 p-2 rounded-lg border border-slate-700"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-6">New Client</h2>
              <form onSubmit={handleSaveNewClient} className="space-y-4">
                <div className="flex gap-4 mb-6">
                  <button
                    type="button"
                    onClick={() => setSelectedType(ClientType.PRIVATE)}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                      selectedType === ClientType.PRIVATE
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <User size={32} className="mx-auto mb-2" />
                    <div className="font-bold">Private Individual</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedType(ClientType.CORPORATE)}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                      selectedType === ClientType.CORPORATE
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <Building2 size={32} className="mx-auto mb-2" />
                    <div className="font-bold">Corporate Client</div>
                  </button>
                </div>

                {selectedType === ClientType.PRIVATE ? (
                  <>
                    <input name="firstName" placeholder="First Name" onChange={(e) => setNewClientFormData({ ...newClientFormData, firstName: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" required />
                    <input name="lastName" placeholder="Last Name" onChange={(e) => setNewClientFormData({ ...newClientFormData, lastName: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" required />
                  </>
                ) : (
                  <>
                    <input name="companyName" placeholder="Company Name" onChange={(e) => setNewClientFormData({ ...newClientFormData, companyName: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" required />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input name="representativeFirstName" placeholder="Representative First Name" onChange={(e) => setNewClientFormData({ ...newClientFormData, representativeFirstName: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" />
                      <input name="representativeLastName" placeholder="Representative Last Name" onChange={(e) => setNewClientFormData({ ...newClientFormData, representativeLastName: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" />
                    </div>
                    <input name="representativeRole" placeholder="Representative Role / Function" onChange={(e) => setNewClientFormData({ ...newClientFormData, representativeRole: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input name="bankName" placeholder="Bank Name" onChange={(e) => setNewClientFormData({ ...newClientFormData, bankName: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" />
                      <input name="iban" placeholder="IBAN" onChange={(e) => setNewClientFormData({ ...newClientFormData, iban: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" />
                    </div>
                  </>
                )}

                <input name="email" type="email" placeholder="Email" onChange={(e) => setNewClientFormData({ ...newClientFormData, email: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" required />
                <input name="phone" placeholder="Phone" onChange={(e) => setNewClientFormData({ ...newClientFormData, phone: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" required />
                <input name="postalCode" placeholder="Postal Code" onChange={(e) => setNewClientFormData({ ...newClientFormData, postalCode: e.target.value })} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" />

                <div className="flex gap-4 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg font-bold">
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-3 rounded-lg font-bold">
                    Create Client
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
