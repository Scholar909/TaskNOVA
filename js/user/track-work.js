/* =========================================================
   TASKNOVA — TRACK WORK DONE PAGE LOGIC
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
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  updateDoc,
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
const SKRED_ADVERTISE_LINK = "https://invite.skred.mobi/Qs_nAiZ9TrqV9u2D0qYdfw.scQy7QXmaD_0bgLmTFh0f-y7Ihtw1tbXpftAcT-G-pc";

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
}

document.getElementById("floatingAdClose")?.addEventListener("click", (e) => {
  e.stopPropagation();
  floatingAd.style.display = "none";
});

// Floating support now opens the Tawk.to chat widget instead of linking to Skred
// (Skred is used only for ad banner inquiries — see the button on this page).
supportFab?.addEventListener("click", (e) => {
  e.preventDefault();
  if (window.Tawk_API && typeof Tawk_API.toggle === "function") {
    Tawk_API.toggle();
  }
});

/* ---------------------------------------------------------
   CATEGORY LABELS + ICONS (same set used across the platform)
   --------------------------------------------------------- */
const CATEGORY_META = {
  whatsapp: { label: "WhatsApp", icon: "bxl-whatsapp" },
  telegram: { label: "Telegram", icon: "bxl-telegram" },
  facebook: { label: "Facebook", icon: "bxl-facebook" },
  instagram: { label: "Instagram", icon: "bxl-instagram" },
  tiktok: { label: "TikTok", icon: "bxl-tiktok" },
  x: { label: "X / Twitter", icon: "bxl-twitter" },
  youtube: { label: "YouTube", icon: "bxl-youtube" },
  linkedin: { label: "LinkedIn", icon: "bxl-linkedin" },
  snapchat: { label: "Snapchat", icon: "bx-camera" },
  discord: { label: "Discord", icon: "bxl-discord-alt" },
  music: { label: "Spotify / Audiomack", icon: "bx-music" },
  app_testing: { label: "App Testing", icon: "bx-mobile-alt" },
  website_testing: { label: "Website Testing", icon: "bx-globe" },
  surveys: { label: "Surveys & Forms", icon: "bx-list-check" },
  ai_tasks: { label: "AI Tasks", icon: "bx-brain" },
  research: { label: "Data & Research", icon: "bx-search-alt" },
  documents: { label: "File & Document Tasks", icon: "bx-file" },
  promotional: { label: "Promotional Tasks", icon: "bx-megaphone-alt" },
  product_feedback: { label: "Product & Service Feedback", icon: "bx-message-square-detail" },
  education: { label: "Educational / Student Tasks", icon: "bx-book-open" }
};

function categoryMeta(key) {
  return CATEGORY_META[key] || { label: "Task", icon: "bx-task" };
}

/* ---------------------------------------------------------
   FORMAT HELPERS
   --------------------------------------------------------- */
const nairaFormat = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 0
});

function formatNaira(amount) {
  return nairaFormat.format(Number(amount) || 0);
}

function formatDate(ts) {
  const date = ts?.toDate ? ts.toDate() : null;
  if (!date) return "";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/* ---------------------------------------------------------
   STATE
   One live collectionGroup listener serves all four tabs —
   switching tabs just re-filters/re-renders locally, no new
   Firestore query per click.
   --------------------------------------------------------- */
const PAGE_SIZE = 20;

let currentUser = null;
let activeTab = "pending";

let workDocsMap = new Map(); // key: `${taskId}` (submission id == workerUid, so key by taskId)
let lastVisibleDoc = null;
let hasMore = true;
let isLoading = false;
let unsub = null;

const employerNameCache = new Map(); // uid -> display name, avoids repeat reads

/* ---------------------------------------------------------
   DOM REFS
   --------------------------------------------------------- */
const workList = document.getElementById("workList");
const statusTabs = document.getElementById("statusTabs");
const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");

function showToast(text, icon = "bx-check-circle") {
  toastText.textContent = text;
  toast.querySelector("i").className = "bx " + icon;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
}

/* ---------------------------------------------------------
   BUCKETING — which tab a submission belongs in right now
   --------------------------------------------------------- */
function bucketFor(sub) {
  if (sub.status === "pending") return "pending";
  if (sub.status === "approved") return "approved";
  if (sub.status === "declined") {
    // Currently under admin review (flagged, not yet resolved) -> Reported tab.
    if (sub.reported && sub.reportStatus === "pending") return "reported";
    // Otherwise it's a normal decline, whether or not it was ever reported
    // before (an admin-resolved-back-to-declined case still lives here,
    // now carrying two reasons).
    return "declined";
  }
  return "declined";
}

/* ---------------------------------------------------------
   RENDER
   --------------------------------------------------------- */
const EMPTY_MESSAGES = {
  pending: "Nothing awaiting employer decision right now.",
  approved: "No approved tasks yet.",
  declined: "No declined tasks.",
  reported: "No tasks currently under report review."
};

function render() {
  const items = Array.from(workDocsMap.values())
    .filter((w) => bucketFor(w) === activeTab)
    .sort((a, b) => {
      const at = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : 0;
      const bt = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : 0;
      return bt - at;
    });

  if (!items.length) {
    workList.innerHTML = `<div class="work-empty"><i class="bx bx-inbox"></i>${EMPTY_MESSAGES[activeTab]}</div>`;
    return;
  }

  workList.innerHTML = items.map(renderWorkCard).join("");
  items.forEach(wireCardIcons);
}

function renderWorkCard(sub) {
  const meta = categoryMeta(sub.category);
  const decline1 = sub.declineReason ? 1 : 0;
  const decline2 = sub.adminDeclineReason ? 1 : 0;
  const reasonCount = decline1 + decline2;

  let statusIconHtml = "";
  if (activeTab === "pending") {
    statusIconHtml = `<div class="status-icon pending"><i class="bx bx-time-five"></i></div>`;
  } else if (activeTab === "approved") {
    statusIconHtml = sub.autoApproved
      ? `<div class="status-icon approved"><i class="bx bx-check-double"></i></div>`
      : `<div class="status-icon approved"><i class="bx bx-check"></i></div>`;
  } else if (activeTab === "reported") {
    statusIconHtml = `<div class="status-icon reported"><i class="bx bx-flag"></i></div>`;
  } else {
    statusIconHtml = `<div class="status-icon declined"><i class="bx bx-x"></i></div>`;
  }

  const actionsHtml = activeTab === "declined" ? `
    <div class="wc-actions">
      <button type="button" class="wc-action-btn flag-btn" data-flag="${sub.taskId}" ${sub.reported ? "disabled" : ""} aria-label="Report">
        <i class="bx bx-flag"></i>
      </button>
      <button type="button" class="wc-action-btn" data-comment="${sub.taskId}" aria-label="View decline reason">
        <i class="bx bx-chat"></i>
        ${reasonCount > 0 ? `<span class="wc-comment-count">${reasonCount}</span>` : ""}
      </button>
    </div>
  ` : "";

  return `
    <div class="work-card" data-task="${sub.taskId}">
      <div class="wc-icon"><i class="bx ${meta.icon}"></i></div>
      <div class="wc-body">
        <div class="wc-title">${sub.taskTitle || "Task"}</div>
        <div class="wc-meta">
          <span class="wc-price">${formatNaira(sub.amountPerWorker)}</span>
          <span>· ${formatDate(sub.submittedAt)}</span>
          ${sub.autoApproved ? `<span class="auto-badge"><i class="bx bx-time"></i> Auto</span>` : ""}
        </div>
      </div>
      ${statusIconHtml}
      ${actionsHtml}
    </div>`;
}

function wireCardIcons(sub) {
  document.querySelector(`[data-flag="${sub.taskId}"]`)?.addEventListener("click", () => openReportModal(sub));
  document.querySelector(`[data-comment="${sub.taskId}"]`)?.addEventListener("click", () => openReasonModal(sub));
}

/* ---------------------------------------------------------
   REASON MODAL — employer's decline reason, plus admin's if present
   --------------------------------------------------------- */
const reasonModal = document.getElementById("reasonModal");
const reasonModalBackdrop = document.getElementById("reasonModalBackdrop");
const reasonModalClose = document.getElementById("reasonModalClose");
const reasonModalBody = document.getElementById("reasonModalBody");

async function resolveEmployerName(uid) {
  if (!uid) return "Employer";
  if (employerNameCache.has(uid)) return employerNameCache.get(uid);
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const name = snap.exists() ? ("@" + (snap.data().username || uid.slice(0, 8))) : uid.slice(0, 8);
    employerNameCache.set(uid, name);
    return name;
  } catch {
    return uid.slice(0, 8);
  }
}

async function openReasonModal(sub) {
  reasonModalBody.innerHTML = `<div class="reason-block"><div class="rb-text">Loading…</div></div>`;
  reasonModal.classList.add("open");
  reasonModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  const employerName = await resolveEmployerName(sub.employerUid);

  reasonModalBody.innerHTML = `
    <h2 class="wm-title">Decline reason</h2>
    <div class="reason-block">
      <div class="rb-who">${employerName}</div>
      <div class="rb-text">${sub.declineReason || "No reason given."}</div>
    </div>
    ${sub.adminDeclineReason ? `
      <div class="reason-block admin">
        <div class="rb-who">Admin</div>
        <div class="rb-text">${sub.adminDeclineReason}</div>
      </div>` : ""}
  `;
}

function closeReasonModal() {
  reasonModal.classList.remove("open");
  reasonModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

reasonModalBackdrop.addEventListener("click", closeReasonModal);
reasonModalClose.addEventListener("click", closeReasonModal);

/* ---------------------------------------------------------
   REPORT MODAL — write a complaint, locks after first use
   --------------------------------------------------------- */
const reportModal = document.getElementById("reportModal");
const reportModalBackdrop = document.getElementById("reportModalBackdrop");
const reportModalClose = document.getElementById("reportModalClose");
const reportReasonInput = document.getElementById("reportReasonInput");
const reportSubmitBtn = document.getElementById("reportSubmitBtn");
const reportMsg = document.getElementById("reportMsg");

let reportTargetTaskId = null;

function openReportModal(sub) {
  if (sub.reported) return; // already reported once — locked
  reportTargetTaskId = sub.taskId;
  reportReasonInput.value = "";
  reportMsg.className = "panel-msg";
  reportMsg.innerHTML = "";
  reportModal.classList.add("open");
  reportModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeReportModal() {
  reportModal.classList.remove("open");
  reportModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  reportTargetTaskId = null;
}

reportModalBackdrop.addEventListener("click", closeReportModal);
reportModalClose.addEventListener("click", closeReportModal);

reportSubmitBtn.addEventListener("click", async () => {
  const text = reportReasonInput.value.trim();
  if (!text) {
    reportMsg.className = "panel-msg show error";
    reportMsg.innerHTML = `<i class="bx bx-error-circle"></i><span>Please explain why you're reporting this decline.</span>`;
    return;
  }
  if (!reportTargetTaskId || !currentUser) return;

  reportSubmitBtn.classList.add("loading");
  reportSubmitBtn.disabled = true;

  try {
    const subRef = doc(db, "tasks", reportTargetTaskId, "submissions", currentUser.uid);
    await updateDoc(subRef, {
      reported: true,
      reportStatus: "pending",
      reportReason: text,
      reportedAt: serverTimestamp()
    });

    closeReportModal();
    showToast("Reported — an admin will review it.");
  } catch (err) {
    console.error("Report submission error:", err);
    reportMsg.className = "panel-msg show error";
    reportMsg.innerHTML = `<i class="bx bx-error-circle"></i><span>Couldn't submit — please try again.</span>`;
  } finally {
    reportSubmitBtn.classList.remove("loading");
    reportSubmitBtn.disabled = false;
  }
});

/* ---------------------------------------------------------
   LIVE COLLECTION-GROUP QUERY — every submission this worker has
   ever made, across every task, in one listener.
   --------------------------------------------------------- */
function subscribeWork() {
  if (!currentUser) return;

  const q = query(
    collectionGroup(db, "submissions"),
    where("workerUid", "==", currentUser.uid),
    orderBy("submittedAt", "desc"),
    limit(PAGE_SIZE)
  );

  unsub = onSnapshot(q, (snap) => {
    snap.docChanges().forEach((change) => {
      const data = change.doc.data();
      const key = data.taskId || change.doc.id;

      if (change.type === "removed") {
        workDocsMap.delete(key);
      } else {
        workDocsMap.set(key, data);
      }
    });

    render();
  }, (err) => {
    console.error("Track work done listener error:", err);
    workList.innerHTML = `<div class="work-empty"><i class="bx bx-error-circle"></i>Couldn't load your submissions. Please try again.</div>`;
  });
}

statusTabs.addEventListener("click", (e) => {
  const chip = e.target.closest(".filter-chip");
  if (!chip || chip.dataset.status === activeTab) return;
  statusTabs.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  activeTab = chip.dataset.status;
  render();
});

/* ---------------------------------------------------------
   AUTH GUARD
   --------------------------------------------------------- */
const userNameEl = document.getElementById("menuUserName");
const userTypeEl = document.getElementById("menuUserType");
const userAvatarEl = document.getElementById("menuUserAvatar");
const alertDot = document.getElementById("alertDot");

let unsubscribeUserDoc = null;

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

  unsubscribeUserDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    const fullName = data.fullName || "TaskNOVA User";
    const initial = fullName.trim().charAt(0).toUpperCase() || "T";

    if (userNameEl) userNameEl.textContent = fullName || user.email;
    if (userTypeEl) userTypeEl.textContent = data.accountType ? data.accountType + (data.institutionAbbr ? " · " + data.institutionAbbr : "") : user.email;
    if (userAvatarEl) userAvatarEl.textContent = initial;
  }, (err) => {
    console.error("User doc listener error:", err);
  });

  // Lightweight unread check — existence only (limit 1), not a count.
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

  if (unsub) unsub();
  subscribeWork();
});

/* ===========================================================
   NOTES
   ===========================================================
   - This page reads via a single collectionGroup("submissions")
     query filtered to this worker's own uid — one live listener
     covers all four tabs; switching tabs just re-filters what's
     already loaded, no extra reads. Needs a Firestore composite
     index (collection group + workerUid + orderBy submittedAt) —
     the first time this runs, Firestore's console error includes
     a direct link to create it. Normal, one-time, not a bug.

   - Cards are deliberately not expandable — per the request, this
     page is for record-keeping only. The only interactive bits
     live on Declined cards: the flag (report) and comment (view
     reasons) icons.

   - Reporting works client-side (a plain updateDoc setting
     reported/reportStatus/reportReason) — no Cloud Function
     needed, since the worker is only writing to their own
     submission doc. reported stays true forever once set, which
     is what permanently disables the flag button afterward.

   - autoApproved is read but never written here — that flag needs
     to be set by the same scheduled Cloud Function that handles
     24-hour auto-approval (flagged already on Track Posted Tasks).
     Until that exists, every approval shown here will look
     manual (no "Auto" badge).

   - The admin side of this loop isn't built yet: reviewing a
     report and either (a) approving it — flip submission status
     to "approved", credit the worker's Earned Balance, same as a
     normal approval — or (b) declining it — set
     reportStatus: "declined" and adminDeclineReason: "...", which
     is what makes the Declined tab show a second reason and
     permanently disables the flag (reported stays true, count
     becomes 2). That belongs to the Admin Task/Report Management
     page.
   =========================================================== */
