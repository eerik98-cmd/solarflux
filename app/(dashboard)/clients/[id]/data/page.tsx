'use client';

import React, { useState, useEffect } from 'react';
import { Save, User, Building2, Mail, Phone, MapPin, Hash, Briefcase, Info } from 'lucide-react';
import { useClient } from '@/contexts/ClientContext';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { ClientType } from '@/types';

export default function ClientDataPage() {
  const { client, updateClient, saveClient, hasChanges } = useClient();
  const { currentUser } = useAuth();
  const { clients } = useData();
  const [formData, setFormData] = useState(client);

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

  useEffect(() => {
    if (client) {
      // Auto-generate internal ID if missing
      if (!client.internalId && client.type) {
        const newId = generateNextInternalId(client.type);
        const updatedClient = { ...client, internalId: newId };
        setFormData(updatedClient);
        updateClient({ internalId: newId });
      } else {
        setFormData(client);
      }
    }
  }, [client?.id]);

  if (!client || !formData) {
    return <div className="p-8 text-slate-400">Loading...</div>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    updateClient(formData);
    await saveClient();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Client Information</h2>
        {hasChanges && (
          <button
            onClick={handleSave}
            className="bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center gap-2"
          >
            <Save size={18} />
            Save Changes
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Type & Status */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Info size={20} className="text-amber-500" />
            Client Type & Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Client Type</label>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-600 rounded-lg p-3 text-white">
                {formData.type === ClientType.CORPORATE ? <Building2 size={20} /> : <User size={20} />}
                <span>{formData.type === ClientType.CORPORATE ? 'Corporate' : 'Private Individual'}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
              >
                <option value="LEAD">Lead</option>
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Internal ID */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Hash size={20} className="text-amber-500" />
            Internal ID
          </h3>
          <input
            name="internalId"
            value={formData.internalId || ''}
            onChange={handleChange}
            disabled={currentUser?.role !== 'SUPER_ADMIN'}
            className={`w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-mono ${
              currentUser?.role !== 'SUPER_ADMIN' ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            placeholder="Auto-generated"
          />
          {currentUser?.role !== 'SUPER_ADMIN' && (
            <span className="text-xs text-slate-500 mt-1 block">
              Only Super Admins can manually edit the Internal ID.
            </span>
          )}
        </div>

        {/* Personal/Company Information */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            {formData.type === ClientType.CORPORATE ? <Building2 size={20} className="text-amber-500" /> : <User size={20} className="text-amber-500" />}
            {formData.type === ClientType.CORPORATE ? 'Company Information' : 'Personal Information'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.type === ClientType.PRIVATE ? (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">First Name</label>
                  <input
                    name="firstName"
                    value={formData.firstName || ''}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">Last Name</label>
                  <input
                    name="lastName"
                    value={formData.lastName || ''}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">CNP (Personal ID)</label>
                  <input
                    name="cnp"
                    value={formData.cnp || ''}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-400 mb-2">Company Name</label>
                  <input
                    name="companyName"
                    value={formData.companyName || ''}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">CUI (Tax ID)</label>
                  <input
                    name="taxId"
                    value={formData.taxId || ''}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">Registration Number (J)</label>
                  <input
                    name="regNumber"
                    value={formData.regNumber || ''}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-400 mb-2">Bank Account (IBAN)</label>
                  <input
                    name="iban"
                    value={formData.iban || ''}
                    onChange={handleChange}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Mail size={20} className="text-amber-500" />
            Contact Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Email</label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Phone</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <MapPin size={20} className="text-amber-500" />
            Address
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Street</label>
              <input
                name="street"
                value={formData.street || ''}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">Street Number</label>
              <input
                name="streetNumber"
                value={formData.streetNumber || ''}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">City</label>
              <input
                name="city"
                value={formData.city || ''}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2">County</label>
              <input
                name="county"
                value={formData.county || ''}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-400 mb-2">Country</label>
              <input
                name="country"
                value={formData.country || 'Romania'}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
