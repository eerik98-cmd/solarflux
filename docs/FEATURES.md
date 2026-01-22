# SolarFlux - Complete Feature List

## Overview
SolarFlux is a comprehensive solar installation management system designed for contractors and installers. It provides end-to-end client management, project planning, document generation, and quote management.

---

## 1. CLIENT MANAGEMENT

### 1.1 Client Registry (List View)
- **Search Functionality**: Real-time search across client names, emails, internal IDs, and company names
- **Client Type Filtering**: Display all clients or filter by type (PRIVATE or CORPORATE)
- **Quick Actions**: Hover-based Open and Delete buttons for each client
- **Client Cards**: Display essential client info with status badges (ACTIVE, LEAD, CLOSED)
- **Status Color Coding**: Visual indicators for client status (green for ACTIVE, blue for LEAD, red for CLOSED)
- **Add New Client**: Modal-based client creation with role-based permissions (INSTALLER role restricted)

### 1.2 Add New Client Modal
**Step 1: Type Selection**
- Choose between PRIVATE (Individual) or CORPORATE (Company) client types
- Visual representation with icons (User icon for private, Building icon for corporate)

**Step 2: Client Form**

#### For Private Clients:
- First Name & Last Name
- Email & Phone
- Internal ID (auto-generated with SI_ prefix and auto-incrementing numbers)
- Address (Street, Street Number, City, County, Country)
- Optional: CNP (Personal ID), Bank Name, IBAN

#### For Corporate Clients:
- Company Name
- Primary Contact Email & Phone
- Tax ID (CUI), Registration Number (J)
- Address (Street, Street Number, City, County, Country)
- Optional: Bank Name, IBAN

---

## 2. CLIENT DATA TAB

### 2.1 Client Information Display
- **Client Name & Status Badge**: Prominently displayed with status (ACTIVE, LEAD, CLOSED)
- **Client Type Badge**: Shows PRIVATE or CORPORATE with appropriate icon

### 2.2 Client Details Editing
All editable fields with real-time updates:

#### Contact Information:
- Email, Phone
- Address components (Street, Number, City, County, Country)

#### Financial Information:
- Tax ID / CUI (Corporate Tax Identification)
- Registration Number / J (Registration)
- CNP (Personal ID for private clients)
- Bank Name, IBAN

#### Status Management:
- Client status dropdown (ACTIVE, LEAD, CLOSED)

### 2.3 Notes System
- **Add Notes**: Rich text input for adding client notes
- **Author & Date**: Each note displays author name and creation date
- **Delete Notes**: Role-based deletion (users can only delete their own notes, SUPER_ADMIN can delete any)
- **Note History**: Chronologically organized notes list with most recent first

---

## 3. CLIENT NEEDS TAB

### 3.1 Project Archive & Management
- **Save Project**: Archive current project with project name
- **Restore Projects**: Load previously saved projects
- **Project List**: Display all archived projects with timestamps and ability to restore or delete

### 3.2 Project Name
- Text input for naming the current project

### 3.3 Scope of Work
- **Description Field**: Large textarea for detailed project requirements
- **Auto-save**: Saves on blur/exit of field
- **Version Tracking**: Shows who last updated and when

### 3.4 Connection Type Selection
- **Monofazat (Single Phase)**: For residential installations
- **Trifazat (Three Phase)**: For commercial installations
- Informational banner suggesting appropriate inverter type

### 3.5 Roof Type Selection
- Dropdown with predefined options:
  - Tigla ceramica (Ceramic tiles)
  - Tabla (Sheet metal)
  - Tigla metalica (Metal tiles)
  - Tabla ondulata (Corrugated metal)
  - Tabla cutata (Profiled metal)
  - Panou sandwich (Sandwich panels)
  - Other (with custom input field)
- Used for calculating mounting structure requirements

### 3.6 Inverter Selection

#### Power Input:
- Numeric input for inverter power in kW

#### Automatic Suggestions:
- Filters inventory by:
  - Inverter category
  - Connection type match (Monofazat/Trifazat)
  - Power within ±2kW tolerance
  - Available stock
- Displays recommended inverters with specifications

#### Features:
- Stock quantity display
- Storage type information (battery type compatibility)
- Price per unit
- "Show All Available Inverters" modal for complete list
- Clear selection button to reset choice

#### Storage Information:
- Displays selected inverter's supported battery storage type

### 3.7 Battery Selection

#### Power Input:
- Numeric input for battery capacity in kWh

#### Automatic Suggestions:
- Only appears when:
  - Battery capacity > 0
  - Inverter has been selected
- Filters by matching battery type to inverter storage type
- Shows battery models with specifications and stock

#### Features:
- "Show All Batteries" modal for browsing all options
- Price per unit display
- Clear selection button
- Resets when inverter changes

### 3.8 Panels Calculator

#### Power Input:
- Numeric input for total required power in kW

#### Panel Suggestions:
- Displays top 3 matching panels with calculations:
  - Pieces needed based on panel wattage
  - Actual power (pieces × panel wattage)
  - Stock status (IN STOCK, LOW STOCK, OUT OF STOCK)
- "Show All Panels" button for complete modal view

#### Selected Panel Display:
- Panel specifications
- Stock information with warnings if insufficient
- Manual quantity override input

### 3.9 Row Configuration & Mounting Structure Calculator

#### Row Setup:
- **Row Count Input**: Number of rows for the installation
- **Row Distribution**: For multiple rows, specify panels per row
  - Input field for each row
  - Validation for total panel count

#### Automatic Calculations:

##### Structure Components:
- **End Clamps**: 4 per row (connection at row ends)
- **Mid Clamps**: 2 per panel connection (between adjacent panels)
- **Rails (6m sections)**: Based on panel width and configuration
  - Calculates waste (10% buffer)
  - Determines sections needed per row
  - 2 rails per row (top and bottom)
- **Rail Combiners**: Connecting sections together (if multiple sections needed)
- **Roof Attachments**: Quantity based on:
  - Total panel count
  - Roof type (varies from 3-6 attachments per panel)

##### Rail Details Per Row:
- Rail length needed
- Sections per rail (6m sections)
- Excess material available
- Combiner requirements

##### Summary Display:
- Text summary of all components in prose format
- Visual grid showing quantities for each component

### 3.10 Site Images Management

#### Upload Features:
- **File Upload**: Multi-file upload for site photos
- **Camera Capture**: Direct camera access for on-site photo taking
  - Attempts environment-facing camera first (for site views)
  - Falls back to any available camera

#### Image Organization:
- **Grid Display**: Shows all uploaded images with thumbnails
- **Image Preview**: Click to open full-size preview
- **Image Description**: Add/edit label for each image
- **Delete Function**: Remove individual images with confirmation

#### Camera Modal:
- Video stream preview
- Cancel button to close without capturing

---

## 4. DOCUMENTS TAB (FILE MANAGER)

### 4.1 Document Upload

#### Document Type Selection:
**For Private Clients:**
- CI (Certificat de Identitate - ID Certificate)
- CF (Carte de Finanțe - Financial Card)
- Factura (Invoice) - requires invoice number
- Other

**For Corporate Clients:**
- CI (Business ID)
- CUI (Corporate Tax ID)
- Other

#### Upload Options:
- File browser selection
- Drag and drop support
- Auto-naming based on: `[InternalID] DocType ClientName`
- Optional description field
- Document type mapping to file system folders

#### Upload Confirmation:
- "Upload Document" button
- Visual feedback on completion

### 4.2 Document List & Management

#### Document Display:
- Thumbnail preview for images and PDFs
- Document name and type badge
- Upload date
- Description (if provided)

#### Document Actions:
- **Preview**: Open PDF in embedded viewer or images in lightbox
- **Download**: Direct download to local storage
- **Print**: Open print-friendly view
- **Edit**: Modify document name and description
- **Delete**: Remove document with confirmation dialog

#### Document Preview Modals:
- **PDF Preview**: Full iframe viewer with browser PDF tools
- **Image Preview**: Full-screen lightbox view
- **Edit Modal**: Update document metadata (name, description)

---

## 5. QUOTES TAB

### 5.1 Project Quote Creation

#### Quote Header:
- New Quote button (clears form)
- Load Quote button (from previously saved quotes)
- Project name input field
- Visual quote totals (Subtotal, VAT, Gross Total)

#### Quote Line Items:

##### Line Item Columns:
- **Description**: Product name or service description
- **Unit**: Measurement unit (pcs, m, kWh, etc.)
- **Quantity**: Number of units
- **Net Price**: Unit price
- **Net Total**: Auto-calculated (Quantity × Net Price)

##### Line Item Actions:
- Add new blank line item
- Delete line from quote
- Edit any field in-place

##### Auto-Population from Inventory:
- Click product description field to browse inventory
- Select from matching products
- Auto-fills unit, price from inventory

### 5.2 Mounting Structure Quick Add
- "Add Mounting Structure" button
- Automatically calculates all components from panel configuration:
  - End clamps, mid clamps, rails, combiners, attachments
  - Looks up current prices from inventory
  - Adds all items as line items to quote

### 5.3 Quote Calculations

#### Automatic Totals:
- **Subtotal (Net)**: Sum of all line item totals
- **VAT (21%)**: Automatic calculation
- **Total (Gross)**: Subtotal + VAT

### 5.4 Quote Management

#### Save Quote:
- Save with project name
- Creates new or updates existing quote
- Links quote to client

#### Quote List:
- Display all quotes for current client
- Load button to edit existing quote
- Delete button to remove quote
- Date display for each quote

#### Quote Preview:
- Read-only view of saved quote
- All calculations visible

---

## 6. DOCUMENT GENERATOR TAB

### 6.1 Template Selection

#### Two Options:
1. **Stored Templates**: Select from predefined templates in settings
2. **Upload Template**: Upload custom Word/Document templates

### 6.2 Template Placeholders

#### Available Placeholders:
| Tag | Description |
|-----|-------------|
| `{client_name}` | Full name or company name |
| `{internal_id}` | System ID (SI_XXXX) |
| `{client_address}` | Full address |
| `{client_email}` | Primary contact email |
| `{client_phone}` | Primary contact phone |
| `{tax_id}` | Corporate Tax ID / CUI |
| `{reg_number}` | Registration Number / J |
| `{iban}` | Bank Account Number |
| `{cnp}` | Private Personal ID |
| `{today_date}` | Current system date |
| `{#items}...{/items}` | Loop for quote items |
| `{description}` | Item description (inside items loop) |
| `{total_gross}` | Grand total with VAT |

### 6.3 Quote Selection
- Dropdown to select which quote to generate from
- Includes all quotes for current client
- Auto-fills quote data into document

### 6.4 Document Generation
- **Build Document** button with loading state
- Processes template with client data and quote information
- Generates downloadable document

### 6.5 Generated Document Management
- Auto-named: `[ClientID] Generated_TIMESTAMP.docx`
- Saves to client's file system
- Appears in Documents tab after generation

---

## 7. ADVANCED FEATURES

### 7.1 Modal Dialogs

#### Inverter Selection Modal
- Browse all available inverters
- Filter by connection type and power range
- Stock information display
- Select and confirm choice

#### Battery Selection Modal
- Browse all available batteries
- Filtered by selected inverter's storage type
- Stock and specifications display
- Select and confirm choice

#### Panel Selection Modal
- Browse all available panels
- Shows calculated pieces needed
- Stock status indicators
- Select and confirm choice

#### Image Preview Modal
- Full-screen image viewing
- Navigate between images
- Close button

#### New Client Modal
- Two-step wizard (Type Selection → Form)
- Conditional fields based on client type
- Auto-generated internal IDs
- Form validation

### 7.2 Confirmation Dialogs
- Delete operations require confirmation
- Customizable messages and button labels
- Three variants: danger (red), warning (yellow), info (blue)
- Optional third button for additional actions

### 7.3 Real-time Calculations
- Panel requirement calculations based on:
  - Target power (kW)
  - Selected panel wattage
  - Stock availability
- Mounting structure components auto-calculated from:
  - Panel count
  - Row configuration
  - Roof type
  - Panel dimensions

---

## 8. USER INTERFACE FEATURES

### 8.1 Responsive Design
- Desktop-first layout
- Tablet responsive (2-column layouts)
- Mobile-optimized (single-column, touch-friendly)

### 8.2 Visual Indicators
- **Status Badges**: Color-coded client status
- **Stock Status**: IN STOCK (green), LOW STOCK (yellow), OUT OF STOCK (red)
- **Type Icons**: User icon for private, Building icon for corporate
- **Selection Highlights**: Green highlight for selected items

### 8.3 Accessibility
- Keyboard navigation support
- ARIA labels for icons
- Semantic HTML structure
- High contrast colors (slate-900 background, amber accent)

### 8.4 Loading States
- Loading spinner (Loader2 icon) for async operations
- Disabled button states during processing
- Progress indication for document generation

---

## 9. DATA PERSISTENCE

### 9.1 Automatic Saving
- All field changes auto-save to database
- Real-time persistence for:
  - Client edits
  - Notes
  - Document uploads
  - Image uploads
  - Quote creation/updates
  - Project archives

### 9.2 Data Validation
- Required fields validation
- File type validation for uploads
- Numeric range validation for inputs
- Format validation for contact information

---

## 10. ROLE-BASED ACCESS CONTROL

### 10.1 User Roles
- **SUPER_ADMIN**: Full access to all features and deletion options
- **INSTALLER**: Limited access (cannot create new clients, can view/edit assigned clients)
- **ADMIN**: Full feature access

### 10.2 Feature Restrictions
- Add New Client: Not available for INSTALLER role
- Delete Operations: SUPER_ADMIN only
- Delete Own Notes: All users (but SUPER_ADMIN can delete any)

---

## 11. INTEGRATION WITH INVENTORY SYSTEM

### 11.1 Linked Features
- Real-time inventory lookups for:
  - Inverters (filtered by power range and connection type)
  - Batteries (filtered by storage type compatibility)
  - Panels (filtered by availability)
  - Mounting components (for structure calculations)

### 11.2 Price Integration
- Prices pulled directly from inventory
- Used in quote calculations
- Auto-updated when inventory changes

---

## 12. FILE MANAGEMENT

### 12.1 File System Integration
- Documents organized by client folder
- Sub-folders by document type (CI, CF, Fact, Other)
- Unique file naming with metadata
- Support for multiple file formats (PDF, images, documents)

### 12.2 Supported Operations
- Upload files
- Download files
- Preview files (images, PDFs)
- Print files
- Edit metadata
- Delete files

---

## 13. QUOTE FEATURES

### 13.1 Quote Creation Workflow
1. Create new quote or load existing
2. Enter project name
3. Add line items (manual or from inventory)
4. Auto-calculate totals with VAT
5. Save quote to client

### 13.2 Quote Templates
- Reuse previously created quotes
- Quick-add mounting structures
- Multi-quote per client support

### 13.3 Document Integration
- Quotes can be embedded in generated documents
- Quote data available via placeholders
- Automatic line item loops in templates

---

## 14. PROJECT ARCHIVING

### 14.1 Project Save/Archive
- Save current project configuration
- Includes all field values at time of save
- Timestamp tracking
- Ability to restore previous projects

### 14.2 Project History
- Multiple projects per client
- Easy switching between projects
- Delete old projects to clean up

---

## 15. VALIDATION & ERROR HANDLING

### 15.1 Input Validation
- Required field validation
- Numeric range checks
- File size limits
- File type restrictions

### 15.2 Error Messages
- User-friendly error dialogs
- Actionable error messages
- Retry options where applicable

---

## 16. SEARCH & FILTERING

### 16.1 Client Search
- Real-time search across multiple fields:
  - Client name
  - Email
  - Phone
  - Internal ID
  - Company name
- Case-insensitive matching

### 16.2 Inventory Filtering
- Filter by category (INVERTERS, BATTERIES, PANELS, MOUNTING)
- Filter by specifications (power, type, storage capacity)
- In-stock filtering

---

## 17. KEYBOARD SHORTCUTS & UX

### 17.1 Navigation
- Tab navigation through form fields
- Enter to submit forms
- Escape to close modals

### 17.2 Visual Feedback
- Hover states on buttons
- Active/inactive tab indicators
- Selection highlighting
- Loading animations

---

## 18. BROWSER COMPATIBILITY

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design for all screen sizes
- PDF viewing support
- Camera/media device access

---

## Summary Statistics

- **Main Tabs**: 5 (Data, Needs, Documents, Quotes, Doc Generator)
- **Modal Dialogs**: 8+ (New Client, Inverter Selection, Battery Selection, Panel Selection, Image Preview, Document Preview, Edit Document, Edit Image)
- **Input Fields per Client**: 15+ (across multiple tabs)
- **Document Types**: 4 (CI, CF/CUI, Factura/Invoices, Other)
- **Project Components Tracked**: 20+ (inverter, battery, panels, mounting components, etc.)
- **Placeholder Variables**: 13 (for document generation)
- **Calculations Automated**: 15+ (panel requirements, mounting structures, quote totals)
- **Role-Based Restrictions**: 3 feature types
- **File Operations**: 6 (upload, download, preview, print, edit, delete)

---

**Last Updated**: January 22, 2026
**Version**: 1.0
