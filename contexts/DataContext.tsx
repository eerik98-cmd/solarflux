'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { InventoryItem, Client, Quote, User, DocTemplate, TeamMessageThread, InstallerReport, InstallerReminder, EquipmentTrackingEntry } from '@/types';
import { StorageService } from '@/services/storageService';
import { MOCK_USERS } from '@/constants';

interface DataContextType {
  inventory: InventoryItem[];
  clients: Client[];
  savedQuotes: Quote[];
  users: User[];
  teamMessageThreads: TeamMessageThread[];
  installerReports: InstallerReport[];
  installerReminders: InstallerReminder[];
  equipmentTrackingEntries: EquipmentTrackingEntry[];
  docTemplates: DocTemplate[];
  companyDocuments: Record<string, unknown>[];
  dbConnectionError: boolean;
  setInventory: (inventory: InventoryItem[]) => void;
  setClients: (clients: Client[]) => void;
  setSavedQuotes: (quotes: Quote[]) => void;
  setUsers: (users: User[]) => void;
  setTeamMessageThreads: (threads: TeamMessageThread[]) => void;
  setInstallerReports: (reports: InstallerReport[]) => void;
  setInstallerReminders: (reminders: InstallerReminder[]) => void;
  setEquipmentTrackingEntries: (entries: EquipmentTrackingEntry[]) => void;
  setDocTemplates: (templates: DocTemplate[]) => void;
  setCompanyDocuments: (docs: Record<string, unknown>[]) => void;
  saveQuote: (quote: Quote) => Promise<void>;
  updateQuote: (quoteId: string, updates: Partial<Quote>) => Promise<void>;
  deleteQuote: (quoteId: string) => Promise<void>;
  updateClient: (client: Client) => Promise<void>;
  saveTeamMessageThread: (thread: TeamMessageThread) => Promise<void>;
  saveInstallerReport: (report: InstallerReport) => Promise<void>;
  deleteInstallerReport: (reportId: string) => Promise<void>;
  saveEquipmentTrackingEntry: (entry: EquipmentTrackingEntry) => Promise<void>;
  deleteEquipmentTrackingEntry: (entryId: string) => Promise<void>;
  saveInstallerReminder: (reminder: InstallerReminder) => Promise<void>;
  markInstallerReminderRead: (reminderId: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<Quote[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [teamMessageThreads, setTeamMessageThreads] = useState<TeamMessageThread[]>([]);
  const [installerReports, setInstallerReports] = useState<InstallerReport[]>([]);
  const [installerReminders, setInstallerReminders] = useState<InstallerReminder[]>([]);
  const [equipmentTrackingEntries, setEquipmentTrackingEntries] = useState<EquipmentTrackingEntry[]>([]);
  const [docTemplates, setDocTemplates] = useState<DocTemplate[]>([]);
  const [companyDocuments, setCompanyDocuments] = useState<Record<string, unknown>[]>([]);
  const [dbConnectionError, setDbConnectionError] = useState(false);

  // Firestore Subscriptions
  useEffect(() => {
    const unsubInventory = StorageService.subscribe('inventory', (data) => 
      setInventory(data as InventoryItem[])
    );
    const unsubClients = StorageService.subscribe('clients', (data) => 
      setClients(data as Client[])
    );
    const unsubQuotes = StorageService.subscribe('quotes', (data) => 
      setSavedQuotes(data as Quote[])
    );
    const unsubUsers = StorageService.subscribe('users', (data) => 
      setUsers(data as User[])
    );
    const unsubTeamMessages = StorageService.subscribe('teamMessages', (data) =>
      setTeamMessageThreads(data as TeamMessageThread[])
    );
    const unsubInstallerReports = StorageService.subscribe('installerReports', (data) =>
      setInstallerReports(data as InstallerReport[])
    );
    const unsubInstallerReminders = StorageService.subscribe('installerReminders', (data) =>
      setInstallerReminders(data as InstallerReminder[])
    );
    const unsubEquipmentTrackingEntries = StorageService.subscribe('equipmentTrackingEntries', (data) =>
      setEquipmentTrackingEntries(data as EquipmentTrackingEntry[])
    );
    const unsubTemplates = StorageService.subscribe('templates', (data) => 
      setDocTemplates(data as DocTemplate[])
    );
    const unsubCompanyDocuments = StorageService.subscribe('companyDocuments', (data) => 
      setCompanyDocuments(data as any[])
    );

    const initDB = async () => {
      try {
        await StorageService.initializeDataIfEmpty('users', MOCK_USERS);
      } catch (err) {
        console.error('Failed to connect to Firebase:', err);
        setDbConnectionError(true);
      }
    };
    initDB();

    return () => {
      unsubInventory();
      unsubClients();
      unsubQuotes();
      unsubUsers();
      unsubTeamMessages();
      unsubInstallerReports();
      unsubInstallerReminders();
      unsubEquipmentTrackingEntries();
      unsubTemplates();
      unsubCompanyDocuments();
    };
  }, []);

  const saveQuote = async (quote: Quote) => {
    await StorageService.saveItem('quotes', quote);
  };

  const updateQuote = async (quoteId: string, updates: Partial<Quote>) => {
    const existingQuote = savedQuotes.find(q => q.id === quoteId);
    if (!existingQuote) throw new Error('Quote not found');
    const updatedQuote = { ...existingQuote, ...updates };
    await StorageService.saveItem('quotes', updatedQuote);
  };

  const deleteQuote = async (quoteId: string) => {
    await StorageService.deleteItem('quotes', quoteId);
  };

  const updateClient = async (client: Client) => {
    await StorageService.saveItem('clients', client);
  };

  const saveTeamMessageThread = async (thread: TeamMessageThread) => {
    await StorageService.saveItem('teamMessages', thread);
  };

  const saveInstallerReport = async (report: InstallerReport) => {
    await StorageService.saveItem('installerReports', report);
  };

  const deleteInstallerReport = async (reportId: string) => {
    await StorageService.deleteItem('installerReports', reportId);
  };

  const saveEquipmentTrackingEntry = async (entry: EquipmentTrackingEntry) => {
    await StorageService.saveItem('equipmentTrackingEntries', entry);
  };

  const deleteEquipmentTrackingEntry = async (entryId: string) => {
    await StorageService.deleteItem('equipmentTrackingEntries', entryId);
  };

  const saveInstallerReminder = async (reminder: InstallerReminder) => {
    await StorageService.saveItem('installerReminders', reminder);
  };

  const markInstallerReminderRead = async (reminderId: string) => {
    const reminder = installerReminders.find((item) => item.id === reminderId);
    if (!reminder) return;
    await StorageService.saveItem('installerReminders', {
      ...reminder,
      isReadByInstaller: true,
    });
  };

  return (
    <DataContext.Provider
      value={{
        inventory,
        clients,
        savedQuotes,
        users,
        teamMessageThreads,
        installerReports,
        installerReminders,
        equipmentTrackingEntries,
        docTemplates,
        companyDocuments,
        dbConnectionError,
        setInventory,
        setClients,
        setSavedQuotes,
        setUsers,
        setTeamMessageThreads,
        setInstallerReports,
        setInstallerReminders,
        setEquipmentTrackingEntries,
        setDocTemplates,
        setCompanyDocuments,
        saveQuote,
        updateQuote,
        deleteQuote,
        updateClient,
        saveTeamMessageThread,
        saveInstallerReport,
        deleteInstallerReport,
        saveEquipmentTrackingEntry,
        deleteEquipmentTrackingEntry,
        saveInstallerReminder,
        markInstallerReminderRead,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
