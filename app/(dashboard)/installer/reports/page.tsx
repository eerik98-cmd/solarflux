'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Eye, FileText, AlertCircle, Clock, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { InstallerReport } from '@/types';

export default function InstallerReportsPage() {
  const { currentUser } = useAuth();
  const { installerReports, saveInstallerReport, deleteInstallerReport } = useData();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState<InstallerReport | null>(null);
  const [reportType, setReportType] = useState<'daily' | 'incident' | 'time'>('daily');

  // Form states
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
      (report) => report.installerId === currentUser.id || report.createdByNickname === currentUser.nickname
    );
  }, [installerReports, currentUser]);

  // Calendar logic
  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
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
    
    // Reset forms
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

    alert('Report created successfully!');
  };

  const handleDeleteReport = (reportId: string) => {
    if (confirm('Are you sure you want to delete this report?')) {
      deleteInstallerReport(reportId).catch((error) => {
        console.error('Failed to delete report:', error);
      });
    }
  };

  const renderDailyForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Work Hours Start</label>
          <input
            type="time"
            value={dailyForm.workHoursStart}
            onChange={(e) => setDailyForm({ ...dailyForm, workHoursStart: e.target.value })}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Work Hours End</label>
          <input
            type="time"
            value={dailyForm.workHoursEnd}
            onChange={(e) => setDailyForm({ ...dailyForm, workHoursEnd: e.target.value })}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Work Completed</label>
        <textarea
          value={dailyForm.workCompleted}
          onChange={(e) => setDailyForm({ ...dailyForm, workCompleted: e.target.value })}
          rows={3}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
          placeholder="Describe the work completed today..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Materials Used</label>
        <textarea
          value={dailyForm.materialsUsed}
          onChange={(e) => setDailyForm({ ...dailyForm, materialsUsed: e.target.value })}
          rows={2}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
          placeholder="List materials used..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Weather Conditions</label>
        <select
          value={dailyForm.weather}
          onChange={(e) => setDailyForm({ ...dailyForm, weather: e.target.value })}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
        >
          <option value="sunny">Sunny</option>
          <option value="cloudy">Cloudy</option>
          <option value="rainy">Rainy</option>
          <option value="windy">Windy</option>
          <option value="mixed">Mixed</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Issues/Obstacles</label>
        <textarea
          value={dailyForm.issues}
          onChange={(e) => setDailyForm({ ...dailyForm, issues: e.target.value })}
          rows={2}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
          placeholder="Any issues encountered..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Plan for Next Day</label>
        <textarea
          value={dailyForm.planForTomorrow}
          onChange={(e) => setDailyForm({ ...dailyForm, planForTomorrow: e.target.value })}
          rows={2}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
          placeholder="Tomorrow's plan..."
        />
      </div>
    </div>
  );

  const renderIncidentForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Incident Type</label>
          <select
            value={incidentForm.type}
            onChange={(e) => setIncidentForm({ ...incidentForm, type: e.target.value as any })}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 outline-none"
          >
            <option value="safety">Safety</option>
            <option value="equipment">Equipment</option>
            <option value="weather">Weather</option>
            <option value="customer">Customer</option>
            <option value="technical">Technical</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Severity</label>
          <select
            value={incidentForm.severity}
            onChange={(e) => setIncidentForm({ ...incidentForm, severity: e.target.value as any })}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 outline-none"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Description</label>
        <textarea
          value={incidentForm.description}
          onChange={(e) => setIncidentForm({ ...incidentForm, description: e.target.value })}
          rows={4}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 outline-none"
          placeholder="Describe the incident in detail..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Location</label>
        <input
          type="text"
          value={incidentForm.location}
          onChange={(e) => setIncidentForm({ ...incidentForm, location: e.target.value })}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 outline-none"
          placeholder="Where did this occur?"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Solution Applied</label>
        <textarea
          value={incidentForm.solution}
          onChange={(e) => setIncidentForm({ ...incidentForm, solution: e.target.value })}
          rows={3}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 outline-none"
          placeholder="What was done to resolve it?"
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={incidentForm.notifyManager}
          onChange={(e) => setIncidentForm({ ...incidentForm, notifyManager: e.target.checked })}
          className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-red-500 focus:ring-red-500"
        />
        <span className="text-sm text-slate-300">Notify Manager</span>
      </label>
    </div>
  );

  const renderTimeForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Clock In</label>
          <input
            type="time"
            value={timeForm.clockIn}
            onChange={(e) => setTimeForm({ ...timeForm, clockIn: e.target.value })}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Clock Out</label>
          <input
            type="time"
            value={timeForm.clockOut}
            onChange={(e) => setTimeForm({ ...timeForm, clockOut: e.target.value })}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Break (min)</label>
          <input
            type="number"
            value={timeForm.breakDuration}
            onChange={(e) => setTimeForm({ ...timeForm, breakDuration: Number(e.target.value) })}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Travel To (min)</label>
          <input
            type="number"
            value={timeForm.travelToSite}
            onChange={(e) => setTimeForm({ ...timeForm, travelToSite: Number(e.target.value) })}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">Travel Back (min)</label>
          <input
            type="number"
            value={timeForm.travelBack}
            onChange={(e) => setTimeForm({ ...timeForm, travelBack: Number(e.target.value) })}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Job Assigned</label>
        <input
          type="text"
          value={timeForm.jobAssigned}
          onChange={(e) => setTimeForm({ ...timeForm, jobAssigned: e.target.value })}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
          placeholder="Project or job name..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-2">Notes</label>
        <textarea
          value={timeForm.notes}
          onChange={(e) => setTimeForm({ ...timeForm, notes: e.target.value })}
          rows={3}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-amber-500 outline-none"
          placeholder="Additional notes..."
        />
      </div>
    </div>
  );

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'daily':
        return <FileText size={16} className="text-blue-400" />;
      case 'incident':
        return <AlertCircle size={16} className="text-red-400" />;
      case 'time':
        return <Clock size={16} className="text-amber-400" />;
      default:
        return <FileText size={16} />;
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-900">
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
            <CalendarIcon size={32} className="text-emerald-500" />
            Reports
          </h1>
          <p className="text-slate-400">Select a date to view or create reports</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar Section */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-xl font-bold text-white">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <button
                  onClick={handleNextMonth}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Calendar Grid */}
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
                  const isToday = new Date().toDateString() === date.toDateString();
                  const hasReports = getReportsForDate(date).length > 0;

                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => handleDayClick(date)}
                      className={`aspect-square rounded-lg p-2 text-sm font-semibold transition-all relative ${
                        isSelected
                          ? 'bg-emerald-500 text-white'
                          : isToday
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
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

          {/* Reports List Section */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">
                  {selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select a date'}
                </h3>
                {selectedDate && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                    title="Create Report"
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>

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
                          <div className="flex gap-1">
                            <button
                              onClick={() => setShowViewModal(report)}
                              className="p-1 hover:bg-slate-700 rounded transition-colors text-emerald-400"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteReport(report.id)}
                              className="p-1 hover:bg-slate-700 rounded transition-colors text-red-400"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400">
                          Created by {report.createdByNickname} at {new Date(report.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <FileText size={48} className="mx-auto mb-2 text-slate-600" />
                    <p className="text-sm">No reports for this day</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      Create Report
                    </button>
                  </div>
                )
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <CalendarIcon size={48} className="mx-auto mb-2 text-slate-600" />
                  <p className="text-sm">Select a date to view or create reports</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Create Report Modal */}
        {showCreateModal && selectedDate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Create Report</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-300 mb-3">Report Type</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setReportType('daily')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      reportType === 'daily'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                    }`}
                  >
                    <FileText size={24} className={reportType === 'daily' ? 'text-blue-400' : 'text-slate-400'} />
                    <p className={`text-sm font-semibold mt-2 ${reportType === 'daily' ? 'text-blue-400' : 'text-slate-400'}`}>Daily</p>
                  </button>
                  <button
                    onClick={() => setReportType('incident')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      reportType === 'incident'
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                    }`}
                  >
                    <AlertCircle size={24} className={reportType === 'incident' ? 'text-red-400' : 'text-slate-400'} />
                    <p className={`text-sm font-semibold mt-2 ${reportType === 'incident' ? 'text-red-400' : 'text-slate-400'}`}>Incident</p>
                  </button>
                  <button
                    onClick={() => setReportType('time')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      reportType === 'time'
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                    }`}
                  >
                    <Clock size={24} className={reportType === 'time' ? 'text-amber-400' : 'text-slate-400'} />
                    <p className={`text-sm font-semibold mt-2 ${reportType === 'time' ? 'text-amber-400' : 'text-slate-400'}`}>Time</p>
                  </button>
                </div>
              </div>

              {reportType === 'daily' && renderDailyForm()}
              {reportType === 'incident' && renderIncidentForm()}
              {reportType === 'time' && renderTimeForm()}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateReport}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Create Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Report Modal */}
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

                {/* Display report data */}
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
