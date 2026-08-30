/* =========================================================
   TASKNOVA — PROFILE PAGE LOGIC
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
  runTransaction,
  collection,
  where,
  addDoc,
  setDoc,
  query,
  orderBy,
  limit,
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
const SKRED_ADVERTISE_LINK = "../user/post-advertisement.html";

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
   CONFIG — replace these with your real values before launch
   --------------------------------------------------------- */
const PAYSTACK_PUBLIC_KEY = "pk_test_REPLACE_WITH_YOUR_PAYSTACK_PUBLIC_KEY";

// Cloud Function endpoints (secret keys live server-side only — never here).
// See the notes at the end of this file for what each one needs to do.
const CLOUD_FN = {
  verifyDeposit: "https://REGION-PROJECT.cloudfunctions.net/verifyPaystackDeposit",
  resolveAccount: "https://REGION-PROJECT.cloudfunctions.net/resolveBankAccount",
  requestWithdrawal: "https://REGION-PROJECT.cloudfunctions.net/requestWithdrawal",
  createVirtualAccount: "https://REGION-PROJECT.cloudfunctions.net/createFlutterwaveVirtualAccount",
  cancelVirtualAccount: "https://REGION-PROJECT.cloudfunctions.net/cancelFlutterwaveVirtualAccount"
};

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
   NIGERIAN BANKS (Paystack bank codes)
   Static list so the page works offline / instantly. Refresh
   periodically from GET https://api.paystack.co/bank via your
   backend if Paystack adds/renames banks.
   --------------------------------------------------------- */
const NIGERIAN_BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "Citibank Nigeria", code: "023" },
  { name: "Ecobank Nigeria", code: "050" },
  { name: "Fidelity Bank", code: "070" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "First City Monument Bank (FCMB)", code: "214" },
  { name: "Globus Bank", code: "00103" },
  { name: "Guaranty Trust Bank (GTBank)", code: "058" },
  { name: "Heritage Bank", code: "030" },
  { name: "Jaiz Bank", code: "301" },
  { name: "Keystone Bank", code: "082" },
  { name: "Kuda Microfinance Bank", code: "50211" },
  { name: "Moniepoint MFB", code: "50515" },
  { name: "Opay (Paycom)", code: "999992" },
  { name: "Palmpay", code: "999991" },
  { name: "Parallex Bank", code: "104" },
  { name: "Polaris Bank", code: "076" },
  { name: "Premium Trust Bank", code: "105" },
  { name: "Providus Bank", code: "101" },
  { name: "Stanbic IBTC Bank", code: "221" },
  { name: "Standard Chartered Bank", code: "068" },
  { name: "Sterling Bank", code: "232" },
  { name: "SunTrust Bank", code: "100" },
  { name: "Titan Trust Bank", code: "102" },
  { name: "Union Bank of Nigeria", code: "032" },
  { name: "United Bank for Africa (UBA)", code: "033" },
  { name: "Unity Bank", code: "215" },
  { name: "Wema Bank / ALAT", code: "035" },
  { name: "Zenith Bank", code: "057" }
];

const bankSelect = document.getElementById("bankSelect");
const bankCodeInput = document.getElementById("bankCode");

NIGERIAN_BANKS.forEach((bank) => {
  const opt = document.createElement("option");
  opt.value = bank.code;
  opt.textContent = bank.name;
  bankSelect.appendChild(opt);
});

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

const userNameEl = document.getElementById("menuUserName");
const userTypeEl = document.getElementById("menuUserType");
const userAvatarEl = document.getElementById("menuUserAvatar");
const alertDot = document.getElementById("alertDot");

let currentUser = null;
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

  if (unsubscribeUserDoc) unsubscribeUserDoc();
  if (unsubscribeTx) unsubscribeTx();

  unsubscribeUserDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    const fullName = data.fullName || "TaskNOVA User";
    const initial = fullName.trim().charAt(0).toUpperCase() || "T";

    if (userNameEl) userNameEl.textContent = fullName || user.email;
    if (userTypeEl) userTypeEl.textContent = data.accountType ? data.accountType + (data.institutionAbbr ? " · " + data.institutionAbbr : "") : user.email;
    if (userAvatarEl) userAvatarEl.textContent = initial;

    currentWallet.deposit = data.wallet?.deposit ?? 0;
    currentWallet.earned = data.wallet?.earned ?? 0;
    currentOutstanding = data.outstanding ?? 0;

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

    swapAvailableNote.textContent = `Available: ${formatNaira(currentWallet.earned)}`;
    updateSwapPreview();
  }, (err) => {
    console.error("Wallet listener error:", err);
  });

  const txQuery = query(
    collection(db, "users", user.uid, "transactions"),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  unsubscribeTx = onSnapshot(txQuery, (snap) => {
    const rows = snap.docs.map((d) => {
      const data = d.data();
      return {
        title: data.title || data.type || "Transaction",
        type: data.type || "default",
        direction: data.direction || "debit",
        amount: data.amount || 0,
        status: data.status || "",
        date: data.createdAt?.toDate ? data.createdAt.toDate() : null
      };
    });
    renderTransactions(rows);
  }, (err) => {
    console.error("Transactions listener error:", err);
    renderTransactions([]);
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
});

const TX_ICONS = {
  deposit: "bx-download",
  withdrawal: "bx-upload",
  earning: "bx-trending-up",
  task_payment: "bx-briefcase",
  airtime: "bx-mobile-alt",
  data: "bx-wifi",
  swap: "bx-transfer-alt",
  referral: "bx-user-plus",
  refund: "bx-undo",
  default: "bx-receipt"
};

function renderTransactions(rows) {
  const txList = document.getElementById("txList");
  if (!txList) return;

  if (!rows.length) {
    txList.innerHTML = `<div class="tx-empty">No wallet activity yet.</div>`;
    return;
  }

  txList.innerHTML = rows.map((tx) => {
    const kind = tx.direction === "credit" ? "credit" : tx.direction === "pending" ? "pending" : "debit";
    const icon = TX_ICONS[tx.type] || TX_ICONS.default;
    const sign = kind === "credit" ? "+" : kind === "pending" ? "" : "−";
    const when = formatRelativeTime(tx.date);

    return `
      <div class="tx-row ${kind}">
        <div class="tx-icon"><i class="bx ${icon}"></i></div>
        <div class="tx-info">
          <strong>${tx.title}</strong>
          <span>${when}${tx.status ? " · " + tx.status : ""}</span>
        </div>
        <div class="tx-amount">${sign}${formatNaira(tx.amount)}</div>
      </div>`;
  }).join("");
}

/* ===========================================================
   DEPOSIT — three methods sharing one panel + one panel-msg
   =========================================================== */
const depositMethodSelect = document.getElementById("depositMethod");
const depositMethodNote = document.getElementById("depositMethodNote");
const methodAutomaticEl = document.getElementById("methodAutomatic");
const methodVirtualEl = document.getElementById("methodVirtual");
const methodManualEl = document.getElementById("methodManual");

/* ===== METHOD 1: INSTANT AUTOMATIC — Paystack Inline Checkout ===== */
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
  // The other two methods drive themselves entirely through their own
  // buttons (type="button") — this handler only ever needs to fire for
  // Instant Automatic, but Enter-inside-a-text-input can still trigger a
  // form submit regardless of which panel is visible, hence the guard.
  if (depositMethodSelect.value !== "automatic") return;

  clearPanelMsg(depositMsg);

  const amount = Number(depositAmountInput.value);
  if (!amount || amount < 100) {
    showPanelMsg(depositMsg, "error", "Enter an amount of at least ₦100.");
    return;
  }

  if (!currentUser) return;

  if (typeof PaystackPop === "undefined") {
    showPanelMsg(depositMsg, "error", "Payment popup failed to load. Check your connection and try again.");
    return;
  }

  setBtnLoading(depositSubmit, true);

  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: currentUser.email,
    amount: Math.round(amount * 100), // Paystack expects kobo
    currency: "NGN",
    metadata: { uid: currentUser.uid, purpose: "wallet_deposit" },
    callback: function (response) {
      // Payment succeeded at Paystack's end. The wallet is NOT credited yet —
      // it's credited only after our backend verifies this reference server-side.
      verifyDepositOnServer(response.reference);
    },
    onClose: function () {
      setBtnLoading(depositSubmit, false);
    }
  });

  handler.openIframe();
});

async function verifyDepositOnServer(reference) {
  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch(CLOUD_FN.verifyDeposit, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + idToken
      },
      body: JSON.stringify({ reference })
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(result.error || "Verification failed.");
    }

    showPanelMsg(depositMsg, "success", "Payment verified! Your wallet has been credited.");
    depositForm.reset();
    depositChips.querySelectorAll(".amount-chip").forEach((c) => c.classList.remove("active"));
    setTimeout(() => { window.location.href = "transactions.html"; }, 1500);
  } catch (err) {
    console.error("Deposit verification error:", err);
    showPanelMsg(depositMsg, "error", "We received your payment but couldn't confirm it automatically. Contact support with your reference: " + reference);
  } finally {
    setBtnLoading(depositSubmit, false);
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
    const res = await fetch(CLOUD_FN.createVirtualAccount, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + idToken
      },
      body: JSON.stringify({ amount })
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || "Couldn't create a virtual account. Please try again.");

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
      await fetch(CLOUD_FN.cancelVirtualAccount, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + idToken
        },
        body: JSON.stringify({ reference: referenceToCancel })
      });
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

NIGERIAN_BANKS.forEach((bank) => {
  const opt = document.createElement("option");
  opt.value = bank.name;
  opt.textContent = bank.name;
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
  const canSubmit = amount >= WITHDRAWAL_MIN && amount <= currentWallet.earned && !!resolvedAccountName && !!bankSelect.value;
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

// Resolving a bank account number to a name requires Paystack's secret key,
// so this calls a Cloud Function proxy rather than Paystack directly.
async function resolveBankAccount(bankCode, accountNumber) {
  if (!currentUser) return null;
  const idToken = await currentUser.getIdToken();
  const res = await fetch(CLOUD_FN.resolveAccount, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + idToken
    },
    body: JSON.stringify({ bank_code: bankCode, account_number: accountNumber })
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error || "Could not resolve account.");
  return result.account_name || null;
}

withdrawForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearPanelMsg(withdrawMsg);

  const amount = Number(withdrawAmountInput.value);
  const bankCode = bankSelect.value;
  const bankName = bankSelect.options[bankSelect.selectedIndex]?.textContent || "";
  const accountNumber = accountNumberInput.value;

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
    // It only creates a request; a Cloud Function verifies the Earned Balance,
    // deducts it in a transaction, and initiates the Paystack transfer.
    const idToken = await currentUser.getIdToken();
    const res = await fetch(CLOUD_FN.requestWithdrawal, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + idToken
      },
      body: JSON.stringify({
        amount,
        bank_code: bankCode,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: resolvedAccountName
      })
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || "Withdrawal request failed.");

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
   This file intentionally never touches a Paystack secret key.
   Three Cloud Functions need to exist for the page to fully work:

   1. verifyPaystackDeposit(reference)
      - Verify: GET https://api.paystack.co/transaction/verify/:reference
        with "Authorization: Bearer <PAYSTACK_SECRET_KEY>"
      - If status is "success" and amount matches what you expect,
        credit the user's wallet.deposit using the Outstanding
        Priority Rule (clear outstanding first, remainder to deposit),
        then write a "transactions" doc (type: "deposit", direction: "credit").
      - Reject if the reference was already processed (idempotency).

   2. resolveBankAccount(bank_code, account_number)
      - Call: GET https://api.paystack.co/bank/resolve?account_number=...&bank_code=...
        with "Authorization: Bearer <PAYSTACK_SECRET_KEY>"
      - Return { account_name } on success, or { error } per Paystack's
        response (matches the docs' 400/401/502 style error shape).

   3. requestWithdrawal(amount, bank_code, bank_name, account_number, account_name)
      - Re-check the caller's Earned Balance server-side (never trust the client).
      - Enforce minimum ₦500 and the 5% fee.
      - Deduct wallet.earned in a Firestore transaction, write a
        "transactions" doc (type: "withdrawal", direction: "debit", status: "pending").
      - Call Paystack Transfer Recipient + Transfer endpoints to disburse
        automatically; until that's wired up, an admin can fulfill the
        request manually within 24–48 hours per the current fallback plan.

   Update PAYSTACK_PUBLIC_KEY and the CLOUD_FN URLs above once these exist.

   ===========================================================
   METHOD 2 — MANUAL AUTOMATIC (Flutterwave virtual account)
   ===========================================================
   4. createFlutterwaveVirtualAccount(amount)
      - Call Flutterwave's "Create a Virtual Account" endpoint for a
        one-time (not permanent) NGN account, scoped to this exact amount.
      - Create a Firestore doc at virtualAccountPayments/{reference}
        (reference = Flutterwave's tx_ref/order_ref) with:
          { uid, amount, status: "pending", createdAt, expiresAt }
      - Return { reference, accountNumber, bankName, accountName, expiresAt }
        to the client — expiresAt should match whatever TTL you set on the
        virtual account itself (the client's countdown is cosmetic only;
        the real deadline must be enforced server-side too).

   5. Flutterwave webhook handler (separate HTTPS function, not called by
      this client directly)
      - Verify the webhook signature against your Flutterwave secret hash.
      - On a successful charge for a known reference: credit
        wallet.deposit (Outstanding Priority Rule, same as Paystack),
        write a "transactions" doc (type: "deposit", direction: "credit"),
        and update virtualAccountPayments/{reference}.status to "successful".
      - On failure, or a background job when "now > expiresAt" and the
        doc is still "pending": set status to "failed" or "expired".
      - This status field is the only thing the client listens to — it
        never polls Flutterwave itself and never sees a secret key.

   6. cancelFlutterwaveVirtualAccount(reference)
      - Best-effort: mark virtualAccountPayments/{reference}.status as
        "cancelled" (only if it's still "pending" — never overwrite a
        result that already landed) so a late webhook can't resurrect it.
        The client has already reset its own UI by the time this call
        goes out, so failures here are logged, not surfaced to the user.

   ===========================================================
   METHOD 3 — MANUAL TRANSFER (admin-approved)
   ===========================================================
   No Cloud Function is required for the user-facing half — the client
   writes directly to two Firestore collections (same lightweight pattern
   as Post Task / Swap), protected by Firestore rules that only allow a
   user to create (never update/delete) their own manualDeposits + pending
   transactions doc:

   - manualDeposits/{id}: { uid, amount, fee, totalExpected,
     destinationBank, senderBank, senderName, status: "pending_review",
     createdAt }
   - users/{uid}/transactions/{id}: mirrors it for the Recent Wallet
     Activity list and transactions.html (direction: "pending").

   What an admin panel still needs to do, server-side, on Approve/Reject:
   - Approve: in one transaction, credit wallet.deposit by `amount` (NOT
     totalExpected — the ₦20 is a transfer fee, not part of what's owed
     to the user), set manualDeposits/{id}.status to "approved", and
     update the mirrored transactions doc to status: "successful",
     direction: "credit".
   - Reject: set both statuses to "rejected" and leave the wallet
     untouched.
   - Populate settings/manualTransferBank { bankName, accountNumber,
     accountName } from the admin side — the deposit page reads it live
     and shows "not set up yet" until it exists.
   =========================================================== */
