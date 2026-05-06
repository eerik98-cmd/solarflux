
export enum Category {
  PANELS = 'Solar Panels',
  INVERTERS = 'Inverters',
  BATTERIES = 'Batteries',
  MOUNTING = 'Mounting',
  ELECTRICAL = 'Electrical',
  MONITORING = 'Monitoring',
  OTHER = 'Other'
}

export interface InventoryDocuments {
  dataSheet?: string;
  certificate?: string;
  dataSheetName?: string;
  certificateName?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: Category;
  quantity: number;
  minThreshold: number;
  buyPrice: number; // Cost per unit
  sellPrice: number; // Selling price per unit
  location: string;
  specs?: string; // e.g., "400W Monocrystalline"
  powerW?: number; // Power in Watts (Specific to Solar Panels)
  panelWidth?: number; // Width in meters (Specific to Solar Panels)
  panelHeight?: number; // Height in meters (Specific to Solar Panels)
  isRail?: boolean; // Mounting rail indicator
  railLengthM?: number; // Mounting rail length in meters
  documents?: InventoryDocuments;
  serialNumbers?: string[]; // Array of unique serial numbers
  
  // Battery-specific fields
  batteryPowerKwh?: number; // Power in kWh
  batteryType?: 'High Voltage' | 'Low Voltage'; // Tip stocare
  
  // Inverter-specific fields
  inverterPowerKw?: number; // Power in KW for inverters
  inverterConnectionType?: 'Monofazat' | 'Trifazat'; // Tip Bransament
  inverterStorageType?: 'High Voltage' | 'Low Voltage'; // Tip stocare
}

export interface QuoteLineItem {
  id: string;
  inventoryItemId?: string; // Optional, in case it's a custom line item
  description: string;
  unit: string;
  quantity: number;
  netPrice: number;
  selectedSerialNumbers?: string[];
}

export type ProjectPhase = 
  | 'planning' 
  | 'in-progress' 
  | 'pending-inspection' 
  | 'completed' 
  | 'archived';

export interface MaterialVariance {
  itemId: string;
  description: string;
  quotedQty: number;
  consumedQty: number;
  delta: number; // consumedQty - quotedQty
  unit: string;
  netPrice: number;
  variance: number; // delta * netPrice
}

export interface ConsumptionItem {
  id: string;
  description: string;
  quotedQty: number;
  consumedQty: number;
  actuallyUsed?: number; // For installer input
  selectedSerialNumbers?: string[];
  unit: string;
  netPrice: number;
  isExtra?: boolean;
  originalLineItemId?: string;
  inventoryItemId?: string; // Link to inventory for barcode scanning
  barcode?: string; // For items with barcodes
  hasBarcode?: boolean; // Whether this item supports barcode scanning
}

export interface Quote {
  id: string;
  clientId?: string; // Link to specific client
  title?: string; // Project Name / Title of the quote
  customerName: string;
  description?: string; // Project Description / Notes
  date: Date;
  items: QuoteLineItem[];
  subtotalNet: number;
  vatTotal: number;
  totalGross: number;

  // Installer Allocation & Status
  allocatedInstallerId?: string; // Installer nickname who is assigned
  allocatedAt?: Date;
  assignedInstallers?: Array<{
    installerId: string;
    installerNickname: string;
    assignedAt: Date;
    assignedBy?: string;
  }>;
  
  // Project Phase Tracking
  phase?: ProjectPhase; // Current phase of the project
  phaseHistory?: Array<{
    phase: ProjectPhase;
    timestamp: Date;
    changedBy: string;
  }>;
  estimatedCompletionDate?: Date;

  // Job Completion Data
  completedAt?: Date;
  completedBy?: string; // Installer nickname who completed
  consumptionData?: ConsumptionItem[];
  consumptionDataUpdatedAt?: Date; // When equipment list was last edited
  consumptionDataUpdatedBy?: string; // Who last edited equipment
  extraItems?: ConsumptionItem[];
  completionNotes?: string;
  installationPhotos?: InstallationPhoto[];
  materialVariances?: MaterialVariance[];
  groundingValue?: string; // Installer measured grounding value
  lowVoltageCableCheck?: 'Corespunde' | 'Nu corespunde';
  installerDeclaredFinishedAt?: Date;
  installerDeclaredFinishedBy?: string;
  installerMentions?: Array<{
    id: string;
    message: string;
    createdAt: Date;
    createdBy: string;
  }>;

  // Admin Completion & Approval
  adminApprovedAt?: Date; // When admin confirmed the completion
  adminApprovedBy?: string; // Admin username who approved
  adminApprovalNotes?: string; // Admin notes about the completion
  
  // Reopen Tracking (for post-completion changes)
  reopenedAt?: Date; // When project was reopened after completion
  reopenedBy?: string; // Who reopened it
  reopenReason?: string; // Why it was reopened
  reopenHistory?: Array<{
    reopenedAt: Date;
    reopenedBy: string;
    reopenReason: string;
    closedAgainAt?: Date; // When it was closed again after reopen
  }>;

  // Email Tracking
  emailSentAt?: Date; // When quote was last emailed
  emailSentTo?: string; // Email address it was sent to
  emailSentBy?: string; // User who sent the email
  emailHistory?: Array<{
    sentAt: Date;
    sentTo: string;
    sentBy: string;
    documentName?: string;
    documentId?: string;
  }>;
  
  // Generated Documents
  generatedDocuments?: Array<{
    id: string;
    name: string;
    url: string; // Firebase Storage URL
    date: Date;
    generatedBy?: string; // User who generated it
  }>;

  // Quote Status Lifecycle
  quoteStatus?: 'draft' | 'sent' | 'won_unallocated' | 'won_allocated';
}

export type InstallerReminderType = 'MISSING_DAILY_REPORT';

export interface InstallerReminder {
  id: string;
  installerId: string;
  installerNickname: string;
  quoteId?: string;
  quoteTitle?: string;
  reminderType: InstallerReminderType;
  reminderDate: Date; // Date for which reminder is generated
  createdAt: Date;
  createdBy: string;
  message: string;
  isReadByInstaller: boolean;
}

export interface AIResponse {
  text: string;
  suggestedActions?: {
    type: 'RESTOCK' | 'DISCOUNT' | 'BUNDLE';
    itemId: string;
    reason: string;
  }[];
}

// --- New Types for Clients ---

export enum ClientType {
  PRIVATE = 'Private',
  CORPORATE = 'Corporate'
}

export type ClientStatus = 'LEAD' | 'ACTIVE' | 'CLOSED';

export interface ClientSiteImage {
  id: string;
  url: string; // Base64 data URL
  timestamp: Date;
  label?: string;
  category?: 'Roof' | 'Electrical' | 'Access' | 'Obstacles' | 'Meter' | 'Other';
  uploadedBy?: string; // Name/nickname of person who uploaded
}

export interface InstallationPhoto {
  id: string;
  url: string; // Base64 data URL
  timestamp: Date;
  description?: string;
  uploadedBy?: string; // Installer name who uploaded
  uploadedAt?: Date; // Separate timestamp field
}

export interface ClientNeed {
  // Description with Audit Trail
  description?: string;
  descriptionUpdatedAt?: Date;
  descriptionUpdatedBy?: string;

  // Project Info
  projectName?: string;
  projectId?: string;

  // Site Location
  siteCountry?: string;
  siteCounty?: string;
  siteCity?: string;
  siteStreet?: string;
  siteStreetNumber?: string;
  sitePostalCode?: string;

  // Doc Selection for Generation
  selectedCfDocId?: string;
  selectedFacturaDocId?: string;

  // Connection
  connectionType?: 'Monofazat' | 'Trifazat';
  
  // Roof
  roofType?: 'Tigla ceramica' | 'Tabla' | 'Tigla metalica' | 'Tabla ondulata' | 'Tabla cutata' | 'Panou sandwich' | 'Other';
  roofTypeOther?: string; // Custom text when roofType is 'Other'

  // Grounding
  groundingStatus?: 'exista' | 'nu exista, face Solar Invest' | 'nu exista, face Beneficiarul';
  
  // Mounting Structure Selection
  selectedMountingSystem?: 'rail' | 'minirail'; // Selected mounting system option
  rowCount?: number;
  rowDistribution?: { [key: number]: number };
  
  // Inverter Requirements
  inverterKw?: number;
  selectedInverterId?: string; // Selected inverter from inventory
  
  // Battery Requirements
  batteryKwh?: number;
  selectedBatteryId?: string; // Selected battery from inventory
  
  // Panel Requirements
  panelSizeType?: '2093x1134' | '1722x1134' | 'STOCK_ITEM';
  panelStockItemId?: string; // If they select a specific panel from inventory
  panelKw?: number;
  panelCount?: number;

  storage?: string; // e.g. "5 kWh"
  technicalNotes?: string;
  siteImages?: ClientSiteImage[];
}

export interface ArchivedProject {
  id: string;
  projectName: string;
  archivedAt: Date;
  data: ClientNeed;
}

export interface Client {
  id: string;
  internalId?: string; // SI_xxxx (Auto-generated)
  type: ClientType;
  status: ClientStatus;
  
  // Display Helpers
  name: string; // Combined Name or Company Name
  address: string; // Full address string
  
  // Contact
  email: string;
  phone: string;

  // Address Details
  country?: string;
  county?: string;
  city?: string;
  street?: string;
  streetNumber?: string;
  postalCode?: string;

  // Private Specific
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  cnp?: string;

  // Corporate Specific
  companyName?: string;
  taxId?: string;       // Adószám / CUI
  regNumber?: string;   // Cégjegyzékszám / J
  iban?: string;        // Bankszámlaszám
  bankName?: string;
  representative?: string; // Legal representative (legacy)
  representativeFirstName?: string;
  representativeLastName?: string;
  representativeRole?: string; // Calitate / Function
  website?: string;

  // New Fields
  needs?: ClientNeed;
  notes?: ClientNote[];
  documents?: ClientDocument[];
  archivedProjects?: ArchivedProject[];
}

export interface ClientNote {
  id: string;
  content: string;
  author: string;
  date: Date;
}

export interface ClientDocument {
  id: string;
  name: string; // The renamed file name (e.g. "CI John Doe.pdf")
  type: 'CI' | 'CF' | 'Fact' | 'CUI' | 'Other'; // Added CUI
  description?: string; // For POD or extra details
  podNumber?: string; // Factura POD
  cfNumber?: string; // CF number
  cadNumber?: string; // CAD number
  docAddress?: string; // Address for CF/Factura
  projectId?: string;
  projectName?: string;
  url: string; // Base64 or URL
  date: Date;
  folder?: string; // Virtual folder path
  uploadedBy?: string; // Username of uploader (for installers)
  uploadedByRole?: 'SUPER_ADMIN' | 'WAREHOUSEMAN' | 'INSTALLER'; // Role of uploader
}

export interface DocTemplate {
  id: string;
  name: string;
  content: string; // Base64 string or URL
  date: Date;
}

export interface SmtpSettings {
  id: string; // Usually 'default' for company-wide settings
  host: string; // smtp.gmail.com, smtp.office365.com, etc.
  port: number; // Usually 587 (TLS) or 465 (SSL)
  secure: boolean; // TLS enabled
  username: string;
  password: string; // Encrypted before storage
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  signature?: string; // HTML signature to append to emails
  updatedAt: Date;
  updatedBy: string;
}

export type EmailTemplateCategory = 'quote' | 'invoice' | 'general' | 'project';

export interface EmailTemplate {
  id: string;
  name: string;
  category: EmailTemplateCategory;
  subject: string; // Can include variables like {clientName}
  body: string; // HTML content with variable placeholders
  variables: string[]; // Available variables for this template
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export type UserRole = 'SUPER_ADMIN' | 'WAREHOUSEMAN' | 'INSTALLER';

export interface User {
  id: string;
  username: string;
  password: string; // Hashed password stored in database
  nickname: string;
  role: UserRole;
}

export interface AssignedInstaller {
  installerId: string;
  installerNickname: string;
  assignedAt: Date;
  assignedBy?: string;
}

// Session data stored in encrypted cookie
export interface SessionData {
  userId: string;
  username: string;
  role: string;
  nickname: string;
  isLoggedIn: boolean;
}

// User data returned to client (without password)
export interface SafeUser {
  id: string;
  username: string;
  nickname: string;
  role: UserRole;
}

export interface Installer {
  id: string;
  name: string;
  role: string;
  status: 'AVAILABLE' | 'ASSIGNED' | 'OFF_DUTY';
  currentSite?: string;
  phone: string;
}

export interface InstallerNotification {
  id: string;
  type: 'PROJECT_ASSIGNED' | 'ADMIN_MESSAGE' | 'PROJECT_UPDATE';
  title: string;
  message: string;
  createdAt: Date;
  createdBy: string;
  targetInstaller: string; // Installer nickname
  projectId?: string; // Associated quote/project ID
  isRead: boolean;
  priority?: 'low' | 'medium' | 'high';
}

export interface TeamMessage {
  id: string;
  senderRole: UserRole;
  senderName: string;
  message: string;
  createdAt: Date;
  readByAdmin: boolean;
  readByInstaller: boolean;
  quoteId?: string;
}

export interface TeamMessageThread {
  id: string;
  installerId: string;
  installerNickname: string;
  updatedAt: Date;
  messages: TeamMessage[];
}

export interface InstallerReport {
  id: string;
  installerId: string;
  createdByNickname: string;
  date: Date;
  type: 'daily' | 'incident' | 'time';
  createdAt: Date;
  data: Record<string, unknown>;
}

export type EquipmentTrackingEntryStatus = 'draft' | 'submitted';

export interface EquipmentTrackingEntry {
  id: string;
  quoteId: string;
  clientId: string;
  projectTitle?: string;
  workDate: Date;
  installerId: string;
  installerNickname: string;
  status: EquipmentTrackingEntryStatus;
  items: ConsumptionItem[];
  extraItems: ConsumptionItem[];
  installationPhotos: InstallationPhoto[];
  notes?: string;
  groundingValue?: string;
  lowVoltageCableCheck?: 'Corespunde' | 'Nu corespunde';
  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date;
}

export type View = 'DASHBOARD' | 'INVENTORY' | 'AI_ASSISTANT' | 'QUOTE_GENERATOR' | 'CLIENTS' | 'SETTINGS' | 'FILE_MANAGER' | 'MANAGE_TEAM';
