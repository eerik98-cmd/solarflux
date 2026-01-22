'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Minus, Upload, X, Save } from 'lucide-react';

interface CashTransaction {
  id: string;
  type: 'ADD' | 'WITHDRAW';
  amount: number;
  description: string;
  imageUrl?: string;
  timestamp: Date;
}

interface CashCounterProps {
  transactions?: CashTransaction[];
  onAddTransaction?: (transaction: CashTransaction) => void;
}

export const CashCounter: React.FC<CashCounterProps> = ({ 
  transactions = [], 
  onAddTransaction 
}) => {
  const [localTransactions, setLocalTransactions] = useState<CashTransaction[]>(transactions);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<'ADD' | 'WITHDRAW'>('ADD');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');

  // Sync transactions from parent
  useEffect(() => {
    if (transactions && transactions.length > 0) {
      setLocalTransactions(transactions);
    }
  }, [transactions]);

  // Calculate balance
  const balance = localTransactions.reduce((acc, trans) => {
    return trans.type === 'ADD' ? acc + trans.amount : acc - trans.amount;
  }, 0);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setImageUrl(url);
      setImagePreview(url);
    };
    reader.readAsDataURL(file);
  };

  const handleAddTransaction = () => {
    // Validate amount
    if (!amount || amount.trim() === '') {
      alert('Please enter an amount');
      return;
    }
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }

    const newTransaction: CashTransaction = {
      id: Date.now().toString(),
      type: transactionType,
      amount: numAmount,
      description: description.trim() || 'No description',
      imageUrl: imageUrl || undefined,
      timestamp: new Date()
    };

    const updatedTransactions = [newTransaction, ...localTransactions];
    setLocalTransactions(updatedTransactions);
    onAddTransaction?.(newTransaction);

    // Reset form
    setAmount('');
    setDescription('');
    setImageUrl('');
    setImagePreview('');
    setIsModalOpen(false);
  };

  const handleDeleteTransaction = (id: string) => {
    setLocalTransactions(localTransactions.filter(t => t.id !== id));
  };

  const openModal = (type: 'ADD' | 'WITHDRAW') => {
    setTransactionType(type);
    setAmount('');
    setDescription('');
    setImageUrl('');
    setImagePreview('');
    setIsModalOpen(true);
  };

  return (
    <div className="w-full h-screen bg-slate-900 overflow-auto">
      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">💰 Cash Counter</h1>
          <p className="text-slate-400">Manage your cash transactions</p>
        </div>

        {/* Balance Display */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-8 mb-8">
          <p className="text-amber-100 text-sm font-bold uppercase mb-2">Current Balance</p>
          <h2 className="text-5xl font-bold text-white mb-1">
            {balance.toFixed(2)} <span className="text-2xl">RON</span>
          </h2>
          <p className="text-amber-100 text-sm">
            {localTransactions.length} transaction{localTransactions.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => openModal('ADD')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-4 rounded-lg flex items-center justify-center gap-3"
          >
            <Plus size={24} />
            Add Found
          </button>
          <button
            onClick={() => openModal('WITHDRAW')}
            className="bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-4 rounded-lg flex items-center justify-center gap-3"
          >
            <Minus size={24} />
            Withdraw
          </button>
        </div>

        {/* Transaction History */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white mb-4">Transaction History</h3>
          {localTransactions.length > 0 ? (
            <div className="space-y-3">
              {localTransactions.map(transaction => (
                <div
                  key={transaction.id}
                  className={`bg-slate-800 rounded-lg p-4 border-l-4 ${
                    transaction.type === 'ADD' ? 'border-l-emerald-500' : 'border-l-red-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-white font-bold">{transaction.description}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(transaction.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <div className="text-right">
                        <p
                          className={`text-2xl font-bold ${
                            transaction.type === 'ADD' ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {transaction.type === 'ADD' ? '+' : '-'}
                          {transaction.amount.toFixed(2)} RON
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {transaction.imageUrl && (
                          <a
                            href={transaction.imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-amber-400 hover:bg-slate-700 rounded transition-colors text-xs"
                            title="View proof"
                          >
                            <Upload size={16} />
                          </a>
                        )}
                        <button
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded transition-colors text-xs"
                          title="Delete"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 border border-slate-700 border-dashed rounded-xl">
              No transactions yet. Add or withdraw cash to get started.
            </div>
          )}
        </div>
      </div>

      {/* Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">
                {transactionType === 'ADD' ? 'Add Found' : 'Withdraw Cash'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Amount */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Amount (RON)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-amber-500"
                  min="0"
                  step="0.01"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Invoice #123, Petty cash, etc."
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  rows={3}
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase block mb-2">Proof Image (optional)</label>
                <label className="flex items-center justify-center gap-2 w-full bg-slate-900 border-2 border-dashed border-slate-600 rounded-lg p-4 cursor-pointer hover:bg-slate-800 hover:border-amber-500/50 transition-all">
                  <Upload size={18} className="text-slate-400" />
                  <span className="text-sm text-slate-400">Upload image or invoice</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Image Preview */}
              {imagePreview && (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-40 object-cover rounded-lg border border-slate-600"
                  />
                  <button
                    onClick={() => {
                      setImageUrl('');
                      setImagePreview('');
                    }}
                    className="absolute -top-3 -right-3 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-slate-700 justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTransaction}
                className={`px-6 py-2.5 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                  transactionType === 'ADD'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                <Save size={16} />
                {transactionType === 'ADD' ? 'Add' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
