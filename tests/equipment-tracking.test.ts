/**
 * Equipment List & Usage Tracking Tests
 * Tests for the installer equipment tracking functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  aggregateEquipmentTrackingEntries,
  buildEquipmentTrackingEntryId,
  findMatchingQuoteLineItem,
  toWorkDateKey,
} from '../lib/equipmentTracking';
import { EquipmentTrackingEntry, Quote } from '../types';

// Mock data for testing
const mockEquipmentItems = [
  {
    id: 'item-1',
    description: 'Solar Panel 400W',
    unit: 'pcs',
    quantity: 10,
    actuallyUsed: 10,
    netPrice: 2000,
    barcode: 'SN001',
    hasBarcode: true,
  },
  {
    id: 'item-2',
    description: 'Mounting Rails 6m',
    unit: 'pcs',
    quantity: 20,
    actuallyUsed: 18,
    netPrice: 150,
    barcode: 'RAIL001',
    hasBarcode: true,
  },
  {
    id: 'item-3',
    description: 'End Clamps',
    unit: 'pcs',
    quantity: 40,
    actuallyUsed: 42,
    netPrice: 50,
    hasBarcode: false,
  },
];

describe('Equipment List & Usage Tracking', () => {
  
  describe('Variance Calculation', () => {
    
    it('should calculate positive variance when more is used than quoted', () => {
      const item = mockEquipmentItems[2]; // End Clamps: 42 used vs 40 quoted
      const quoted = item.quantity;
      const actual = item.actuallyUsed || 0;
      const diff = actual - quoted; // 2
      const valueDiff = diff * item.netPrice; // 2 * 50 = 100
      
      expect(diff).toBe(2);
      expect(valueDiff).toBe(100);
    });
    
    it('should calculate negative variance when less is used than quoted', () => {
      const item = mockEquipmentItems[1]; // Rails: 18 used vs 20 quoted
      const quoted = item.quantity;
      const actual = item.actuallyUsed || 0;
      const diff = actual - quoted; // -2
      const valueDiff = diff * item.netPrice; // -2 * 150 = -300
      
      expect(diff).toBe(-2);
      expect(valueDiff).toBe(-300);
    });
    
    it('should calculate zero variance when actual equals quoted', () => {
      const item = mockEquipmentItems[0]; // Panels: 10 used vs 10 quoted
      const quoted = item.quantity;
      const actual = item.actuallyUsed || 0;
      const diff = actual - quoted; // 0
      const valueDiff = diff * item.netPrice; // 0 * 2000 = 0
      
      expect(diff).toBe(0);
      expect(valueDiff).toBe(0);
    });
    
  });
  
  describe('Summary Calculations', () => {
    
    it('should calculate original quote total correctly', () => {
      const originalQuoteTotal = mockEquipmentItems.reduce(
        (sum, item) => sum + (item.quantity * item.netPrice),
        0
      );
      
      const expected = (10 * 2000) + (20 * 150) + (40 * 50); // 26000
      expect(originalQuoteTotal).toBe(expected);
    });
    
    it('should calculate actual consumption total correctly', () => {
      const actualConsumptionTotal = mockEquipmentItems.reduce(
        (sum, item) => sum + ((item.actuallyUsed || 0) * item.netPrice),
        0
      );
      
      const expected = (10 * 2000) + (18 * 150) + (42 * 50); // 26000 + (-300) + (100) = 25800
      expect(actualConsumptionTotal).toBe(expected);
    });
    
    it('should calculate equipment variance correctly', () => {
      const originalQuoteTotal = mockEquipmentItems.reduce(
        (sum, item) => sum + (item.quantity * item.netPrice),
        0
      );
      const actualConsumptionTotal = mockEquipmentItems.reduce(
        (sum, item) => sum + ((item.actuallyUsed || 0) * item.netPrice),
        0
      );
      const equipmentVariance = actualConsumptionTotal - originalQuoteTotal;
      
      expect(equipmentVariance).toBe(-200); // -300 + 100 = -200
    });
    
  });
  
  describe('Extra Items Management', () => {
    
    let extraItems: any[] = [];
    
    beforeEach(() => {
      extraItems = [];
    });
    
    it('should add extra items', () => {
      const newItem = {
        id: `extra-${Date.now()}`,
        description: 'Additional hardware',
        unit: 'pcs',
        quantity: 5,
        netPrice: 100,
      };
      extraItems.push(newItem);
      
      expect(extraItems).toHaveLength(1);
      expect(extraItems[0].description).toBe('Additional hardware');
    });
    
    it('should calculate extra items total', () => {
      extraItems.push(
        { id: 'extra-1', description: 'Item 1', unit: 'pcs', quantity: 5, netPrice: 100 },
        { id: 'extra-2', description: 'Item 2', unit: 'pcs', quantity: 3, netPrice: 50 }
      );
      
      const extraItemsTotal = extraItems.reduce(
        (sum, item) => sum + ((item.quantity || 0) * (item.netPrice || 0)),
        0
      );
      
      expect(extraItemsTotal).toBe(650); // (5 * 100) + (3 * 50)
    });
    
    it('should remove extra items', () => {
      extraItems.push(
        { id: 'extra-1', description: 'Item 1', unit: 'pcs', quantity: 5, netPrice: 100 },
        { id: 'extra-2', description: 'Item 2', unit: 'pcs', quantity: 3, netPrice: 50 }
      );
      
      expect(extraItems).toHaveLength(2);
      
      extraItems = extraItems.filter(item => item.id !== 'extra-1');
      
      expect(extraItems).toHaveLength(1);
      expect(extraItems[0].id).toBe('extra-2');
    });
    
  });
  
  describe('Total Project Variance', () => {
    
    it('should calculate total variance with equipment and extra items', () => {
      const equipmentVariance = -200; // From previous test
      const extraItems = [
        { id: 'extra-1', quantity: 5, netPrice: 100 },
        { id: 'extra-2', quantity: 3, netPrice: 50 }
      ];
      const extraItemsTotal = 650;
      
      const totalVariance = equipmentVariance + extraItemsTotal;
      
      expect(totalVariance).toBe(450); // -200 + 650
    });
    
    it('should correctly identify savings', () => {
      const equipmentVariance = -500;
      const extraItemsTotal = 0;
      const totalVariance = equipmentVariance + extraItemsTotal;
      
      expect(totalVariance).toBeLessThan(0);
    });
    
    it('should correctly identify overages', () => {
      const equipmentVariance = 300;
      const extraItemsTotal = 200;
      const totalVariance = equipmentVariance + extraItemsTotal;
      
      expect(totalVariance).toBeGreaterThan(0);
    });
    
  });
  
  describe('Quantity Tracking', () => {
    
    it('should update quantity when changed', () => {
      let item = { ...mockEquipmentItems[0], actuallyUsed: 10 };
      expect(item.actuallyUsed).toBe(10);
      
      item.actuallyUsed = 12;
      expect(item.actuallyUsed).toBe(12);
    });
    
    it('should handle zero quantity', () => {
      let item = { ...mockEquipmentItems[0], actuallyUsed: 10 };
      item.actuallyUsed = 0;
      
      expect(item.actuallyUsed).toBe(0);
      const diff = item.actuallyUsed - item.quantity; // 0 - 10 = -10
      expect(diff).toBe(-10);
    });
    
    it('should handle partial usage', () => {
      let item = { ...mockEquipmentItems[0], actuallyUsed: 5 };
      const diff = item.actuallyUsed - item.quantity; // 5 - 10 = -5
      expect(diff).toBe(-5);
    });
    
  });
  
  describe('Barcode Functionality', () => {
    
    it('should verify item has barcode', () => {
      const item = mockEquipmentItems[0];
      expect(item.hasBarcode).toBe(true);
      expect(item.barcode).toBe('SN001');
    });
    
    it('should identify items without barcode', () => {
      const item = mockEquipmentItems[2];
      expect(item.hasBarcode).toBe(false);
      expect(item.barcode).toBeUndefined();
    });
    
    it('should match barcode for verification', () => {
      const item = mockEquipmentItems[0];
      const scannedBarcode = 'SN001';
      
      expect(item.barcode === scannedBarcode).toBe(true);
    });
    
    it('should reject mismatched barcode', () => {
      const item = mockEquipmentItems[0];
      const scannedBarcode = 'WRONG001';
      
      expect(item.barcode === scannedBarcode).toBe(false);
    });
    
  });
  
  describe('Data Validation', () => {
    
    it('should validate positive quantities', () => {
      const item = mockEquipmentItems[0];
      expect(item.quantity).toBeGreaterThan(0);
    });
    
    it('should validate non-negative prices', () => {
      const item = mockEquipmentItems[0];
      expect(item.netPrice).toBeGreaterThanOrEqual(0);
    });
    
    it('should validate item has required fields', () => {
      const item = mockEquipmentItems[0];
      expect(item.id).toBeDefined();
      expect(item.description).toBeDefined();
      expect(item.unit).toBeDefined();
      expect(item.quantity).toBeDefined();
      expect(item.netPrice).toBeDefined();
    });
    
  });
  
  describe('Summary Display Logic', () => {
    
    it('should show savings message for negative variance', () => {
      const totalVariance = -200;
      const message = totalVariance < 0 ? 'Savings from original quote' : 'Additional cost above original quote';
      
      expect(message).toBe('Savings from original quote');
    });
    
    it('should show overage message for positive variance', () => {
      const totalVariance = 500;
      const message = totalVariance > 0 ? 'Additional cost above original quote' : 'Savings from original quote';
      
      expect(message).toBe('Additional cost above original quote');
    });
    
    it('should show no variance message for zero variance', () => {
      const totalVariance = 0;
      const message = totalVariance === 0 ? 'No variance from original quote' : 'Has variance';
      
      expect(message).toBe('No variance from original quote');
    });
    
  });

  describe('Daily Entry Model', () => {
    const quote: Quote = {
      id: 'quote-1',
      clientId: 'client-1',
      title: 'Large rooftop project',
      customerName: 'Test Client',
      date: new Date('2026-04-01T08:00:00Z'),
      items: [
        {
          id: 'item-1',
          description: 'Solar Panel 400W',
          unit: 'pcs',
          quantity: 10,
          netPrice: 2000,
        },
        {
          id: 'item-2',
          description: 'Mounting Rails 6m',
          unit: 'pcs',
          quantity: 20,
          netPrice: 150,
        },
      ],
      subtotalNet: 0,
      vatTotal: 0,
      totalGross: 0,
    };

    const buildEntry = (overrides: Partial<EquipmentTrackingEntry>): EquipmentTrackingEntry => ({
      id: 'entry-default',
      quoteId: quote.id,
      clientId: 'client-1',
      projectTitle: quote.title,
      workDate: new Date('2026-04-01T00:00:00'),
      installerId: 'installer-1',
      installerNickname: 'Nick',
      status: 'draft',
      items: [
        {
          id: 'item-1',
          description: 'Solar Panel 400W',
          quotedQty: 10,
          consumedQty: 6,
          unit: 'pcs',
          netPrice: 2000,
          selectedSerialNumbers: ['SN-1'],
        },
        {
          id: 'item-2',
          description: 'Mounting Rails 6m',
          quotedQty: 20,
          consumedQty: 8,
          unit: 'pcs',
          netPrice: 150,
        },
      ],
      extraItems: [],
      installationPhotos: [],
      createdAt: new Date('2026-04-01T08:00:00'),
      updatedAt: new Date('2026-04-01T09:00:00'),
      ...overrides,
    });

    it('should create a stable one-entry-per-installer-per-day id', () => {
      const workDate = new Date('2026-04-02T15:45:00');
      expect(buildEquipmentTrackingEntryId('quote-1', 'installer-1', workDate)).toBe('quote-1__installer-1__2026-04-02');
      expect(toWorkDateKey(workDate)).toBe('2026-04-02');
    });

    it('should aggregate multiple days for the same installer without overwriting', () => {
      const dayOne = buildEntry({
        id: 'entry-day-1',
        workDate: new Date('2026-04-01T00:00:00'),
      });
      const dayTwo = buildEntry({
        id: 'entry-day-2',
        workDate: new Date('2026-04-02T00:00:00'),
        updatedAt: new Date('2026-04-02T18:00:00'),
        items: [
          {
            id: 'item-1',
            description: 'Solar Panel 400W',
            quotedQty: 10,
            consumedQty: 4,
            unit: 'pcs',
            netPrice: 2000,
            selectedSerialNumbers: ['SN-2'],
          },
          {
            id: 'item-2',
            description: 'Mounting Rails 6m',
            quotedQty: 20,
            consumedQty: 12,
            unit: 'pcs',
            netPrice: 150,
          },
        ],
        notes: 'Finished roof side B',
      });

      const aggregate = aggregateEquipmentTrackingEntries(quote, [dayOne, dayTwo]);

      expect(aggregate.consumptionData.find((item) => item.id === 'item-1')?.consumedQty).toBe(10);
      expect(aggregate.consumptionData.find((item) => item.id === 'item-2')?.consumedQty).toBe(20);
      expect(aggregate.consumptionData.find((item) => item.id === 'item-1')?.selectedSerialNumbers).toEqual(['SN-1', 'SN-2']);
      expect(aggregate.completionNotes).toBe('Finished roof side B');
      expect(aggregate.consumptionDataUpdatedBy).toBe('Nick');
    });

    it('should aggregate multiple installers on the same project and day', () => {
      const installerOne = buildEntry({
        id: 'entry-installer-1',
        installerId: 'installer-1',
        installerNickname: 'Nick',
        items: [
          {
            id: 'item-1',
            description: 'Solar Panel 400W',
            quotedQty: 10,
            consumedQty: 5,
            unit: 'pcs',
            netPrice: 2000,
          },
          {
            id: 'item-2',
            description: 'Mounting Rails 6m',
            quotedQty: 20,
            consumedQty: 10,
            unit: 'pcs',
            netPrice: 150,
          },
        ],
      });
      const installerTwo = buildEntry({
        id: 'entry-installer-2',
        installerId: 'installer-2',
        installerNickname: 'Alex',
        updatedAt: new Date('2026-04-01T12:00:00'),
        items: [
          {
            id: 'item-1',
            description: 'Solar Panel 400W',
            quotedQty: 10,
            consumedQty: 5,
            unit: 'pcs',
            netPrice: 2000,
          },
          {
            id: 'item-2',
            description: 'Mounting Rails 6m',
            quotedQty: 20,
            consumedQty: 10,
            unit: 'pcs',
            netPrice: 150,
          },
        ],
        extraItems: [
          {
            id: 'extra-1',
            description: 'Extra connector pack',
            quotedQty: 0,
            consumedQty: 2,
            unit: 'pcs',
            netPrice: 50,
            isExtra: true,
          },
        ],
      });

      const aggregate = aggregateEquipmentTrackingEntries(quote, [installerOne, installerTwo]);

      expect(aggregate.consumptionData.find((item) => item.id === 'item-1')?.consumedQty).toBe(10);
      expect(aggregate.consumptionData.find((item) => item.id === 'item-2')?.consumedQty).toBe(20);
      expect(aggregate.extraItems).toHaveLength(1);
      expect(aggregate.extraItems[0].consumedQty).toBe(2);
      expect(aggregate.materialVariances.reduce((sum, item) => sum + item.variance, 0)).toBe(0);
    });

    it('should match blank-table manual rows back to quote items by description or original id', () => {
      const byDescription = findMatchingQuoteLineItem(quote, {
        id: 'manual-row-1',
        description: 'Solar Panel 400W',
        inventoryItemId: undefined,
        originalLineItemId: undefined,
      });

      const byOriginalLineItemId = findMatchingQuoteLineItem(quote, {
        id: 'manual-row-2',
        description: 'Custom renamed row',
        inventoryItemId: undefined,
        originalLineItemId: 'item-2',
      });

      expect(byDescription?.id).toBe('item-1');
      expect(byOriginalLineItemId?.id).toBe('item-2');
    });

    it('should classify unmatched manual rows as extra items during aggregation', () => {
      const manualEntry = buildEntry({
        id: 'entry-manual-extra',
        items: [
          {
            id: 'manual-extra-row',
            description: 'Copper grounding clamp',
            quotedQty: 0,
            consumedQty: 3,
            unit: 'pcs',
            netPrice: 25,
          },
        ],
        extraItems: [],
      });

      const aggregate = aggregateEquipmentTrackingEntries(quote, [manualEntry]);

      expect(aggregate.extraItems).toHaveLength(1);
      expect(aggregate.extraItems[0].description).toBe('Copper grounding clamp');
      expect(aggregate.extraItems[0].consumedQty).toBe(3);
      expect(aggregate.extraItems[0].isExtra).toBe(true);
    });
  });
  
});
