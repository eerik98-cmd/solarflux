#!/bin/bash

# Manual Test Walkthrough - Equipment List & Usage Tracking
# Step-by-step instructions for testing the feature in the UI

echo "==============================================="
echo "Equipment List & Usage Tracking - UI Test Guide"
echo "==============================================="
echo ""

cat << 'EOF'
BEFORE YOU START:
- Ensure you have at least one client with quotes
- Have an installer account or credentials
- Start the application: npm run dev

═══════════════════════════════════════════════════════════

PART 1: NAVIGATE TO THE FEATURE
─────────────────────────────────
1. Open browser and go to: http://localhost:3000
2. Log in with installer credentials
3. Navigate to: Dashboard → Installer → Clients
4. Click on a client to view details
5. Expected: Should load /dashboard/installer/clients/[id]
   Result: ✅ Equipment section visible with list

═══════════════════════════════════════════════════════════

PART 2: EQUIPMENT TABLE INSPECTION
──────────────────────────────────
1. Locate the "Equipment List & Usage Tracking" section
2. Check table headers:
   ✅ Item
   ✅ Quoted Qty
   ✅ Actually Used
   ✅ Difference
   ✅ Value Diff
   ✅ Barcode

3. Verify equipment items populate from quote:
   ✅ Solar panels listed
   ✅ Rails listed
   ✅ Clamps listed
   ✅ Other components listed

4. Expected data for each row:
   - Description matches quote item
   - Quoted Qty matches original quote
   - Actually Used initially equals Quoted Qty
   - Difference shows 0 initially
   - Value Diff shows 0 RON initially

═══════════════════════════════════════════════════════════

PART 3: QUANTITY TRACKING (ACTUAL USAGE)
────────────────────────────────────────
Test Case 1: Decrease Usage (Savings Scenario)
1. Find "Mounting Rails 6m" row
2. Click on "Actually Used" field
3. Current value: 20 (matches quoted)
4. Change to: 18
5. Press Tab or Enter
6. Expected:
   ✅ Difference shows: -2 pcs (GREEN text)
   ✅ Value Diff shows: -300 RON (GREEN text)
   ✅ Summary updates immediately

Test Case 2: Increase Usage (Overage Scenario)
1. Find "End Clamps" row
2. Current value: 40
3. Change to: 42
4. Expected:
   ✅ Difference shows: +2 pcs (RED text)
   ✅ Value Diff shows: +100 RON (RED text)
   ✅ Color changes from neutral to RED

Test Case 3: Zero Usage
1. Find any item
2. Change "Actually Used" to: 0
3. Expected:
   ✅ Difference shows negative value
   ✅ Value Diff shows negative cost
   ✅ Green color (savings)

Test Case 4: Negative Value (Using more than quoted)
1. Find "Solar Panels" row
2. Current value: 10
3. Change to: 15
4. Expected:
   ✅ Difference shows: +5 pcs (RED)
   ✅ Value Diff shows: +10,000 RON (RED - large overage)

═══════════════════════════════════════════════════════════

PART 4: PROJECT SUMMARY SECTION
───────────────────────────────
1. Scroll to "Project Summary" section
2. Verify "Equipment Usage" subsection:
   ✅ Original Quote Total: Shows total of all items
   ✅ Actual Consumption: Shows total based on "Actually Used"
   ✅ Equipment Variance: Shows difference

3. Check colors and values update as you change quantities:
   - After changes in Part 3, summary should update
   - Values should match calculations

4. Verify "Total Price Difference" box:
   ✅ Shows combined equipment + extra items variance
   ✅ Color: GREEN if savings, RED if overage
   ✅ Icon: Trending arrow
   ✅ Message explains the variance

═══════════════════════════════════════════════════════════

PART 5: EXTRA ITEMS MANAGEMENT
──────────────────────────────
Test Case 1: Add Extra Item
1. Scroll to "Extra Materials Used" section
2. Click "+ Add Extra Item" button
3. Expected: New row appears with empty fields
4. Fill in the fields:
   - Description: "Additional fasteners"
   - Quantity: 10
   - Unit: "pcs"
   - Price: 25
5. Expected:
   ✅ New item appears in list
   ✅ Can add multiple items

Test Case 2: View Extra Items Total
1. After adding items, check summary
2. Should show "Extra Materials" subsection
3. Lists each extra item: Description × Qty × Price = Total
4. Shows "Extra Items Total" at bottom
5. Example: 
   - Item 1: 10 × 25 = 250 RON
   - Item 2: 5 × 50 = 250 RON
   - Total: 500 RON
   ✅ Should calculate correctly

Test Case 3: Remove Extra Item
1. Click the minus button (-) on a row
2. Expected: Item removed immediately
3. Summary updates, total decreases

═══════════════════════════════════════════════════════════

PART 6: BARCODE VERIFICATION
────────────────────────────
Test Case 1: Item with Barcode
1. Find an item with a barcode button (blue icon)
2. Click the barcode button
3. Prompt appears: "Enter or scan barcode:"
4. Try correct barcode:
   - Enter the correct barcode
   - Click OK
   - Expected: ✓ Confirmation message
   
Test Case 2: Try Incorrect Barcode
1. Click barcode button again
2. Enter: WRONG_CODE
3. Click OK
4. Expected: ⚠ Warning message

Test Case 3: Item Without Barcode
1. Find items without barcode (showing "No barcode" text)
2. Expected: No barcode button visible
3. Verification not possible for these items

═══════════════════════════════════════════════════════════

PART 7: INSTALLATION PHOTOS
───────────────────────────
1. Scroll to "Installation Pictures" section
2. Click "Add Installation Photo" button
3. File picker opens
4. Select an image from your computer
5. Expected:
   ✅ Photo appears in grid
   ✅ Thumbnail shows preview
   ✅ Date displayed

6. Add description:
   - Type description under photo
   - Example: "Solar array installation complete"
   ✅ Description updates

7. Test photo removal:
   - Hover over a photo
   - Click X button
   ✅ Photo removed

═══════════════════════════════════════════════════════════

PART 8: FINAL REPORT
───────────────────
1. Scroll to "Final Installation Report" section
2. Click in textarea
3. Type report content:
   "Installation Status: Complete
   Work Completed:
   - Array mounted and wired
   - Inverter installed
   - Final testing passed
   No issues encountered."

4. Click "Save Report" button
5. Expected: Alert confirmation "Report saved!"

6. Click "Export as PDF" button
7. Expected: Alert showing "Report prepared for export"
   (Full PDF export would be implemented in production)

═══════════════════════════════════════════════════════════

PART 9: VARIANCE CALCULATION VERIFICATION
───────────────────────────────────────────
Manual Calculation Example:

Equipment Item 1: Solar Panels
  - Quoted: 10 × 2,000 RON = 20,000 RON
  - Used: 10 × 2,000 RON = 20,000 RON
  - Variance: 0 RON

Equipment Item 2: Rails
  - Quoted: 20 × 150 RON = 3,000 RON
  - Used: 18 × 150 RON = 2,700 RON
  - Variance: -300 RON (SAVINGS)

Equipment Item 3: Clamps
  - Quoted: 40 × 50 RON = 2,000 RON
  - Used: 42 × 50 RON = 2,100 RON
  - Variance: +100 RON (OVERAGE)

Extra Materials:
  - Fasteners: 5 × 100 RON = 500 RON

TOTAL:
  Original Quote: 25,000 RON
  Actual Usage: 24,800 RON
  Equipment Variance: -200 RON
  Extra Materials: +500 RON
  TOTAL VARIANCE: +300 RON (Additional cost)

✅ Verify these calculations match in the UI

═══════════════════════════════════════════════════════════

PART 10: ERROR SCENARIOS
────────────────────────
Test Case 1: No Equipment (Client without quotes)
1. Create/select a client with no quotes
2. Navigate to their page
3. Expected: Equipment section NOT shown (conditional)

Test Case 2: Invalid Client ID
1. Manually edit URL: /dashboard/installer/clients/invalid123
2. Expected: 
   ✅ Alert icon shown
   ✅ "Client Not Found" message
   ✅ "Go Back" button functional

═══════════════════════════════════════════════════════════

PART 11: RESPONSIVE DESIGN
──────────────────────────
Test on Different Screen Sizes:

Desktop (1920×1080):
  ✅ Full table visible
  ✅ All columns readable
  ✅ Summary 2-column grid

Tablet (768×1024):
  ✅ Table scrollable horizontally
  ✅ Summary responsive
  ✅ Photos in 2-column grid

Mobile (375×667):
  ✅ Table scrollable
  ✅ Summary single column
  ✅ Photos in 1-2 column grid
  ✅ Touch interactions work

═══════════════════════════════════════════════════════════

PART 12: DATA CONSISTENCY
────────────────────────
1. Make several changes:
   - Update 3-4 quantities
   - Add 2-3 extra items
   - Add description to extra items

2. Verify consistency:
   ✅ Summary updates for each change
   ✅ No calculation errors
   ✅ Colors consistent
   ✅ No infinite loops or freezes

3. Refresh page (F5):
   ✅ Equipment list reloads
   ✅ Quantities reset to defaults
   (Changes not persisted as per current implementation)

═══════════════════════════════════════════════════════════

FINAL VALIDATION CHECKLIST
──────────────────────────

Core Functionality:
☐ Equipment list loads from quotes
☐ Quantities can be updated
☐ Variances calculate correctly
☐ Colors update based on variance
☐ Summary calculates correctly
☐ Extra items can be added/removed
☐ Barcode scanning works
☐ Report can be saved
☐ Photos can be uploaded

UI/UX:
☐ All buttons clickable
☐ All fields editable
☐ No layout issues
☐ Responsive on all screen sizes
☐ Colors meaningful and clear
☐ Text readable and clear
☐ Icons appropriate and visible

Performance:
☐ Page loads quickly
☐ No lag when updating quantities
☐ Summary updates instantly
☐ No console errors

Error Handling:
☐ Missing client shows message
☐ No equipment shows gracefully
☐ Empty extra items handled
☐ Missing barcodes show "No barcode"

═══════════════════════════════════════════════════════════

EXPECTED RESULTS: ALL CHECKS SHOULD PASS ✅

If any checks fail, document:
- What failed
- Expected vs actual behavior
- Browser/OS used
- Steps to reproduce

═══════════════════════════════════════════════════════════
EOF
