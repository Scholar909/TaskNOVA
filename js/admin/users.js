/* =========================================================
   TASKNOVA ADMIN — USER MANAGEMENT PAGE LOGIC
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
  updateDoc,
  collection,
  query,
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
   BUTTON LOADING HELPER
   --------------------------------------------------------- */
function setBtnLoading(btn, loading) {
  if (!btn) return;
  btn.classList.toggle("loading", loading);
  btn.disabled = loading;
}

/* ===========================================================
   AUTH GUARD — admin only.
   ASSUMPTION: users/{uid}.isAdmin === true, same as dashboard.js.
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

    loadUsers();
  } catch (err) {
    console.error("Admin auth check failed:", err);
    window.location.href = "login.html";
  }
});

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
          <button type="button" class="row-action-btn block-toggle-btn" data-uid="${u.uid}" data-blocked="${isBlocked}">
            <i class="bx ${isBlocked ? "bx-lock-open-alt" : "bx-lock-alt"}"></i> ${isBlocked ? "Unblock" : "Block"}
          </button>
          <button type="button" class="row-action-btn danger delete-btn" data-uid="${u.uid}" data-username="${escapeHtml(u.username || u.uid)}">
            <i class="bx bx-trash"></i> Delete
          </button>
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
   so it's protected purely by Firestore rules requiring the
   caller's own users/{uid}.isAdmin === true, same assumption as
   the auth guard above.
   --------------------------------------------------------- */
async function toggleBlock(btn) {
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
    const res = await fetch(ADMIN_FN.deleteUser, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken },
      body: JSON.stringify({ uid: pendingDeleteUid })
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || "Deletion failed.");

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
   1. adminDeleteUser(uid) — Cloud Function, admin-only.
      - Verify the caller's ID token AND that
        users/{caller_uid}.isAdmin === true before doing anything.
      - Delete the Firebase Auth account (admin.auth().deleteUser),
        the users/{uid} Firestore doc, and cascade whatever else
        should not be orphaned (their tasks, ads, wallet doc,
        notifications) — decide per-collection whether "delete"
        or "anonymize" is more appropriate (e.g. a completed task
        another user paid for probably shouldn't just vanish).
      - This is destructive and irreversible — the client already
        gates it behind a type-to-confirm modal, but the function
        itself should still double-check isAdmin server-side.

   2. Block/Unblock writes users/{uid}.blocked directly from the
      client. Firestore rules must restrict this field's write
      access to callers whose own users/{uid}.isAdmin === true.
      Separately: every login/auth-guard flow across the *user*
      side should check this field and refuse access (or show a
      "blocked" message) — this page only flips the flag, it
      doesn't enforce it anywhere else.

   3. Search/filter here only covers whatever's currently loaded
      (50 users per page, newest first, via "Load more"). That's
      fine for a few hundred users; past that, replace the
      client-side substring match with either:
        a) denormalized lowercase fields (username_lower,
           email_lower, fullName_lower) written at signup, enabling
           real prefix-range Firestore queries, or
        b) a dedicated search service (Algolia/Typesense) synced
           from Firestore via a Cloud Function.

   4. accountType is assumed to be exactly "Student" or "Teacher"
      when set; anything else (including a missing field) is
      treated as "None", matching the Dashboard's breakdown logic.

   5. Admin auth guard assumes users/{uid}.isAdmin === true — same
      assumption as dashboard.js. Still unconfirmed against the
      actual admin login page; let me know if it differs.
   =========================================================== */
