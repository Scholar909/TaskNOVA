/* =========================================================
   TASKNOVA — TRANSACTION HISTORY PAGE LOGIC
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
   DEFAULT BANNER -> SKRED CONTACT
   (Used whenever a paid banner slot is empty. Replace SKRED_ADVERTISE_LINK
   with the Admin's advertising-specific Skred link if it differs from support.)
   --------------------------------------------------------- */
const SKRED_ADVERTISE_LINK = "https://invite.skred.mobi/3vKxWxzcRy62KdTbhD2VFg.VHGNJ3Z2ik7CZ8OWWE6Ndr_Tr2gZy0w3LTlaXdQueVg";

document.querySelectorAll("[data-default-ad]").forEach((el) => {
  el.addEventListener("click", () => {
    window.open(SKRED_ADVERTISE_LINK, "_blank", "noopener");
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
}

document.getElementById("floatingAdClose")?.addEventListener("click", (e) => {
  e.stopPropagation();
  floatingAd.style.display = "none";
});

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
  ad_payment: { icon: "bx-megaphone", label: "Advertisement Payment" },
  referral: { icon: "bx-user-plus", label: "Referral Reward" },
  airtime: { icon: "bx-mobile-alt", label: "Airtime Purchase" },
  data: { icon: "bx-wifi", label: "Data Purchase" },
  swap: { icon: "bx-transfer-alt", label: "Swap" },
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

const userNameEl = document.getElementById("menuUserName");
const userTypeEl = document.getElementById("menuUserType");
const userAvatarEl = document.getElementById("menuUserAvatar");
const alertDot = document.getElementById("alertDot");
const removeAdsStatus = document.getElementById("removeAdsStatus");

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

function renderTxItem(tx) {
  const kind = tx.direction === "credit" ? "credit" : tx.direction === "pending" ? "pending" : "debit";
  const meta = metaFor(tx.type);
  const sign = kind === "credit" ? "+" : kind === "pending" ? "" : "−";
  const status = tx.status || (kind === "pending" ? "pending" : "successful");

  return `
    <div class="tx-item ${kind}" data-id="${tx.id}">
      <div class="tx-row">
        <div class="tx-icon"><i class="bx ${meta.icon}"></i></div>
        <div class="tx-info">
          <strong>${tx.title || meta.label}</strong>
          <span>${formatTime(tx.date)}${tx.balanceType ? " · " + tx.balanceType : ""}</span>
        </div>
        <div class="tx-amount">${sign}${formatNaira(tx.amount)}</div>
        <i class="bx bx-chevron-down tx-chevron"></i>
      </div>
      <div class="tx-detail">
        <div>
          <div class="tx-detail-inner">
            <div class="tx-detail-row"><span>Type</span><span>${meta.label}</span></div>
            <div class="tx-detail-row"><span>Status</span><span><span class="tx-status-badge ${status}">${status}</span></span></div>
            <div class="tx-detail-row"><span>Date &amp; time</span><span>${formatFullDateTime(tx.date)}</span></div>
            ${tx.balanceType ? `<div class="tx-detail-row"><span>Balance affected</span><span>${tx.balanceType}</span></div>` : ""}
            ${tx.description ? `<div class="tx-detail-row"><span>Details</span><span>${tx.description}</span></div>` : ""}
            ${tx.reference ? `<div class="tx-detail-row"><span>Reference</span><span>${tx.reference}</span></div>` : ""}
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
   Filtering by type requires a composite index on
   (type asc, createdAt desc); Firestore will prompt you with
   a direct link to create it the first time this query runs.
   --------------------------------------------------------- */
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
    const constraints = [];

    if (activeFilter !== "all") {
      constraints.push(where("type", "==", activeFilter));
    }
    constraints.push(orderBy("createdAt", "desc"));
    if (lastVisibleDoc) constraints.push(startAfter(lastVisibleDoc));
    constraints.push(limit(PAGE_SIZE));

    const snap = await getDocs(query(baseRef, ...constraints));

    if (snap.empty) {
      hasMore = false;
    } else {
      lastVisibleDoc = snap.docs[snap.docs.length - 1];
      hasMore = snap.docs.length === PAGE_SIZE;

      snap.docs.forEach((d) => {
        const data = d.data();
        allLoadedTx.push({
          id: d.id,
          title: data.title || null,
          type: data.type || "other",
          direction: data.direction || "debit",
          amount: data.amount || 0,
          status: data.status || "",
          balanceType: data.balanceType || "",
          description: data.description || "",
          reference: data.reference || "",
          date: data.createdAt?.toDate ? data.createdAt.toDate() : null
        });
      });
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
    if (userTypeEl) userTypeEl.textContent = data.accountType ? data.accountType + (data.institutionAbbr ? " · " + data.institutionAbbr : "") : user.email;
    if (userAvatarEl) userAvatarEl.textContent = initial;
    if (removeAdsStatus) removeAdsStatus.style.display = data.popupRemovalActive ? "inline-flex" : "none";
  }, (err) => {
    console.error("User doc listener error:", err);
  });

  alertDot?.classList.remove("show");

  fetchPage(true);
});
