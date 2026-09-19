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
   --------------------------------------------------------- */
const DEFAULT_BANNER_LINK = "../user/post-advertisement.html";

document.querySelectorAll("[data-default-ad]").forEach((el) => {
  el.addEventListener("click", () => {
    window.open(DEFAULT_BANNER_LINK, "_blank", "noopener");
  });
});

/* ---------------------------------------------------------
   FLOATING AD + FLOATING SUPPORT
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
   CONFIG
   --------------------------------------------------------- */
const FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK-08a321f68fcf28e8c22d0cfef9050ce6-X";

const EDGE_FN = {
  verifyDeposit: "verify-flutterwave-deposit",
  listBanks: "list-banks",
  resolveAccount: "resolve-bank-account",
  requestWithdrawal: "request-withdrawal",
  createVirtualAccount: "create-flutterwave-virtual-account",
  cancelVirtualAccount: "cancel-flutterwave-virtual-account"
};

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
   NIGERIAN BANK NAMES
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
  resetAccountResolution();
});

/* ---------------------------------------------------------
   WALLET TABS
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
   LIVE BALANCES + OUTSTANDING
   --------------------------------------------------------- */
const depositValueEl = document.getElementById("depositValue");
const earnedValueEl = document.getElementById("earnedValue");
const outstandingBanner = document.getElementById("outstandingBanner");
const outstandingText = document.getElementById("outstandingText");
const depositOutstandingNote = document.getElementById("depositOutstandingNote");
const swapAvailableNote = document.getElementById("swapAvailableNote");

/* ---------------------------------------------------------
   INACTIVITY DELETION WARNING BANNER
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

  renderManualVerificationSection();

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

/* ===== METHOD 1: INSTANT AUTOMATIC ===== */
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
    public_key: FLUTTERWAVE_PUBLIC_KEY,
    tx_ref: txRef,
    amount: amount,
    currency: "NGN",
    payment_options: "card,banktransfer,ussd,opay",
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

/* ===== METHOD 2: VIRTUAL ACCOUNT DEPOSIT ===== */
const VIRTUAL_DEPOSIT_FEE = 0;

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
const virtualFeeNote = document.getElementById("virtualFeeNote");

let vmTimerInterval = null;
let vmUnsubscribe = null;
let vmExpiresAt = null;
let vmReference = null;
let vmSettled = false;

function updateVirtualAmountPreview() {
  const baseAmount = Number(virtualAmountInput.value) || 0;
  if (baseAmount > 0) {
    if (virtualFeeNote) virtualFeeNote.textContent = `Exact amount to send: By Flutterwave`;
  } else {
    if (virtualFeeNote) virtualFeeNote.textContent = `A ₦${VIRTUAL_DEPOSIT_FEE} charge will be added to the total amount to send.`;
  }
}

virtualAmountInput.addEventListener("input", updateVirtualAmountPreview);
updateVirtualAmountPreview();

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
  clearInterval(vmPollInterval);
  vmPollInterval = null;
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
  const baseAmount = Number(virtualAmountInput.value);
  if (!baseAmount || baseAmount < 100) {
    showPanelMsg(depositMsg, "error", "Enter an amount of at least ₦100.");
    return;
  }
  if (!currentUser) return;

  const totalToPay = baseAmount + VIRTUAL_DEPOSIT_FEE;

  setBtnLoading(virtualProceedBtn, true);

  try {
    const idToken = await currentUser.getIdToken();

    const result = await callEdgeFunction(EDGE_FN.createVirtualAccount, {
      amount: totalToPay,
      creditAmount: baseAmount,
      fee: VIRTUAL_DEPOSIT_FEE,
      email: currentUser.email,
      userId: currentUser.uid
    }, idToken);

    vmReference = result.reference;
    vmSettled = false;

    await setDoc(doc(db, "virtualAccountPayments", vmReference), {
      userId: currentUser.uid,
      reference: vmReference,
      amount: Number(result.flutterwaveAmount),
      status: "pending",
      createdAt: serverTimestamp()
    });

    vmBankName.textContent = result.bankName || "—";
    vmAccountNumber.textContent = result.accountNumber || "—";
    vmAccountName.textContent = result.accountName || "—";

    const flutterwaveAmount = Number(result.flutterwaveAmount);
    vmAmount.textContent = formatNaira(flutterwaveAmount);

    vmStepAmount.style.display = "none";
    vmStepPending.style.display = "";
    startVmCountdown(new Date(result.expiresAt));

    // Listen to real-time Firestore updates from verify-payments
    vmUnsubscribe = onSnapshot(doc(db, "virtualAccountPayments", vmReference), (snap) => {
      const status = snap.data()?.status;
      if (!vmSettled && (status === "successful" || status === "failed" || status === "expired")) {
        handleVmOutcome(status);
      }
    }, (err) => {
      console.error("Virtual account status listener error:", err);
    });

    // Background polling every 8 seconds as a safeguard
    clearInterval(vmPollInterval);
    vmPollInterval = setInterval(async () => {
      if (vmSettled || !vmReference) return;
      try {
        await verifyTransaction(vmReference, null);
      } catch (err) {
        // Silent fail; polling will retry next interval
      }
    }, 8000);

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

/* ===== METHOD 3: MANUAL TRANSFER ===== */
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

const MANUAL_TRANSFER_FEE = 50;
let manualDestinationBank = null;
let manualPendingAmount = 0;

NIGERIAN_BANK_NAMES.forEach((name) => {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  mtSenderBank.appendChild(opt);
});

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

/* ===== COPY-TO-CLIPBOARD ===== */
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

/* ===== DEPOSIT METHOD SWITCH ===== */
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