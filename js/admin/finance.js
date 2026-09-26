/* =========================================================
   TASKNOVA ADMIN — FINANCE PAGE LOGIC
   Firebase v12.17.1 modular SDK
   ========================================================= */
import { applyAccessRestrictions } from "./restricted.js";
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
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs
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

// Soft caps on the two client-side aggregation reads (a user's lifetime
// transaction list, and the full revenue ledger for the Revenue tab).
// Both are plain client-side sums — there's no Cloud Function rollup —
// so these exist to keep a single page load bounded. See NOTES.
const TX_SUM_CAP = 1000;
const LEDGER_SCAN_CAP = 2000;

const REVENUE_CATEGORIES = {
  manual_deposit: { label: "Manual Deposit Fees", color: "#086cff", icon: "bx-transfer-alt" },
  task_fee: { label: "Task Fees", color: "#7c3aed", icon: "bx-task" },
  ad_revenue: { label: "Advertisement Revenue", color: "#17c992", icon: "bx-grid-alt" },
  banner_revenue: { label: "Banner Revenue", color: "#ffb020", icon: "bx-image" },
  withdrawal_fee: { label: "Withdrawal Fees", color: "#ff4d5e", icon: "bx-money-withdraw" },
  other: { label: "Other Platform Fees", color: "#53627a", icon: "bx-receipt" }
};
function categoryMeta(cat) { return REVENUE_CATEGORIES[cat] || REVENUE_CATEGORIES.other; }

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
// Revenue History wants the full month name with no time, e.g. "25 September 2026".
function formatLongDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/* ---------------------------------------------------------
   TABS
   --------------------------------------------------------- */
const tabButtons = document.querySelectorAll(".tnr-tab");
const panels = document.querySelectorAll(".tnr-panel");
const loadedTabs = new Set();

function activateTab(tab) {
  tabButtons.forEach((b) => { b.classList.toggle("active", b.dataset.tab === tab); b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false"); });
  panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === tab));
  if (!loadedTabs.has(tab)) {
    loadedTabs.add(tab);
    if (tab === "revenue") loadRevenueOverview();
    if (tab === "history") loadHistory(true);
  }
}
tabButtons.forEach((btn) => btn.addEventListener("click", () => activateTab(btn.dataset.tab)));

/* ===========================================================
   TAB 1 — USER INFORMATION
   =========================================================== */
const finInput = document.getElementById("finUsernameInput");
const finSearchWrap = document.getElementById("finSearchWrap");
const finSuggest = document.getElementById("finSuggest");
const finClearBtn = document.getElementById("finClearBtn");
const finEmptyState = document.getElementById("finEmptyState");
const finUserCard = document.getElementById("finUserCard");

function hideFinSuggestions() {
  finSuggest.classList.remove("show");
  finSuggest.innerHTML = "";
}

function renderFinSuggestions(users) {
  if (!users.length) {
    finSuggest.innerHTML = `<div class="fin-suggest-empty">No matching usernames.</div>`;
    finSuggest.classList.add("show");
    return;
  }
  finSuggest.innerHTML = users.map((u, i) => `
    <button type="button" class="fin-suggest-item" data-i="${i}">
      <span class="fin-suggest-avatar">${escapeHtml((u.fullName || "?").trim().charAt(0).toUpperCase() || "?")}</span>
      <span class="fin-suggest-info">
        <strong>${escapeHtml(u.fullName || "TaskNOVA User")}</strong>
        <span>@${escapeHtml(u.username || "—")}</span>
      </span>
    </button>
  `).join("");
  finSuggest.querySelectorAll(".fin-suggest-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const u = users[Number(btn.dataset.i)];
      finInput.value = u.username || "";
      hideFinSuggestions();
      loadUserFinancials(u);
    });
  });
  finSuggest.classList.add("show");
}

let finSearchDebounce = null;
let finSearchToken = 0;

async function runFinSearch(term) {
  const myToken = ++finSearchToken;
  finSearchWrap.classList.add("loading");
  try {
    const snap = await getDocs(query(
      collection(db, "users"),
      orderBy("username"),
      where("username", ">=", term),
      where("username", "<=", term + "\uf8ff"),
      limit(6)
    ));
    if (myToken !== finSearchToken) return;
    renderFinSuggestions(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
  } catch (err) {
    console.error("Finance user search error:", err);
  } finally {
    if (myToken === finSearchToken) finSearchWrap.classList.remove("loading");
  }
}

// Auto-lowercase as the admin types, cursor position preserved.
finInput.addEventListener("input", () => {
  const start = finInput.selectionStart, end = finInput.selectionEnd;
  finInput.value = finInput.value.toLowerCase();
  finInput.setSelectionRange(start, end);

  finClearBtn.style.display = finInput.value ? "grid" : "none";
  const term = finInput.value.trim();
  clearTimeout(finSearchDebounce);
  if (term.length < 2) {
    finSearchToken++;
    hideFinSuggestions();
    finSearchWrap.classList.remove("loading");
    return;
  }
  finSearchDebounce = setTimeout(() => runFinSearch(term), 250);
});

finClearBtn.addEventListener("click", () => {
  finInput.value = "";
  finClearBtn.style.display = "none";
  hideFinSuggestions();
  finUserCard.style.display = "none";
  finEmptyState.style.display = "flex";
  finInput.focus();
});

document.addEventListener("click", (e) => {
  if (!finSearchWrap.contains(e.target) && !finSuggest.contains(e.target)) hideFinSuggestions();
});

async function loadUserFinancials(u) {
  finEmptyState.style.display = "none";
  finUserCard.style.display = "block";

  const fullName = u.fullName || "TaskNOVA User";
  document.getElementById("finAvatar").textContent = fullName.trim().charAt(0).toUpperCase() || "T";
  document.getElementById("finFullName").textContent = fullName;
  document.getElementById("finUsername").textContent = "@" + (u.username || "—");

  document.getElementById("finDeposit").textContent = formatNaira(u.wallet?.deposit ?? 0);
  document.getElementById("finEarned").textContent = formatNaira(u.wallet?.earned ?? 0);

  document.getElementById("finLifetimeDeposited").textContent = formatNaira(u.lifetimeDeposited ?? 0);
  document.getElementById("finLifetimeEarned").textContent = formatNaira(u.lifetimeEarned ?? 0);

  const spentEl = document.getElementById("finTotalSpent");
  const withdrawnEl = document.getElementById("finTotalWithdrawn");
  const capNoteEl = document.getElementById("finCapNote");
  spentEl.classList.add("skeleton"); spentEl.textContent = "";
  withdrawnEl.classList.add("skeleton"); withdrawnEl.textContent = "";
  capNoteEl.style.display = "none";

  try {
    const snap = await getDocs(query(
      collection(db, "users", u.uid, "transactions"),
      orderBy("createdAt", "desc"),
      limit(TX_SUM_CAP)
    ));

    let totalSpent = 0;
    let totalWithdrawn = 0;
    snap.docs.forEach((d) => {
      const tx = d.data();
      const amount = Number(tx.amount) || 0;
      if (tx.direction === "debit" && (tx.type === "task_post" || tx.type === "ad_post") && tx.status === "successful") {
        totalSpent += amount;
      } else if (tx.type === "withdrawal" && tx.status !== "failed" && tx.status !== "rejected") {
        totalWithdrawn += amount;
      }
    });

    spentEl.textContent = formatNaira(totalSpent);
    withdrawnEl.textContent = formatNaira(totalWithdrawn);
    if (snap.docs.length === TX_SUM_CAP) {
      capNoteEl.style.display = "block";
      capNoteEl.textContent = `Based on the ${TX_SUM_CAP.toLocaleString()} most recent transactions.`;
    }
  } catch (err) {
    console.error("Sum user transactions error:", err);
    spentEl.textContent = "—";
    withdrawnEl.textContent = "—";
    showToast("Couldn't total this user's spend/withdrawals. Please try again.", "error");
  } finally {
    spentEl.classList.remove("skeleton");
    withdrawnEl.classList.remove("skeleton");
  }
}

/* ===========================================================
   TAB 2 — REVENUE
   =========================================================== */
async function loadRevenueOverview() {
  const totalEl = document.getElementById("revTotal");
  const monthEl = document.getElementById("revMonth");
  const growthPill = document.getElementById("revGrowthPill");
  const chartEmpty = document.getElementById("revChartEmpty");
  const donut = document.getElementById("revDonut");
  const donutTotal = document.getElementById("revDonutTotal");
  const legend = document.getElementById("revLegend");
  const breakdownEmpty = document.getElementById("revBreakdownEmpty");
  const capNote = document.getElementById("revCapNote");

  totalEl.classList.add("skeleton"); totalEl.textContent = "";
  monthEl.classList.add("skeleton"); monthEl.textContent = "";

  try {
    const snap = await getDocs(query(
      collection(db, "platformLedger"),
      orderBy("createdAt", "desc"),
      limit(LEDGER_SCAN_CAP)
    ));

    const entries = snap.docs.map((d) => {
      const data = d.data();
      return {
        amount: Number(data.amount) || 0,
        category: data.category || "other",
        date: data.createdAt?.toDate ? data.createdAt.toDate() : null
      };
    });

    const totalRevenue = entries.reduce((sum, e) => sum + e.amount, 0);
    totalEl.textContent = formatNaira(totalRevenue);

    const now = new Date();
    const monthKey = (d) => d ? `${d.getFullYear()}-${d.getMonth()}` : null;
    const thisKey = monthKey(now);
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = monthKey(prevDate);

    let thisMonth = 0, lastMonth = 0;
    entries.forEach((e) => {
      const k = monthKey(e.date);
      if (k === thisKey) thisMonth += e.amount;
      else if (k === prevKey) lastMonth += e.amount;
    });
    monthEl.textContent = formatNaira(thisMonth);

    let growthLabel = "No data last month";
    let growthClass = "flat";
    if (lastMonth > 0) {
      const pct = ((thisMonth - lastMonth) / lastMonth) * 100;
      growthClass = pct >= 0 ? "up" : "down";
      growthLabel = `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}% vs last month`;
    } else if (thisMonth > 0) {
      growthClass = "up";
      growthLabel = "▲ New this month";
    }
    growthPill.className = `growth-pill ${growthClass}`;
    growthPill.textContent = growthLabel;

    if (snap.docs.length === LEDGER_SCAN_CAP) {
      capNote.style.display = "block";
      capNote.textContent = `Figures reflect the ${LEDGER_SCAN_CAP.toLocaleString()} most recent revenue entries.`;
    } else {
      capNote.style.display = "none";
    }

    /* ---- Trend: last 6 months, oldest → newest ---- */
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(d), label: d.toLocaleDateString("en-NG", { month: "short" }), value: 0 });
    }
    entries.forEach((e) => {
      const k = monthKey(e.date);
      const bucket = months.find((m) => m.key === k);
      if (bucket) bucket.value += e.amount;
    });

    chartEmpty.classList.toggle("show", totalRevenue === 0);
    if (totalRevenue > 0) renderTrendChart(months);

    /* ---- Breakdown by category ---- */
    const byCategory = {};
    entries.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
    const rows = Object.entries(byCategory)
      .map(([cat, amount]) => ({ cat, amount, meta: categoryMeta(cat) }))
      .filter((r) => r.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    if (!rows.length) {
      donut.parentElement.style.display = "none";
      legend.innerHTML = "";
      breakdownEmpty.style.display = "flex";
    } else {
      donut.parentElement.style.display = "flex";
      breakdownEmpty.style.display = "none";
      renderBreakdown(rows, totalRevenue, donut, donutTotal, legend);
    }
  } catch (err) {
    console.error("Load revenue overview error:", err);
    totalEl.textContent = "—";
    monthEl.textContent = "—";
    showToast("Couldn't load revenue figures. Please try again.", "error");
  } finally {
    totalEl.classList.remove("skeleton");
    monthEl.classList.remove("skeleton");
  }
}

function renderTrendChart(months) {
  const svg = document.getElementById("revTrendSvg");
  const labelsEl = document.getElementById("revTrendLabels");
  const W = 600, H = 160, PAD = 8;
  const max = Math.max(1, ...months.map((m) => m.value)) * 1.15;
  const n = months.length;
  const stepX = n > 1 ? (W - PAD * 2) / (n - 1) : 0;

  const points = months.map((m, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - (m.value / max) * (H - PAD * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${H} L${points[0].x.toFixed(1)},${H} Z`;

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <path class="gc-area" d="${areaPath}" fill="var(--primary)"></path>
    <path class="gc-line" d="${linePath}"></path>
    ${points.map((p) => `<circle class="gc-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"></circle>`).join("")}
  `;

  labelsEl.innerHTML = months.map((m, i) => {
    const leftPct = n > 1 ? (i / (n - 1)) * 100 : 50;
    return `<span style="left:${leftPct}%">${escapeHtml(m.label)}</span>`;
  }).join("");
}

function renderBreakdown(rows, total, donutEl, donutTotalEl, legendEl) {
  let acc = 0;
  const stops = rows.map((r) => {
    const start = (acc / total) * 100;
    acc += r.amount;
    const end = (acc / total) * 100;
    return `${r.meta.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  donutEl.style.background = `conic-gradient(${stops.join(", ")})`;
  donutTotalEl.innerHTML = `<strong>${formatNaira(total)}</strong><span>Total Revenue</span>`;

  legendEl.innerHTML = rows.map((r) => {
    const pct = (r.amount / total) * 100;
    return `
      <div class="legend-row">
        <span class="legend-dot" style="background:${r.meta.color}"></span>
        <span class="legend-label">${escapeHtml(r.meta.label)}</span>
        <span class="legend-count">${formatNaira(r.amount)}</span>
        <span class="legend-pct">${pct.toFixed(1)}%</span>
      </div>
    `;
  }).join("");
}

/* ===========================================================
   TAB 3 — REVENUE HISTORY
   =========================================================== */
const historyState = { lastDoc: null, hasMore: true, isLoading: false, count: 0 };

function renderRevenueItem(entry) {
  const meta = categoryMeta(entry.category);
  const description = entry.source?.username
    ? "@" + entry.source.username
    : (entry.source?.name || "TaskNOVA System");

  const el = document.createElement("div");
  el.className = "rev-item";
  el.innerHTML = `
    <div class="ri-row1"><span class="ri-source"><i class="bx ${meta.icon}"></i> ${escapeHtml(meta.label)}</span></div>
    <div class="ri-row2"><span class="ri-desc">${escapeHtml(description)}</span><span class="ri-amount">+${formatNaira(entry.amount)}</span></div>
    <div class="ri-row3"><span class="ri-date">${formatLongDate(entry.createdAt)}</span></div>
  `;
  return el;
}

async function loadHistory(reset = false) {
  if (historyState.isLoading) return;
  const listEl = document.getElementById("listHistory");
  const emptyEl = document.getElementById("emptyHistory");
  const loadMoreBtn = document.getElementById("loadMoreHistory");
  const metaEl = document.getElementById("metaHistory");

  if (reset) {
    Object.assign(historyState, { lastDoc: null, hasMore: true, isLoading: false, count: 0 });
    listEl.innerHTML = `<div class="tc-skeleton"></div><div class="tc-skeleton"></div>`;
    emptyEl.style.display = "none";
  }
  if (!historyState.hasMore) return;

  historyState.isLoading = true;
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.disabled = true;

  try {
    const constraints = [orderBy("createdAt", "desc")];
    if (historyState.lastDoc) constraints.push(startAfter(historyState.lastDoc));
    constraints.push(limit(PAGE_SIZE));

    const snap = await getDocs(query(collection(db, "platformLedger"), ...constraints));
    if (reset) listEl.innerHTML = "";

    if (snap.empty && historyState.count === 0) {
      emptyEl.style.display = "flex";
      metaEl.textContent = "No revenue recorded yet.";
      historyState.hasMore = false;
      loadMoreBtn.style.display = "none";
      return;
    }

    snap.docs.forEach((d) => listEl.appendChild(renderRevenueItem(d.data())));

    historyState.count += snap.docs.length;
    historyState.lastDoc = snap.docs[snap.docs.length - 1] || historyState.lastDoc;
    historyState.hasMore = snap.docs.length === PAGE_SIZE;
    loadMoreBtn.style.display = historyState.hasMore ? "inline-flex" : "none";
    metaEl.textContent = `${historyState.count} record${historyState.count === 1 ? "" : "s"} loaded`;
  } catch (err) {
    console.error("Load revenue history error:", err);
    showToast("Couldn't load revenue history. Please try again.", "error");
  } finally {
    historyState.isLoading = false;
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  }
}
document.getElementById("loadMoreHistory")?.addEventListener("click", () => loadHistory(false));

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
    await applyAccessRestrictions({ auth, isFullPage: true });
  } catch (err) {
    // Execution stopped for support user
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
});

/* ===========================================================
   NOTES
   ===========================================================
   1. Admin identity read (users/{uid}) mirrors every other admin
      page's same assumption — no staffAccounts/{uid}.role gate is
      applied here either, consistent with manual-transactions.js.

   2. Tab 1 (User Information) reads users/{uid} directly for
      wallet.deposit / wallet.earned / lifetimeDeposited /
      lifetimeEarned. lifetimeDeposited is confirmed real (bumped
      by wallet.js's deposit verification and by admin/manual-
      transactions.js's manual-deposit approval). lifetimeEarned is
      still the same open ASSUMPTION flagged on user-details.js —
      no page has been confirmed to actually bump it on a task
      payout, so it may under-report until that's wired up.

   3. Total Spent / Total Withdrawn have no running-counter field
      anywhere, so this page sums them client-side from
      users/{uid}/transactions (same lightweight approach wallet.js
      itself already uses for its daily-withdrawal-limit check):
        - Total Spent   = debit, status "successful", type
          "task_post" or "ad_post" (covers ads AND banners — both
          write type: "ad_post").
        - Total Withdrawn = type "withdrawal", excluding "failed"/
          "rejected" (same exclusion wallet.js's own limit check
          uses).
      The read is capped at the TX_SUM_CAP most recent transactions
      (1,000) for one user — a note appears under the two figures
      if a user actually has that many, since the true lifetime
      total could run higher. Raise the cap, or move to a
      maintained running counter, if that starts happening often.

   4. Tab 2/3 (Revenue + Revenue History) both read platformLedger,
      which currently has exactly two writers:
        - manual-transactions.js — category "manual_deposit", on
          manual-deposit approval.
        - post-advertisement.js — category "ad_revenue" or
          "banner_revenue", on ad/banner purchase (100% of price,
          since neither has a worker-payout portion to net out).
      Two categories are defined in REVENUE_CATEGORIES but have no
      writer yet, so they'll show ₦0 until wired up:
        - "task_fee" — a task's platformFee only becomes real
          revenue once a submission is approved and the worker is
          paid; that approval flow isn't built yet (flagged in
          post-task.js's own notes).
        - "withdrawal_fee" — computed inside the requestWithdrawal
          Edge Function (WITHDRAWAL_FEE_RATE = 5% in wallet.js),
          which is server-side and outside any client file here.
      Both just need the same ledger write added at the point the
      revenue is actually realized.

   5. Tab 2's Total Revenue, month-over-month growth, 6-month trend,
      and category breakdown are all computed from one client-side
      read of platformLedger (newest LEDGER_SCAN_CAP = 2,000
      entries, no Cloud Function aggregation). A note appears under
      the total if the ledger has grown past that cap, since the
      real all-time total would then run higher — worth moving to a
      scheduled aggregate doc (e.g. platformStats/summary) once
      volume gets there instead of raising the cap indefinitely.

   6. The trend chart and donut reuse dashboard.css's own
      .growth-chart (gc-line/gc-area/gc-dot) and .breakdown-donut/
      .breakdown-legend classes verbatim, so Finance's charts match
      the Dashboard's exactly rather than introducing a second
      visual language. Both are hand-built (inline SVG path +
      conic-gradient string) since no chart library is loaded
      anywhere on the site.

   7. Tab 1's live search does a prefix range query on `username`
      (>= term, <= term+"\uf8ff", limit 6) exactly like Manual
      Changes' type-ahead — same automatic-lowercase-as-you-type
      requirement from the spec, same picklist UX. Selecting a
      result uses the doc data already returned by that query (no
      second read for the profile fields).
   =========================================================== */
