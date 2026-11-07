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
    HISTORY: 'mkturbo_version_history',
    DELETED_IDS: 'mkturbo_deleted_ids'
  };

  // State
  const state = {
    activeView: localStorage.getItem(STORAGE.LAST_VIEW) || 'invoice', // 'invoice' | 'finance'
    billType: 'cash', // 'cash' | 'estimation'
    invoiceNo: localStorage.getItem(STORAGE.NEXT_INV_NO) || '133',
    invoiceDate: todayStr(),
    customerName: '',
    customerAddress: '',
    editingLedgerId: null, // Tracks if currently editing an existing ledger bill
    isSaved: false, // Save mechanism state
    items: [
      { id: uid(), turboName: '', modelNo: '', partNo: '', serialNo: '', workDone: '', cost: '', discount: '' }
    ],
    finance: {
      searchQuery: '',
      statusFilter: 'ALL', // 'ALL' | 'cash' | 'estimation'
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

  function formatNet(cost, disc) {
    const c = parseFloat(cost) || 0;
    const d = parseFloat(disc) || 0;
    const net = Math.max(0, c - d);
    return net > 0 ? ('\u20B9 ' + net.toLocaleString('en-IN')) : '\u20B9 0';
  }

  function pdfFilename(no) {
    if (state.billType === 'estimation') {
      const cust = (state.customerName || 'ESTIMATE').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'QUOTE';
      return `MKTURBO_ESTIMATION_${cust}.pdf`;
    }
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
    const isEdit = Boolean(state.editingLedgerId);
    const isEstimate = state.billType === 'estimation';
    const docLabel = isEstimate ? 'Estimate' : 'Bill';

    const saveBtn = $('saveBillBtn');
    const saveBtnText = $('saveBillBtnText');
    if (saveBtn) saveBtn.className = isSaved ? 'btn-save-bill saved' : 'btn-save-bill unsaved';
    if (saveBtnText) {
      saveBtnText.textContent = isEdit ? `Update ${docLabel} in Notebook` : `Save ${docLabel} to Notebook`;
    }
  }

  /* ── Document Type Switcher (Cash Bill vs Estimation Bill) ── */
  function setBillType(type, silent = false) {
    state.billType = type === 'estimation' ? 'estimation' : 'cash';
    const isEst = state.billType === 'estimation';

    const btnCash = $('btnTypeCashBill');
    const btnEst = $('btnTypeEstimation');
    if (btnCash) btnCash.classList.toggle('active', !isEst);
    if (btnEst) {
      btnEst.classList.toggle('active', isEst);
      btnEst.classList.toggle('type-estimate', isEst);
    }

    const hint = $('docTypeHint');
    if (hint) {
      hint.innerHTML = isEst
        ? '⚠️ <strong>Estimation Quote Mode:</strong> No bill number assigned &bull; Money is <em>blocked</em> in Notebook until converted to Cash Bill'
        : 'Official serial bill with tax/profit tracking &bull; Added to Finance Book';
    }

    const docTitle = $('pDocTitle');
    if (docTitle) docTitle.textContent = isEst ? 'ESTIMATION' : 'CASH BILL';

    const pNo = $('pInvoiceNo');
    const pLbl = $('pInvoiceNoLbl');
    const invInput = $('invoiceNoInput');
    const nextBtn = $('nextNoBtn');

    if (isEst) {
      if (pLbl) pLbl.textContent = 'Estimate';
      if (pNo) {
        pNo.textContent = 'ESTIMATE';
        pNo.className = 'inv-no-stamp inv-stamp-estimate';
      }
      if (invInput) {
        invInput.value = 'ESTIMATE';
        invInput.disabled = true;
      }
      if (nextBtn) nextBtn.style.display = 'none';
    } else {
      if (pLbl) pLbl.textContent = 'Bill No.';
      if (pNo) {
        pNo.textContent = state.invoiceNo || '---';
        pNo.className = 'inv-no-stamp';
      }
      if (invInput) {
        invInput.value = state.invoiceNo || '133';
        invInput.disabled = false;
      }
      if (nextBtn) nextBtn.style.display = 'inline-flex';
    }

        setSavedState(state.isSaved);
    sync();

    if (!silent) {
      toast(isEst ? '📋 Switched to Estimation Bill (No Bill No. & Blocked)' : '📄 Switched to Official Cash Bill');
    }
    updateBillStatusBadge();
  }

  /* ── Dynamic Bill Status Badge (Auto / Edit / Estimate) ── */
  function updateBillStatusBadge() {
    const pill = $('billAutoStatusPill');
    const text = $('billAutoStatusText');
    const cancelBtn = $('cancelEditBillBtn');
    if (!pill || !text) return;

    if (state.billType === 'estimation') {
      pill.className = 'bill-auto-status-pill estimate';
      text.textContent = 'Estimation Quote (No Bill Number)';
      if (cancelBtn) cancelBtn.style.display = 'none';
    } else if (state.editingLedgerId) {
      pill.className = 'bill-auto-status-pill editing';
      text.textContent = `Editing Cash Bill #${state.invoiceNo || '---'}`;
      if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    } else {
      pill.className = 'bill-auto-status-pill';
      text.textContent = '⚡ Auto-assigned on Save (Highest + 1)';
      if (cancelBtn) cancelBtn.style.display = 'none';
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
    switchView('workspace');
    toast('🔒 Finance Notebook Locked');
  }

  /* ── Workspace Apps & View Navigation ───────────── */
  function switchView(viewName) {
    if (viewName === 'finance' && !isFinanceUnlocked()) {
      promptFinancePin();
      return;
    }

    state.activeView = viewName;
    localStorage.setItem(STORAGE.LAST_VIEW, viewName);

    const isWorkspace = viewName === 'workspace';
    const isInvoice = viewName === 'invoice';
    const isFinance = viewName === 'finance';

    if ($('viewWorkspace')) $('viewWorkspace').style.display = isWorkspace ? 'block' : 'none';
    if ($('viewInvoice')) $('viewInvoice').style.display = isInvoice ? 'block' : 'none';
    if ($('viewFinance')) $('viewFinance').style.display = isFinance ? 'block' : 'none';

    if ($('tabWorkspaceBtn')) $('tabWorkspaceBtn').classList.toggle('active', isWorkspace);
    if ($('tabInvoiceBtn')) $('tabInvoiceBtn').classList.toggle('active', isInvoice);
    if ($('tabFinanceBtn')) $('tabFinanceBtn').classList.toggle('active', isFinance);

    if (isFinance) {
      renderFinanceLedger();
    }
  }

  /* ── Finance Ledger Data Access ───────────── */
    function getDeletedIds() {
    try {
      const data = localStorage.getItem(STORAGE.DELETED_IDS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function addDeletedId(id) {
    if (!id) return;
    const list = getDeletedIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(STORAGE.DELETED_IDS, JSON.stringify(list));
    }
  }

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

  /* ── Auto-Sync Current Bill/Estimate to Finance Book ── */
  function syncInvoiceToFinanceBook() {
    let billedTotal = 0;
    let subtotalSum = 0;
    let discountSum = 0;
    const itemsSummary = [];
    const rawItems = [];

    state.items.forEach(item => {
      const cost = parseFloat(item.cost) || 0;
      const discount = parseFloat(item.discount) || 0;
      const net = Math.max(0, cost - discount);
      const hasContent = item.turboName || item.modelNo || item.partNo || item.serialNo || item.workDone || cost > 0 || discount > 0;
      if (hasContent) {
        subtotalSum += cost;
        discountSum += discount;
        billedTotal += net;

        let desc = formatItemSummary(item);
        if (discount > 0) {
          desc += ` (Disc: ₹${discount})`;
        }
        itemsSummary.push({
          name: desc,
          cost: net,
          originalPrice: cost,
          discount: discount
        });
        rawItems.push({
          turboName: item.turboName || '',
          modelNo: item.modelNo || '',
          partNo: item.partNo || '',
          serialNo: item.serialNo || '',
          workDone: item.workDone || '',
          cost: item.cost || '',
          discount: item.discount || ''
        });
      }
    });

    const isEstimate = state.billType === 'estimation';
    const ledger = getLedger();
    let invNo = '';

    if (isEstimate) {
      invNo = 'ESTIMATE';
      state.invoiceNo = 'ESTIMATE';
    } else if (state.editingLedgerId) {
      const existing = ledger.find(e => e.id === state.editingLedgerId);
      invNo = existing && existing.invoiceNo ? existing.invoiceNo : (state.invoiceNo || '133');
      state.invoiceNo = invNo;
    } else {
      // NEW CASH BILL:
      // Dynamically calculate the highest invoice number from previous data AT THIS PARTICULAR TIME and add +1!
      const highestNum = getHighestInvoiceNumber(ledger);
      invNo = String(highestNum + 1);
      state.invoiceNo = invNo;
    }

    // Set printable document preview values
    if ($('pInvoiceNo')) {
      $('pInvoiceNo').textContent = isEstimate ? 'ESTIMATE' : invNo;
      $('pInvoiceNo').className = isEstimate ? 'inv-no-stamp inv-stamp-estimate' : 'inv-no-stamp';
    }
    if ($('invoiceNoInput')) $('invoiceNoInput').value = invNo;
    sync();

    // Match by editingLedgerId FIRST, then by invoiceNo (if not estimate)
    let existingIndex = -1;
    if (state.editingLedgerId) {
      existingIndex = ledger.findIndex(e => e.id === state.editingLedgerId);
    }
    if (existingIndex < 0 && !isEstimate) {
      existingIndex = ledger.findIndex(e => String(e.invoiceNo).trim() === invNo);
    }

    if (existingIndex >= 0) {
      // UPDATE EXISTING RECORD IN-PLACE - NEVER CREATE DUPLICATE
      const existing = ledger[existingIndex];
      existing.invoiceNo = invNo;
      existing.billType = state.billType;
      existing.isEstimation = isEstimate;
      existing.date = state.invoiceDate;
      existing.customerName = state.customerName.trim() || 'Cash / Counter';
      existing.customerAddress = state.customerAddress.trim();
      existing.items = itemsSummary;
      existing.rawItems = rawItems;
      existing.subtotal = subtotalSum;
      existing.totalDiscount = discountSum;
      existing.billedAmount = billedTotal;
      const cost = parseFloat(existing.actualCost) || 0;
      existing.profit = billedTotal - cost;
      existing.updatedAt = new Date().toISOString();
      ledger[existingIndex] = existing;
    } else {
      // Create new bill entry only when not editing
      const newEntry = {
        id: uid(),
        invoiceNo: invNo,
        billType: state.billType,
        isEstimation: isEstimate,
        date: state.invoiceDate,
        customerName: state.customerName.trim() || 'Cash / Counter',
        customerAddress: state.customerAddress.trim(),
        items: itemsSummary,
        rawItems: rawItems,
        subtotal: subtotalSum,
        totalDiscount: discountSum,
        billedAmount: billedTotal,
        actualCost: 0,
        profit: billedTotal,
        notes: '',
        source: isEstimate ? 'estimate' : 'cashbill',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      ledger.unshift(newEntry);
    }

    saveLedger(ledger);
    if (!isEstimate) {
      const nextNo = computeNextInvoiceNo(ledger);
      localStorage.setItem(STORAGE.NEXT_INV_NO, nextNo);
    }
    pushSyncToCloud(state.editingLedgerId ? 'bill_update' : (isEstimate ? 'estimate_save' : 'bill_save'));
    return existingIndex >= 0 ? ledger[existingIndex] : ledger[0];
  }

  let lastSavedRecord = null;

  function openSaveSuccessModal(entry, wasEditing) {
    if (!entry) return;
    const modal = $('saveSuccessModal');
    if (!modal) return;

    const isEst = Boolean(entry.isEstimation || entry.billType === 'estimation');
    const badge = $('saveModalBadgeIcon');
    const title = $('saveModalTitle');
    const sub = $('saveModalSubtitle');
    const cust = $('saveModalCustomerName');
    const doc = $('saveModalDocType');
    const date = $('saveModalDate');
    const amount = $('saveModalAmount');
    const nextText = $('saveModalNextText');

    if (badge) {
      badge.textContent = isEst ? '📋' : '✓';
      badge.className = 'save-badge-icon ' + (isEst ? 'estimate' : 'cash');
    }

    if (title) {
      if (isEst) {
        title.textContent = wasEditing ? 'Estimation Quote Updated!' : 'Estimation Quote Saved!';
      } else {
        title.textContent = wasEditing ? `Cash Bill #${entry.invoiceNo} Updated!` : `Cash Bill #${entry.invoiceNo} Saved!`;
      }
    }

    if (sub) {
      sub.textContent = isEst
        ? 'Recorded in Personal Finance Book (Money Blocked until converted)'
        : 'Recorded in Personal Finance Book & Cloud Synced';
    }

    if (cust) cust.textContent = entry.customerName || 'Cash / Counter';
    if (doc) doc.textContent = isEst ? 'Estimation Quote' : `Cash Bill #${entry.invoiceNo}`;
    if (date) date.textContent = toDDMMYYYY(entry.date);
    if (amount) amount.textContent = formatINR(entry.billedAmount);

    if (nextText) {
      const nextNo = state.invoiceNo;
      nextText.innerHTML = isEst
        ? 'Form is cleared and ready for next job.'
        : 'Form is cleared and ready for next job (Bill No. automatically assigned on save).';
    }

    modal.classList.add('open');
  }

  function closeSaveSuccessModal() {
    const modal = $('saveSuccessModal');
    if (modal) modal.classList.remove('open');
  }

  /* ── User Action: Save Bill Button Click ───── */
  function handleSaveBill() {
    let hasContent = false;
    state.items.forEach(item => {
      const cost = parseFloat(item.cost) || 0;
      const discount = parseFloat(item.discount) || 0;
      if (item.turboName || item.modelNo || item.partNo || item.serialNo || item.workDone || cost > 0 || discount > 0) {
        hasContent = true;
      }
    });

    if (!hasContent && !state.customerName.trim()) {
      toast('Please enter at least one product or cost before saving.');
      return;
    }

    const wasEditing = Boolean(state.editingLedgerId);
    const isEstimate = state.billType === 'estimation';

    // 1. Save entry to finance ledger & sync with cloud
    const saved = syncInvoiceToFinanceBook();
    lastSavedRecord = saved;

    // 2. Clear form so it is fresh, blank for the next job
    newInvoice(false);

    // 3. Immediately exit Bill Generator back to Workspace Hub!
    switchView('workspace');

    // 4. Open Success Modal with Download, Share, Print, and Cross button!
    openSaveSuccessModal(saved, wasEditing);

    if (isEstimate) {
      toast(wasEditing ? '✅ Estimation Quote updated in Notebook (Blocked)' : '✅ Estimation saved in Notebook! (Money Blocked)');
    } else {
      toast(wasEditing ? `✅ Cash Bill #${saved.invoiceNo} updated!` : `✅ Cash Bill #${saved.invoiceNo} saved! Form ready for #${state.invoiceNo}`);
    }
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

        <!-- Row 3: What we have done -->
        <div class="prod-inputs-grid mt-1">
          <div class="field-item flex-grow">
            <label class="input-tag">What we have done (Work / Parts)</label>
            <input type="text" class="inp prod-work-done" placeholder="e.g. Repair Kit R/P, Core Assy &amp; Remachining" value="${esc(item.workDone)}">
          </div>
        </div>

        <!-- Row 4: Pricing Grid (Rate, Discount, Net Amount) -->
        <div class="prod-pricing-grid mt-1">
          <div class="field-item">
            <label class="input-tag">Price / Rate (&#8377;)</label>
            <input type="number" step="any" min="0" class="inp prod-cost" placeholder="Price &#8377;" value="${item.cost || ''}">
          </div>
          <div class="field-item">
            <label class="input-tag discount-tag">
              <span>Discount (&#8377;)</span>
              <span class="disc-pill">Off</span>
            </label>
            <input type="number" step="any" min="0" class="inp prod-discount" placeholder="Disc &#8377;" value="${item.discount || ''}">
          </div>
          <div class="field-item">
            <label class="input-tag">Net Amount (&#8377;)</label>
            <input type="text" readonly class="inp prod-net-amount" value="${formatNet(item.cost, item.discount)}">
          </div>
        </div>`;

      const turboNameInp = card.querySelector('.prod-turbo-name');
      const modelNoInp = card.querySelector('.prod-model-no');
      const partNoInp = card.querySelector('.prod-part-no');
      const serialNoInp = card.querySelector('.prod-serial-no');
      const workDoneInp = card.querySelector('.prod-work-done');
      const costInp = card.querySelector('.prod-cost');
      const discountInp = card.querySelector('.prod-discount');
      const netAmountInp = card.querySelector('.prod-net-amount');
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

      costInp.addEventListener('input', e => {
        item.cost = e.target.value;
        if (netAmountInp) netAmountInp.value = formatNet(item.cost, item.discount);
        onAnyItemChange();
      });

      discountInp.addEventListener('input', e => {
        item.discount = e.target.value;
        if (netAmountInp) netAmountInp.value = formatNet(item.cost, item.discount);
        onAnyItemChange();
      });

      costInp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); if (discountInp) discountInp.focus(); }
      });

      discountInp.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addRow(true); }
      });

      delBtn.addEventListener('click', () => {
        setSavedState(false);
        if (state.items.length === 1) {
          item.turboName = ''; item.modelNo = ''; item.partNo = ''; item.serialNo = ''; item.workDone = ''; item.cost = ''; item.discount = '';
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
    const item = { id: uid(), turboName: '', modelNo: '', partNo: '', serialNo: '', workDone: '', cost: '', discount: '' };
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
        const isEst = state.billType === 'estimation';

    // Header & Meta
    if ($('pDocTitle')) $('pDocTitle').textContent = isEst ? 'ESTIMATION' : 'CASH BILL';
    if ($('pInvoiceNoLbl')) $('pInvoiceNoLbl').textContent = isEst ? 'Estimate' : 'Bill No.';
    if ($('pInvoiceNo')) {
      $('pInvoiceNo').textContent = isEst ? 'ESTIMATE' : (state.invoiceNo || '---');
      $('pInvoiceNo').className = isEst ? 'inv-no-stamp inv-stamp-estimate' : 'inv-no-stamp';
    }
    $('pInvoiceDate').textContent = toDDMMYYYY(state.invoiceDate);

    // Customer info
    $('pCustomerName').textContent = state.customerName || '';
    $('pConsigneeName').textContent = state.customerName || '';
    $('pCustomerAddress').textContent = state.customerAddress || '';
    $('pConsigneeAddress').textContent = state.customerAddress || '';

    // Items table rows
    const tbody = $('pItemsBody');
    tbody.innerHTML = '';

    let subtotal = 0;
    let totalDiscount = 0;
    let total = 0;
    let usedRows = 0;

    state.items.forEach(item => {
      const cost = parseFloat(item.cost) || 0;
      const discount = parseFloat(item.discount) || 0;
      const net = Math.max(0, cost - discount);
      const hasContent = item.turboName || item.modelNo || item.partNo || item.serialNo || item.workDone || cost > 0 || discount > 0;
      if (hasContent) {
        subtotal += cost;
        totalDiscount += discount;
        total += net;
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

        if (discount > 0) {
          nameHtml += `<div class="inv-turbo-disc">Less Discount: -\u20B9 ${discount.toLocaleString('en-IN')}</div>`;
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
          <td class="col-amt">${net > 0 ? net.toLocaleString('en-IN') : (cost > 0 ? '0' : '')}</td>`;
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

    // Breakdown subtotal and total discount display
    const bdown = $('pBreakdownRows');
    if (bdown) {
      if (totalDiscount > 0) {
        bdown.style.display = 'flex';
        if ($('pSubtotalAmount')) $('pSubtotalAmount').textContent = formatINR(subtotal);
        if ($('pDiscountTotal')) $('pDiscountTotal').textContent = '-' + formatINR(totalDiscount);
      } else {
        bdown.style.display = 'none';
      }
    }

    const words = toWords(total);
    const fmtTotal = formatINR(total);
    $('pAmountWords').textContent = words;
    $('pTotalAmount').textContent = fmtTotal;
    $('summaryTotalAmount').textContent = fmtTotal;
    $('summaryAmountWords').textContent = words;
  }

  /* ── Compute Highest Previous Bill Number & Next ────── */
  function getHighestInvoiceNumber(ledgerList) {
    let maxNo = 132;
    (ledgerList || []).forEach(e => {
      if (!e) return;
      if (e.isEstimation || e.billType === 'estimation' || String(e.invoiceNo).toUpperCase() === 'ESTIMATE') return;
      const clean = String(e.invoiceNo || '').replace(/\D/g, '');
      const num = parseInt(clean, 10);
      if (!isNaN(num) && num > maxNo) {
        maxNo = num;
      }
    });
    return maxNo;
  }

  function computeNextInvoiceNo(ledger) {
    return String(getHighestInvoiceNumber(ledger) + 1);
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
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      if (typeof html2pdf !== 'undefined') {
        await html2pdf().set(opt).from(sheet).save();
        toast(`Downloaded ${filename}!`);
        if (!state.editingLedgerId) newInvoice(false);
      } else {
        document.title = filename.replace('.pdf', '');
        if (typeof window.print === 'function') window.print();
      }
    } catch (err) {
      console.error(err);
      document.title = filename.replace('.pdf', '');
      if (typeof window.print === 'function') window.print();
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
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollX: 0, scrollY: 0 },
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
        if (typeof window.print === 'function') window.print();
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
    if (typeof window.print === 'function') window.print();
  }

  /* ── Convert Estimation to Cash Bill ─────────── */
  function convertEstimateToCashBill(targetId) {
    const ledger = getLedger();
    const entry = ledger.find(e => e.id === targetId);
    if (!entry) return;

    const nextNo = computeNextInvoiceNo(ledger);
    const cust = entry.customerName || 'Cash';
    const amountStr = formatINR(entry.billedAmount);

    const ok = window.confirm(`Convert Estimation for "${cust}" (${amountStr}) into official Cash Bill #${nextNo}?\n\n• Assigns official Bill #${nextNo}\n• Unblocks ${amountStr} into your Total Sales & Profit\n• Syncs across all devices`);
    if (!ok) return;

    entry.billType = 'cash';
    entry.isEstimation = false;
    entry.invoiceNo = nextNo;
    entry.source = 'cashbill';
    entry.updatedAt = new Date().toISOString();

    const afterNextNo = computeNextInvoiceNo(ledger);
    localStorage.setItem(STORAGE.NEXT_INV_NO, afterNextNo);

    saveLedger(ledger);
    renderFinanceLedger();
    pushSyncToCloud('convert_estimate');
    toast(`⚡ Converted to Cash Bill #${nextNo}! Money added to Finance Book.`);
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

    const statusFilter = $('financeStatusFilter') ? $('financeStatusFilter').value : 'ALL';
    const monthFilter = $('financeMonthFilter').value;
    const yearFilter = $('financeYearFilter').value;
    const query = (state.finance.searchQuery || '').toLowerCase().trim();

    let filtered = ledger.filter(entry => {
      const isEst = Boolean(entry.isEstimation || entry.billType === 'estimation');
      if (statusFilter === 'cash' && isEst) return false;
      if (statusFilter === 'estimation' && !isEst) return false;

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

    // Calculate Analytics - Blocked Money from Estimates is NOT added to confirmed sales/profit!
    let totalSales = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let confirmedCount = 0;

    let blockedSales = 0;
    let blockedCost = 0;
    let blockedCount = 0;

    filtered.forEach(entry => {
      const b = parseFloat(entry.billedAmount) || 0;
      const c = parseFloat(entry.actualCost) || 0;
      const p = b - c;
      const isEst = Boolean(entry.isEstimation || entry.billType === 'estimation');

      if (isEst) {
        blockedSales += b;
        blockedCost += c;
        blockedCount += 1;
      } else {
        totalSales += b;
        totalCost += c;
        totalProfit += p;
        confirmedCount += 1;
      }
    });

    $('statTotalSales').textContent = formatINRSymbol(totalSales);
    $('statTotalCost').textContent = formatINRSymbol(totalCost);
    $('statTotalProfit').textContent = formatINRSymbol(totalProfit);

    $('statSalesCount').textContent = `${confirmedCount} bill${confirmedCount === 1 ? '' : 's'} recorded`;
    const margin = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0;
    $('statProfitMargin').textContent = `Profit Margin: ${margin}%`;

    // Blocked Stat Card
    const estCard = $('statCardEstimates');
    if (estCard) {
      if (blockedCount > 0) {
        estCard.style.display = 'flex';
        if ($('statBlockedSales')) $('statBlockedSales').textContent = formatINRSymbol(blockedSales);
        if ($('statBlockedCount')) $('statBlockedCount').textContent = `${blockedCount} pending quote${blockedCount === 1 ? '' : 's'} (Blocked)`;
      } else {
        estCard.style.display = 'none';
      }
    }

    // Remember active focus & selection if user is typing
    const container = $('financeLedgerList');
    const active = document.activeElement;
    let focusedCardId = null;
    let focusedField = null;
    let selStart = 0;
    let selEnd = 0;

    if (active && container && container.contains(active)) {
      const parentCard = active.closest('.ledger-card');
      if (parentCard) {
        focusedCardId = parentCard.dataset.id;
        if (active.classList.contains('notes-input')) focusedField = 'notes';
        else if (active.classList.contains('calc-cost-input')) focusedField = 'cost';
        try {
          selStart = active.selectionStart;
          selEnd = active.selectionEnd;
        } catch (e) {}
      }
    }

    // Render Ledger Cards
    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="text-align:center; padding: 40px 16px; color: #94a3b8;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;"><circle cx="12" cy="10" r="8"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p style="font-weight: 700; color: #475569;">No entries found in this period.</p>
          <p style="font-size: 0.76rem;">Saved cash bills and estimates automatically appear here, or tap "+ Add Entry".</p>
        </div>`;
      return;
    }

    filtered.forEach(entry => {
      const isEst = Boolean(entry.isEstimation || entry.billType === 'estimation');
      const card = document.createElement('div');
      card.className = 'ledger-card' + (isEst ? ' is-estimate' : '');
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

      const invBadge = isEst
        ? `<span class="ledger-inv-no ledger-badge-estimate">📋 ESTIMATE</span>`
        : `<span class="ledger-inv-no">#${esc(entry.invoiceNo)}</span>`;

      const statusBadge = isEst
        ? `<span class="badge-status-blocked">🟡 Blocked</span>`
        : '';

      const topConvertBanner = isEst
        ? `<div class="ledger-convert-banner">
             <button type="button" class="btn-convert-bill-top" title="1-Click: Convert to Official Cash Bill">
               <div class="convert-btn-content">
                 <span class="convert-icon-badge">⚡</span>
                 <div class="convert-btn-texts">
                   <span class="convert-title">Convert to Official Cash Bill</span>
                   <span class="convert-sub">Assigns next Bill # &bull; Unblocks ${formatINR(billed)} into sales</span>
                 </div>
               </div>
               <span class="convert-arrow">&rarr;</span>
             </button>
           </div>`
        : '';

      const profitLbl = isEst ? 'Projected Profit' : 'Your Profit';
      const profitSuffix = isEst ? ' (Blocked)' : '';

      card.innerHTML = `
        <!-- TOP Action: Convert Estimate to Cash Bill -->
        ${topConvertBanner}

        <div class="ledger-header">
          <div class="ledger-meta">
            ${invBadge}
            <span class="ledger-date">${toDDMMYYYY(entry.date)}</span>
            <span class="ledger-customer">${esc(entry.customerName)}</span>
            ${statusBadge}
          </div>
          <!-- Action Buttons: Edit, Download, Share, Delete -->
          <div class="ledger-actions">
            <button type="button" class="btn-card-action btn-card-edit" title="Edit ${isEst ? 'Estimate' : 'Cash Bill #' + esc(entry.invoiceNo)}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>
            <button type="button" class="btn-card-action btn-card-download" title="Download PDF">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            <button type="button" class="btn-card-action btn-card-share" title="Share PDF via WhatsApp / Apps">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
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
            <span class="calc-lbl">${profitLbl}</span>
            <span class="calc-val-profit ${profitClass}">${profitPrefix}${formatINR(profit)}${profitSuffix}</span>
          </div>
        </div>

        <div class="ledger-notes-row">
          <input type="text" class="inp notes-input" placeholder="Cost breakdown notes (e.g. Kit ₹3000, Lathe ₹500)" value="${esc(entry.notes || '')}">
        </div>`;

      const costInput = card.querySelector('.calc-cost-input');
      const profitEl = card.querySelector('.calc-val-profit');
      const notesInput = card.querySelector('.notes-input');
      const editBtn = card.querySelector('.btn-card-edit');
      const downloadBtn = card.querySelector('.btn-card-download');
      const shareBtn = card.querySelector('.btn-card-share');
      const delBtn = card.querySelector('.btn-card-del');
      const convBtn = card.querySelector('.btn-convert-bill-top');

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
        }, 1000);
      });

      costInput.addEventListener('blur', () => {
        if (state.finance.needsRefreshOnBlur) {
          state.finance.needsRefreshOnBlur = false;
          renderFinanceLedger();
        }
      });

      let notesDebounceTimer = null;
      notesInput.addEventListener('input', e => {
        entry.notes = e.target.value;
        saveLedger(ledger);
        clearTimeout(notesDebounceTimer);
        notesDebounceTimer = setTimeout(() => {
          pushSyncToCloud('notes_update');
        }, 1000);
      });

      notesInput.addEventListener('blur', () => {
        pushSyncToCloud('notes_blur');
        if (state.finance.needsRefreshOnBlur) {
          state.finance.needsRefreshOnBlur = false;
          renderFinanceLedger();
        }
      });

      editBtn.addEventListener('click', () => {
        loadBillForEditing(entry);
      });

      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
          downloadBillFromLedger(entry);
        });
      }

      if (shareBtn) {
        shareBtn.addEventListener('click', () => {
          shareBillFromLedger(entry);
        });
      }

      delBtn.addEventListener('click', () => {
        openDeleteConfirmModal(entry);
      });

      if (convBtn) {
        convBtn.addEventListener('click', e => {
          e.stopPropagation();
          convertEstimateToCashBill(entry.id);
        });
      }

      container.appendChild(card);
    });

    // Restore user cursor and focus so typing is never interrupted
    if (focusedCardId && focusedField) {
      const restoredCard = container.querySelector(`.ledger-card[data-id="${focusedCardId}"]`);
      if (restoredCard) {
        const targetInp = focusedField === 'notes'
          ? restoredCard.querySelector('.notes-input')
          : restoredCard.querySelector('.calc-cost-input');
        if (targetInp) {
          targetInp.focus();
          try {
            if (targetInp.setSelectionRange) targetInp.setSelectionRange(selStart, selEnd);
          } catch (e) {}
        }
      }
    }
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
    state.editingLedgerId = entry.id; // Lock editing to this exact record ID
    const isEst = Boolean(entry.isEstimation || entry.billType === 'estimation');
    setBillType(isEst ? 'estimation' : 'cash', true);

    state.invoiceNo = isEst ? 'ESTIMATE' : (entry.invoiceNo || '133');
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
        cost: it.cost || '',
        discount: it.discount || ''
      }));
    } else if (entry.items && entry.items.length > 0) {
      state.items = entry.items.map(it => ({
        id: uid(),
        turboName: it.name || '',
        modelNo: '',
        partNo: '',
        serialNo: '',
        workDone: '',
        cost: it.originalPrice || it.cost || '',
        discount: it.discount || ''
      }));
    } else {
      state.items = [{ id: uid(), turboName: '', modelNo: '', partNo: '', serialNo: '', workDone: '', cost: '', discount: '' }];
    }

    if (!isEst) {
      $('invoiceNoInput').value = state.invoiceNo;
    }
    $('invoiceDateInput').value = state.invoiceDate;
    $('customerNameInput').value = state.customerName;
    $('customerAddressInput').value = state.customerAddress;

    renderRows();
    sync();
    updateBillStatusBadge();

    // In edit mode, allow user to make adjustments and click "Update Bill in Notebook"
    setSavedState(false);

    switchView('invoice');
    toast(isEst ? '✏️ Editing Estimation Quote' : `✏️ Editing Cash Bill #${state.invoiceNo} (updates in-place)`);
  }

  /* ── Render Print Sheet Directly from Entry (Without altering active editor state) ── */
  function renderPrintSheetFromEntry(entry) {
    if (!entry) return;
    const isEst = Boolean(entry.isEstimation || entry.billType === 'estimation');

    if ($('pDocTitle')) $('pDocTitle').textContent = isEst ? 'ESTIMATION' : 'CASH BILL';
    if ($('pInvoiceNoLbl')) $('pInvoiceNoLbl').textContent = isEst ? 'Estimate' : 'Bill No.';
    if ($('pInvoiceNo')) {
      $('pInvoiceNo').textContent = isEst ? 'ESTIMATE' : (entry.invoiceNo || '---');
      $('pInvoiceNo').className = isEst ? 'inv-no-stamp inv-stamp-estimate' : 'inv-no-stamp';
    }
    if ($('pInvoiceDate')) $('pInvoiceDate').textContent = toDDMMYYYY(entry.date);
    if ($('pCustomerName')) $('pCustomerName').textContent = entry.customerName || '';
    if ($('pConsigneeName')) $('pConsigneeName').textContent = entry.customerName || '';
    if ($('pCustomerAddress')) $('pCustomerAddress').textContent = entry.customerAddress || '';
    if ($('pConsigneeAddress')) $('pConsigneeAddress').textContent = entry.customerAddress || '';

    const tbody = $('pItemsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const rawItems = entry.rawItems && entry.rawItems.length > 0 ? entry.rawItems : (entry.items || []);
    let subtotal = 0;
    let totalDiscount = 0;
    let total = 0;
    let usedRows = 0;

    rawItems.forEach(item => {
      const isRaw = Boolean(item.turboName !== undefined);
      const turboName = isRaw ? (item.turboName || '') : (item.name || '');
      const modelNo = isRaw ? (item.modelNo || '') : '';
      const partNo = isRaw ? (item.partNo || '') : '';
      const serialNo = isRaw ? (item.serialNo || '') : '';
      const workDone = isRaw ? (item.workDone || '') : '';
      const cost = parseFloat(isRaw ? item.cost : (item.originalPrice || item.cost)) || 0;
      const discount = parseFloat(item.discount) || 0;
      const net = Math.max(0, cost - discount);

      subtotal += cost;
      totalDiscount += discount;
      total += net;
      usedRows++;

      let nameHtml = '';
      if (turboName) {
        nameHtml += `<div class="inv-turbo-title"><strong>${esc(turboName)}</strong></div>`;
      }

      const metaBadges = [];
      if (modelNo) metaBadges.push(`<span>Mdl:</span> <strong>${esc(modelNo)}</strong>`);
      if (partNo) metaBadges.push(`<span>Part:</span> <strong>${esc(partNo)}</strong>`);
      if (serialNo) metaBadges.push(`<span>S/N:</span> <strong>${esc(serialNo)}</strong>`);

      if (metaBadges.length > 0) {
        nameHtml += `<div class="inv-turbo-meta">${metaBadges.join(' &nbsp;|&nbsp; ')}</div>`;
      }

      if (workDone) {
        nameHtml += `<div class="inv-turbo-work">${esc(workDone)}</div>`;
      }

      if (discount > 0) {
        nameHtml += `<div class="inv-turbo-disc">Less Discount: -\u20B9 ${discount.toLocaleString('en-IN')}</div>`;
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
        <td class="col-amt">${net > 0 ? net.toLocaleString('en-IN') : (cost > 0 ? '0' : '')}</td>`;
      tbody.appendChild(tr);
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

    const bdown = $('pBreakdownRows');
    if (bdown) {
      if (totalDiscount > 0) {
        bdown.style.display = 'flex';
        if ($('pSubtotalAmount')) $('pSubtotalAmount').textContent = formatINR(subtotal);
        if ($('pDiscountTotal')) $('pDiscountTotal').textContent = '-' + formatINR(totalDiscount);
      } else {
        bdown.style.display = 'none';
      }
    }

    const words = toWords(total || entry.billedAmount || 0);
    const fmtTotal = formatINR(total || entry.billedAmount || 0);
    if ($('pAmountWords')) $('pAmountWords').textContent = words;
    if ($('pTotalAmount')) $('pTotalAmount').textContent = fmtTotal;
  }

  /* ── Direct PDF Download from Ledger ──────── */
  async function downloadBillFromLedger(entry) {
    if (!entry) return;
    renderPrintSheetFromEntry(entry);

    const filename = pdfFilename(entry.invoiceNo);
    toast(`Generating ${filename}...`, 1800);

    const sheet = $('invoiceSheet');
    const opt = {
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      if (typeof html2pdf !== 'undefined') {
        await html2pdf().set(opt).from(sheet).save();
        toast(`Downloaded ${filename}!`);
      } else {
        document.title = filename.replace('.pdf', '');
        if (typeof window.print === 'function') window.print();
      }
    } catch (err) {
      console.error(err);
      toast('Print dialog opened');
      if (typeof window.print === 'function') window.print();
    }
  }

  /* ── Direct PDF Print from Ledger / Modal ── */
  function printBillFromLedger(entry) {
    if (!entry) return;
    renderPrintSheetFromEntry(entry);
    const filename = pdfFilename(entry.invoiceNo);
    document.title = filename.replace('.pdf', '');
    if (typeof window.print === 'function') window.print();
  }

  /* ── Direct PDF Share from Ledger ─────────── */
  async function shareBillFromLedger(entry) {
    if (!entry) return;
    renderPrintSheetFromEntry(entry);

    const isEst = Boolean(entry.isEstimation || entry.billType === 'estimation');
    const filename = pdfFilename(entry.invoiceNo);
    toast(`Preparing ${isEst ? 'Estimate' : 'Bill'} for sharing...`, 1600);

    const sheet = $('invoiceSheet');
    const opt = {
      margin: 0,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      if (typeof html2pdf !== 'undefined') {
        const pdfBlob = await html2pdf().set(opt).from(sheet).output('blob');
        const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({
            files: [pdfFile],
            title: isEst ? `M.K. Turbo Estimation - ${entry.customerName || 'Quote'}` : `M.K. Turbo Cash Bill #${entry.invoiceNo}`,
            text: isEst
              ? `M.K. Turbo Estimation Quote for ${entry.customerName || 'Customer'}`
              : `M.K. Turbo Cash Bill #${entry.invoiceNo} for ${entry.customerName || 'Customer'}`
          });
          toast('Shared successfully!');
        } else {
          await html2pdf().set(opt).from(sheet).save();
          toast(`Downloaded ${filename} for sharing!`);
        }
      } else {
        if (typeof window.print === 'function') window.print();
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        await downloadBillFromLedger(entry);
      }
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

  async function executeDeleteEntry() {
    const targetId = state.finance.pendingDeleteId;
    if (!targetId) return;

    // 1. Mark as permanently deleted in tombstones
    addDeletedId(targetId);

    // 2. Remove immediately from local ledger
    const ledger = getLedger();
    const idx = ledger.findIndex(e => e.id === targetId);
    let removed = null;
    if (idx >= 0) {
      removed = ledger.splice(idx, 1)[0];
      saveLedger(ledger);
      renderFinanceLedger();
    }
    closeDeleteConfirmModal();

    // 3. Immediately direct push to Cloud and wait for response!
    setSyncStatus('syncing');
    try {
      const ok = await directPushToCloud('delete_entry');
      if (ok) {
        toast(removed ? `🗑️ Bill #${removed.invoiceNo} deleted & cloud synced` : '🗑️ Record deleted & cloud synced');
      } else {
        toast('🗑️ Deleted locally (will sync when online)');
      }
    } catch (e) {
      toast('🗑️ Deleted locally');
    }
  }

  /* ── Export Finance Ledger to CSV / Excel ─── */
  function exportLedgerToCsv() {
    const ledger = getLedger();
    if (ledger.length === 0) {
      toast('No finance entries to export.');
      return;
    }

    const headers = ['Date', 'Doc Type', 'Bill No', 'Customer Name', 'Turbos & Work Done', 'Billed Amount (INR)', 'Our Actual Cost (INR)', 'Net Profit (INR)', 'Status', 'Expense Notes'];
    const rows = [headers];

    ledger.forEach(entry => {
      const isEst = Boolean(entry.isEstimation || entry.billType === 'estimation');
      const itemsText = (entry.items || []).map(i => i.name).join('; ');
      const billed = parseFloat(entry.billedAmount) || 0;
      const cost = parseFloat(entry.actualCost) || 0;
      const profit = billed - cost;

      rows.push([
        toDDMMYYYY(entry.date),
        isEst ? 'Estimation Quote' : 'Cash Bill',
        entry.invoiceNo || (isEst ? 'ESTIMATE' : ''),
        `"${(entry.customerName || '').replace(/"/g, '""')}"`,
        `"${itemsText.replace(/"/g, '""')}"`,
        billed,
        cost,
        profit,
        isEst ? 'Blocked' : 'Confirmed',
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

  function newInvoice(preserveNo = false) {
    state.editingLedgerId = null; // Clear edit mode
    setBillType('cash', true);
    state.invoiceDate = todayStr();
    state.customerName = '';
    state.customerAddress = '';
    state.items = [{ id: uid(), turboName: '', modelNo: '', partNo: '', serialNo: '', workDone: '', cost: '', discount: '' }];

    if (!preserveNo) {
      const ledger = getLedger();
      const currentNo = String(state.invoiceNo || '').trim();
      if (ledger.some(e => String(e.invoiceNo).trim() === currentNo)) {
        state.invoiceNo = computeNextInvoiceNo(ledger);
        localStorage.setItem(STORAGE.NEXT_INV_NO, state.invoiceNo);
      }
    }

    $('invoiceDateInput').value = state.invoiceDate;
    if ($('invoiceNoInput')) $('invoiceNoInput').value = state.invoiceNo;
    $('customerNameInput').value = '';
    $('customerAddressInput').value = '';
    renderRows(); sync();
    updateBillStatusBadge();
    setSavedState(false);
    toast('Ready for new Cash Bill (Bill No. auto-assigned on Save)');
  }

  function startNextBill() {
    state.editingLedgerId = null; // Clear edit mode
    setBillType('cash', true);
    const nextNo = computeNextInvoiceNo(getLedger());
    state.invoiceNo = nextNo;
    localStorage.setItem(STORAGE.NEXT_INV_NO, state.invoiceNo);
    if ($('invoiceNoInput')) $('invoiceNoInput').value = state.invoiceNo;
    newInvoice(true);
    toast(`Ready for next job: Cash Bill #${state.invoiceNo}`);
  }

  /* ── CLOUD SYNC & BACKUP ENGINE (BULLETPROOF REAL-TIME) ── */
  const FIREBASE_ENDPOINT = 'https://mkturbo-2a105-default-rtdb.firebaseio.com/mkturbo.json';
  let isSyncing = false;
  let lastSyncedTimestamp = null;

  function getSyncCode() {
    return localStorage.getItem(STORAGE.SYNC_CODE) || 'MKTURBO-GAJUWAKA-530026';
  }

  function getFirebaseUrl() {
    return localStorage.getItem(STORAGE.FIREBASE_URL) || FIREBASE_ENDPOINT;
  }

  function setSyncStatus(status, timeStr = '') {
    const miniDot = $('headerSyncDotMini');
    const dDot = $('drawerSyncDot');
    const dText = $('drawerSyncStatusText');
    const dTime = $('drawerLastSyncTime');
    const mDot = $('modalSyncDot');
    const mTitle = $('modalSyncStatusTitle');
    const mTime = $('modalLastSyncTime');

    if (miniDot) miniDot.className = `sync-dot-mini ${status}`;
    if (dDot) dDot.className = `sync-dot ${status}`;
    if (mDot) mDot.className = `status-indicator-dot ${status}`;

    const savedTime = localStorage.getItem(STORAGE.LAST_SYNC);
    const displayTime = timeStr || (savedTime ? new Date(savedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never');

    if (status === 'synced') {
      if (dText) dText.textContent = 'Cloud Connected & Live Synced';
      if (mTitle) mTitle.textContent = 'Cloud Connected & Live Synced';
      if (dTime) dTime.textContent = displayTime;
      if (mTime) mTime.textContent = displayTime;
    } else if (status === 'syncing') {
      if (dText) dText.textContent = 'Syncing with Cloud...';
      if (mTitle) mTitle.textContent = 'Syncing with Cloud...';
    } else {
      if (dText) dText.textContent = 'Offline (Saved Locally)';
      if (mTitle) mTitle.textContent = 'Offline (Saved Locally)';
      if (dTime) dTime.textContent = displayTime;
      if (mTime) mTime.textContent = displayTime;
    }
  }

  let syncQueued = false;

  async function directPushToCloud(reason = 'save') {
    const ledger = getLedger();
    const deletedIds = getDeletedIds();
    const payload = {
      syncCode: getSyncCode(),
      nextInvoiceNo: computeNextInvoiceNo(ledger),
      ledger: ledger,
      deletedIds: deletedIds,
      version: Date.now(),
      updatedAt: new Date().toISOString(),
      reason: reason
    };

    lastSyncedTimestamp = payload.updatedAt;
    saveVersionSnapshot(payload);

    let success = false;
    try {
      const fbRes = await fetch(FIREBASE_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (fbRes.ok) success = true;
    } catch (err) {
      console.warn('Firebase cloud sync error:', err);
    }

    try {
      await fetch('./api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {}

    const now = new Date();
    localStorage.setItem(STORAGE.LAST_SYNC, now.toISOString());
    setSyncStatus(success ? 'synced' : (navigator.onLine ? 'synced' : 'offline'), now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    renderVersionHistory();
    return success;
  }

  async function pushSyncToCloud(reason = 'save') {
    if (isSyncing) {
      syncQueued = true;
      return;
    }
    isSyncing = true;
    setSyncStatus('syncing');

    try {
      await directPushToCloud(reason);
    } finally {
      isSyncing = false;
      if (syncQueued) {
        syncQueued = false;
        pushSyncToCloud('queued_sync');
      }
    }
  }

  async function pullSyncFromCloud(silent = false) {
    if (isSyncing || !navigator.onLine) return;

    try {
      const res = await fetch(FIREBASE_ENDPOINT + '?cache_bust=' + Date.now());
      if (res.ok) {
        const remote = await res.json();
        if (remote && remote.ledger && Array.isArray(remote.ledger)) {
          const localLedger = getLedger();
          const localStr = JSON.stringify(localLedger);
          const remoteStr = JSON.stringify(remote.ledger);

          if (localStr !== remoteStr || remote.updatedAt !== lastSyncedTimestamp || localLedger.length === 0) {
            mergeRemoteData(remote);
            if (!silent) toast('☁️ Cloud Synced - Latest records loaded!', 1800);
          }
          setSyncStatus('synced');
        }
      }
    } catch (err) {
      // Offline fallback
    }
  }

  /* ── Server-Sent Realtime Cloud Stream Listener ─ */
  let cloudEventSource = null;

  function startRealtimeCloudListener() {
    if (typeof EventSource === 'undefined') return;

    if (cloudEventSource) {
      try { cloudEventSource.close(); } catch (e) {}
      cloudEventSource = null;
    }

    try {
      cloudEventSource = new EventSource(FIREBASE_ENDPOINT);

      cloudEventSource.addEventListener('put', e => {
        try {
          const parsed = JSON.parse(e.data);
          if (parsed && parsed.data) {
            const data = parsed.data;
            if (data && data.ledger && Array.isArray(data.ledger)) {
              mergeRemoteData(data);
              setSyncStatus('synced');
            } else if (parsed.path === '/' && data && Array.isArray(data.ledger)) {
              mergeRemoteData(data);
              setSyncStatus('synced');
            }
          }
        } catch (err) {
          console.warn('Realtime sync parse error:', err);
        }
      });

      cloudEventSource.addEventListener('patch', e => {
        pullSyncFromCloud(true);
      });

      cloudEventSource.onerror = () => {
        if (cloudEventSource) {
          try { cloudEventSource.close(); } catch (e) {}
          cloudEventSource = null;
        }
        setTimeout(startRealtimeCloudListener, 8000);
      };
    } catch (e) {
      console.warn('Realtime listener init error:', e);
    }
  }

  function isUserActivelyTypingInLedger() {
    const active = document.activeElement;
    if (!active) return false;
    const container = $('financeLedgerList');
    return Boolean(container && container.contains(active) &&
      (active.classList.contains('notes-input') || active.classList.contains('calc-cost-input')));
  }

  function mergeRemoteData(remote) {
    if (!remote || !Array.isArray(remote.ledger)) return;

    // Merge deleted IDs from remote and local tombstones
    const remoteDeleted = Array.isArray(remote.deletedIds) ? remote.deletedIds : [];
    const localDeleted = getDeletedIds();
    const allDeletedIds = Array.from(new Set([...localDeleted, ...remoteDeleted]));
    localStorage.setItem(STORAGE.DELETED_IDS, JSON.stringify(allDeletedIds));

    const localLedger = getLedger();
    const remoteLedger = remote.ledger || [];

    // Filter out deleted items from remote
    const validRemote = remoteLedger.filter(item => item && item.id && !allDeletedIds.includes(item.id));
    const cloudHadDeleted = remoteLedger.some(item => item && item.id && allDeletedIds.includes(item.id));

    // Remote is authoritative for the ledger list
    const map = new Map();
    validRemote.forEach(item => {
      map.set(item.id, item);
    });

    // If local has genuine un-synced items (created locally in the last 15 min):
    localLedger.forEach(localItem => {
      if (localItem && localItem.id && !allDeletedIds.includes(localItem.id)) {
        if (!map.has(localItem.id)) {
          const created = new Date(localItem.createdAt || 0).getTime();
          if (Date.now() - created < 15 * 60 * 1000) {
            map.set(localItem.id, localItem);
          }
        } else {
          // If local has newer notes typed by user, preserve notes
          const remoteItem = map.get(localItem.id);
          if (localItem.notes && !remoteItem.notes) {
            remoteItem.notes = localItem.notes;
          }
        }
      }
    });

    // If user is actively typing in a card, do NOT let remote overwrite that card
    if (isUserActivelyTypingInLedger()) {
      const active = document.activeElement;
      const card = active ? active.closest('.ledger-card') : null;
      if (card && card.dataset.id) {
        const editingId = card.dataset.id;
        const localItem = localLedger.find(i => i.id === editingId);
        if (localItem) map.set(editingId, localItem);
      }
    }

    const merged = Array.from(map.values()).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    localStorage.setItem(STORAGE.FINANCE_LEDGER, JSON.stringify(merged));

    // If cloud had phantom deleted items, immediately direct push to clean Firebase
    if (cloudHadDeleted) {
      directPushToCloud('purge_remote_deleted');
    }

    // Next Invoice Number
    const nextNoFromLedger = computeNextInvoiceNo(merged);
    const remoteNext = parseInt(remote.nextInvoiceNo || '0', 10);
    const computedNext = parseInt(nextNoFromLedger, 10);
    const bestNext = String(Math.max(remoteNext, computedNext));

    localStorage.setItem(STORAGE.NEXT_INV_NO, bestNext);

    // Auto-advance if the current invoiceNo in form has already been saved in the ledger
    // BUT NEVER overwrite or advance if user is actively editing an existing bill!
    if (!state.editingLedgerId) {
      const isCurrentInLedger = merged.some(e => String(e.invoiceNo).trim() === String(state.invoiceNo).trim());
      if (isCurrentInLedger) {
        state.invoiceNo = bestNext;
        if ($('invoiceNoInput')) $('invoiceNoInput').value = state.invoiceNo;
        sync();
      }
    }

    // Only render if user is not actively typing, otherwise defer to blur
    if (isUserActivelyTypingInLedger()) {
      state.finance.needsRefreshOnBlur = true;
    } else {
      renderFinanceLedger();
    }
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
      appVersion: '3.0-Cloud'
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
    $('firebaseDbUrlInput').value = FIREBASE_ENDPOINT;
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
      const dBtn = $('drawerInstallAppBtn');
      if (dBtn) dBtn.style.display = 'flex';
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      toast('M.K. Turbo App installed successfully!');
      const btn = $('installAppBtn');
      if (btn) btn.innerHTML = '<span>✓ Installed</span>';
      const dBtn = $('drawerInstallAppBtn');
      if (dBtn) dBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="20 6 9 17 4 12"/></svg><span>✓ App Installed</span>';
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
    // Workspace Navigation Tabs
    if ($('tabWorkspaceBtn')) $('tabWorkspaceBtn').addEventListener('click', () => switchView('workspace'));
    if ($('tabInvoiceBtn')) $('tabInvoiceBtn').addEventListener('click', () => switchView('invoice'));
    if ($('tabFinanceBtn')) $('tabFinanceBtn').addEventListener('click', () => switchView('finance'));
    if ($('appBrandClickable')) $('appBrandClickable').addEventListener('click', () => switchView('workspace'));

    // Workspace App Cards (Canva / Paytm style)
    if ($('openBillGeneratorCard')) $('openBillGeneratorCard').addEventListener('click', () => switchView('invoice'));
    if ($('openFinanceNotebookCard')) $('openFinanceNotebookCard').addEventListener('click', () => switchView('finance'));

    // Back to Hub Buttons
    if ($('backToHubFromInvoice')) $('backToHubFromInvoice').addEventListener('click', () => switchView('workspace'));
    if ($('backToHubFromFinance')) $('backToHubFromFinance').addEventListener('click', () => switchView('workspace'));

    // PWA & Cloud Hub
    if ($('closeIosInstallBtn')) $('closeIosInstallBtn').addEventListener('click', () => $('installIosModal').classList.remove('open'));
    if ($('closeCloudSyncModal')) $('closeCloudSyncModal').addEventListener('click', closeCloudSyncModal);

    $('manualSyncNowBtn').addEventListener('click', () => {
      toast('Syncing with Cloud...');
      pushSyncToCloud('manual_refresh');
      pullSyncFromCloud();
    startRealtimeCloudListener();
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

    if ($('cancelEditBillBtn')) {
      $('cancelEditBillBtn').addEventListener('click', () => {
        state.editingLedgerId = null;
        newInvoice(true);
        updateBillStatusBadge();
        toast('Cancelled editing. Ready for fresh Cash Bill.');
      });
    }

    // Save Bill Action
    $('saveBillBtn').addEventListener('click', handleSaveBill);

    // Document Type Selector (Cash Bill vs Estimation Bill)
    if ($('btnTypeCashBill')) $('btnTypeCashBill').addEventListener('click', () => setBillType('cash'));
    if ($('btnTypeEstimation')) $('btnTypeEstimation').addEventListener('click', () => setBillType('estimation'));

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

    // Bill Saved Success Popup Modal
    if ($('closeSaveSuccessModal')) $('closeSaveSuccessModal').addEventListener('click', closeSaveSuccessModal);
    if ($('saveModalDoneBtn')) $('saveModalDoneBtn').addEventListener('click', closeSaveSuccessModal);
    if ($('saveSuccessModal')) {
      $('saveSuccessModal').addEventListener('click', e => {
        if (e.target === $('saveSuccessModal')) closeSaveSuccessModal();
      });
    }

    if ($('saveModalDownloadBtn')) {
      $('saveModalDownloadBtn').addEventListener('click', () => {
        if (lastSavedRecord) downloadBillFromLedger(lastSavedRecord);
      });
    }

    if ($('saveModalShareBtn')) {
      $('saveModalShareBtn').addEventListener('click', () => {
        if (lastSavedRecord) shareBillFromLedger(lastSavedRecord);
      });
    }

    if ($('saveModalPrintBtn')) {
      $('saveModalPrintBtn').addEventListener('click', () => {
        if (lastSavedRecord) printBillFromLedger(lastSavedRecord);
      });
    }

    // Slide-out Drawer Sidebar
    const drawer = $('appSidebarDrawer');
    const backdrop = $('sidebarBackdrop');

    const openDrawer = () => {
      if (drawer) drawer.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
    };

    const closeDrawer = () => {
      if (drawer) drawer.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
    };

    if ($('openMenuDrawerBtn')) $('openMenuDrawerBtn').addEventListener('click', openDrawer);
    if ($('closeSidebarBtn')) $('closeSidebarBtn').addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    if ($('drawerSyncNowBtn')) {
      $('drawerSyncNowBtn').addEventListener('click', () => {
        toast('Syncing with Cloud...');
        pushSyncToCloud('drawer_manual');
        pullSyncFromCloud();
      });
    }

    if ($('drawerOpenBackupModalBtn')) {
      $('drawerOpenBackupModalBtn').addEventListener('click', () => {
        closeDrawer();
        openCloudSyncModal();
      });
    }

    if ($('drawerInstallAppBtn')) {
      $('drawerInstallAppBtn').addEventListener('click', () => {
        closeDrawer();
        handleInstallApp();
      });
    }

    if ($('drawerLockFinanceBtn')) {
      $('drawerLockFinanceBtn').addEventListener('click', () => {
        closeDrawer();
        lockFinanceNotebook();
      });
    }

    // Finance Filters
    $('financeSearchInput').addEventListener('input', e => {
      state.finance.searchQuery = e.target.value;
      renderFinanceLedger();
    });

    if ($('financeStatusFilter')) $('financeStatusFilter').addEventListener('change', () => renderFinanceLedger());
    $('financeMonthFilter').addEventListener('change', () => renderFinanceLedger());
    $('financeYearFilter').addEventListener('change', () => renderFinanceLedger());
    $('exportCsvBtn').addEventListener('click', exportLedgerToCsv);

    // Manual Entry Modal
    $('addManualFinanceBtn').addEventListener('click', openManualModal);
    $('closeManualModal').addEventListener('click', closeManualModal);
    $('cancelManualModalBtn').addEventListener('click', closeManualModal);
    $('saveManualEntryBtn').addEventListener('click', saveManualEntry);

    
    // Instant Multi-Tab Sync on same device
    window.addEventListener('storage', e => {
      if (e.key === STORAGE.FINANCE_LEDGER) {
        renderFinanceLedger();
      }
      if (e.key === STORAGE.NEXT_INV_NO) {
        state.invoiceNo = e.newValue || '133';
        if ($('invoiceNoInput')) $('invoiceNoInput').value = state.invoiceNo;
        sync();
      }
    });

    // Auto periodic cloud sync every 4 seconds
    setInterval(() => {
      pullSyncFromCloud(true);
    }, 4000);

    // Auto-sync listeners
    window.addEventListener('online', () => {
      toast('🌐 Online - Syncing with Cloud...');
      pushSyncToCloud('online_event');
      pullSyncFromCloud();
    startRealtimeCloudListener();
    });

    window.addEventListener('offline', () => {
      setSyncStatus('offline');
      toast('⚠️ Offline - Changes will be saved locally');
    });

    window.addEventListener('focus', () => {
      pullSyncFromCloud();
    startRealtimeCloudListener();
    });
  }

  /* ── Bootstrap ───────────────────────────── */
    /* ── Apple-Style Splash Screen Controller ─ */
  function initSplashScreen() {
    const splash = $('appSplashScreen');
    if (!splash) return;

    const dismiss = () => {
      splash.classList.add('splash-hidden');
      setTimeout(() => {
        try { splash.remove(); } catch (e) {}
      }, 600);
    };

    // Auto-dismiss after 3.6s spool-up animation
    setTimeout(dismiss, 2400);
    splash.addEventListener('click', dismiss);
  }

  function init() {
    initSplashScreen();
    const ledger = getLedger();
    if (ledger.some(e => String(e.invoiceNo).trim() === String(state.invoiceNo).trim())) {
      state.invoiceNo = computeNextInvoiceNo(ledger);
      localStorage.setItem(STORAGE.NEXT_INV_NO, state.invoiceNo);
    }
    $('invoiceNoInput').value = state.invoiceNo;
    $('invoiceDateInput').value = state.invoiceDate;
    renderRows();
    sync();
    setSavedState(false);
    updateBillStatusBadge();
    initEvents();
    initPwa();

    // Check cloud sync on load
    setSyncStatus(navigator.onLine ? 'synced' : 'offline');
    pullSyncFromCloud();
    startRealtimeCloudListener();

    const startView = (state.activeView === 'finance' && isFinanceUnlocked()) ? 'finance' : 'workspace';
    switchView(startView);
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();
