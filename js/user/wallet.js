/* =========================================================
   TASKNOVA — WALLET PAGE LOGIC
   Firebase v12.17.1 modular SDK

   Corrections applied this pass (see chat for full context):
   1. Paystack replaced with Flutterwave throughout — inline
      checkout, bank-account resolve, and withdrawal transfers.
   2. Every secret-key-requiring call now goes through a Supabase
      Edge Function (js/supabase.js) instead of a Firebase Cloud
      Function — none of these functions are deployed yet, see
      the BACKEND NOTES at the bottom.
   3. Bank list for withdrawals is now fetched live from Flutterwave
      (via Supabase) instead of a hardcoded Paystack-code list,
      since the two processors use entirely different bank codes.
   4. accountType/institutionAbbr display removed from the menu
      subtitle, replaced with the username, per the site-wide
      removal of Student/Teacher/None + institution.
   5. Tawk.to visitor auto-fill added (same block as home.js).
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
  runTransaction,
  collection,
  where,
  setDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { callEdgeFunction } from "../supabase.js";

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
   chat opened from this page arrives pre-filled instead of asking
   for them again. Same block as home.js — copy it onto every
   other page's auth guard as they're reworked.
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
   CONFIG — replace these with your real values before launch
   --------------------------------------------------------- */
const FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK-ef9ca50755f30d40b5d428f8d48d3cde-X";

// Supabase Edge Function names — secret keys (Flutterwave secret key,
// etc.) live inside these functions' server-side environment only,
// never here. See the BACKEND NOTES at the end of this file for what
// each one needs to do; none of them are deployed yet.
const EDGE_FN = {
  verifyDeposit: "verify-flutterwave-deposit",
  listBanks: "list-banks",
  resolveAccount: "resolve-bank-account",
  requestWithdrawal: "request-withdrawal",
  createVirtualAccount: "create-flutterwave-virtual-account",
  cancelVirtualAccount: "cancel-flutterwave-virtual-account"
};

// Flutterwave's inline checkout script — injected here instead of in
// wallet.html's <head> so this page works without an HTML edit.
(function loadFlutterwaveScript() {
  if (document.querySelector('script[data-flutterwave-inline]')) return;
  const script = document.createElement("script");
  script.src = "https://checkout.flutterwave.com/v3.js";
  script.dataset.flutterwaveInline = "true";
  script.async = true;
  document.head.appendChild(script);
})();

const nairaFormat = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2
});

function formatNaira(amount) {
  return nairaFormat.format(Number(amount) || 0);
}

function formatRelativeTime(date) {
  if (!date) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function showPanelMsg(el, type, text) {
  el.className = "panel-msg show " + type;
  const icon = type === "error" ? "bx-error-circle" : "bx-check-circle";
  el.innerHTML = `<i class="bx ${icon}"></i><span>${text}</span>`;
}

function clearPanelMsg(el) {
  el.className = "panel-msg";
  el.innerHTML = "";
}

function setBtnLoading(btn, isLoading) {
  btn.classList.toggle("loading", isLoading);
  btn.disabled = isLoading;
}

/* ---------------------------------------------------------
   NIGERIAN BANK NAMES (for the manual-transfer sender-bank field
   only — that field just records what the user typed for admin's
   review, so it needs no bank code, unlike the withdrawal bank
   select below).
   --------------------------------------------------------- */
const NIGERIAN_BANK_NAMES = [
  "Access Bank", "Citibank Nigeria", "Ecobank Nigeria", "Fidelity Bank",
  "First Bank of Nigeria", "First City Monument Bank (FCMB)", "Globus Bank",
  "Guaranty Trust Bank (GTBank)", "Heritage Bank", "Jaiz Bank", "Keystone Bank",
  "Kuda Microfinance Bank", "Moniepoint MFB", "Opay (Paycom)", "Palmpay",
  "Parallex Bank", "Polaris Bank", "Premium Trust Bank", "Providus Bank",
  "Stanbic IBTC Bank", "Standard Chartered Bank", "Sterling Bank",
  "SunTrust Bank", "Titan Trust Bank", "Union Bank of Nigeria",
  "United Bank for Africa (UBA)", "Unity Bank", "Wema Bank / ALAT", "Zenith Bank"
];

const bankSelect = document.getElementById("bankSelect");
const bankCodeInput = document.getElementById("bankCode");

// The withdrawal bank list has to come from Flutterwave live (via Supabase)
// rather than a hardcoded list — Flutterwave's bank codes are completely
// different from Paystack's, so any static Paystack-code list here would
// silently send withdrawals to the wrong bank. Called once a signed-in
// user is available (see onAuthStateChanged below).
async function loadWithdrawalBanks() {
  bankSelect.innerHTML = `<option value="" disabled selected>Loading banks…</option>`;
  bankSelect.disabled = true;
  try {
    const idToken = await currentUser.getIdToken();
    const banks = await callEdgeFunction(EDGE_FN.listBanks, {}, idToken);
    bankSelect.innerHTML = `<option value="" disabled selected>Select your bank</option>`;
    (banks || []).forEach((bank) => {
      const opt = document.createElement("option");
      opt.value = bank.code;
      opt.textContent = bank.name;
      bankSelect.appendChild(opt);
    });
    bankSelect.disabled = false;
  } catch (err) {
    console.error("Load banks error:", err);
    bankSelect.innerHTML = `<option value="" disabled selected>Bank list unavailable — refresh to retry</option>`;
  }
}

bankSelect.addEventListener("change", () => {
  bankCodeInput.value = bankSelect.value;
  // Bank changed — any previous account resolution is now stale.
  resetAccountResolution();
});

/* ---------------------------------------------------------
   WALLET TABS (Deposit / Withdraw / Swap)
   --------------------------------------------------------- */
const walletTabs = document.getElementById("walletTabs");
const walletViewport = document.getElementById("walletViewport");
const walletSlider = document.getElementById("walletSlider");
const depositForm = document.getElementById("depositForm");
const withdrawForm = document.getElementById("withdrawForm");
const swapForm = document.getElementById("swapForm");

function syncWalletHeight() {
  const active = walletTabs.dataset.active;
  const panelMap = { deposit: depositForm, withdraw: withdrawForm, swap: swapForm };
  const activePanel = panelMap[active];
  walletViewport.style.height = activePanel.offsetHeight + "px";
}

function goToWalletTab(target) {
  walletTabs.dataset.active = target;
  walletViewport.dataset.active = target;
  walletTabs.querySelectorAll(".wallet-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.target === target);
  });
  syncWalletHeight();
}

walletTabs.querySelectorAll(".wallet-tab").forEach((tab) => {
  tab.addEventListener("click", () => goToWalletTab(tab.dataset.target));
});

window.addEventListener("resize", syncWalletHeight);
window.addEventListener("load", syncWalletHeight);
const walletResizeObserver = new ResizeObserver(() => {
  syncWalletHeight();
});

walletResizeObserver.observe(depositForm);
walletResizeObserver.observe(withdrawForm);
walletResizeObserver.observe(swapForm);
setTimeout(syncWalletHeight, 80);

/* ---------------------------------------------------------
   LIVE BALANCES + OUTSTANDING (also feeds withdraw/swap limits)
   --------------------------------------------------------- */
const depositValueEl = document.getElementById("depositValue");
const earnedValueEl = document.getElementById("earnedValue");
const outstandingBanner = document.getElementById("outstandingBanner");
const outstandingText = document.getElementById("outstandingText");
const depositOutstandingNote = document.getElementById("depositOutstandingNote");
const swapAvailableNote = document.getElementById("swapAvailableNote");

/* ---------------------------------------------------------
   INACTIVITY DELETION WARNING BANNER
   Built dynamically (rather than assuming a specific element
   exists in wallet.html) and anchored right next to the existing
   outstanding-balance banner, whose markup this mirrors. This
   page only DISPLAYS the warning — the actual 1-month-inactive
   check and the 14-day countdown to deletion are computed by a
   Supabase scheduled function, not by this page. See the NOTES
   at the end of this file for that job's full spec.
   --------------------------------------------------------- */
let deletionWarningBanner = document.getElementById("deletionWarningBanner");
if (!deletionWarningBanner) {
  deletionWarningBanner = document.createElement("div");
  deletionWarningBanner.id = "deletionWarningBanner";
  deletionWarningBanner.style.cssText = [
    "display:none", "align-items:center", "gap:10px", "padding:12px 16px",
    "margin-bottom:14px", "border-radius:14px",
    "background:color-mix(in srgb, var(--danger) 10%, transparent)",
    "border:1px solid color-mix(in srgb, var(--danger) 35%, transparent)",
    "color:var(--danger)", "font-size:.82rem", "line-height:1.5"
  ].join(";");
  deletionWarningBanner.innerHTML = `<i class="bx bx-error-circle" style="font-size:1.2rem;flex-shrink:0;"></i><span id="deletionWarningText"></span>`;

  const anchor = document.getElementById("outstandingBanner");
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(deletionWarningBanner, anchor);
  } else {
    (document.querySelector("main .container") || document.body).prepend(deletionWarningBanner);
  }
}
const deletionWarningText = document.getElementById("deletionWarningText");

const userNameEl = document.getElementById("menuUserName");
const userTypeEl = document.getElementById("menuUserType");
const userAvatarEl = document.getElementById("menuUserAvatar");
const alertDot = document.getElementById("alertDot");

let currentUser = null;
let currentUserData = { fullName: "", username: "" };
let currentWallet = { deposit: 0, earned: 0 };
let currentOutstanding = 0;

let unsubscribeUserDoc = null;
let unsubscribeTx = null;

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
  loadWithdrawalBanks();

  if (unsubscribeUserDoc) unsubscribeUserDoc();
  if (unsubscribeTx) unsubscribeTx();

  unsubscribeUserDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    const fullName = data.fullName || "TaskNOVA User";
    const initial = fullName.trim().charAt(0).toUpperCase() || "T";

    currentUserData.fullName = data.fullName || "";
    currentUserData.username = data.username || "";

    if (userNameEl) userNameEl.textContent = fullName || user.email;
    // accountType/institutionAbbr are retired site-wide (no more
    // Student/Teacher/None distinction) — show the username instead.
    if (userTypeEl) userTypeEl.textContent = data.username ? "@" + data.username : user.email;
    if (userAvatarEl) userAvatarEl.textContent = initial;

    currentWallet.deposit = data.wallet?.deposit ?? 0;
    currentWallet.earned = data.wallet?.earned ?? 0;
    currentOutstanding = data.outstanding ?? 0;

    updateWithdrawSubmitState();

    if (depositValueEl) { depositValueEl.classList.remove("skeleton"); depositValueEl.textContent = formatNaira(currentWallet.deposit); }
    if (earnedValueEl) { earnedValueEl.classList.remove("skeleton"); earnedValueEl.textContent = formatNaira(currentWallet.earned); }

    if (currentOutstanding > 0) {
      outstandingBanner.classList.add("show");
      outstandingText.textContent = `You have an outstanding balance of ${formatNaira(currentOutstanding)}. Deposits and swaps clear this first.`;
      depositOutstandingNote.textContent = `Your first ${formatNaira(currentOutstanding)} will clear your outstanding balance automatically.`;
    } else {
      outstandingBanner.classList.remove("show");
      depositOutstandingNote.textContent = "";
    }

    // Inactivity deletion warning — deletionWarningAt is set by the (not
    // yet built) Supabase scheduled function described in this file's
    // NOTES, once wallet.earned has gone a month without increasing.
    const deletionWarningAt = data.deletionWarningAt?.toDate ? data.deletionWarningAt.toDate() : null;
    if (deletionWarningAt) {
      const daysSinceWarning = Math.floor((Date.now() - deletionWarningAt.getTime()) / 86400000);
      const daysLeft = Math.max(0, 14 - daysSinceWarning);
      deletionWarningBanner.style.display = "flex";
      deletionWarningText.textContent = daysLeft > 0
        ? `Your account has been inactive and will be deleted in ${daysLeft} day${daysLeft === 1 ? "" : "s"} unless your Earned Balance increases. Complete a task to keep your account active.`
        : "Your account is scheduled for deletion due to inactivity. Complete a task now to keep it active.";
    } else {
      deletionWarningBanner.style.display = "none";
    }

    swapAvailableNote.textContent = `Available: ${formatNaira(currentWallet.earned)}`;
    updateSwapPreview();

    if (!tawkSynced) {
      tawkSynced = true;
      syncTawkVisitor({ fullName: data.fullName, email: user.email, username: data.username });
    }
  }, (err) => {
    console.error("Wallet listener error:", err);
  });

    // Replaces recent transactions listener with the manual verification card
  renderManualVerificationSection();


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
});

// Renders the Manual Reference Input UI directly into the #txList element
function renderManualVerificationSection() {
  const container = document.getElementById("txList");
  if (!container) return;

  container.innerHTML = `
    <div style="padding: 22px 20px; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); box-shadow: var(--shadow-soft); display: grid; gap: 14px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <i class="bx bx-search-alt" style="font-size: 1.25rem; color: var(--primary);"></i>
        <strong style="font-size: 0.95rem; letter-spacing: -0.01em;">Verify Missing Payment</strong>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-soft); line-height: 1.55;">
        Did you complete a transfer or payment that hasn't been credited yet? Enter your transaction reference below to verify manually.
      </p>
      <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
        <div class="amount-input-wrap" style="flex: 1; min-width: 220px;">
          <input 
            type="text" 
            id="manualRefInput" 
            placeholder="Enter transaction reference (e.g. tx_ref)" 
            style="padding-left: 14px;"
          />
        </div>
        <button id="verifyManualBtn" type="button" class="btn btn-primary" style="flex: 0 0 auto; width: auto; min-height: 52px; padding: 0 22px;">
          <span class="btn-spinner"></span>
          <span class="btn-label">Verify Payment</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById("verifyManualBtn")?.addEventListener("click", handleManualVerification);
}

// Handler for manual verification
async function handleManualVerification() {
  const refInput = document.getElementById("manualRefInput");
  const verifyBtn = document.getElementById("verifyManualBtn");
  const txRef = refInput ? refInput.value.trim() : "";

  if (!txRef) {
    alert("Please enter a valid transaction reference.");
    return;
  }

  if (verifyBtn) setBtnLoading(verifyBtn, true);

  await verifyTransaction(txRef, null);

  if (verifyBtn) setBtnLoading(verifyBtn, false);
}


/* ===========================================================
   DEPOSIT — three methods sharing one panel + one panel-msg
   =========================================================== */
const depositMethodSelect = document.getElementById("depositMethod");
const depositMethodNote = document.getElementById("depositMethodNote");
const methodAutomaticEl = document.getElementById("methodAutomatic");
const methodVirtualEl = document.getElementById("methodVirtual");
const methodManualEl = document.getElementById("methodManual");

/* ===== METHOD 1: INSTANT AUTOMATIC — Flutterwave Inline Checkout ===== */
const depositAmountInput = document.getElementById("depositAmount");
const depositChips = document.getElementById("depositChips");
const depositMsg = document.getElementById("depositMsg");
const depositSubmit = document.getElementById("depositSubmit");

depositChips.querySelectorAll(".amount-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    depositChips.querySelectorAll(".amount-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    depositAmountInput.value = chip.dataset.amount;
  });
});

depositAmountInput.addEventListener("input", () => {
  depositChips.querySelectorAll(".amount-chip").forEach((c) => {
    c.classList.toggle("active", c.dataset.amount === depositAmountInput.value);
  });
});

depositForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (depositMethodSelect.value !== "automatic") return;

  clearPanelMsg(depositMsg);
  const amount = Number(depositAmountInput.value);
  if (!amount || amount < 100) {
    showPanelMsg(depositMsg, "error", "Enter an amount of at least ₦100.");
    return;
  }

  if (!currentUser) return;

  payWithFlutterwave(amount, currentUser.email, currentUser.uid);
});

function payWithFlutterwave(amount, userEmail, userId) {
  const txRef = `${userId}_${Date.now()}`;

  if (typeof FlutterwaveCheckout === "undefined") {
    showPanelMsg(depositMsg, "error", "Payment popup failed to load. Check your connection and try again.");
    return;
  }

  setBtnLoading(depositSubmit, true);

  FlutterwaveCheckout({
    public_key: FLUTTERWAVE_PUBLIC_KEY, // Uses configured FLUTTERWAVE_PUBLIC_KEY
    tx_ref: txRef,
    amount: amount,
    currency: "NGN",
    payment_options: "card,banktransfer,ussd",
    meta: {
      user_id: userId,
    },
    customer: {
      email: userEmail,
    },
    callback: async function (data) {
      await verifyTransaction(data.tx_ref, data.transaction_id);
    },
    onclose: function () {
      setBtnLoading(depositSubmit, false);
    },
  });
}

// Function to call Supabase Edge Function
async function verifyTransaction(txRef, transactionId = null) {
  try {
    const response = await fetch("https://esvmdzsnvcjfsnoznyfb.supabase.co/functions/v1/verify-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tx_ref: txRef, transaction_id: transactionId }),
    });

    const result = await response.json();
    if (response.ok) {
      alert(`Success: ${result.message}`);
      window.location.reload();
    } else {
      alert(`Verification failed: ${result.error}`);
    }
  } catch (err) {
    alert("Network error while verifying payment.");
  }
}

/* ===== METHOD 2: MANUAL AUTOMATIC — temporary Flutterwave virtual account =====
   User transfers to a one-time virtual account. Flutterwave's webhook tells
   our backend when the transfer lands; the backend flips a Firestore doc's
   status, which this page listens to in real time — no "I've Paid" button,
   no polling from the client. See BACKEND NOTES at the bottom. */
const virtualAmountInput = document.getElementById("virtualAmount");
const virtualProceedBtn = document.getElementById("virtualProceedBtn");
const vmStepAmount = document.getElementById("vmStepAmount");
const vmStepPending = document.getElementById("vmStepPending");
const vmCountdown = document.getElementById("vmCountdown");
const vmCountdownValue = document.getElementById("vmCountdownValue");
const vmBankName = document.getElementById("vmBankName");
const vmAccountNumber = document.getElementById("vmAccountNumber");
const vmAccountName = document.getElementById("vmAccountName");
const vmAmount = document.getElementById("vmAmount");
const vmStatus = document.getElementById("vmStatus");
const virtualCancelBtn = document.getElementById("virtualCancelBtn");

let vmTimerInterval = null;
let vmUnsubscribe = null;
let vmExpiresAt = null;
let vmReference = null;
let vmSettled = false;

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function startVmCountdown(expiresAt) {
  clearInterval(vmTimerInterval);
  vmExpiresAt = expiresAt;

  const tick = () => {
    const remaining = vmExpiresAt.getTime() - Date.now();
    if (remaining <= 0) {
      vmCountdownValue.textContent = "0:00";
      vmCountdown.classList.add("warn");
      clearInterval(vmTimerInterval);
      if (!vmSettled) handleVmOutcome("expired");
      return;
    }
    vmCountdownValue.textContent = formatCountdown(remaining);
    vmCountdown.classList.toggle("warn", remaining < 60000);
  };

  tick();
  vmTimerInterval = setInterval(tick, 1000);
}

function stopVmWatchers() {
  clearInterval(vmTimerInterval);
  vmTimerInterval = null;
  if (vmUnsubscribe) { vmUnsubscribe(); vmUnsubscribe = null; }
}

function resetVirtualPanel() {
  stopVmWatchers();
  vmReference = null;
  vmSettled = false;
  vmStepPending.style.display = "none";
  vmStepAmount.style.display = "";
  vmCountdown.classList.remove("warn");
  vmStatus.className = "dm-status";
  vmStatus.innerHTML = `<i class="bx bx-loader-alt bx-spin"></i> Waiting for your transfer…`;
  requestAnimationFrame(syncWalletHeight);
}

function handleVmOutcome(outcome) {
  // outcome: "successful" | "failed" | "expired"
  vmSettled = true;
  stopVmWatchers();

  if (outcome === "successful") {
    vmStatus.className = "dm-status success";
    vmStatus.innerHTML = `<i class="bx bx-check-circle"></i> Payment successful — your wallet has been credited.`;
  } else {
    vmStatus.className = "dm-status fail";
    vmStatus.innerHTML = outcome === "expired"
      ? `<i class="bx bx-x-circle"></i> This virtual account expired before payment was received.`
      : `<i class="bx bx-x-circle"></i> Payment wasn't received — please try again.`;
  }

  setTimeout(() => { window.location.href = "transactions.html"; }, 1800);
}

virtualProceedBtn.addEventListener("click", async () => {
  clearPanelMsg(depositMsg);
  const amount = Number(virtualAmountInput.value);
  if (!amount || amount < 100) {
    showPanelMsg(depositMsg, "error", "Enter an amount of at least ₦100.");
    return;
  }
  if (!currentUser) return;

  setBtnLoading(virtualProceedBtn, true);

  try {
    const idToken = await currentUser.getIdToken();
    const result = await callEdgeFunction(EDGE_FN.createVirtualAccount, { amount }, idToken);

    vmReference = result.reference;
    vmSettled = false;
    vmBankName.textContent = result.bankName || "—";
    vmAccountNumber.textContent = result.accountNumber || "—";
    vmAccountName.textContent = result.accountName || "—";
    vmAmount.textContent = formatNaira(amount);

    vmStepAmount.style.display = "none";
    vmStepPending.style.display = "";
    startVmCountdown(new Date(result.expiresAt));

    // The backend (webhook handler) owns this doc's lifecycle — see
    // BACKEND NOTES. We only ever read it.
    vmUnsubscribe = onSnapshot(doc(db, "virtualAccountPayments", vmReference), (snap) => {
      const status = snap.data()?.status;
      if (!vmSettled && (status === "successful" || status === "failed" || status === "expired")) {
        handleVmOutcome(status);
      }
    }, (err) => {
      console.error("Virtual account status listener error:", err);
    });

    requestAnimationFrame(syncWalletHeight);
  } catch (err) {
    console.error("Create virtual account error:", err);
    showPanelMsg(depositMsg, "error", err.message || "Something went wrong. Please try again.");
  } finally {
    setBtnLoading(virtualProceedBtn, false);
  }
});

virtualCancelBtn.addEventListener("click", async () => {
  const referenceToCancel = vmReference;
  resetVirtualPanel();
  virtualAmountInput.value = "";

  if (referenceToCancel && currentUser) {
    try {
      const idToken = await currentUser.getIdToken();
      await callEdgeFunction(EDGE_FN.cancelVirtualAccount, { reference: referenceToCancel }, idToken);
    } catch (err) {
      console.error("Cancel virtual account error:", err);
    }
  }
});

/* ===== METHOD 3: MANUAL TRANSFER — admin-approved bank transfer =====
   No external API involved — this only ever creates a "pending_review"
   record for an admin to confirm against TaskNOVA's real bank statement. */
const manualAmountInput = document.getElementById("manualAmount");
const manualProceedBtn = document.getElementById("manualProceedBtn");
const mtStepAmount = document.getElementById("mtStepAmount");
const mtStepPending = document.getElementById("mtStepPending");
const mtBankName = document.getElementById("mtBankName");
const mtAccountNumber = document.getElementById("mtAccountNumber");
const mtAccountName = document.getElementById("mtAccountName");
const mtTotalAmount = document.getElementById("mtTotalAmount");
const mtSenderBank = document.getElementById("mtSenderBank");
const mtSenderName = document.getElementById("mtSenderName");
const manualPaidBtn = document.getElementById("manualPaidBtn");
const manualCancelBtn = document.getElementById("manualCancelBtn");

const MANUAL_TRANSFER_FEE = 20;
let manualDestinationBank = null; // admin-configured, loaded from Firestore
let manualPendingAmount = 0;

NIGERIAN_BANK_NAMES.forEach((name) => {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  mtSenderBank.appendChild(opt);
});

// TaskNOVA's receiving bank account for manual transfers — set by an admin
// in Firestore at settings/manualTransferBank { bankName, accountNumber, accountName }.
onSnapshot(doc(db, "settings", "manualTransferBank"), (snap) => {
  manualDestinationBank = snap.exists() ? snap.data() : null;
}, (err) => {
  console.error("Manual transfer bank details listener error:", err);
});

function updateManualPaidState() {
  manualPaidBtn.disabled = !mtSenderBank.value || !mtSenderName.value.trim();
}
mtSenderBank.addEventListener("change", updateManualPaidState);
mtSenderName.addEventListener("input", updateManualPaidState);

function resetManualPanel() {
  mtStepPending.style.display = "none";
  mtStepAmount.style.display = "";
  mtSenderBank.value = "";
  mtSenderName.value = "";
  updateManualPaidState();
  requestAnimationFrame(syncWalletHeight);
}

manualProceedBtn.addEventListener("click", () => {
  clearPanelMsg(depositMsg);
  const amount = Number(manualAmountInput.value);
  if (!amount || amount < 100) {
    showPanelMsg(depositMsg, "error", "Enter an amount of at least ₦100.");
    return;
  }
  if (!manualDestinationBank) {
    showPanelMsg(depositMsg, "error", "Manual transfer isn't set up yet — please try another method or contact support.");
    return;
  }

  manualPendingAmount = amount;
  mtBankName.textContent = manualDestinationBank.bankName || "—";
  mtAccountNumber.textContent = manualDestinationBank.accountNumber || "—";
  mtAccountName.textContent = manualDestinationBank.accountName || "—";
  mtTotalAmount.textContent = formatNaira(amount + MANUAL_TRANSFER_FEE);

  mtStepAmount.style.display = "none";
  mtStepPending.style.display = "";
  updateManualPaidState();
  requestAnimationFrame(syncWalletHeight);
});

manualCancelBtn.addEventListener("click", () => {
  resetManualPanel();
  manualAmountInput.value = "";
});

manualPaidBtn.addEventListener("click", async () => {
  if (!currentUser || manualPaidBtn.disabled) return;

  setBtnLoading(manualPaidBtn, true);

  try {
    const depositRef = doc(collection(db, "manualDeposits"));
    await setDoc(depositRef, {
      uid: currentUser.uid,
      amount: manualPendingAmount,
      fee: MANUAL_TRANSFER_FEE,
      totalExpected: manualPendingAmount + MANUAL_TRANSFER_FEE,
      destinationBank: manualDestinationBank,
      senderBank: mtSenderBank.value,
      senderName: mtSenderName.value.trim(),
      status: "pending_review",
      createdAt: serverTimestamp()
    });

    const txRef = doc(collection(db, "users", currentUser.uid, "transactions"));
    await setDoc(txRef, {
      type: "deposit",
      direction: "pending",
      title: "Manual bank transfer deposit",
      amount: manualPendingAmount,
      status: "pending_review",
      method: "manual_transfer",
      manualDepositId: depositRef.id,
      createdAt: serverTimestamp()
    });

    showPanelMsg(depositMsg, "success", "Submitted! Your deposit is pending admin approval.");
    setTimeout(() => { window.location.href = "transactions.html"; }, 1600);
  } catch (err) {
    console.error("Manual deposit submit error:", err);
    showPanelMsg(depositMsg, "error", err.message || "Something went wrong. Please try again.");
  } finally {
    setBtnLoading(manualPaidBtn, false);
  }
});

/* ===== COPY-TO-CLIPBOARD (account number buttons in methods 2 & 3) ===== */
document.querySelectorAll(".dm-copy-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const target = document.getElementById(btn.dataset.copyTarget);
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      btn.classList.add("copied");
      const icon = btn.querySelector("i");
      icon.className = "bx bx-check";
      setTimeout(() => {
        btn.classList.remove("copied");
        icon.className = "bx bx-copy";
      }, 1500);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  });
});

/* ===== Enter key inside an amount field proceeds, same as clicking ===== */
virtualAmountInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  virtualProceedBtn.click();
});
manualAmountInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  manualProceedBtn.click();
});

/* ===== DEPOSIT METHOD SWITCH — must come after all three methods above
   are fully wired, since switching away from a method resets it. ===== */
const DEPOSIT_METHOD_NOTES = {
  automatic: "Instant Automatic credits your wallet immediately after payment.",
  virtual: "Transfer to a one-time virtual account — your wallet is credited automatically once the transfer is detected.",
  manual: "Transfer directly to TaskNOVA's bank account — your wallet is credited after an admin confirms the payment."
};

let currentDepositMethod = depositMethodSelect.value;

function setDepositMethod(method) {
  if (currentDepositMethod === "virtual" && method !== "virtual") resetVirtualPanel();
  if (currentDepositMethod === "manual" && method !== "manual") resetManualPanel();
  currentDepositMethod = method;

  methodAutomaticEl.style.display = method === "automatic" ? "" : "none";
  methodVirtualEl.style.display = method === "virtual" ? "" : "none";
  methodManualEl.style.display = method === "manual" ? "" : "none";
  depositMethodNote.textContent = DEPOSIT_METHOD_NOTES[method] || "";

  clearPanelMsg(depositMsg);
  requestAnimationFrame(syncWalletHeight);
}

depositMethodSelect.addEventListener("change", () => setDepositMethod(depositMethodSelect.value));
setDepositMethod(depositMethodSelect.value);

/* ===========================================================
   WITHDRAWAL — bank resolve + fee preview + request
   =========================================================== */
const withdrawAmountInput = document.getElementById("withdrawAmount");
const withdrawFeeValue = document.getElementById("withdrawFeeValue");
const withdrawReceiveValue = document.getElementById("withdrawReceiveValue");
const accountNumberInput = document.getElementById("accountNumber");
const accountStatusIcon = document.getElementById("accountStatusIcon");
const resolvedNameBox = document.getElementById("resolvedNameBox");
const resolvedNameValue = document.getElementById("resolvedNameValue");
const withdrawSubmit = document.getElementById("withdrawSubmit");
const withdrawMsg = document.getElementById("withdrawMsg");

const WITHDRAWAL_FEE_RATE = 0.05;
const WITHDRAWAL_MIN = 500;

let resolvedAccountName = null;
let accountCheckTimer = null;
let accountCheckToken = 0;

function updateWithdrawFeePreview() {
  const amount = Number(withdrawAmountInput.value) || 0;
  const fee = amount * WITHDRAWAL_FEE_RATE;
  const receive = amount - fee;
  withdrawFeeValue.textContent = formatNaira(fee > 0 ? fee : 0);
  withdrawReceiveValue.textContent = formatNaira(receive > 0 ? receive : 0);
}

withdrawAmountInput.addEventListener("input", updateWithdrawFeePreview);
updateWithdrawFeePreview();

function resetAccountResolution() {
  resolvedAccountName = null;
  resolvedNameBox.classList.remove("show");
  resolvedNameValue.textContent = "—";
  accountStatusIcon.className = "bx field-status-icon account-status-icon";
  updateWithdrawSubmitState();
}

function updateWithdrawSubmitState() {
  const amount = Number(withdrawAmountInput.value) || 0;
  const canSubmit = amount >= WITHDRAWAL_MIN && amount <= currentWallet.earned && 
    currentOutstanding <= 0 && !!resolvedAccountName && !!bankSelect.value;
  withdrawSubmit.disabled = !canSubmit;
}

withdrawAmountInput.addEventListener("input", updateWithdrawSubmitState);

accountNumberInput.addEventListener("input", () => {
  accountNumberInput.value = accountNumberInput.value.replace(/\D/g, "").slice(0, 10);
  resetAccountResolution();
  clearTimeout(accountCheckTimer);

  const accNumber = accountNumberInput.value;
  const bankCode = bankSelect.value;

  if (accNumber.length !== 10 || !bankCode) return;

  accountStatusIcon.className = "bx bx-loader-alt field-status-icon account-status-icon show checking";
  const myToken = ++accountCheckToken;

  accountCheckTimer = setTimeout(async () => {
    try {
      const name = await resolveBankAccount(bankCode, accNumber);
      if (myToken !== accountCheckToken) return;

      if (name) {
        resolvedAccountName = name;
        resolvedNameValue.textContent = name;
        resolvedNameBox.classList.add("show");
        accountStatusIcon.className = "bx bx-check-circle field-status-icon account-status-icon show valid";
      } else {
        accountStatusIcon.className = "bx bx-x-circle field-status-icon account-status-icon show invalid";
      }
      updateWithdrawSubmitState();
    } catch (err) {
      if (myToken !== accountCheckToken) return;
      console.error("Account resolve error:", err);
      accountStatusIcon.className = "bx bx-x-circle field-status-icon account-status-icon show invalid";
      updateWithdrawSubmitState();
    }
  }, 600);
});

// Resolving a bank account number to a name requires Flutterwave's secret
// key, so this calls a Supabase Edge Function proxy rather than Flutterwave
// directly.
async function resolveBankAccount(bankCode, accountNumber) {
  if (!currentUser) return null;
  const idToken = await currentUser.getIdToken();
  const result = await callEdgeFunction(EDGE_FN.resolveAccount, { bank_code: bankCode, account_number: accountNumber }, idToken);
  return result.account_name || null;
}

withdrawForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearPanelMsg(withdrawMsg);

  const amount = Number(withdrawAmountInput.value);
  const bankCode = bankSelect.value;
  const bankName = bankSelect.options[bankSelect.selectedIndex]?.textContent || "";
  const accountNumber = accountNumberInput.value;

  if (currentOutstanding > 0) {
    showPanelMsg(
      withdrawMsg, 
      "error", 
      `You have an outstanding balance of ${formatNaira(currentOutstanding)}. Clear it via swap or deposit before withdrawing.`
    );
    return;
  }

  if (amount < WITHDRAWAL_MIN) {
    showPanelMsg(withdrawMsg, "error", `Minimum withdrawal is ${formatNaira(WITHDRAWAL_MIN)}.`);
    return;
  }
  if (amount > currentWallet.earned) {
    showPanelMsg(withdrawMsg, "error", "That's more than your available Earned Balance.");
    return;
  }
  if (!bankCode || !resolvedAccountName) {
    showPanelMsg(withdrawMsg, "error", "Please select a bank and enter a valid account number.");
    return;
  }

  setBtnLoading(withdrawSubmit, true);

  try {
    // The client never edits wallet balances directly for withdrawals.
    // It only creates a request; a Supabase Edge Function verifies the
    // Earned Balance, deducts it in a Firestore transaction, and
    // initiates the Flutterwave transfer.
    const idToken = await currentUser.getIdToken();
    await callEdgeFunction(EDGE_FN.requestWithdrawal, {
      amount,
      bank_code: bankCode,
      bank_name: bankName,
      account_number: accountNumber,
      account_name: resolvedAccountName
    }, idToken);

    showPanelMsg(withdrawMsg, "success", "Withdrawal requested! You'll receive it within 24–48 hours (sooner once automatic transfers are enabled).");
    withdrawForm.reset();
    resetAccountResolution();
    updateWithdrawFeePreview();
  } catch (err) {
    console.error("Withdrawal request error:", err);
    showPanelMsg(withdrawMsg, "error", err.message || "Something went wrong. Please try again.");
  } finally {
    setBtnLoading(withdrawSubmit, false);
  }
});

/* ===========================================================
   SWAP — Earned Balance -> Deposit Balance
   Pure internal wallet movement: no external API/secret involved,
   so this runs safely as a client-side Firestore transaction
   (protect it with matching Firestore security rules).
   =========================================================== */
const swapAmountInput = document.getElementById("swapAmount");
const swapPreview = document.getElementById("swapPreview");
const swapOutstandingValue = document.getElementById("swapOutstandingValue");
const swapDepositValue = document.getElementById("swapDepositValue");
const swapSubmit = document.getElementById("swapSubmit");
const swapMsg = document.getElementById("swapMsg");

function updateSwapPreview() {
  const amount = Number(swapAmountInput.value) || 0;
  if (amount <= 0) {
    swapPreview.style.display = "none";
    syncWalletHeight();
    return;
  }
  swapPreview.style.display = "flex";
  const toOutstanding = Math.min(amount, currentOutstanding);
  const toDeposit = amount - toOutstanding;
  swapOutstandingValue.textContent = formatNaira(toOutstanding);
  swapDepositValue.textContent = formatNaira(toDeposit);

  requestAnimationFrame(syncWalletHeight);
}

swapAmountInput.addEventListener("input", updateSwapPreview);

swapForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearPanelMsg(swapMsg);

  const amount = Number(swapAmountInput.value);

  if (!amount || amount <= 0) {
    showPanelMsg(swapMsg, "error", "Enter an amount to swap.");
    return;
  }
  if (amount > currentWallet.earned) {
    showPanelMsg(swapMsg, "error", "That's more than your available Earned Balance.");
    return;
  }
  if (!currentUser) return;

  setBtnLoading(swapSubmit, true);

  try {
    const userRef = doc(db, "users", currentUser.uid);

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) throw new Error("Account not found.");

      const data = snap.data();
      const earned = data.wallet?.earned ?? 0;
      const deposit = data.wallet?.deposit ?? 0;
      const outstanding = data.outstanding ?? 0;

      if (amount > earned) throw new Error("That's more than your available Earned Balance.");

      const clearsOutstanding = Math.min(amount, outstanding);
      const toDeposit = amount - clearsOutstanding;

      transaction.update(userRef, {
        "wallet.earned": earned - amount,
        "wallet.deposit": deposit + toDeposit,
        "outstanding": outstanding - clearsOutstanding
      });

      const txRef = doc(collection(db, "users", currentUser.uid, "transactions"));
      transaction.set(txRef, {
        type: "swap",
        direction: "debit",
        title: "Swap to Deposit Balance",
        amount,
        status: "successful",
        createdAt: serverTimestamp()
      });
    });

    showPanelMsg(swapMsg, "success", "Swap complete! Your Deposit Balance has been updated.");
    swapForm.reset();
    swapPreview.style.display = "none";
  } catch (err) {
    console.error("Swap error:", err);
    showPanelMsg(swapMsg, "error", err.message || "Something went wrong. Please try again.");
  } finally {
    setBtnLoading(swapSubmit, false);
  }
});

/* ===========================================================
   BACKEND NOTES (read before going live)
   ===========================================================
   This file intentionally never touches a Flutterwave secret key.
   Every server-side call below is a Supabase Edge Function (see
   js/supabase.js) — none of these are deployed yet. Each one needs
   to verify the caller's Firebase ID token (sent as a Bearer header
   by callEdgeFunction) before doing anything privileged; Firebase
   Admin SDK can run inside a Deno/Supabase Edge Function for this,
   or the token can be checked manually against Google's JWKS.

   1. verify-flutterwave-deposit({ tx_ref })
      - Verify: GET https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=...
        with "Authorization: Bearer <FLUTTERWAVE_SECRET_KEY>"
      - If status is "successful" and the amount/currency match what's
        expected, credit the user's wallet.deposit using the Outstanding
        Priority Rule (clear outstanding first, remainder to deposit),
        increment users/{uid}.lifetimeDeposited by the full deposited
        amount (this is a separate, never-decreasing counter — refer.js's
        referral-reward feature depends on it), then write a
        "transactions" doc (type: "deposit", direction: "credit").
      - Reject if tx_ref was already processed (idempotency) — Flutterwave
        can call your webhook AND the client can call this function for the
        same payment, so this function and the webhook (see METHOD 2) must
        both check for an already-settled record before crediting twice.

   2. list-banks()
      - Call: GET https://api.flutterwave.com/v3/banks/NG
        with "Authorization: Bearer <FLUTTERWAVE_SECRET_KEY>"
      - Return the bank list as [{ name, code }], mapped from Flutterwave's
        response shape. This is what populates the withdrawal bank select —
        without it deployed, that dropdown just shows "Bank list unavailable."
      - Cheap to cache for a few hours (bank lists rarely change) rather than
        hitting Flutterwave on every page load, if Supabase's own caching or
        a small KV table is available.

   3. resolve-bank-account({ bank_code, account_number })
      - Call: POST https://api.flutterwave.com/v3/accounts/resolve
        with "Authorization: Bearer <FLUTTERWAVE_SECRET_KEY>",
        body { account_number, account_bank: bank_code }
      - Return { account_name } on success, or { error } on failure.

   4. request-withdrawal({ amount, bank_code, bank_name, account_number, account_name })
      - Re-check the caller's Earned Balance server-side (never trust the client).
      - Enforce minimum ₦500 and the 5% fee.
      - Deduct wallet.earned in a Firestore transaction, write a
        "transactions" doc (type: "withdrawal", direction: "debit", status: "pending").
      - Call Flutterwave's Transfers endpoint (POST https://api.flutterwave.com/v3/transfers)
        to disburse automatically; until that's wired up, an admin can fulfill
        the request manually within 24–48 hours per the current fallback plan
        (see admin/finance.html's Withdrawals tab — it already expects this
        exact transactions doc shape).

   Update FLUTTERWAVE_PUBLIC_KEY above (already set) and deploy each of the
   four functions above with `supabase functions deploy <name>` — the EDGE_FN
   object's values are their expected slugs.

   ===========================================================
   METHOD 2 — MANUAL AUTOMATIC (Flutterwave virtual account)
   ===========================================================
   5. create-flutterwave-virtual-account({ amount })
      - Call Flutterwave's "Create a Virtual Account" endpoint for a
        one-time (not permanent) NGN account, scoped to this exact amount.
      - Create a Firestore doc at virtualAccountPayments/{reference}
        (reference = Flutterwave's tx_ref/order_ref) with:
          { uid, amount, status: "pending", createdAt, expiresAt }
      - Return { reference, accountNumber, bankName, accountName, expiresAt }
        to the client — expiresAt should match whatever TTL you set on the
        virtual account itself (the client's countdown is cosmetic only;
        the real deadline must be enforced server-side too).

   6. Flutterwave webhook handler (a separate Supabase Edge Function with its
      own public URL, configured directly in Flutterwave's dashboard — not
      called by this client at all)
      - Verify the webhook's verif-hash header against your Flutterwave
        secret hash before trusting the payload.
      - On a successful charge for a known reference: credit
        wallet.deposit (Outstanding Priority Rule, same as Method 1),
        increment users/{uid}.lifetimeDeposited by the deposited amount
        (same counter Method 1 updates — see its note above), write a
        "transactions" doc (type: "deposit", direction: "credit"),
        and update virtualAccountPayments/{reference}.status to "successful".
      - On failure, or a scheduled Supabase function when "now > expiresAt"
        and the doc is still "pending": set status to "failed" or "expired".
      - This status field is the only thing the client listens to — it
        never polls Flutterwave itself and never sees a secret key.
      - Webhooks aren't set up yet at all (flagged separately) — this
        handler doesn't exist yet, so right now nothing actually confirms a
        virtual-account payment automatically.

   7. cancel-flutterwave-virtual-account({ reference })
      - Best-effort: mark virtualAccountPayments/{reference}.status as
        "cancelled" (only if it's still "pending" — never overwrite a
        result that already landed) so a late webhook can't resurrect it.
        The client has already reset its own UI by the time this call
        goes out, so failures here are logged, not surfaced to the user.

   ===========================================================
   METHOD 3 — MANUAL TRANSFER (admin-approved)
   ===========================================================
   No Edge Function is required for the user-facing half — the client
   writes directly to two Firestore collections (same lightweight pattern
   as Post Task / Swap), protected by Firestore rules that only allow a
   user to create (never update/delete) their own manualDeposits + pending
   transactions doc:

   - manualDeposits/{id}: { uid, amount, fee, totalExpected,
     destinationBank, senderBank, senderName, status: "pending_review",
     createdAt }
   - users/{uid}/transactions/{id}: mirrors it for the Recent Wallet
     Activity list and transactions.html (direction: "pending"), storing
     manualDepositId pointing back to the manualDeposits doc (its own id
     is auto-generated, not shared with the deposit doc's id).

   Approve/Reject on this collection are already handled entirely by
   admin/manual-transactions.html's Manual Deposits tab (client-side
   Firestore writes, no backend function). That Approve action needs
   one more field added to what it already writes: increment
   users/{uid}.lifetimeDeposited by `amount` alongside the existing
   wallet.deposit credit — it doesn't yet, which is a gap flagged in
   refer.js's own notes (referral rewards depend on this counter
   being accurate across every deposit path, not just Methods 1 & 2
   here). settings/manualTransferBank { bankName, accountNumber,
   accountName } is populated from admin/settings.html and read live
   by this page.

   ===========================================================
   METHOD 4 — INACTIVITY-BASED AUTO-DELETION (Supabase scheduled)
   ===========================================================
   This page only shows the deletionWarningBanner above when
   deletionWarningAt is set — it never sets that field itself, and
   it never deletes anything. The actual logic needs to run on a
   schedule regardless of whether the user ever opens the app
   again, so it belongs entirely in a Supabase scheduled Edge
   Function (cron), not any page:

   8. inactivity-sweep() — run daily
      - For every user where wallet.earned last increased more than
        30 days ago (track this via lastEarnedAt, which every
        earned-crediting write across the app needs to set —
        Force Pay in admin/reports-support.js, task-submission
        approval, refer.js's referral reward, etc. — flag this the
        same way lifetimeDeposited was flagged for deposits) AND
        deletionWarningAt is not yet set: set
        deletionWarningAt = now, and write a notification to
        users/{uid}/notifications warning them (14 days, will be
        deleted, earn something to cancel it).
      - For every user where deletionWarningAt IS set AND
        lastEarnedAt is still <= deletionWarningAt (no new earning
        since the warning fired) AND now - deletionWarningAt >= 14
        days: perform the SAME deletion this page's Delete Account
        button performs manually on profile.js — wipe their own
        Firestore doc + subcollections, and write an adminAlerts
        doc (type: "account_deletion_auto", same fields) so there's
        still a record of it, even though this path runs with
        elevated privileges and could delete the Firebase Auth
        account directly too (profile.js's manual path deliberately
        doesn't, to avoid a reauth prompt — this automated path has
        no such UX constraint, so it's reasonable for it to just
        finish the job via the Firebase Admin SDK).
      - For every user where deletionWarningAt IS set but
        lastEarnedAt has since moved past it (they earned again):
        clear deletionWarningAt back to null — they're active again.

   ===========================================================
   RELATED — TRANSACTION HISTORY RETENTION (not this file's job)
   ===========================================================
   A separate, unrelated Supabase scheduled function needs to purge
   transaction history older than 3 months on a rolling basis
   (oldest batch clears every 3 months) across every user's
   transactions subcollection — this wallet page and transactions.js
   both just read whatever's there, neither needs to know the sweep
   is happening. Noted here only so the two scheduled jobs (this one
   and the inactivity sweep above) aren't confused for the same
   thing — they're independent, and the retention sweep does NOT
   look at lastEarnedAt or delete any user docs.
   =========================================================== */
