/* =========================================================
   TASKNOVA ADMIN — SETTINGS PAGE LOGIC
   Firebase v12.17.1 modular SDK
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
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

// Secondary app instance to create new Auth users without logging out current Admin
const secondaryApp = initializeApp(firebaseConfig, "SecondaryAuthApp");
const secondaryAuth = getAuth(secondaryApp);

let currentAdmin = null;
let currentStaffDoc = null; // { role, fullName, username, email, password }

let allBanks = [];

// Fetch live Flutterwave bank codes on page load (same as wallet.js)
async function loadAdminBanks() {
  try {
    const idToken = await currentAdmin.getIdToken();
    allBanks = await callEdgeFunction("list-banks", {}, idToken);
    populateBankOptions();
  } catch (err) {
    console.error("Failed to load Flutterwave banks:", err);
  }
}

function populateBankOptions(filter = "") {
  bankOptionsList.innerHTML = "";
  const queryStr = filter.toLowerCase().trim();
  const filtered = allBanks.filter(b => b.name.toLowerCase().includes(queryStr));

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
   THEME
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
   TOAST & HELPERS
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

/* ---------------------------------------------------------
   DUPLICATE EMAIL & USERNAME CHECK HELPERS
   --------------------------------------------------------- */
async function isEmailTaken(email, excludeUid = null) {
  const emailLower = email.toLowerCase().trim();

  // Check staffAccounts collection
  const staffSnap = await getDocs(collection(db, "staffAccounts"));
  for (const docSnap of staffSnap.docs) {
    if (docSnap.id === excludeUid) continue;
    const data = docSnap.data();
    if (data.email && data.email.toLowerCase().trim() === emailLower) {
      return true;
    }
  }

  // Check users collection
  const usersQ = query(collection(db, "users"), where("email", "==", email.trim()));
  const usersSnap = await getDocs(usersQ);
  for (const docSnap of usersSnap.docs) {
    if (docSnap.id === excludeUid) continue;
    return true;
  }

  return false;
}

async function isUsernameTaken(username, excludeUid = null) {
  const unLower = username.toLowerCase().trim();

  // Check staffAccounts collection
  const staffSnap = await getDocs(collection(db, "staffAccounts"));
  for (const docSnap of staffSnap.docs) {
    if (docSnap.id === excludeUid) continue;
    const data = docSnap.data();
    if (data.username && data.username.toLowerCase().trim() === unLower) {
      return true;
    }
  }

  // Check users collection
  const usersQ = query(collection(db, "users"), where("usernameLower", "==", unLower));
  const usersSnap = await getDocs(usersQ);
  for (const docSnap of usersSnap.docs) {
    if (docSnap.id === excludeUid) continue;
    return true;
  }

  return false;
}

/* ===========================================================
   TEAM MEMBERS (admin-only)
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
        <button type="button" class="team-icon-btn danger" data-act="delete-team" ${isSelf ? "disabled" : ""} aria-label="Remove" title="${isSelf ? "You can't remove your own account" : "Remove"}"><i class="bx bx-trash"></i></button>
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
    teamModalTitle.textContent = "Edit Team Member";
    teamPasswordHint.textContent = "(leave blank to keep current password)";
    teamPassword.placeholder = "Leave blank to keep unchanged";
    teamPassword.value = "";
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
    // 1. Check if email is already in use
    const emailInUse = await isEmailTaken(email, editingUid);
    if (emailInUse) {
      showTeamModalMsg("This email address is already in use by another account.");
      teamModalSave.classList.remove("loading");
      teamModalSave.disabled = false;
      return;
    }

    // 2. Check if username is already taken
    const usernameInUse = await isUsernameTaken(username, editingUid);
    if (usernameInUse) {
      showTeamModalMsg("This username is already taken. Please choose another.");
      teamModalSave.classList.remove("loading");
      teamModalSave.disabled = false;
      return;
    }

    if (editingUid) {
      // Edit existing staff account
      const payload = {
        fullName,
        username,
        email,
        role,
        updatedAt: serverTimestamp()
      };
      if (password) payload.password = password;

      await setDoc(doc(db, "staffAccounts", editingUid), payload, { merge: true });

      // Trigger Edge Function sync if available
      try {
        const idToken = await currentAdmin.getIdToken();
        await callEdgeFunction(EDGE_FN.updateStaffAccount, { uid: editingUid, fullName, username, email, password, role }, idToken);
      } catch (e) {
        console.warn("Edge function updateStaffAccount warning:", e);
      }

      showToast("Team member updated.");
    } else {
      // Create NEW Firebase Auth user via secondaryAuth
      let newUid = null;
      try {
        const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const newAuthUser = cred.user;
        newUid = newAuthUser.uid;

        // Send verification confirmation link to their email
        await sendEmailVerification(newAuthUser);

        // Sign out secondary session immediately
        await signOut(secondaryAuth);
      } catch (authErr) {
        if (authErr.code === "auth/email-already-in-use") {
          showTeamModalMsg("This email address is already registered in Firebase Authentication.");
        } else if (authErr.code === "auth/invalid-email") {
          showTeamModalMsg("Invalid email format.");
        } else if (authErr.code === "auth/weak-password") {
          showTeamModalMsg("Password must be at least 6 characters.");
        } else {
          showTeamModalMsg(authErr.message || "Failed to create authentication account.");
        }
        teamModalSave.classList.remove("loading");
        teamModalSave.disabled = false;
        return;
      }

      // Save document in Firestore under staffAccounts/{newUid}
      const payload = {
        uid: newUid,
        fullName,
        username,
        email,
        password,
        role,
        createdAt: serverTimestamp(),
        createdBy: currentAdmin.uid
      };

      await setDoc(doc(db, "staffAccounts", newUid), payload);

      // Trigger Edge Function sync if available
      try {
        const idToken = await currentAdmin.getIdToken();
        await callEdgeFunction(EDGE_FN.createStaffAccount, payload, idToken);
      } catch (e) {
        console.warn("Edge function createStaffAccount warning:", e);
      }

      showToast("Team member added! Verification email link sent.");
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

    try {
      const idToken = await currentAdmin.getIdToken();
      await callEdgeFunction(EDGE_FN.deleteStaffAccount, { uid: deletingUid }, idToken);
    } catch (e) {
      console.warn("Edge function deleteStaffAccount warning:", e);
    }

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
    loadBankAccounts();
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
  const bankObj = allBanks.find(b => b.code === bankCode);  const bankName = bankObj ? bankObj.name : selectedBankText.textContent;
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
      loadAdminBanks();
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