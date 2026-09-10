/* =========================================================
   TASKNOVA ADMIN — FINANCE PAGE LOGIC
   Firebase v12.17.1 modular SDK
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcQLQWNUqGdtd5Jo_eZaDVDq70xkL7S0k",
  authDomain: "tasknova-240eb.firebaseapp.com",
  projectId: "tasknova-240eb",
  storageBucket: "tasknova-240eb.firebasestorage.app",
  messagingSenderId: "303980894317",
  appId: "1:303980894317:web:7a4be9b7face44a22bc764"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PAGE_SIZE = 15;
const WITHDRAWAL_FEE_RATE = 0.05; // fallback only — used if fee/netAmount aren't stored on the doc

const REVENUE_CATEGORIES = [
  { key: "task_fee", label: "Task Fees", valueEl: "revTaskFee", pctEl: "revTaskFeePct" },
  { key: "ad_revenue", label: "Ad Revenue", valueEl: "revAdRevenue", pctEl: "revAdRevenuePct" },
  { key: "banner_revenue", label: "Banner Revenue", valueEl: "revBannerRevenue", pctEl: "revBannerRevenuePct" },
  { key: "manual_deposit", label: "Manual Deposit Fees", valueEl: "revManualDeposit", pctEl: "revManualDepositPct" },
  { key: "other", label: "Other", valueEl: "revOther", pctEl: "revOtherPct" }
];

/* ---------------------------------------------------------
   THEME (persists site-wide — same key used on every page)
   --------------------------------------------------------- */
const body = document.body;
const themeSwitch = document.getElementById("themeSwitch");
const themeIcon = document.getElementById("themeIcon");
const themeImages = document.querySelectorAll("[data-light][data-dark]");

function setTheme(theme, save = true) {
  const isDark = theme === "dark";
  body.classList.toggle("dark", isDark);
  themeImages.forEach((img) => { img.src = isDark ? img.dataset.dark : img.dataset.light; });
  if (themeIcon) themeIcon.className = isDark ? "bx bx-sun" : "bx bx-moon";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#03070e" : "#f7faff");
  if (save) localStorage.setItem("tasknova-theme", theme);
}

const savedTheme = localStorage.getItem("tasknova-theme");
if (savedTheme === "dark" || savedTheme === "light") {
  setTheme(savedTheme, false);
} else {
  setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light", false);
}

themeSwitch?.addEventListener("click", () => {
  setTheme(body.classList.contains("dark") ? "light" : "dark");
});

/* ---------------------------------------------------------
   HEADER SCROLL SHADOW
   --------------------------------------------------------- */
const siteHeader = document.getElementById("siteHeader");
function updateHeader() { siteHeader.classList.toggle("scrolled", window.scrollY > 18); }
updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

/* ---------------------------------------------------------
   SCROLL REVEALS
   --------------------------------------------------------- */
const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("visible"));
}

/* ---------------------------------------------------------
   MOBILE / MENU DRAWER
   --------------------------------------------------------- */
const menuToggle = document.getElementById("menuToggle");
const mobileMenu = document.getElementById("mobileMenu");
const menuBackdrop = document.getElementById("menuBackdrop");
const menuClose = document.getElementById("menuClose");

function openMenu() {
  mobileMenu.classList.add("open");
  mobileMenu.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeMenu() {
  mobileMenu.classList.remove("open");
  mobileMenu.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
menuToggle?.addEventListener("click", openMenu);
menuBackdrop?.addEventListener("click", closeMenu);
menuClose?.addEventListener("click", closeMenu);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
mobileMenu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

const menuGroups = document.querySelectorAll(".menu-group");
menuGroups.forEach((group) => {
  const label = group.querySelector(".menu-group-label");
  label?.addEventListener("click", () => {
    const isOpen = group.classList.contains("open");
    menuGroups.forEach((g) => g.classList.remove("open"));
    if (!isOpen) group.classList.add("open");
  });
});

/* ---------------------------------------------------------
   LOGOUT
   --------------------------------------------------------- */
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (err) {
    console.error("Logout failed:", err);
  }
});

/* ---------------------------------------------------------
   TOAST
   --------------------------------------------------------- */
const toastEl = document.getElementById("toast");
const toastMsgEl = document.getElementById("toastMsg");
let toastTimer = null;

function showToast(message, type = "success") {
  clearTimeout(toastTimer);
  toastEl.className = "toast show " + (type === "error" ? "error" : "");
  toastEl.querySelector("i").className = type === "error" ? "bx bx-error-circle" : "bx bx-check-circle";
  toastMsgEl.textContent = message;
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
}

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */
function formatNaira(n) {
  return "₦" + (Number(n) || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

const userCache = new Map();
async function getUserSummary(uid) {
  if (!uid) return { fullName: "Unknown user", accountType: "" };
  if (userCache.has(uid)) return userCache.get(uid);
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const summary = snap.exists()
      ? { fullName: snap.data().fullName || "TaskNOVA User", accountType: snap.data().accountType || "" }
      : { fullName: "Deleted user", accountType: "" };
    userCache.set(uid, summary);
    return summary;
  } catch {
    return { fullName: "Unknown user", accountType: "" };
  }
}

/* ---------------------------------------------------------
   TABS
   --------------------------------------------------------- */
const tabButtons = document.querySelectorAll(".tnr-tab");
const panels = document.querySelectorAll(".tnr-panel");
const loadedTabs = new Set();

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    tabButtons.forEach((b) => { b.classList.toggle("active", b === btn); b.setAttribute("aria-selected", b === btn ? "true" : "false"); });
    panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === tab));
    if (!loadedTabs.has(tab)) {
      loadedTabs.add(tab);
      if (tab === "withdrawals") loadWithdrawals(true);
      else if (tab === "transactions") loadLedger(true);
      else if (tab === "revenue") loadRevenue();
    }
  });
});

/* ===========================================================
   WITHDRAWALS TAB
   Reads across every user's own transactions subcollection via
   a collectionGroup query (type == "withdrawal"), rather than a
   separate top-level collection — wallet.js's requestWithdrawal
   Cloud Function writes withdrawal requests as ordinary
   users/{uid}/transactions/{id} docs, so this is the same data
   the user sees on their own Transactions page, just queried
   across everyone at once.
   =========================================================== */
let withdrawFilter = "needs_attention";
const withdrawState = { lastDoc: null, hasMore: true, isLoading: false, count: 0 };

function withdrawStatusConstraint() {
  if (withdrawFilter === "needs_attention") return where("status", "in", ["pending", "processing"]);
  return where("status", "==", withdrawFilter);
}

document.querySelectorAll('#withdrawFilterRow .rf-chip').forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chip.dataset.wf === withdrawFilter) return;
    document.querySelectorAll('#withdrawFilterRow .rf-chip').forEach((c) => c.classList.toggle("active", c === chip));
    withdrawFilter = chip.dataset.wf;
    loadWithdrawals(true);
  });
});

async function loadWithdrawals(reset = false) {
  if (withdrawState.isLoading) return;
  if (reset) {
    Object.assign(withdrawState, { lastDoc: null, hasMore: true, isLoading: false, count: 0 });
    document.getElementById("listWithdrawals").innerHTML = `<div class="tc-skeleton"></div><div class="tc-skeleton"></div>`;
    document.getElementById("emptyWithdrawals").style.display = "none";
  }
  if (!withdrawState.hasMore) return;

  withdrawState.isLoading = true;
  const loadMoreBtn = document.getElementById("loadMoreWithdrawals");
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.disabled = true;

  try {
    const constraints = [
      where("type", "==", "withdrawal"),
      withdrawStatusConstraint(),
      orderBy("createdAt", "desc")
    ];
    if (withdrawState.lastDoc) constraints.push(startAfter(withdrawState.lastDoc));
    constraints.push(limit(PAGE_SIZE));

    const snap = await getDocs(query(collectionGroup(db, "transactions"), ...constraints));
    const listEl = document.getElementById("listWithdrawals");
    if (reset) listEl.innerHTML = "";

    if (snap.empty && withdrawState.count === 0) {
      document.getElementById("emptyWithdrawals").style.display = "flex";
      document.getElementById("metaWithdrawals").textContent = "Nothing here.";
      withdrawState.hasMore = false;
      loadMoreBtn.style.display = "none";
      return;
    }

    for (const docSnap of snap.docs) {
      const cardEl = await renderWithdrawalCard(docSnap);
      listEl.appendChild(cardEl);
    }

    withdrawState.count += snap.docs.length;
    withdrawState.lastDoc = snap.docs[snap.docs.length - 1] || withdrawState.lastDoc;
    withdrawState.hasMore = snap.docs.length === PAGE_SIZE;
    loadMoreBtn.style.display = withdrawState.hasMore ? "inline-flex" : "none";
    document.getElementById("metaWithdrawals").textContent = `${withdrawState.count} request${withdrawState.count === 1 ? "" : "s"} loaded`;
  } catch (err) {
    console.error("Load withdrawals error:", err);
    showToast("Couldn't load withdrawals. Please try again.", "error");
  } finally {
    withdrawState.isLoading = false;
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  }
}
document.getElementById("loadMoreWithdrawals")?.addEventListener("click", () => loadWithdrawals(false));

async function renderWithdrawalCard(docSnap) {
  const tx = docSnap.data();
  const txId = docSnap.id;
  const uid = docSnap.ref.parent.parent.id;
  const advertiser = await getUserSummary(uid);

  const amount = tx.amount || 0;
  const fee = tx.fee !== undefined ? tx.fee : amount * WITHDRAWAL_FEE_RATE;
  const netAmount = tx.netAmount !== undefined ? tx.netAmount : amount - fee;
  const bankName = tx.bankName || tx.bank_name || "—";
  const accountNumber = tx.accountNumber || tx.account_number || "—";
  const accountName = tx.accountName || tx.account_name || "—";
  const status = tx.status || "pending";
  const resolvable = status === "pending" || status === "processing" || status === "sent";

  const card = document.createElement("div");
  card.className = "task-card";
  card.innerHTML = `
    <div class="tc-head">
      <div class="tc-title-wrap">
        <div class="tc-title">${escapeHtml(advertiser.fullName)}</div>
        <div class="tc-sub">${escapeHtml(advertiser.accountType || "")}</div>
      </div>
      <div class="tc-amount">${formatNaira(amount)}</div>
    </div>
    <div class="tc-tags">
      <span class="tc-tag status-${escapeHtml(status)}"><i class="bx bx-loader-circle"></i> ${escapeHtml(status)}</span>
    </div>
    <div class="bank-detail-box">
      <strong>${escapeHtml(accountName)}</strong>
      <span>${escapeHtml(bankName)} · ${escapeHtml(accountNumber)}</span>
    </div>
    <div class="fee-breakdown">
      <div class="fee-box"><div class="fb-label">Requested</div><div class="fb-value">${formatNaira(amount)}</div></div>
      <div class="fee-box"><div class="fb-label">Fee (5%)</div><div class="fb-value">${formatNaira(fee)}</div></div>
      <div class="fee-box"><div class="fb-label">Received</div><div class="fb-value">${formatNaira(netAmount)}</div></div>
    </div>
    <div class="tc-date">Requested ${formatDate(tx.createdAt)}</div>
    <div class="tc-action-slot"></div>
  `;

  const actionSlot = card.querySelector(".tc-action-slot");
  if (resolvable) {
    actionSlot.innerHTML = `
      <div class="tc-actions">
        <button type="button" class="btn btn-ghost" data-act="resolve-toggle"><i class="bx bx-check-circle"></i><span class="btn-label">Mark Resolved</span></button>
      </div>
      <div class="tc-decline-panel" id="resolvePanel-${txId}"><div><div class="tc-resolve-inner">
        <textarea id="resolveNote-${txId}" placeholder="Note (optional) — e.g. why this needed manual resolution…"></textarea>
        <div class="resolve-choice-row">
          <button type="button" class="btn btn-success" data-act="mark-completed"><span class="btn-spinner"></span><i class="bx bx-check"></i><span class="btn-label">Mark Completed</span></button>
          <button type="button" class="btn btn-danger" data-act="reject-refund"><span class="btn-spinner"></span><i class="bx bx-undo"></i><span class="btn-label">Reject &amp; Refund</span></button>
        </div>
      </div></div></div>
    `;
    const panel = actionSlot.querySelector(`#resolvePanel-${txId}`);
    actionSlot.querySelector('[data-act="resolve-toggle"]').addEventListener("click", () => panel.classList.add("show"));
    actionSlot.querySelector('[data-act="mark-completed"]').addEventListener("click", (e) => resolveWithdrawal(uid, txId, "completed", amount, card, e.currentTarget));
    actionSlot.querySelector('[data-act="reject-refund"]').addEventListener("click", (e) => resolveWithdrawal(uid, txId, "rejected", amount, card, e.currentTarget));
  }

  return card;
}

/* ---------------------------------------------------------
   ACTION — MARK COMPLETED / REJECT & REFUND
   Completed just closes out the request (the transfer already
   went out via Paystack or a manual bank transfer — no wallet
   change). Rejected credits the gross `amount` back to
   wallet.earned (that's what was deducted at request time) and
   logs a refund transaction, since the payout never went through.
   --------------------------------------------------------- */
async function resolveWithdrawal(uid, txId, outcome, amount, cardEl, btnEl) {
  const note = document.getElementById(`resolveNote-${txId}`)?.value.trim() || "";
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    const txRef = doc(db, "users", uid, "transactions", txId);

    if (outcome === "completed") {
      await updateDoc(txRef, {
        status: "completed",
        resolutionNote: note || null,
        resolvedAt: serverTimestamp()
      });
      showToast("Withdrawal marked completed.");
    } else {
      const userRef = doc(db, "users", uid);
      await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("User account not found.");
        const earned = userSnap.data().wallet?.earned ?? 0;

        transaction.update(userRef, { "wallet.earned": earned + amount });
        transaction.update(txRef, {
          status: "rejected",
          resolutionNote: note || null,
          resolvedAt: serverTimestamp()
        });

        const refundRef = doc(collection(db, "users", uid, "transactions"));
        transaction.set(refundRef, {
          type: "refund",
          direction: "credit",
          title: "Withdrawal rejected — refunded to Earned Balance",
          amount,
          status: "successful",
          createdAt: serverTimestamp()
        });
      });
      showToast("Withdrawal rejected — the user has been refunded.");
    }

    animateOutAndRemove(cardEl);
    withdrawState.count = Math.max(0, withdrawState.count - 1);
  } catch (err) {
    console.error("Resolve withdrawal error:", err);
    showToast(err.message || "Couldn't update this withdrawal. Please try again.", "error");
  } finally {
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

/* ===========================================================
   TRANSACTIONS TAB — platform ledger (read-only)
   Reads a dedicated top-level `platformLedger` collection. This
   is new infrastructure this page introduces — see the NOTES
   block at the bottom for what else needs to start writing to it.
   =========================================================== */
const ledgerState = { lastDoc: null, hasMore: true, isLoading: false, count: 0 };

async function loadLedger(reset = false) {
  if (ledgerState.isLoading) return;
  if (reset) {
    Object.assign(ledgerState, { lastDoc: null, hasMore: true, isLoading: false, count: 0 });
    document.getElementById("listTransactions").innerHTML = `<div class="tc-skeleton"></div><div class="tc-skeleton"></div>`;
    document.getElementById("emptyTransactions").style.display = "none";
  }
  if (!ledgerState.hasMore) return;

  ledgerState.isLoading = true;
  const loadMoreBtn = document.getElementById("loadMoreTransactions");
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.disabled = true;

  try {
    const constraints = [orderBy("createdAt", "desc")];
    if (ledgerState.lastDoc) constraints.push(startAfter(ledgerState.lastDoc));
    constraints.push(limit(PAGE_SIZE));

    const snap = await getDocs(query(collection(db, "platformLedger"), ...constraints));
    const listEl = document.getElementById("listTransactions");
    if (reset) listEl.innerHTML = "";

    if (snap.empty && ledgerState.count === 0) {
      document.getElementById("emptyTransactions").style.display = "flex";
      document.getElementById("metaTransactions").textContent = "No ledger entries yet.";
      ledgerState.hasMore = false;
      loadMoreBtn.style.display = "none";
      return;
    }

    snap.docs.forEach((docSnap) => listEl.appendChild(renderLedgerCard(docSnap.data())));

    ledgerState.count += snap.docs.length;
    ledgerState.lastDoc = snap.docs[snap.docs.length - 1] || ledgerState.lastDoc;
    ledgerState.hasMore = snap.docs.length === PAGE_SIZE;
    loadMoreBtn.style.display = ledgerState.hasMore ? "inline-flex" : "none";
    document.getElementById("metaTransactions").textContent = `${ledgerState.count} entr${ledgerState.count === 1 ? "y" : "ies"} loaded`;
  } catch (err) {
    console.error("Load ledger error:", err);
    showToast("Couldn't load the ledger. Please try again.", "error");
  } finally {
    ledgerState.isLoading = false;
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  }
}
document.getElementById("loadMoreTransactions")?.addEventListener("click", () => loadLedger(false));

const CATEGORY_LABELS = {
  task_fee: "Task Fee", ad_revenue: "Ad Revenue", banner_revenue: "Banner Revenue",
  manual_deposit: "Manual Deposit Fee", other: "Other"
};

function renderLedgerCard(entry) {
  const card = document.createElement("div");
  card.className = "task-card";
  card.innerHTML = `
    <div class="tc-head">
      <div class="tc-title-wrap">
        <div class="tc-title">${escapeHtml(entry.reason || "Ledger entry")}</div>
      </div>
      <div class="tc-amount">${formatNaira(entry.amount)}</div>
    </div>
    <div class="tc-tags">
      <span class="tc-tag category">${escapeHtml(CATEGORY_LABELS[entry.category] || entry.category || "Other")}</span>
    </div>
    <div class="ledger-flow">
      <span class="lf-node">${escapeHtml(entry.source?.name || "—")}</span>
      <i class="bx bx-right-arrow-alt"></i>
      <span class="lf-node">${escapeHtml(entry.reason || "—")}</span>
      <i class="bx bx-right-arrow-alt"></i>
      <span class="lf-node">${escapeHtml(entry.destination?.name || "TaskNOVA Revenue")}</span>
    </div>
    <div class="tc-date">${formatDate(entry.createdAt)}</div>
  `;
  return card;
}

/* ===========================================================
   REVENUE TAB — sums from platformLedger by category
   =========================================================== */
let revenueLoaded = false;

async function loadRevenue() {
  if (revenueLoaded) return;
  revenueLoaded = true;
  document.getElementById("metaRevenue").textContent = "Loading revenue totals…";

  try {
    const results = await Promise.all(
      REVENUE_CATEGORIES.map((cat) =>
        getAggregateFromServer(
          query(collection(db, "platformLedger"), where("category", "==", cat.key)),
          { total: sum("amount") }
        )
      )
    );

    const totals = REVENUE_CATEGORIES.map((cat, i) => ({ ...cat, total: results[i].data().total || 0 }));
    const grandTotal = totals.reduce((sumSoFar, t) => sumSoFar + t.total, 0);

    document.getElementById("revenueTotalValue").textContent = formatNaira(grandTotal);

    const barEl = document.getElementById("revenueBar");
    barEl.innerHTML = "";

    totals.forEach((t) => {
      const pct = grandTotal > 0 ? (t.total / grandTotal) * 100 : 0;
      document.getElementById(t.valueEl).textContent = formatNaira(t.total);
      document.getElementById(t.pctEl).textContent = `${pct.toFixed(1)}%`;
      if (pct > 0) {
        const seg = document.createElement("div");
        seg.className = `revenue-bar-seg ${t.key}`;
        seg.style.width = `${pct}%`;
        barEl.appendChild(seg);
      }
    });

    document.getElementById("metaRevenue").textContent = grandTotal > 0
      ? "Totals across every recorded ledger entry."
      : "No revenue recorded in the ledger yet.";
  } catch (err) {
    console.error("Load revenue error:", err);
    document.getElementById("metaRevenue").textContent = "Couldn't load revenue totals.";
    showToast("Couldn't load revenue totals.", "error");
    revenueLoaded = false;
  }
}

/* ---------------------------------------------------------
   UI HELPERS
   --------------------------------------------------------- */
function animateOutAndRemove(cardEl) {
  cardEl.style.transition = "opacity .3s ease, transform .3s ease";
  cardEl.style.opacity = "0";
  cardEl.style.transform = "translateX(12px)";
  setTimeout(() => cardEl.remove(), 300);
}

/* ---------------------------------------------------------
   TAB BADGE COUNT (Withdrawals needing attention)
   --------------------------------------------------------- */
async function loadCounts() {
  try {
    const snap = await getCountFromServer(
      query(collectionGroup(db, "transactions"), where("type", "==", "withdrawal"), where("status", "in", ["pending", "processing"]))
    );
    document.getElementById("countWithdrawals").textContent = snap.data().count;
  } catch (err) {
    console.error("Load withdrawal count error:", err);
  }
}

/* ---------------------------------------------------------
   AUTH GUARD
   --------------------------------------------------------- */
const userNameEl = document.getElementById("menuUserName");
const userTypeEl = document.getElementById("menuUserType");
const userAvatarEl = document.getElementById("menuUserAvatar");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : {};
    const fullName = data.fullName || "Admin";
    const initial = fullName.trim().charAt(0).toUpperCase() || "A";
    if (userNameEl) userNameEl.textContent = fullName;
    if (userTypeEl) userTypeEl.textContent = "Admin";
    if (userAvatarEl) userAvatarEl.textContent = initial;
  } catch (err) {
    console.error("Load admin profile error:", err);
  }

  loadCounts();
  loadedTabs.add("withdrawals");
  loadWithdrawals(true);
});

/* ===========================================================
   NOTES
   ===========================================================
   - Admin identity read (users/{uid}) mirrors the same assumption
     flagged on every other admin page — swap it if admins live
     elsewhere.

   - Withdrawals reads across EVERY user's own transactions
     subcollection via a collectionGroup query filtered to
     type == "withdrawal", rather than a separate top-level
     collection — that's the same doc wallet.js's requestWithdrawal
     Cloud Function already writes and the user's own Transactions
     page already reads, just queried across everyone. This needs a
     Firestore composite index on the "transactions" collection
     group for (type ==, status == or in, createdAt desc) —
     Firestore will surface the exact index-creation link the first
     time each filter combination runs in production.

   - Withdrawal fee/net amount and bank details are read with
     fallbacks (tx.fee / tx.bankName, etc., falling back to
     tx.bank_name-style snake_case, then to a computed 5% fee) since
     the actual Cloud Function that writes these transactions isn't
     visible here — only the client-side request in wallet.js is.
     Confirm the real field names the function writes and simplify
     this once they're known.

   - "Needs Attention" bundles pending + processing into one filter
     (a withdrawal that's already "sent" can still be marked
     resolved too, in case a transfer silently failed after
     leaving Paystack — but it doesn't count toward the badge or
     the default filter, only pending/processing do).

   - Mark Resolved offers two outcomes since the spec only said
     "the only real admin action being Mark Resolved" without
     specifying what resolving means: Mark Completed (transfer
     genuinely went out — no wallet change) or Reject & Refund
     (transfer failed — credits the gross `amount` back to
     wallet.earned and logs a refund transaction). This is this
     page's own reading of "resolved" — say the word if withdrawals
     should resolve some other way.

   - Transactions tab reads a brand-new `platformLedger` collection
     that nothing currently writes to — it's this page's proposed
     schema for the "source → reason → destination" ledger the spec
     asked for: { source: {uid,name} | null, reason: string,
     destination: {uid,name} | null, amount, category: "task_fee" |
     "ad_revenue" | "banner_revenue" | "manual_deposit" | "other",
     createdAt }. For Revenue to ever show non-zero numbers, other
     flows need to start writing to it: post-task.js at the moment
     a task's platformFee is actually charged, post-advertisement.js
     at ad/banner purchase, Manual Deposits' Approve action (the ₦20
     manual-transfer fee difference, per wallet.js's own backend
     notes), and any Reports & Support Force Pay action if that
     should be tracked too. Dashboard's Total Profit card should
     also be pointed at this same collection once it's live, so the
     two pages never disagree.

   - Revenue tab sums each category with a single
     getAggregateFromServer(..., sum("amount")) call — five cheap
     aggregate reads total, not a full collection scan.
   =========================================================== */
