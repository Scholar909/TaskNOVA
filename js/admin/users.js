/* =========================================================
   TASKNOVA ADMIN — USER MANAGEMENT PAGE LOGIC
   Firebase v12.17.1 modular SDK

   Corrections applied this pass (see chat for full context):
   1. Auth guard now reads staffAccounts/{uid}.role (admin or
      support) instead of the old users/{uid}.isAdmin flag.
   2. Support role sees the same table but gets a "View only" tag
      instead of Block/Delete buttons.
   3. delete-platform-user migrated from a raw Cloud Function
      fetch to a Supabase Edge Function via callEdgeFunction,
      matching the rest of this rework.
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
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs
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

const EDGE_FN = {
  deleteUser: "delete-platform-user"
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
   BUTTON LOADING HELPER
   --------------------------------------------------------- */
function setBtnLoading(btn, loading) {
  if (!btn) return;
  btn.classList.toggle("loading", loading);
  btn.disabled = loading;
}

/* ===========================================================
   AUTH GUARD — role check against staffAccounts/{uid}, same
   pattern as settings.js/dashboard.js. Both admin and support
   can view this page; support just doesn't get the action
   buttons (see applyRolePermissions below and renderUsers()).
   =========================================================== */
const menuUserName = document.getElementById("menuUserName");
const menuUserType = document.getElementById("menuUserType");
const menuUserAvatar = document.getElementById("menuUserAvatar");

let currentStaffRole = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "login.html"; return; }

  try {
    const snap = await getDoc(doc(db, "staffAccounts", user.uid));
    if (!snap.exists()) { await signOut(auth); window.location.href = "login.html"; return; }
    const data = snap.data();

    currentStaffRole = data.role;
    const fullName = data.fullName || "Admin";
    if (menuUserName) menuUserName.textContent = fullName;
    if (menuUserType) menuUserType.textContent = data.role === "admin" ? "Admin" : "Support";
    if (menuUserAvatar) menuUserAvatar.textContent = fullName.trim().charAt(0).toUpperCase() || "A";

    applyRolePermissions();
    loadUsers();
  } catch (err) {
    console.error("Admin auth check failed:", err);
    window.location.href = "login.html";
  }
});

/* ---------------------------------------------------------
   ROLE PERMISSIONS — support can view everything on this page
   but never edit: no Block/Unblock, no Delete. Row click through
   to User Details still works for both roles (that page applies
   the same read-only restriction on its own actions).
   --------------------------------------------------------- */
function applyRolePermissions() {
  document.body.classList.toggle("role-support", currentStaffRole !== "admin");
}

/* ===========================================================
   USER LIST — paginated load, client-side search/filter over
   what's currently loaded. See BACKEND NOTES at the bottom for
   how to scale this past a few hundred users.
   =========================================================== */
const PAGE_SIZE = 50;

const usersList = document.getElementById("usersList");
const usersEmpty = document.getElementById("usersEmpty");
const usersResultCount = document.getElementById("usersResultCount");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const userSearchInput = document.getElementById("userSearchInput");
const accountTypeFilter = document.getElementById("accountTypeFilter");

let loadedUsers = [];   // { uid, fullName, username, email, accountType, blocked }
let lastVisibleDoc = null;
let hasMore = true;
let isLoading = false;

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function typeBadgeClass(type) {
  if (type === "Student") return "type-badge student";
  if (type === "Teacher") return "type-badge teacher";
  return "type-badge";
}

function matchesFilters(u, term, typeFilter) {
  if (typeFilter) {
    const effectiveType = u.accountType === "Student" || u.accountType === "Teacher" ? u.accountType : "None";
    if (effectiveType !== typeFilter) return false;
  }
  if (!term) return true;
  const haystack = `${u.fullName || ""} ${u.username || ""} ${u.email || ""} ${u.accountType || ""}`.toLowerCase();
  return haystack.includes(term);
}

function renderUsers() {
  const term = userSearchInput.value.trim().toLowerCase();
  const typeFilter = accountTypeFilter.value;
  const filtered = loadedUsers.filter((u) => matchesFilters(u, term, typeFilter));

  usersResultCount.textContent = `Showing ${filtered.length.toLocaleString("en-NG")} of ${loadedUsers.length.toLocaleString("en-NG")} loaded users${hasMore ? " — load more to search further" : ""}`;

  if (!filtered.length) {
    usersList.innerHTML = "";
    usersEmpty.style.display = "flex";
    return;
  }
  usersEmpty.style.display = "none";

  usersList.innerHTML = filtered.map((u) => {
    const isBlocked = !!u.blocked;
    const effectiveType = u.accountType === "Student" || u.accountType === "Teacher" ? u.accountType : "None";
    return `
      <div class="users-row ${isBlocked ? "blocked-row" : ""}" data-uid="${u.uid}">
        <div class="uc-user">
          <strong>@${escapeHtml(u.username || "—")}</strong>
          <span>${escapeHtml(u.fullName || u.email || "—")}</span>
        </div>
        <div class="uc-type">
          <span class="${typeBadgeClass(effectiveType)}">${effectiveType}</span>
        </div>
        <div class="uc-status">
          <span class="status-pill ${isBlocked ? "blocked" : "active"}">
            <i class="bx bxs-circle"></i> ${isBlocked ? "Blocked" : "Active"}
          </span>
        </div>
        <div class="uc-actions">
          ${currentStaffRole === "admin" ? `
          <button type="button" class="row-action-btn block-toggle-btn" data-uid="${u.uid}" data-blocked="${isBlocked}">
            <i class="bx ${isBlocked ? "bx-lock-open-alt" : "bx-lock-alt"}"></i> ${isBlocked ? "Unblock" : "Block"}
          </button>
          <button type="button" class="row-action-btn danger delete-btn" data-uid="${u.uid}" data-username="${escapeHtml(u.username || u.uid)}">
            <i class="bx bx-trash"></i> Delete
          </button>
          ` : `<span class="view-only-tag" style="display:inline-flex;align-items:center;gap:5px;padding:8px 12px;border-radius:11px;background:var(--surface-2);border:1px solid var(--line);color:var(--text-soft);font-size:.76rem;font-weight:600;"><i class="bx bx-show"></i> View only</span>`}
        </div>
      </div>
    `;
  }).join("");
}

async function loadUsers() {
  if (isLoading || !hasMore) return;
  isLoading = true;
  setBtnLoading(loadMoreBtn, true);

  try {
    const usersRef = collection(db, "users");
    const q = lastVisibleDoc
      ? query(usersRef, orderBy("createdAt", "desc"), startAfter(lastVisibleDoc), limit(PAGE_SIZE))
      : query(usersRef, orderBy("createdAt", "desc"), limit(PAGE_SIZE));

    const snap = await getDocs(q);

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      loadedUsers.push({
        uid: docSnap.id,
        fullName: data.fullName || "",
        username: data.username || "",
        email: data.email || "",
        accountType: data.accountType || "None",
        blocked: !!data.blocked
      });
    });

    lastVisibleDoc = snap.docs[snap.docs.length - 1] || lastVisibleDoc;
    hasMore = snap.size === PAGE_SIZE;
    loadMoreBtn.style.display = hasMore ? "inline-flex" : "none";

    renderUsers();
  } catch (err) {
    console.error("Load users error:", err);
    usersResultCount.textContent = "Couldn't load users — please refresh.";
  } finally {
    isLoading = false;
    setBtnLoading(loadMoreBtn, false);
  }
}

userSearchInput.addEventListener("input", debounce(renderUsers, 200));
accountTypeFilter.addEventListener("change", renderUsers);
loadMoreBtn.addEventListener("click", loadUsers);

function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

/* ---------------------------------------------------------
   ROW CLICK → user-details.html?uid=… (skip when the click
   landed on one of the row's own action buttons)
   --------------------------------------------------------- */
usersList.addEventListener("click", (e) => {
  const blockBtn = e.target.closest(".block-toggle-btn");
  const deleteBtn = e.target.closest(".delete-btn");
  if (blockBtn) { e.stopPropagation(); toggleBlock(blockBtn); return; }
  if (deleteBtn) { e.stopPropagation(); openDeleteModal(deleteBtn.dataset.uid, deleteBtn.dataset.username); return; }

  const row = e.target.closest(".users-row");
  if (row?.dataset.uid) {
    window.location.href = `user-details.html?uid=${encodeURIComponent(row.dataset.uid)}`;
  }
});

/* ---------------------------------------------------------
   BLOCK / UNBLOCK — direct Firestore write. Doesn't move money,
   so it's protected purely by a Firestore rule requiring the
   caller's own staffAccounts/{uid}.role === "admin", same as the
   auth guard above.
   --------------------------------------------------------- */
async function toggleBlock(btn) {
  if (currentStaffRole !== "admin") return; // safety net — support has no button to trigger this anyway
  const uid = btn.dataset.uid;
  const isCurrentlyBlocked = btn.dataset.blocked === "true";
  const user = loadedUsers.find((u) => u.uid === uid);
  if (!user) return;

  btn.disabled = true;
  try {
    await updateDoc(doc(db, "users", uid), { blocked: !isCurrentlyBlocked });
    user.blocked = !isCurrentlyBlocked;
    renderUsers();
  } catch (err) {
    console.error("Block/unblock error:", err);
    btn.disabled = false;
    alert("Couldn't update this user's status — please try again.");
  }
}

/* ===========================================================
   DELETE — strong confirmation modal (must type the exact
   username before Delete Account enables), then a Cloud
   Function call since deleting a Firebase Auth account can't be
   done from the client. See BACKEND NOTES.
   =========================================================== */
const deleteModalBackdrop = document.getElementById("deleteModalBackdrop");
const deleteModalUsername = document.getElementById("deleteModalUsername");
const deleteConfirmTarget = document.getElementById("deleteConfirmTarget");
const deleteConfirmInput = document.getElementById("deleteConfirmInput");
const deleteModalMsg = document.getElementById("deleteModalMsg");
const deleteModalCancel = document.getElementById("deleteModalCancel");
const deleteModalConfirm = document.getElementById("deleteModalConfirm");

let pendingDeleteUid = null;
let pendingDeleteUsername = null;

function openDeleteModal(uid, username) {
  if (currentStaffRole !== "admin") return; // safety net — support has no button to trigger this anyway
  pendingDeleteUid = uid;
  pendingDeleteUsername = username;
  deleteModalUsername.textContent = "@" + username;
  deleteConfirmTarget.textContent = username;
  deleteConfirmInput.value = "";
  deleteModalMsg.className = "modal-msg";
  deleteModalMsg.textContent = "";
  deleteModalConfirm.disabled = true;
  deleteModalBackdrop.classList.add("open");
  setTimeout(() => deleteConfirmInput.focus(), 250);
}

function closeDeleteModal() {
  deleteModalBackdrop.classList.remove("open");
  pendingDeleteUid = null;
  pendingDeleteUsername = null;
}

deleteConfirmInput.addEventListener("input", () => {
  deleteModalConfirm.disabled = deleteConfirmInput.value.trim() !== pendingDeleteUsername;
});

deleteModalCancel.addEventListener("click", closeDeleteModal);
deleteModalBackdrop.addEventListener("click", (e) => { if (e.target === deleteModalBackdrop) closeDeleteModal(); });

deleteModalConfirm.addEventListener("click", async () => {
  if (!pendingDeleteUid || deleteConfirmInput.value.trim() !== pendingDeleteUsername) return;

  setBtnLoading(deleteModalConfirm, true);
  deleteModalMsg.className = "modal-msg";

  try {
    const idToken = await auth.currentUser.getIdToken();
    const result = await callEdgeFunction(EDGE_FN.deleteUser, { uid: pendingDeleteUid }, idToken);
    if (!result?.success) throw new Error(result?.error || "Deletion failed.");

    loadedUsers = loadedUsers.filter((u) => u.uid !== pendingDeleteUid);
    renderUsers();
    closeDeleteModal();
  } catch (err) {
    console.error("Delete user error:", err);
    deleteModalMsg.className = "modal-msg show error";
    deleteModalMsg.textContent = err.message || "Something went wrong. Please try again.";
  } finally {
    setBtnLoading(deleteModalConfirm, false);
  }
});

/* ===========================================================
   BACKEND NOTES (read before going live)
   ===========================================================
   1. delete-platform-user({ uid }) — Supabase Edge Function,
      admin-only (migrated from a raw Cloud Function fetch to
      match the rest of this rework's Supabase-based pattern).
      - Verify the caller's Firebase ID token AND that
        staffAccounts/{callerUid}.role === "admin" before doing
        anything — this is the real enforcement; the client's
        type-to-confirm modal and role-based button hiding are
        both just UX, not security boundaries on their own.
      - Delete the Firebase Auth account (admin.auth().deleteUser),
        the users/{uid} Firestore doc, and cascade whatever else
        should not be orphaned (their tasks, ads, wallet doc,
        notifications) — decide per-collection whether "delete"
        or "anonymize" is more appropriate (e.g. a completed task
        another user paid for probably shouldn't just vanish).

   2. Block/Unblock writes users/{uid}.blocked directly from the
      client. A Firestore rule must restrict this field's write
      access to callers whose own staffAccounts/{uid}.role ===
      "admin". Separately: every login/auth-guard flow on the
      *user* side should check this field and refuse access (or
      show a "blocked" message) — this page only flips the flag,
      it doesn't enforce it anywhere else.

   3. Search/filter here only covers whatever's currently loaded
      (50 users per page, newest first, via "Load more"). That's
      fine for a few hundred users; past that, replace the
      client-side substring match with either:
        a) denormalized lowercase fields (username_lower,
           email_lower, fullName_lower) written at signup, enabling
           real prefix-range Firestore queries, or
        b) a dedicated search service (Algolia/Typesense) synced
           from Firestore via a scheduled Supabase function.

   4. accountType (Student/Teacher/None column + filter) is dead —
      it's no longer set anywhere since the site-wide accountType/
      institution removal, so every user now shows "None" here
      regardless. Not touched this pass since users.html's table
      grid/column structure wasn't provided — worth removing the
      column and its filter dropdown entirely next time that HTML
      is available, same cleanup profile.html already got.

   5. Admin auth guard now reads staffAccounts/{uid}.role (either
      "admin" or "support" passes) — resolves the old flagged
      assumption about users/{uid}.isAdmin, which is no longer used
      anywhere. Support sees the same table and can open User
      Details, but gets a "View only" tag instead of Block/Delete
      buttons — enforced here in the UI and with a role check inside
      toggleBlock()/openDeleteModal() as a safety net, but the REAL
      enforcement has to be a Firestore Security Rule restricting
      writes to users/{uid}.blocked (and the delete function itself)
      to callers whose own staffAccounts/{callerUid}.role === "admin"
      — nothing stops a support account with dev tools open from
      calling updateDoc directly today.
   =========================================================== */
