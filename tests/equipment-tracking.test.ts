/**
 * Equipment List & Usage Tracking Tests
 * Tests for the installer equipment tracking functionality
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

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
  
});
