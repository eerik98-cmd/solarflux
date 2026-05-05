# 🌞 SolarFlux MCP Server

Claudé AI-hoz készült MCP Server az SolarFlux napelem telepítési rendszer MongoDB Atlas adatbázisához.

## 📦 Mit Tartalmaz?

- ✅ **15 professzionális eszköz (tool)** az SolarFlux adatok kezeléséhez
- ✅ **MongoDB Atlas integráció** (már csatlakoztatva!)
- ✅ **Ajánlat kezelés** (keresés, módosítás, telepítő hozzárendelés)
- ✅ **Kliens kezelés** (keresés, szükségletek szerkesztése)
- ✅ **Készlet nyilvántartás** (keresés, alacsony szintek)
- ✅ **Telepítő kezelés** (listázás, üzenetváltás)
- ✅ **Statisztikák és riportok**

## 🚀 Claude Desktop konfigurálása

**macOS/Linux:**
```bash
nano ~/.config/Claude/claude_desktop_config.json
```

**Beillesztés:**
```json
{
  "mcpServers": {
    "solarflux-mcp": {
      "command": "node",
      "args": ["/FULL/PATH/TO/solarflux-mcp/src/index.js"],
      "env": {
        "MONGODB_URI": "REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE",
        "MONGODB_DB": "REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE_REPLACE"
      }
    }
  }
}
```

**⚠️ Fontos:** `/FULL/PATH/TO/` helyére az abszolút útvonalat írj!

---

## 🔧 Rendelkezésre álló Eszközök (15 Tool)

### Ajánlatok (Quotes)

#### 1. `search_quotes`
Ajánlatok keresése ügyfél nevével vagy fázissal.
```javascript
{
  "customerName": "Kovács",
  "phase": "in-progress",
  "limit": 20
}
```

#### 2. `get_quote`
Ajánlat teljes adatainak lekérése.
```javascript
{
  "quoteId": "quote_12345"
}
```

#### 3. `get_quote_line_items`
Ajánlat összes tételének lekérése.
```javascript
{
  "quoteId": "quote_12345"
}
```

#### 4. `update_quote_phase`
Ajánlat fázisának módosítása.
```javascript
{
  "quoteId": "quote_12345",
  "newPhase": "completed"  // planning, in-progress, pending-inspection, completed, archived
}
```

#### 5. `assign_installer_to_quote`
Telepítő hozzárendelése ajánlathoz.
```javascript
{
  "quoteId": "quote_12345",
  "installerId": "installer_001",
  "installerNickname": "János"
}
```

---

### Kliens Kezelés (Clients)

#### 6. `search_clients`
Kliens keresése név, státusz vagy típus alapján.
```javascript
{
  "name": "Péter",
  "status": "ACTIVE",  // LEAD, ACTIVE, CLOSED
  "type": "Private",    // Private, Corporate
  "limit": 20
}
```

#### 7. `get_client`
Kliens teljes adatai.
```javascript
{
  "clientId": "client_12345"
}
```

#### 8. `update_client_needs`
Kliens szükségleteinek szerkesztése (napelem teljesítmény, panel típus, stb.).
```javascript
{
  "clientId": "client_12345",
  "needs": {
    "inverterKw": 10,
    "panelKw": 8,
    "panelCount": 20,
    "batteryKwh": 10
  }
}
```

---

### Készlet Nyilvántartás (Inventory)

#### 9. `search_inventory`
Készlet keresése név vagy kategória alapján.
```javascript
{
  "searchTerm": "napelem",
  "category": "Solar Panels",  // Solar Panels, Inverters, Batteries, Mounting, etc.
  "limit": 20
}
```

#### 10. `get_inventory_item`
Készlet item teljes adatai.
```javascript
{
  "itemId": "inv_12345"
}
```

#### 11. `get_low_stock_items`
Alacsony készleten lévő termékek (alatt az minimális küszöbnek).
```javascript
{}
```

---

### Felhasználók és Üzenetek (Users)

#### 12. `list_users`
Felhasználók listázása (telepítők, adminok, raktárosok).
```javascript
{
  "role": "INSTALLER",  // SUPER_ADMIN, WAREHOUSEMAN, INSTALLER
  "limit": 20
}
```

#### 13. `get_user`
Felhasználó adatai.
```javascript
{
  "userId": "user_12345"
}
```

#### 14. `get_team_messages`
Csapat üzenetek (telepítő ↔ admin beszélgetések).
```javascript
{
  "installerId": "installer_001",
  "limit": 50
}
```

---

### Statisztikák

#### 15. `get_stats`
Adatbázis statisztikái (ajánlatok száma, klensiek, készlet, stb.).
```javascript
{}
```

---

## 💡 Példa Claude Parancsok

### 1. Ajánlatok Áttekintése
```
Adj egy rövid összefoglalót az összes "in-progress" 
ajánlatokról. Hány van belőlük és mi az össz értékük?
```

### 2. Kliens Szükségletei
```
Nézd meg az "SI_0001" kliens szükségleteit. 
Ha nincs értékük, javasolj egy 10kW-os napelem rendszert.
```

### 3. Készlet Status
```
Mely termékek vannak alacsony készleten? 
Adj egy lista a hiányzó mennyiségekkel.
```

### 4. Telepítő Hozzárendelés
```
Keress egy "planning" fázisban lévő ajánlatot, 
és rendelj hozzá egy "INSTALLER" szerepű telepítőt.
```

### 5. Statisztikák
```
Adj statisztikákat az SolarFlux rendszerről. 
Hány ajánlat, kliens és készlet cikk van?
```

---

## 🔐 Adatbázis Modell

Az MCP Server a következő SolarFlux kollekciókat kezeli:

- **quotes** - Napelem ajánlatok és munkák
- **clients** - Ügyfelek (magánszemélyek és vállalatok)
- **inventory** - Készlet (napelemek, invertálók, akkumulátorok, stb.)
- **users** - Felhasználók (telepítők, adminok, raktárosok)
- **teamMessages** - Üzenetek telepítők és adminok között
- **installerReports** - Telepítő riportok

Nem kezeli (nem szükséges Claude-hoz):
- templates
- companyDocuments
- installerReminders
- equipmentTrackingEntries
- smtpSettings
- emailTemplates

---

## 📖 MongoDB Schema

Az adatbázis sema részletesen dokumentálva van a `MONGODB_SCHEMA.md` fájlban.

**Fontos mezők:**

### Quote (Ajánlat)
```javascript
{
  id: "string",
  customerName: "string",
  phase: "planning|in-progress|pending-inspection|completed|archived",
  items: [ { description, quantity, netPrice } ],
  totalGross: "number (RON)",
  allocatedInstallerId: "string?",
  completedAt: "Date?"
}
```

### Client (Kliens)
```javascript
{
  id: "string",
  internalId: "SI_xxxx",
  name: "string",
  type: "Private|Corporate",
  status: "LEAD|ACTIVE|CLOSED",
  needs: {
    inverterKw: "number?",
    panelKw: "number?",
    batteryKwh: "number?"
  }
}
```

### InventoryItem (Készlet)
```javascript
{
  id: "string",
  name: "string",
  sku: "string",
  category: "Solar Panels|Inverters|Batteries|...",
  quantity: "number",
  minThreshold: "number",
  sellPrice: "number (RON)"
}
```

---

## 📞 Manuális testelés

1. {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}
   - jön válasz
2. {"jsonrpc":"2.0","method":"notifications/initialized"}
   - nem jön válsz
3. {"jsonrpc": "2.0", "id": 3, "method": "tools/list", "params": {}}

---


**Gratulálok! Most már van egy működő SolarFlux MCP Servered Claude-hoz!** 🚀

Próbáld ki ezt:
```
"Keress összes "planning" fázisban lévő ajánlatot, 
és rendelj hozzá egy telepítőt!"
```
