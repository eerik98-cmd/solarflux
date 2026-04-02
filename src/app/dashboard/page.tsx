"use client";
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie 
} from 'recharts';
import { TrendingUp, AlertTriangle, DollarSign, Package } from 'lucide-react';
import { useApp } from '../providers';

// TODO
enum Category {
  SolarPanels = 'Solar Panels',
  Inverters = 'Inverters',
  Batteries = 'Batteries',
  MountingSystems = 'Mounting Systems',
  Cables = 'Cables',
  Accessories = 'Accessories',
}

const Dashboard: React.FC = () => {
  const { inventory } = useApp();
  
  const stats = useMemo(() => {
    // Total Value based on Buy Price (Asset Value)
    const totalValue = inventory.reduce((acc, item) => acc + (item.quantity * item.buyPrice), 0);
    const lowStockItems = inventory.filter(item => item.quantity <= item.minThreshold);
    const totalItems = inventory.reduce((acc, item) => acc + item.quantity, 0);
    const categoryCount = Object.keys(Category).length;

    return { totalValue, lowStockItems, totalItems, categoryCount };
  }, [inventory]);

  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    inventory.forEach(item => {
      data[item.category] = (data[item.category] || 0) + item.quantity;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [inventory]);

  const valueData = useMemo(() => {
    return inventory
      .map(item => ({ 
        name: item.name.split(' ').slice(0, 2).join(' '), 
        value: item.quantity * item.buyPrice 
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [inventory]);

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(val);
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Overview</h1>
        <p className="text-slate-400">Welcome back. Here is your solar inventory summary.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <DollarSign className="text-amber-500" size={24} />
            </div>
            <span className="text-xs font-medium text-slate-500 bg-slate-900 px-2 py-1 rounded">Total Asset Value</span>
          </div>
          <h3 className="text-2xl font-bold text-white">{formatCurrency(stats.totalValue)}</h3>
          <p className="text-sm text-slate-400 mt-1">Based on Buy Price</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-red-500/10 rounded-xl">
              <AlertTriangle className="text-red-500" size={24} />
            </div>
            {stats.lowStockItems.length > 0 && (
               <span className="text-xs font-bold text-white bg-red-500 px-2 py-1 rounded animate-pulse">Action Needed</span>
            )}
          </div>
          <h3 className="text-2xl font-bold text-white">{stats.lowStockItems.length} Items</h3>
          <p className="text-sm text-slate-400 mt-1">Below minimum threshold</p>
        </div>

         <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Package className="text-blue-500" size={24} />
            </div>
             <span className="text-xs font-medium text-slate-500 bg-slate-900 px-2 py-1 rounded">Volume</span>
          </div>
          <h3 className="text-2xl font-bold text-white">{stats.totalItems.toLocaleString()}</h3>
          <p className="text-sm text-slate-400 mt-1">Total units in stock</p>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <TrendingUp className="text-emerald-500" size={24} />
            </div>
             <span className="text-xs font-medium text-slate-500 bg-slate-900 px-2 py-1 rounded">Categories</span>
          </div>
          <h3 className="text-2xl font-bold text-white">{stats.categoryCount}</h3>
          <p className="text-sm text-slate-400 mt-1">Active product types</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-6">Stock Distribution by Category</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
             {categoryData.map((entry, index) => (
               <div key={entry.name} className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                 <span className="text-sm text-slate-400">{entry.name}</span>
               </div>
             ))}
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-6">Top Items by Value Held (Buy Price)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valueData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" tickFormatter={(value: number) => `${value/1000}k`} />
                <YAxis dataKey="name" type="category" width={120} stroke="#94a3b8" tick={{fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#334155', opacity: 0.2}}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                  // formatter={(value: number) => [formatCurrency(value), 'Asset Value']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                  {valueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;