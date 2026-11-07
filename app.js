/**
 * M.K. TURBO WORKSHOP SUITE
 * 2-in-1: Cash Bill Generator + Personal Finance & Profit Book
 * Protected by PIN 1981
 * Featuring Save Mechanism, Progressive Web App (PWA) & Multi-Device Cloud Sync
 */

(function () {
  'use strict';

  const PIN_CODE = '1981';

  const STORAGE = {
    NEXT_INV_NO: 'mkturbo_next_inv_no',
    FINANCE_LEDGER: 'mkturbo_finance_ledger',
    LAST_VIEW: 'mkturbo_active_view',
    PIN_UNLOCKED: 'mkturbo_unlocked',
    SYNC_CODE: 'mkturbo_sync_code',
    FIREBASE_URL: 'mkturbo_firebase_url',
    LAST_SYNC: 'mkturbo_last_sync_time',
    HISTORY: 'mkturbo_version_history'
  };

  // State
  const state = {
    activeView: localStorage.getItem(STORAGE.LAST_VIEW) || 'invoice', // 'invoice' | 'finance'
    invoiceNo: localStorage.getItem(STORAGE.NEXT_INV_NO) || '133',
    invoiceDate: todayStr(),
    customerName: '',
    customerAddress: '',
    isSaved: false, // Save mechanism state
    items: [
      { id: uid(), turboName: '', modelNo: '', partNo: '', serialNo: '', workDone: '', cost: '' }
    ],
    finance: {
      searchQuery: '',
      monthFilter: 'ALL',
      yearFilter: 'ALL',
      pendingDeleteId: null
    }
  };

  /* ── Helpers ──────────────────────────────── */
  function uid() { return 'id_' + Math.random().toString(36).slice(2, 8); }

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function toDDMMYYYY(s) {
    if (!s) return '';
    const p = s.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
  }

  function formatINR(n) {
    const v = parseFloat(n) || 0;
    return '\u20B9 ' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatINRSymbol(n) {
    const v = parseFloat(n) || 0;
    return '\u20B9 ' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function toWords(num) {
    const n = Math.floor(Math.abs(Number(num) || 0));
    if (n === 0) return 'Zero Rupees Only';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
      'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    function two(v) {
      return v < 20 ? ones[v] : tens[Math.floor(v/10)] + (ones[v%10] ? ' '+ones[v%10] : '');
    }
    function three(v) {
      const h = Math.floor(v/100), r = v%100;
      return (h ? ones[h]+' Hundred' : '') + (r ? (h ? ' and ' : '') + two(r) : '');
    }
    let w = '';
    const cr = Math.floor(n/10000000); if (cr) w += three(cr)+' Crore ';
    const lk = Math.floor((n%10000000)/100000); if (lk) w += two(lk)+' Lakh ';
    const th = Math.floor((n%100000)/1000); if (th) w += two(th)+' Thousand ';
    const rm = n%1000; if (rm) w += three(rm);
    return (w.trim() || 'Zero') + ' Rupees Only';
  }

  function esc(s) {
    return String(s||'')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function pdfFilename(no) {
    const n = String(no || state.invoiceNo || '133').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `MKTURBO_CASHBILL_${n}.pdf`;
  }

  function toast(msg, ms=2800) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), ms);
  }

  const $ = id => document.getElementById(id);

  /* ── Save Mechanism State Management ──────── */
  function setSavedState(isSaved) {
    state.isSaved = isSaved;

    const dlBtn = $('downloadPdfBtn');
    const shareBtn = $('sharePdfBtn');
    const printBtn = $('printBtn');
    const saveBtn = $('saveBillBtn');
    const saveBtnText = $('saveBillBtnText');
    const banner = $('saveStatusBanner');
    const bannerText = $('saveStatusText');
    const nextBtn = $('startNextBillBtn');

    if (dlBtn) dlBtn.disabled = !isSaved;
    if (shareBtn) shareBtn.disabled = !isSaved;
    if (printBtn) printBtn.disabled = !isSaved;
    if (nextBtn) nextBtn.style.display = isSaved ? 'flex' : 'none';

    if (isSaved) {
      if (saveBtn) saveBtn.className = 'btn-save-bill saved';
      if (saveBtnText) saveBtnText.textContent = '✅ Bill Saved in Notebook';
      if (banner) banner.className = 'save-status-banner saved';
      if (bannerText) bannerText.textContent = `Bill #${state.invoiceNo || '---'} saved! Download & Share are enabled.`;
    } else {
      if (saveBtn) saveBtn.className = 'btn-save-bill unsaved';
      if (saveBtnText) saveBtnText.textContent = '💾 Save Bill to Notebook';
      if (banner) banner.className = 'save-status-banner unsaved';
      if (bannerText) bannerText.textContent = 'Please save bill to enable Download and Share';
    }
  }

  /* ── Security PIN Lock (PIN 1981) ─────────── */
  function isFinanceUnlocked() {
    return sessionStorage.getItem(STORAGE.PIN_UNLOCKED) === '1981';
  }

  function promptFinancePin() {
    const modal = $('pinLockModal');
    const input = $('pinInput');
    const err = $('pinErrorMsg');
    input.value = '';
    err.classList.remove('show');
    modal.classList.add('open');
    setTimeout(() => input.focus(), 100);
  }

  function closePinModal() {
    $('pinLockModal').classList.remove('open');
    $('pinInput').value = '';
    $('pinErrorMsg').classList.remove('show');
  }

  function verifyPin() {
    const input = $('pinInput');
    const entered = input.value.trim();
    if (entered === PIN_CODE) {
      sessionStorage.setItem(STORAGE.PIN_UNLOCKED, '1981');
      closePinModal();
      switchView('finance');
      toast('🔓 Finance Notebook Unlocked');
    } else {
      $('pinErrorMsg').classList.add('show');
      input.value = '';
      input.focus();
    }
  }

  function lockFinanceNotebook() {
    sessionStorage.removeItem(STORAGE.PIN_UNLOCKED);
    switchView('invoice');
    toast('🔒 Finance Notebook Locked');
  }

  /* ── 2-in-1 App View Navigation ───────────── */
  function switchView(viewName) {
    if (viewName === 'finance' && !isFinanceUnlocked()) {
      promptFinancePin();
      return;
    }

    state.activeView = viewName;
    localStorage.setItem(STORAGE.LAST_VIEW, viewName);

    const isInvoice = viewName === 'invoice';
    $('viewInvoice').style.display = isInvoice ? 'block' : 'none';
    $('viewFinance').style.display = isInvoice ? 'none' : 'block';

    $('tabInvoiceBtn').classList.toggle('active', isInvoice);
    $('tabFinanceBtn').classList.toggle('active', !isInvoice);

    $('invoiceBarActions').style.display = isInvoice ? 'flex' : 'none';

    if (!isInvoice) {
      renderFinanceLedger();
    }
  }

  /* ── Finance Ledger Data Access ───────────── */
  function getLedger() {
    try {
      const data = localStorage.getItem(STORAGE.FINANCE_LEDGER);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLedger(ledger, triggerCloudSync = false) {
    localStorage.setItem(STORAGE.FINANCE_LEDGER, JSON.stringify(ledger));
    if (triggerCloudSync) {
      pushSyncToCloud('ledger_update');
    }
  }

  /* ── Format summary string for an item ────── */
  function formatItemSummary(item) {
    const metaParts = [];
    if (item.modelNo) metaParts.push(`Mdl ${item.modelNo}`);
    if (item.partNo) metaParts.push(`Part ${item.partNo}`);
    if (item.serialNo) metaParts.push(`S/N ${item.serialNo}`);
    const metaStr = metaParts.length ? `(${metaParts.join(', ')})` : '';

    const parts = [item.turboName, metaStr, item.workDone].filter(Boolean);
    return parts.join(' - ') || 'Turbo Job';
  }

  /* ── Auto-Sync Current Cash Bill to Finance Book ── */
  function syncInvoiceToFinanceBook() {
    let billedTotal = 0;
    const itemsSummary = [];
    const rawItems = [];

    state.items.forEach(item => {
      const cost = parseFloat(item.cost) || 0;
      const hasContent = item.turboName || item.modelNo || item.partNo || item.serialNo || item.workDone || cost > 0;
      if (hasContent) {
        billedTotal += cost;
        itemsSummary.push({
          name: formatItemSummary(item),
          cost: cost
        });
        rawItems.push({
          turboName: item.turboName || '',
          modelNo: item.modelNo || '',
          partNo: item.partNo || '',
          serialNo: item.serialNo || '',
          workDone: item.workDone || '',
          cost: item.cost || ''
        });
      }
    });

    const ledger = getLedger();
    const invNo = String(state.invoiceNo || '---').trim();

    const existingIndex = ledger.findIndex(e => e.invoiceNo === invNo);

    if (existingIndex >= 0) {
      const existing = ledger[existingIndex];
      existing.date = state.invoiceDate;
      existing.customerName = state.customerName.trim() || 'Cash / Counter';
      existing.customerAddress = state.customerAddress.trim();
      existing.items = itemsSummary;
      existing.rawItems = rawItems;
      existing.billedAmount = billedTotal;
      existing.profit = billedTotal - (parseFloat(existing.actualCost) || 0);
      existing.updatedAt = new Date().toISOString();
      ledger[existingIndex] = existing;
    } else {
      const newEntry = {
        id: uid(),
        invoiceNo: invNo,
        date: state.invoiceDate,
        customerName: state.customerName.trim() || 'Cash / Counter',
        customerAddress: state.customerAddress.trim(),
        items: itemsSummary,
        rawItems: rawItems,
        billedAmount: billedTotal,
        actualCost: 0,
        profit: billedTotal,
        notes: '',
        source: 'cashbill',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      ledger.unshift(newEntry);
    }

    saveLedger(ledger);
    pushSyncToCloud('bill_save');
  }

  /* ── User Action: Save Bill Button Click ───── */
  function handleSaveBill() {
    let hasContent = false;
    state.items.forEach(item => {
      const cost = parseFloat(item.cost) || 0;
      if (item.turboName || item.modelNo || item.partNo || item.serialNo || item.workDone || cost > 0) {
        hasContent = true;
      }
    });

    if (!hasContent && !state.customerName.trim()) {
      toast('Please enter at least one product or cost before saving.');
      return;
    }

    syncInvoiceToFinanceBook();
    setSavedState(true);
    toast(`✅ Cash Bill #${state.invoiceNo} saved & synced!`);
  }

  /* ── Render Product Rows (Expanded Turbo Fields) ───── */
  function renderRows() {
    const container = $('productRowsList');
    container.innerHTML = '';

    state.items.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'prod-card';
      card.dataset.id = item.id;
      card.innerHTML = `
        <div class="prod-card-header">
          <div class="prod-badge-wrap">
            <span class="prod-num">${idx + 1}</span>
            <span class="prod-card-title">${item.turboName ? esc(item.turboName) : `Item #${idx + 1}`}</span>
          </div>
          <button type="button" class="btn-del" title="Remove Item">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>

        <!-- Row 1: Turbo Name + Model No -->
        <div class="prod-inputs-grid">
          <div class="field-item">
            <label class="input-tag">Turbo Name</label>
            <input type="text" class="inp prod-turbo-name" list="turboNameList" placeholder="e.g. Holset Turbo, Garrett" value="${esc(item.turboName)}">
          </div>
          <div class="field-item">
            <label class="input-tag">Model No.</label>
            <input type="text" class="inp prod-model-no" placeholder="e.g. HX35, GT2052" value="${esc(item.modelNo || '')}">
          </div>
        </div>

        <!-- Row 2: Part Number + Serial Number -->
        <div class="prod-inputs-grid mt-1">
          <div class="field-item">
            <label class="input-tag">Part Number</label>
            <input type="text" class="inp prod-part-no" placeholder="e.g. 4031509" value="${esc(item.partNo || '')}">
          </div>
          <div class="field-item">
            <label class="input-tag">Serial Number</label>
            <input type="text" class="inp prod-serial-no" placeholder="e.g. SN-8821" value="${esc(item.serialNo || '')}">
          </div>
        </div>

        <!-- Row 3: What we have done + Cost -->
        <div class="prod-inputs-grid mt-1">
          <div class="field-item flex-grow">
            <label class="input-tag">What we have done (Work / Parts)</label>
            <input type="text" class="inp prod-work-done" placeholder="e.g. Repair Kit R/P, Core Assy &amp; Remachining" value="${esc(item.workDone)}">
          </div>
          <div class="field-item flex-cost">
            <label class="input-tag">Cost (&#8377;)</label>
            <input type="number" step="any" min="0" class="inp prod-cost" placeholder="Amount &#8377;" value="${item.cost || ''}">
          </div>
        </div>`;

      const turboNameInp = card.querySelector('.prod-turbo-name');
      const modelNoInp = card.querySelector('.prod-model-no');
      const partNoInp = card.querySelector('.prod-part-no');
      const serialNoInp = card.querySelector('.prod-serial-no');
      const workDoneInp = card.querySelector('.prod-work-done');
      const costInp = card.querySelector('.prod-cost');
      const delBtn = card.querySelector('.btn-del');

      function onAnyItemChange() {
        setSavedState(false);
        sync();
      }

      turboNameInp.addEventListener('input', e => { 
        item.turboName = e.target.value; 
        const titleEl = card.querySelector('.prod-card-title');
        if (titleEl) titleEl.textContent = item.turboName || `Item #${idx + 1}`;
        onAnyItemChange();
      });
      modelNoInp.addEventListener('input', e => { item.modelNo = e.target.value; onAnyItemChange(); });
      partNoInp.addEventListener('input', e => { item.partNo = e.target.value; onAnyItemChange(); });
      serialNoInp.addEventListener('input', e => { item.serialNo = e.target.value; onAnyItemChange(); });
      workDoneInp.addEventListener('input', e => { item.workDone = e.target.value; onAnyItemChange(); });
      costInp.addEventListener('input', e => { item.cost = e.target.value; onAnyItemChange(); });

      costInp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addRow(true); }
      });

      delBtn.addEventListener('click', () => {
        setSavedState(false);
        if (state.items.length === 1) {
          item.turboName = ''; item.modelNo = ''; item.partNo = ''; item.serialNo = ''; item.workDone = ''; item.cost = '';
          renderRows(); sync();
        } else {
          state.items = state.items.filter(i => i.id !== item.id);
          renderRows(); sync();
        }
      });

      container.appendChild(card);
    });

    const c = state.items.length;
    $('itemsCountBadge').textContent = `${c} ${c === 1 ? 'item' : 'items'}`;
  }

  function addRow(focus) {
    setSavedState(false);
    const item = { id: uid(), turboName: '', modelNo: '', partNo: '', serialNo: '', workDone: '', cost: '' };
    state.items.push(item);
    renderRows(); sync();
    if (focus) {
      setTimeout(() => {
        const inputs = document.querySelectorAll('.prod-turbo-name');
        if (inputs.length) inputs[inputs.length - 1].focus();
      }, 40);
    }
  }

  /* ── Build Hidden Printable PDF Cash Bill ───── */
  function sync() {
    const filename = pdfFilename();
    $('dlBtnFilename').textContent = filename;

    // Bill meta
    $('pInvoiceNo').textContent = state.invoiceNo || '---';
    $('pInvoiceDate').textContent = toDDMMYYYY(state.invoiceDate);

    // Customer info
    $('pCustomerName').textContent = state.customerName || '';
    $('pConsigneeName').textContent = state.customerName || '';
    $('pCustomerAddress').textContent = state.customerAddress || '';
    $('pConsigneeAddress').textContent = state.customerAddress || '';

    // Items table rows
    const tbody = $('pItemsBody');
    tbody.innerHTML = '';

    let total = 0;
    let usedRows = 0;

    state.items.forEach(item => {
      const cost = parseFloat(item.cost) || 0;
      const hasContent = item.turboName || item.modelNo || item.partNo || item.serialNo || item.workDone || cost > 0;
      if (hasContent) {
        total += cost;
        usedRows++;

        let nameHtml = '';
        if (item.turboName) {
          nameHtml += `<div class="inv-turbo-title"><strong>${esc(item.turboName)}</strong></div>`;
        }

        const metaBadges = [];
        if (item.modelNo) metaBadges.push(`<span>Mdl:</span> <strong>${esc(item.modelNo)}</strong>`);
        if (item.partNo) metaBadges.push(`<span>Part:</span> <strong>${esc(item.partNo)}</strong>`);
        if (item.serialNo) metaBadges.push(`<span>S/N:</span> <strong>${esc(item.serialNo)}</strong>`);

        if (metaBadges.length > 0) {
          nameHtml += `<div class="inv-turbo-meta">${metaBadges.join(' &nbsp;|&nbsp; ')}</div>`;
        }

        if (item.workDone) {
          nameHtml += `<div class="inv-turbo-work">${esc(item.workDone)}</div>`;
        }

        if (!nameHtml) {
          nameHtml = `<div class="inv-turbo-work">---</div>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="col-sno"><span class="sno-circle">${usedRows}</span></td>
          <td class="col-name"><div class="item-name-cell">${nameHtml}</div></td>
          <td class="col-hsn"></td>
          <td class="col-qty"></td>
          <td class="col-unit"></td>
          <td class="col-rate">${cost > 0 ? cost.toLocaleString('en-IN') : ''}</td>
          <td class="col-amt">${cost > 0 ? cost.toLocaleString('en-IN') : ''}</td>`;
        tbody.appendChild(tr);
      }
    });

    if (usedRows === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="col-sno"><span class="sno-circle">1</span></td>
        <td class="col-name">&nbsp;</td>
        <td class="col-hsn">&nbsp;</td>
        <td class="col-qty">&nbsp;</td>
        <td class="col-unit">&nbsp;</td>
        <td class="col-rate">&nbsp;</td>
        <td class="col-amt">&nbsp;</td>`;
      tbody.appendChild(tr);
    }

    const words = toWords(total);
    const fmtTotal = formatINR(total);
    $('pAmountWords').textContent = words;
    $('pTotalAmount').textContent = fmtTotal;
    $('summaryTotalAmount').textContent = fmtTotal;
    $('summaryAmountWords').textContent = words;
  }

  /* ── Increment Bill Number ─────────────── */
  function incNo() {
    const s = String(state.invoiceNo || '0').trim();
    const m = s.match(/^(.*?)(\d+)$/);
    if (m) {
      const prefix = m[1];
      const next = parseInt(m[2], 10) + 1;
      state.invoiceNo = prefix + String(next).padStart(m[2].length, '0');
    } else {
      state.invoiceNo = String((parseInt(s, 10) || 0) + 1);
    }
    $('invoiceNoInput').value = state.invoiceNo;
    localStorage.setItem(STORAGE.NEXT_INV_NO, state.invoiceNo);
    sync();
    pushSyncToCloud('inc_bill_no');
  }

  /* ── PDF Download (Requires Saved State) ──── */
  async function downloadPdf() {
    if (!state.isSaved) {
      toast('🔒 Please Save Bill to Notebook first.');
      return;
    }

    const filename = pdfFilename();
    const sheet = $('invoiceSheet');
    const btn = $('downloadPdfBtn');
    const origHTML = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `Generating ${filename}...`;

    const opt = {
      margin: [5, 5, 5, 5],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      if (typeof html2pdf !== 'undefined') {
        await html2pdf().set(opt).from(sheet).save();
        toast(`Downloaded ${filename}!`);
      } else {
        document.title = filename.replace('.pdf', '');
        window.print();
      }
    } catch (err) {
      console.error(err);
      document.title = filename.replace('.pdf', '');
      window.print();
    } finally {
      btn.disabled = false;
      btn.innerHTML = origHTML;
    }
  }

  /* ── PDF Share (Requires Saved State) ─────── */
  async function sharePdf() {
    if (!state.isSaved) {
      toast('🔒 Please Save Bill to Notebook first.');
      return;
    }

    const filename = pdfFilename();
    const sheet = $('invoiceSheet');
    const btn = $('sharePdfBtn');
    const origHTML = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = 'Preparing...';

    const opt = {
      margin: [5, 5, 5, 5],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      if (typeof html2pdf !== 'undefined') {
        const pdfBlob = await html2pdf().set(opt).from(sheet).output('blob');
        const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({
            files: [pdfFile],
            title: `Cash Bill #${state.invoiceNo}`,
            text: `M.K. Turbo Cash Bill #${state.invoiceNo} for ${state.customerName || 'Cash'}`
          });
          toast('Shared successfully!');
        } else {
          await html2pdf().set(opt).from(sheet).save();
          toast(`Downloaded ${filename} for sharing!`);
        }
      } else {
        window.print();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        await downloadPdf();
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = origHTML;
    }
  }

  function printInvoice() {
    if (!state.isSaved) {
      toast('🔒 Please Save Bill to Notebook first.');
      return;
    }
    document.title = pdfFilename().replace('.pdf', '');
    window.print();
  }

  /* ── FINANCE NOTEBOOK LOGIC & ANALYTICS ───── */
  function populateDateFilters(ledger) {
    const monthSelect = $('financeMonthFilter');
    const yearSelect = $('financeYearFilter');

    const monthsSet = new Set();
    const yearsSet = new Set();

    ledger.forEach(entry => {
      if (entry.date) {
        const p = entry.date.split('-');
        if (p.length === 3) {
          yearsSet.add(p[0]);
          monthsSet.add(`${p[0]}-${p[1]}`);
        }
      }
    });

    const currentMonthVal = monthSelect.value;
    const currentYearVal = yearSelect.value;

    monthSelect.innerHTML = '<option value="ALL">All Months</option>';
    yearSelect.innerHTML = '<option value="ALL">All Years</option>';

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    Array.from(monthsSet).sort().reverse().forEach(ym => {
      const [y, m] = ym.split('-');
      const mName = monthNames[parseInt(m, 10) - 1] || m;
      const opt = document.createElement('option');
      opt.value = ym;
      opt.textContent = `${mName} ${y}`;
      monthSelect.appendChild(opt);
    });

    Array.from(yearsSet).sort().reverse().forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `Year ${y}`;
      yearSelect.appendChild(opt);
    });

    if (currentMonthVal) monthSelect.value = currentMonthVal;
    if (currentYearVal) yearSelect.value = currentYearVal;
  }

  function renderFinanceLedger() {
    const ledger = getLedger();
    populateDateFilters(ledger);

    const query = (state.finance.searchQuery || '').toLowerCase().trim();
    const monthFilter = $('financeMonthFilter').value;
    const yearFilter = $('financeYearFilter').value;

    let filtered = ledger.filter(entry => {
      if (monthFilter !== 'ALL' && entry.date) {
        if (!entry.date.startsWith(monthFilter)) return false;
      }
      if (yearFilter !== 'ALL' && entry.date) {
        if (!entry.date.startsWith(yearFilter)) return false;
      }
      if (query) {
        const inv = String(entry.invoiceNo || '').toLowerCase();
        const cust = String(entry.customerName || '').toLowerCase();
        const notes = String(entry.notes || '').toLowerCase();
        const itemsStr = (entry.items || []).map(i => i.name || '').join(' ').toLowerCase();
        const match = inv.includes(query) || cust.includes(query) || notes.includes(query) || itemsStr.includes(query);
        if (!match) return false;
      }
      return true;
    });

    // Calculate Analytics
    let totalSales = 0;
    let totalCost = 0;
    let totalProfit = 0;

    filtered.forEach(entry => {
      const b = parseFloat(entry.billedAmount) || 0;
      const c = parseFloat(entry.actualCost) || 0;
      const p = b - c;
      totalSales += b;
      totalCost += c;
      totalProfit += p;
    });

    $('statTotalSales').textContent = formatINRSymbol(totalSales);
    $('statTotalCost').textContent = formatINRSymbol(totalCost);
    $('statTotalProfit').textContent = formatINRSymbol(totalProfit);

    $('statSalesCount').textContent = `${filtered.length} job${filtered.length === 1 ? '' : 's'} recorded`;
    const margin = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0;
    $('statProfitMargin').textContent = `Profit Margin: ${margin}%`;

    // Render Ledger Cards
    const container = $('financeLedgerList');
    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="text-align:center; padding: 40px 16px; color: #94a3b8;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;"><circle cx="12" cy="10" r="8"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p style="font-weight: 700; color: #475569;">No entries found in this period.</p>
          <p style="font-size: 0.76rem;">Saved cash bills automatically appear here, or tap "+ Add Entry".</p>
        </div>`;
      return;
    }

    filtered.forEach(entry => {
      const card = document.createElement('div');
      card.className = 'ledger-card';
      card.dataset.id = entry.id;

      const billed = parseFloat(entry.billedAmount) || 0;
      const cost = parseFloat(entry.actualCost) || 0;
      const profit = billed - cost;

      let turbosHtml = '';
      if (entry.items && entry.items.length > 0) {
        turbosHtml = entry.items.map(it => `
          <div class="ledger-turbo-item">
            <span class="turbo-item-name">&bull; ${esc(it.name)}</span>
            <span class="turbo-item-cost">${it.cost ? formatINR(it.cost) : ''}</span>
          </div>`).join('');
      } else {
        turbosHtml = `<div class="ledger-turbo-item"><span class="turbo-item-name">&bull; Turbo Servicing / Parts</span></div>`;
      }

      const profitClass = profit >= 0 ? 'profit-green' : 'profit-red';
      const profitPrefix = profit >= 0 ? '+' : '';

      card.innerHTML = `
        <div class="ledger-header">
          <div class="ledger-meta">
            <span class="ledger-inv-no">#${esc(entry.invoiceNo)}</span>
            <span class="ledger-date">${toDDMMYYYY(entry.date)}</span>
            <span class="ledger-customer">${esc(entry.customerName)}</span>
          </div>
          <!-- Action Buttons: Edit, Share, Delete -->
          <div class="ledger-actions">
            <button type="button" class="btn-card-action btn-card-edit" title="Edit Cash Bill #${esc(entry.invoiceNo)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
            <button type="button" class="btn-card-action btn-card-share" title="Download / Share PDF #${esc(entry.invoiceNo)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            <button type="button" class="btn-card-action btn-card-del" title="Delete record">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="ledger-turbos">
          ${turbosHtml}
        </div>

        <!-- Profit Calculation Bar -->
        <div class="ledger-calc-row">
          <div class="calc-block">
            <span class="calc-lbl">Billed / Sale</span>
            <span class="calc-val-billed">${formatINR(billed)}</span>
          </div>

          <div class="calc-block">
            <span class="calc-lbl">Our Actual Cost (&#8377;)</span>
            <input type="number" step="any" min="0" class="calc-cost-input" placeholder="Type cost &#8377;" value="${entry.actualCost !== undefined && entry.actualCost !== 0 ? entry.actualCost : ''}">
          </div>

          <div class="calc-block">
            <span class="calc-lbl">Your Profit</span>
            <span class="calc-val-profit ${profitClass}">${profitPrefix}${formatINR(profit)}</span>
          </div>
        </div>

        <div class="ledger-notes-row">
          <input type="text" class="inp notes-input" placeholder="Cost breakdown notes (e.g. Kit ₹3000, Lathe ₹500)" value="${esc(entry.notes || '')}">
        </div>`;

      const costInput = card.querySelector('.calc-cost-input');
      const profitEl = card.querySelector('.calc-val-profit');
      const notesInput = card.querySelector('.notes-input');
      const editBtn = card.querySelector('.btn-card-edit');
      const shareBtn = card.querySelector('.btn-card-share');
      const delBtn = card.querySelector('.btn-card-del');

      let costDebounceTimer = null;
      costInput.addEventListener('input', e => {
        const newCost = parseFloat(e.target.value) || 0;
        entry.actualCost = e.target.value;
        entry.profit = (parseFloat(entry.billedAmount) || 0) - newCost;

        const newProfit = entry.profit;
        profitEl.textContent = (newProfit >= 0 ? '+' : '') + formatINR(newProfit);
        profitEl.className = 'calc-val-profit ' + (newProfit >= 0 ? 'profit-green' : 'profit-red');

        saveLedger(ledger);
        updateFinanceStats(filtered);

        clearTimeout(costDebounceTimer);
        costDebounceTimer = setTimeout(() => {
          pushSyncToCloud('cost_update');
        }, 1200);
      });

      notesInput.addEventListener('input', e => {
        entry.notes = e.target.value;
        saveLedger(ledger);
      });

      editBtn.addEventListener('click', () => {
        loadBillForEditing(entry);
      });

      shareBtn.addEventListener('click', () => {
        downloadBillFromLedger(entry);
      });

      delBtn.addEventListener('click', () => {
        openDeleteConfirmModal(entry);
      });

      container.appendChild(card);
    });
  }

  function updateFinanceStats(entries) {
    let totalSales = 0, totalCost = 0, totalProfit = 0;
    entries.forEach(entry => {
      const b = parseFloat(entry.billedAmount) || 0;
      const c = parseFloat(entry.actualCost) || 0;
      totalSales += b;
      totalCost += c;
      totalProfit += (b - c);
    });
    $('statTotalSales').textContent = formatINRSymbol(totalSales);
    $('statTotalCost').textContent = formatINRSymbol(totalCost);
    $('statTotalProfit').textContent = formatINRSymbol(totalProfit);
    const margin = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0;
    $('statProfitMargin').textContent = `Profit Margin: ${margin}%`;
  }

  /* ── Load Bill for Editing ────────────────── */
  function loadBillForEditing(entry) {
    state.invoiceNo = entry.invoiceNo || '133';
    state.invoiceDate = entry.date || todayStr();
    state.customerName = (entry.customerName === 'Cash / Counter' || entry.customerName === 'Counter / Cash') ? '' : (entry.customerName || '');
    state.customerAddress = entry.customerAddress || '';

    if (entry.rawItems && entry.rawItems.length > 0) {
      state.items = entry.rawItems.map(it => ({
        id: uid(),
        turboName: it.turboName || '',
        modelNo: it.modelNo || '',
        partNo: it.partNo || '',
        serialNo: it.serialNo || '',
        workDone: it.workDone || '',
        cost: it.cost || ''
      }));
    } else if (entry.items && entry.items.length > 0) {
      state.items = entry.items.map(it => ({
        id: uid(),
        turboName: it.name || '',
        modelNo: '',
        partNo: '',
        serialNo: '',
        workDone: '',
        cost: it.cost || ''
      }));
    } else {
      state.items = [{ id: uid(), turboName: '', modelNo: '', partNo: '', serialNo: '', workDone: '', cost: '' }];
    }

    $('invoiceNoInput').value = state.invoiceNo;
    $('invoiceDateInput').value = state.invoiceDate;
    $('customerNameInput').value = state.customerName;
    $('customerAddressInput').value = state.customerAddress;

    renderRows();
    sync();

    // Mark saved since loaded from ledger
    setSavedState(true);

    switchView('invoice');
    toast(`Loaded Cash Bill #${state.invoiceNo} (Saved)`);
  }

  /* ── Direct PDF Download from Ledger ──────── */
  async function downloadBillFromLedger(entry) {
    loadBillForEditing(entry);

    const filename = pdfFilename(entry.invoiceNo);
    toast(`Generating ${filename}...`, 1800);

    const sheet = $('invoiceSheet');
    const opt = {
      margin: [5, 5, 5, 5],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      if (typeof html2pdf !== 'undefined') {
        await html2pdf().set(opt).from(sheet).save();
        toast(`Downloaded ${filename}!`);
      } else {
        document.title = filename.replace('.pdf', '');
        window.print();
      }
    } catch (err) {
      console.error(err);
      toast('Print dialog opened');
      window.print();
    }
  }

  /* ── Confirm Delete Modal Logic ───────────── */
  function openDeleteConfirmModal(entry) {
    state.finance.pendingDeleteId = entry.id;
    const cust = entry.customerName || 'Cash';
    $('deleteConfirmText').innerHTML = `Do you really want to delete <strong>Bill #${esc(entry.invoiceNo)}</strong> for <strong>${esc(cust)}</strong>?<br><span style="font-size:0.75rem; color:#94a3b8;">This cannot be undone.</span>`;
    $('deleteConfirmModal').classList.add('open');
  }

  function closeDeleteConfirmModal() {
    $('deleteConfirmModal').classList.remove('open');
    state.finance.pendingDeleteId = null;
  }

  function executeDeleteEntry() {
    const targetId = state.finance.pendingDeleteId;
    if (!targetId) return;

    const ledger = getLedger();
    const idx = ledger.findIndex(e => e.id === targetId);
    if (idx >= 0) {
      const removed = ledger.splice(idx, 1)[0];
      saveLedger(ledger);
      renderFinanceLedger();
      pushSyncToCloud('delete_entry');
      toast(`Deleted Bill #${removed.invoiceNo}`);
    }
    closeDeleteConfirmModal();
  }

  /* ── Export Finance Ledger to CSV / Excel ─── */
  function exportLedgerToCsv() {
    const ledger = getLedger();
    if (ledger.length === 0) {
      toast('No finance entries to export.');
      return;
    }

    const headers = ['Date', 'Bill No', 'Customer Name', 'Turbos & Work Done', 'Billed Amount (INR)', 'Our Actual Cost (INR)', 'Net Profit (INR)', 'Expense Notes'];
    const rows = [headers];

    ledger.forEach(entry => {
      const itemsText = (entry.items || []).map(i => i.name).join('; ');
      const billed = parseFloat(entry.billedAmount) || 0;
      const cost = parseFloat(entry.actualCost) || 0;
      const profit = billed - cost;

      rows.push([
        toDDMMYYYY(entry.date),
        entry.invoiceNo || '',
        `"${(entry.customerName || '').replace(/"/g, '""')}"`,
        `"${itemsText.replace(/"/g, '""')}"`,
        billed,
        cost,
        profit,
        `"${(entry.notes || '').replace(/"/g, '""')}"`
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MKTURBO_FINANCE_BOOK_${todayStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast('Downloaded Excel / CSV Finance Book!');
  }

  /* ── Manual Entry Modal (For Finance Book) ─ */
  function openManualModal() {
    $('mDateInput').value = todayStr();
    $('mInvNoInput').value = '';
    $('mCustomerInput').value = '';
    $('mTurboNameInput').value = '';
    $('mModelNoInput').value = '';
    $('mTurboNoInput').value = '';
    $('mSerialNoInput').value = '';
    $('mWorkDoneInput').value = '';
    $('mBilledAmountInput').value = '';
    $('mActualCostInput').value = '';
    $('mNotesInput').value = '';

    $('manualEntryModal').classList.add('open');
  }

  function closeManualModal() {
    $('manualEntryModal').classList.remove('open');
  }

  function saveManualEntry() {
    const billed = parseFloat($('mBilledAmountInput').value) || 0;
    const cost = parseFloat($('mActualCostInput').value) || 0;

    const turboName = $('mTurboNameInput').value.trim();
    const modelNo = $('mModelNoInput').value.trim();
    const turboNo = $('mTurboNoInput').value.trim();
    const serialNo = $('mSerialNoInput').value.trim();
    const work = $('mWorkDoneInput').value.trim();

    const dummyItem = { turboName, modelNo, partNo: turboNo, serialNo, workDone: work };
    const desc = formatItemSummary(dummyItem) || 'Turbo Service';

    const entry = {
      id: uid(),
      invoiceNo: $('mInvNoInput').value.trim() || 'Direct',
      date: $('mDateInput').value || todayStr(),
      customerName: $('mCustomerInput').value.trim() || 'Counter / Cash',
      items: [{ name: desc, cost: billed }],
      rawItems: [{
        turboName,
        modelNo,
        partNo: turboNo,
        serialNo,
        workDone: work,
        cost: billed ? String(billed) : ''
      }],
      billedAmount: billed,
      actualCost: cost,
      profit: billed - cost,
      notes: $('mNotesInput').value.trim(),
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const ledger = getLedger();
    ledger.unshift(entry);
    saveLedger(ledger);
    pushSyncToCloud('manual_entry');

    closeManualModal();
    renderFinanceLedger();
    toast('Saved to Finance Notebook!');
  }

  /* ── Sample & Reset for Cash Bill Generator ─── */
  function loadSample() {
    state.invoiceNo = '133';
    state.invoiceDate = todayStr();
    state.customerName = 'Santosh Engineering Works';
    state.customerAddress = 'Industrial Estate, Auto Nagar, Gajuwaka, Visakhapatnam';
    state.items = [
      { id: uid(), turboName: 'Holset Turbo', modelNo: 'HX35', partNo: '4031509', serialNo: 'SN-8821', workDone: 'Turbo Repair Kit R/P', cost: '3500' },
      { id: uid(), turboName: 'Holset Turbo', modelNo: 'HX40', partNo: '4031528', serialNo: 'SN-9442', workDone: 'Core Assy & Remachining', cost: '14500' },
      { id: uid(), turboName: '', modelNo: '', partNo: '', serialNo: '', workDone: 'Bus Charges & Uber chg (500+500)', cost: '1000' }
    ];
    $('invoiceNoInput').value = state.invoiceNo;
    $('invoiceDateInput').value = state.invoiceDate;
    $('customerNameInput').value = state.customerName;
    $('customerAddressInput').value = state.customerAddress;
    renderRows(); sync();
    setSavedState(false);
    toast('Loaded sample cash bill #133 (Tap "Save Bill" to save & enable download)');
  }

  function newInvoice() {
    state.invoiceDate = todayStr();
    state.customerName = '';
    state.customerAddress = '';
    state.items = [{ id: uid(), turboName: '', modelNo: '', partNo: '', serialNo: '', workDone: '', cost: '' }];
    $('invoiceDateInput').value = state.invoiceDate;
    $('customerNameInput').value = '';
    $('customerAddressInput').value = '';
    renderRows(); sync();
    setSavedState(false);
    toast(`Ready — Cash Bill #${state.invoiceNo}`);
  }

  function startNextBill() {
    incNo();
    newInvoice();
  }

  /* ── CLOUD SYNC & BACKUP ENGINE ────────────── */
  function getSyncCode() {
    return localStorage.getItem(STORAGE.SYNC_CODE) || 'MKTURBO-GAJUWAKA-530026';
  }

  function getFirebaseUrl() {
    return localStorage.getItem(STORAGE.FIREBASE_URL) || '';
  }

  function setSyncStatus(status, timeStr = '') {
    const btn = $('cloudSyncBtn');
    const dot = $('syncStatusDot');
    const label = $('syncStatusText');
    const mDot = $('modalSyncDot');
    const mTitle = $('modalSyncStatusTitle');
    const mTime = $('modalLastSyncTime');

    if (btn) btn.className = `btn-sync-pill ${status}`;
    if (dot) dot.className = `sync-dot ${status}`;
    if (mDot) mDot.className = `status-indicator-dot ${status}`;

    const savedTime = localStorage.getItem(STORAGE.LAST_SYNC);
    const displayTime = timeStr || (savedTime ? new Date(savedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never');

    if (status === 'synced') {
      if (label) label.textContent = 'Cloud Synced';
      if (mTitle) mTitle.textContent = 'Cloud Connected & Synced';
      if (mTime) mTime.textContent = displayTime;
    } else if (status === 'syncing') {
      if (label) label.textContent = 'Syncing...';
      if (mTitle) mTitle.textContent = 'Syncing with Cloud...';
    } else {
      if (label) label.textContent = 'Offline (Local)';
      if (mTitle) mTitle.textContent = 'Offline (Saved Locally)';
      if (mTime) mTime.textContent = displayTime;
    }
  }

  async function pushSyncToCloud(reason = 'save') {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('syncing');

    const ledger = getLedger();
    const payload = {
      syncCode: getSyncCode(),
      nextInvoiceNo: state.invoiceNo,
      ledger: ledger,
      version: Date.now(),
      updatedAt: new Date().toISOString(),
      reason: reason
    };

    saveVersionSnapshot(payload);

    let success = false;

    // 1. Sync to local server background endpoint with disk backup
    try {
      const res = await fetch('./api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) success = true;
    } catch (e) {
      // Local server might not be running or on different device
    }

    // 2. Sync to Firebase Realtime DB REST endpoint (if configured)
    const fbUrl = getFirebaseUrl();
    if (fbUrl) {
      try {
        const cleanUrl = fbUrl.replace(/\/+$/, '') + `/workshops/${encodeURIComponent(getSyncCode())}.json`;
        const fbRes = await fetch(cleanUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (fbRes.ok) success = true;
      } catch (err) {
        console.warn('Firebase sync error:', err);
      }
    }

    const now = new Date();
    localStorage.setItem(STORAGE.LAST_SYNC, now.toISOString());
    setSyncStatus(success || navigator.onLine ? 'synced' : 'offline', now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    renderVersionHistory();
  }

  async function pullSyncFromCloud() {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    let remotePayload = null;

    // Try Firebase first if set
    const fbUrl = getFirebaseUrl();
    if (fbUrl) {
      try {
        const cleanUrl = fbUrl.replace(/\/+$/, '') + `/workshops/${encodeURIComponent(getSyncCode())}.json`;
        const res = await fetch(cleanUrl);
        if (res.ok) {
          remotePayload = await res.json();
        }
      } catch (e) {}
    }

    // Fallback to local server
    if (!remotePayload) {
      try {
        const res = await fetch('./api/sync');
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'ok' && json.data) {
            remotePayload = json.data;
          }
        }
      } catch (e) {}
    }

    if (remotePayload && remotePayload.ledger) {
      mergeRemoteData(remotePayload);
    }
  }

  function mergeRemoteData(remote) {
    const localLedger = getLedger();
    const remoteLedger = remote.ledger || [];

    const map = new Map();
    localLedger.forEach(item => map.set(item.id, item));
    remoteLedger.forEach(item => {
      map.set(item.id, item);
    });

    const merged = Array.from(map.values()).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    saveLedger(merged);

    if (remote.nextInvoiceNo && parseInt(remote.nextInvoiceNo) > parseInt(state.invoiceNo || '0')) {
      state.invoiceNo = remote.nextInvoiceNo;
      localStorage.setItem(STORAGE.NEXT_INV_NO, state.invoiceNo);
      $('invoiceNoInput').value = state.invoiceNo;
      sync();
    }

    renderFinanceLedger();
    setSyncStatus('synced');
  }

  function saveVersionSnapshot(payload) {
    try {
      let history = JSON.parse(localStorage.getItem(STORAGE.HISTORY) || '[]');
      history.unshift({
        time: payload.updatedAt,
        desc: `${payload.ledger.length} bills backed up (${payload.reason})`,
        count: payload.ledger.length
      });
      if (history.length > 20) history = history.slice(0, 20);
      localStorage.setItem(STORAGE.HISTORY, JSON.stringify(history));
    } catch (e) {}
  }

  function renderVersionHistory() {
    const container = $('syncHistoryList');
    if (!container) return;
    try {
      const history = JSON.parse(localStorage.getItem(STORAGE.HISTORY) || '[]');
      if (history.length === 0) {
        container.innerHTML = '<div style="padding:12px; color:#94a3b8; text-align:center; font-size:0.75rem;">No version snapshots yet.</div>';
        return;
      }
      container.innerHTML = history.map(item => {
        const d = new Date(item.time);
        const tStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
          <div class="history-item">
            <div>
              <div class="history-desc">${esc(item.desc)}</div>
              <div class="history-time">${tStr}</div>
            </div>
            <span class="history-tag">Saved</span>
          </div>
        `;
      }).join('');
    } catch (e) {}
  }

  function exportBackupJson() {
    const payload = {
      workshop: 'M.K. TURBO ENGINEERING & SERVICING CENTRE',
      syncCode: getSyncCode(),
      exportedAt: new Date().toISOString(),
      nextInvoiceNo: state.invoiceNo,
      ledger: getLedger(),
      appVersion: '2.0-PWA'
    };

    const str = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', str);
    link.setAttribute('download', `MKTURBO_CLOUD_BACKUP_${todayStr()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('💾 Complete backup downloaded!');
  }

  function restoreBackupFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        if (!data || !Array.isArray(data.ledger)) {
          alert('Invalid backup file. Missing ledger records.');
          return;
        }

        if (confirm(`Restore ${data.ledger.length} bills from backup file? Existing records will be updated.`)) {
          mergeRemoteData(data);
          pushSyncToCloud('file_restore');
          closeCloudSyncModal();
          toast(`✅ Restored ${data.ledger.length} bills from backup!`);
        }
      } catch (err) {
        alert('Could not read backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function openCloudSyncModal() {
    $('workshopSyncCodeInput').value = getSyncCode();
    $('firebaseDbUrlInput').value = getFirebaseUrl();
    renderVersionHistory();

    const ledger = getLedger();
    let totalAmt = 0;
    ledger.forEach(l => totalAmt += (parseFloat(l.billedAmount) || 0));
    $('modalSyncSummary').textContent = `${ledger.length} cash bills saved (${formatINRSymbol(totalAmt)} billed total).`;

    $('cloudSyncModal').classList.add('open');
  }

  function closeCloudSyncModal() {
    $('cloudSyncModal').classList.remove('open');
  }

  /* ── PROGRESSIVE WEB APP (PWA) INSTALL ─────── */
  let deferredInstallPrompt = null;

  function initPwa() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration error:', err));
    }

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const btn = $('installAppBtn');
      if (btn) btn.style.display = 'inline-flex';
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      toast('M.K. Turbo App installed successfully!');
      const btn = $('installAppBtn');
      if (btn) btn.innerHTML = '<span>✓ Installed</span>';
    });
  }

  function handleInstallApp() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') {
          toast('Installing M.K. Turbo App...');
        }
        deferredInstallPrompt = null;
      });
    } else {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIos) {
        $('installIosModal').classList.add('open');
      } else {
        toast('To install: Tap browser menu (⋮) -> "Add to Home screen" or "Install App"');
      }
    }
  }

  /* ── Initialize Event Listeners ───────────── */
  function initEvents() {
    // 2-in-1 Tabs
    $('tabInvoiceBtn').addEventListener('click', () => switchView('invoice'));
    $('tabFinanceBtn').addEventListener('click', () => switchView('finance'));

    // PWA & Cloud Hub
    $('installAppBtn').addEventListener('click', handleInstallApp);
    $('closeIosInstallBtn').addEventListener('click', () => $('installIosModal').classList.remove('open'));
    $('cloudSyncBtn').addEventListener('click', openCloudSyncModal);
    $('closeCloudSyncModal').addEventListener('click', closeCloudSyncModal);

    $('manualSyncNowBtn').addEventListener('click', () => {
      toast('Syncing with Cloud...');
      pushSyncToCloud('manual_refresh');
      pullSyncFromCloud();
      setTimeout(() => toast('✅ Synced with Cloud!'), 800);
    });

    $('backupJsonBtn').addEventListener('click', exportBackupJson);
    $('restoreFileInput').addEventListener('change', restoreBackupFile);

    $('applySyncCodeBtn').addEventListener('click', () => {
      const code = $('workshopSyncCodeInput').value.trim() || 'MKTURBO-GAJUWAKA-530026';
      localStorage.setItem(STORAGE.SYNC_CODE, code);
      toast(`Workshop Sync Code saved: ${code}`);
      pushSyncToCloud('code_update');
    });

    $('saveFirebaseUrlBtn').addEventListener('click', () => {
      const url = $('firebaseDbUrlInput').value.trim();
      localStorage.setItem(STORAGE.FIREBASE_URL, url);
      toast(url ? 'Connected Firebase URL!' : 'Cleared Firebase URL (Using default local sync)');
      pushSyncToCloud('firebase_url_update');
    });

    // PIN Lock Modal
    $('submitPinBtn').addEventListener('click', verifyPin);
    $('cancelPinBtn').addEventListener('click', closePinModal);
    $('pinInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); verifyPin(); }
    });
    $('relockFinanceBtn').addEventListener('click', lockFinanceNotebook);

    // Delete Confirm Modal
    $('cancelDeleteBtn').addEventListener('click', closeDeleteConfirmModal);
    $('confirmDeleteBtn').addEventListener('click', executeDeleteEntry);

    // Save Bill Action
    $('saveBillBtn').addEventListener('click', handleSaveBill);

    // Cash Bill Form Inputs (Any change triggers unsaved state)
    $('invoiceNoInput').addEventListener('input', e => {
      state.invoiceNo = e.target.value;
      localStorage.setItem(STORAGE.NEXT_INV_NO, state.invoiceNo);
      setSavedState(false);
      sync();
    });

    $('nextNoBtn').addEventListener('click', () => {
      incNo();
      setSavedState(false);
      toast(`Next: Cash Bill #${state.invoiceNo}`);
    });

    $('invoiceDateInput').addEventListener('change', e => {
      state.invoiceDate = e.target.value;
      setSavedState(false);
      sync();
    });

    $('todayBtn').addEventListener('click', () => {
      state.invoiceDate = todayStr();
      $('invoiceDateInput').value = state.invoiceDate;
      setSavedState(false);
      sync();
      toast('Date reset to today');
    });

    $('customerNameInput').addEventListener('input', e => {
      state.customerName = e.target.value;
      setSavedState(false);
      sync();
    });

    $('customerAddressInput').addEventListener('input', e => {
      state.customerAddress = e.target.value;
      setSavedState(false);
      sync();
    });

    $('addProductBtn').addEventListener('click', () => addRow(true));
    $('downloadPdfBtn').addEventListener('click', downloadPdf);
    $('sharePdfBtn').addEventListener('click', sharePdf);
    $('printBtn').addEventListener('click', printInvoice);
    $('startNextBillBtn').addEventListener('click', startNextBill);
    $('loadSampleBtn').addEventListener('click', loadSample);
    $('resetBtn').addEventListener('click', newInvoice);

    // Finance Filters
    $('financeSearchInput').addEventListener('input', e => {
      state.finance.searchQuery = e.target.value;
      renderFinanceLedger();
    });

    $('financeMonthFilter').addEventListener('change', () => renderFinanceLedger());
    $('financeYearFilter').addEventListener('change', () => renderFinanceLedger());
    $('exportCsvBtn').addEventListener('click', exportLedgerToCsv);

    // Manual Entry Modal
    $('addManualFinanceBtn').addEventListener('click', openManualModal);
    $('closeManualModal').addEventListener('click', closeManualModal);
    $('cancelManualModalBtn').addEventListener('click', closeManualModal);
    $('saveManualEntryBtn').addEventListener('click', saveManualEntry);

    // Auto-sync listeners
    window.addEventListener('online', () => {
      toast('🌐 Online — Syncing with Cloud...');
      pushSyncToCloud('online_event');
      pullSyncFromCloud();
    });

    window.addEventListener('offline', () => {
      setSyncStatus('offline');
      toast('⚠️ Offline — Changes will be saved locally');
    });

    window.addEventListener('focus', () => {
      pullSyncFromCloud();
    });
  }

  /* ── Bootstrap ───────────────────────────── */
  function init() {
    $('invoiceNoInput').value = state.invoiceNo;
    $('invoiceDateInput').value = state.invoiceDate;
    renderRows();
    sync();
    setSavedState(false);
    initEvents();
    initPwa();

    // Check cloud sync on load
    setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    pullSyncFromCloud();

    if (state.activeView === 'finance' && !isFinanceUnlocked()) {
      switchView('invoice');
    } else {
      switchView(state.activeView);
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();
