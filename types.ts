
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
}

export interface ClientNeed {
  // Description with Audit Trail
  description?: string;
  descriptionUpdatedAt?: Date;
  descriptionUpdatedBy?: string;

  // Project Info
  projectName?: string;

  // Connection
  connectionType?: 'Monofazat' | 'Trifazat';
  
  // Roof
  roofType?: 'Tigla ceramica' | 'Tabla' | 'Tigla metalica' | 'Tabla ondulata' | 'Tabla cutata' | 'Panou sandwich' | 'Other';
  roofTypeOther?: string; // Custom text when roofType is 'Other'
  
  // Inverter Requirements
  inverterKw?: number;
  
  // Battery Requirements
  batteryKwh?: number;
  
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
  representative?: string; // Legal representative
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
  url: string; // Base64 or URL
  date: Date;
  folder?: string; // Virtual folder path
}

export interface DocTemplate {
  id: string;
  name: string;
  content: string; // Base64 string
  date: Date;
}

export type UserRole = 'SUPER_ADMIN' | 'WAREHOUSEMAN' | 'INSTALLER';

export interface User {
  id: string;
  username: string;
  password: string; // In a real app, this would be hashed
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

export type View = 'DASHBOARD' | 'INVENTORY' | 'AI_ASSISTANT' | 'QUOTE_GENERATOR' | 'CLIENTS' | 'SETTINGS' | 'FILE_MANAGER';
