/* =========================================================
   TASKNOVA ADMIN — SETTINGS PAGE LOGIC
   Firebase v12.17.1 modular SDK

   Full rewrite this pass — see chat for context. Key changes:
   1. Admin identity now reads staffAccounts/{uid}, not
      users/{uid} — admins and support are no longer part of the
      regular platform-user collection at all. This resolves the
      "flagged assumption" every other admin page has carried
      since the start of this build; those pages still need the
      same swap applied whenever they're next touched.
   2. NEW: Team Members section (admin-only) — add/edit/delete
      admin and support accounts, each with their own individual
      email/password login (no more shared admin credentials).
      Creating/editing/deleting another Auth account needs
      Firebase Admin SDK privileges, so these three actions go
      through Supabase Edge Functions (none deployed yet — full
      spec in the NOTES at the end), not direct client SDK calls.
   3. NEW: support-role view — a single read-only "My Details"
      card (name/username/email/password) instead of any of the
      admin sections. See the NOTES for the real security
      trade-off in storing a readable password at all.
   4. Manual Transfer Bank Accounts is now a LIST of up to 5
      accounts (was a single account) — settings/manualTransferBanks
      { accounts: [...] }, not settings/manualTransferBank.
      wallet.js reads the OLD single-doc path and needs updating
      to read this new array whenever it's next touched.
   5. resolveAccount and forceLogoutAll switched from the old
      Cloud Function pattern to Supabase Edge Functions, matching
      the rest of this rework.
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
  deleteDoc,
  onSnapshot,
  collection,
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

const EDGE_FN = {
  resolveAccount: "resolve-bank-account",
  forceLogoutAll: "force-logout-all",
  createStaffAccount: "create-staff-account",
  updateStaffAccount: "update-staff-account",
  deleteStaffAccount: "delete-staff-account"
};

const MAX_BANK_ACCOUNTS = 5;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentAdmin = null;
let currentStaffDoc = null; // { role, fullName, username, email, password }

/* ---------------------------------------------------------
   NIGERIAN BANKS — same static list wallet.js/other admin
   pages already use.
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

/* Searchable Bank Dropdown Logic */
const bankSelectBtn = document.getElementById("bankSelectBtn");
const selectedBankText = document.getElementById("selectedBankText");
const bankDropdown = document.getElementById("bankDropdown");
const bankSearchInput = document.getElementById("bankSearchInput");
const bankOptionsList = document.getElementById("bankOptionsList");
const bankCodeHidden = document.getElementById("bankCodeHidden");

function populateBankOptions(filter = "") {
  bankOptionsList.innerHTML = "";
  const query = filter.toLowerCase().trim();
  const filtered = NIGERIAN_BANKS.filter(b => b.name.toLowerCase().includes(query));

  if (filtered.length === 0) {
    bankOptionsList.innerHTML = `<div class="bank-option" style="color:var(--text-soft);pointer-events:none;">No bank found</div>`;
    return;
  }

  filtered.forEach(bank => {
    const item = document.createElement("div");
    item.className = "bank-option" + (bankCodeHidden.value === bank.code ? " selected" : "");
    item.textContent = bank.name;
    item.addEventListener("click", () => {
      bankCodeHidden.value = bank.code;
      selectedBankText.textContent = bank.name;
      bankDropdown.style.display = "none";
      resetAccountResolution();
    });
    bankOptionsList.appendChild(item);
  });
}

populateBankOptions();

bankSelectBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = bankDropdown.style.display === "flex" || bankDropdown.style.display === "block";
  bankDropdown.style.display = isOpen ? "none" : "flex";
  if (!isOpen) {
    bankSearchInput.value = "";
    populateBankOptions();
    bankSearchInput.focus();
  }
});

bankSearchInput?.addEventListener("input", (e) => populateBankOptions(e.target.value));

document.addEventListener("click", (e) => {
  if (bankDropdown && !e.target.closest("#bankSelectWrapper")) {
    bankDropdown.style.display = "none";
  }
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
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/* ===========================================================
   TEAM MEMBERS (admin-only)
   Reads the staffAccounts collection live — small collection
   (a handful of staff), so one unfiltered onSnapshot is the
   simplest correct approach, no pagination needed.
   =========================================================== */
const teamList = document.getElementById("teamList");
const teamEmpty = document.getElementById("teamEmpty");
let unsubscribeTeam = null;

function subscribeTeam() {
  unsubscribeTeam = onSnapshot(collection(db, "staffAccounts"), (snap) => {
    if (snap.empty) {
      teamList.innerHTML = "";
      teamEmpty.style.display = "flex";
      return;
    }
    teamEmpty.style.display = "none";
    teamList.innerHTML = snap.docs.map((d) => renderTeamCard(d.id, d.data())).join("");
    wireTeamCardActions();
  }, (err) => {
    console.error("Team list error:", err);
    teamList.innerHTML = "";
    teamEmpty.style.display = "flex";
  });
}

function renderTeamCard(uid, data) {
  const isSelf = uid === currentAdmin?.uid;
  const initial = (data.fullName || "?").trim().charAt(0).toUpperCase();
  return `
    <div class="team-card" data-uid="${uid}">
      <div class="team-avatar">${initial}</div>
      <div class="team-info">
        <strong>${escapeHtml(data.fullName || "—")}${isSelf ? " (you)" : ""}</strong>
        <span>@${escapeHtml(data.username || "—")} · ${escapeHtml(data.email || "—")}</span>
      </div>
      <span class="role-badge ${data.role === "admin" ? "admin" : "support"}">${data.role === "admin" ? "Admin" : "Support"}</span>
      <div class="team-actions">
        <button type="button" class="team-icon-btn" data-act="edit-team" aria-label="Edit"><i class="bx bx-edit-alt"></i></button>
        <button type="button" class="team-icon-btn danger" data-act="delete-team" ${isSelf ? "disabled" : ""} aria-label="Remove" title="${isSelf ? "You can't remove your own account — ask another admin to do it" : "Remove"}"><i class="bx bx-trash"></i></button>
      </div>
    </div>`;
}

function wireTeamCardActions() {
  teamList.querySelectorAll('[data-act="edit-team"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const uid = e.currentTarget.closest(".team-card").dataset.uid;
      openTeamModal(uid);
    });
  });
  teamList.querySelectorAll('[data-act="delete-team"]').forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const uid = e.currentTarget.closest(".team-card").dataset.uid;
      openDeleteTeamModal(uid);
    });
  });
}

/* ---------------------------------------------------------
   ADD / EDIT TEAM MEMBER MODAL
   --------------------------------------------------------- */
const teamModal = document.getElementById("teamModal");
const teamModalBackdrop = document.getElementById("teamModalBackdrop");
const teamModalClose = document.getElementById("teamModalClose");
const teamModalCancel = document.getElementById("teamModalCancel");
const teamModalTitle = document.getElementById("teamModalTitle");
const teamModalSave = document.getElementById("teamModalSave");
const teamModalMsg = document.getElementById("teamModalMsg");
const teamFullName = document.getElementById("teamFullName");
const teamUsername = document.getElementById("teamUsername");
const teamEmail = document.getElementById("teamEmail");
const teamPassword = document.getElementById("teamPassword");
const teamPasswordHint = document.getElementById("teamPasswordHint");
const teamPasswordToggle = document.getElementById("teamPasswordToggle");

let editingUid = null;

function openTeamModal(uid) {
  editingUid = uid || null;
  teamModalMsg.style.display = "none";
  teamPassword.type = "password";
  teamPasswordToggle.innerHTML = '<i class="bx bx-hide"></i>';

  if (editingUid) {
    const card = teamList.querySelector(`.team-card[data-uid="${editingUid}"]`);
    teamModalTitle.textContent = "Edit Team Member";
    teamPasswordHint.textContent = "(leave blank to keep their current password)";
    teamPassword.placeholder = "Leave blank to keep unchanged";
    teamPassword.value = "";
    // Pull current values straight from Firestore rather than the
    // rendered card, so nothing's lost to text truncation in the DOM.
    getDoc(doc(db, "staffAccounts", editingUid)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      teamFullName.value = data.fullName || "";
      teamUsername.value = data.username || "";
      teamEmail.value = data.email || "";
      document.querySelector(`input[name="teamRole"][value="${data.role}"]`).checked = true;
    });
  } else {
    teamModalTitle.textContent = "Add Team Member";
    teamPasswordHint.textContent = "(they'll use this to log in)";
    teamPassword.placeholder = "Min. 6 characters";
    teamFullName.value = "";
    teamUsername.value = "";
    teamEmail.value = "";
    teamPassword.value = "";
    document.querySelector('input[name="teamRole"][value="support"]').checked = true;
  }

  teamModal.classList.add("open");
  teamModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeTeamModal() {
  teamModal.classList.remove("open");
  teamModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

document.getElementById("addTeamMemberBtn").addEventListener("click", () => openTeamModal(null));
teamModalBackdrop.addEventListener("click", closeTeamModal);
teamModalClose.addEventListener("click", closeTeamModal);
teamModalCancel.addEventListener("click", closeTeamModal);
teamPasswordToggle.addEventListener("click", () => {
  const isPw = teamPassword.type === "password";
  teamPassword.type = isPw ? "text" : "password";
  teamPasswordToggle.innerHTML = isPw ? '<i class="bx bx-show"></i>' : '<i class="bx bx-hide"></i>';
});

function showTeamModalMsg(text) {
  teamModalMsg.style.display = "block";
  teamModalMsg.className = "mc-msg error";
  teamModalMsg.textContent = text;
}

teamModalSave.addEventListener("click", async () => {
  const fullName = teamFullName.value.trim();
  const username = teamUsername.value.trim();
  const email = teamEmail.value.trim();
  const password = teamPassword.value;
  const role = document.querySelector('input[name="teamRole"]:checked').value;

  if (!fullName || !username || !email) {
    showTeamModalMsg("Please fill in name, username, and email.");
    return;
  }
  if (!editingUid && (!password || password.length < 6)) {
    showTeamModalMsg("Password must be at least 6 characters.");
    return;
  }
  if (password && password.length < 6) {
    showTeamModalMsg("Password must be at least 6 characters.");
    return;
  }

  teamModalSave.classList.add("loading");
  teamModalSave.disabled = true;
  try {
    const payload = {
      fullName,
      username,
      email,
      role,
      updatedAt: serverTimestamp()
    };
    if (password) payload.password = password;

    if (editingUid) {
      await setDoc(doc(db, "staffAccounts", editingUid), payload, { merge: true });
      showToast("Team member updated.");
    } else {
      const newStaffRef = doc(collection(db, "staffAccounts"));
      await setDoc(newStaffRef, {
        ...payload,
        createdAt: serverTimestamp(),
        createdBy: currentAdmin.uid
      });
      showToast("Team member added successfully.");
    }
    closeTeamModal();
  } catch (err) {
    console.error("Save team member error:", err);
    showTeamModalMsg(err.message || "Couldn't save this team member. Please try again.");
  } finally {
    teamModalSave.classList.remove("loading");
    teamModalSave.disabled = false;
  }
});

/* ---------------------------------------------------------
   DELETE TEAM MEMBER MODAL
   --------------------------------------------------------- */
const deleteTeamModal = document.getElementById("deleteTeamModal");
const deleteTeamModalBackdrop = document.getElementById("deleteTeamModalBackdrop");
const deleteTeamModalClose = document.getElementById("deleteTeamModalClose");
const deleteTeamModalCancel = document.getElementById("deleteTeamModalCancel");
const deleteTeamModalConfirm = document.getElementById("deleteTeamModalConfirm");
const deleteTeamModalText = document.getElementById("deleteTeamModalText");

let deletingUid = null;

function openDeleteTeamModal(uid) {
  deletingUid = uid;
  const card = teamList.querySelector(`.team-card[data-uid="${uid}"]`);
  const name = card?.querySelector(".team-info strong")?.textContent || "this team member";
  deleteTeamModalText.textContent = `${name} will lose admin platform access entirely and can no longer log in.`;
  deleteTeamModal.classList.add("open");
  deleteTeamModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeDeleteTeamModal() {
  deleteTeamModal.classList.remove("open");
  deleteTeamModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
deleteTeamModalBackdrop.addEventListener("click", closeDeleteTeamModal);
deleteTeamModalClose.addEventListener("click", closeDeleteTeamModal);
deleteTeamModalCancel.addEventListener("click", closeDeleteTeamModal);

deleteTeamModalConfirm.addEventListener("click", async () => {
  if (!deletingUid || deletingUid === currentAdmin?.uid) return;
  deleteTeamModalConfirm.classList.add("loading");
  deleteTeamModalConfirm.disabled = true;
  try {
    await deleteDoc(doc(db, "staffAccounts", deletingUid));
    showToast("Team member removed.");
    closeDeleteTeamModal();
  } catch (err) {
    console.error("Delete team member error:", err);
    showToast(err.message || "Couldn't remove this team member. Please try again.", "error");
  } finally {
    deleteTeamModalConfirm.classList.remove("loading");
    deleteTeamModalConfirm.disabled = false;
  }
});

/* ===========================================================
   MANUAL TRANSFER BANK ACCOUNTS (up to 5, admin-only)
   Reads/writes settings/manualTransferBanks { accounts: [...] }
   as one array on one doc — cheap (one read), and 5 entries is
   small enough that a full-array read-modify-write is simpler
   and safer than a subcollection for something this size.
   =========================================================== */
const bankAccountList = document.getElementById("bankAccountList");
const bankAccountEmpty = document.getElementById("bankAccountEmpty");
const addBankAccountBtn = document.getElementById("addBankAccountBtn");
const addBankForm = document.getElementById("addBankForm");
const accountNumberInput = document.getElementById("accountNumberInput");
const verifyAccountBtn = document.getElementById("verifyAccountBtn");
const resolvedNameBox = document.getElementById("resolvedNameBox");
const resolvedNameValue = document.getElementById("resolvedNameValue");
const bankMsg = document.getElementById("bankMsg");
const saveBankBtn = document.getElementById("saveBankBtn");
const cancelBankBtn = document.getElementById("cancelBankBtn");

let currentBankAccounts = [];
let resolvedAccountName = null;

function renderBankAccounts() {
  if (!currentBankAccounts.length) {
    bankAccountList.innerHTML = "";
    bankAccountEmpty.style.display = "flex";
  } else {
    bankAccountEmpty.style.display = "none";
    bankAccountList.innerHTML = currentBankAccounts.map((acc) => `
      <div class="bank-account-card" data-id="${acc.id}">
        <div class="bac-icon"><i class="bx bx-bank"></i></div>
        <div class="bac-info">
          <strong>${escapeHtml(acc.accountName)}</strong>
          <span>${escapeHtml(acc.bankName)} · ${escapeHtml(acc.accountNumber)}</span>
        </div>
        <button type="button" class="team-icon-btn danger" data-act="delete-bank" aria-label="Remove"><i class="bx bx-trash"></i></button>
      </div>`).join("");

    bankAccountList.querySelectorAll('[data-act="delete-bank"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.closest(".bank-account-card").dataset.id;
        removeBankAccount(id);
      });
    });
  }

  addBankAccountBtn.style.display = currentBankAccounts.length >= MAX_BANK_ACCOUNTS ? "none" : "inline-flex";
}

async function loadBankAccounts() {
  try {
    const snap = await getDoc(doc(db, "settings", "manualTransferBanks"));
    currentBankAccounts = snap.exists() ? (snap.data().accounts || []) : [];
    renderBankAccounts();
  } catch (err) {
    console.error("Load bank accounts error:", err);
  }
}

async function saveBankAccountsToFirestore() {
  await setDoc(doc(db, "settings", "manualTransferBanks"), {
    accounts: currentBankAccounts,
    updatedAt: serverTimestamp(),
    updatedBy: currentAdmin.uid
  });
}

async function removeBankAccount(id) {
  currentBankAccounts = currentBankAccounts.filter((a) => a.id !== id);
  try {
    await saveBankAccountsToFirestore();
    renderBankAccounts();
    showToast("Bank account removed.");
  } catch (err) {
    console.error("Remove bank account error:", err);
    showToast("Couldn't remove that account. Please try again.", "error");
    loadBankAccounts(); // resync in case the local array drifted from Firestore
  }
}

function resetAccountResolution() {
  resolvedAccountName = null;
  resolvedNameBox.style.display = "none";
  saveBankBtn.disabled = true;
  bankMsg.style.display = "none";
}

function showBankMsg(text, type) {
  bankMsg.textContent = text;
  bankMsg.className = `mc-msg ${type}`;
  bankMsg.style.display = "block";
}

addBankAccountBtn.addEventListener("click", () => {
  addBankForm.style.display = "block";
  addBankAccountBtn.style.display = "none";
  bankCodeHidden.value = "";
  selectedBankText.textContent = "Select a bank…";
  accountNumberInput.value = "";
  resetAccountResolution();
});
cancelBankBtn.addEventListener("click", () => {
  addBankForm.style.display = "none";
  addBankAccountBtn.style.display = currentBankAccounts.length >= MAX_BANK_ACCOUNTS ? "none" : "inline-flex";
});

accountNumberInput.addEventListener("input", () => {
  accountNumberInput.value = accountNumberInput.value.replace(/\D/g, "").slice(0, 10);
  resetAccountResolution();
});

verifyAccountBtn.addEventListener("click", async () => {
  bankMsg.style.display = "none";
  const bankCode = bankCodeHidden.value;
  const accountNumber = accountNumberInput.value;

  if (!bankCode) { showBankMsg("Select a bank first.", "error"); return; }
  if (accountNumber.length !== 10) { showBankMsg("Enter a valid 10-digit account number.", "error"); return; }

  verifyAccountBtn.classList.add("loading");
  verifyAccountBtn.disabled = true;
  try {
    const idToken = await currentAdmin.getIdToken();
    const result = await callEdgeFunction(EDGE_FN.resolveAccount, { bank_code: bankCode, account_number: accountNumber }, idToken);

    resolvedAccountName = result?.account_name || null;
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
  if (currentBankAccounts.length >= MAX_BANK_ACCOUNTS) {
    showBankMsg(`Maximum of ${MAX_BANK_ACCOUNTS} accounts reached — remove one first.`, "error");
    return;
  }

  const bankCode = bankCodeHidden.value;
  const bankObj = NIGERIAN_BANKS.find(b => b.code === bankCode);
  const bankName = bankObj ? bankObj.name : selectedBankText.textContent;
  const newAccount = {
    id: `${bankCode}-${accountNumberInput.value}-${Date.now()}`,
    bankName,
    bankCode,
    accountNumber: accountNumberInput.value,
    accountName: resolvedAccountName
  };

  saveBankBtn.classList.add("loading");
  saveBankBtn.disabled = true;
  try {
    currentBankAccounts = [...currentBankAccounts, newAccount];
    await saveBankAccountsToFirestore();

    showToast("Bank account added — live for all users now.");
    renderBankAccounts();
    addBankForm.style.display = "none";
    bankSelect.value = "";
    accountNumberInput.value = "";
    resetAccountResolution();
  } catch (err) {
    console.error("Save bank account error:", err);
    showToast(err.message || "Couldn't save this account. Please try again.", "error");
    currentBankAccounts = currentBankAccounts.filter((a) => a.id !== newAccount.id);
  } finally {
    saveBankBtn.classList.remove("loading");
    saveBankBtn.disabled = false;
  }
});

/* ===========================================================
   MAINTENANCE — LOGIN LOCK (admin-only)
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
   FORCE LOGOUT EVERYONE (admin-only)
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
    lockedLocal = true;
    renderLockToggle();

    await setDoc(doc(db, "settings", "systemLock"), {
      locked: true,
      message: lockMessageInput.value.trim() || "TaskNOVA is undergoing scheduled maintenance — please check back shortly.",
      forceLogoutAt: serverTimestamp(),
      forceLogoutBy: currentAdmin.uid,
      updatedAt: serverTimestamp()
    }, { merge: true });

    showToast("Force logout triggered! All user sessions cleared and logins locked.");
    forceLogoutPanel.classList.remove("show");
    forceLogoutConfirmInput.value = "";
  } catch (err) {
    console.error("Force logout error:", err);
    showToast(err.message || "Couldn't force logout users. Please try again.", "error");
  } finally {
    forceLogoutConfirmBtn.classList.remove("loading");
    forceLogoutConfirmBtn.disabled = true;
  }
});

/* ===========================================================
   SUPPORT VIEW — "My Details" (read-only)
   =========================================================== */
const myFullName = document.getElementById("myFullName");
const myUsername = document.getElementById("myUsername");
const myEmail = document.getElementById("myEmail");
const myPassword = document.getElementById("myPassword");
const myPasswordToggle = document.getElementById("myPasswordToggle");

let myPasswordVisible = false;
myPasswordToggle?.addEventListener("click", () => {
  myPasswordVisible = !myPasswordVisible;
  myPassword.textContent = myPasswordVisible ? (currentStaffDoc?.password || "—") : "••••••••";
  myPasswordToggle.innerHTML = myPasswordVisible ? '<i class="bx bx-show"></i>' : '<i class="bx bx-hide"></i>';
});

function renderMyDetails() {
  if (!currentStaffDoc) return;
  myFullName.textContent = currentStaffDoc.fullName || "—";
  myUsername.textContent = "@" + (currentStaffDoc.username || "—");
  myEmail.textContent = currentStaffDoc.email || "—";
  myPassword.textContent = "••••••••";
  myPasswordVisible = false;
}

/* ---------------------------------------------------------
   AUTH GUARD — role check against staffAccounts/{uid}
   --------------------------------------------------------- */
const userNameEl = document.getElementById("menuUserName");
const userTypeEl = document.getElementById("menuUserType");
const userAvatarEl = document.getElementById("menuUserAvatar");
const pageSubtitle = document.getElementById("pageSubtitle");
const supportOnlySection = document.getElementById("supportOnlySection");
const adminOnlySection = document.getElementById("adminOnlySection");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentAdmin = user;

  try {
    const snap = await getDoc(doc(db, "staffAccounts", user.uid));
    if (!snap.exists()) {
      // Not a recognized staff account at all — bounce back to login,
      // same guard login.html itself already enforces.
      await signOut(auth);
      window.location.href = "login.html";
      return;
    }
    currentStaffDoc = snap.data();

    const fullName = currentStaffDoc.fullName || "Admin";
    const initial = fullName.trim().charAt(0).toUpperCase() || "A";
    if (userNameEl) userNameEl.textContent = fullName;
    if (userTypeEl) userTypeEl.textContent = currentStaffDoc.role === "admin" ? "Admin" : "Support";
    if (userAvatarEl) userAvatarEl.textContent = initial;

    if (currentStaffDoc.role === "admin") {
      pageSubtitle.textContent = "Platform-wide configuration for TaskNOVA.";
      adminOnlySection.style.display = "block";
      supportOnlySection.style.display = "none";
      subscribeTeam();
      loadBankAccounts();
      loadLockSettings();
    } else {
      pageSubtitle.textContent = "Your account details.";
      adminOnlySection.style.display = "none";
      supportOnlySection.style.display = "block";
      renderMyDetails();
    }
  } catch (err) {
    console.error("Load staff profile error:", err);
  }
});

/* ===========================================================
   NOTES
   ===========================================================
   - Admin identity now reads staffAccounts/{uid} — this is the
     new source of truth for every admin page's own name/avatar/
     role, replacing the old users/{uid} read every other admin
     page still carries as a flagged assumption. Apply the same
     swap to dashboard.html/users.html/tasks.html/etc. whenever
     each is next touched — none of them have been updated yet.

   - THREE new Supabase Edge Functions needed, none deployed yet.
     All three must verify the caller (Firebase ID token in the
     Authorization header) is themselves an existing admin
     (staffAccounts/{callerUid}.role === "admin") before doing
     anything — support accounts must never be able to call these,
     even by guessing the function URL directly, since the UI
     hiding these sections is not a real security boundary on its
     own.

     create-staff-account({ fullName, username, email, password, role })
       - Create the Firebase Auth user via Admin SDK
         (admin.auth().createUser({ email, password })) — doing
         this from the client instead would hijack the calling
         admin's own session, since the client SDK signs in as
         whatever user it just created.
       - Write staffAccounts/{newUid} = { fullName, username,
         email, password, role, createdAt, createdBy: callerUid }.

     update-staff-account({ uid, fullName?, username?, email?,
                             password?, role? })
       - For any of email/password: admin.auth().updateUser(uid,
         {...}) — the client SDK can't change another user's auth
         credentials, only Admin SDK can.
       - Merge the same fields into staffAccounts/{uid}.

     delete-staff-account({ uid })
       - Reject if uid === callerUid (self-delete blocked) — this
         is the REAL enforcement; the disabled button client-side
         is just a courtesy, not the security boundary.
       - admin.auth().deleteUser(uid), then delete
         staffAccounts/{uid}.

   - SECURITY TRADE-OFF, flagged explicitly rather than silently
     implemented: staffAccounts/{uid}.password stores the account's
     password in plain, readable text, specifically so support
     members can view their own password on this page if they
     forget it. This is a real risk — anyone who gains read access
     to that field (a misconfigured rule, a compromised admin
     session, a leaked Firestore export) gets a live plaintext
     password list for every staff account, and if any staff member
     reuses that password elsewhere, that account is exposed too.
     The safer alternative, if wanted instead: never store the
     password at all, show it once at creation time only (admin
     copies it down to share with the new hire), and if it's
     forgotten later, have the admin trigger a password reset
     rather than a lookup. Implemented as explicitly requested for
     now — swap it for the safer flow if this risk isn't acceptable
     on reflection.

   - Firestore Security Rules (not written/deployed anywhere yet,
     same as every other privileged pattern in this project) need
     to restrict staffAccounts reads: a support account should only
     ever be able to read its OWN doc (staffAccounts/{request.auth.uid}),
     never the full collection — the client code above already only
     fetches their own doc for support, but that's enforced by this
     page's code, not by a rule, so a support account with dev tools
     open could otherwise query the whole collection today.

   - Manual Transfer Bank Accounts moved from
     settings/manualTransferBank (single account) to
     settings/manualTransferBanks.accounts[] (up to 5). wallet.js
     currently reads the OLD single-doc path — it needs updating to
     read the new array and pick/rotate among the available accounts
     whenever it's next touched, or manual-transfer deposits will
     silently stop showing any account at all.

   - resolveBankAccount and forceLogoutAll both moved from the old
     raw-fetch Cloud Function pattern to Supabase Edge Functions via
     callEdgeFunction, matching the rest of this rework — see
     wallet.js's own BACKEND NOTES for resolveBankAccount's exact
     Flutterwave-side spec (unchanged, just a different transport).
   =========================================================== */
