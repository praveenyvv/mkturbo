# M.K. Turbo Engineering & Servicing Centre - Invoice Generator

A custom, fast, and authentic web-based invoice generator tailored specifically to match the physical printed bill book of **M.K. TURBO ENGINEERING & SERVICING CENTRE**.

---

## ✨ Features Included

1. **Automatic Sequential Invoice Numbers**:
   - Automatically tracks and displays the current invoice number (defaults to `#133` as in your sample).
   - Auto-increments after downloading/printing (e.g., 133 &rarr; 134 &rarr; 135) so you never have to remember or calculate the next number.
   - Quick **+1 button** or manual edit anytime.

2. **Smart Today's Date with Quick Edit**:
   - Automatically pre-fills **Today's Date** by default (e.g. `06/11/2026`).
   - If generating for another day, simply pick any date from the date picker.
   - Click the **"Set Today"** button anytime to instantly reset back to today's date.

3. **Fast & Simple Product / Cost Entry**:
   - Designed for speed: just enter **Product Name** and **Cost**.
   - Press **`Enter`** in the cost field or click the big **`+ Add Product`** button to immediately add the next item.
   - Optional toggle for advanced columns (**HSN Code**, **Qty**, **Rate**) whenever needed.
   - Automatic real-time subtotal and total calculation.
   - Automatic conversion to Indian currency in words (e.g. *"Nineteen Thousand Rupees Only"*).

4. **Exact Physical Invoice Reproduction**:
   - Formatted to match your original printed invoice layout:
     - Header: *COMPOSITION DEALER*, *GSTIN: 37AGYPY3905E1ZQ*, *Y. Srinivasa Rao, Proprietor*.
     - Blue Turbocharger Logo & Company Banner.
     - Red stamped invoice number style.
     - Authentic 7-column table layout: *S.no., Name of the product, HSN Code, Qty., Unit, Rate, Amount*.
     - Bank details (*IDBI Bank Gajuwaka*, A/c: `10 10 10 200 000 5425`, IFSC: `IBKL0001010`).
     - Standard Terms and Conditions & Authorised Signatory.

5. **Printable PDF Export**:
   - PDF files are automatically named using your exact format:
     ```
     MKTURBO_INVOICE_<INVOICE_NUMBER>.pdf
     ```
     *(Example: `MKTURBO_INVOICE_133.pdf`)*
   - Both **Direct PDF Download** and **Browser Print** (`Ctrl+P` friendly) with single-page A4 print stylesheet.

6. **Invoice History**:
   - Saves recent invoices in your browser storage so you can review past bills anytime.

7. **One-Click Sample Loader**:
   - Click **"Load Sample"** at the top to instantly populate the exact 3 items from your uploaded photo bill to preview how it looks.

---

## 🚀 How to Run

### Method 1: Double Click (Windows)
Double-click `start.bat` in this folder. It will launch the local server and open your default browser automatically at `http://localhost:5000`.

### Method 2: Python Terminal
Open PowerShell or Command Prompt in this folder and run:
```bash
python server.py
```

### Method 3: Direct File Open
You can also directly double-click `index.html` in any modern web browser (Google Chrome, Microsoft Edge, Firefox, Brave).
