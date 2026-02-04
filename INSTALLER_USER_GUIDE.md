# Installer Dashboard - User Guide

## Getting Started

### Logging In as an Installer
1. Navigate to the login page
2. Enter your installer credentials
3. You will be automatically directed to `/dashboard/installer`

## Dashboard Overview

### Your Installer Dashboard (`/dashboard/installer`)
**What you see:**
- **Active Jobs**: Number of projects currently assigned to you
- **Completed Jobs**: Number of projects you've finished
- **Total Value**: Combined value of all your assigned projects
- **Allocated Projects**: Grid showing all jobs assigned to you
- **Quick Action**: Create Report button for daily reports

### Viewing Project Details
1. Click on any project card in the "Active Jobs" section
2. You'll see:
   - Client information (name, phone, email, address)
   - Site photos taken during the sales visit
   - Material consumption table
   - Cost variance summary

## Material Consumption Tracking

### How to Track Materials

#### 1. **Manual Entry**
- In the material consumption table, find each item
- Enter the quantity consumed in the "Consumed" column
- The system automatically calculates:
  - Delta (difference from quoted)
  - Cost impact

#### 2. **Barcode Scanner** (NEW)
- Click the "Scanner" button in the Material Consumption header
- Scan item barcodes or type SKUs
- The system will:
  - Match the barcode to items in your quote
  - Automatically increment the consumed quantity
  - Show success (✓) or no match (✗) feedback
- Press Enter or click "Add" to scan multiple items

#### 3. **Extra Items**
If you used materials not in the original quote:
1. Click "Add Extra Item" button
2. Fill in:
   - Item description
   - Quantity used
   - Unit (pcs, meters, etc.)
   - Price per unit
3. Click "Add Item"
4. Extra items are highlighted in yellow

### Understanding the Summary

**Material Consumption Table:**
- **Item**: Material name
- **Quoted**: Amount planned to use
- **Consumed**: Amount actually used
- **Delta**: Difference (positive = used more, negative = saved)
- **Price/Unit**: Cost per unit

**Cost Summary:**
- **Quoted Cost**: Total planned cost
- **Extra Items Cost**: Cost of unquoted materials
- **Variance**: Difference (positive = over budget, negative = under budget)
- **Actual Cost**: Final total cost

**Material Variances:**
If there are any differences from the quote, you'll see a detailed list showing exactly which items varied and by how much.

## Completing a Job

### Step 1: Record All Materials
- Enter consumption quantities for every quoted item
- Add any extra items you used
- Verify all deltas are captured

### Step 2: Click "Complete Job"
- You'll see a confirmation dialog
- The dialog shows:
  - Cost breakdown
  - Variance summary
  - Savings or overage amount

### Step 3: Add Completion Notes
- Describe any issues, observations, or recommendations
- This helps the team understand the job context
- Examples:
  - "Roof condition better than expected"
  - "Customer requested additional circuit"
  - "Weather delayed installation by 2 hours"

### Step 4: Confirm & Submit
- Click "Confirm & Submit"
- The system will save all your data
- You'll be redirected to the dashboard

## Creating Reports

### How to Create a Report

1. **From Dashboard**: Click "Create Report" in Quick Action
2. **From Job**: Click "Create Report" when no jobs assigned

### Available Report Types

#### Daily Work Report
**Use this to:**
- Document work you completed
- Track time spent
- Report materials used
- Note weather conditions

**Fill in:**
- Date and work hours (start/end time)
- Work completed description
- Materials used
- Weather conditions
- Any issues encountered
- Plan for the next day

**Example:**
```
Date: 2024-01-15
Time: 8:00 AM - 5:00 PM (9 hours)
Work: Installed 24 solar panels, completed roof mounts
Materials: Used 50 mounting clips, 30 cable ties, 10 breakers
Weather: Sunny with light wind
Issues: None
Next Day: Connect wiring and test system
```

#### Incident Report
**Use this for:**
- Safety concerns
- Equipment damage
- Customer requests
- Technical problems
- Weather impacts

**Fill in:**
- Incident type
- Severity level (low/medium/high/critical)
- What happened
- Where it happened
- Solution applied
- Notify manager (if critical)

**Example:**
```
Type: Safety Issue
Severity: High
What: Customer has old roof gutters, risk of water damage
Where: Roof near panel installation area
Solution: Recommended customer have gutters inspected before final install
Notify Manager: Yes
```

#### Time & Attendance Report
**Use this to:**
- Clock in/out
- Track working hours
- Log travel time
- Record breaks

**The system calculates:**
- **Gross Hours**: Clock in to clock out
- **After Break**: Minus your lunch/break time
- **Billable Hours**: Actual work time (excluding breaks and travel)

**Example:**
```
Clock In: 08:00
Clock Out: 17:00
Break: 60 minutes
Travel To Site: 30 minutes
Travel Back: 30 minutes
Billable Hours: 7 hours
```

## Navigation Tips

### Quick Links
- Dashboard: `/dashboard/installer`
- Allocated Jobs: Click any project card
- Job Details: After clicking a project
- Reports: "Create Report" button or no-jobs state
- Back to Main Dashboard: "Back" button or sidebar

### Keyboard Shortcuts
- **Enter** in barcode scanner: Submit barcode
- **Tab** between form fields: Standard form navigation

## Troubleshooting

### Barcode Scanner Not Finding Items
- Check that the SKU is typed correctly
- Ensure the item is in your quote
- Try manually entering the consumed quantity instead

### Can't Find a Material
- It might be listed under a different name
- Check if you have "extra items" for it
- Contact your manager if item is missing from quote

### Job Not Saving
- Ensure all quoted items have consumption quantities
- Check your internet connection
- Try refreshing the page and trying again

### Numbers Don't Match Your Invoice
- Verify the "Actual Cost" calculation
- Check if all extra items were added
- Review material variances section

## Best Practices

1. **Update Materials Frequently**: Enter quantities as you use materials, don't wait until the end
2. **Use Barcode Scanner**: Faster and more accurate than manual entry
3. **Document Issues**: Always fill in completion notes - helps the team
4. **Be Specific**: In reports, be specific about what was done and why
5. **Photo Records**: Ask customers to keep photos of their system with date stamps
6. **Confirm Before Completing**: Review the variance summary before final submission

## Support

If you encounter any issues:
1. Take a screenshot of the problem
2. Note what you were trying to do
3. Contact your manager with details
4. Our team will help resolve it

---

**Last Updated**: January 2024
**Version**: 1.0
