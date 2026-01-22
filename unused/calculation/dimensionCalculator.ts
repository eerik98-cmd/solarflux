/**
 * Panel Dimension Calculator
 * Converts mm dimensions to various useful structures for inventory management
 */

export interface PanelDimensions {
  widthMm: number;
  heightMm: number;
  depthMm?: number; // Thickness, typically 35-40mm for solar panels
}

export interface CalculatedStructure {
  dimensions: {
    widthMm: number;
    heightMm: number;
    depthMm: number;
    widthM: number;
    heightM: number;
    depthM: number;
  };
  area: {
    mm2: number;
    m2: number;
  };
  weight: {
    estimatedPerPanelKg: number; // Typical solar panel: ~18-25 kg depending on type
  };
  pallet: {
    panelsPerPalletL: number; // Landscape orientation
    panelsPerPalletP: number; // Portrait orientation
    totalWeightPerPalletKg: number;
    palletDimensionsL: {
      widthMm: number;
      lengthMm: number;
      heightMm: number;
    };
    palletDimensionsP: {
      widthMm: number;
      lengthMm: number;
      heightMm: number;
    };
  };
  installation: {
    roofAreaNeededM2: number; // Direct area
    spacingBufferM2: number; // 10% buffer for wiring, gaps
    totalRoofAreaNeededM2: number;
    suggestedRowsFor100m2: number;
    suggestedColumnsFor100m2: number;
  };
  storage: {
    horizontalStackHeight5Panels: number; // mm
    horizontalStackHeight10Panels: number; // mm
    verticalStackSpaceMm: number; // Side by side storage
  };
}

// Standard solar panel thickness
const PANEL_THICKNESS_MM = 38;
// Standard Euro pallet: 1200 x 800 mm
const EURO_PALLET_WIDTH_MM = 1200;
const EURO_PALLET_LENGTH_MM = 800;
// Typical solar panel weight
const TYPICAL_PANEL_WEIGHT_KG = 22;

export const panelSizes = {
  LARGE: { widthMm: 2093, heightMm: 1134, label: '2093x1134' },
  MEDIUM: { widthMm: 1722, heightMm: 1134, label: '1722x1134' },
};

export function calculateStructures(
  dimensions: PanelDimensions,
  panelWeightKg: number = TYPICAL_PANEL_WEIGHT_KG
): CalculatedStructure {
  const { widthMm, heightMm, depthMm = PANEL_THICKNESS_MM } = dimensions;

  // Convert to meters
  const widthM = widthMm / 1000;
  const heightM = heightMm / 1000;
  const depthM = depthMm / 1000;

  // Area calculations
  const areaMm2 = widthMm * heightMm;
  const areaM2 = widthM * heightM;

  // Pallet calculations - Landscape (wide side horizontal)
  const panelsPerPalletLandscape = calculatePanelsOnPallet(
    widthMm,
    heightMm,
    EURO_PALLET_WIDTH_MM,
    EURO_PALLET_LENGTH_MM,
    'landscape'
  );

  // Pallet calculations - Portrait (tall side horizontal)
  const panelsPerPalletPortrait = calculatePanelsOnPallet(
    widthMm,
    heightMm,
    EURO_PALLET_WIDTH_MM,
    EURO_PALLET_LENGTH_MM,
    'portrait'
  );

  // Pallet dimensions with panels stacked
  const landscapeStackHeight = depthMm * panelsPerPalletLandscape.stackLayers;
  const portraitStackHeight = depthMm * panelsPerPalletPortrait.stackLayers;

  // Installation calculations for 100m² roof
  const roofArea = 100;
  const spacingBuffer = roofArea * 0.1; // 10% for wiring, gaps, safety margins
  const totalNeeded = roofArea + spacingBuffer;
  const panelsNeeded = Math.ceil(totalNeeded / areaM2);
  
  // Suggest grid layout (aiming for roughly square layout)
  const gridDensity = Math.sqrt(panelsNeeded);
  const suggestedRows = Math.ceil(gridDensity);
  const suggestedCols = Math.ceil(panelsNeeded / suggestedRows);

  // Storage calculations - horizontal stacking
  const horizontalStackHeight5 = depthMm * 5;
  const horizontalStackHeight10 = depthMm * 10;
  const verticalStackSpace = widthMm + 50; // 50mm gap for handling

  return {
    dimensions: {
      widthMm,
      heightMm,
      depthMm,
      widthM,
      heightM,
      depthM,
    },
    area: {
      mm2: areaMm2,
      m2: areaM2,
    },
    weight: {
      estimatedPerPanelKg: panelWeightKg,
    },
    pallet: {
      panelsPerPalletL: panelsPerPalletLandscape.count,
      panelsPerPalletP: panelsPerPalletPortrait.count,
      totalWeightPerPalletKg:
        Math.max(
          panelsPerPalletLandscape.count,
          panelsPerPalletPortrait.count
        ) * panelWeightKg +
        25, // Pallet weight ~25kg
      palletDimensionsL: {
        widthMm: EURO_PALLET_WIDTH_MM,
        lengthMm: EURO_PALLET_LENGTH_MM,
        heightMm: landscapeStackHeight,
      },
      palletDimensionsP: {
        widthMm: EURO_PALLET_WIDTH_MM,
        lengthMm: EURO_PALLET_LENGTH_MM,
        heightMm: portraitStackHeight,
      },
    },
    installation: {
      roofAreaNeededM2: roofArea,
      spacingBufferM2: spacingBuffer,
      totalRoofAreaNeededM2: totalNeeded,
      suggestedRowsFor100m2: suggestedRows,
      suggestedColumnsFor100m2: suggestedCols,
    },
    storage: {
      horizontalStackHeight5Panels: horizontalStackHeight5,
      horizontalStackHeight10Panels: horizontalStackHeight10,
      verticalStackSpaceMm: verticalStackSpace,
    },
  };
}

interface PalletLayout {
  count: number;
  stackLayers: number;
  config: string;
}

function calculatePanelsOnPallet(
  panelWidthMm: number,
  panelHeightMm: number,
  palletWidthMm: number,
  palletLengthMm: number,
  orientation: 'landscape' | 'portrait'
): PalletLayout {
  let acrossWidth: number;
  let acrossLength: number;
  let config: string;

  if (orientation === 'landscape') {
    // Panel is placed with width across pallet width
    acrossWidth = Math.floor(palletWidthMm / panelWidthMm);
    acrossLength = Math.floor(palletLengthMm / panelHeightMm);
    config = `${acrossWidth}x${acrossLength}`;
  } else {
    // Panel is rotated - width goes across length
    acrossWidth = Math.floor(palletWidthMm / panelHeightMm);
    acrossLength = Math.floor(palletLengthMm / panelWidthMm);
    config = `${acrossWidth}x${acrossLength}(rotated)`;
  }

  const panelsPerLayer = acrossWidth * acrossLength;
  // Stack up to 2-3 layers per pallet for safety (max ~1500kg per pallet)
  const stackLayers = Math.min(3, Math.floor(1500 / (22 + 25))); // Rough estimation

  return {
    count: panelsPerLayer,
    stackLayers,
    config,
  };
}

export function formatStructureReport(structure: CalculatedStructure): string {
  return `
📦 PANEL DIMENSION ANALYSIS
═══════════════════════════════════════════

📐 DIMENSIONS
  • Width: ${structure.dimensions.widthMm}mm (${structure.dimensions.widthM}m)
  • Height: ${structure.dimensions.heightMm}mm (${structure.dimensions.heightM}m)
  • Depth: ${structure.dimensions.depthMm}mm (${structure.dimensions.depthM}m)

📊 AREA
  • Per Panel: ${structure.area.m2.toFixed(2)}m²
  • Per Panel: ${structure.area.mm2.toLocaleString()}mm²

⚖️ WEIGHT
  • Estimated per Panel: ${structure.weight.estimatedPerPanelKg}kg

🚛 PALLET CONFIGURATION (Euro Pallet 1200x800mm)
  • Landscape Orientation:
    - Panels per layer: ${structure.pallet.panelsPerPalletL}
    - Total weight: ~${structure.pallet.totalWeightPerPalletKg}kg
    - Stack height: ${structure.pallet.palletDimensionsL.heightMm}mm
  
  • Portrait Orientation:
    - Panels per layer: ${structure.pallet.panelsPerPalletP}
    - Total weight: ~${structure.pallet.totalWeightPerPalletKg}kg
    - Stack height: ${structure.pallet.palletDimensionsP.heightMm}mm

🏘️ INSTALLATION (100m² roof)
  • Direct coverage: ${structure.installation.roofAreaNeededM2}m²
  • Spacing buffer (10%): ${structure.installation.spacingBufferM2}m²
  • Total needed: ${structure.installation.totalRoofAreaNeededM2}m²
  • Suggested grid: ${structure.installation.suggestedRowsFor100m2} rows × ${structure.installation.suggestedColumnsFor100m2} columns

🏗️ STORAGE
  • 5 panels stacked: ${structure.storage.horizontalStackHeight5Panels}mm height
  • 10 panels stacked: ${structure.storage.horizontalStackHeight10Panels}mm height
  • Side-by-side spacing: ${structure.storage.verticalStackSpaceMm}mm
`;
}

// Pre-calculated structures for standard sizes
export const standardStructures = {
  LARGE_2093x1134: calculateStructures(panelSizes.LARGE),
  MEDIUM_1722x1134: calculateStructures(panelSizes.MEDIUM),
};
