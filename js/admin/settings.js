/* =========================================================
   TASKNOVA ADMIN — SETTINGS PAGE LOGIC
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
  setDoc,
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

// Cloud Function endpoints — same pattern as wallet.js's CLOUD_FN block.
// Secret keys (Paystack, etc.) live server-side only, never here.
const CLOUD_FN = {
  resolveAccount: "https://REGION-PROJECT.cloudfunctions.net/resolveBankAccount",
  // Placeholder — this function does not exist yet. See the NOTES block
  // at the bottom of this file for exactly what it needs to do.
  forceLogoutAll: "https://REGION-PROJECT.cloudfunctions.net/forceLogoutAll"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentAdmin = null;

/* ---------------------------------------------------------
   NIGERIAN BANKS (Paystack bank codes) — same static list
   wallet.js already uses, kept in sync here.
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
NIGERIAN_BANKS.forEach((bank) => {
  const opt = document.createElement("option");
  opt.value = bank.code;
  opt.textContent = bank.name;
  bankSelect.appendChild(opt);
});

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

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}

/* ===========================================================
   MANUAL TRANSFER BANK DETAILS
   Reads/writes settings/manualTransferBank { bankName, bankCode,
   accountNumber, accountName, updatedAt, updatedBy } — the exact
   doc wallet.js's deposit page already listens to live via
   onSnapshot for its manual bank-transfer method.
   =========================================================== */
const accountNumberInput = document.getElementById("accountNumberInput");
const verifyAccountBtn = document.getElementById("verifyAccountBtn");
const resolvedNameBox = document.getElementById("resolvedNameBox");
const resolvedNameValue = document.getElementById("resolvedNameValue");
const bankMsg = document.getElementById("bankMsg");
const saveBankBtn = document.getElementById("saveBankBtn");

let resolvedAccountName = null;

function showBankMsg(text, type) {
  bankMsg.textContent = text;
  bankMsg.className = `mc-msg ${type}`;
  bankMsg.style.display = "block";
}
function clearBankMsg() {
  bankMsg.style.display = "none";
}
function resetAccountResolution() {
  resolvedAccountName = null;
  resolvedNameBox.style.display = "none";
  saveBankBtn.disabled = true;
  clearBankMsg();
}

bankSelect.addEventListener("change", resetAccountResolution);
accountNumberInput.addEventListener("input", () => {
  accountNumberInput.value = accountNumberInput.value.replace(/\D/g, "").slice(0, 10);
  resetAccountResolution();
});

async function loadCurrentBank() {
  try {
    const snap = await getDoc(doc(db, "settings", "manualTransferBank"));
    const box = document.getElementById("currentBankValue");
    if (snap.exists()) {
      const d = snap.data();
      box.textContent = `${d.accountName || "—"} · ${d.bankName || "—"} · ${d.accountNumber || "—"}`;
    } else {
      box.textContent = "Not set up yet — users can't use manual transfer until this is saved.";
    }
  } catch (err) {
    console.error("Load manual transfer bank error:", err);
    document.getElementById("currentBankValue").textContent = "Couldn't load current details.";
  }
}

verifyAccountBtn.addEventListener("click", async () => {
  clearBankMsg();
  const bankCode = bankSelect.value;
  const accountNumber = accountNumberInput.value;

  if (!bankCode) { showBankMsg("Select a bank first.", "error"); return; }
  if (accountNumber.length !== 10) { showBankMsg("Enter a valid 10-digit account number.", "error"); return; }

  verifyAccountBtn.classList.add("loading");
  verifyAccountBtn.disabled = true;
  try {
    const idToken = await currentAdmin.getIdToken();
    const res = await fetch(CLOUD_FN.resolveAccount, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken },
      body: JSON.stringify({ bank_code: bankCode, account_number: accountNumber })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || "Could not resolve account.");

    resolvedAccountName = result.account_name || null;
    if (resolvedAccountName) {
      resolvedNameValue.textContent = resolvedAccountName;
      resolvedNameBox.style.display = "flex";
      saveBankBtn.disabled = false;
    } else {
      showBankMsg("Couldn't resolve that account. Double-check the number and bank.", "error");
    }
  } catch (err) {
    console.error("Resolve account error:", err);
    showBankMsg(err.message || "Couldn't verify that account. Please try again.", "error");
  } finally {
    verifyAccountBtn.classList.remove("loading");
    verifyAccountBtn.disabled = false;
  }
});

saveBankBtn.addEventListener("click", async () => {
  if (!resolvedAccountName) return;
  const bankCode = bankSelect.value;
  const bankName = bankSelect.options[bankSelect.selectedIndex].textContent;

  saveBankBtn.classList.add("loading");
  saveBankBtn.disabled = true;
  try {
    await setDoc(doc(db, "settings", "manualTransferBank"), {
      bankName,
      bankCode,
      accountNumber: accountNumberInput.value,
      accountName: resolvedAccountName,
      updatedAt: serverTimestamp(),
      updatedBy: currentAdmin.uid
    });

    showToast("Manual transfer bank details saved — live for all users now.");
    await loadCurrentBank();
    bankSelect.value = "";
    accountNumberInput.value = "";
    resetAccountResolution();
  } catch (err) {
    console.error("Save bank details error:", err);
    showToast(err.message || "Couldn't save bank details. Please try again.", "error");
  } finally {
    saveBankBtn.classList.remove("loading");
    saveBankBtn.disabled = false;
  }
});

/* ===========================================================
   MAINTENANCE — LOGIN LOCK
   Reads/writes settings/systemLock { locked, message, updatedAt,
   updatedBy }. Toggling the switch only changes local UI state;
   nothing is written until "Save Lock Settings" is clicked.
   =========================================================== */
const lockToggle = document.getElementById("lockToggle");
const lockToggleIcon = document.getElementById("lockToggleIcon");
const lockMessageInput = document.getElementById("lockMessageInput");
const saveLockBtn = document.getElementById("saveLockBtn");

let lockedLocal = false;

function renderLockToggle() {
  lockToggle.classList.toggle("locked", lockedLocal);
  lockToggleIcon.className = lockedLocal ? "bx bx-lock-alt" : "bx bx-lock-open-alt";
}

lockToggle.addEventListener("click", () => {
  lockedLocal = !lockedLocal;
  renderLockToggle();
});

async function loadLockSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "systemLock"));
    if (snap.exists()) {
      const d = snap.data();
      lockedLocal = !!d.locked;
      lockMessageInput.value = d.message || "";
    }
    renderLockToggle();
  } catch (err) {
    console.error("Load lock settings error:", err);
  }
}

saveLockBtn.addEventListener("click", async () => {
  saveLockBtn.classList.add("loading");
  saveLockBtn.disabled = true;
  try {
    await setDoc(doc(db, "settings", "systemLock"), {
      locked: lockedLocal,
      message: lockMessageInput.value.trim(),
      updatedAt: serverTimestamp(),
      updatedBy: currentAdmin.uid
    }, { merge: true });

    showToast(lockedLocal ? "Logins are now locked platform-wide." : "Login lock saved as off.");
  } catch (err) {
    console.error("Save lock settings error:", err);
    showToast(err.message || "Couldn't save lock settings. Please try again.", "error");
  } finally {
    saveLockBtn.classList.remove("loading");
    saveLockBtn.disabled = false;
  }
});

/* ===========================================================
   FORCE LOGOUT EVERYONE
   =========================================================== */
const forceLogoutToggleBtn = document.getElementById("forceLogoutToggleBtn");
const forceLogoutPanel = document.getElementById("forceLogoutPanel");
const forceLogoutConfirmInput = document.getElementById("forceLogoutConfirmInput");
const forceLogoutConfirmBtn = document.getElementById("forceLogoutConfirmBtn");

forceLogoutToggleBtn.addEventListener("click", () => forceLogoutPanel.classList.add("show"));
document.querySelector('[data-act="force-logout-cancel"]').addEventListener("click", () => {
  forceLogoutPanel.classList.remove("show");
  forceLogoutConfirmInput.value = "";
  forceLogoutConfirmBtn.disabled = true;
});
forceLogoutConfirmInput.addEventListener("input", () => {
  forceLogoutConfirmBtn.disabled = forceLogoutConfirmInput.value.trim() !== "LOGOUT ALL";
});

forceLogoutConfirmBtn.addEventListener("click", async () => {
  forceLogoutConfirmBtn.classList.add("loading");
  forceLogoutConfirmBtn.disabled = true;
  try {
    const idToken = await currentAdmin.getIdToken();
    const res = await fetch(CLOUD_FN.forceLogoutAll, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken }
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || "Couldn't force logout everyone.");

    await setDoc(doc(db, "settings", "systemLock"), {
      forceLogoutAt: serverTimestamp(),
      forceLogoutBy: currentAdmin.uid
    }, { merge: true });

    showToast("Every user has been signed out.");
    forceLogoutPanel.classList.remove("show");
    forceLogoutConfirmInput.value = "";
  } catch (err) {
    console.error("Force logout error:", err);
    showToast(err.message || "Couldn't force logout everyone. Please try again.", "error");
  } finally {
    forceLogoutConfirmBtn.classList.remove("loading");
    forceLogoutConfirmBtn.disabled = true;
  }
});

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
  currentAdmin = user;

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

  loadCurrentBank();
  loadLockSettings();
});

/* ===========================================================
   NOTES
   ===========================================================
   - Admin identity read (users/{uid}) mirrors the same assumption
     flagged on every other admin page.

   - Manual Transfer Bank Details reuses wallet.js's exact
     NIGERIAN_BANKS list, CLOUD_FN.resolveAccount endpoint, and
     verify-then-save flow, writing to settings/manualTransferBank
     — the precise doc wallet.js's deposit page already listens to
     live via onSnapshot. Saving here takes effect for every user
     immediately, with no deploy needed.

   - Lock Logins writes settings/systemLock { locked, message }.
     This page only stores the flag — nothing currently reads it.
     For this to actually block sign-ins, the login page (not
     shown to me — described as "already built") needs to check
     this doc before completing authentication and show `message`
     if locked. Until that check is added, toggling this switch
     changes nothing for users.

   - Force Logout Everyone calls a placeholder Cloud Function
     (CLOUD_FN.forceLogoutAll) that does not exist yet. It would
     need to iterate every Firebase Auth user and call
     admin.auth().revokeRefreshTokens(uid) (or similar) so their
     existing ID tokens stop working. That alone isn't enough,
     though: Firebase only rejects a revoked token when something
     actually re-checks it against the Auth backend (e.g. a
     server-side verifyIdToken call), and this whole app is
     client-only Firestore reads/writes with the SDK caching
     sign-in state locally — so a signed-in tab can keep working
     until it naturally refreshes its token. This action also
     stamps settings/systemLock.forceLogoutAt, which is the hook
     every page's shared auth-guard chrome would need to check
     against the user's local sign-in time (log them out client-
     side if forceLogoutAt is newer) for a real, immediate kick —
     that check doesn't exist on any page yet, admin or user-side.
     Treat this button as the admin-facing half of a feature whose
     other half (the Cloud Function + the per-page check) still
     needs building.
   =========================================================== */
