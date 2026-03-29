'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { InstallerReport } from '@/types';
import { AlertCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Eye, FileText, Clock, ArrowLeft, X } from 'lucide-react';

export default function InstallerReportsAdminPage() {
  const params = useParams();
  const installerId = params?.id as string;
  const { currentUser } = useAuth();
  const { users, installerReports } = useData();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showViewModal, setShowViewModal] = useState<InstallerReport | null>(null);

  const installer = useMemo(() => {
    return (users || []).find((u) => u.id === installerId && u.role === 'INSTALLER');
  }, [users, installerId]);

  const reportsForInstaller = useMemo(() => {
    if (!installer) return [];
    return (installerReports || []).filter(
      (report) => report.installerId === installer.id || report.createdByNickname === installer.nickname
    );
  }, [installerReports, installer]);

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: Array<Date | null> = [];
    for (let i = 0; i < startDayOfWeek; i += 1) {
      days.push(null);
    }
    for (let day = 1; day <= totalDays; day += 1) {
      days.push(new Date(year, month, day));
    }
    return days;
  }, [currentMonth]);

  const getReportsForDate = (date: Date | null) => {
    if (!date) return [];
    return reportsForInstaller.filter((report) => {
      const reportDate = new Date(report.date);
      return reportDate.toDateString() === date.toDateString();
    });
  };

  const selectedDateReports = useMemo(() => getReportsForDate(selectedDate), [selectedDate, reportsForInstaller]);

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'daily':
        return <FileText size={16} className="text-blue-400" />;
      case 'incident':
        return <AlertCircle size={16} className="text-red-400" />;
      case 'time':
        return <Clock size={16} className="text-amber-400" />;
      default:
        return <FileText size={16} className="text-slate-400" />;
    }
  };

  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <p className="text-white font-bold">Access Denied</p>
          <p className="text-slate-400">Only super admins can view this page</p>
        </div>
      </div>
    );
  }

  if (!installer) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <p className="text-white font-bold">Installer Not Found</p>
          <Link href="/installers">
            <button className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors">
              Back to Manage Team
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href={`/installers/${installer.id}`}>
              <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
                <ArrowLeft size={22} />
              </button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-1">
                <CalendarIcon size={30} className="text-blue-500" />
                Reports: {installer.nickname}
              </h1>
              <p className="text-slate-400">Calendar and day reports submitted by this installer</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl font-bold text-white">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-xs font-bold text-slate-500 py-2">
                    {day}
                  </div>
                ))}
                {daysInMonth.map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} className="aspect-square" />;
                  }

                  const isSelected = selectedDate?.toDateString() === date.toDateString();
                  const hasReports = getReportsForDate(date).length > 0;

                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => setSelectedDate(date)}
                      className={`aspect-square rounded-lg p-2 text-sm font-semibold transition-all relative ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-900/50 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {date.getDate()}
                      {hasReports && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                {selectedDate
                  ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Select a date'}
              </h3>

              {selectedDate ? (
                selectedDateReports.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDateReports.map((report) => (
                      <div key={report.id} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getReportIcon(report.type)}
                            <span className="text-sm font-semibold text-white capitalize">{report.type}</span>
                          </div>
                          <button
                            onClick={() => setShowViewModal(report)}
                            className="p-1 hover:bg-slate-700 rounded transition-colors text-emerald-400"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                        <p className="text-xs text-slate-400">
                          Created by {report.createdByNickname} at {new Date(report.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <FileText size={42} className="mx-auto mb-2 text-slate-600" />
                    <p className="text-sm">No reports for this day</p>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <CalendarIcon size={42} className="mx-auto mb-2 text-slate-600" />
                  <p className="text-sm">Select a date to view reports</p>
                </div>
              )}
            </div>

          </div>
        </div>

        {showViewModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white capitalize">{showViewModal.type} Report</h3>
                <button
                  onClick={() => setShowViewModal(null)}
                  className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">Created By</p>
                  <p className="text-white font-semibold">{showViewModal.createdByNickname}</p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">Date & Time</p>
                  <p className="text-white font-semibold">
                    {new Date(showViewModal.date).toLocaleDateString('en-US')} at {new Date(showViewModal.createdAt).toLocaleTimeString('en-US')}
                  </p>
                </div>
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-3">Report Details</p>
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap">
                    {JSON.stringify(showViewModal.data, null, 2)}
                  </pre>
                </div>
              </div>

              <button
                onClick={() => setShowViewModal(null)}
                className="w-full mt-6 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
