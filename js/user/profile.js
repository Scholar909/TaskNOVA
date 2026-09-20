/* =========================================================
   TASKNOVA — PROFILE PAGE LOGIC
   Firebase v12.17.1 modular SDK

   Corrections applied this pass (see chat for full context):
   1. Account type / institution rows removed entirely — neither
      field is ever set anymore since the site-wide accountType/
      institution removal.
   2. Delete Account added at the bottom, gated on outstanding
      balance being exactly ₦0. Deletes the user's own Firestore
      data (main doc + transactions/notifications/referralRewards
      subcollections), writes an admin alert with the account's
      email so admin can remove the matching Firebase Auth entry
      (the client only ever deletes its OWN Firestore data here —
      it does not attempt to delete the Auth account itself; see
      the note at the end of this file for why and the simpler
      alternative if that's actually preferred).
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
  deleteDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  limit,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { initAuthGuard } from "./auth-guard.js";

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
   every other reworked page — copy it onto the rest as they're
   reworked.
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
   DATE / AGE HELPERS
   --------------------------------------------------------- */
function formatAccountAge(createdDate) {
  if (!createdDate) return "Account created —";
  const diffMs = Date.now() - createdDate.getTime();
  const days = Math.max(0, Math.floor(diffMs / 86400000));
  if (days === 0) return "Account created today";
  if (days === 1) return "Account created 1 day ago";
  return `Account created ${days} days ago`;
}

function formatMemberSince(createdDate) {
  if (!createdDate) return "—";
  return createdDate.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatNaira(amount) {
  return "₦" + (Number(amount) || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------------------------------------------------------
   AUTH GUARD + LIVE PROFILE DATA
   (Read-only except for the Delete Account action below.)
   --------------------------------------------------------- */
const profileAvatar = document.getElementById("profileAvatar");
const profileFullName = document.getElementById("profileFullName");
const profileUsername = document.getElementById("profileUsername");
const profileAccountAge = document.getElementById("profileAccountAge");

const infoEmail = document.getElementById("infoEmail");
const infoMemberSince = document.getElementById("infoMemberSince");

const declinesCount = document.getElementById("declinesCount");
const declinesFill = document.getElementById("declinesFill");
const declinesNote = document.getElementById("declinesNote");

const userNameEl = document.getElementById("menuUserName");
const userTypeEl = document.getElementById("menuUserType");
const userAvatarEl = document.getElementById("menuUserAvatar");
const alertDot = document.getElementById("alertDot");

let unsubscribeUserDoc = null;
let currentUser = null;
let currentUserData = { username: "", fullName: "", email: "", outstanding: 0 };

onAuthStateChanged(auth, (user) => {
  if (user) {
    initAuthGuard(db, auth, user);
  } else {
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
    const createdDate = data.createdAt?.toDate ? data.createdAt.toDate() : null;

    currentUserData = {
      username: data.username || "",
      fullName: data.fullName || "",
      email: data.email || user.email || "",
      outstanding: data.outstanding ?? 0
    };

    // Header menu drawer (shared chrome)
    if (userNameEl) userNameEl.textContent = fullName || user.email;
    // accountType/institutionAbbr are retired site-wide (no more
    // Student/Teacher/None distinction) — show the username instead.
    if (userTypeEl) userTypeEl.textContent = data.username ? "@" + data.username : user.email;
    if (userAvatarEl) userAvatarEl.textContent = initial;

    // Profile hero
    if (profileAvatar) profileAvatar.textContent = initial;
    if (profileFullName) {
      profileFullName.textContent = fullName;
      profileFullName.classList.remove("skeleton-text");
    }
    if (profileUsername) profileUsername.innerHTML = `<i class="bx bx-at"></i> ${data.username || "username"}`;
    if (profileAccountAge) profileAccountAge.textContent = formatAccountAge(createdDate);

    // Info list
    if (infoEmail) { infoEmail.textContent = data.email || user.email || "—"; infoEmail.classList.remove("skeleton"); }
    if (infoMemberSince) { infoMemberSince.textContent = formatMemberSince(createdDate); infoMemberSince.classList.remove("skeleton"); }

    // Task declines
    const declines = data.taskDeclines ?? 0;
    const resetCount = data.resetCount ?? 0;
    const percent = Math.min(100, (declines / 50) * 100);

    declinesFill.style.width = percent + "%";
    declinesFill.classList.remove("warn", "danger");
    declinesCount.classList.remove("warn", "danger");

    let resetTag = "";
    if (resetCount > 0) {
      resetTag = `<span class="reset-tag"><i class="bx bx-history"></i> ${resetCount}</span>`;
    }
    declinesCount.innerHTML = `<span class="num">${declines}</span>/50${resetTag}`;

    if (declines >= 50) {
      declinesFill.classList.add("danger");
      declinesCount.classList.add("danger");
      declinesNote.textContent = "Your account is locked. Pay the unlock fee to continue using TaskNOVA.";
    } else if (declines >= 40) {
      declinesFill.classList.add("warn");
      declinesCount.classList.add("warn");
      declinesNote.textContent = "You're close to the decline limit. At 50 declines your account is locked until the unlock fee is paid.";
    } else {
      declinesNote.textContent = "Getting your tasks declined too often can lock your account. At 50 declines your account is locked until the unlock fee is paid.";
    }

    if (!tawkSynced) {
      tawkSynced = true;
      syncTawkVisitor({ fullName: data.fullName, email: user.email, username: data.username });
    }
  }, (err) => {
    console.error("Profile listener error:", err);
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

/* ===========================================================
   DELETE ACCOUNT
   Blocked entirely while outstanding > 0 — the button itself
   still opens the modal in that case, but shows the blocking
   message instead of the confirm input, since the user needs to
   see WHY, not just have the button silently refuse to work.
   =========================================================== */
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const deleteModal = document.getElementById("deleteModal");
const deleteModalBackdrop = document.getElementById("deleteModalBackdrop");
const deleteModalClose = document.getElementById("deleteModalClose");
const deleteModalCancel = document.getElementById("deleteModalCancel");
const deleteModalConfirm = document.getElementById("deleteModalConfirm");
const deleteConfirmInput = document.getElementById("deleteConfirmInput");
const deleteModalMsg = document.getElementById("deleteModalMsg");

function openDeleteModal() {
  deleteConfirmInput.value = "";
  deleteModalConfirm.disabled = true;
  deleteModalMsg.style.display = "none";

  if (currentUserData.outstanding > 0) {
    deleteConfirmInput.style.display = "none";
    deleteModalMsg.style.display = "block";
    deleteModalMsg.className = "mc-msg error";
    deleteModalMsg.textContent = `You have an outstanding balance of ${formatNaira(currentUserData.outstanding)}. Clear it before you can delete your account.`;
  } else {
    deleteConfirmInput.style.display = "block";
  }

  deleteModal.classList.add("open");
  deleteModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeDeleteModal() {
  deleteModal.classList.remove("open");
  deleteModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

deleteAccountBtn?.addEventListener("click", openDeleteModal);
deleteModalBackdrop.addEventListener("click", closeDeleteModal);
deleteModalClose.addEventListener("click", closeDeleteModal);
deleteModalCancel.addEventListener("click", closeDeleteModal);

deleteConfirmInput.addEventListener("input", () => {
  deleteModalConfirm.disabled = deleteConfirmInput.value.trim() !== "DELETE";
});

// Deletes every doc in a subcollection, batching in pages of up to 300 —
// fine for the realistic size of a single user's own transactions/
// notifications/referralRewards; a genuinely huge account might need a
// couple of page reloads to fully clear, which is an acceptable edge case
// for a client-only deletion with no backend function behind it.
async function wipeSubcollection(uid, name) {
  const snap = await getDocs(query(collection(db, "users", uid, name), limit(300)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return snap.size;
}

deleteModalConfirm.addEventListener("click", async () => {
  if (currentUserData.outstanding > 0) return; // modal already shows why
  if (deleteConfirmInput.value.trim() !== "DELETE") return;
  if (!currentUser) return;

  deleteModalConfirm.classList.add("loading");
  deleteModalConfirm.disabled = true;

  try {
    // Notify admin FIRST — if this fails, abort entirely rather than wipe
    // Firestore data with nobody knowing to go remove the matching
    // Firebase Auth entry afterward.
    const alertRef = doc(collection(db, "adminAlerts"));
    await setDoc(alertRef, {
      type: "account_deletion_request",
      uid: currentUser.uid,
      email: currentUserData.email,
      username: currentUserData.username,
      fullName: currentUserData.fullName,
      status: "pending",
      requestedAt: serverTimestamp()
    });

    await wipeSubcollection(currentUser.uid, "transactions");
    await wipeSubcollection(currentUser.uid, "notifications");
    await wipeSubcollection(currentUser.uid, "referralRewards");
    await deleteDoc(doc(db, "users", currentUser.uid));

    await signOut(auth);
    window.location.href = "../index.html";
  } catch (err) {
    console.error("Delete account error:", err);
    deleteModalMsg.style.display = "block";
    deleteModalMsg.className = "mc-msg error";
    deleteModalMsg.textContent = "Couldn't delete your account. Please try again.";
  } finally {
    deleteModalConfirm.classList.remove("loading");
    deleteModalConfirm.disabled = false;
  }
});

/* ===========================================================
   NOTES
   ===========================================================
   - This only deletes the user's OWN Firestore footprint: their
     main users/{uid} doc plus the transactions/notifications/
     referralRewards subcollections. It does NOT touch tasks/ads
     they've posted, submissions they've made on others' tasks, or
     manualDeposits they've submitted — a client can't safely
     cascade-delete those without breaking other people's in-flight
     work (a worker mid-submission on their task, a pending manual
     deposit review, etc.). If truly complete erasure is wanted,
     that needs a privileged Supabase Edge Function that can make
     business-logic judgment calls (auto-decline and refund their
     pending tasks, keep-but-anonymize historical submissions
     others were already paid against, etc.) — not a raw delete.

   - The Firebase Auth account itself is deliberately NOT deleted
     from this page. A signed-in user CAN delete their own Auth
     account client-side (`deleteUser(auth.currentUser)`), but
     Firebase requires a recent sign-in for that, which means
     prompting for their password again right here — this page
     skips that UX entirely and instead writes an `adminAlerts` doc
     with their email so admin can remove the Auth entry manually
     (reusing the same delete flow already built for admin-initiated
     deletions in admin/users.js). If the reauth prompt is actually
     preferred over an admin queue, it's a small addition: import
     `reauthenticateWithCredential`/`EmailAuthProvider`, ask for the
     password in the modal, then call `deleteUser(currentUser)`
     before signing out — flag if that's wanted instead.

   - `adminAlerts` is a brand-new top-level collection this page
     introduces — nothing in the admin app reads it yet. Whichever
     admin page ends up owning "things needing admin attention"
     should add a tab/section that lists status:"pending" docs here
     and lets admin mark one "handled" once they've removed the
     matching Auth account.

   - Only `outstanding` gates deletion, per what was asked — a
     non-zero Deposit or Earned balance does NOT block deletion,
     it's simply forfeited (the modal's warning text says so). Flag
     if that should also require zeroing out first.

   - This page does not implement the inactivity-based automatic
     deletion (1 month with no earned-balance increase → warning →
     14 more days → deletion) — that lives in wallet.js (the page
     that displays the warning) and a Supabase scheduled function
     (the thing that actually decides and eventually deletes,
     independent of whether anyone has the app open). See wallet.js's
     own BACKEND NOTES for the full spec of that job, including that
     it should perform this exact same deletion procedure (own data
     wipe + adminAlerts doc) when it fires automatically.
   =========================================================== */
