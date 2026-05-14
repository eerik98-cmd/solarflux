'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '@/contexts/DataContext';
import { StorageService } from '@/services/storageService';
import { InventoryItem, QuoteLineItem, QuoteTemplate } from '@/types';
import { ArrowLeft, Plus, Package, Save, Trash2, X } from 'lucide-react';

type TemplateItem = QuoteLineItem;

const createTemplateItem = (): TemplateItem => ({
  id: crypto.randomUUID(),
  description: '',
  itemDescription: '',
  unit: 'pcs',
  quantity: 1,
  netPrice: 0,
});

export default function QuoteTemplatesPage() {
  const router = useRouter();
  const { inventory, quoteTemplates, setQuoteTemplates } = useData();

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [name, setName] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([]);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => quoteTemplates.find((template) => template.id === selectedTemplateId) || null,
    [quoteTemplates, selectedTemplateId]
  );

  const filteredInventory = useMemo(() => {
    if (!focusedItemId) return [];
    const focusedItem = items.find((item) => item.id === focusedItemId);
    const search = (focusedItem?.description || '').trim().toLowerCase();
    if (!search) return [];
    return inventory.filter((item) => item.name.toLowerCase().includes(search) || item.sku.toLowerCase().includes(search)).slice(0, 5);
  }, [focusedItemId, items, inventory]);

  const startNewTemplate = () => {
    setSelectedTemplateId('');
    setName('');
    setItems([]);
    setFocusedItemId(null);
  };

  const loadTemplate = (template: QuoteTemplate) => {
    setSelectedTemplateId(template.id);
    setName(template.name);
    setItems(template.items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      selectedSerialNumbers: item.selectedSerialNumbers ? [...item.selectedSerialNumbers] : [],
    })));
    setFocusedItemId(null);
  };

  const addItem = () => setItems((prev) => [...prev, createTemplateItem()]);

  const updateItem = (id: string, field: keyof TemplateItem, value: string | number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const removeItem = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));

  const selectInventoryItem = (itemId: string, inventoryItem: InventoryItem) => {
    setItems((prev) => prev.map((item) => (
      item.id === itemId
        ? {
            ...item,
            inventoryItemId: inventoryItem.id,
            description: inventoryItem.name,
            unit: 'pcs',
            netPrice: inventoryItem.sellPrice,
          }
        : item
    )));
    setFocusedItemId(null);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Please enter a template name');
      return;
    }
    if (items.length === 0) {
      alert('Please add at least one item');
      return;
    }

    const now = new Date();
    const template: QuoteTemplate = {
      id: selectedTemplateId || crypto.randomUUID(),
      name: trimmedName,
      items: items.map((item) => ({
        ...item,
        selectedSerialNumbers: item.selectedSerialNumbers ? [...item.selectedSerialNumbers] : [],
      })),
      createdAt: selectedTemplate?.createdAt ?? now,
      updatedAt: now,
    };

    await StorageService.saveItem('quoteTemplates', template);
    setQuoteTemplates((prev) => {
      const index = prev.findIndex((item) => item.id === template.id);
      if (index >= 0) {
        const next = [...prev];
        next[index] = template;
        return next;
      }
      return [...prev, template];
    });
    setSelectedTemplateId(template.id);
  };

  const handleDelete = async () => {
    if (!selectedTemplateId) return;
    await StorageService.deleteItem('quoteTemplates', selectedTemplateId);
    setQuoteTemplates((prev) => prev.filter((item) => item.id !== selectedTemplateId));
    startNewTemplate();
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-900 p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/dashboard/quote-generator')}
            className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} /> Back to quotes
          </button>
          <h1 className="text-3xl font-bold text-white">Quote templates</h1>
          <p className="mt-2 text-slate-400">Save reusable item presets and load them into any quote.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startNewTemplate}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:bg-slate-700"
          >
            New template
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-amber-400"
          >
            <Save size={16} /> Save template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 lg:col-span-3">
          <div className="rounded-2xl border border-slate-700 bg-slate-800">
            <div className="border-b border-slate-700 px-5 py-4 text-sm font-semibold text-slate-300">Saved templates</div>
            <div className="max-h-[70vh] overflow-y-auto p-3">
              {quoteTemplates.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-slate-500">No templates yet.</p>
              ) : (
                quoteTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => loadTemplate(template)}
                    className={`mb-2 w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      template.id === selectedTemplateId
                        ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                        : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500'
                    }`}
                  >
                    <div className="font-semibold">{template.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{template.items.length} items</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        <section className="col-span-12 space-y-5 lg:col-span-9">
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Template name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 5 kW rooftop starter pack"
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-amber-500"
            />
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-800">
            <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Package size={14} className="text-slate-400" /> Items
              </div>
              <button
                onClick={addItem}
                className="flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-amber-400"
              >
                <Plus size={14} /> Add item
              </button>
            </div>
            <div className="overflow-x-auto">
              {items.length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">Add a few items to make this preset reusable.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/60">
                      <th className="text-left px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Name</th>
                      <th className="text-center px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Qty</th>
                      <th className="text-center px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Unit</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Net Price</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {items.map((item) => {
                      const suggestions = focusedItemId === item.id ? filteredInventory : [];
                      return (
                        <tr key={item.id} className="hover:bg-slate-700/20 transition-colors">
                          <td className="px-5 py-3">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                onFocus={() => setFocusedItemId(item.id)}
                                onBlur={() => setTimeout(() => setFocusedItemId(null), 200)}
                                placeholder="Name or search inventory..."
                                className="w-full rounded-md border-b border-transparent bg-transparent px-0 py-1 text-sm text-white outline-none transition-colors placeholder:text-slate-600 hover:border-slate-600 focus:border-amber-500"
                              />
                              <input
                                type="text"
                                value={item.itemDescription ?? ''}
                                onChange={(e) => updateItem(item.id, 'itemDescription', e.target.value)}
                                placeholder="Description (optional)..."
                                className="mt-0.5 w-full rounded-md border-b border-transparent bg-transparent px-0 py-0.5 text-xs text-slate-400 outline-none transition-colors placeholder:text-slate-700 hover:border-slate-700 focus:border-slate-500"
                              />
                              {suggestions.length > 0 && (
                                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-slate-600 bg-slate-800 shadow-xl">
                                  {suggestions.map((suggestion) => (
                                    <button
                                      key={suggestion.id}
                                      onMouseDown={() => selectInventoryItem(item.id, suggestion)}
                                      className="flex w-full items-center justify-between border-b border-slate-700/40 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-700"
                                    >
                                      <div>
                                        <div className="font-medium text-white">{suggestion.name}</div>
                                        <div className="text-xs text-slate-400">{suggestion.sku}</div>
                                      </div>
                                      <span className="ml-3 flex-shrink-0 text-xs font-bold text-emerald-400">{suggestion.sellPrice}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                              className="w-full rounded-md border-b border-transparent bg-transparent px-0 py-1 text-center text-sm text-white outline-none transition-colors hover:border-slate-600 focus:border-amber-500"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                              className="w-full rounded-md border-b border-transparent bg-transparent px-0 py-1 text-center text-sm text-slate-300 outline-none transition-colors hover:border-slate-600 focus:border-amber-500"
                            />
                          </td>
                          <td className="px-5 py-3">
                            <input
                              type="number"
                              min="0"
                              value={item.netPrice}
                              onChange={(e) => updateItem(item.id, 'netPrice', Number(e.target.value))}
                              className="w-full rounded-md border-b border-transparent bg-transparent px-0 py-1 text-right text-sm text-white outline-none transition-colors hover:border-slate-600 focus:border-amber-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-slate-600 transition-colors hover:text-red-400"
                            >
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-slate-200">Use this template in quotes</div>
              <div className="text-sm text-slate-500">Loading a template copies the item list only.</div>
            </div>
            <button
              onClick={handleDelete}
              disabled={!selectedTemplateId}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-bold text-red-400 transition-colors hover:border-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={16} /> Delete template
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}