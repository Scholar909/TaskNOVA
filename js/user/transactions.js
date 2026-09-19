/* =========================================================
   TASKNOVA — TRANSACTION HISTORY PAGE LOGIC
   Firebase v12.17.1 modular SDK

   Corrections applied this pass (see chat for full context):
   1. The "Other" filter chip queried where("type","=="," other")
      literally, so any real (but uncategorized) type — the new
      admin_adjustment/transfer/task_payout types introduced by
      the admin rework — showed under "All" via the display
      fallback but never matched "Other"'s own query. Fixed to be
      a genuine catch-all (see the "Other" filter note below).
   2. TX_META gained entries for admin_adjustment, transfer, and
      task_payout so they get proper icons/labels everywhere, not
      just the generic "Other" dots icon.
   3. accountType/institutionAbbr removed from the menu subtitle,
      replaced with @username, per the site-wide removal.
   4. Tawk.to visitor auto-fill added (same block as every other
      reworked page).
   5. SKRED_ADVERTISE_LINK renamed to DEFAULT_BANNER_LINK (same
      fix already applied elsewhere).
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
  onSnapshot,
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

/* ---------------------------------------------------------
   THEME (persists site-wide — same key used on every page)
   --------------------------------------------------------- */
const body = document.body;
const themeToggle = document.getElementById("themeToggle");
const themeSwitch = document.getElementById("themeSwitch");
const themeIcon = document.getElementById("themeIcon");
const themeImages = document.querySelectorAll("[data-light][data-dark]");

function setTheme(theme, save = true) {
  const isDark = theme === "dark";
  body.classList.toggle("dark", isDark);

  themeImages.forEach((img) => {
    img.src = isDark ? img.dataset.dark : img.dataset.light;
  });

  if (themeIcon) themeIcon.className = isDark ? "bx bx-sun" : "bx bx-moon";
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", isDark ? "#03070e" : "#f7faff");

  if (save) localStorage.setItem("tasknova-theme", theme);
}

const savedTheme = localStorage.getItem("tasknova-theme");
if (savedTheme === "dark" || savedTheme === "light") {
  setTheme(savedTheme, false);
} else {
  setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light", false);
}

function toggleTheme() {
  setTheme(body.classList.contains("dark") ? "light" : "dark");
}

themeToggle?.addEventListener("click", toggleTheme);
themeSwitch?.addEventListener("click", toggleTheme);

/* ---------------------------------------------------------
   HEADER SCROLL SHADOW
   --------------------------------------------------------- */
const siteHeader = document.getElementById("siteHeader");
function updateHeader() {
  siteHeader.classList.toggle("scrolled", window.scrollY > 18);
}
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

/* ---------------------------------------------------------
   MENU GROUP ACCORDION (Account / Earn / Advertise / Support)
   Only one group is open at a time; tapping an open group's
   label closes it again.
   --------------------------------------------------------- */
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
    window.location.href = "../index.html";
  } catch (err) {
    console.error("Logout failed:", err);
  }
});

/* ---------------------------------------------------------
   DEFAULT BANNER -> INTERNAL "ADVERTISE WITH US" LINK
   (Used whenever a paid banner slot is empty. Renamed from the
   old SKRED_ADVERTISE_LINK name — it already pointed internally,
   not to Skred, and Skred is being removed from the app entirely
   as a support/contact channel, so the old name was misleading.)
   --------------------------------------------------------- */
const DEFAULT_BANNER_LINK = "../user/post-advertisement.html";

document.querySelectorAll("[data-default-ad]").forEach((el) => {
  el.addEventListener("click", () => {
    window.open(DEFAULT_BANNER_LINK, "_blank", "noopener");
  });
});

/* ---------------------------------------------------------
   FLOATING AD + FLOATING SUPPORT (draggable, position saved)
   Support sits beneath the ad by default (per spec).
   Position is shared across pages via the same storage keys.
   --------------------------------------------------------- */
function makeDraggable(el, storageKey, defaults) {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "null") || defaults;
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.left = saved.left + "px";
  el.style.top = saved.top + "px";

  let dragging = false;
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;
  let moved = false;

  function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

  function onPointerDown(e) {
    dragging = true;
    moved = false;
    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    startY = point.clientY;
    const rect = el.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    el.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startX;
    const dy = point.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

    const maxLeft = window.innerWidth - el.offsetWidth - 8;
    const maxTop = window.innerHeight - el.offsetHeight - 8;
    const newLeft = clamp(startLeft + dx, 8, maxLeft);
    const newTop = clamp(startTop + dy, 8, maxTop);

    el.style.left = newLeft + "px";
    el.style.top = newTop + "px";
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    const rect = el.getBoundingClientRect();
    localStorage.setItem(storageKey, JSON.stringify({ left: rect.left, top: rect.top }));

    // Prevent the click-through-navigation firing right after a real drag
    if (moved) {
      el._suppressClick = true;
      setTimeout(() => { el._suppressClick = false; }, 50);
    }
  }

  el.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  el.addEventListener("click", (e) => {
    if (el._suppressClick) { e.preventDefault(); e.stopPropagation(); }
  });

  window.addEventListener("resize", () => {
    const rect = el.getBoundingClientRect();
    const maxLeft = window.innerWidth - el.offsetWidth - 8;
    const maxTop = window.innerHeight - el.offsetHeight - 8;
    el.style.left = clamp(rect.left, 8, maxLeft) + "px";
    el.style.top = clamp(rect.top, 8, maxTop) + "px";
  });
}

const floatingAd = document.getElementById("floatingAd");
const supportFab = document.getElementById("supportFab");

if (floatingAd) {
  const adDefaultTop = window.innerHeight - 260;
  const adDefaultLeft = window.innerWidth - 112;
  makeDraggable(floatingAd, "tasknova-float-ad-pos", { left: adDefaultLeft, top: adDefaultTop });
}

if (supportFab) {
  // Default position: directly beneath the floating ad
  const supportDefaultTop = window.innerHeight - 160;
  const supportDefaultLeft = window.innerWidth - 96;
  makeDraggable(supportFab, "tasknova-float-support-pos", { left: supportDefaultLeft, top: supportDefaultTop });

  supportFab.addEventListener("click", (e) => {
    e.preventDefault();

    if (window.Tawk_API && typeof Tawk_API.toggle === "function") {
      Tawk_API.toggle();
    }
  });
}

document.getElementById("floatingAdClose")?.addEventListener("click", (e) => {
  e.stopPropagation();
  floatingAd.style.display = "none";
});

/* ---------------------------------------------------------
   TAWK.TO VISITOR AUTO-FILL
   Pushes the signed-in user's name/email/username to Tawk so any
   chat opened from this page arrives pre-filled. Same block as
   every other reworked page.
   --------------------------------------------------------- */
function syncTawkVisitor({ fullName, email, username }) {
  const attrs = {
    name: fullName || undefined,
    email: email || undefined,
    username: username || undefined
  };

  const apply = () => {
    if (window.Tawk_API && typeof Tawk_API.setAttributes === "function") {
      Tawk_API.setAttributes(attrs, (err) => {
        if (err) console.error("Tawk setAttributes error:", err);
      });
    }
  };

  if (window.Tawk_API && typeof Tawk_API.setAttributes === "function") {
    apply();
  } else {
    window.Tawk_API = window.Tawk_API || {};
    const previousOnLoad = window.Tawk_API.onLoad;
    window.Tawk_API.onLoad = function () {
      if (typeof previousOnLoad === "function") previousOnLoad();
      apply();
    };
  }
}
let tawkSynced = false;

/* ---------------------------------------------------------
   FORMAT HELPERS
   --------------------------------------------------------- */
const nairaFormat = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2
});

function formatNaira(amount) {
  return nairaFormat.format(Number(amount) || 0);
}

function formatTime(date) {
  if (!date) return "";
  return date.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
}

function formatFullDateTime(date) {
  if (!date) return "—";
  return date.toLocaleString("en-NG", {
    day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}

// Returns "Today", "Yesterday", or a formatted date — used as the
// section heading a transaction is grouped under.
function dateGroupLabel(date) {
  if (!date) return "Earlier";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return "Today";
  if (date >= startOfYesterday) return "Yesterday";

  return date.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

/* ---------------------------------------------------------
   TRANSACTION TYPE -> ICON / LABEL
   --------------------------------------------------------- */
const TX_META = {
  deposit: { icon: "bx-download", label: "Deposit" },
  withdrawal: { icon: "bx-upload", label: "Withdrawal" },
  task_payment: { icon: "bx-briefcase", label: "Task Payment" },
  task_payout: { icon: "bx-briefcase", label: "Task Payout" },
  ad_payment: { icon: "bx-megaphone", label: "Advertisement Payment" },
  referral: { icon: "bx-user-plus", label: "Referral Reward" },
  airtime: { icon: "bx-mobile-alt", label: "Airtime Purchase" },
  data: { icon: "bx-wifi", label: "Data Purchase" },
  swap: { icon: "bx-transfer-alt", label: "Swap" },
  transfer: { icon: "bx-shuffle", label: "Transfer" },
  admin_adjustment: { icon: "bx-slider-alt", label: "Admin Adjustment" },
  refund: { icon: "bx-undo", label: "Refund" },
  decline_expense: { icon: "bx-x-circle", label: "Wrongful Decline Expense" },
  unlock_fee: { icon: "bx-lock-open-alt", label: "Unlock Fee" },
  other: { icon: "bx-dots-horizontal-rounded", label: "Other" }
};

function metaFor(type) {
  return TX_META[type] || TX_META.other;
}

/* ---------------------------------------------------------
   STATE
   --------------------------------------------------------- */
const PAGE_SIZE = 20;

let currentUser = null;
let activeFilter = "all";
let allLoadedTx = [];   // flat list of everything fetched so far, across pages
let lastVisibleDoc = null;
let hasMore = true;
let isLoading = false;

/* ---------------------------------------------------------
   DOM REFS
   --------------------------------------------------------- */
const txGroups = document.getElementById("txGroups");
const loadMoreWrap = document.getElementById("loadMoreWrap");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const filterScroll = document.getElementById("filterScroll");
const totalInValue = document.getElementById("totalInValue");
const totalOutValue = document.getElementById("totalOutValue");

// The actual set of type values every OTHER filter chip owns, read
// straight from the DOM rather than hardcoded — whatever chip markup
// transactions.html already has is the source of truth. "Other" then
// becomes a genuine catch-all (see fetchPage below) for any type not
// claimed by one of these, instead of only matching a literal type
// value of "other" — which is what silently hid admin_adjustment/
// transfer/task_payout transactions from the Other tab before.
const dedicatedChipTypes = Array.from(filterScroll.querySelectorAll(".filter-chip"))
  .map((c) => c.dataset.filter)
  .filter((v) => v && v !== "all" && v !== "other");

const userNameEl = document.getElementById("menuUserName");
const userTypeEl = document.getElementById("menuUserType");
const userAvatarEl = document.getElementById("menuUserAvatar");
const alertDot = document.getElementById("alertDot");

/* ---------------------------------------------------------
   RENDER: grouped list with expandable rows
   --------------------------------------------------------- */
function render() {
  if (!allLoadedTx.length) {
    txGroups.innerHTML = `
      <div class="tx-empty">
        <i class="bx bx-receipt"></i>
        No transactions yet.
      </div>`;
    loadMoreWrap.style.display = "none";
    return;
  }

  // Group into date buckets, preserving newest-first order.
  const groups = [];
  let currentLabel = null;
  let currentBucket = null;

  allLoadedTx.forEach((tx) => {
    const label = dateGroupLabel(tx.date);
    if (label !== currentLabel) {
      currentLabel = label;
      currentBucket = { label, rows: [] };
      groups.push(currentBucket);
    }
    currentBucket.rows.push(tx);
  });

  txGroups.innerHTML = groups.map((group) => `
    <div class="tx-date-group">
      <div class="tx-date-heading">${group.label}</div>
      <div class="tx-list">
        ${group.rows.map(renderTxItem).join("")}
      </div>
    </div>
  `).join("");

  // Wire up expand/collapse for each row (delegation would also work,
  // but explicit binding keeps this simple to follow).
  txGroups.querySelectorAll(".tx-item").forEach((item) => {
    const row = item.querySelector(".tx-row");
    row.addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      txGroups.querySelectorAll(".tx-item.open").forEach((el) => el.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });

  loadMoreWrap.style.display = hasMore ? "flex" : "none";
}

/* =========================================================
   UPDATED TRANSACTION RENDERING IN transactions_3.js
   ========================================================= */

function getTxDisplayTitle(tx) {
  if (tx.title) return tx.title;
  const meta = metaFor(tx.type);
  if ((tx.type === "data" || tx.type === "airtime") && tx.phone) {
    const netStr = tx.network ? ` (${String(tx.network).toUpperCase()})` : "";
    return `${tx.phone}${netStr}`;
  }
  return meta.label;
}

function renderTxItem(tx) {
  const kind = tx.direction === "credit" ? "credit" : tx.direction === "pending" ? "pending" : "debit";
  const meta = metaFor(tx.type);
  const sign = kind === "credit" ? "+" : kind === "pending" ? "" : "−";
  const status = tx.status || (kind === "pending" ? "pending" : "successful");
  const displayTitle = getTxDisplayTitle(tx);

  let detailsRowsHtml = "";

  if (tx.type === "data") {
    const phone = tx.phone || "N/A";
    const network = tx.network ? String(tx.network).toUpperCase() : "N/A";
    const bundleVal = tx.plan ? `${tx.plan}${tx.validity ? " (" + tx.validity + ")" : ""}` : (tx.description || "N/A");

    detailsRowsHtml = `
      <div class="tx-detail-row"><span>Type</span><span>${meta.label}</span></div>
      <div class="tx-detail-row"><span>Phone Number</span><span>${phone}</span></div>
      <div class="tx-detail-row"><span>Network</span><span>${network}</span></div>
      <div class="tx-detail-row"><span>Bundle &amp; Validity</span><span>${bundleVal}</span></div>
      <div class="tx-detail-row"><span>Date &amp; time</span><span>${formatFullDateTime(tx.date)}</span></div>
      <div class="tx-detail-row"><span>Status</span><span><span class="tx-status-badge ${status}">${status}</span></span></div>
      <div class="tx-detail-row"><span>Reference</span><span>${tx.reference || "N/A"}</span></div>
    `;
  } else if (tx.type === "airtime") {
    const phone = tx.phone || "N/A";
    const network = tx.network ? String(tx.network).toUpperCase() : "N/A";
    const rawAirtime = tx.airtimeAmount ? Number(tx.airtimeAmount) : (tx.amount ? Number(tx.amount) / 1.05 : 0);

    detailsRowsHtml = `
      <div class="tx-detail-row"><span>Type</span><span>${meta.label}</span></div>
      <div class="tx-detail-row"><span>Phone Number</span><span>${phone}</span></div>
      <div class="tx-detail-row"><span>Network</span><span>${network}</span></div>
      <div class="tx-detail-row"><span>Airtime Amount</span><span>${formatNaira(rawAirtime)}</span></div>
      <div class="tx-detail-row"><span>Date &amp; time</span><span>${formatFullDateTime(tx.date)}</span></div>
      <div class="tx-detail-row"><span>Status</span><span><span class="tx-status-badge ${status}">${status}</span></span></div>
      <div class="tx-detail-row"><span>Reference</span><span>${tx.reference || "N/A"}</span></div>
    `;
  } else {
    detailsRowsHtml = `
      <div class="tx-detail-row"><span>Type</span><span>${meta.label}</span></div>
      ${tx.bankName ? `<div class="tx-detail-row"><span>Bank Name</span><span>${tx.bankName}</span></div>` : ""}
      ${tx.accountNumber ? `<div class="tx-detail-row"><span>Account Number</span><span>${tx.accountNumber}</span></div>` : ""}
      ${tx.accountName ? `<div class="tx-detail-row"><span>Account Name</span><span>${tx.accountName}</span></div>` : ""}
      <div class="tx-detail-row"><span>Status</span><span><span class="tx-status-badge ${status}">${status}</span></span></div>
      <div class="tx-detail-row"><span>Date &amp; time</span><span>${formatFullDateTime(tx.date)}</span></div>
      ${tx.balanceType ? `<div class="tx-detail-row"><span>Balance affected</span><span>${tx.balanceType}</span></div>` : ""}
      ${tx.description ? `<div class="tx-detail-row"><span>Details</span><span>${tx.description}</span></div>` : ""}
      <div class="tx-detail-row"><span>Reference</span><span>${tx.reference || "N/A"}</span></div>
    `;
  }

  return `
    <div class="tx-item ${kind}" data-id="${tx.id}">
      <div class="tx-row">
        <div class="tx-icon"><i class="bx ${meta.icon}"></i></div>
        <div class="tx-info">
          <strong>${displayTitle}</strong>
          <span>${formatTime(tx.date)}${tx.balanceType ? " · " + tx.balanceType : ""}</span>
        </div>
        <div class="tx-amount">${sign}${formatNaira(tx.amount)}</div>
        <i class="bx bx-chevron-down tx-chevron"></i>
      </div>
      <div class="tx-detail">
        <div>
          <div class="tx-detail-inner">
            ${detailsRowsHtml}
          </div>
        </div>
      </div>
    </div>`;
}

function updateSummary() {
  let totalIn = 0;
  let totalOut = 0;
  allLoadedTx.forEach((tx) => {
    if (tx.direction === "credit") totalIn += Number(tx.amount) || 0;
    if (tx.direction === "debit") totalOut += Number(tx.amount) || 0;
  });
  totalInValue.textContent = formatNaira(totalIn);
  totalOutValue.textContent = formatNaira(totalOut);
}

/* ---------------------------------------------------------
   FETCH (paginated, filterable)
   users/{uid}/transactions — ordered newest first.
   Filtering by a specific type requires a composite index on
   (type asc, createdAt desc); Firestore will prompt you with a
   direct link to create it the first time that query runs.
   --------------------------------------------------------- */
function toTxRow(d) {
  const data = d.data();
  return {
    id: d.id,
    title: data.title || null,
    type: data.type || "other",
    direction: data.direction || "debit",
    amount: data.amount || 0,
    status: data.status || "",
    balanceType: data.balanceType || "",
    description: data.description || "",
    reference: data.reference || "",
    phone: data.phone || data.phoneNumber || "",
    network: data.network || data.networkName || "",
    plan: data.plan || data.planName || data.bundle || "",
    validity: data.validity || "",
    airtimeAmount: data.airtimeAmount || data.rawAmount || null,
    date: data.createdAt?.toDate ? data.createdAt.toDate() : null,
    // Add bank and account details mapping
    bankName: data.bankName || "",
    accountNumber: data.accountNumber || "",
    accountName: data.accountName || ""
  };
}

async function fetchPage(reset = false) {
  if (!currentUser || isLoading) return;
  isLoading = true;
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.disabled = true;

  if (reset) {
    allLoadedTx = [];
    lastVisibleDoc = null;
    hasMore = true;
    txGroups.innerHTML = `<div class="tx-list"><div class="tx-skeleton"></div><div class="tx-skeleton"></div><div class="tx-skeleton"></div></div>`;
  }

  try {
    const baseRef = collection(db, "users", currentUser.uid, "transactions");

    if (activeFilter === "other") {
      // "Other" has no native Firestore query — there are already 11
      // dedicated chip types (more than Firestore's not-in element cap
      // ever reliably supports, and that number only grows over time),
      // so this paginates the plain, unfiltered stream and discards
      // anything that belongs to a dedicated chip client-side instead.
      // A single "page" of visible Other results can take more than one
      // Firestore read round if Other entries are sparse — capped at a
      // few rounds per click so a mostly-empty Other bucket can't burn
      // through a large read budget in one tap.
      let collected = 0;
      let rounds = 0;
      while (collected < PAGE_SIZE && hasMore && rounds < 5) {
        rounds++;
        const constraints = [orderBy("createdAt", "desc")];
        if (lastVisibleDoc) constraints.push(startAfter(lastVisibleDoc));
        constraints.push(limit(PAGE_SIZE));

        const snap = await getDocs(query(baseRef, ...constraints));
        if (snap.empty) { hasMore = false; break; }

        lastVisibleDoc = snap.docs[snap.docs.length - 1];
        hasMore = snap.docs.length === PAGE_SIZE;

        snap.docs.forEach((d) => {
          const row = toTxRow(d);
          if (!dedicatedChipTypes.includes(row.type)) {
            allLoadedTx.push(row);
            collected++;
          }
        });
      }
    } else {
      const constraints = [];
      if (activeFilter !== "all") constraints.push(where("type", "==", activeFilter));
      constraints.push(orderBy("createdAt", "desc"));
      if (lastVisibleDoc) constraints.push(startAfter(lastVisibleDoc));
      constraints.push(limit(PAGE_SIZE));

      const snap = await getDocs(query(baseRef, ...constraints));
      if (snap.empty) {
        hasMore = false;
      } else {
        lastVisibleDoc = snap.docs[snap.docs.length - 1];
        hasMore = snap.docs.length === PAGE_SIZE;
        snap.docs.forEach((d) => allLoadedTx.push(toTxRow(d)));
      }
    }

    render();
    updateSummary();
  } catch (err) {
    console.error("Transaction history fetch error:", err);
    txGroups.innerHTML = `<div class="tx-empty"><i class="bx bx-error-circle"></i>Couldn't load transactions. Please try again.</div>`;
  } finally {
    isLoading = false;
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  }
}

loadMoreBtn.addEventListener("click", () => fetchPage(false));

/* ---------------------------------------------------------
   FILTER CHIPS
   --------------------------------------------------------- */
filterScroll.querySelectorAll(".filter-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chip.dataset.filter === activeFilter) return;
    filterScroll.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.dataset.filter;
    fetchPage(true);
  });
});

/* ---------------------------------------------------------
   AUTH GUARD
   --------------------------------------------------------- */
let unsubscribeUserDoc = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (!user.emailVerified) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;

  if (unsubscribeUserDoc) unsubscribeUserDoc();

  unsubscribeUserDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    const fullName = data.fullName || "TaskNOVA User";
    const initial = fullName.trim().charAt(0).toUpperCase() || "T";

    if (userNameEl) userNameEl.textContent = fullName || user.email;
    // accountType/institutionAbbr are retired site-wide (no more
    // Student/Teacher/None distinction) — show the username instead.
    if (userTypeEl) userTypeEl.textContent = data.username ? "@" + data.username : user.email;
    if (userAvatarEl) userAvatarEl.textContent = initial;

    if (!tawkSynced) {
      tawkSynced = true;
      syncTawkVisitor({ fullName: data.fullName, email: user.email, username: data.username });
    }
  }, (err) => {
    console.error("User doc listener error:", err);
  });

  // Lightweight unread check — existence only (limit 1), not a count.
  // Shows/hides the header dot, nothing more.
  const unreadCheckQuery = query(
    collection(db, "users", user.uid, "notifications"),
    where("read", "==", false),
    limit(1)
  );
  onSnapshot(unreadCheckQuery, (snap) => {
    alertDot?.classList.toggle("show", !snap.empty);
  }, (err) => {
    console.error("Alert dot listener error:", err);
  });

  fetchPage(true);
});

/* ===========================================================
   NOTES
   ===========================================================
   - The "Other" tab bug: it was querying where("type","==","other")
     literally, so any transaction whose type wasn't the literal
     string "other" never matched — even though the same type showed
     up fine under "All" (metaFor() falls back to the Other icon/
     label for display purposes without needing the stored value to
     actually equal "other"). The admin rework introduced several
     real type values that fell into exactly this trap:
     admin_adjustment (admin/manual-transactions.js's Increment/
     Decrement), transfer (same page's user-to-user Transfer), and
     task_payout (admin/reports-support.js's Force Pay).

     Fixed by making "Other" a genuine catch-all, but NOT via a
     Firestore not-in query — transactions.html already has 11
     dedicated chips (deposit, withdrawal, task_payment, ad_payment,
     referral, airtime, data, swap, refund, decline_expense,
     unlock_fee), past what not-in reliably supports and only
     growing as more types get added later. Instead, selecting Other
     paginates the plain unfiltered stream and discards anything
     matching a dedicated chip's type client-side (dedicatedChipTypes,
     read live from each chip's data-filter attribute). This costs
     more reads when Other entries are sparse relative to everything
     else — capped at 5 fetch rounds per "Load More" click so a
     mostly-empty Other bucket can't trigger a large read burst; if
     Other is extremely rare, hitting Load More more than once to
     fill a screen is an acceptable trade-off for correctness.

   - Two of those 11 dedicated chips — airtime and data — are likely
     permanently dead now that Veltrix was removed entirely: it was
     an external widget that never wrote to TaskNOVA's Firestore in
     the first place, so nothing has ever written type:"airtime" or
     type:"data" transactions, and nothing will going forward either.
     Not removed here since that's an HTML/content decision beyond
     fixing the Other bug — flagging in case those chips are worth
     deleting from transactions.html next time it's touched.
   =========================================================== */
