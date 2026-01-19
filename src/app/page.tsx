import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

// Mock data - replace with actual API calls
const mockCustomers = [
  { id: 1, name: 'John Smith', email: 'john@email.com', project: 'Residential 5kW', status: 'Active', installDate: '2024-01-15' },
  { id: 2, name: 'Sarah Johnson', email: 'sarah@email.com', project: 'Commercial 20kW', status: 'Pending', installDate: '2024-02-01' },
  { id: 3, name: 'Mike Davis', email: 'mike@email.com', project: 'Residential 8kW', status: 'Completed', installDate: '2023-12-10' },
  { id: 4, name: 'Lisa Chen', email: 'lisa@email.com', project: 'Residential 6kW', status: 'Active', installDate: '2024-01-20' }
];

const mockInventory = [
  { id: 1, item: 'Solar Panels - 400W', quantity: 150, minStock: 50, supplier: 'SunPower', lastUpdated: '2024-01-10' },
  { id: 2, item: 'Inverters - 5kW', quantity: 25, minStock: 10, supplier: 'Enphase', lastUpdated: '2024-01-08' },
  { id: 3, item: 'Mounting Rails', quantity: 200, minStock: 100, supplier: 'IronRidge', lastUpdated: '2024-01-09' },
  { id: 4, item: 'DC Optimizers', quantity: 80, minStock: 30, supplier: 'SolarEdge', lastUpdated: '2024-01-07' },
  { id: 5, item: 'Monitoring Systems', quantity: 15, minStock: 20, supplier: 'Enphase', lastUpdated: '2024-01-06' }
];

export default function Home() {
  const [customers, setCustomers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API loading
    setTimeout(() => {
      setCustomers(mockCustomers);
      setInventory(mockInventory);
      setLoading(false);
    }, 1000);
  }, []);

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStockStatus = (current, min) => {
    if (current <= min) return 'bg-red-100 text-red-800';
    if (current <= min * 1.5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const totalActiveProjects = customers.filter(c => c.status === 'Active').length;
  const totalPendingProjects = customers.filter(c => c.status === 'Pending').length;
  const lowStockItems = inventory.filter(item => item.quantity <= item.minStock).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>SolarTech Pro - Dashboard</title>
        <meta name="description" content="Solar Panel Installation Company Dashboard" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <h1 className="text-2xl font-bold text-gray-900">⚡ SolarTech Pro</h1>
                </div>
              </div>
              <nav className="flex space-x-8">
                <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">Dashboard</Link>
                <Link href="/customers" className="text-gray-500 hover:text-gray-700">Customers</Link>
                <Link href="/projects" className="text-gray-500 hover:text-gray-700">Projects</Link>
                <Link href="/inventory" className="text-gray-500 hover:text-gray-700">Inventory</Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">👥</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Customers</p>
                  <p className="text-2xl font-semibold text-gray-900">{customers.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">🔧</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Active Projects</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalActiveProjects}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">⏳</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Pending Projects</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalPendingProjects}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-sm font-bold">⚠️</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
                  <p className="text-2xl font-semibold text-gray-900">{lowStockItems}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Customers */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Customers</h2>
                  <Link href="/customers" className="text-sm text-blue-600 hover:text-blue-800">View all</Link>
                </div>
              </div>
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customers.slice(0, 5).map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                            <div className="text-sm text-gray-500">{customer.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{customer.project}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(customer.status)}`}>
                            {customer.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inventory Stock Levels */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Inventory Stock Levels</h2>
                  <Link href="/inventory" className="text-sm text-blue-600 hover:text-blue-800">View all</Link>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {inventory.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">{item.item}</h3>
                        <p className="text-sm text-gray-500">Supplier: {item.supplier}</p>
                      </div>
                      <div className="text-right">
                        <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStockStatus(item.quantity, item.minStock)}`}>
                          {item.quantity} units
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Min: {item.minStock}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}