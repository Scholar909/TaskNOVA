/* =========================================================
   TASKNOVA ADMIN — USER DETAILS PAGE LOGIC
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
  onSnapshot,
  updateDoc,
  deleteField
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

const ADMIN_FN = {
  deleteUser: "https://REGION-PROJECT.cloudfunctions.net/adminDeleteUser"
};

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
      if (entry.isIntersecting) { entry.target.classList.add("visible"); obs.unobserve(entry.target); }
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
   MENU GROUP ACCORDION
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
    window.location.href = "login.html";
  } catch (err) {
    console.error("Logout failed:", err);
  }
});

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */
function setBtnLoading(btn, loading) {
  if (!btn) return;
  btn.classList.toggle("loading", loading);
  btn.disabled = loading;
}

const nairaFormat = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2 });
function formatNaira(amount) { return nairaFormat.format(Number(amount) || 0); }

function formatAccountAge(createdDate) {
  if (!createdDate) return "—";
  const days = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 86400000));
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function formatMemberSince(createdDate) {
  if (!createdDate) return "—";
  return createdDate.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

/* ---------------------------------------------------------
   READ ?uid= FROM THE URL
   --------------------------------------------------------- */
const targetUid = new URLSearchParams(window.location.search).get("uid");

const detailsContent = document.getElementById("detailsContent");
const detailsNotFound = document.getElementById("detailsNotFound");

if (!targetUid) {
  window.location.href = "users.html";
}

/* ===========================================================
   AUTH GUARD — admin only. Same assumption as dashboard.js /
   users.js: users/{uid}.isAdmin === true.
   =========================================================== */
const menuUserName = document.getElementById("menuUserName");
const menuUserAvatar = document.getElementById("menuUserAvatar");

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "login.html"; return; }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : {};
    if (!data.isAdmin) { window.location.href = "login.html"; return; }

    const fullName = data.fullName || "Admin";
    if (menuUserName) menuUserName.textContent = fullName;
    if (menuUserAvatar) menuUserAvatar.textContent = fullName.trim().charAt(0).toUpperCase() || "A";

    listenTargetUser();
  } catch (err) {
    console.error("Admin auth check failed:", err);
    window.location.href = "login.html";
  }
});

/* ===========================================================
   PROFILE — live view of the target user's doc
   =========================================================== */
const detailsAvatar = document.getElementById("detailsAvatar");
const detailsFullName = document.getElementById("detailsFullName");
const detailsUsername = document.getElementById("detailsUsername");
const detailsStatusPill = document.getElementById("detailsStatusPill");

const roEmail = document.getElementById("roEmail");
const roUsername = document.getElementById("roUsername");
const roJoined = document.getElementById("roJoined");
const roAge = document.getElementById("roAge");

const editFullName = document.getElementById("editFullName");
const editAccountType = document.getElementById("editAccountType");
const editInstitutionWrap = document.getElementById("editInstitutionWrap");
const editInstitution = document.getElementById("editInstitution");
const editInstitutionAbbr = document.getElementById("editInstitutionAbbr");

const lifetimeDeposited = document.getElementById("lifetimeDeposited");
const lifetimeEarned = document.getElementById("lifetimeEarned");

const declinesFill = document.getElementById("declinesFill");
const declinesCount = document.getElementById("declinesCount");
const declinesNote = document.getElementById("declinesNote");

const referralTotal = document.getElementById("referralTotal");
const referralBonus = document.getElementById("referralBonus");

const blockToggleBtn = document.getElementById("blockToggleBtn");

let currentUserData = null;
let isEditing = false;

function updateInstitutionVisibility() {
  const needsInstitution = editAccountType.value === "Student" || editAccountType.value === "Teacher";
  editInstitutionWrap.style.display = needsInstitution ? "grid" : "none";
}

editAccountType.addEventListener("change", updateInstitutionVisibility);

function renderUser(data) {
  currentUserData = data;

  const fullName = data.fullName || "TaskNOVA User";
  const initial = fullName.trim().charAt(0).toUpperCase() || "T";
  const createdDate = data.createdAt?.toDate ? data.createdAt.toDate() : null;
  const isBlocked = !!data.blocked;

  detailsAvatar.textContent = initial;
  detailsFullName.textContent = fullName;
  detailsFullName.classList.remove("skeleton-text");
  detailsUsername.textContent = "@" + (data.username || "username");

  detailsStatusPill.className = `status-pill ${isBlocked ? "blocked" : "active"}`;
  detailsStatusPill.innerHTML = `<i class="bx bxs-circle"></i> ${isBlocked ? "Blocked" : "Active"}`;

  roEmail.textContent = data.email || "—"; roEmail.classList.remove("skeleton");
  roUsername.textContent = "@" + (data.username || "—"); roUsername.classList.remove("skeleton");
  roJoined.textContent = formatMemberSince(createdDate); roJoined.classList.remove("skeleton");
  roAge.textContent = formatAccountAge(createdDate); roAge.classList.remove("skeleton");

  // Never clobber fields the admin is actively editing.
  if (!isEditing) {
    editFullName.value = fullName;
    editAccountType.value = (data.accountType === "Student" || data.accountType === "Teacher") ? data.accountType : "None";
    editInstitution.value = data.institution || "";
    editInstitutionAbbr.value = data.institutionAbbr || "";
    updateInstitutionVisibility();
  }

  lifetimeDeposited.classList.remove("skeleton");
  lifetimeDeposited.textContent = formatNaira(data.lifetimeDeposited || 0);
  lifetimeEarned.classList.remove("skeleton");
  lifetimeEarned.textContent = formatNaira(data.lifetimeEarned || 0);

  const declines = data.taskDeclines ?? 0;
  const resetCount = data.resetCount ?? 0;
  const percent = Math.min(100, (declines / 50) * 100);

  declinesFill.style.width = percent + "%";
  declinesFill.classList.remove("warn", "danger");
  declinesCount.classList.remove("warn", "danger");

  const resetTag = resetCount > 0 ? ` (reset ${resetCount}×)` : "";
  declinesCount.textContent = `${declines}/50${resetTag}`;

  if (declines >= 50) {
    declinesFill.classList.add("danger");
    declinesCount.classList.add("danger");
    declinesNote.textContent = "Account locked until the unlock fee is paid.";
  } else if (declines >= 40) {
    declinesFill.classList.add("warn");
    declinesCount.classList.add("warn");
    declinesNote.textContent = "Close to the decline limit.";
  } else {
    declinesNote.textContent = "Within normal range.";
  }

  referralTotal.classList.remove("skeleton");
  referralTotal.textContent = (data.referralsTotal ?? 0).toLocaleString("en-NG");
  referralBonus.classList.remove("skeleton");
  referralBonus.textContent = (data.referralsBonusTriggered ?? 0).toLocaleString("en-NG");

  blockToggleBtn.innerHTML = `<i class="bx ${isBlocked ? "bx-lock-open-alt" : "bx-lock-alt"}"></i> ${isBlocked ? "Unblock" : "Block"}`;
}

function listenTargetUser() {
  onSnapshot(doc(db, "users", targetUid), (snap) => {
    if (!snap.exists()) {
      detailsContent.style.display = "none";
      detailsNotFound.style.display = "flex";
      return;
    }
    detailsContent.style.display = "";
    detailsNotFound.style.display = "none";
    renderUser({ uid: snap.id, ...snap.data() });
  }, (err) => {
    console.error("User details listener error:", err);
  });
}

/* ===========================================================
   EDIT — fullName, accountType, institution, institutionAbbr
   only. Email, username, createdAt are never editable here.
   =========================================================== */
const viewActions = document.getElementById("viewActions");
const editActions = document.getElementById("editActions");
const editToggleBtn = document.getElementById("editToggleBtn");
const editCancelBtn = document.getElementById("editCancelBtn");
const editSaveBtn = document.getElementById("editSaveBtn");
const editFormMsg = document.getElementById("editFormMsg");

const editableFields = [editFullName, editAccountType, editInstitution, editInstitutionAbbr];

function enterEditMode() {
  isEditing = true;
  editableFields.forEach((f) => { f.disabled = false; });
  viewActions.style.display = "none";
  editActions.style.display = "flex";
  editFormMsg.className = "edit-form-msg";
  editFormMsg.textContent = "";
}

function exitEditMode(revert) {
  isEditing = false;
  editableFields.forEach((f) => { f.disabled = true; });
  viewActions.style.display = "flex";
  editActions.style.display = "none";
  if (revert && currentUserData) renderUser(currentUserData);
}

editToggleBtn.addEventListener("click", enterEditMode);
editCancelBtn.addEventListener("click", () => exitEditMode(true));

editSaveBtn.addEventListener("click", async () => {
  const fullName = editFullName.value.trim();
  const accountType = editAccountType.value;
  const institution = editInstitution.value.trim();
  const institutionAbbr = editInstitutionAbbr.value.trim();

  editFormMsg.className = "edit-form-msg";
  editFormMsg.textContent = "";

  if (!fullName) {
    editFormMsg.className = "edit-form-msg show error";
    editFormMsg.textContent = "Full name can't be empty.";
    return;
  }
  if ((accountType === "Student" || accountType === "Teacher") && !institution) {
    editFormMsg.className = "edit-form-msg show error";
    editFormMsg.textContent = "Add an institution for this account type, or switch it to None.";
    return;
  }

  setBtnLoading(editSaveBtn, true);

  const updates = { fullName, accountType };
  if (accountType === "Student" || accountType === "Teacher") {
    updates.institution = institution;
    updates.institutionAbbr = institutionAbbr || null;
  } else {
    updates.institution = deleteField();
    updates.institutionAbbr = deleteField();
  }

  try {
    await updateDoc(doc(db, "users", targetUid), updates);
    editFormMsg.className = "edit-form-msg show success";
    editFormMsg.textContent = "Saved.";
    exitEditMode(false);
  } catch (err) {
    console.error("Save profile error:", err);
    editFormMsg.className = "edit-form-msg show error";
    editFormMsg.textContent = "Couldn't save changes — please try again.";
  } finally {
    setBtnLoading(editSaveBtn, false);
  }
});

/* ---------------------------------------------------------
   BLOCK / UNBLOCK — direct Firestore write, same as users.js.
   --------------------------------------------------------- */
blockToggleBtn.addEventListener("click", async () => {
  if (!currentUserData) return;
  const nextBlocked = !currentUserData.blocked;

  blockToggleBtn.disabled = true;
  try {
    await updateDoc(doc(db, "users", targetUid), { blocked: nextBlocked });
  } catch (err) {
    console.error("Block/unblock error:", err);
    alert("Couldn't update this user's status — please try again.");
  } finally {
    blockToggleBtn.disabled = false;
  }
});

/* ---------------------------------------------------------
   WALLET EDITS — hands off to Manual Transactions → Manual
   Changes, with the username prefilled via query string.
   --------------------------------------------------------- */
document.getElementById("walletEditsBtn").addEventListener("click", () => {
  if (!currentUserData?.username) return;
  window.location.href = `manual-transactions.html?tab=manual-changes&username=${encodeURIComponent(currentUserData.username)}`;
});

/* ===========================================================
   DELETE — same strong-confirmation modal pattern as users.js.
   On success, there's nothing left to show, so redirect back.
   =========================================================== */
const deleteBtn = document.getElementById("deleteBtn");
const deleteModalBackdrop = document.getElementById("deleteModalBackdrop");
const deleteModalUsername = document.getElementById("deleteModalUsername");
const deleteConfirmTarget = document.getElementById("deleteConfirmTarget");
const deleteConfirmInput = document.getElementById("deleteConfirmInput");
const deleteModalMsg = document.getElementById("deleteModalMsg");
const deleteModalCancel = document.getElementById("deleteModalCancel");
const deleteModalConfirm = document.getElementById("deleteModalConfirm");

function openDeleteModal() {
  if (!currentUserData?.username) return;
  deleteModalUsername.textContent = "@" + currentUserData.username;
  deleteConfirmTarget.textContent = currentUserData.username;
  deleteConfirmInput.value = "";
  deleteModalMsg.className = "modal-msg";
  deleteModalMsg.textContent = "";
  deleteModalConfirm.disabled = true;
  deleteModalBackdrop.classList.add("open");
  setTimeout(() => deleteConfirmInput.focus(), 250);
}

function closeDeleteModal() {
  deleteModalBackdrop.classList.remove("open");
}

deleteBtn.addEventListener("click", openDeleteModal);

deleteConfirmInput.addEventListener("input", () => {
  deleteModalConfirm.disabled = deleteConfirmInput.value.trim() !== currentUserData?.username;
});

deleteModalCancel.addEventListener("click", closeDeleteModal);
deleteModalBackdrop.addEventListener("click", (e) => { if (e.target === deleteModalBackdrop) closeDeleteModal(); });

deleteModalConfirm.addEventListener("click", async () => {
  if (!currentUserData || deleteConfirmInput.value.trim() !== currentUserData.username) return;

  setBtnLoading(deleteModalConfirm, true);
  deleteModalMsg.className = "modal-msg";

  try {
    const idToken = await auth.currentUser.getIdToken();
    const res = await fetch(ADMIN_FN.deleteUser, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken },
      body: JSON.stringify({ uid: targetUid })
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || "Deletion failed.");

    window.location.href = "users.html";
  } catch (err) {
    console.error("Delete user error:", err);
    deleteModalMsg.className = "modal-msg show error";
    deleteModalMsg.textContent = err.message || "Something went wrong. Please try again.";
    setBtnLoading(deleteModalConfirm, false);
  }
});

/* ===========================================================
   BACKEND NOTES (read before going live)
   ===========================================================
   1. adminDeleteUser(uid) — same Cloud Function contract as
      users.js: admin-only, verified server-side, deletes the
      Auth account + Firestore doc + cascades related data.

   2. lifetimeDeposited / lifetimeEarned — ASSUMPTION: these are
      running-total counter fields on users/{uid}, separate from
      the spendable wallet.deposit / wallet.earned balances (which
      go down on withdrawal/spend). They should only ever be
      incremented, never decremented, server-side: bump
      lifetimeDeposited whenever a deposit is verified (Paystack
      webhook, virtual-account webhook, or a manual deposit
      approval), and bump lifetimeEarned whenever a task payout
      lands in the user's earned wallet. If no such fields exist
      yet, they show as ₦0.00 until added.

   3. referralsTotal / referralsBonusTriggered — ASSUMPTION: also
      running counters on users/{uid} (incremented by whatever
      Cloud Function handles referral signups / bonus payouts),
      rather than computed by scanning the users collection for
      referredBy == uid on every page load.

   4. Editing accountType from Student/Teacher to None clears
      institution + institutionAbbr (deleteField()) so stale data
      doesn't linger. Switching back to Student/Teacher requires
      re-entering an institution.

   5. Wallet Edits hands off via
      manual-transactions.html?tab=manual-changes&username=…
      — when that page is built, it should read both query params
      on load: switch to the Manual Changes tab and auto-run the
      username fetch.

   6. Admin auth guard assumes users/{uid}.isAdmin === true, same
      unconfirmed assumption as dashboard.js and users.js.
   =========================================================== */
