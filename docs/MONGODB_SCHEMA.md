# SolarFlux — MongoDB Database Schema

**Database:** `solarflux` (default, override via `MONGODB_DB` env var)

---

## Collections Overview

| Collection | TypeScript Type | Description |
|---|---|---|
| `users` | `User` | Application user accounts |
| `clients` | `Client` | Solar installation clients |
| `quotes` | `Quote` | Project quotes & job tracking |
| `inventory` | `InventoryItem` | Equipment & materials stock |
| `templates` | `DocTemplate` | Document (DOCX) templates |
| `companyDocuments` | `Record<string, unknown>` | Uploaded company documents |
| `teamMessages` | `TeamMessageThread` | Installer ↔ admin messaging |
| `installerReports` | `InstallerReport` | Daily / incident / time reports |
| `installerReminders` | `InstallerReminder` | Auto-generated installer reminders |
| `equipmentTrackingEntries` | `EquipmentTrackingEntry` | Per-job equipment consumption drafts |
| `smtpSettings` | `SmtpSettings` | SMTP configuration (single doc, id=`"default"`) |
| `emailTemplates` | `EmailTemplate` | Reusable email templates |

---

## Collection Schemas

### `users`
```jsonc
{
  "id": "string",           // UUID
  "username": "string",
  "password": "string",     // bcrypt hash
  "nickname": "string",
  "role": "SUPER_ADMIN | WAREHOUSEMAN | INSTALLER"
}
```

---

### `clients`
```jsonc
{
  "id": "string",
  "internalId": "string",          // "SI_xxxx" auto-generated
  "type": "Private | Corporate",
  "status": "LEAD | ACTIVE | CLOSED",
  "name": "string",
  "address": "string",
  "email": "string",
  "phone": "string",

  // Address details
  "country": "string?",
  "county": "string?",
  "city": "string?",
  "street": "string?",
  "streetNumber": "string?",
  "postalCode": "string?",

  // Private-specific
  "firstName": "string?",
  "lastName": "string?",
  "dateOfBirth": "string?",
  "cnp": "string?",

  // Corporate-specific
  "companyName": "string?",
  "taxId": "string?",
  "regNumber": "string?",
  "iban": "string?",
  "bankName": "string?",
  "representative": "string?",
  "representativeFirstName": "string?",
  "representativeLastName": "string?",
  "representativeRole": "string?",
  "website": "string?",

  "needs": "ClientNeed?",          // see sub-schema below
  "notes": "ClientNote[]?",
  "documents": "ClientDocument[]?",
  "archivedProjects": "ArchivedProject[]?"
}
```

**Embedded: `ClientNeed`**
```jsonc
{
  "description": "string?",
  "descriptionUpdatedAt": "Date?",
  "descriptionUpdatedBy": "string?",
  "projectName": "string?",
  "projectId": "string?",
  "siteCountry": "string?",
  "siteCounty": "string?",
  "siteCity": "string?",
  "siteStreet": "string?",
  "siteStreetNumber": "string?",
  "sitePostalCode": "string?",
  "selectedCfDocId": "string?",
  "selectedFacturaDocId": "string?",
  "connectionType": "Monofazat | Trifazat?",
  "roofType": "string?",
  "roofTypeOther": "string?",
  "groundingStatus": "string?",
  "selectedMountingSystem": "rail | minirail?",
  "rowCount": "number?",
  "rowDistribution": "{ [rowIndex: string]: number }?",
  "inverterKw": "number?",
  "selectedInverterId": "string?",
  "batteryKwh": "number?",
  "selectedBatteryId": "string?",
  "panelSizeType": "string?",
  "panelStockItemId": "string?",
  "panelKw": "number?",
  "panelCount": "number?",
  "storage": "string?",
  "technicalNotes": "string?",
  "siteImages": "ClientSiteImage[]?"
}
```

**Embedded: `ClientNote`**
```jsonc
{ "id": "string", "content": "string", "author": "string", "date": "Date" }
```

**Embedded: `ClientDocument`**
```jsonc
{
  "id": "string",
  "name": "string",
  "type": "CI | CF | Fact | CUI | Other",
  "description": "string?",
  "podNumber": "string?",
  "cfNumber": "string?",
  "cadNumber": "string?",
  "docAddress": "string?",
  "projectId": "string?",
  "projectName": "string?",
  "url": "string",          // Base64 or URL
  "date": "Date",
  "folder": "string?",
  "uploadedBy": "string?",
  "uploadedByRole": "SUPER_ADMIN | WAREHOUSEMAN | INSTALLER?"
}
```

---

### `quotes`
```jsonc
{
  "id": "string",
  "clientId": "string?",
  "title": "string?",
  "customerName": "string",
  "description": "string?",
  "date": "Date",
  "items": "QuoteLineItem[]",

  // Financials
  "subtotalNet": "number",        // RON, no VAT
  "vatTotal": "number",           // 21%
  "totalGross": "number",

  // Installer assignment
  "allocatedInstallerId": "string?",
  "allocatedAt": "Date?",
  "assignedInstallers": [{
    "installerId": "string",
    "installerNickname": "string",
    "assignedAt": "Date",
    "assignedBy": "string?"
  }],

  // Phase tracking
  "phase": "planning | in-progress | pending-inspection | completed | archived?",
  "phaseHistory": [{ "phase": "string", "timestamp": "Date", "changedBy": "string" }],
  "estimatedCompletionDate": "Date?",

  // Job completion
  "completedAt": "Date?",
  "completedBy": "string?",
  "consumptionData": "ConsumptionItem[]?",
  "consumptionDataUpdatedAt": "Date?",
  "consumptionDataUpdatedBy": "string?",
  "extraItems": "ConsumptionItem[]?",
  "completionNotes": "string?",
  "installationPhotos": "InstallationPhoto[]?",
  "materialVariances": "MaterialVariance[]?",
  "groundingValue": "string?",
  "lowVoltageCableCheck": "Corespunde | Nu corespunde?",
  "installerDeclaredFinishedAt": "Date?",
  "installerDeclaredFinishedBy": "string?",
  "installerMentions": [{ "id": "string", "message": "string", "createdAt": "Date", "createdBy": "string" }],

  // Admin approval
  "adminApprovedAt": "Date?",
  "adminApprovedBy": "string?",
  "adminApprovalNotes": "string?",

  // Reopen tracking
  "reopenedAt": "Date?",
  "reopenedBy": "string?",
  "reopenReason": "string?",
  "reopenHistory": [{ "reopenedAt": "Date", "reopenedBy": "string", "reopenReason": "string", "closedAgainAt": "Date?" }],

  // Email tracking
  "emailSentAt": "Date?",
  "emailSentTo": "string?",
  "emailSentBy": "string?",
  "emailHistory": [{ "sentAt": "Date", "sentTo": "string", "sentBy": "string", "documentName": "string?" }],

  // Generated documents
  "generatedDocuments": [{ "id": "string", "name": "string", "url": "string", "date": "Date", "generatedBy": "string?" }]
}
```

**Embedded: `QuoteLineItem`**
```jsonc
{
  "id": "string",
  "inventoryItemId": "string?",
  "description": "string",
  "unit": "string",
  "quantity": "number",
  "netPrice": "number",
  "selectedSerialNumbers": "string[]?"
}
```

**Embedded: `ConsumptionItem`**
```jsonc
{
  "id": "string",
  "description": "string",
  "quotedQty": "number",
  "consumedQty": "number",
  "actuallyUsed": "number?",
  "selectedSerialNumbers": "string[]?",
  "unit": "string",
  "netPrice": "number",
  "isExtra": "boolean?",
  "originalLineItemId": "string?",
  "inventoryItemId": "string?",
  "barcode": "string?",
  "hasBarcode": "boolean?"
}
```

---

### `inventory`
```jsonc
{
  "id": "string",
  "name": "string",
  "sku": "string",
  "barcode": "string",
  "category": "Solar Panels | Inverters | Batteries | Mounting | Electrical | Monitoring | Other",
  "quantity": "number",
  "minThreshold": "number",
  "buyPrice": "number",         // RON cost per unit
  "sellPrice": "number",        // RON selling price
  "location": "string",
  "specs": "string?",
  "powerW": "number?",          // Solar Panels: Watts
  "panelWidth": "number?",      // meters
  "panelHeight": "number?",     // meters
  "isRail": "boolean?",         // Mounting rail
  "railLengthM": "number?",
  "documents": {
    "dataSheet": "string?",
    "certificate": "string?",
    "dataSheetName": "string?",
    "certificateName": "string?"
  },
  "serialNumbers": "string[]?",
  // Battery-specific
  "batteryPowerKwh": "number?",
  "batteryType": "High Voltage | Low Voltage?",
  // Inverter-specific
  "inverterPowerKw": "number?",
  "inverterConnectionType": "Monofazat | Trifazat?",
  "inverterStorageType": "High Voltage | Low Voltage?"
}
```

---

### `templates`
```jsonc
{
  "id": "string",
  "name": "string",
  "content": "string",   // Base64-encoded DOCX
  "date": "Date"
}
```

---

### `companyDocuments`
Flexible schema for uploaded company documents:
```jsonc
{
  "id": "string",
  "name": "string",
  "url": "string",        // Base64 or URL (large field, stored in Firebase Storage)
  "date": "Date"
  // additional arbitrary fields
}
```

---

### `teamMessages`
```jsonc
{
  "id": "string",
  "installerId": "string",
  "installerNickname": "string",
  "updatedAt": "Date",
  "messages": [{
    "id": "string",
    "senderRole": "SUPER_ADMIN | WAREHOUSEMAN | INSTALLER",
    "senderName": "string",
    "message": "string",
    "createdAt": "Date",
    "readByAdmin": "boolean",
    "readByInstaller": "boolean",
    "quoteId": "string?"
  }]
}
```

---

### `installerReports`
```jsonc
{
  "id": "string",
  "installerId": "string",
  "createdByNickname": "string",
  "date": "Date",
  "type": "daily | incident | time",
  "createdAt": "Date",
  "data": "Record<string, unknown>"   // type-specific report payload
}
```

---

### `installerReminders`
```jsonc
{
  "id": "string",
  "installerId": "string",
  "installerNickname": "string",
  "quoteId": "string?",
  "quoteTitle": "string?",
  "reminderType": "MISSING_DAILY_REPORT",
  "reminderDate": "Date",
  "createdAt": "Date",
  "createdBy": "string",
  "message": "string",
  "isReadByInstaller": "boolean"
}
```

---

### `equipmentTrackingEntries`
```jsonc
{
  "id": "string",
  "quoteId": "string",
  "clientId": "string",
  "projectTitle": "string?",
  "workDate": "Date",
  "installerId": "string",
  "installerNickname": "string",
  "status": "draft | submitted",
  "items": "ConsumptionItem[]",
  "extraItems": "ConsumptionItem[]",
  "installationPhotos": "InstallationPhoto[]",
  "notes": "string?",
  "groundingValue": "string?",
  "lowVoltageCableCheck": "Corespunde | Nu corespunde?",
  "createdAt": "Date",
  "updatedAt": "Date",
  "submittedAt": "Date?"
}
```

---

### `smtpSettings`
Single document, always `id = "default"`:
```jsonc
{
  "id": "default",
  "host": "string",           // e.g. smtp.gmail.com
  "port": "number",           // 587 or 465
  "secure": "boolean",
  "username": "string",
  "password": "string",       // encrypted before storage
  "fromEmail": "string",
  "fromName": "string",
  "replyTo": "string?",
  "signature": "string?",     // HTML
  "updatedAt": "Date",
  "updatedBy": "string"
}
```

---

### `emailTemplates`
```jsonc
{
  "id": "string",
  "name": "string",
  "category": "quote | invoice | general | project",
  "subject": "string",        // supports {variable} placeholders
  "body": "string",           // HTML with placeholders
  "variables": "string[]",
  "createdAt": "Date",
  "updatedAt": "Date",
  "createdBy": "string",
  "updatedBy": "string"
}
```

---

## Notes

- Every document is identified by a string `id` field (not MongoDB's `_id`). All CRUD operations use `replaceOne({ id }, doc, { upsert: true })`.
- The generic API route `app/api/db/[collection]` serves: `inventory`, `clients`, `quotes`, `users`, `teamMessages`, `installerReports`, `installerReminders`, `equipmentTrackingEntries`, `templates`, `companyDocuments`.
- `smtpSettings` and `emailTemplates` have dedicated API routes under `app/api/settings/`.
- Currency: **RON**. VAT rate: **21%**.
- Internal client IDs use `SI_` prefix with auto-incrementing numbers.
