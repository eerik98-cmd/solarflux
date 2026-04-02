'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Eye, FileText, AlertCircle, Clock, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { InstallerReport } from '@/types';

export default function InstallerMobileReportsPage() {
  const { currentUser } = useAuth();
  const { installerReports, saveInstallerReport, deleteInstallerReport } = useData();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState<InstallerReport | null>(null);
  const [reportType, setReportType] = useState<'daily' | 'incident' | 'time'>('daily');

  const [dailyForm, setDailyForm] = useState({
    workHoursStart: '',
    workHoursEnd: '',
    workCompleted: '',
    materialsUsed: '',
    weather: 'sunny',
    issues: '',
    planForTomorrow: '',
  });

  const [incidentForm, setIncidentForm] = useState({
    type: 'safety',
    severity: 'low',
    description: '',
    location: '',
    solution: '',
    notifyManager: false,
  });

  const [timeForm, setTimeForm] = useState({
    clockIn: '',
    clockOut: '',
    breakDuration: 0,
    travelToSite: 0,
    travelBack: 0,
    jobAssigned: '',
    notes: '',
  });

  const myReports = useMemo(() => {
    if (!currentUser) return [];
    return (installerReports || []).filter(
      r => r.installerId === currentUser.id || r.createdByNickname === currentUser.nickname
    );
  }, [installerReports, currentUser]);

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let day = 1; day <= last.getDate(); day++) days.push(new Date(year, month, day));
    return days;
  }, [currentMonth]);

  const getReportsForDate = (date: Date | null) => {
    if (!date) return [];
    return myReports.filter(r => {
      const reportDate = new Date(r.date);
      return reportDate.toDateString() === date.toDateString();
    });
  };

  const selectedDateReports = useMemo(() => getReportsForDate(selectedDate), [selectedDate, myReports]);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleCreateReport = async () => {
    if (!selectedDate || !currentUser) return;

    let reportData;
    if (reportType === 'daily') {
      reportData = { ...dailyForm };
    } else if (reportType === 'incident') {
      reportData = { ...incidentForm };
    } else {
      reportData = { ...timeForm };
    }

    const newReport: InstallerReport = {
      id: Date.now().toString(),
      installerId: currentUser.id,
      createdByNickname: currentUser.nickname,
      date: selectedDate,
      type: reportType,
      createdAt: new Date(),
      data: reportData,
    };

    await saveInstallerReport(newReport);
    setShowCreateModal(false);

    setDailyForm({
      workHoursStart: '',
      workHoursEnd: '',
      workCompleted: '',
      materialsUsed: '',
      weather: 'sunny',
      issues: '',
      planForTomorrow: '',
    });
    setIncidentForm({
      type: 'safety',
      severity: 'low',
      description: '',
      location: '',
      solution: '',
      notifyManager: false,
    });
    setTimeForm({
      clockIn: '',
      clockOut: '',
      breakDuration: 0,
      travelToSite: 0,
      travelBack: 0,
      jobAssigned: '',
      notes: '',
    });

    alert('Report created!');
  };

  const handleDeleteReport = (reportId: string) => {
    if (confirm('Delete this report?')) {
      deleteInstallerReport(reportId).catch(console.error);
    }
  };

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'daily': return <FileText size={14} className="text-blue-400" />;
      case 'incident': return <AlertCircle size={14} className="text-red-400" />;
      case 'time': return <Clock size={14} className="text-amber-400" />;
      default: return <FileText size={14} />;
    }
  };

  return (
    <div className="min-h-full bg-slate-900 pb-4">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-4 pt-5 pb-3 space-y-3">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <CalendarIcon size={22} className="text-emerald-500" />
          Reports
        </h1>
        <p className="text-slate-400 text-sm">Select a date to view or create reports</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Calendar */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-slate-700 rounded text-slate-400"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-white font-bold text-sm">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-slate-700 rounded text-slate-400"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0.5 px-2 py-2 bg-slate-900/50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-[10px] font-bold text-slate-500 py-1">
                {day[0]}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5 px-2 pb-2 bg-slate-900/50">
            {daysInMonth.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} className="aspect-square" />;

              const isSelected = selectedDate?.toDateString() === date.toDateString();
              const isToday = new Date().toDateString() === date.toDateString();
              const hasReports = getReportsForDate(date).length > 0;

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleDayClick(date)}
                  className={`aspect-square rounded-lg p-1 text-xs font-bold transition-all relative ${
                    isSelected
                      ? 'bg-emerald-500 text-white'
                      : isToday
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                      : 'bg-slate-900/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {date.getDate()}
                  {hasReports && <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Reports */}
        {selectedDate && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-sm">
                {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </h3>
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
              >
                <Plus size={14} />
              </button>
            </div>

            {selectedDateReports.length > 0 ? (
              <div className="space-y-2">
                {selectedDateReports.map(report => (
                  <div key={report.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {getReportIcon(report.type)}
                        <span className="text-xs font-semibold text-white capitalize">{report.type}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setShowViewModal(report)}
                          className="p-1 hover:bg-slate-700 rounded text-emerald-400 text-xs"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          className="p-1 hover:bg-slate-700 rounded text-red-400 text-xs"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {new Date(report.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-500">
                <FileText size={32} className="mx-auto mb-2 text-slate-600" />
                <p className="text-xs">No reports for this day</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="mt-3 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded"
                >
                  Create Report
                </button>
              </div>
            )}
          </div>
        )}

        {!selectedDate && (
          <div className="text-center py-8 text-slate-500">
            <CalendarIcon size={40} className="mx-auto mb-2 text-slate-600" />
            <p className="text-sm">Select a date to view or create reports</p>
          </div>
        )}
      </div>

      {/* Create Report Modal */}
      {showCreateModal && selectedDate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full bg-slate-800 border-t border-slate-700 rounded-t-2xl max-h-[90vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Create Report</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-slate-700 rounded">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {/* Report Type Selector */}
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-400 mb-2 uppercase">Type</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { type: 'daily', icon: FileText, color: 'blue' },
                  { type: 'incident', icon: AlertCircle, color: 'red' },
                  { type: 'time', icon: Clock, color: 'amber' },
                ].map(({ type, icon: Icon, color }) => {
                  const bgColors = { blue: 'bg-blue-500/10 border-blue-500', red: 'bg-red-500/10 border-red-500', amber: 'bg-amber-500/10 border-amber-500' };
                  const textColors = { blue: 'text-blue-400', red: 'text-red-400', amber: 'text-amber-400' };
                  return (
                    <button
                      key={type}
                      onClick={() => setReportType(type as any)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        reportType === type
                          ? `${bgColors[color as keyof typeof bgColors]} border-2 ${bgColors[color as keyof typeof bgColors].split(' ')[1]}`
                          : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                      }`}
                    >
                      <Icon size={18} className={reportType === type ? textColors[color as keyof typeof textColors] : 'text-slate-400'} />
                      <p className={`text-xs font-bold mt-1 capitalize ${reportType === type ? textColors[color as keyof typeof textColors] : 'text-slate-400'}`}>
                        {type}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Forms */}
            <div className="space-y-3 mb-4">
              {reportType === 'daily' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">Start</label>
                      <input type="time" value={dailyForm.workHoursStart} onChange={e => setDailyForm({...dailyForm, workHoursStart: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">End</label>
                      <input type="time" value={dailyForm.workHoursEnd} onChange={e => setDailyForm({...dailyForm, workHoursEnd: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Work Completed</label>
                    <textarea value={dailyForm.workCompleted} onChange={e => setDailyForm({...dailyForm, workCompleted: e.target.value})} rows={2} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Materials Used</label>
                    <textarea value={dailyForm.materialsUsed} onChange={e => setDailyForm({...dailyForm, materialsUsed: e.target.value})} rows={2} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Weather</label>
                    <select value={dailyForm.weather} onChange={e => setDailyForm({...dailyForm, weather: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs">
                      <option value="sunny">Sunny</option>
                      <option value="cloudy">Cloudy</option>
                      <option value="rainy">Rainy</option>
                      <option value="windy">Windy</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Issues</label>
                    <textarea value={dailyForm.issues} onChange={e => setDailyForm({...dailyForm, issues: e.target.value})} rows={2} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Plan for Tomorrow</label>
                    <textarea value={dailyForm.planForTomorrow} onChange={e => setDailyForm({...dailyForm, planForTomorrow: e.target.value})} rows={2} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs resize-none" />
                  </div>
                </>
              )}

              {reportType === 'incident' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">Type</label>
                      <select value={incidentForm.type} onChange={e => setIncidentForm({...incidentForm, type: e.target.value as any})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs">
                        <option value="safety">Safety</option>
                        <option value="equipment">Equipment</option>
                        <option value="weather">Weather</option>
                        <option value="customer">Customer</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">Severity</label>
                      <select value={incidentForm.severity} onChange={e => setIncidentForm({...incidentForm, severity: e.target.value as any})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Description</label>
                    <textarea value={incidentForm.description} onChange={e => setIncidentForm({...incidentForm, description: e.target.value})} rows={3} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Location</label>
                    <input type="text" value={incidentForm.location} onChange={e => setIncidentForm({...incidentForm, location: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Solution</label>
                    <textarea value={incidentForm.solution} onChange={e => setIncidentForm({...incidentForm, solution: e.target.value})} rows={2} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs resize-none" />
                  </div>
                </>
              )}

              {reportType === 'time' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">Clock In</label>
                      <input type="time" value={timeForm.clockIn} onChange={e => setTimeForm({...timeForm, clockIn: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">Clock Out</label>
                      <input type="time" value={timeForm.clockOut} onChange={e => setTimeForm({...timeForm, clockOut: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">Break (min)</label>
                      <input type="number" value={timeForm.breakDuration} onChange={e => setTimeForm({...timeForm, breakDuration: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs text-center" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">Travel To (min)</label>
                      <input type="number" value={timeForm.travelToSite} onChange={e => setTimeForm({...timeForm, travelToSite: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs text-center" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1 block">Travel Back (min)</label>
                      <input type="number" value={timeForm.travelBack} onChange={e => setTimeForm({...timeForm, travelBack: Number(e.target.value)})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs text-center" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Job Assigned</label>
                    <input type="text" value={timeForm.jobAssigned} onChange={e => setTimeForm({...timeForm, jobAssigned: e.target.value})} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Notes</label>
                    <textarea value={timeForm.notes} onChange={e => setTimeForm({...timeForm, notes: e.target.value})} rows={2} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs resize-none" />
                  </div>
                </>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateReport}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Report Modal */}
      {showViewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full bg-slate-800 border-t border-slate-700 rounded-t-2xl max-h-[90vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white capitalize">{showViewModal.type} Report</h3>
              <button onClick={() => setShowViewModal(null)} className="p-1 hover:bg-slate-700 rounded">
                <X size={18} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Created By</p>
                <p className="text-white font-semibold">{showViewModal.createdByNickname}</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Date & Time</p>
                <p className="text-white font-semibold">
                  {new Date(showViewModal.date).toLocaleDateString()} at {new Date(showViewModal.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-2">Report Details</p>
                <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-slate-900 p-2 rounded border border-slate-700 max-h-64 overflow-auto">
                  {JSON.stringify(showViewModal.data, null, 2)}
                </pre>
              </div>
            </div>
            <button
              onClick={() => setShowViewModal(null)}
              className="w-full mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
