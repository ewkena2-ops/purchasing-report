/* ==========================================================================
   Daily Purchasing & Materials Report — app
   The report is computed from the data sheet. Records are shared online
   through the Cloudflare server named in config.js with everyone who has
   the report's full link, or saved on this device when config.js is empty.
   ========================================================================== */
(() => {
  "use strict";

  /* ---------- DOM helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "value") el.value = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
    for (const kid of kids.flat()) {
      if (kid == null) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  // Static, trusted icon markup only.
  const ICONS = {
    cart: '<path d="M3 4h2l2.4 10.5h10.2L20 8H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="16" cy="19" r="1.4"/>',
    cheque: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h6M6 14h3M15 14h3"/>',
    truck: '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    bank: '<path d="M3 10 12 4l9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    scale: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="m5 7-3 6a3 3 0 0 0 6 0L5 7zM19 7l-3 6a3 3 0 0 0 6 0l-3-6z"/>',
    fileWarn: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 11v4M12 18h.01"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    note: '<path d="M4 4h16v12l-4 4H4z"/><path d="M8 9h8M8 13h5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    sheet: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alertTri: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    alertCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    xCircle: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    circle: '<circle cx="12" cy="12" r="8"/>',
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  };
  function icon(name) {
    const t = document.createElement("template");
    t.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ""}</svg>`;
    return t.content.firstChild;
  }

  /* ---------- lists ---------- */
  const NO_YES = ["No", "Yes"];
  const APPROVAL = ["Pending", "Approved", "Rejected"];
  const REQ_STATUS = ["Waiting for cash", "Ordered", "Cancelled"];
  const MAT_STATUS = ["In transit", "In store", "Delayed"];
  const TERMS = ["COD", "7 days", "14 days", "30 days", "45 days", "60 days"];
  const LEDGER_TYPES = ["Credit taken", "Payment made"];
  const ISSUE_STATUS = ["Open", "Replacement pending", "Refund pending", "Resolved"];
  const NEED_STATUS = ["Needed", "Paid", "Cancelled"];

  /* ---------- data store ---------- */
  const SAMPLE = window.REPORT_DATA || { company: {} };
  const STORE_KEY = "pr-daily-v1";
  const DATASETS = ["requests", "cheques", "materials", "suppliers", "ledger", "jobs", "issues", "cashNeeds", "summaries", "sent"];
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function normalize(d) {
    const out = clone(d || {});
    out.company = { ...(SAMPLE.company || {}), ...(out.company || {}) };
    // One-time update: the finance officer is now Selam (was Betty)
    if (!out.company.renamedFinanceOfficer) {
      for (const k of ["submittedTo", "approverLow", "preparedBy", "approverHigh"]) {
        if (typeof out.company[k] === "string") out.company[k] = out.company[k].replace(/\bBetty\b/g, "Selam");
      }
      out.company.renamedFinanceOfficer = true;
    }
    for (const k of DATASETS) if (!Array.isArray(out[k])) out[k] = [];
    return out;
  }
  // Online mode: when config.js names the Cloudflare Worker API, records are shared with everyone who has the full link
  const CFG = window.REPORT_CONFIG || {};
  const CONNECTED = !!(CFG.apiUrl && CFG.dept);
  let LINKED = false; // true once the link's code is accepted and the shared records are loaded
  const canWrite = () => !CONNECTED || LINKED;
  let LOCAL = false;
  function loadData() {
    if (CONNECTED) return normalize({});
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) { LOCAL = true; return normalize(JSON.parse(raw)); }
    } catch (e) { /* storage unavailable or corrupt */ }
    LOCAL = false;
    return normalize(SAMPLE);
  }
  let D = loadData();
  let dirty = false;
  function saveData() {
    LOCAL = true;
    dirty = true;
    if (CONNECTED) { scheduleSync(); return; }
    try { localStorage.setItem(STORE_KEY, JSON.stringify(D)); } catch (e) { toast("Could not save on this device (storage is blocked). Export to Excel to keep your changes."); }
  }

  /* ---------- formatting & dates ---------- */
  let C, LOC, CUR, fMoney, fMoneyC, fNum, fPct, fDate, fDay, fLong;
  function buildFormats() {
    C = D.company;
    LOC = C.locale || "en-US";
    CUR = String(C.currency || "ETB").trim().toUpperCase();
    try { new Intl.NumberFormat(LOC); } catch (e) { LOC = "en-US"; }
    try { new Intl.NumberFormat(LOC, { style: "currency", currency: CUR }); } catch (e) { CUR = "ETB"; }
    fMoney = new Intl.NumberFormat(LOC, { style: "currency", currency: CUR, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    fMoneyC = new Intl.NumberFormat(LOC, { style: "currency", currency: CUR, notation: "compact", maximumFractionDigits: 1 });
    fNum = new Intl.NumberFormat(LOC);
    fPct = new Intl.NumberFormat(LOC, { style: "percent", maximumFractionDigits: 1 });
    fDate = new Intl.DateTimeFormat(LOC, { day: "numeric", month: "short", year: "numeric" });
    fDay = new Intl.DateTimeFormat(LOC, { weekday: "short", day: "numeric", month: "short" });
    fLong = new Intl.DateTimeFormat(LOC, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  const n0 = (v) => Number(v) || 0;
  const money = (n) => fMoney.format(n0(n));
  const moneyC = (n) => (Math.abs(n) < 10000 ? fMoney.format(Math.round(n0(n))).replace(/\.00$/, "") : fMoneyC.format(n));
  const num = (n) => fNum.format(n);
  const pct = (n) => (Number.isFinite(n) ? fPct.format(n) : "—");
  const isoRe = /^\d{4}-\d{2}-\d{2}$/;
  const isISO = (v) => isoRe.test(String(v ?? ""));
  const pad2 = (n) => String(n).padStart(2, "0");
  const parseD = (str) => { const [y, m, d] = String(str).split("-").map(Number); return new Date(y, m - 1, d || 1); };
  const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const todayISO = () => toISO(new Date());
  const nowHM = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const addDays = (iso, n) => { const d = parseD(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
  const fdate = (str) => (isISO(str) ? fDate.format(parseD(str)) : String(str || "—"));
  const fday = (str) => (isISO(str) ? fDay.format(parseD(str)) : String(str || "—"));
  const flong = (str) => (isISO(str) ? fLong.format(parseD(str)) : String(str || "—"));
  const within = (v, a, b) => isISO(v) && v >= a && v <= b;
  const termDays = (t) => { const m = String(t || "").match(/(\d+)/); return m ? +m[1] : 0; };
  const firstName = (t) => String(t || "").trim().split(/\s|\(/)[0] || "Purchasing";
  const listText = (arr, max = 4) => (arr.length <= max ? arr.join(", ") : `${arr.slice(0, max).join(", ")} and ${arr.length - max} more`);

  const sum = (arr, f = (x) => x.amount) => arr.reduce((a, x) => a + n0(f(x)), 0);
  const uniq = (arr) => [...new Set(arr.filter((v) => v !== "" && v != null))].sort();

  /* ---------- state ---------- */
  const state = { date: todayISO() };
  let V = {};

  /* ---------- supplier balances (oldest credit is paid first) ---------- */
  function supplierState(name, sup, T) {
    const rows = D.ledger.filter((r) => (r.supplier || "") === name && isISO(r.date) && r.date <= T);
    const credit = (rs) => sum(rs.filter((r) => r.type === "Credit taken"));
    const paid = (rs) => sum(rs.filter((r) => r.type === "Payment made"));
    const before = rows.filter((r) => r.date < T), today = rows.filter((r) => r.date === T);
    const openingBal = n0(sup && sup.openingBalance);
    const opening = openingBal + credit(before) - paid(before);
    const newCredit = credit(today), paidToday = paid(today);
    const closing = opening + newCredit - paidToday;
    const days = termDays(sup && sup.terms);
    const credits = [];
    if (openingBal > 0) credits.push({ amount: openingBal, due: isISO(sup.openingDue) ? sup.openingDue : null });
    for (const r of rows.filter((x) => x.type === "Credit taken")) credits.push({ amount: n0(r.amount), due: isISO(r.dueDate) ? r.dueDate : addDays(r.date, days), jobCode: r.jobCode, cheque: r.chequeGiven === "Yes", chequeNo: String(r.chequeNo || "").trim() });
    credits.sort((a, b) => (a.due || "0000").localeCompare(b.due || "0000"));
    let pool = paid(rows);
    for (const c of credits) { const take = Math.min(c.amount, pool); c.left = c.amount - take; pool -= take; }
    const open = credits.filter((c) => c.left > 0.005);
    const cod = /cod/i.test((sup && sup.terms) || "");
    const overdue = sum(open.filter((c) => c.due && c.due < T), (c) => c.left);
    const due7 = sum(open.filter((c) => c.due && c.due >= T && c.due <= addDays(T, 7)), (c) => c.left);
    const nextDue = open.map((c) => c.due).filter((d) => d && d >= T).sort()[0] || null;
    // Credit still open for which we gave the supplier a cheque
    const openAmt = sum(open, (c) => c.left);
    const chequeAmt = sum(open.filter((c) => c.cheque), (c) => c.left);
    const chequeNos = uniq(open.filter((c) => c.cheque).map((c) => c.chequeNo));
    let status = "Paid up";
    if (!sup) status = "Unknown supplier";
    else if (closing > 0.005) status = cod ? "Cash needed" : overdue > 0.005 ? "Overdue" : "Within terms";
    return { name, terms: (sup && sup.terms) || "—", opening, newCredit, paidToday, closing, overdue, due7, nextDue, status, cod, open, openAmt, chequeAmt, chequeNos };
  }

  // Was a cheque given for the credit still open? Yes / No / Part (amount covered)
  const chequeText = (x) => (x.openAmt <= 0.005 ? "—" : x.chequeAmt <= 0.005 ? "No" : x.chequeAmt >= x.openAmt - 0.005 ? "Yes" : `Part: ${money(x.chequeAmt)}`);

  /* ---------- view model ---------- */
  function buildView() {
    const T = state.date, T1 = addDays(T, 1), T7 = addDays(T, 7);
    const ws = addDays(T, -((parseD(T).getDay() + 6) % 7));
    const limit = n0(C.approvalLimit) || 50000;
    const v = { T, T1, T7, ws, limit };

    // 01 purchase requests
    v.req = D.requests.filter((r) => !isISO(r.date) || r.date <= T).map((r) => {
      const approver = n0(r.amount) >= limit ? C.approverHigh || "Senior approver" : C.approverLow || "Finance";
      const noFunds = r.chequeIssued === "Yes" && r.fundsConfirmed !== "Yes";
      const noApproval = r.chequeIssued === "Yes" && (r.approval || "Pending") !== "Approved";
      return { ...r, approver, noFunds, noApproval, broken: noFunds || noApproval };
    });
    v.reqToday = v.req.filter((r) => r.date === T);
    v.reqWaiting = v.req.filter((r) => (r.status || "Waiting for cash") === "Waiting for cash");
    v.reqChequesToday = v.reqToday.filter((r) => r.chequeIssued === "Yes");
    v.reqBrokenToday = v.reqToday.filter((r) => r.broken);

    // 02 cheques
    v.chq = D.cheques.filter((c) => !isISO(c.date) || c.date <= T).map((c) => ({ ...c, docsLate: isISO(c.date) && c.date < T && c.docsToFinance !== "Yes" }));
    v.chqToday = v.chq.filter((c) => c.date === T);
    v.chqUnconfirmed = v.chqToday.filter((c) => c.supplierConfirmed !== "Yes");
    v.docsLate = v.chq.filter((c) => c.docsLate);
    v.docsPendingToday = v.chqToday.filter((c) => c.docsToFinance !== "Yes");

    // 03 materials
    v.mat = D.materials.filter((m) => !isISO(m.orderedDate) || m.orderedDate <= T).map((m) => {
      const arrived = isISO(m.actualDate) && m.actualDate <= T;
      let disp = arrived ? "In store" : m.status === "In store" ? "In store" : m.status || "In transit";
      if (!arrived && disp !== "In store" && isISO(m.expectedDate) && m.expectedDate < T) disp = "Late";
      return { ...m, arrived, disp, unconfirmed: arrived && m.confirmed !== "Yes" };
    });
    v.matToday = v.mat.filter((m) => m.actualDate === T);
    v.matOpen = v.mat.filter((m) => m.disp !== "In store");
    v.matLate = v.mat.filter((m) => m.disp === "Late" || m.disp === "Delayed");
    v.matDefects = v.mat.filter((m) => m.defect === "Yes" && (!isISO(m.actualDate) || m.actualDate >= addDays(T, -30)));
    v.matUnconfirmed = v.mat.filter((m) => m.unconfirmed && m.actualDate >= addDays(T, -7));

    // 04 supplier credit
    const known = new Map(D.suppliers.filter((x) => x.name).map((x) => [x.name, x]));
    const names = uniq([...known.keys(), ...D.ledger.map((r) => r.supplier)]);
    v.sup = names.map((nm) => supplierState(nm, known.get(nm), T)).filter((x) => x.closing > 0.005 || x.newCredit || x.paidToday || known.has(x.name));
    v.owed = sum(v.sup, (x) => Math.max(0, x.closing));
    v.overdue = sum(v.sup, (x) => x.overdue);
    v.due7 = sum(v.sup, (x) => x.due7);
    v.newCredit = sum(v.sup, (x) => x.newCredit);
    v.paidToday = sum(v.sup, (x) => x.paidToday);
    v.unknownSuppliers = v.sup.filter((x) => x.status === "Unknown supplier");
    v.chequeHeld = sum(v.sup, (x) => x.chequeAmt);

    // 05 / 06 jobs
    v.jobs = D.jobs.map((j) => {
      const reqCost = sum(D.requests.filter((r) => r.jobCode === j.jobCode && r.status !== "Cancelled" && (!isISO(r.date) || r.date <= T)));
      const manual = n0(j.purchaseCost);
      const cost = manual > 0 ? manual : reqCost;
      const contract = n0(j.contractValue);
      const variance = contract > 0 && cost > 0 ? cost - contract : null;
      return { ...j, cost, costSource: manual > 0 ? "Jobs sheet" : reqCost > 0 ? "From requests" : "Missing", variance };
    });
    v.overruns = v.jobs.filter((j) => j.variance > 0.005).sort((a, b) => b.variance - a.variance);
    v.unexplained = v.overruns.filter((j) => !String(j.overrunReason || "").trim());
    v.missing = v.jobs.filter((j) => j.bomComplete !== "Yes").map((j) => ({ ...j, late: isISO(j.expectedDate) && j.expectedDate < T }));
    v.missingLate = v.missing.filter((j) => j.late);
    const jobCodes = new Set(D.jobs.map((j) => j.jobCode));
    v.unknownJobs = uniq(D.requests.map((r) => r.jobCode)).filter((c) => !jobCodes.has(c));

    // 07 issues
    v.iss = D.issues.filter((i) => !isISO(i.date) || i.date <= T);
    v.issOpen = v.iss.filter((i) => (i.status || "Open") !== "Resolved");
    v.issToday = v.iss.filter((i) => i.date === T);
    v.issWithheld = v.issOpen.filter((i) => i.withheld === "Yes");

    // 08 cash
    const needed = (n) => (n.status || "Needed") === "Needed";
    v.cashTomorrow = D.cashNeeds.filter((n) => n.dateNeeded === T1 && needed(n)).sort((a, b) => (n0(a.priority) || 99) - (n0(b.priority) || 99));
    v.cashTotal = sum(v.cashTomorrow);
    v.fcDays = Array.from({ length: 7 }, (_, i) => addDays(T, i + 1));
    v.fcLabels = v.fcDays.map((d) => ({ short: fDay.format(parseD(d)).split(",")[0], long: flong(d) }));
    v.fcNeeds = v.fcDays.map((d) => sum(D.cashNeeds.filter((n) => n.dateNeeded === d && needed(n))));
    v.fcDues = v.fcDays.map((d) => sum(v.sup.flatMap((x) => x.open.filter((c) => c.due === d)), (c) => c.left));
    v.fcTotal = sum(v.fcNeeds, (x) => x) + sum(v.fcDues, (x) => x);

    // 09 summary
    v.summary = D.summaries.find((x) => x.date === T) || null;
    v.auto = autoSummary(v);

    // 10 compliance
    v.checks = compliance(v);
    return v;
  }

  function autoSummary(v) {
    const out = [];
    if (v.matToday.length) out.push(`We received ${num(v.matToday.length)} material deliver${v.matToday.length === 1 ? "y" : "ies"} today (${listText(uniq(v.matToday.map((m) => m.jobCode)))}).`);
    else out.push("No materials arrived today.");
    const ov = v.overruns[0];
    if (ov) out.push(`${ov.jobCode} is over the contract value by ${money(ov.variance)}${String(ov.overrunReason || "").trim() ? "" : " and still needs a written explanation"}.`);
    const od = [...v.sup].filter((x) => x.overdue > 0).sort((a, b) => b.overdue - a.overdue)[0];
    if (od) out.push(`${od.name} is overdue by ${money(od.overdue)}.`);
    const big = [...v.sup].sort((a, b) => b.closing - a.closing)[0];
    if (big && big.closing > 0) out.push(`We owe suppliers ${money(v.owed)} in total; the largest is ${big.name} (${money(big.closing)}${big.nextDue ? `, next due ${fdate(big.nextDue)}` : ""}).`);
    if (v.missing.length) out.push(`BOM data is missing for ${listText(v.missing.map((j) => j.jobCode))}, which can block the production schedule.`);
    if (v.matLate.length) out.push(`${num(v.matLate.length)} material order${v.matLate.length === 1 ? " is" : "s are"} late (${listText(uniq(v.matLate.map((m) => m.jobCode)))}).`);
    const top = v.cashTomorrow[0];
    if (top) out.push(`We need ${money(v.cashTotal)} in ${C.bank || "the bank"} tomorrow; top priority is ${top.jobCode || "—"} (${top.supplier || "supplier"}).`);
    return out.join(" ");
  }

  function compliance(v) {
    const bank = C.bank || "the bank";
    const checks = [];
    const noFunds = v.reqChequesToday.filter((r) => r.fundsConfirmed !== "Yes");
    checks.push({
      label: `All cheques issued today have finance's confirmed ${bank} funds`,
      state: noFunds.length ? "fail" : "ok",
      detail: noFunds.length ? `Issued without confirmed funds: ${listText(noFunds.map((r) => `${r.jobCode || "?"} (${money(r.amount)})`))}`
        : v.reqChequesToday.length ? `${num(v.reqChequesToday.length)} cheque${v.reqChequesToday.length === 1 ? "" : "s"} issued, all funds confirmed` : "No cheques issued today",
    });
    checks.push({
      label: "Documents for delivered cheques are with finance (within 24 hours)",
      state: v.docsLate.length ? "fail" : v.docsPendingToday.length ? "pending" : "ok",
      detail: v.docsLate.length ? `More than 24 hours late: ${listText(v.docsLate.map((c) => `${c.jobCode || "?"} ${c.supplier || ""}`.trim()))}`
        : v.docsPendingToday.length ? `${num(v.docsPendingToday.length)} from today still to submit (due tomorrow)` : "All documents submitted",
    });
    const incomplete = v.missing.filter((j) => !String(j.missingInfo || "").trim() || !isISO(j.expectedDate));
    checks.push({
      label: "Every job with missing BOM data is flagged (section 6)",
      state: incomplete.length ? "fail" : "ok",
      detail: incomplete.length ? `Missing information or expected date for: ${listText(incomplete.map((j) => j.jobCode || "?"))}`
        : `${num(v.missing.length)} job${v.missing.length === 1 ? "" : "s"} flagged${v.unknownJobs.length ? ` · note: ${listText(v.unknownJobs)} not in the Jobs sheet` : ""}`,
    });
    const noTerms = D.suppliers.filter((x) => x.name && !x.terms);
    checks.push({
      label: "Supplier credit (section 4) is fully updated",
      state: v.unknownSuppliers.length || noTerms.length ? "fail" : "ok",
      detail: v.unknownSuppliers.length ? `Not in the Suppliers sheet: ${listText(v.unknownSuppliers.map((x) => x.name))}`
        : noTerms.length ? `No credit terms for: ${listText(noTerms.map((x) => x.name))}` : `Totals calculated from the ledger · owed ${money(v.owed)}`,
    });
    const outside = D.ledger.filter((r) => r.date === v.T && r.type === "Payment made" && r.paidVia && r.paidVia !== bank);
    checks.push({
      label: `No payment was made outside the ${bank} system`,
      state: outside.length ? "fail" : "ok",
      detail: outside.length ? `Paid another way: ${listText(outside.map((r) => `${r.supplier} ${money(r.amount)} (${r.paidVia})`))}` : `${num(D.ledger.filter((r) => r.date === v.T && r.type === "Payment made").length)} payment(s) today, all through ${bank}`,
    });
    const deadline = C.deadline || "17:30";
    const sent = D.sent.find((x) => x.date === v.T);
    const isToday = v.T === todayISO();
    checks.push({
      label: `Report sent to ${C.submittedTo || "the Chairman"} by ${deadline}`,
      state: sent ? (sent.time <= deadline ? "ok" : "fail") : isToday && nowHM() <= deadline ? "pending" : "fail",
      detail: sent ? `Sent at ${sent.time}${sent.time > deadline ? " (after the deadline)" : ""}` : isToday && nowHM() <= deadline ? `Not sent yet · deadline ${deadline}` : "Not marked as sent",
      sent: true,
    });
    return checks;
  }

  /* ---------- small components ---------- */
  function deltaChip(cur, prev, { upGood = true } = {}) {
    if (prev == null || !Number.isFinite(prev) || !Number.isFinite(cur) || prev === 0) return null;
    const change = (cur - prev) / Math.abs(prev);
    if (Math.abs(change) < 0.0005) return h("span", { class: "delta flat" }, "Same");
    const up = change > 0;
    const text = change >= 9 ? `${num(Math.round(cur / prev))}×` : pct(Math.abs(change));
    return h("span", { class: `delta ${up === upGood ? "good" : "bad"}` }, icon(up ? "arrowUp" : "arrowDown"), text);
  }

  const STATUS = {
    Approved: "good", Ordered: "good", "In store": "good", "Within terms": "good", Resolved: "good", Paid: "good", Explained: "good", Yes: "good", OK: "good",
    Pending: "warning", "Waiting for cash": "warning", "In transit": "warning", "Replacement pending": "warning", "Refund pending": "warning", Needed: "warning", "Due tomorrow": "warning",
    Delayed: "serious", Open: "serious", "Unknown supplier": "serious",
    Late: "critical", Overdue: "critical", "Cash needed": "critical", "Rule broken": "critical", "No explanation": "critical", "Docs late": "critical", Defect: "critical",
    Rejected: "neutral", Cancelled: "neutral", "Paid up": "neutral", No: "neutral",
  };
  const STATUS_ICON = { good: "check", warning: "clock", serious: "alertTri", critical: "alertCircle", neutral: "circle" };
  function badge(text, tone) {
    const t = tone || STATUS[text] || "neutral";
    return h("span", { class: `badge ${t}` }, icon(text === "Rejected" || text === "Cancelled" ? "xCircle" : STATUS_ICON[t]), text || "—");
  }
  const yn = (v, badNo) => (v === "Yes" ? badge("Yes", "good") : badge(v || "No", badNo ? "critical" : "neutral"));
  const twoLine = (a, b) => [h("span", { class: "strong" }, a || "—"), b ? h("span", { class: "sub" }, b) : null];
  const amountCell = (n) => money(n);

  function emptyState(title = "Nothing here", text = "Add records in the Data sheet and this fills in.") {
    return h("div", { class: "empty" }, h("strong", {}, title), text);
  }
  function statStrip(el, items) {
    el.replaceChildren(...items.map((it) => h("div", { class: "stat" },
      h("span", { class: "stat-label" }, it.label),
      h("span", { class: "stat-value", title: it.title || null }, it.value),
      it.foot ? h("span", { class: "stat-foot" }, it.foot) : null)));
  }
  const warn = (text) => h("span", { class: "delta bad" }, icon("alertCircle"), text);

  /* ---------- tooltip & toast ---------- */
  const tip = $("#tooltip");
  function showTip(x, y, title, rows) {
    tip.replaceChildren(
      h("div", { class: "tip-title" }, title),
      ...rows.map((r) => h("div", { class: "tip-row" + (r.sep ? " sep" : "") },
        h("span", { class: "tip-key" + (r.key ? " k-" + r.key : "") }),
        h("strong", {}, r.value),
        h("span", {}, r.label || ""))));
    tip.hidden = false;
    const w = tip.offsetWidth, ht = tip.offsetHeight;
    let left = x + 14, top = y - ht - 12;
    if (left + w > innerWidth - 8) left = x - w - 14;
    if (left < 8) left = 8;
    if (top < 8) top = y + 18;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  const hideTip = () => { tip.hidden = true; };
  function tipAt(el, title, rows) {
    const r = el.getBoundingClientRect();
    showTip(r.left + r.width / 2, r.top, title, rows);
  }
  addEventListener("scroll", hideTip, { passive: true });

  const toastEl = $("#toast");
  let toastTimer = 0;
  function toast(text, action) {
    clearTimeout(toastTimer);
    toastEl.replaceChildren(h("span", {}, text));
    if (action) {
      const b = h("button", { type: "button" }, action.label);
      b.addEventListener("click", () => { toastEl.hidden = true; action.run(); });
      toastEl.append(b);
    }
    toastEl.hidden = false;
    toastTimer = setTimeout(() => (toastEl.hidden = true), action ? 7000 : 4000);
  }

  /* ---------- charts ---------- */
  function niceScale(max, count = 4, integer = false) {
    if (!(max > 0)) max = integer ? count : 1;
    const raw = max / count;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const steps = (integer && pow < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10]).map((m) => Math.max(integer ? 1 : 0, m * pow));
    const step = steps.find((x) => x >= raw) || steps[steps.length - 1];
    const top = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
    return { top, ticks };
  }
  const tickRoom = (ticks, fmt) => Math.max(30, Math.max(...ticks.map((t) => fmt(t).length)) * 6.4 + 12);
  const noData = (series) => series.every((se) => se.values.every((v) => !v));
  function colPath(x, yTop, w, yBase) {
    const hgt = yBase - yTop;
    if (hgt <= 0.5) return "";
    const r = Math.min(4, w / 2, hgt);
    return `M${x},${yBase}V${yTop + r}A${r},${r} 0 0 1 ${x + r},${yTop}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${yTop + r}V${yBase}Z`;
  }

  function drawColumns(el, { labels, series, selected, fmt, fmtTick, integer = false, extraRows, label, emptyText }) {
    if (noData(series)) { el.replaceChildren(emptyState("Nothing due", emptyText || "Add records in the Data sheet and this chart fills in.")); return; }
    const n = labels.length;
    const W = Math.max(el.clientWidth - 18, 260), H = 244;
    const maxV = Math.max(0, ...series.flatMap((se) => se.values));
    const { top, ticks } = niceScale(maxV, 4, integer);
    const m = { t: 22, r: 8, b: 30, l: tickRoom(ticks, fmtTick) };
    const pw = W - m.l - m.r, ph = H - m.t - m.b, step = pw / n;
    const k = series.length, gap = 2;
    const colW = Math.max(3, Math.min(24, (step * 0.62 - gap * (k - 1)) / k));
    const groupW = colW * k + gap * (k - 1);
    const y = (v) => m.t + ph - (v / top) * ph;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": label });
    for (const t of ticks) {
      const yy = Math.round(y(t)) + 0.5;
      svg.append(s("line", { class: t === 0 ? "axis-line" : "grid-line", x1: m.l, x2: W - m.r, y1: yy, y2: yy }));
      svg.append(s("text", { class: "tick", x: m.l - 8, y: yy + 4, "text-anchor": "end" }, fmtTick(t)));
    }
    const partial = selected.size < n;
    labels.forEach((lb, i) => {
      svg.append(s("text", { class: "x-label" + (partial && selected.has(i) ? " sel" : ""), x: m.l + step * (i + 0.5), y: m.t + ph + 20, "text-anchor": "middle" }, lb.short));
    });
    labels.forEach((lb, i) => {
      const cx = m.l + step * (i + 0.5);
      const rows = () => {
        const r = series.map((se) => ({ key: se.key, value: fmt(se.values[i]), label: se.name }));
        if (extraRows) r.push(...extraRows(i));
        return r;
      };
      const hit = s("rect", { class: "hit", x: m.l + step * i + 1, y: m.t - 6, width: Math.max(0, step - 2), height: ph + 6, rx: 6, tabindex: 0,
        "aria-label": `${lb.long}: ${series.map((se) => `${se.name} ${fmt(se.values[i])}`).join(", ")}` });
      hit.addEventListener("pointermove", (e) => showTip(e.clientX, e.clientY, lb.long, rows()));
      hit.addEventListener("pointerdown", (e) => showTip(e.clientX, e.clientY, lb.long, rows()));
      hit.addEventListener("pointerleave", hideTip);
      hit.addEventListener("focus", () => { hit.classList.add("focus"); tipAt(hit, lb.long, rows()); });
      hit.addEventListener("blur", () => { hit.classList.remove("focus"); hideTip(); });
      svg.append(hit);
      series.forEach((se, j) => {
        const x0 = cx - groupW / 2 + j * (colW + gap);
        svg.append(s("path", { class: `col k-${se.key}${partial && !selected.has(i) ? " dim" : ""}`, d: colPath(x0, y(se.values[i]), colW, y(0)) }));
      });
    });
    el.replaceChildren(svg);
  }

  function drawSpark(el, values, labels) {
    const n = values.length;
    const W = Math.max(el.clientWidth, 200), H = 56;
    const step = W / n, colW = Math.min(26, step * 0.58);
    const top = Math.max(...values) || 1;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "Cash needed per day, next 7 days" });
    values.forEach((v, i) => {
      const x0 = step * i + (step - colW) / 2;
      const hit = s("rect", { class: "hit", x: step * i, y: 0, width: step, height: H, rx: 6 });
      const rows = [{ key: "out", value: money(v), label: "cash needed" }];
      hit.addEventListener("pointermove", (e) => showTip(e.clientX, e.clientY, labels[i].long, rows));
      hit.addEventListener("pointerleave", hideTip);
      svg.append(hit, s("path", { class: `col ${i === 0 ? "k-out" : "k-muted"}`, d: colPath(x0, H - 2 - (v / top) * (H - 8), colW, H - 2) }));
    });
    svg.append(s("line", { class: "axis-line", x1: 0, x2: W, y1: H - 1.5, y2: H - 1.5 }));
    el.replaceChildren(svg);
  }

  function drawHBars(el, items, { key = "in", fmt = num, tipFmt = fmt, share = true, unit = "" } = {}) {
    if (!items.length || items.every((i) => !i.value)) { el.replaceChildren(emptyState("Nothing to show", "Add records in the Data sheet and this fills in.")); return; }
    const max = Math.max(...items.map((i) => i.value)) || 1;
    const total = sum(items, (i) => i.value);
    const list = h("div", { class: "hb", role: "list" });
    for (const it of items) {
      const rows = () => {
        const r = [{ key, value: tipFmt(it.value), label: unit }];
        if (share && total) r.push({ value: pct(it.value / total), label: "of total" });
        if (it.extra) r.push(...it.extra);
        return r;
      };
      const bar = h("div", { class: `hb-bar k-${key}`, style: `--p:${Math.max(0, it.value / max).toFixed(4)}` });
      const row = h("div", { class: "hb-row", tabindex: 0, role: "listitem", "aria-label": `${it.label}: ${tipFmt(it.value)}` },
        h("div", { class: "hb-label", title: it.label }, it.label),
        h("div", { class: "hb-track" }, bar, h("span", { class: "hb-val" }, fmt(it.value))));
      row.addEventListener("pointermove", (e) => showTip(e.clientX, e.clientY, it.label, rows()));
      row.addEventListener("pointerleave", hideTip);
      row.addEventListener("focus", () => tipAt(bar, it.label, rows()));
      row.addEventListener("blur", hideTip);
      list.append(row);
    }
    el.replaceChildren(list);
  }

  function simpleTable({ head, rows, num: numCols = [], foot, empty }) {
    const cls = (i) => (numCols.includes(i) ? "num" : null);
    const t = h("table", { class: "dt" },
      h("thead", {}, h("tr", {}, head.map((c, i) => h("th", { class: cls(i), scope: "col" }, c)))),
      h("tbody", {}, rows.length
        ? rows.map((r) => h("tr", {}, r.map((c, i) => h("td", { class: cls(i) }, c))))
        : h("tr", {}, h("td", { colspan: head.length }, empty || emptyState()))));
    if (foot && rows.length) t.append(h("tfoot", {}, h("tr", {}, foot.map((c, i) => h("td", { class: cls(i) }, c)))));
    return h("div", { class: "table-wrap", style: "border-top:0" }, t);
  }

  const CHARTS = {};
  const chart = (id, def) => { CHARTS[id] = def; };
  function buildChartCards() {
    $$(".chart-card[data-chart]").forEach((card) => {
      const toggle = h("div", { class: "seg seg-sm view-toggle", role: "group", "aria-label": "View as" },
        h("button", { type: "button", "data-view": "chart", "aria-pressed": "true" }, "Chart"),
        h("button", { type: "button", "data-view": "table", "aria-pressed": "false" }, "Table"));
      const legend = card.dataset.chart === "forecast"
        ? h("div", { class: "legend" }, h("span", {}, h("i", { class: "sw-rect k-in" }), "Cash requests"), h("span", {}, h("i", { class: "sw-rect k-out" }), "Supplier payments due"))
        : null;
      card.replaceChildren(
        h("header", { class: "card-head" }, h("div", {}, h("h3", {}, card.dataset.title), h("p", { class: "card-sub" }, card.dataset.sub || "")), toggle),
        legend,
        h("div", { class: "chart-body" + (card.hasAttribute("data-hb") ? " hb-body" : "") }),
        h("div", { class: "chart-table", hidden: true }));
      $$("button", toggle).forEach((b) => b.addEventListener("click", () => {
        card.dataset.view = b.dataset.view;
        $$("button", toggle).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        drawChart(card.dataset.chart);
      }));
    });
  }
  function drawChart(id) {
    const card = $(`[data-chart="${id}"]`), def = CHARTS[id];
    if (!card || !def) return;
    const view = card.dataset.view || "chart";
    const body = $(".chart-body", card), tbl = $(".chart-table", card), legend = $(".legend", card);
    body.hidden = view !== "chart";
    tbl.hidden = view !== "table";
    if (legend) legend.hidden = view !== "chart";
    if (view === "chart") def.draw(body);
    else tbl.replaceChildren(simpleTable(def.table()));
  }

  /* ---------- report tables ---------- */
  class DataTable {
    constructor(root, cfg) {
      this.root = root;
      this.cfg = cfg;
      this.rows = [];
      this.q = "";
      this.tab = cfg.tabs ? cfg.tabs.options[0].value : null;
      this.page = 0;
      this.sort = cfg.sort || null;
      this.pageSize = cfg.pageSize || 8;
      this.printAll = false;
      this.build();
    }
    build() {
      const cfg = this.cfg;
      const bar = h("div", { class: "dt-toolbar" });
      if (cfg.tabs) {
        const seg = h("div", { class: "seg seg-sm", role: "group", "aria-label": "Show" });
        for (const o of cfg.tabs.options) {
          const b = h("button", { type: "button", "aria-pressed": String(o.value === this.tab) }, o.label);
          b.addEventListener("click", () => {
            this.tab = o.value; this.page = 0;
            $$("button", seg).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
            this.draw();
          });
          seg.append(b);
        }
        bar.append(seg);
      }
      if (cfg.search) {
        const input = h("input", { class: "input", type: "search", placeholder: cfg.placeholder || "Search", "aria-label": cfg.placeholder || "Search" });
        input.addEventListener("input", () => { this.q = input.value.trim().toLowerCase(); this.page = 0; this.draw(); });
        bar.append(h("div", { class: "dt-search" }, icon("search"), input));
      }
      bar.append(h("span", { class: "dt-spacer" }));
      const csv = h("button", { class: "btn btn-sm", type: "button", title: "Download these rows as CSV" }, icon("download"), "CSV");
      csv.addEventListener("click", () => this.csv());
      bar.append(csv);
      this.wrap = h("div", { class: "table-wrap" });
      this.foot = h("div", { class: "dt-foot" });
      this.root.replaceChildren(bar, this.wrap, this.foot);
    }
    setRows(rows) { this.rows = rows; this.page = 0; this.draw(); }
    filtered() {
      let r = this.rows;
      if (this.cfg.tabs) {
        const opt = this.cfg.tabs.options.find((o) => o.value === this.tab);
        if (opt && opt.match) r = r.filter(opt.match);
      }
      if (this.q) r = r.filter((x) => this.cfg.search.some((k) => String(x[k] ?? "").toLowerCase().includes(this.q)));
      if (this.sort) {
        const col = this.cfg.columns.find((c) => c.key === this.sort.key);
        const val = col.sortVal || ((x) => x[col.key]);
        r = [...r].sort((a, b) => {
          const A = val(a), B = val(b);
          return (A < B ? -1 : A > B ? 1 : 0) * this.sort.dir;
        });
      }
      return r;
    }
    draw() {
      const cols = this.cfg.columns;
      const all = this.filtered();
      const pages = Math.max(1, Math.ceil(all.length / this.pageSize));
      if (this.page >= pages) this.page = pages - 1;
      const start = this.page * this.pageSize;
      const view = this.printAll ? all : all.slice(start, start + this.pageSize);
      const thead = h("thead", {}, h("tr", {}, cols.map((c) => {
        const active = this.sort && this.sort.key === c.key;
        const btn = h("button", { type: "button" }, c.label, h("span", { class: "arrow", "aria-hidden": "true" }, active ? (this.sort.dir > 0 ? "▲" : "▼") : ""));
        btn.addEventListener("click", () => {
          this.sort = active ? { key: c.key, dir: -this.sort.dir } : { key: c.key, dir: c.num ? -1 : 1 };
          this.draw();
        });
        return h("th", { class: c.num ? "num" : null, scope: "col", "aria-sort": active ? (this.sort.dir > 0 ? "ascending" : "descending") : null }, btn);
      })));
      const tbody = h("tbody", {}, view.length
        ? view.map((r) => h("tr", { class: this.cfg.rowClass ? this.cfg.rowClass(r) : null }, cols.map((c) => h("td", { class: [c.num ? "num" : "", c.cls || ""].join(" ").trim() || null }, c.cell ? c.cell(r) : r[c.key]))))
        : h("tr", {}, h("td", { colspan: cols.length }, emptyState(this.cfg.emptyTitle || "Nothing here", this.cfg.emptyText || "Add records in the Data sheet."))));
      this.wrap.replaceChildren(h("table", { class: "dt" }, thead, tbody));
      const info = h("span", {}, all.length
        ? [`Showing ${num(this.printAll ? 1 : start + 1)}–${num(this.printAll ? all.length : Math.min(start + this.pageSize, all.length))} of `, h("strong", {}, num(all.length)), this.cfg.summary ? [" · ", this.cfg.summary(all)] : null]
        : "No records");
      const pager = h("div", { class: "pager" });
      const prev = h("button", { type: "button", "aria-label": "Previous page", disabled: this.page === 0 }, "‹");
      const next = h("button", { type: "button", "aria-label": "Next page", disabled: this.page >= pages - 1 }, "›");
      prev.addEventListener("click", () => { this.page--; this.draw(); });
      next.addEventListener("click", () => { this.page++; this.draw(); });
      pager.append(prev, h("span", { class: "pg" }, `${this.page + 1} / ${pages}`), next);
      this.foot.replaceChildren(info, pages > 1 ? pager : h("span"));
    }
    csv() {
      const cols = this.cfg.columns;
      const esc = (v) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
      const lines = [cols.map((c) => esc(c.label)).join(",")];
      for (const r of this.filtered()) lines.push(cols.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(","));
      download(`${this.cfg.name}-${state.date}.csv`, "﻿" + lines.join("\n"), "text/csv;charset=utf-8");
    }
  }

  function download(name, content, type) {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  const totalOf = (label, f) => (rows) => [`${label} `, h("strong", {}, money(sum(rows, f)))];

  let TABLES = {};
  function buildTables() {
    TABLES = {
      req: new DataTable($("#req-table"), {
        name: "purchase-requests", search: ["jobCode", "supplier", "item", "note"], placeholder: "Search job, supplier or item",
        tabs: { options: [
          { value: "today", label: "Today", match: (r) => r.date === V.T },
          { value: "waiting", label: "Waiting for cash", match: (r) => (r.status || "Waiting for cash") === "Waiting for cash" },
          { value: "all", label: "All", match: () => true }] },
        sort: { key: "date", dir: -1 },
        rowClass: (r) => (r.broken ? "row-bad" : null),
        columns: [
          { key: "date", label: "Date", cell: (r) => fday(r.date), cls: "muted" },
          { key: "jobCode", label: "Job", cls: "strong" },
          { key: "supplier", label: "Supplier / item", cell: (r) => twoLine(r.supplier, r.item) },
          { key: "amount", label: "Amount", num: true, cell: (r) => amountCell(r.amount), sortVal: (r) => n0(r.amount) },
          { key: "approval", label: "Approval", cell: (r) => [badge(r.approval || "Pending"), h("span", { class: "sub" }, `by ${r.approver}`)], csv: (r) => `${r.approval || "Pending"} (${r.approver})` },
          { key: "fundsConfirmed", label: "Funds in bank?", cell: (r) => yn(r.fundsConfirmed, r.chequeIssued === "Yes") },
          { key: "chequeIssued", label: "Cheque issued?", cell: (r) => yn(r.chequeIssued) },
          { key: "status", label: "Status", cell: (r) => (r.broken ? [badge("Rule broken"), h("span", { class: "sub" }, r.noFunds ? "cheque without confirmed funds" : "cheque without approval")] : badge(r.status || "Waiting for cash")), csv: (r) => (r.broken ? "Rule broken" : r.status) },
        ],
        summary: totalOf("Total"),
        emptyTitle: "No purchase requests", emptyText: "Add them in the Data sheet (Purchase requests tab).",
      }),
      chq: new DataTable($("#chq-table"), {
        name: "cheques-delivered", search: ["jobCode", "supplier", "note"], placeholder: "Search job or supplier",
        tabs: { options: [
          { value: "today", label: "Today", match: (r) => r.date === V.T },
          { value: "docs", label: "Documents missing", match: (r) => r.docsToFinance !== "Yes" },
          { value: "all", label: "All", match: () => true }] },
        sort: { key: "date", dir: -1 },
        columns: [
          { key: "date", label: "Date", cell: (r) => fday(r.date), cls: "muted" },
          { key: "jobCode", label: "Job", cls: "strong" },
          { key: "supplier", label: "Supplier" },
          { key: "amount", label: "Cheque amount", num: true, cell: (r) => amountCell(r.amount), sortVal: (r) => n0(r.amount) },
          { key: "time", label: "Time", cls: "muted" },
          { key: "supplierConfirmed", label: "Supplier confirmed?", cell: (r) => yn(r.supplierConfirmed, true) },
          { key: "deliveryDate", label: "Materials delivery", cell: (r) => fdate(r.deliveryDate), cls: "muted" },
          { key: "docsToFinance", label: "Docs to finance", cell: (r) => (r.docsToFinance === "Yes" ? badge("Yes", "good") : r.docsLate ? badge("Docs late") : badge("Due tomorrow")), csv: (r) => r.docsToFinance || "No" },
        ],
        summary: totalOf("Total"),
        emptyTitle: "No cheques", emptyText: "Add them in the Data sheet (Cheques tab).",
      }),
      mat: new DataTable($("#mat-table"), {
        name: "materials", search: ["jobCode", "material", "supplier", "note"], placeholder: "Search job, material or supplier",
        tabs: { options: [
          { value: "open", label: "Today & not arrived", match: (r) => r.actualDate === V.T || r.disp !== "In store" },
          { value: "late", label: "Late & defects", match: (r) => r.disp === "Late" || r.disp === "Delayed" || r.defect === "Yes" },
          { value: "all", label: "All", match: () => true }] },
        sort: { key: "expectedDate", dir: 1 },
        rowClass: (r) => (r.disp === "Late" || r.defect === "Yes" ? "row-bad" : null),
        columns: [
          { key: "jobCode", label: "Job", cls: "strong" },
          { key: "material", label: "Material", cell: (r) => twoLine(r.material, r.supplier) },
          { key: "orderedDate", label: "Ordered", cell: (r) => fdate(r.orderedDate), cls: "muted" },
          { key: "expectedDate", label: "Expected", cell: (r) => fdate(r.expectedDate), cls: "muted" },
          { key: "actualDate", label: "Arrived", cell: (r) => fdate(r.actualDate), cls: "muted" },
          { key: "disp", label: "Status", cell: (r) => badge(r.disp), csv: (r) => r.disp },
          { key: "defect", label: "Defect?", cell: (r) => (r.defect === "Yes" ? badge("Defect") : badge("No")) },
          { key: "confirmed", label: `Confirmed by ${C.storekeeper || "store"}?`, cell: (r) => (r.arrived ? yn(r.confirmed, true) : h("span", { class: "muted" }, "—")) },
        ],
        emptyTitle: "No materials here", emptyText: "Add them in the Data sheet (Materials tab).",
      }),
      var: new DataTable($("#var-table"), {
        name: "cost-variance", search: ["jobCode", "customer", "overrunReason", "overrunAction"], placeholder: "Search job",
        tabs: { options: [
          { value: "over", label: "Over budget", match: (r) => r.variance > 0.005 },
          { value: "all", label: "All jobs", match: () => true }] },
        sort: { key: "variance", dir: -1 },
        rowClass: (r) => (r.variance > 0.005 && !String(r.overrunReason || "").trim() ? "row-bad" : null),
        columns: [
          { key: "jobCode", label: "Job", cell: (r) => twoLine(r.jobCode, r.customer) },
          { key: "contractValue", label: "Contract value", num: true, cell: (r) => amountCell(r.contractValue), sortVal: (r) => n0(r.contractValue) },
          { key: "cost", label: "Purchase cost", num: true, cell: (r) => [money(r.cost), h("span", { class: "sub" }, r.costSource)] },
          { key: "variance", label: "Variance", num: true, cell: (r) => (r.variance == null ? "—" : (r.variance > 0 ? "+" : "") + money(r.variance)), sortVal: (r) => (r.variance == null ? -1e15 : r.variance) },
          { key: "overrunReason", label: "Reason for overrun", cls: "wrap", cell: (r) => (r.variance > 0.005 && !String(r.overrunReason || "").trim() ? badge("No explanation") : r.overrunReason || "—") },
          { key: "overrunAction", label: "Action taken", cls: "wrap muted" },
        ],
        summary: (rows) => ["Total variance ", h("strong", {}, money(sum(rows.filter((r) => r.variance > 0), (r) => r.variance)))],
        emptyTitle: "No jobs over budget", emptyText: "Jobs appear here when purchase cost is higher than the contract value.",
      }),
      bom: new DataTable($("#bom-table"), {
        name: "missing-boms", search: ["jobCode", "missingInfo", "missingReason"], placeholder: "Search job",
        sort: { key: "expectedDate", dir: 1 },
        rowClass: (r) => (r.late ? "row-bad" : null),
        columns: [
          { key: "jobCode", label: "Job", cell: (r) => twoLine(r.jobCode, r.customer) },
          { key: "missingInfo", label: "Missing information", cell: (r) => r.missingInfo || badge("Not stated", "critical") },
          { key: "missingReason", label: "Reason for delay", cls: "wrap" },
          { key: "expectedDate", label: "Expected completion", cell: (r) => (isISO(r.expectedDate) ? [fdate(r.expectedDate), r.late ? h("span", { class: "sub" }, badge("Late")) : null] : badge("No date", "critical")) },
        ],
        emptyTitle: "No missing BOMs", emptyText: "Every job has a complete BOM.",
      }),
      issues: new DataTable($("#issue-table"), {
        name: "supplier-issues", search: ["jobCode", "supplier", "issue", "action"], placeholder: "Search issues",
        tabs: { options: [
          { value: "open", label: "Open", match: (r) => (r.status || "Open") !== "Resolved" },
          { value: "all", label: "All", match: () => true }] },
        sort: { key: "date", dir: -1 },
        columns: [
          { key: "date", label: "Date", cell: (r) => fday(r.date), cls: "muted" },
          { key: "jobCode", label: "Job", cls: "strong" },
          { key: "supplier", label: "Supplier" },
          { key: "issue", label: "Issue", cls: "wrap" },
          { key: "action", label: "Action taken", cls: "wrap muted" },
          { key: "status", label: "Replacement / refund", cell: (r) => badge(r.status || "Open") },
          { key: "withheld", label: "Payment withheld?", cell: (r) => yn(r.withheld) },
        ],
        emptyTitle: "No supplier issues", emptyText: "Good news, or add issues in the Data sheet.",
      }),
      cash: new DataTable($("#cash-table"), {
        name: "cash-needed-tomorrow",
        sort: { key: "priority", dir: 1 },
        columns: [
          { key: "priority", label: "Priority", cell: (r) => h("span", { class: "prio" }, String(r.priority || "—")), sortVal: (r) => n0(r.priority) || 99 },
          { key: "jobCode", label: "Job", cls: "strong" },
          { key: "supplier", label: "Supplier" },
          { key: "amount", label: "Amount needed", num: true, cell: (r) => amountCell(r.amount), sortVal: (r) => n0(r.amount) },
          { key: "consequence", label: "Consequence if not paid", cls: "wrap" },
        ],
        summary: totalOf("Total cash needed"),
        emptyTitle: "No cash requests for tomorrow", emptyText: "Add them in the Data sheet (Cash needs tab).",
      }),
    };
  }

  /* ---------- report sections ---------- */
  function renderGlance() {
    const v = V;
    const spark = h("div", { class: "hero-spark-bars" });
    const fc = v.fcDays.map((_, i) => v.fcNeeds[i] + v.fcDues[i]);
    $("#hero").replaceChildren(
      h("div", { class: "hero-top" },
        h("span", { class: "hero-label" }, "Cash needed tomorrow ", h("span", {}, `· ${fday(v.T1)}`)),
        h("span", { class: "tile-foot" }, `${num(v.cashTomorrow.length)} item${v.cashTomorrow.length === 1 ? "" : "s"}`)),
      h("div", { class: "hero-value", title: money(v.cashTotal) }, moneyC(v.cashTotal)),
      h("div", { class: "hero-sub" }, "Next 7 days ", h("strong", {}, money(v.fcTotal)), " (cash requests + supplier dues)"),
      h("div", { class: "hero-spark" }, spark,
        h("div", { class: "hero-spark-caption" }, h("span", {}, v.fcLabels[0].short), h("span", {}, "Next 7 days"), h("span", {}, v.fcLabels[6].short))));
    V.spark = spark;
    V.sparkValues = fc;
    drawSpark(spark, fc, v.fcLabels);

    const tile = (label, value, foot, title) => h("article", { class: "card tile" },
      h("span", { class: "tile-label" }, label), h("span", { class: "tile-value", title }, value), h("span", { class: "tile-foot" }, foot));
    const okCount = v.checks.filter((c) => c.state === "ok").length;
    const failCount = v.checks.filter((c) => c.state === "fail").length;
    $("#kpi-tiles").replaceChildren(
      tile("Requested today", moneyC(sum(v.reqToday)), v.reqBrokenToday.length ? warn(`${num(v.reqBrokenToday.length)} rule broken`) : `${num(v.reqToday.length)} requests · ${num(v.reqWaiting.length)} waiting`, money(sum(v.reqToday))),
      tile("Cheques delivered today", moneyC(sum(v.chqToday)), v.chqUnconfirmed.length ? warn(`${num(v.chqUnconfirmed.length)} not confirmed`) : `${num(v.chqToday.length)} cheques`, money(sum(v.chqToday))),
      tile("Owed to suppliers", moneyC(v.owed), v.overdue > 0 ? warn(`${moneyC(v.overdue)} overdue`) : `${moneyC(v.due7)} due in 7 days`, money(v.owed)),
      tile("Late materials", num(v.matLate.length), v.matDefects.length ? warn(`${num(v.matDefects.length)} defective`) : `${num(v.matToday.length)} arrived today`),
      tile("Cost overruns", num(v.overruns.length), v.unexplained.length ? warn(`${num(v.unexplained.length)} not explained`) : v.overruns.length ? `+${moneyC(sum(v.overruns, (j) => j.variance))}` : "All within contract"),
      tile("Compliance", `${okCount} / ${v.checks.length}`, failCount ? warn(`${failCount} not OK`) : "All checks OK"));
  }

  function renderSections() {
    const v = V;
    // 01
    statStrip($("#req-stats"), [
      { label: "Requested today", value: moneyC(sum(v.reqToday)), title: money(sum(v.reqToday)), foot: `${num(v.reqToday.length)} requests` },
      { label: "Waiting for cash", value: moneyC(sum(v.reqWaiting)), title: money(sum(v.reqWaiting)), foot: `${num(v.reqWaiting.length)} requests` },
      { label: "Cheques issued today", value: moneyC(sum(v.reqChequesToday)), title: money(sum(v.reqChequesToday)), foot: `${num(v.reqChequesToday.length)} cheques` },
      { label: "Rule broken today", value: num(v.reqBrokenToday.length), foot: v.reqBrokenToday.length ? warn("Cheque without funds or approval") : "None" },
    ]);
    TABLES.req.setRows(v.req);
    // 02
    statStrip($("#chq-stats"), [
      { label: "Delivered today", value: moneyC(sum(v.chqToday)), title: money(sum(v.chqToday)), foot: `${num(v.chqToday.length)} cheques` },
      { label: "Supplier confirmed", value: `${num(v.chqToday.length - v.chqUnconfirmed.length)} / ${num(v.chqToday.length)}`, foot: v.chqUnconfirmed.length ? warn(`${num(v.chqUnconfirmed.length)} not confirmed`) : "All confirmed" },
      { label: "Docs to finance, late", value: num(v.docsLate.length), foot: v.docsLate.length ? warn("Older than 24 hours") : `${num(v.docsPendingToday.length)} due tomorrow` },
      { label: "Next material delivery", value: (() => { const d = v.chqToday.map((c) => c.deliveryDate).filter(isISO).sort()[0]; return d ? fday(d) : "—"; })(), foot: "From today's cheques" },
    ]);
    TABLES.chq.setRows(v.chq);
    // 03
    statStrip($("#mat-stats"), [
      { label: "Arrived today", value: num(v.matToday.length), foot: fday(v.T) },
      { label: "In transit", value: num(v.matOpen.length - v.matLate.length), foot: "On time" },
      { label: "Late or delayed", value: num(v.matLate.length), foot: v.matLate.length ? warn("Expected date passed") : "None" },
      { label: "Defective (30 days)", value: num(v.matDefects.length), foot: v.matUnconfirmed.length ? warn(`${num(v.matUnconfirmed.length)} receipts not confirmed`) : "Rejected with photos" },
    ]);
    TABLES.mat.setRows(v.mat);
    // 04
    statStrip($("#credit-stats"), [
      { label: "Total owed to suppliers", value: moneyC(v.owed), title: `${money(v.owed)} · cheque given for ${money(v.chequeHeld)}`, foot: `${num(v.sup.filter((x) => x.closing > 0.005).length)} suppliers · ${moneyC(v.chequeHeld)} with cheque given` },
      { label: "Overdue", value: moneyC(v.overdue), title: money(v.overdue), foot: v.overdue > 0 ? warn("Past due date") : "Nothing overdue" },
      { label: "Due within 7 days", value: moneyC(v.due7), title: money(v.due7), foot: `Up to ${fday(v.T7)}` },
      { label: "Today", value: `+${moneyC(v.newCredit)}`, title: `New credit ${money(v.newCredit)}, paid ${money(v.paidToday)}`, foot: `new credit · ${moneyC(v.paidToday)} paid` },
    ]);
    const supRows = [...v.sup].sort((a, b) => b.closing - a.closing);
    $("#credit-table").replaceChildren(simpleTable({
      head: ["Supplier", "Terms", "Opening", "New credit today", "Paid today", "Closing", "Next due", "Cheque given?", "Status"], num: [2, 3, 4, 5],
      rows: supRows.map((x) => [h("strong", {}, x.name), x.terms, money(x.opening), money(x.newCredit), money(x.paidToday), h("strong", {}, money(x.closing)),
        x.cod && x.closing > 0 ? "Immediate" : x.nextDue ? fdate(x.nextDue) : "—",
        x.chequeNos.length ? [chequeText(x), h("span", { class: "sub" }, `No. ${x.chequeNos.join(", ")}`)] : chequeText(x), badge(x.status)]),
      foot: ["Total", "", money(sum(supRows, (x) => x.opening)), money(v.newCredit), money(v.paidToday), money(sum(supRows, (x) => x.closing)), "", v.chequeHeld > 0.005 ? money(v.chequeHeld) : "", ""],
      empty: emptyState("No suppliers yet", "Add suppliers and their credit / payments in the Data sheet."),
    }));
    V.supBars = supRows.filter((x) => x.closing > 0.005).slice(0, 10).map((x) => ({ label: x.name, value: x.closing, extra: [{ value: x.status, label: "" }] }));
    // 05
    const worst = v.overruns[0];
    statStrip($("#var-stats"), [
      { label: "Jobs over budget", value: num(v.overruns.length), foot: `of ${num(v.jobs.length)} jobs` },
      { label: "Total overrun", value: moneyC(sum(v.overruns, (j) => j.variance)), title: money(sum(v.overruns, (j) => j.variance)), foot: "Purchase cost above contract" },
      { label: "Without explanation", value: num(v.unexplained.length), foot: v.unexplained.length ? warn("Written explanation needed") : "All explained" },
      { label: "Largest overrun", value: worst ? worst.jobCode : "—", foot: worst ? `+${money(worst.variance)}` : "None" },
    ]);
    TABLES.var.setRows(v.jobs);
    // 06
    statStrip($("#bom-stats"), [
      { label: "Jobs missing BOM data", value: num(v.missing.length), foot: v.missing.length ? "Cannot go to production" : "All complete" },
      { label: "Past expected date", value: num(v.missingLate.length), foot: v.missingLate.length ? warn("Late") : "None late" },
      { label: "Missing purchase cost", value: num(v.missing.filter((j) => /cost/i.test(j.missingInfo || "")).length), foot: "Most common gap" },
      { label: "Job codes not in Jobs sheet", value: num(v.unknownJobs.length), foot: v.unknownJobs.length ? listText(v.unknownJobs, 3) : "All listed" },
    ]);
    TABLES.bom.setRows(v.missing);
    // 07
    statStrip($("#issue-stats"), [
      { label: "Open issues", value: num(v.issOpen.length), foot: v.issOpen.length ? "Replacement or refund pending" : "None" },
      { label: "New today", value: num(v.issToday.length), foot: fday(v.T) },
      { label: "Payment withheld", value: num(v.issWithheld.length), foot: "Finance holding payment" },
      { label: "Defective materials", value: num(v.matDefects.length), foot: "From the Materials sheet (30 days)" },
    ]);
    TABLES.issues.setRows(v.iss);
    // 08
    const top = v.cashTomorrow[0];
    statStrip($("#cash-stats"), [
      { label: "Cash needed tomorrow", value: moneyC(v.cashTotal), title: money(v.cashTotal), foot: `${num(v.cashTomorrow.length)} items · ${fday(v.T1)}` },
      { label: "Top priority", value: top ? top.jobCode || "—" : "—", foot: top ? `${top.supplier || ""} · ${money(top.amount)}` : "Nothing requested" },
      { label: "Supplier dues tomorrow", value: moneyC(v.fcDues[0]), title: money(v.fcDues[0]), foot: "From supplier credit" },
      { label: "Next 7 days", value: moneyC(v.fcTotal), title: money(v.fcTotal), foot: "Requests + supplier dues" },
    ]);
    $("#cash-table-title").textContent = `Cash needed tomorrow · ${flong(v.T1)}`;
    TABLES.cash.setRows(v.cashTomorrow);
    // 09
    renderSummary();
    // 10
    renderChecklist();
  }

  function renderSummary() {
    const v = V, sm = v.summary;
    const who = firstName(C.preparedBy);
    const lines = sm ? [["Biggest risk", sm.risk], ["Biggest win", sm.win], ["Need tomorrow", sm.need], ["Other notes", sm.note]].filter(([, t]) => String(t || "").trim()) : [];
    $("#summary-written").replaceChildren(
      h("div", { class: "summary-head" }, h("h3", {}, `${who}'s summary`), sm ? badge("Written", "good") : badge("Not written yet", "warning")),
      lines.length
        ? h("dl", { class: "summary-list" }, lines.map(([k, t]) => [h("dt", {}, k), h("dd", {}, t)]))
        : h("p", { class: "muted" }, "Write today's summary in the Data sheet (Daily summary tab): the biggest risk, the biggest win, and what you need tomorrow."));
    const copy = h("button", { class: "btn btn-sm", type: "button" }, icon("copy"), "Copy");
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(v.auto); toast("Summary copied."); } catch (e) { toast("Could not copy. Select the text and copy it."); }
    });
    $("#summary-auto").replaceChildren(
      h("div", { class: "summary-head" }, h("h3", {}, "Suggested from today's data"), copy),
      h("p", { class: "summary-text" }, v.auto));
  }

  function renderChecklist() {
    const v = V;
    const box = $("#checklist");
    const items = v.checks.map((c) => {
      const tone = c.state === "ok" ? "good" : c.state === "pending" ? "warning" : "critical";
      const ic = c.state === "ok" ? "check" : c.state === "pending" ? "clock" : "alertCircle";
      const row = h("div", { class: `check-row ${tone}` },
        h("span", { class: "check-icon" }, icon(ic)),
        h("div", { class: "check-text" }, h("strong", {}, c.label), h("span", {}, c.detail)));
      if (c.sent && canWrite()) {
        const sent = D.sent.find((x) => x.date === v.T);
        const btn = h("button", { class: `btn btn-sm ${sent ? "" : "btn-primary"}`, type: "button" }, icon("send"), sent ? "Change time" : "Mark as sent");
        btn.addEventListener("click", () => {
          let time = nowHM();
          if (v.T !== todayISO() || sent) {
            const t = prompt("What time was the report sent? (HH:MM, 24-hour)", sent ? sent.time : C.deadline || "17:30");
            if (t == null) return;
            if (!/^\d{1,2}:\d{2}$/.test(t.trim())) { toast("Please use HH:MM, for example 17:15."); return; }
            time = t.trim().padStart(5, "0");
          }
          D.sent = D.sent.filter((x) => x.date !== v.T).concat({ date: v.T, time });
          saveData(); rebuildAll(); toast(`Marked as sent at ${time}.`);
        });
        row.append(btn);
      }
      return row;
    });
    const ok = v.checks.filter((c) => c.state === "ok").length;
    box.replaceChildren(
      h("div", { class: "summary-head" }, h("h3", {}, `${ok} of ${v.checks.length} checks OK`), ok === v.checks.length ? badge("Ready to send", "good") : badge("Check before sending", "warning")),
      ...items);
  }

  /* ---------- chart definitions ---------- */
  chart("supBalances", {
    fluid: true,
    draw: (el) => drawHBars(el, V.supBars, { key: "out", fmt: moneyC, tipFmt: money, unit: "owed" }),
    table: () => ({ head: ["Supplier", "Closing balance", "Status"], num: [1], rows: V.supBars.map((x) => [x.label, money(x.value), x.extra[0].value]) }),
  });
  chart("forecast", {
    draw: (el) => drawColumns(el, {
      labels: V.fcLabels, series: [{ name: "Cash requests", key: "in", values: V.fcNeeds }, { name: "Supplier payments due", key: "out", values: V.fcDues }],
      selected: new Set([0]), fmt: money, fmtTick: moneyC, label: "7-day cash forecast", emptyText: "No cash requests or supplier payments due in the next 7 days.",
      extraRows: (i) => [{ sep: true, value: money(V.fcNeeds[i] + V.fcDues[i]), label: "total" }],
    }),
    table: () => ({ head: ["Day", "Cash requests", "Supplier dues", "Total"], num: [1, 2, 3],
      rows: V.fcDays.map((d, i) => [flong(d), money(V.fcNeeds[i]), money(V.fcDues[i]), money(V.fcNeeds[i] + V.fcDues[i])]),
      foot: ["Total", money(sum(V.fcNeeds, (x) => x)), money(sum(V.fcDues, (x) => x)), money(V.fcTotal)] }),
  });

  /* ---------- date control & render ---------- */
  const dateInput = $("#report-date");
  function setDate(iso) { state.date = isISO(iso) ? iso : todayISO(); render(); }

  function render() {
    buildFormats();
    V = buildView();
    dateInput.value = state.date;
    $("#day-today").disabled = state.date === todayISO();
    $("#filter-note").replaceChildren(h("strong", {}, flong(state.date)), ` · deadline ${C.deadline || "17:30"}`);
    try {
      const url = new URL(location.href);
      if (state.date === todayISO()) url.searchParams.delete("date"); else url.searchParams.set("date", state.date);
      history.replaceState(null, "", url);
    } catch (e) { /* file:// or sandboxed */ }
    renderGlance();
    renderSections();
    Object.keys(CHARTS).forEach(drawChart);
  }

  function applyCompanyText() {
    const bank = C.bank || "the bank";
    const limit = moneyC(n0(C.approvalLimit) || 50000);
    const who = firstName(C.preparedBy);
    document.title = `Daily Purchasing & Materials Report · ${C.name || "Company"}`;
    $("#company-name").textContent = C.name || "Company";
    $("#foot-company").textContent = C.name || "Company";
    $("#eyebrow").textContent = C.name || "Purchasing";
    $("#prepared-by").textContent = C.preparedBy || "—";
    $("#submitted-to").textContent = C.submittedTo || "—";
    $("#lede").textContent = `Prepared by ${C.preparedBy || "purchasing"} for ${C.submittedTo || "the Chairman"}. Deadline ${C.deadline || "17:30"}.`;
    $("#foot-period").textContent = `amounts in ${CUR}`;
    $("#foot-note").textContent = CONNECTED ? "Every number is calculated from the Data sheet. Records are saved online and shared with everyone who has this report's link." : D.sample
      ? "Showing example data. Clear it with Start empty in the Data sheet."
      : "Every number is calculated from the Data sheet. Records are saved on the device they were entered on.";
    const rules = {
      requests: `No cheque is issued without finance confirming funds are in ${bank}. Approval: ${C.approverLow || "finance"} below ${limit}, ${C.approverHigh || "senior approver"} from ${limit}.`,
      cheques: "The supplier must deliver materials once the cheque is received.",
      materials: `The storekeeper (${C.storekeeper || "store"}) must confirm receipt. Defective materials are rejected with photos.`,
      credit: "Track who we borrow from, what we pay, and when it is due. This feeds the 7-day cash flow forecast.",
      variance: "Any purchase cost above the contract value needs an immediate written explanation.",
      bom: "No job goes to production without a complete Bill of Materials (BOM).",
      issues: `${C.storekeeper || "The storekeeper"} rejects, ${who} contacts the supplier, finance withholds payment if needed.`,
      cash: "This feeds finance's 7-day cash flow forecast.",
      summary: "3–4 sentences: the biggest risk, the biggest win, and what you need from operations or finance tomorrow.",
      compliance: `${who} checks these before sending the report to ${C.submittedTo || "the Chairman"} by ${C.deadline || "17:30"}.`,
    };
    $$("[data-rule]").forEach((el) => el.replaceChildren(icon("shield"), h("span", {}, h("strong", {}, "Rule: "), rules[el.dataset.rule] || "")));
  }

  function renderBanner() {
    const el = $("#data-banner");
    const openSheet = h("button", { class: "btn btn-sm", type: "button" }, icon("sheet"), "Open Data sheet");
    openSheet.addEventListener("click", () => setView("sheet"));
    const empty = DATASETS.filter((k) => k !== "sent").every((k) => !D[k].length);
    let msg = null;
    if (CONNECTED && !empty) { el.hidden = true; return; }
    if (CONNECTED) msg = [h("strong", {}, "No records yet. "), canWrite() ? "Open the Data sheet to add records. Everything you type is shared with everyone who has this report's link." : "Nothing has been entered yet."];
    else if (empty) msg = [h("strong", {}, "No records yet. "), "Open the Data sheet to add purchase requests, cheques, materials, suppliers, jobs, issues and cash needs. Or tap Try example data to see how the report looks."];
    else if (D.sample) msg = [h("strong", {}, "Example data. "), "These records are made up so you can see the report. Clear them with Start empty in the Data sheet."];
    else if (LOCAL) msg = [h("strong", {}, "Saved on this device. "), "Back up regularly with Export Excel in the Data sheet."];
    el.className = "notice report-only";
    el.hidden = !msg;
    if (msg) el.replaceChildren(icon("info"), h("div", { class: "grow" }, msg), h("div", { class: "acts" }, openSheet));
  }

  function rebuildAll() {
    buildFormats();
    applyCompanyText();
    buildTables();
    render();
    renderBanner();
    dirty = false;
  }

  /* ==========================================================================
     DATA SHEET — spreadsheet-style editor
     ========================================================================== */
  const col = (key, label, type = "text", w = 130, extra = {}) => ({ key, label, type, w, ...extra });
  const cId = (w = 90) => col("id", "ID", "text", w);
  const cDate = (key = "date", label = "Date", w = 140) => col(key, label, "date", w);
  const cJob = (w = 100) => col("jobCode", "Job code", "text", w, { pool: "job" });
  const cSup = (w = 180) => col("supplier", "Supplier", "text", w, { pool: "supplier" });
  const cAmount = (label = "Amount") => col("amount", label, "number", 140);
  const cNote = (w = 200) => col("note", "Note", "text", w);
  const optsOf = (c) => (typeof c.options === "function" ? c.options() : c.options);

  const SHEETS = [
    { id: "requests", label: "Purchase requests", prefix: "PR-", cols: [
      cId(), cDate(), cJob(), cSup(), col("item", "Item / material", "text", 200, { suggest: true }), cAmount(),
      col("approval", "Approval", "select", 110, { options: APPROVAL }), col("fundsConfirmed", "Funds in bank?", "select", 120, { options: NO_YES }),
      col("chequeIssued", "Cheque issued?", "select", 120, { options: NO_YES }), col("status", "Status", "select", 150, { options: REQ_STATUS }), cNote(),
    ] },
    { id: "cheques", label: "Cheques delivered", prefix: "CQ-", cols: [
      cId(), cDate(), cJob(), cSup(), cAmount("Cheque amount"), col("time", "Time delivered", "time", 120),
      col("supplierConfirmed", "Supplier confirmed?", "select", 150, { options: NO_YES }), cDate("deliveryDate", "Materials delivery date", 180),
      col("docsToFinance", "Docs to finance?", "select", 140, { options: NO_YES }), cNote(),
    ] },
    { id: "materials", label: "Materials", prefix: "MT-", cols: [
      cId(), cJob(), col("material", "Material", "text", 200, { suggest: true }), cSup(170), cDate("orderedDate", "Ordered"),
      cDate("expectedDate", "Expected arrival", 150), cDate("actualDate", "Actual arrival", 150), col("status", "Status", "select", 120, { options: MAT_STATUS }),
      col("defect", "Defect?", "select", 90, { options: NO_YES }), col("confirmed", "Storekeeper confirmed?", "select", 170, { options: NO_YES }), cNote(),
    ], onChange: (r, key) => {
      if (key === "actualDate" && isISO(r.actualDate) && r.status !== "In store") { r.status = "In store"; return ["status"]; }
      return [];
    } },
    { id: "suppliers", label: "Suppliers", prefix: "SP-", aliases: ["supplier", "supplierlist"], cols: [
      cId(), col("name", "Supplier name", "text", 200, { pool: "supplier" }), col("terms", "Credit terms", "select", 110, { options: TERMS }),
      col("openingBalance", "Opening balance", "number", 140), cDate("openingDue", "Opening balance due", 170), col("phone", "Phone", "text", 130), cNote(),
    ] },
    { id: "ledger", label: "Credit & payments", prefix: "LG-", aliases: ["credit", "creditandpayments", "suppliercredit", "payments"], cols: [
      cId(), cDate(), cSup(), col("type", "Type", "select", 140, { options: LEDGER_TYPES }), cAmount(), cDate("dueDate", "Due date"),
      col("chequeGiven", "Cheque given?", "select", 130, { options: NO_YES }), col("chequeNo", "Cheque no.", "text", 120),
      cJob(), col("paidVia", "Paid via", "select", 140, { options: () => [C.bank || "Bank", "Cash", "Other bank"] }), cNote(),
    ], onChange: (r, key) => {
      if ((key === "date" || key === "supplier" || key === "type") && r.type === "Credit taken" && isISO(r.date) && !isISO(r.dueDate)) {
        const sup = D.suppliers.find((x) => x.name === r.supplier);
        r.dueDate = addDays(r.date, termDays(sup && sup.terms)); return ["dueDate"];
      }
      if (key === "type" && r.type === "Payment made" && isISO(r.dueDate)) { r.dueDate = ""; return ["dueDate"]; }
      return [];
    } },
    { id: "jobs", label: "Jobs (contract & BOM)", prefix: "JB-", aliases: ["jobs", "job", "contracts"], cols: [
      cId(), cJob(), col("customer", "Customer", "text", 160, { suggest: true }), col("contractValue", "Contract value", "number", 140),
      col("purchaseCost", "Purchase cost (blank = from requests)", "number", 240), col("bomComplete", "BOM complete?", "select", 130, { options: ["No", "Yes"] }),
      col("missingInfo", "Missing information", "text", 180, { suggest: true }), col("missingReason", "Reason for delay", "text", 200),
      cDate("expectedDate", "Expected completion", 160), col("overrunReason", "Reason for overrun", "text", 220), col("overrunAction", "Action taken", "text", 200),
    ] },
    { id: "issues", label: "Supplier issues", prefix: "IS-", aliases: ["issues", "defects"], cols: [
      cId(), cDate(), cJob(), cSup(), col("issue", "Issue", "text", 240), col("action", "Action taken", "text", 200),
      col("status", "Status", "select", 170, { options: ISSUE_STATUS }), col("withheld", "Payment withheld?", "select", 150, { options: NO_YES }),
    ] },
    { id: "cashNeeds", label: "Cash needs", prefix: "CN-", aliases: ["cashneeds", "cash", "cashrequirements"], cols: [
      cId(), cDate("dateNeeded", "Date needed"), col("priority", "Priority", "number", 90), cJob(), cSup(), cAmount("Amount needed"),
      col("consequence", "Consequence if not paid", "text", 240), col("status", "Status", "select", 110, { options: NEED_STATUS }),
    ], defaults: () => ({ dateNeeded: addDays(todayISO(), 1), priority: D.cashNeeds.filter((n) => n.dateNeeded === addDays(todayISO(), 1)).length + 1 }) },
    { id: "summaries", label: "Daily summary", prefix: "DS-", aliases: ["summary", "dailysummary"], cols: [
      cId(), cDate(), col("risk", "Biggest risk", "text", 280), col("win", "Biggest win", "text", 280),
      col("need", "What we need tomorrow (operations / finance)", "text", 300), col("note", "Other notes", "text", 220),
    ] },
  ];
  const SETTINGS = [
    { key: "name", label: "Company name" },
    { key: "preparedBy", label: "Prepared by" },
    { key: "submittedTo", label: "Submitted to" },
    { key: "deadline", label: "Deadline (HH:MM)", hint: "24-hour time, e.g. 17:30" },
    { key: "bank", label: "Bank for all payments" },
    { key: "approverLow", label: "Approver below the limit" },
    { key: "approverHigh", label: "Approver from the limit" },
    { key: "approvalLimit", label: "Approval limit (amount)", number: true },
    { key: "storekeeper", label: "Storekeeper" },
    { key: "currency", label: "Currency code", hint: "ISO code, e.g. ETB" },
  ];

  const sheetUI = { active: "requests", q: "" };
  const normKey = (x) => String(x ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  function parseNumber(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : "";
    const t = String(v ?? "").trim();
    if (!t) return "";
    const n = parseFloat(t.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : "";
  }
  function parseDateValue(v, X) {
    if (v == null || v === "") return "";
    if (typeof v === "number" && X) {
      const d = X.SSF.parse_date_code(v);
      if (d) return `${d.y}-${pad2(d.m)}-${pad2(d.d)}`;
    }
    if (v instanceof Date && !isNaN(v)) return toISO(v);
    const t = String(v).trim();
    let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
    m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) {
      const a = +m[1], b = +m[2];
      const [day, mon] = b > 12 ? [b, a] : [a, b]; // day-first unless impossible
      return `${m[3]}-${pad2(mon)}-${pad2(day)}`;
    }
    const d = new Date(t);
    return isNaN(d) ? t : toISO(d);
  }
  function parseTime(v) {
    if (v == null || v === "") return "";
    if (typeof v === "number" && v >= 0 && v < 1) { const mins = Math.round(v * 1440); return `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`; }
    const m = String(v).trim().match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
    if (!m) return String(v).trim();
    let hh = +m[1];
    if (m[3] && /pm/i.test(m[3]) && hh < 12) hh += 12;
    if (m[3] && /am/i.test(m[3]) && hh === 12) hh = 0;
    return `${pad2(hh)}:${m[2]}`;
  }
  function coerce(c, v, X) {
    if (c.type === "number") return parseNumber(v);
    if (c.type === "date") return parseDateValue(v, X);
    if (c.type === "time") return parseTime(v);
    let t = String(v ?? "").trim();
    if (c.type === "select") {
      const hit = optsOf(c).find((o) => normKey(o) === normKey(t));
      if (hit) t = hit;
    }
    return t;
  }
  function nextId(def) {
    if (CONNECTED) return `${def.prefix}${todayISO().slice(2).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
    let max = 0, width = 3;
    for (const r of D[def.id]) {
      const m = String(r.id || "").match(/(\d+)\s*$/);
      if (m) { max = Math.max(max, +m[1]); width = Math.max(width, m[1].length); }
    }
    return `${def.prefix}${String(max + 1).padStart(width, "0")}`;
  }
  function blankRow(def) {
    const r = {};
    for (const c of def.cols) r[c.key] = c.type === "select" ? optsOf(c)[0] : "";
    const firstDate = def.cols.find((c) => c.type === "date");
    if (firstDate) r[firstDate.key] = todayISO();
    if (def.id === "cheques") r.time = nowHM();
    if (def.id === "materials") r.expectedDate = "";
    Object.assign(r, def.defaults ? def.defaults() : {});
    r.id = nextId(def);
    return r;
  }
  function poolValues(c, rows) {
    if (c.pool === "job") return uniq(DATASETS.flatMap((k) => D[k].map((r) => r.jobCode)));
    if (c.pool === "supplier") return uniq([...D.suppliers.map((r) => r.name), ...DATASETS.flatMap((k) => D[k].map((r) => r.supplier))]);
    return uniq(rows.map((r) => r[c.key]));
  }

  function renderSheetTabs() {
    const tabs = $("#sheet-tabs");
    const all = [...SHEETS.map((d) => ({ id: d.id, label: d.label, count: D[d.id].length })), { id: "settings", label: "Settings" }];
    tabs.replaceChildren(...all.map((t) => {
      const b = h("button", { type: "button", role: "tab", "aria-selected": String(t.id === sheetUI.active), "aria-pressed": String(t.id === sheetUI.active) },
        t.label, t.count != null ? h("span", { class: "cnt" }, num(t.count)) : null);
      b.addEventListener("click", () => { sheetUI.active = t.id; sheetUI.q = ""; renderSheetTabs(); renderSheet(); });
      return b;
    }));
  }

  function renderSheetNotice() {
    if (CONNECTED) {
      $("#sheet-notice").replaceChildren(icon("info"), h("div", { class: "grow" }, h("strong", {}, "Connected. "),
        canWrite() ? ["Changes save online automatically and appear for everyone with this report's link. Back up with ", h("strong", {}, "Export Excel"), "."]
          : "You can see the records but not change them. Ask the owner if you need to enter data."));
      return;
    }
    $("#sheet-notice").replaceChildren(icon("info"),
      h("div", { class: "grow" },
        h("strong", {}, "Saved automatically on this device. "),
        "Back up with ", h("strong", {}, "Export Excel"), ". To show the same data on another device, use ", h("strong", {}, "Download data.js"),
        " and upload it to the purchasing-report repository on GitHub (Add file → Upload files)."));
  }

  function renderSheet() {
    renderSheetNotice();
    const host = $("#sheet-body");
    if (sheetUI.active === "settings") { renderSettings(host); return; }
    const def = SHEETS.find((d) => d.id === sheetUI.active);
    const rows = D[def.id];
    const ro = !canWrite();
    const search = h("input", { class: "input", type: "search", placeholder: `Search ${def.label.toLowerCase()}`, "aria-label": `Search ${def.label}`, value: sheetUI.q });
    const count = h("span", { class: "count" });
    const add = h("button", { class: "btn btn-sm btn-primary", type: "button" }, icon("plus"), "Add row");
    const gridWrap = h("div", { class: "sheet-scroll" });
    const datalists = h("div", { hidden: true });
    for (const c of def.cols.filter((x) => x.suggest || x.pool)) {
      datalists.append(h("datalist", { id: `dl-${def.id}-${c.key}` }, poolValues(c, rows).map((v) => h("option", { value: v }))));
    }
    const drawGrid = () => {
      const q = sheetUI.q.toLowerCase();
      const visible = rows.map((r, i) => [r, i]).filter(([r]) => !q || def.cols.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q)));
      count.textContent = q ? `${num(visible.length)} of ${num(rows.length)} rows` : `${num(rows.length)} ${rows.length === 1 ? "row" : "rows"}`;
      if (!rows.length) {
        gridWrap.replaceChildren(h("div", { class: "sheet-empty" }, h("strong", {}, `No ${def.label.toLowerCase()} yet. `), "Tap Add row, or import an Excel/CSV file."));
        return;
      }
      const thead = h("thead", {}, h("tr", {},
        h("th", { class: "rn", scope: "col" }, "#"),
        def.cols.map((c) => h("th", { class: c.type === "number" ? "num" : null, scope: "col", style: `min-width:${c.w}px` }, c.label)),
        h("th", { scope: "col" }, h("span", { class: "sr-only" }, "Delete"))));
      gridWrap.replaceChildren(h("table", { class: "sheet-grid" }, thead, h("tbody", {}, visible.map(([r, i]) => sheetRow(def, r, i, ro)))));
    };
    search.addEventListener("input", () => { sheetUI.q = search.value.trim(); drawGrid(); });
    add.addEventListener("click", () => {
      rows.push(blankRow(def));
      saveData();
      sheetUI.q = ""; search.value = "";
      drawGrid(); renderSheetTabs();
      gridWrap.scrollTop = gridWrap.scrollHeight;
      const last = $$("tbody tr", gridWrap).pop();
      const target = last && ($$(".cell", last).find((c) => c.dataset.key !== "id" && c.type !== "date" && c.type !== "time") || $$(".cell", last)[1]);
      if (target) target.focus();
    });
    host.replaceChildren(
      h("div", { class: "sheet-head" }, h("h3", {}, def.label), ro ? badge("Read-only") : null, count, h("span", { class: "dt-spacer" }),
        h("div", { class: "dt-search" }, icon("search"), search), ro ? null : add),
      gridWrap,
      h("div", { class: "sheet-foot" }, "Tip: press Enter to move down a column. Numbers without commas; dates as day / month / year."),
      datalists);
    drawGrid();
  }

  function sheetRow(def, r, index, ro = false) {
    const tr = h("tr", {});
    tr.append(h("td", { class: "rn" }, String(index + 1)));
    def.cols.forEach((c, ci) => {
      let input;
      const label = `${c.label}, row ${index + 1}`;
      if (c.type === "select") {
        const opts = [...optsOf(c)];
        if (r[c.key] && !opts.includes(r[c.key])) opts.push(r[c.key]);
        input = h("select", { class: "cell", "aria-label": label }, opts.map((o) => h("option", { value: o }, o)));
        input.value = r[c.key] || opts[0];
      } else if (c.type === "date" || c.type === "time") {
        input = h("input", { class: "cell", type: c.type, "aria-label": label, value: r[c.key] || "" });
      } else if (c.type === "number") {
        input = h("input", { class: "cell num", type: "text", inputmode: "decimal", "aria-label": label, value: r[c.key] === "" || r[c.key] == null ? "" : String(r[c.key]) });
      } else {
        input = h("input", { class: "cell", type: "text", "aria-label": label, value: r[c.key] ?? "", list: c.suggest || c.pool ? `dl-${def.id}-${c.key}` : null });
      }
      input.dataset.col = String(ci);
      input.dataset.key = c.key;
      if (ro) input.disabled = true;
      input.addEventListener("change", () => {
        const v = coerce(c, input.value);
        r[c.key] = v;
        if (c.type === "number") input.value = v === "" ? "" : String(v);
        input.classList.toggle("bad", c.type === "date" && v !== "" && !isISO(v));
        if (def.onChange) for (const k of def.onChange(r, c.key)) { const other = $(`.cell[data-key="${k}"]`, tr); if (other) other.value = r[k] ?? ""; }
        saveData();
      });
      input.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || e.isComposing) return;
        e.preventDefault();
        input.dispatchEvent(new Event("change"));
        const next = e.shiftKey ? tr.previousElementSibling : tr.nextElementSibling;
        const target = next && $(`.cell[data-col="${ci}"]`, next);
        if (target) target.focus();
      });
      tr.append(h("td", {}, input));
    });
    const del = h("button", { class: "del-btn", type: "button", "aria-label": `Delete row ${index + 1}`, title: "Delete row" }, icon("trash"));
    del.addEventListener("click", () => {
      const arr = D[def.id];
      const at = arr.indexOf(r);
      if (at < 0) return;
      arr.splice(at, 1);
      saveData();
      renderSheet(); renderSheetTabs();
      toast(`Row deleted from ${def.label}.`, { label: "Undo", run: () => { arr.splice(at, 0, r); saveData(); renderSheet(); renderSheetTabs(); } });
    });
    tr.append(h("td", {}, ro ? null : del));
    return tr;
  }

  function renderSettings(host) {
    const form = h("div", { class: "settings-form" });
    for (const sd of SETTINGS) {
      const id = `set-${sd.key}`;
      const input = h("input", { class: "input", id, type: "text", inputmode: sd.number ? "decimal" : null, value: D.company[sd.key] ?? "" });
      if (!canWrite()) input.disabled = true;
      input.addEventListener("change", () => {
        const val = input.value.trim();
        D.company[sd.key] = sd.number ? n0(parseNumber(val)) : sd.key === "currency" ? val.toUpperCase() : val;
        saveData();
      });
      form.append(h("label", { class: "field", for: id }, h("span", {}, sd.label), input, sd.hint ? h("small", {}, sd.hint) : null));
    }
    host.replaceChildren(h("div", { class: "sheet-head" }, h("h3", {}, "Settings")), form);
  }

  /* ---------- Excel / CSV import & export ---------- */
  let xlsxPromise = null;
  function loadScript(src, err) {
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error(err));
      document.head.append(el);
    });
  }
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxPromise) {
      xlsxPromise = loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "Could not load the Excel tool. Check the internet connection and try again.")
        .then(() => window.XLSX).catch((e) => { xlsxPromise = null; throw e; });
    }
    return xlsxPromise;
  }
  const slug = (t) => String(t || "report").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  async function exportExcel() {
    try {
      const X = await loadXLSX();
      const wb = X.utils.book_new();
      for (const def of SHEETS) {
        const ws = X.utils.aoa_to_sheet([def.cols.map((c) => c.label), ...D[def.id].map((r) => def.cols.map((c) => r[c.key] ?? ""))]);
        ws["!cols"] = def.cols.map((c) => ({ wch: Math.max(10, Math.round(c.w / 7)) }));
        X.utils.book_append_sheet(wb, ws, def.label.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
      }
      const set = X.utils.aoa_to_sheet([["Setting", "Value"], ...SETTINGS.map((sd) => [sd.label, D.company[sd.key] ?? ""])]);
      set["!cols"] = [{ wch: 30 }, { wch: 50 }];
      X.utils.book_append_sheet(wb, set, "Settings");
      X.writeFile(wb, `${slug(D.company.name)}-purchasing-data-${todayISO()}.xlsx`);
    } catch (e) { toast(e.message); }
  }

  function parseRows(X, ws, def) {
    const json = X.utils.sheet_to_json(ws, { defval: "", raw: true });
    const out = [];
    for (const obj of json) {
      const r = {};
      for (const [head, v] of Object.entries(obj)) {
        const k = normKey(head);
        const c = def.cols.find((cc) => normKey(cc.key) === k || normKey(cc.label) === k);
        if (c) r[c.key] = coerce(c, v, X);
      }
      if (!Object.values(r).some((v) => v !== "" && v !== 0)) continue;
      for (const c of def.cols) if (!(c.key in r)) r[c.key] = c.type === "select" ? optsOf(c)[0] : "";
      out.push(r);
    }
    return out;
  }

  async function importFile(file) {
    try {
      const X = await loadXLSX();
      // raw for CSV: keep text as typed so dates are read day-first (not US month-first)
      const wb = X.read(new Uint8Array(await file.arrayBuffer()), { type: "array", raw: /\.csv$/i.test(file.name) });
      const plan = [];
      let settings = null;
      for (const name of wb.SheetNames) {
        const n = normKey(name);
        if (n === "settings") {
          settings = {};
          for (const [label, value] of X.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true })) {
            const sd = SETTINGS.find((x) => normKey(x.label) === normKey(label) || normKey(x.key) === normKey(label));
            if (sd) settings[sd.key] = sd.number ? n0(parseNumber(value)) : String(value).trim();
          }
          continue;
        }
        const def = SHEETS.find((d) => normKey(d.id) === n || normKey(d.label) === n || (d.aliases || []).includes(n));
        if (def) plan.push({ def, rows: parseRows(X, wb.Sheets[name], def) });
      }
      if (!plan.length && !settings) {
        const def = SHEETS.find((d) => d.id === sheetUI.active);
        if (!def) { toast("Open the sheet you want to import into (for example Materials), then import again."); return; }
        plan.push({ def, rows: parseRows(X, wb.Sheets[wb.SheetNames[0]], def) });
      }
      const lines = plan.map((p) => `• ${p.def.label}: ${p.rows.length} rows`);
      if (settings) lines.push("• Settings");
      if (!confirm(`Import from "${file.name}"?\n\n${lines.join("\n")}\n\nThis replaces the current rows in these sheets.`)) return;
      for (const p of plan) {
        D[p.def.id] = p.rows;
        for (const r of p.rows) if (!r.id) r.id = nextId(p.def);
      }
      if (settings) Object.assign(D.company, settings, settings.currency ? { currency: String(settings.currency).toUpperCase() } : {});
      D.sample = false;
      saveData();
      if (plan.length === 1) sheetUI.active = plan[0].def.id;
      renderSheetTabs(); renderSheet();
      toast(`Imported ${plan.reduce((a, p) => a + p.rows.length, 0)} rows.`);
    } catch (e) {
      toast(e.message || "Could not read that file.");
    }
  }

  function dataJsText() {
    const rows = (arr) => arr.map((r) => "    " + JSON.stringify(r)).join(",\n");
    const company = JSON.stringify(D.company, null, 2).replace(/\n/g, "\n  ");
    return `/*
 * DAILY PURCHASING & MATERIALS REPORT — DATA FILE
 * Exported from the Data sheet on ${todayISO()}.
 * Upload this file to the purchasing-report repository (replacing data.js) to publish it.
 */
window.REPORT_DATA = {
  sample: ${D.sample ? "true" : "false"},
  company: ${company},
${DATASETS.map((k) => `\n  ${k}: [\n${rows(D[k])}${D[k].length ? "," : ""}\n  ],`).join("\n")}
};
`;
  }

  /* ---------- example data (made up, dated around today) ---------- */
  function exampleData() {
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const round = (n, st) => Math.round(n / st) * st;
    const T = todayISO();
    const bank = D.company.bank || "ZamZam Bank";
    const d = { sample: true, company: { ...D.company }, requests: [], cheques: [], materials: [], suppliers: [], ledger: [], jobs: [], issues: [], cashNeeds: [], summaries: [], sent: [] };
    const suppliers = [
      ["Nile Board Trading", "30 days", 1000000, 16], ["Unity Hardware", "14 days", 500000, -3], ["Abay Paints", "COD", 0, 0],
      ["Sheger Timber", "45 days", 820000, 20], ["Tana Fittings", "7 days", 120000, 2], ["Entoto Glass", "30 days", 260000, 9],
    ];
    suppliers.forEach(([name, terms, bal, dueIn], i) => d.suppliers.push({ id: `SP-${pad2(i + 1)}0`, name, terms, openingBalance: bal, openingDue: bal ? addDays(T, dueIn) : "", phone: `09${11000000 + i * 1234567}`, note: "" }));
    const materials = ["MDF 18mm (sheets)", "Chipboard 16mm", "Edge banding 2mm", "Soft-close hinges", "Drawer runners 450mm", "Aluminium handles", "Quartz countertop", "PU lacquer (20 L)", "Glass panels", "Contact glue"];
    const jobCodes = ["KK146", "KK150", "KK158", "KK163", "KK165", "KK167", "KK171", "KK176", "KK182", "KK188", "KK191", "KK195", "KK201", "KK68"];
    const customers = ["Dawit A.", "Hanna T.", "Green Valley Homes", "Yared M.", "Blue Sky Apartments", "Mahlet K.", "Summit Towers", "Abel S.", "Riverside Villas", "Rahel W.", "Tsion D.", "Kidus B.", "Selam Hotel", "Meklit Y."];
    jobCodes.forEach((jc, i) => {
      const contract = jc === "KK201" ? 82769 : round(120000 + rnd() * 780000, 1000);
      const missing = ["KK167", "KK171", "KK191", "KK68"].includes(jc);
      const over = jc === "KK201" || jc === "KK182";
      d.jobs.push({ id: `JB-${pad2(i + 1)}0`, jobCode: jc, customer: customers[i], contractValue: contract,
        purchaseCost: jc === "KK201" ? 166312 : jc === "KK182" ? round(contract * 1.12, 10) : missing ? "" : round(contract * (0.55 + rnd() * 0.3), 10),
        bomComplete: missing ? "No" : "Yes", missingInfo: missing ? "Purchase cost" : "", missingReason: missing ? pick(["Waiting for supplier quotation", "Design not final", "Customer changed layout"]) : "",
        expectedDate: missing ? addDays(T, jc === "KK68" ? -2 : 1 + Math.floor(rnd() * 5)) : "",
        overrunReason: jc === "KK182" ? "Quartz price increase" : "", overrunAction: jc === "KK182" ? "Recovered from margin" : jc === "KK201" ? "Pending chairman approval" : "" });
    });
    // purchase requests over the last two weeks (jobs with a complete BOM only)
    const activeJobs = jobCodes.filter((jc) => !["KK167", "KK171", "KK191", "KK68"].includes(jc));
    let pr = 0;
    for (let day = addDays(T, -13); day <= T; day = addDays(day, 1)) {
      if (parseD(day).getDay() === 0) continue;
      const count = day === T ? 4 : 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < count; i++) {
        const amount = round(15000 + rnd() * 260000, 50);
        const old = day < addDays(T, -2);
        const approval = old ? "Approved" : pick(["Approved", "Approved", "Pending"]);
        const funds = approval === "Approved" && (old || rnd() < 0.6) ? "Yes" : "No";
        let cheque = funds === "Yes" && (old || rnd() < 0.7) ? "Yes" : "No";
        if (day === T && i === 3) cheque = "Yes"; // one rule break today, to show the check
        d.requests.push({ id: `PR-${String(++pr).padStart(3, "0")}`, date: day, jobCode: pick(activeJobs), supplier: pick(suppliers)[0], item: pick(materials), amount,
          approval: day === T && i === 3 ? "Approved" : approval, fundsConfirmed: day === T && i === 3 ? "No" : funds, chequeIssued: cheque, status: cheque === "Yes" ? "Ordered" : "Waiting for cash", note: "" });
      }
    }
    // cheques delivered: from issued requests
    let cq = 0;
    for (const r of d.requests.filter((x) => x.chequeIssued === "Yes")) {
      const day = r.date;
      d.cheques.push({ id: `CQ-${String(++cq).padStart(3, "0")}`, date: day, jobCode: r.jobCode, supplier: r.supplier, amount: r.amount, time: `${pad2(9 + Math.floor(rnd() * 7))}:${pick(["00", "15", "30", "45"])}`,
        supplierConfirmed: day === T && rnd() < 0.4 ? "No" : "Yes", deliveryDate: addDays(day, 2 + Math.floor(rnd() * 5)), docsToFinance: day === T ? "No" : cq === 3 ? "No" : "Yes", note: "" });
    }
    // materials from ordered requests
    let mt = 0;
    for (const r of d.requests.filter((x) => x.status === "Ordered")) {
      const expected = addDays(r.date, 2 + Math.floor(rnd() * 6));
      let actual = "";
      if (expected <= T) actual = rnd() < 0.8 ? addDays(expected, Math.floor(rnd() * 2)) : "";
      if (actual > T) actual = "";
      d.materials.push({ id: `MT-${String(++mt).padStart(3, "0")}`, jobCode: r.jobCode, material: r.item, supplier: r.supplier, orderedDate: r.date, expectedDate: expected, actualDate: actual,
        status: actual ? "In store" : expected < T ? "Delayed" : "In transit", defect: actual && rnd() < 0.08 ? "Yes" : "No", confirmed: actual ? (rnd() < 0.9 ? "Yes" : "No") : "No", note: "" });
    }
    // make sure something arrived today
    d.materials.filter((m) => m.expectedDate === T || m.expectedDate === addDays(T, -1)).slice(0, 2).forEach((m) => { m.actualDate = T; m.status = "In store"; m.confirmed = "Yes"; });
    // supplier ledger: credit on ordered requests, some payments
    let lg = 0, chqNo = 104500;
    const sampleCheque = () => (rnd() < 0.6 ? { chequeGiven: "Yes", chequeNo: String(++chqNo) } : { chequeGiven: "No", chequeNo: "" });
    for (const r of d.requests.filter((x) => x.status === "Ordered" && x.date >= addDays(T, -6))) {
      const sup = d.suppliers.find((x) => x.name === r.supplier);
      if (/cod/i.test(sup.terms)) continue;
      d.ledger.push({ id: `LG-${String(++lg).padStart(3, "0")}`, date: r.date, supplier: r.supplier, type: "Credit taken", amount: round(r.amount * 0.6, 50), dueDate: addDays(r.date, termDays(sup.terms)), ...sampleCheque(), jobCode: r.jobCode, paidVia: "", note: "" });
    }
    for (const sup of d.suppliers.filter((x) => x.openingBalance > 0)) {
      if (sup.name === "Unity Hardware") { d.ledger.push({ id: `LG-${String(++lg).padStart(3, "0")}`, date: T, supplier: sup.name, type: "Payment made", amount: 200000, dueDate: "", jobCode: "", paidVia: bank, note: "" }); continue; }
      if (rnd() < 0.6) d.ledger.push({ id: `LG-${String(++lg).padStart(3, "0")}`, date: addDays(T, -Math.floor(rnd() * 8)), supplier: sup.name, type: "Payment made", amount: round(sup.openingBalance * 0.3, 1000), dueDate: "", jobCode: "", paidVia: bank, note: "" });
    }
    d.ledger.push({ id: `LG-${String(++lg).padStart(3, "0")}`, date: T, supplier: "Abay Paints", type: "Credit taken", amount: 166312, dueDate: T, jobCode: "KK201", paidVia: "", note: "COD" });
    // issues
    [["Edge banding colour wrong", "Tana Fittings", "Returned, supplier sending correct colour", "Replacement pending", "Yes"],
      ["2 glass panels cracked on delivery", "Entoto Glass", "Photos sent, refund requested", "Refund pending", "Yes"],
      ["Hinges short by 40 pcs", "Unity Hardware", "Supplier delivered the rest", "Resolved", "No"],
      ["MDF sheets swollen (water damage)", "Nile Board Trading", "Rejected by storekeeper, replacement ordered", "Open", "No"]].forEach(([issue, supplier, action, status, withheld], i) => {
      d.issues.push({ id: `IS-${String(i + 1).padStart(3, "0")}`, date: addDays(T, i === 3 ? 0 : -(2 + i * 3)), jobCode: pick(jobCodes.slice(0, 12)), supplier, issue, action, status, withheld });
    });
    // cash needs: tomorrow and the week
    const T1 = addDays(T, 1);
    [[1, "KK165", "Nile Board Trading", 450000, "Production stops on KK165"], [2, "KK201", "Abay Paints", 166312, "COD supplier will not release lacquer"],
      [3, "KK188", "Tana Fittings", 85000, "Installation delayed for KK188"]].forEach(([p, jc, sup, amt, cons], i) => {
      d.cashNeeds.push({ id: `CN-${String(i + 1).padStart(3, "0")}`, dateNeeded: T1, priority: p, jobCode: jc, supplier: sup, amount: amt, consequence: cons, status: "Needed" });
    });
    [[3, "KK195", "Sheger Timber", 220000], [5, "KK176", "Entoto Glass", 64000]].forEach(([dd, jc, sup, amt], i) => {
      d.cashNeeds.push({ id: `CN-${String(i + 4).padStart(3, "0")}`, dateNeeded: addDays(T, dd), priority: 1, jobCode: jc, supplier: sup, amount: amt, consequence: "Order cannot be placed", status: "Needed" });
    });
    // today's summary
    d.summaries.push({ id: "DS-001", date: T, risk: "KK201 cost overrun (+83,543) needs chairman approval.", win: "All materials for KK146 received today.",
      need: "450,000 ETB in ZamZam Bank by 10:00 AM tomorrow to pay the supplier for KK165.", note: "Missing purchase costs for KK167 and KK171 are blocking the production schedule." });
    return d;
  }

  /* ==========================================================================
     PDF export — jsPDF + AutoTable, loaded only when a PDF is requested.
     ========================================================================== */
  const PDF_LIBS = [
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
  ];
  const ETH_RE = /[ሀ-᎟ⶀ-⷟꬀-꬯]/;
  const PC = {
    ink: [11, 11, 11], ink2: [82, 81, 78], muted: [137, 135, 129], grid: [225, 224, 217], rule: [195, 194, 183],
    band: [244, 243, 239], in: [42, 120, 214], out: [235, 104, 52], good: [0, 99, 0], goodDot: [12, 163, 12], bad: [179, 38, 30], badDot: [208, 59, 59], warnDot: [250, 178, 25],
  };
  let pdfLibPromise = null, ethFontB64 = null;
  function loadPdfLib() {
    if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable) return Promise.resolve(window.jspdf.jsPDF);
    if (!pdfLibPromise) {
      const err = "Could not load the PDF tool. Check the internet connection and try again.";
      pdfLibPromise = PDF_LIBS.reduce((p, src) => p.then(() => loadScript(src, err)), Promise.resolve())
        .then(() => window.jspdf.jsPDF).catch((e) => { pdfLibPromise = null; throw e; });
    }
    return pdfLibPromise;
  }
  function toBase64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const pdfClean = (v) => String(v ?? "").replace(/[  ]/g, " ").replace(/−/g, "-").replace(/→/g, "->").replace(/÷/g, "/").replace(/×/g, "x").replace(/[–—]/g, "-");

  async function newPdf() {
    const jsPDF = await loadPdfLib();
    const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
    let eth = false;
    if (ETH_RE.test(JSON.stringify(D))) {
      if (!ethFontB64) {
        const res = await fetch("fonts/AbyssinicaSIL-Regular.ttf");
        if (!res.ok) throw new Error("Could not load the Amharic font for the PDF.");
        ethFontB64 = toBase64(await res.arrayBuffer());
      }
      doc.addFileToVFS("AbyssinicaSIL-Regular.ttf", ethFontB64);
      doc.addFont("AbyssinicaSIL-Regular.ttf", "Abyssinica", "normal");
      eth = true;
    }
    return pdfKit(doc, eth);
  }

  function pdfKit(doc, eth) {
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 36;
    const k = { doc, W, H, M, y: M };
    k.font = (style, sample) => { if (eth && ETH_RE.test(sample)) doc.setFont("Abyssinica", "normal"); else doc.setFont("helvetica", style || "normal"); };
    k.text = (str, x, y, { size = 9, style = "normal", color = PC.ink, align = "left", maxWidth } = {}) => {
      const t = pdfClean(str);
      k.font(style, t); doc.setFontSize(size); doc.setTextColor(...color);
      doc.text(t, x, y, { align, maxWidth });
    };
    k.ensure = (need) => { if (H - 48 - k.y < need) { doc.addPage(); k.y = M; } };
    k.heading = (numStr, title, rule, need = 120) => {
      k.ensure(need);
      if (k.y > M) k.y += 6;
      doc.setDrawColor(...PC.grid); doc.setFillColor(...PC.band); doc.setLineWidth(0.5);
      doc.roundedRect(M, k.y - 10, 20, 14, 3, 3, "FD");
      k.text(numStr, M + 10, k.y, { size: 7.5, style: "bold", color: PC.ink2, align: "center" });
      k.text(title, M + 27, k.y + 1, { size: 12.5, style: "bold" });
      k.y += 12;
      if (rule) {
        const lines = doc.splitTextToSize(pdfClean(`Rule: ${rule}`), W - 2 * M - 27);
        k.font("italic", rule); doc.setFontSize(7.5); doc.setTextColor(...PC.ink2);
        doc.text(lines, M + 27, k.y);
        k.y += lines.length * 9 + 4;
      }
    };
    k.line = (str, opts = {}) => { k.ensure(16); k.text(str, M, k.y, { size: 8.5, color: PC.ink2, ...opts }); k.y += 13; };
    k.none = (text) => { k.text(text || "Nothing recorded.", M, k.y + 4, { size: 8.5, color: PC.muted }); k.y += 18; };
    k.table = (opts) => {
      const { head, body, align = [], foot, widths = [], fontSize = 7.5, empty } = opts;
      if (!body.length) { k.none(empty); return k.y; }
      const columnStyles = {};
      head.forEach((_, i) => { columnStyles[i] = { halign: align[i] === "r" ? "right" : "left" }; if (widths[i]) columnStyles[i].cellWidth = widths[i]; });
      doc.autoTable({
        head: [head.map(pdfClean)], body: body.map((r) => r.map(pdfClean)), foot: foot ? [foot.map(pdfClean)] : undefined,
        startY: k.y, margin: { left: M, right: M, top: M, bottom: 48 }, theme: "plain",
        styles: { font: "helvetica", fontSize, textColor: PC.ink, cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 }, lineColor: PC.grid, lineWidth: { bottom: 0.5 }, overflow: "linebreak", valign: "middle" },
        headStyles: { fillColor: PC.band, textColor: PC.ink2, fontStyle: "bold", fontSize: fontSize - 0.5 },
        footStyles: { fillColor: PC.band, textColor: PC.ink, fontStyle: "bold", lineWidth: { top: 0.75, bottom: 0 }, lineColor: PC.rule },
        columnStyles, showHead: "everyPage", showFoot: "lastPage", rowPageBreak: "avoid",
        didParseCell: (data) => {
          if (align[data.column.index] === "r") data.cell.styles.halign = "right";
          if (opts.color && data.section === "body") { const c = opts.color(data.row.index, data.column.index); if (c) { data.cell.styles.textColor = c; data.cell.styles.fontStyle = "bold"; } }
          if (eth && ETH_RE.test(data.cell.text.join(" "))) { data.cell.styles.font = "Abyssinica"; data.cell.styles.fontStyle = "normal"; }
        },
      });
      k.y = doc.lastAutoTable.finalY + 14;
      return k.y;
    };
    k.kpis = (items, cols = 4) => {
      const gap = 7, w = (W - 2 * M - gap * (cols - 1)) / cols, hgt = 46;
      k.ensure(Math.ceil(items.length / cols) * (hgt + gap) + 8);
      items.forEach((it, i) => {
        const x = M + (i % cols) * (w + gap), y = k.y + Math.floor(i / cols) * (hgt + gap);
        doc.setFillColor(...PC.band); doc.setDrawColor(...PC.grid); doc.setLineWidth(0.5);
        doc.roundedRect(x, y, w, hgt, 6, 6, "FD");
        k.text(it.label, x + 9, y + 13, { size: 7, color: PC.ink2 });
        k.text(it.value, x + 9, y + 29, { size: 12, style: "bold", maxWidth: w - 14 });
        if (it.note) k.text(it.note, x + 9, y + 40, { size: 6.5, color: it.color || PC.muted, maxWidth: w - 14 });
      });
      k.y += Math.ceil(items.length / cols) * (hgt + gap) + 8;
    };
    k.header = (title, right1, right2) => {
      const x = M, y = k.y;
      doc.setFillColor(...PC.ink); doc.roundedRect(x, y, 30, 30, 7, 7, "F");
      doc.setDrawColor(255, 255, 255); doc.setLineWidth(1.6);
      doc.lines([[3, 0], [2.4, 10.5], [10.2, 0], [2.4, -6.5], [-13.8, 0]], x + 6, y + 8, [1, 1], "S");
      doc.setFillColor(...PC.in); doc.circle(x + 13, y + 23, 1.6, "F"); doc.circle(x + 20, y + 23, 1.6, "F");
      k.text(C.name || "Company", x + 40, y + 11, { size: 9.5, style: "bold", color: PC.ink2 });
      k.text(title, x + 40, y + 28, { size: 16, style: "bold" });
      k.text(right1, W - M, y + 11, { size: 9.5, style: "bold", align: "right" });
      k.text(right2, W - M, y + 23, { size: 7.5, color: PC.muted, align: "right" });
      k.y = y + 40;
      doc.setDrawColor(...PC.in); doc.setLineWidth(1.5); doc.line(M, k.y, W - M, k.y);
      k.y += 20;
    };
    k.footers = (left) => {
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setDrawColor(...PC.grid); doc.setLineWidth(0.5); doc.line(M, H - 32, W - M, H - 32);
        k.text(left, M, H - 20, { size: 7, color: PC.muted });
        k.text(`Page ${i} of ${pages}`, W - M, H - 20, { size: 7, color: PC.muted, align: "right" });
      }
    };
    k.box = (title, text) => {
      const lines = doc.splitTextToSize(pdfClean(text), W - 2 * M - 20);
      const hgt = lines.length * 10.5 + 26;
      k.ensure(hgt + 6);
      doc.setFillColor(...PC.band); doc.setDrawColor(...PC.grid); doc.setLineWidth(0.5);
      doc.roundedRect(M, k.y, W - 2 * M, hgt, 6, 6, "FD");
      k.text(title, M + 10, k.y + 14, { size: 8, style: "bold", color: PC.ink2 });
      k.font("normal", text); doc.setFontSize(8.5); doc.setTextColor(...PC.ink);
      doc.text(lines, M + 10, k.y + 27);
      k.y += hgt + 10;
    };
    return k;
  }

  async function exportReportPdf() {
    const k = await newPdf();
    const { doc, M, W } = k;
    const v = V;
    const rules = {};
    $$("[data-rule]").forEach((el) => { rules[el.dataset.rule] = el.textContent.replace(/^Rule:\s*/, ""); });
    const red = (pred) => (ri, ci) => (pred(ri, ci) ? PC.bad : null);
    k.header("Daily Purchasing & Materials Report", flong(v.T), `Deadline ${C.deadline || "17:30"}`);
    k.y -= 8;
    k.line(`Prepared by: ${C.preparedBy || "-"}     Submitted to: ${C.submittedTo || "-"}`);
    k.y += 4;
    const okCount = v.checks.filter((c) => c.state === "ok").length;
    k.kpis([
      { label: "Requested today", value: moneyC(sum(v.reqToday)), note: `${num(v.reqToday.length)} requests · ${num(v.reqWaiting.length)} waiting for cash` },
      { label: "Cheques delivered today", value: moneyC(sum(v.chqToday)), note: `${num(v.chqToday.length)} cheques` },
      { label: "Owed to suppliers", value: moneyC(v.owed), note: v.overdue > 0 ? `${moneyC(v.overdue)} overdue` : `${moneyC(v.due7)} due in 7 days`, color: v.overdue > 0 ? PC.bad : null },
      { label: "Cash needed tomorrow", value: moneyC(v.cashTotal), note: `Next 7 days ${moneyC(v.fcTotal)}` },
      { label: "Materials arrived / late", value: `${num(v.matToday.length)} / ${num(v.matLate.length)}`, note: `${num(v.matDefects.length)} defective (30 days)`, color: v.matLate.length ? PC.bad : null },
      { label: "Cost overruns", value: num(v.overruns.length), note: v.unexplained.length ? `${num(v.unexplained.length)} without explanation` : "All explained", color: v.unexplained.length ? PC.bad : null },
      { label: "Missing BOMs", value: num(v.missing.length), note: `${num(v.missingLate.length)} past expected date`, color: v.missingLate.length ? PC.bad : null },
      { label: "Compliance", value: `${okCount} / ${v.checks.length}`, note: okCount === v.checks.length ? "All checks OK" : "See section 10", color: okCount === v.checks.length ? PC.good : PC.bad },
    ]);

    // 1
    k.heading("1", "Purchase requests & bank status", rules.requests);
    const req = [...v.reqToday, ...v.reqWaiting.filter((r) => r.date !== v.T)];
    k.table({ head: ["Date", "Job", "Supplier", "Item", "Amount", "Approval", "Funds OK?", "Cheque?", "Status"], align: ["l", "l", "l", "l", "r", "l", "l", "l", "l"],
      body: req.map((r) => [fday(r.date), r.jobCode, r.supplier, r.item, money(r.amount), `${r.approval || "Pending"} (${r.approver})`, r.fundsConfirmed || "No", r.chequeIssued || "No", r.broken ? "RULE BROKEN" : r.status]),
      foot: req.length ? ["Total", "", "", "", money(sum(req)), "", "", "", ""] : null, color: red((ri, ci) => ci === 8 && req[ri].broken), empty: "No purchase requests today or waiting for cash." });
    // 2
    k.heading("2", "Cheques delivered today", rules.cheques);
    k.table({ head: ["Job", "Supplier", "Cheque amount", "Time", "Supplier confirmed?", "Materials delivery", "Docs to finance?"], align: ["l", "l", "r", "l", "l", "l", "l"],
      body: v.chqToday.map((c) => [c.jobCode, c.supplier, money(c.amount), c.time, c.supplierConfirmed || "No", fdate(c.deliveryDate), c.docsToFinance || "No"]),
      foot: v.chqToday.length ? ["Total", "", money(sum(v.chqToday)), "", "", "", ""] : null, color: red((ri, ci) => ci === 4 && v.chqToday[ri].supplierConfirmed !== "Yes"), empty: "No cheques delivered today." });
    if (v.docsLate.length) k.line(`Documents more than 24 hours late: ${listText(v.docsLate.map((c) => `${c.jobCode} ${c.supplier}`), 6)}`, { color: PC.bad });
    // 3
    k.heading("3", "Materials received / in transit", rules.materials);
    const mat = v.mat.filter((m) => m.actualDate === v.T || m.disp !== "In store");
    k.table({ head: ["Job", "Material", "Supplier", "Ordered", "Expected", "Arrived", "Status", "Defect?"], align: ["l", "l", "l", "l", "l", "l", "l", "l"],
      body: mat.map((m) => [m.jobCode, m.material, m.supplier, fdate(m.orderedDate), fdate(m.expectedDate), fdate(m.actualDate), m.disp, m.defect || "No"]),
      color: red((ri, ci) => (ci === 6 && (mat[ri].disp === "Late" || mat[ri].disp === "Delayed")) || (ci === 7 && mat[ri].defect === "Yes")), empty: "No materials arrived today and none in transit." });
    k.line(`Total items: ${num(mat.length)} · arrived today ${num(v.matToday.length)} · late ${num(v.matLate.length)}`);
    // 4
    k.heading("4", "Supplier credit & outstanding balances", rules.credit);
    const sup = [...v.sup].sort((a, b) => b.closing - a.closing);
    k.table({ head: ["Supplier", "Terms", "Opening", "New credit today", "Paid today", "Closing", "Next due", "Cheque given?", "Status"], align: ["l", "l", "r", "r", "r", "r", "l", "l", "l"],
      body: sup.map((x) => [x.name, x.terms, money(x.opening), money(x.newCredit), money(x.paidToday), money(x.closing), x.cod && x.closing > 0 ? "Immediate" : x.nextDue ? fdate(x.nextDue) : "-",
        chequeText(x).replace("—", "-") + (x.chequeNos.length ? `
No. ${x.chequeNos.join(", ")}` : ""), x.status]),
      foot: sup.length ? ["Total", "", money(sum(sup, (x) => x.opening)), money(v.newCredit), money(v.paidToday), money(sum(sup, (x) => x.closing)), "", v.chequeHeld > 0.005 ? money(v.chequeHeld) : "", ""] : null,
      color: red((ri, ci) => ci === 8 && ["Overdue", "Cash needed", "Unknown supplier"].includes(sup[ri].status)), empty: "No suppliers recorded." });
    k.line(`Total owed to suppliers: ${money(v.owed)}   ·   Cheque given for: ${money(v.chequeHeld)}   ·   Overdue: ${money(v.overdue)}   ·   Due within 7 days: ${money(v.due7)}`, { style: "bold", color: PC.ink });
    // 5
    k.heading("5", "Cost variance & overrun alerts", rules.variance);
    k.table({ head: ["Job", "Contract value", "Purchase cost", "Variance", "Reason for overrun", "Action taken"], align: ["l", "r", "r", "r", "l", "l"],
      body: v.overruns.map((j) => [j.jobCode, money(j.contractValue), money(j.cost), `+${money(j.variance)}`, j.overrunReason || "NO EXPLANATION", j.overrunAction || "-"]),
      foot: v.overruns.length ? ["Total variance", "", "", `+${money(sum(v.overruns, (j) => j.variance))}`, "", ""] : null,
      color: red((ri, ci) => ci === 4 && !String(v.overruns[ri].overrunReason || "").trim()), empty: "No job is over its contract value." });
    // 6
    k.heading("6", "Missing data / outstanding BOMs", rules.bom);
    k.table({ head: ["Job", "Missing information", "Reason for delay", "Expected completion"], align: ["l", "l", "l", "l"],
      body: v.missing.map((j) => [j.jobCode, j.missingInfo || "NOT STATED", j.missingReason || "-", isISO(j.expectedDate) ? `${fdate(j.expectedDate)}${j.late ? " (LATE)" : ""}` : "NO DATE"]),
      color: red((ri, ci) => ci === 3 && (v.missing[ri].late || !isISO(v.missing[ri].expectedDate))), empty: "Every job has a complete BOM." });
    // 7
    k.heading("7", "Defective materials & supplier issues", rules.issues);
    k.table({ head: ["Date", "Job", "Supplier", "Issue", "Action taken", "Replacement / refund", "Payment withheld?"], align: ["l", "l", "l", "l", "l", "l", "l"],
      body: v.issOpen.map((i) => [fdate(i.date), i.jobCode, i.supplier, i.issue, i.action, i.status || "Open", i.withheld || "No"]), empty: "No open supplier issues." });
    k.line(`Total open issues: ${num(v.issOpen.length)}`);
    // 8
    k.heading("8", `Cash requirements for tomorrow (${fday(v.T1)})`, rules.cash);
    k.table({ head: ["Priority", "Job", "Supplier", "Amount needed", "Consequence if not paid"], align: ["l", "l", "l", "r", "l"],
      body: v.cashTomorrow.map((n) => [String(n.priority || "-"), n.jobCode, n.supplier, money(n.amount), n.consequence]),
      foot: v.cashTomorrow.length ? ["Total cash needed", "", "", money(v.cashTotal), ""] : null, empty: "No cash requested for tomorrow." });
    k.line(`Next 7 days: ${v.fcDays.map((d, i) => `${v.fcLabels[i].short} ${moneyC(v.fcNeeds[i] + v.fcDues[i])}`).join("  ·  ")}`);
    // 9
    k.heading("9", `${firstName(C.preparedBy)}'s daily summary`, rules.summary);
    const sm = v.summary;
    const written = sm ? [["Biggest risk", sm.risk], ["Biggest win", sm.win], ["Need tomorrow", sm.need], ["Other notes", sm.note]].filter(([, t]) => String(t || "").trim()).map(([a, b]) => `${a}: ${b}`).join("\n") : "";
    if (written) k.box("Written summary", written); else k.none("No summary written for this date.");
    k.box("Suggested from today's data", v.auto);
    // 10
    k.heading("10", "Compliance checklist", rules.compliance, 170);
    for (const c of v.checks) {
      const lines = doc.splitTextToSize(pdfClean(c.detail), W - 2 * M - 30);
      k.ensure(24 + lines.length * 9);
      doc.setFillColor(...(c.state === "ok" ? PC.goodDot : c.state === "pending" ? PC.warnDot : PC.badDot));
      doc.circle(M + 6, k.y - 3, 4, "F");
      doc.setDrawColor(255, 255, 255); doc.setLineWidth(1.1);
      if (c.state === "ok") doc.lines([[1.6, 1.8], [3.2, -3.6]], M + 3.8, k.y - 3.2, [1, 1], "S");
      else doc.line(M + 6, k.y - 5.4, M + 6, k.y - 2.4);
      k.text(c.label, M + 18, k.y, { size: 8.5, style: "bold" });
      k.text(c.state === "ok" ? "OK" : c.state === "pending" ? "PENDING" : "NOT OK", W - M, k.y, { size: 8, style: "bold", align: "right", color: c.state === "ok" ? PC.good : c.state === "pending" ? PC.ink2 : PC.bad });
      k.font("normal", c.detail); doc.setFontSize(7.5); doc.setTextColor(...PC.ink2);
      doc.text(lines, M + 18, k.y + 10);
      k.y += 16 + lines.length * 9;
    }
    k.footers(`${C.name || "Company"} · Daily purchasing & materials report · ${flong(v.T)} · amounts in ${CUR}`);
    doc.save(`${slug(C.name)}-purchasing-report-${v.T}.pdf`);
  }

  async function withBusy(btn, fn) {
    if (btn.disabled) return;
    const kids = [...btn.childNodes];
    btn.disabled = true;
    btn.replaceChildren(icon("clock"), "Preparing PDF…");
    try { await fn(); toast("PDF downloaded."); }
    catch (e) { console.error(e); toast(e.message || "Could not create the PDF."); }
    finally { btn.disabled = false; btn.replaceChildren(...kids); }
  }

  /* ==========================================================================
     ONLINE MODE — Cloudflare Worker API: shared records, live updates
     No login. The full link carries a secret code (?k=...). The page keeps
     the code on the device, so the report also opens from a home-screen
     shortcut; without the code nothing can be seen or changed.
     ========================================================================== */
  const authEl = $("#auth");
  const KEY_STORE = `kr-key-${CFG.dept}`;
  const API_BASE = `${String(CFG.apiUrl || "").replace(/\/+$/, "")}/api/${CFG.dept}`;
  let KEY = null, REV = 0, pollTimer = 0;
  let snap = new Map(), setSnap = "";
  let syncTimer = 0, retryTimer = 0, syncing = false, syncAgain = false, pending = false;
  const keyOf = (ds, rid) => `${ds}\u0000${rid}`;
  function readKey() {
    let k = null;
    try { k = new URL(location.href).searchParams.get("k"); } catch (e) { /* ignore */ }
    if (k) { try { localStorage.setItem(KEY_STORE, k); } catch (e) { /* storage blocked */ } return k; }
    try { k = localStorage.getItem(KEY_STORE); } catch (e) { /* storage blocked */ }
    if (k) {
      // Put the code back in the address bar, so a link copied from it is complete
      try { const u = new URL(location.href); u.searchParams.set("k", k); history.replaceState(null, "", u.pathname + u.search + u.hash); } catch (e) { /* ignore */ }
    }
    return k;
  }
  async function api(path, body) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
    let res;
    try {
      res = await fetch(API_BASE + path, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json", Authorization: `Key ${KEY}` },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
      });
    } catch (e) {
      throw new Error(e.name === "AbortError" ? "The server did not answer in time" : "No internet connection");
    } finally { clearTimeout(timer); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (res.status === 401) {
      LINKED = false; clearInterval(pollTimer);
      try { localStorage.removeItem(KEY_STORE); } catch (e) { /* ignore */ }
      applyRoleUI();
      showAuth("nokey", data && data.error);
      throw Object.assign(new Error("Link code not valid"), { quiet: true });
    }
    if (!res.ok) throw Object.assign(new Error((data && data.error) || `Server error ${res.status}`), { status: res.status });
    return data;
  }
  function takeSnapshot() {
    snap = new Map();
    for (const ds of DATASETS) for (const r of D[ds]) snap.set(keyOf(ds, r.id), JSON.stringify(r));
    setSnap = JSON.stringify(D.company);
  }
  function setSyncState(st, detail) {
    const el = $("#sync-state");
    if (!el) return;
    el.className = `sync-state ${st}`;
    el.replaceChildren(icon(st === "saved" ? "check" : st === "saving" ? "clock" : "alertCircle"), st === "saved" ? "Saved" : st === "saving" ? "Saving…" : "Not saved");
    el.title = detail || (st === "saved" ? "All changes are saved online" : "");
  }
  function scheduleSync() {
    if (!LINKED) return;
    pending = true;
    setSyncState("saving");
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, 500);
  }
  async function syncNow() {
    if (syncing) { syncAgain = true; return; }
    syncing = true;
    try {
      const ups = [], seen = new Set();
      for (const ds of DATASETS) {
        const def = SHEETS.find((d) => d.id === ds) || { prefix: `${ds.slice(0, 2).toUpperCase()}-` };
        for (const r of D[ds]) {
          if (!/^[A-Za-z0-9._:-]{1,80}$/.test(String(r.id || ""))) r.id = nextId(def);
          const k = keyOf(ds, r.id);
          seen.add(k);
          const js = JSON.stringify(r);
          if (snap.get(k) !== js) ups.push({ dataset: ds, rid: r.id, data: r, js });
        }
      }
      const dels = [...snap.keys()].filter((k) => !seen.has(k)).map((k) => { const [dataset, rid] = k.split("\u0000"); return { dataset, rid }; });
      const setJs = JSON.stringify(D.company);
      const settings = setJs !== setSnap ? D.company : null;
      const jobs = [...ups.map((u) => ["u", u]), ...dels.map((d) => ["d", d])];
      for (let i = 0; i < Math.max(jobs.length, settings ? 1 : 0); i += 200) {
        const part = jobs.slice(i, i + 200);
        const body = { upserts: part.filter((j) => j[0] === "u").map(([, u]) => ({ dataset: u.dataset, rid: u.rid, data: u.data })), deletes: part.filter((j) => j[0] === "d").map(([, d]) => d) };
        if (i === 0 && settings) body.settings = settings;
        await api("/sync", body);
        for (const [kind, x] of part) { if (kind === "u") snap.set(keyOf(x.dataset, x.rid), x.js); else snap.delete(keyOf(x.dataset, x.rid)); }
        if (i === 0 && settings) setSnap = setJs;
      }
      pending = false;
      setSyncState("saved");
    } catch (e) {
      if (e.quiet) return;
      console.error(e);
      setSyncState("error", e.message || String(e));
      toast(`Not saved online (${e.message || e}). It will try again by itself.`, { label: "Try now", run: () => scheduleSync() });
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => { if (pending) scheduleSync(); }, 15000);
    } finally {
      syncing = false;
      if (syncAgain) { syncAgain = false; scheduleSync(); }
    }
  }
  async function loadAll() {
    const res = await api("/data");
    const d = { company: res.settings || {} };
    for (const k of DATASETS) d[k] = [];
    for (const r of res.records || []) if (d[r.dataset]) d[r.dataset].push({ ...r.data, id: r.rid });
    D = normalize(d);
    D.sample = false;
    REV = res.rev || 0;
    takeSnapshot();
  }
  let renderQueued = false;
  function queueRemoteRender() {
    if (renderQueued) return;
    renderQueued = true;
    const run = () => {
      const a = document.activeElement;
      if (a && a.classList && a.classList.contains("cell")) { a.addEventListener("blur", () => setTimeout(run, 60), { once: true }); return; }
      renderQueued = false;
      if (document.body.dataset.view === "sheet") { renderSheetTabs(); renderSheet(); dirty = true; } else rebuildAll();
    };
    setTimeout(run, 200);
  }
  async function poll() {
    if (!LINKED || pending || syncing || document.visibilityState !== "visible") return;
    try {
      let changed = false, more = true;
      while (more) {
        const res = await api(`/changes?since=${REV}`);
        for (const r of res.records || []) {
          const arr = D[r.dataset];
          if (!arr) continue;
          const k = keyOf(r.dataset, r.rid), at = arr.findIndex((x) => x.id === r.rid);
          if (r.deleted) { if (at >= 0) { arr.splice(at, 1); changed = true; } snap.delete(k); continue; }
          const rec = { ...r.data, id: r.rid }, js = JSON.stringify(rec);
          if (snap.get(k) === js) continue;
          if (at >= 0) arr[at] = rec; else arr.push(rec);
          snap.set(k, js);
          changed = true;
        }
        if (res.settings) {
          D.company = normalize({ company: res.settings }).company;
          const js = JSON.stringify(D.company);
          if (js !== setSnap) { setSnap = js; changed = true; }
        }
        REV = res.rev || REV;
        more = !!res.more;
      }
      if (changed) queueRemoteRender();
    } catch (e) { /* offline: try again next time */ }
  }
  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(poll, 15000);
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") poll(); });
  function applyRoleUI() {
    document.body.dataset.role = CONNECTED ? (LINKED ? "link" : "none") : "local";
    for (const id of ["#load-example", "#clear-all", "#export-js"]) $(id).hidden = CONNECTED;
    $("#import-btn").hidden = !canWrite();
    const chip = $("#account-chip");
    chip.hidden = !(CONNECTED && LINKED);
    if (!chip.hidden && !$("#sync-state", chip)) { chip.replaceChildren(h("span", { class: "sync-state saved", id: "sync-state" })); setSyncState(pending ? "saving" : "saved"); }
  }
  function closeAuth() { authEl.hidden = true; document.body.classList.remove("locked"); }
  function showAuth(mode, message) {
    document.body.classList.add("locked");
    authEl.hidden = false;
    const mark = $(".brand .brand-mark") ? $(".brand .brand-mark").cloneNode(true) : null;
    const head = h("div", { class: "auth-head" }, mark, h("div", {}, h("strong", {}, C.name || "Company"), h("span", {}, CFG.label || $(".topbar h1").textContent.trim())));
    const again = h("button", { class: "btn btn-primary", type: "button" }, "Try again");
    again.addEventListener("click", () => location.reload());
    let body = [];
    if (mode === "loading") body = [h("p", { class: "muted" }, "Loading…")];
    else if (mode === "error") body = [h("h2", {}, "Could not connect"), h("p", {}, message || "Something went wrong."), again];
    else if (mode === "nokey") body = [h("h2", {}, "This link is not complete"), h("p", {}, "Open the report with the full link you were sent. It ends with a code, like …?k=abc123."), message ? h("p", { class: "auth-error" }, message) : null];
    authEl.replaceChildren(h("div", { class: "auth-card" }, head, ...body));
  }
  // Records typed before the report was shared stay on the device: offer once to add them to the shared report
  let localOffered = false;
  function offerLocalRecords() {
    if (localOffered || !LINKED) return;
    localOffered = true;
    let raw = null, old = null;
    try { raw = localStorage.getItem(STORE_KEY); old = raw && JSON.parse(raw); } catch (e) { return; }
    if (!old || old.sample) return;
    const parts = DATASETS.map((k) => [k, Array.isArray(old[k]) ? old[k].filter((r) => r && typeof r === "object") : []]).filter(([, rows]) => rows.length);
    const n = parts.reduce((t, [, rows]) => t + rows.length, 0);
    if (!n) return;
    const labelOf = (k) => (SHEETS.find((d) => d.id === k) || { label: k }).label;
    const add = h("button", { class: "btn btn-primary", type: "button" }, `Add ${n === 1 ? "it" : `all ${n}`} to the shared report`);
    add.addEventListener("click", () => {
      for (const [k, rows] of parts) {
        const def = SHEETS.find((d) => d.id === k) || { prefix: `${k.slice(0, 2).toUpperCase()}-` };
        for (const r of rows) D[k].push({ ...r, id: nextId(def) });
      }
      try { localStorage.setItem(`${STORE_KEY}-before-sharing`, raw); localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
      closeAuth();
      saveData();
      if (document.body.dataset.view === "sheet") { renderSheetTabs(); renderSheet(); dirty = true; } else rebuildAll();
      toast(`Added ${n} ${n === 1 ? "record" : "records"}. Everyone with the link can see ${n === 1 ? "it" : "them"} now.`);
    });
    const later = h("button", { class: "linkish", type: "button" }, "Not now");
    later.addEventListener("click", closeAuth);
    document.body.classList.add("locked");
    authEl.hidden = false;
    authEl.replaceChildren(h("div", { class: "auth-card" },
      h("h2", {}, "Records on this device"),
      h("p", {}, `This ${matchMedia("(pointer: coarse)").matches ? "phone" : "device"} has records that were saved only here, before the report was shared: `, h("strong", {}, parts.map(([k, rows]) => `${labelOf(k)} ${rows.length}`).join(", ")), ". Nobody else can see them yet."),
      add, h("p", { class: "auth-links" }, later, " · they stay on this device and you will be asked again next time.")));
  }
  async function bootConnected() {
    document.body.classList.add("locked");
    applyRoleUI();
    KEY = readKey();
    if (!KEY) { showAuth("nokey"); return; }
    showAuth("loading");
    try { await loadAll(); } catch (x) { if (!x.quiet) showAuth("error", `Could not load the records: ${x.message || x}.`); return; }
    LINKED = true;
    startPolling();
    closeAuth();
    applyRoleUI();
    rebuildAll();
    setView(location.hash === "#sheet" ? "sheet" : "report", { scroll: false });
    offerLocalRecords();
  }

  /* ---------- view switching ---------- */
  function setView(v, { scroll = true } = {}) {
    document.body.dataset.view = v;
    $$("#view-seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
    $$("#nav a").forEach((a) => a.classList.toggle("active", v === "sheet" ? a.classList.contains("nav-sheet") : a.getAttribute("href") === "#requests"));
    hideTip();
    if (v === "sheet") { renderSheetTabs(); renderSheet(); }
    else if (dirty) rebuildAll();
    try { history.replaceState(null, "", v === "sheet" ? location.pathname + location.search + "#sheet" : location.pathname + location.search); } catch (e) { /* ignore */ }
    if (scroll) scrollTo({ top: 0 });
  }

  /* ---------- one-time wiring ---------- */
  function initOnce() {
    buildChartCards();
    $$("#nav a").forEach((a, i) => {
      a.prepend(icon(a.dataset.icon));
      if (!a.classList.contains("nav-sheet")) a.append(h("span", { class: "n" }, String(i + 1).padStart(2, "0")));
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href").slice(1);
        e.preventDefault();
        if (id === "sheet") { setView("sheet"); return; }
        if (document.body.dataset.view === "sheet") setView("report", { scroll: false });
        document.getElementById(id).scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      });
    });
    const links = new Map($$("#nav a").map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      if (document.body.dataset.view === "sheet") return;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => a.classList.remove("active"));
        const a = links.get(e.target.id);
        if (a) { a.classList.add("active"); a.scrollIntoView({ block: "nearest", inline: "nearest" }); }
      }
    }, { rootMargin: "-35% 0px -60% 0px" });
    $$(".section").forEach((sec) => io.observe(sec));

    const widths = new WeakMap();
    let pending = new Set(), raf = 0;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width);
        if (widths.get(e.target) === w) continue;
        widths.set(e.target, w);
        if (w > 0) pending.add(e.target);
      }
      if (!pending.size || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        for (const el of pending) {
          if (el === V.spark) { drawSpark(el, V.sparkValues, V.fcLabels); continue; }
          const id = el.closest("[data-chart]")?.dataset.chart;
          if (id && !CHARTS[id].fluid) drawChart(id);
        }
        pending = new Set();
      });
    });
    $$(".chart-body").forEach((el) => ro.observe(el));
    new MutationObserver(() => { if (V.spark) ro.observe(V.spark); }).observe($("#hero"), { childList: true });

    dateInput.addEventListener("change", () => setDate(dateInput.value));
    $("#day-prev").addEventListener("click", () => setDate(addDays(state.date, -1)));
    $("#day-next").addEventListener("click", () => setDate(addDays(state.date, 1)));
    $("#day-today").addEventListener("click", () => setDate(todayISO()));

    $("#theme-btn").addEventListener("click", () => {
      const root = document.documentElement;
      const current = root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("cr-theme", next); } catch (e) { /* storage unavailable */ }
    });

    const pdfTop = $("#pdf-btn");
    pdfTop.addEventListener("click", () => {
      if (document.body.dataset.view === "sheet") setView("report", { scroll: false });
      withBusy(pdfTop, exportReportPdf);
    });
    $("#print-btn").addEventListener("click", () => {
      if (document.body.dataset.view === "sheet") setView("report");
      requestAnimationFrame(() => window.print());
    });
    addEventListener("beforeprint", () => { Object.values(TABLES).forEach((t) => { t.printAll = true; t.draw(); }); });
    addEventListener("afterprint", () => { Object.values(TABLES).forEach((t) => { t.printAll = false; t.draw(); }); });

    $$("#view-seg button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

    const importBtn = $("#import-btn"), fileIn = $("#import-file");
    importBtn.replaceChildren(icon("upload"), "Import Excel / CSV");
    importBtn.addEventListener("click", () => fileIn.click());
    fileIn.addEventListener("change", () => { const f = fileIn.files[0]; fileIn.value = ""; if (f) importFile(f); });
    $("#export-xlsx").replaceChildren(icon("download"), "Export Excel");
    $("#export-xlsx").addEventListener("click", exportExcel);
    $("#export-js").replaceChildren(icon("code"), "Download data.js");
    $("#export-js").addEventListener("click", () => {
      download("data.js", dataJsText(), "text/javascript;charset=utf-8");
      toast("data.js downloaded. Upload it to the purchasing-report repository to publish.");
    });
    $("#load-example").addEventListener("click", () => {
      const has = DATASETS.some((k) => D[k].length) && !D.sample;
      if (has && !confirm("Replace the rows on this device with example data? Export Excel first if you want to keep your rows.")) return;
      D = normalize(exampleData());
      saveData(); renderSheetTabs(); renderSheet(); toast("Example data loaded. Tap Report to see it.");
    });
    $("#clear-all").addEventListener("click", () => {
      if (!confirm("Start with an empty sheet? All rows on this device will be removed (settings are kept). Tip: Export Excel first to keep a copy.")) return;
      for (const k of DATASETS) D[k] = [];
      D.sample = false;
      saveData(); renderSheetTabs(); renderSheet(); toast("Sheet cleared. Tap Add row to start.");
    });
  }

  function initStateFromURL() {
    try {
      const d = new URL(location.href).searchParams.get("date");
      if (isISO(d)) state.date = d;
    } catch (e) { /* ignore */ }
  }

  buildFormats();
  initStateFromURL();
  initOnce();
  rebuildAll();
  if (CONNECTED) bootConnected();
  else { applyRoleUI(); setView(location.hash === "#sheet" ? "sheet" : "report", { scroll: false }); }
})();
