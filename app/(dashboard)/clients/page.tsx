'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Building2, User, Plus, Trash2, X, ArrowUpDown, ChevronDown, Check } from 'lucide-react';
import { Client, ClientType } from '@/types';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { StorageService } from '@/services/storageService';
import { FileSystem } from '@/services/fileSystemService';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function ClientsListPage() {
  const router = useRouter();
  const { clients, setClients } = useData();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ClientType>(ClientType.PRIVATE);
  const [newClientFormData, setNewClientFormData] = useState<Partial<Client>>({ country: 'Romania' });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Sort / Filter state
  type SortKey = 'name-asc' | 'name-desc' | 'newest' | 'oldest';
  type FilterType = 'ALL' | 'PRIVATE' | 'CORPORATE';
  const [sortKey, setSortKey] = useState<SortKey>('name-asc');
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredClients = useMemo(() => {
    let list = (clients || []).filter(client => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        client.name.toLowerCase().includes(searchLower) ||
        client.email.toLowerCase().includes(searchLower) ||
        (client.internalId && client.internalId.toLowerCase().includes(searchLower)) ||
        (client.companyName && client.companyName.toLowerCase().includes(searchLower));
      const matchesFilter =
        filterType === 'ALL' ||
        (filterType === 'PRIVATE' && client.type === ClientType.PRIVATE) ||
        (filterType === 'CORPORATE' && client.type === ClientType.CORPORATE);
      return matchesSearch && matchesFilter;
    });

    list = [...list].sort((a, b) => {
      if (sortKey === 'name-asc') return a.name.localeCompare(b.name);
      if (sortKey === 'name-desc') return b.name.localeCompare(a.name);
      if (sortKey === 'newest') return (b.id > a.id ? 1 : -1);
      if (sortKey === 'oldest') return (a.id > b.id ? 1 : -1);
      return 0;
    });

    return list;
  }, [clients, searchTerm, sortKey, filterType]);

  const allSelected = filteredClients.length > 0 && filteredClients.every(c => selectedIds.has(c.id));
  const someSelected = filteredClients.some(c => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClients.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    for (const id of Array.from(selectedIds)) {
      await StorageService.deleteItem('clients', id);
    }
    setClients((clients || []).filter(c => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    setConfirmDeleteOpen(false);
  };

  const generateNextInternalId = (type: ClientType): string => {
    const prefix = "SI_";
    const isCorp = type === ClientType.CORPORATE;
    const min = isCorp ? 2000 : 3000;
    const max = isCorp ? 2999 : 3999;
    const existingIds = (clients || [])
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

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden flex flex-col flex-1">
        {/* Search bar + Sort/Filter */}
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-400 outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Sort / Filter dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border font-medium text-sm transition-colors ${
                  dropdownOpen || sortKey !== 'name-asc' || filterType !== 'ALL'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                    : 'bg-slate-900 border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white'
                }`}
              >
                <ArrowUpDown size={15} />
                Sort / Filter
                <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl shadow-black/50 z-40 overflow-hidden">
                  {/* Sort section */}
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sort</p>
                  </div>
                  {([
                    { key: 'name-asc', label: 'Name A → Z' },
                    { key: 'name-desc', label: 'Name Z → A' },
                    { key: 'newest', label: 'Newest first' },
                    { key: 'oldest', label: 'Oldest first' },
                  ] as { key: typeof sortKey; label: string }[]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setSortKey(opt.key)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                        sortKey === opt.key
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {opt.label}
                      {sortKey === opt.key && <Check size={14} />}
                    </button>
                  ))}

                  <div className="border-t border-slate-700 mx-3 my-2" />

                  {/* Filter section */}
                  <div className="px-3 pb-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Filter by type</p>
                  </div>
                  {([
                    { key: 'ALL', label: 'All clients' },
                    { key: 'PRIVATE', label: 'Private' },
                    { key: 'CORPORATE', label: 'Corporate' },
                  ] as { key: typeof filterType; label: string }[]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setFilterType(opt.key)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                        filterType === opt.key
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {opt.label}
                      {filterType === opt.key && <Check size={14} />}
                    </button>
                  ))}
                  <div className="pb-2" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-600 bg-slate-900 text-slate-300 uppercase text-xs tracking-wider">
                <th className="w-10 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-amber-500 cursor-pointer accent-amber-500"
                  />
                </th>
                <th className="px-4 py-3 text-left font-bold">Internal ID</th>
                <th className="px-4 py-3 text-left font-bold">Name</th>
                <th className="px-4 py-3 text-left font-bold">Type</th>
                <th className="px-4 py-3 text-left font-bold">Tel</th>
                <th className="px-4 py-3 text-left font-bold">Mail</th>
                <th className="px-4 py-3 text-left font-bold">City</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    No clients found.
                  </td>
                </tr>
              ) : (
                filteredClients.map(client => {
                  const isSelected = selectedIds.has(client.id);
                  return (
                    <tr
                      key={client.id}
                      onClick={() => router.push(`/clients/${client.id}`)}
                      className={`border-b border-slate-700 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-500/10 hover:bg-amber-500/15'
                          : 'hover:bg-slate-700/60'
                      }`}
                    >
                      <td className="px-4 py-3 text-center" onClick={(e) => toggleSelect(client.id, e)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-slate-500 bg-slate-700 cursor-pointer accent-amber-500"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-amber-400/80 text-xs">
                        {client.internalId || '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">
                        {client.name}
                      </td>
                      <td className="px-4 py-3">
                        {client.type === ClientType.CORPORATE ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-blue-300">
                            <Building2 size={14} /> Corp
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm text-slate-200">
                            <User size={14} /> Private
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-100">
                        {client.phone || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-100">
                        {client.email || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-100">
                        {client.city || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating selection bubble */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-800 border border-slate-600 shadow-2xl shadow-black/40 rounded-2xl px-5 py-3">
          <span className="text-white font-semibold text-sm">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-5 bg-slate-600" />
          {currentUser?.role === 'SUPER_ADMIN' && (
            <button
              onClick={() => setConfirmDeleteOpen(true)}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors font-semibold text-sm"
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-slate-400 hover:text-white transition-colors ml-1"
            aria-label="Clear selection"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Delete Clients"
        message={`Are you sure you want to permanently delete ${selectedIds.size} client${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleBulkDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

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
