import {
  ConsumptionItem,
  EquipmentTrackingEntry,
  InstallationPhoto,
  MaterialVariance,
  Quote,
} from '@/types';

const normalizeDescription = (value?: string) =>
  (value || '')
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ');

export const startOfLocalDay = (date: Date) => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

export const toWorkDateKey = (date: Date) => {
  const normalized = startOfLocalDay(date);
  const year = normalized.getFullYear();
  const month = `${normalized.getMonth() + 1}`.padStart(2, '0');
  const day = `${normalized.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const buildEquipmentTrackingEntryId = (quoteId: string, installerId: string, workDate: Date) => {
  return `${quoteId}__${installerId}__${toWorkDateKey(workDate)}`;
};

export const findMatchingQuoteLineItem = (
  quote: Quote,
  trackedItem: Pick<ConsumptionItem, 'id' | 'description' | 'inventoryItemId' | 'originalLineItemId'>
) => {
  if (trackedItem.originalLineItemId) {
    const directMatch = quote.items.find((item) => item.id === trackedItem.originalLineItemId);
    if (directMatch) {
      return directMatch;
    }
  }

  const directIdMatch = quote.items.find((item) => item.id === trackedItem.id);
  if (directIdMatch) {
    return directIdMatch;
  }

  if (trackedItem.inventoryItemId) {
    const inventoryMatches = quote.items.filter((item) => item.inventoryItemId === trackedItem.inventoryItemId);
    if (inventoryMatches.length === 1) {
      return inventoryMatches[0];
    }
  }

  const normalizedTrackedDescription = normalizeDescription(trackedItem.description);
  if (!normalizedTrackedDescription) {
    return undefined;
  }

  const descriptionMatches = quote.items.filter(
    (item) => normalizeDescription(item.description) === normalizedTrackedDescription
  );

  if (descriptionMatches.length === 1) {
    return descriptionMatches[0];
  }

  return undefined;
};

export const aggregateEquipmentTrackingEntries = (quote: Quote, entries: EquipmentTrackingEntry[]) => {
  const aggregatedByItem = new Map<string, ConsumptionItem>();

  quote.items.forEach((item) => {
    aggregatedByItem.set(item.id, {
      id: item.id,
      description: item.description,
      quotedQty: item.quantity,
      consumedQty: 0,
      actuallyUsed: 0,
      selectedSerialNumbers: [],
      unit: item.unit,
      netPrice: item.netPrice,
      inventoryItemId: item.inventoryItemId,
    });
  });

  const serialsByItem = new Map<string, Set<string>>();
  const unmatchedExtraItems: ConsumptionItem[] = [];

  entries.forEach((entry) => {
    entry.items.forEach((trackedItem) => {
      const matchedQuoteItem = findMatchingQuoteLineItem(quote, trackedItem);

      if (!matchedQuoteItem) {
        unmatchedExtraItems.push({
          ...trackedItem,
          id: `${entry.id}__${trackedItem.id}`,
          quotedQty: 0,
          consumedQty: trackedItem.consumedQty || trackedItem.actuallyUsed || 0,
          actuallyUsed: trackedItem.consumedQty || trackedItem.actuallyUsed || 0,
          isExtra: true,
        });
        return;
      }

      const existing = aggregatedByItem.get(matchedQuoteItem.id);
      if (!existing) {
        aggregatedByItem.set(matchedQuoteItem.id, {
          id: matchedQuoteItem.id,
          description: matchedQuoteItem.description,
          quotedQty: matchedQuoteItem.quantity,
          consumedQty: trackedItem.consumedQty || trackedItem.actuallyUsed || 0,
          actuallyUsed: trackedItem.consumedQty || trackedItem.actuallyUsed || 0,
          selectedSerialNumbers: [...(trackedItem.selectedSerialNumbers || [])],
          unit: trackedItem.unit || matchedQuoteItem.unit,
          netPrice: trackedItem.netPrice || matchedQuoteItem.netPrice,
          inventoryItemId: trackedItem.inventoryItemId || matchedQuoteItem.inventoryItemId,
          barcode: trackedItem.barcode,
          hasBarcode: trackedItem.hasBarcode,
        });
        serialsByItem.set(matchedQuoteItem.id, new Set(trackedItem.selectedSerialNumbers || []));
        return;
      }

      const consumedQty = trackedItem.consumedQty || trackedItem.actuallyUsed || 0;
      existing.consumedQty += consumedQty;
      existing.actuallyUsed = existing.consumedQty;
      existing.barcode = existing.barcode || trackedItem.barcode;
      existing.hasBarcode = existing.hasBarcode || trackedItem.hasBarcode;
      existing.inventoryItemId = existing.inventoryItemId || trackedItem.inventoryItemId;

      const serialSet = serialsByItem.get(matchedQuoteItem.id) || new Set<string>();
      (trackedItem.selectedSerialNumbers || []).forEach((serial) => serialSet.add(serial));
      serialsByItem.set(matchedQuoteItem.id, serialSet);
    });
  });

  const consumptionData = Array.from(aggregatedByItem.values()).map((item) => ({
    ...item,
    selectedSerialNumbers: Array.from(serialsByItem.get(item.id) || []),
  }));

  const persistedExtraItems: ConsumptionItem[] = entries.flatMap((entry) =>
    entry.extraItems.map((item) => ({
      ...item,
      id: `${entry.id}__${item.id}`,
      isExtra: true,
    }))
  );

  const extraItems: ConsumptionItem[] = [...persistedExtraItems, ...unmatchedExtraItems].sort((a, b) =>
    a.description.localeCompare(b.description)
  );

  const installationPhotos = entries
    .flatMap((entry) => entry.installationPhotos || [])
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const latestEntry = [...entries].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];

  const materialVariances: MaterialVariance[] = quote.items.map((item) => {
    const aggregatedItem = consumptionData.find((trackedItem) => trackedItem.id === item.id);
    const consumedQty = aggregatedItem?.consumedQty || 0;
    const delta = consumedQty - item.quantity;
    return {
      itemId: item.id,
      description: item.description,
      quotedQty: item.quantity,
      consumedQty,
      delta,
      unit: item.unit,
      netPrice: item.netPrice,
      variance: delta * item.netPrice,
    };
  });

  return {
    consumptionData,
    extraItems,
    installationPhotos,
    materialVariances,
    completionNotes: latestEntry?.notes,
    groundingValue: latestEntry?.groundingValue,
    lowVoltageCableCheck: latestEntry?.lowVoltageCableCheck,
    consumptionDataUpdatedAt: latestEntry?.updatedAt,
    consumptionDataUpdatedBy: latestEntry?.installerNickname,
  };
};