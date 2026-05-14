import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

// ============================================================================
// MONGODB ATLAS KAPCSOLAT (SolarFlux)
// ============================================================================

let db;
let mongoClient;

async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }
    const mongoDb = process.env.MONGODB_DB || "solarflux";

    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();

    db = mongoClient.db(mongoDb);

    // Indexek létrehozása
    await db.collection("quotes").createIndex({ date: -1 }).catch(() => {});
    await db.collection("quotes").createIndex({ customerName: 1 }).catch(() => {});
    await db.collection("clients").createIndex({ name: 1 }).catch(() => {});
    await db.collection("clients").createIndex({ status: 1 }).catch(() => {});
    await db.collection("inventory").createIndex({ name: 1 }).catch(() => {});
    await db.collection("inventory").createIndex({ category: 1 }).catch(() => {});
    await db.collection("users").createIndex({ username: 1 }).catch(() => {});

    console.error("✅ MongoDB Atlas csatlakozva (solarflux)");
  } catch (error) {
    console.error("❌ MongoDB hiba:", error.message);
    process.exit(1);
  }
}

// ============================================================================
// MCP SERVER INICIALIZÁLÁS
// ============================================================================

const server = new Server({
  name: "solarflux-mcp-server",
  version: "2.0.0",
}, {
  capabilities: {
    tools: {}
  }
});

// ============================================================================
// TOOL HANDLERS
// ============================================================================

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFlexibleQuoteSearchOr(searchTerm) {
  const term = String(searchTerm || "").trim();
  if (!term) {
    return [];
  }

  const escapedTerm = escapeRegex(term);
  const tokens = term
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => escapeRegex(token));

  const or = [
    { customerName: { $regex: escapedTerm, $options: "i" } },
    { title: { $regex: escapedTerm, $options: "i" } },
    { id: { $regex: escapedTerm, $options: "i" } },
    { quoteId: { $regex: escapedTerm, $options: "i" } },
    { quoteNumber: { $regex: escapedTerm, $options: "i" } },
    { internalId: { $regex: escapedTerm, $options: "i" } },
  ];

  if (tokens.length > 1) {
    // Allow matching names in any order (e.g. "Ari Attila" vs "Attila Ari").
    or.push({
      $and: tokens.map((token) => ({
        customerName: { $regex: token, $options: "i" },
      })),
    });
  }

  return or;
}

// 1. AJÁNLATOK KERESÉSE
async function handleSearchQuotes(params) {
  const {
    customerName = null,
    clientName = null,
    searchTerm = null,
    quoteId = null,
    phase = null,
    limit = 20,
  } = params;

  let query = {};
  const effectiveSearchTerm = searchTerm || customerName || clientName || quoteId;

  if (effectiveSearchTerm) {
    const or = buildFlexibleQuoteSearchOr(effectiveSearchTerm);
    if (or.length > 0) {
      query.$or = or;
    }
  }

  if (phase) {
    query.phase = phase;
  }

  const quotes = await db
    .collection("quotes")
    .find(query)
    .sort({ date: -1 })
    .limit(limit)
    .toArray();

  if (quotes.length === 0) {
    return {
      success: false,
      message: "Nincsenek ajánlatok",
      results: [],
    };
  }

  return {
    success: true,
    count: quotes.length,
    results: quotes.map((q) => ({
      id: q.id,
      customerName: q.customerName,
      title: q.title,
      totalGross: q.totalGross,
      currency: q.currency || 'RON',
      phase: q.phase,
      date: q.date,
      allocatedInstallerId: q.allocatedInstallerId,
    })),
  };
}

// 2. AJÁNLAT LEKÉRÉSE TELJES ADATOKKAL
async function handleGetQuote(params) {
  const { quoteId } = params;

  if (!quoteId) {
    return { success: false, error: "Quote ID szükséges" };
  }

  try {
    const normalizedQuoteId = String(quoteId).trim();
    const numericQuoteId = Number(normalizedQuoteId);
    const hasNumericValue = !Number.isNaN(numericQuoteId);

    let quote = await db.collection("quotes").findOne({
      $or: [
        { id: normalizedQuoteId },
        ...(hasNumericValue ? [{ id: numericQuoteId }] : []),
        { quoteId: normalizedQuoteId },
        { quoteNumber: normalizedQuoteId },
        { internalId: normalizedQuoteId },
      ],
    });

    if (!quote) {
      const escapedQuoteId = escapeRegex(normalizedQuoteId);
      quote = await db.collection("quotes").findOne({
        $or: [
          { id: { $regex: escapedQuoteId, $options: "i" } },
          { quoteId: { $regex: escapedQuoteId, $options: "i" } },
          { quoteNumber: { $regex: escapedQuoteId, $options: "i" } },
          { internalId: { $regex: escapedQuoteId, $options: "i" } },
          { customerName: { $regex: escapedQuoteId, $options: "i" } },
          { title: { $regex: escapedQuoteId, $options: "i" } },
        ],
      });
    }

    if (!quote) {
      return { success: false, error: "Ajánlat nem található" };
    }

    return {
      success: true,
      quote: {
        id: quote.id,
        clientId: quote.clientId,
        projectId: quote.projectId,
        customerName: quote.customerName,
        title: quote.title,
        description: quote.description,
        date: quote.date,
        currency: quote.currency || 'RON',
        validityDays: quote.validityDays,
        items: quote.items || [],
        subtotalNet: quote.subtotalNet,
        vatTotal: quote.vatTotal,
        totalGross: quote.totalGross,
        phase: quote.phase,
        phaseHistory: quote.phaseHistory || [],
        estimatedCompletionDate: quote.estimatedCompletionDate,
        allocatedInstallerId: quote.allocatedInstallerId,
        allocatedAt: quote.allocatedAt,
        assignedInstallers: quote.assignedInstallers || [],
        completedAt: quote.completedAt,
        completedBy: quote.completedBy,
        completionNotes: quote.completionNotes,
        adminApprovedAt: quote.adminApprovedAt,
        adminApprovedBy: quote.adminApprovedBy,
        adminApprovalNotes: quote.adminApprovalNotes,
        shareToken: quote.shareToken,
        publicLinkSentAt: quote.publicLinkSentAt,
        publicLinkOpenCount: quote.publicLinkOpenCount,
        isLocked: quote.isLocked,
        paymentStatus: quote.paymentStatus,
        payments: quote.payments || [],
        emailSentAt: quote.emailSentAt,
        emailSentTo: quote.emailSentTo,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 3. KLIENS KERESÉSE
async function handleSearchClients(params) {
  const { name = null, status = null, type = null, limit = 20 } = params;

  let query = {};

  if (name) {
    query.name = { $regex: name, $options: "i" };
  }

  if (status) {
    query.status = status;
  }

  if (type) {
    query.type = type;
  }

  const clients = await db
    .collection("clients")
    .find(query)
    .limit(limit)
    .toArray();

  if (clients.length === 0) {
    return {
      success: false,
      message: "Nincsenek kliens találatok",
      results: [],
    };
  }

  return {
    success: true,
    count: clients.length,
    results: clients.map((c) => ({
      id: c.id,
      internalId: c.internalId,
      name: c.name,
      type: c.type,
      status: c.status,
      email: c.email,
      phone: c.phone,
      address: c.address,
    })),
  };
}

// 4. KLIENS LEKÉRÉSE TELJES ADATOKKAL
async function handleGetClient(params) {
  const { clientId } = params;

  if (!clientId) {
    return { success: false, error: "Client ID szükséges" };
  }

  try {
    const client = await db
      .collection("clients")
      .findOne({ id: clientId });

    if (!client) {
      return { success: false, error: "Kliens nem található" };
    }

    return {
      success: true,
      client: {
        id: client.id,
        internalId: client.internalId,
        name: client.name,
        type: client.type,
        status: client.status,
        email: client.email,
        phone: client.phone,
        address: client.address,
        needs: client.needs || {},
        notes: client.notes || [],
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 5. KÉSZLET KERESÉSE
async function handleSearchInventory(params) {
  const { searchTerm = null, category = null, limit = 20 } = params;

  let query = {};

  if (searchTerm) {
    query.$or = [
      { name: { $regex: searchTerm, $options: "i" } },
      { sku: { $regex: searchTerm, $options: "i" } },
    ];
  }

  if (category) {
    query.category = { $regex: category, $options: "i" };
  }

  const items = await db
    .collection("inventory")
    .find(query)
    .limit(limit)
    .toArray();

  if (items.length === 0) {
    return {
      success: false,
      message: "Nincsenek készlet találatok",
      results: [],
    };
  }

  return {
    success: true,
    count: items.length,
    results: items.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category,
      quantity: item.quantity,
      buyPrice: item.buyPrice,
      sellPrice: item.sellPrice,
      specs: item.specs,
      powerW: item.powerW,
      location: item.location,
    })),
  };
}

// 6. SZÁLLÍTÓ LEKÉRÉSE
async function handleGetInventoryItem(params) {
  const { itemId } = params;

  if (!itemId) {
    return { success: false, error: "Item ID szükséges" };
  }

  try {
    const item = await db
      .collection("inventory")
      .findOne({ id: itemId });

    if (!item) {
      return { success: false, error: "Készlet item nem található" };
    }

    return {
      success: true,
      item: {
        id: item.id,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        category: item.category,
        quantity: item.quantity,
        minThreshold: item.minThreshold,
        buyPrice: item.buyPrice,
        sellPrice: item.sellPrice,
        specs: item.specs,
        powerW: item.powerW,
        location: item.location,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 7. AJÁNLAT MÓDOSÍTÁSA
async function handleUpdateQuotePhase(params) {
  const { quoteId, newPhase } = params;

  const validPhases = [
    "planning",
    "in-progress",
    "pending-inspection",
    "completed",
    "archived",
  ];

  if (!quoteId || !newPhase) {
    return {
      success: false,
      error: "Quote ID és új fázis szükséges",
    };
  }

  if (!validPhases.includes(newPhase)) {
    return {
      success: false,
      error: `Érvényes fázisok: ${validPhases.join(", ")}`,
    };
  }

  try {
    const result = await db
      .collection("quotes")
      .findOneAndUpdate(
        { id: quoteId },
        {
          $set: { phase: newPhase },
          $push: {
            phaseHistory: {
              phase: newPhase,
              timestamp: new Date(),
            },
          },
        },
        { returnDocument: "after" }
      );

    if (!result) {
      return { success: false, error: "Ajánlat nem található" };
    }

    return {
      success: true,
      message: `Ajánlat fázisa módosítva: ${newPhase}`,
      quote: result,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 8. ÜZENETEK LEKÉRÉSE
async function handleGetTeamMessages(params) {
  const { installerId = null, limit = 50 } = params;

  let query = {};

  if (installerId) {
    query.installerId = installerId;
  }

  const messages = await db
    .collection("teamMessages")
    .find(query)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();

  return {
    success: true,
    count: messages.length,
    messages: messages.map((m) => ({
      id: m.id,
      installerId: m.installerId,
      installerNickname: m.installerNickname,
      messageCount: m.messages ? m.messages.length : 0,
      updatedAt: m.updatedAt,
    })),
  };
}

// 9. TELEPÍTŐ LEKÉRÉSE
async function handleGetUser(params) {
  const { userId } = params;

  if (!userId) {
    return { success: false, error: "User ID szükséges" };
  }

  try {
    const user = await db
      .collection("users")
      .findOne({ id: userId });

    if (!user) {
      return { success: false, error: "Felhasználó nem található" };
    }

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 10. TELEPÍTŐK LISTÁZÁSA
async function handleListUsers(params) {
  const { role = null, limit = 20 } = params;

  let query = {};

  if (role) {
    query.role = role;
  }

  const users = await db
    .collection("users")
    .find(query)
    .limit(limit)
    .toArray();

  return {
    success: true,
    count: users.length,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      nickname: u.nickname,
      role: u.role,
    })),
  };
}

// 11. ADATBÁZIS STATISZTIKA
async function handleGetStats(params) {
  try {
    const quoteCount = await db.collection("quotes").countDocuments();
    const clientCount = await db.collection("clients").countDocuments();
    const inventoryCount = await db
      .collection("inventory")
      .countDocuments();
    const userCount = await db.collection("users").countDocuments();

    const quotesByPhase = await db
      .collection("quotes")
      .aggregate([
        { $group: { _id: "$phase", count: { $sum: 1 } } },
      ])
      .toArray();

    const quotesByStatus = await db
      .collection("quotes")
      .aggregate([
        {
          $group: {
            _id: null,
            totalValue: { $sum: "$totalGross" },
            averageValue: { $avg: "$totalGross" },
          },
        },
      ])
      .toArray();

    return {
      success: true,
      stats: {
        quotes: quoteCount,
        clients: clientCount,
        inventory: inventoryCount,
        users: userCount,
        quotesByPhase: quotesByPhase.reduce((acc, item) => {
          acc[item._id || "unknown"] = item.count;
          return acc;
        }, {}),
        totalQuoteValue: quotesByStatus[0]?.totalValue || 0,
        averageQuoteValue:
          Math.round(
            (quotesByStatus[0]?.averageValue || 0) * 100
          ) / 100,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 12. KLIENS SZÜKSÉGLETEI SZERKESZTÉSE
async function handleUpdateClientNeeds(params) {
  const { clientId, needs } = params;

  if (!clientId || !needs) {
    return {
      success: false,
      error: "Client ID és szükségletek szükségesek",
    };
  }

  try {
    const result = await db
      .collection("clients")
      .findOneAndUpdate(
        { id: clientId },
        {
          $set: { needs },
        },
        { returnDocument: "after" }
      );

    if (!result) {
      return { success: false, error: "Kliens nem található" };
    }

    return {
      success: true,
      message: "Kliens szükségletei frissítve",
      client: result,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 13. AJÁNLAT TÉTELEK LEKÉRÉSE
async function handleGetQuoteLineItems(params) {
  const { quoteId } = params;

  if (!quoteId) {
    return { success: false, error: "Quote ID szükséges" };
  }

  try {
    const quote = await db
      .collection("quotes")
      .findOne({ id: quoteId });

    if (!quote) {
      return { success: false, error: "Ajánlat nem található" };
    }

    const items = quote.items || [];

    return {
      success: true,
      quoteId,
      itemCount: items.length,
      items: items.map((item) => ({
        id: item.id,
        description: item.description,
        unit: item.unit,
        quantity: item.quantity,
        netPrice: item.netPrice,
        total: item.quantity * item.netPrice,
      })),
      subtotalNet: quote.subtotalNet,
      vatTotal: quote.vatTotal,
      totalGross: quote.totalGross,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 14. TELEÍTŐ HOZZÁRENDELÉSE AJÁNLATHOZ
async function handleAssignInstallerToQuote(params) {
  const { quoteId, installerId, installerNickname } = params;

  if (!quoteId || !installerId) {
    return {
      success: false,
      error: "Quote ID és Installer ID szükséges",
    };
  }

  try {
    const result = await db
      .collection("quotes")
      .findOneAndUpdate(
        { id: quoteId },
        {
          $set: { allocatedInstallerId: installerId },
          $push: {
            assignedInstallers: {
              installerId,
              installerNickname: installerNickname || "Unknown",
              assignedAt: new Date(),
            },
          },
        },
        { returnDocument: "after" }
      );

    if (!result) {
      return { success: false, error: "Ajánlat nem található" };
    }

    return {
      success: true,
      message: `Telepítő hozzárendelve: ${installerNickname || installerId}`,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 15. KÉSZLET ALACSONY SZINTEK
async function handleGetLowStockItems(params) {
  try {
    const items = await db
      .collection("inventory")
      .find({ $expr: { $lt: ["$quantity", "$minThreshold"] } })
      .toArray();

    return {
      success: true,
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        currentQuantity: item.quantity,
        minThreshold: item.minThreshold,
        shortage: item.minThreshold - item.quantity,
        category: item.category,
      })),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 16. KLIENS AJÁNLATAI
async function handleGetClientQuotes(params) {
  const { clientId = null, clientName = null, limit = 20 } = params;

  if (!clientId && !clientName) {
    return { success: false, error: "clientId vagy clientName szükséges" };
  }

  try {
    let nameForSearch = clientName;

    // Ha clientId van, először megkeressük a kliens nevét
    if (clientId && !clientName) {
      const client = await db.collection("clients").findOne({ id: clientId });
      if (!client) {
        return { success: false, error: "Kliens nem található" };
      }
      nameForSearch = client.name;
    }

    const or = buildFlexibleQuoteSearchOr(nameForSearch);
    const quotes = await db
      .collection("quotes")
      .find(or.length > 0 ? { $or: or } : {})
      .sort({ date: -1 })
      .limit(limit)
      .toArray();

    return {
      success: true,
      clientName: nameForSearch,
      count: quotes.length,
      quotes: quotes.map((q) => ({
        id: q.id,
        customerName: q.customerName,
        title: q.title,
        totalGross: q.totalGross,
        currency: q.currency || 'RON',
        phase: q.phase,
        date: q.date,
        allocatedInstallerId: q.allocatedInstallerId,
        itemCount: q.items ? q.items.length : 0,
      })),
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// TOOL REGISZTRÁCIÓ
// ============================================================================

const tools = [
  {
    name: "search_quotes",
    description:
      "Ajánlatok keresése ügyfél neve vagy fázis alapján",
    inputSchema: {
      type: "object",
      properties: {
        customerName: {
          type: "string",
          description: "Ügyfél nevének keresése",
        },
        clientName: {
          type: "string",
          description: "Alias: ügyfél neve kereséshez",
        },
        searchTerm: {
          type: "string",
          description: "Általános keresőszó (név, quote ID, cím)",
        },
        quoteId: {
          type: "string",
          description: "Ajánlat azonosító vagy kód",
        },
        phase: {
          type: "string",
          description:
            "Fázis szűrés: planning, in-progress, pending-inspection, completed, archived",
        },
        limit: {
          type: "number",
          description: "Max eredmények száma",
        },
      },
    },
  },
  {
    name: "get_quote",
    description: "Ajánlat teljes adatainak lekérése",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: {
          type: "string",
          description: "Ajánlat ID",
        },
      },
      required: ["quoteId"],
    },
  },
  {
    name: "get_quote_line_items",
    description: "Ajánlat összes tételének lekérése",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: {
          type: "string",
          description: "Ajánlat ID",
        },
      },
      required: ["quoteId"],
    },
  },
  {
    name: "search_clients",
    description: "Kliens keresése név, státusz vagy típus alapján",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Kliens neve",
        },
        status: {
          type: "string",
          description: "LEAD, ACTIVE, CLOSED",
        },
        type: {
          type: "string",
          description: "Private vagy Corporate",
        },
        limit: {
          type: "number",
          description: "Max eredmények",
        },
      },
    },
  },
  {
    name: "get_client",
    description: "Kliens teljes adatainak lekérése",
    inputSchema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "Kliens ID",
        },
      },
      required: ["clientId"],
    },
  },
  {
    name: "update_client_needs",
    description: "Kliens szükségleteinek frissítése",
    inputSchema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "Kliens ID",
        },
        needs: {
          type: "object",
          description: "Szükségletek objektum",
        },
      },
      required: ["clientId", "needs"],
    },
  },
  {
    name: "search_inventory",
    description: "Készlet keresése név vagy kategória alapján",
    inputSchema: {
      type: "object",
      properties: {
        searchTerm: {
          type: "string",
          description: "Keresési szöveg",
        },
        category: {
          type: "string",
          description:
            "Solar Panels, Inverters, Batteries, Mounting, Electrical, Monitoring, Other",
        },
        limit: {
          type: "number",
          description: "Max eredmények",
        },
      },
    },
  },
  {
    name: "get_inventory_item",
    description: "Készlet item teljes adatai",
    inputSchema: {
      type: "object",
      properties: {
        itemId: {
          type: "string",
          description: "Item ID",
        },
      },
      required: ["itemId"],
    },
  },
  {
    name: "get_low_stock_items",
    description: "Alacsony készleten lévő termékek",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "update_quote_phase",
    description: "Ajánlat fázisának módosítása",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: {
          type: "string",
          description: "Ajánlat ID",
        },
        newPhase: {
          type: "string",
          description:
            "Új fázis: planning, in-progress, pending-inspection, completed, archived",
        },
      },
      required: ["quoteId", "newPhase"],
    },
  },
  {
    name: "assign_installer_to_quote",
    description: "Telepítő hozzárendelése ajánlathoz",
    inputSchema: {
      type: "object",
      properties: {
        quoteId: {
          type: "string",
          description: "Ajánlat ID",
        },
        installerId: {
          type: "string",
          description: "Telepítő ID",
        },
        installerNickname: {
          type: "string",
          description: "Telepítő beceneve",
        },
      },
      required: ["quoteId", "installerId"],
    },
  },
  {
    name: "get_team_messages",
    description: "Csapat üzenetek lekérése",
    inputSchema: {
      type: "object",
      properties: {
        installerId: {
          type: "string",
          description: "Telepítő ID szűréshez",
        },
        limit: {
          type: "number",
          description: "Max üzenetek",
        },
      },
    },
  },
  {
    name: "get_user",
    description: "Felhasználó adatai ID alapján",
    inputSchema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "Felhasználó ID",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "list_users",
    description: "Felhasználók listázása (telepítők, adminok)",
    inputSchema: {
      type: "object",
      properties: {
        role: {
          type: "string",
          description: "SUPER_ADMIN, WAREHOUSEMAN, INSTALLER",
        },
        limit: {
          type: "number",
          description: "Max felhasználók",
        },
      },
    },
  },
  {
    name: "get_client_quotes",
    description:
      "Kliens összes ajánlatának lekérése kliens neve vagy ID alapján. Használd ha valaki ajánlatait keresed.",
    inputSchema: {
      type: "object",
      properties: {
        clientId: {
          type: "string",
          description: "Kliens ID (opcionális ha clientName meg van adva)",
        },
        clientName: {
          type: "string",
          description: "Kliens neve (pl. 'Ari Attila') - részleges egyezés is működik",
        },
        limit: {
          type: "number",
          description: "Max ajánlatok száma",
        },
      },
    },
  },
  {
    name: "get_stats",
    description: "Adatbázis statisztikái és összegzések",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`📞 Tool hívás: ${name}`, args);

  let result;

  switch (name) {
    case "search_quotes":
      result = await handleSearchQuotes(args);
      break;
    case "get_quote":
      result = await handleGetQuote(args);
      break;
    case "get_quote_line_items":
      result = await handleGetQuoteLineItems(args);
      break;
    case "search_clients":
      result = await handleSearchClients(args);
      break;
    case "get_client":
      result = await handleGetClient(args);
      break;
    case "update_client_needs":
      result = await handleUpdateClientNeeds(args);
      break;
    case "search_inventory":
      result = await handleSearchInventory(args);
      break;
    case "get_inventory_item":
      result = await handleGetInventoryItem(args);
      break;
    case "get_low_stock_items":
      result = await handleGetLowStockItems(args);
      break;
    case "update_quote_phase":
      result = await handleUpdateQuotePhase(args);
      break;
    case "assign_installer_to_quote":
      result = await handleAssignInstallerToQuote(args);
      break;
    case "get_team_messages":
      result = await handleGetTeamMessages(args);
      break;
    case "get_user":
      result = await handleGetUser(args);
      break;
    case "list_users":
      result = await handleListUsers(args);
      break;
    case "get_client_quotes":
      result = await handleGetClientQuotes(args);
      break;
    case "get_stats":
      result = await handleGetStats(args);
      break;
    default:
      result = { error: `Ismeretlen tool: ${name}` };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
});

// ============================================================================
// SZERVER INDÍTÁSA
// ============================================================================

async function main() {
  await connectDatabase();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("🚀 SolarFlux MCP Server indult (stdio módban)");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.error("\n📴 Szerver leállítása...");
  if (mongoClient) {
    await mongoClient.close();
  }
  process.exit(0);
});
