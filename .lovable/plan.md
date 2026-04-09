

## Match TikTok Export to Official Template

**Problem**: The current TikTok Tracking export creates a simple single-sheet XLSX with just the data. The user wants it to match the official TikTok template exactly, which has 3 tabs: "Instructions", "Example of shipment info", and "Shipping info" — with data filled into the "Shipping info" tab.

**Approach**: Store the uploaded template as a base file, then at export time clone the template and populate the "Shipping info" sheet with the actual order data.

### Changes

| File | Change |
|------|--------|
| `public/tiktok-template.xlsx` | Copy the uploaded template into the project as a static asset |
| `src/pages/ShippingLabels.tsx` (lines 839-842) | Instead of creating a new workbook from scratch, fetch the template, load it with XLSX, find the "Shipping info" sheet (Page 3), and append the order rows below the header row |

**Implementation detail**: The template's 3rd sheet has a merged instruction row in row 1 and headers (Order ID, Tracking ID, Shipping Provider Name) in row 2. The export will:
1. Fetch `/tiktok-template.xlsx` as an ArrayBuffer
2. Read it with `XLSX.read()`
3. Get the 3rd sheet by name
4. Append data rows starting at row 3 (below the existing headers)
5. Write the file — preserving all 3 tabs with instructions intact

