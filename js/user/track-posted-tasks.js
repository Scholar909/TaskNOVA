/* =========================================================
   TASKNOVA — TRACK POSTED TASKS PAGE LOGIC
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
  getDocs,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
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
   CATEGORY LABELS + ICONS (same set used across Post Task / Earn)
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

const STATUS_LABELS = {
  draft: "Draft",
  pending_review: "Pending",
  active: "Active",
  declined: "Declined",
  completed: "Completed",
  expired: "Expired"
};

const MAX_DECLINES = 5;

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
   MINI RING (used/total)
   --------------------------------------------------------- */
let ringIdCounter = 0;

function ringSVG(filled, total, size = 40, stroke = 5) {
  const gradId = "tpt-ring-" + (ringIdCounter++);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.min(1, filled / total) : 0;
  const offset = circumference * (1 - pct);

  return `
    <div class="mini-ring-wrap" style="width:${size}px;height:${size}px;">
      <svg viewBox="0 0 ${size} ${size}">
        <defs>
          <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0067ff"/>
            <stop offset="100%" stop-color="#13cde5"/>
          </linearGradient>
        </defs>
        <circle class="mini-ring-track" cx="${size / 2}" cy="${size / 2}" r="${radius}"></circle>
        <circle class="mini-ring-fill" cx="${size / 2}" cy="${size / 2}" r="${radius}"
          stroke="url(#${gradId})"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
      </svg>
      <div class="mini-ring-label">${filled}/${total}</div>
    </div>`;
}

/* ---------------------------------------------------------
   STATE
   --------------------------------------------------------- */
const PAGE_SIZE = 10;

let currentUser = null;
let activeStatus = "pending_review";

let taskDocsMap = new Map();
let pageListeners = [];
let lastVisibleDoc = null;
let hasMore = true;
let isLoading = false;
let openTaskId = null;
let submissionsUnsub = null;

/* ---------------------------------------------------------
   DOM REFS
   --------------------------------------------------------- */
const taskList = document.getElementById("taskList");
const loadMoreWrap = document.getElementById("loadMoreWrap");
const loadMoreBtn = document.getElementById("loadMoreBtn");
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
   RENDER LIST
   --------------------------------------------------------- */
function sortedTasks() {
  return Array.from(taskDocsMap.values()).sort((a, b) => {
    const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bt - at;
  });
}

const EMPTY_MESSAGES = {
  draft: "No drafts saved.",
  pending_review: "Nothing waiting on admin review right now.",
  active: "No active tasks right now.",
  declined: "No declined tasks.",
  completed: "No completed tasks yet.",
  expired: "No expired tasks."
};

function render() {
  const tasks = sortedTasks();

  if (!tasks.length) {
    taskList.innerHTML = `<div class="task-empty"><i class="bx bx-inbox"></i>${EMPTY_MESSAGES[activeStatus] || "Nothing here yet."}</div>`;
    loadMoreWrap.style.display = "none";
    return;
  }

  taskList.innerHTML = tasks.map(renderTaskItem).join("");

  taskList.querySelectorAll(".task-row").forEach((row) => {
    row.addEventListener("click", () => toggleTask(row.closest(".task-item").dataset.id));
  });

  loadMoreWrap.style.display = hasMore ? "flex" : "none";
}

function renderTaskItem(task) {
  const meta = categoryMeta(task.category);
  const filled = task.slotsFilled ?? 0;
  const total = task.workersRequired ?? 0;
  const isOpen = task.id === openTaskId;

  return `
    <div class="task-item ${isOpen ? "open" : ""}" data-id="${task.id}">
      <div class="task-row">
        <div class="tr-icon"><i class="bx ${meta.icon}"></i></div>
        <div class="tr-body">
          <div class="tr-title">${task.title || "Untitled task"}</div>
          <div class="tr-price">${formatNaira(task.amountPerWorker)}</div>
          ${task.refundedAmount > 0 ? `<div class="tr-refund"><i class="bx bx-undo"></i> Refunded: <span>${formatNaira(task.refundedAmount)}</span></div>` : ""}
        </div>
        <div class="tr-badges">
          <span class="status-badge ${task.status}">${STATUS_LABELS[task.status] || task.status}</span>
        </div>
        ${total > 0 ? `<div class="mini-ring-wrap-outer">${ringSVG(filled, total)}</div>` : ""}
        <i class="bx bx-chevron-down tr-chevron"></i>
      </div>
      <div class="task-detail">
        <div>
          <div class="task-detail-inner" id="detail-${task.id}"></div>
        </div>
      </div>
    </div>`;
}

/* ---------------------------------------------------------
   EXPAND / COLLAPSE
   --------------------------------------------------------- */
async function toggleTask(taskId) {
  const wasOpen = openTaskId === taskId;

  if (submissionsUnsub) { submissionsUnsub(); submissionsUnsub = null; }
  openTaskId = wasOpen ? null : taskId;

  taskList.querySelectorAll(".task-item").forEach((item) => {
    item.classList.toggle("open", item.dataset.id === openTaskId);
  });

  if (!wasOpen && openTaskId) {
    renderTaskDetail(openTaskId);
  }
}

/* ---------------------------------------------------------
   DETAIL RENDER (differs per status)
   --------------------------------------------------------- */
function renderTaskDetail(taskId) {
  const task = taskDocsMap.get(taskId);
  const container = document.getElementById(`detail-${taskId}`);
  if (!task || !container) return;

  const meta = categoryMeta(task.category);
  const filled = task.slotsFilled ?? 0;
  const total = task.workersRequired ?? 0;

  const baseInfo = `
    <div class="td-section">
      <h3>Description</h3>
      <p>${task.description || "—"}</p>
    </div>
    <div class="td-meta-row">
      <span class="td-tag"><i class="bx ${meta.icon}"></i> ${meta.label}</span>
      ${task.location ? `<span class="td-tag"><i class="bx bx-map-pin"></i> ${task.location}</span>` : ""}
      ${task.urgent ? `<span class="td-tag"><i class="bx bx-bolt"></i> Urgent</span>` : ""}
    </div>
  `;

  if (task.status === "draft") {
    container.innerHTML = `
      ${baseInfo}
      <div class="action-row">
        <a class="action-btn primary" href="post-task.html?draft=${taskId}"><i class="bx bx-edit-alt"></i> Continue Editing</a>
        <button type="button" class="action-btn danger" id="deleteBtn-${taskId}"><span class="action-spinner"></span><i class="bx bx-trash"></i> Delete Draft</button>
      </div>
    `;
    wireDelete(taskId, false);
    return;
  }

  if (task.status === "pending_review") {
    container.innerHTML = `
      ${baseInfo}
      <div class="status-info-note"><i class="bx bx-time-five"></i> Waiting for admin review — usually within a few hours.</div>
      <div class="action-row">
        <button type="button" class="action-btn danger" id="deleteBtn-${taskId}"><span class="action-spinner"></span><i class="bx bx-trash"></i> Delete &amp; Refund</button>
      </div>
    `;
    wireDelete(taskId, true);
    return;
  }

  if (task.status === "completed") {
    container.innerHTML = `
      ${baseInfo}
      <div class="status-info-note"><i class="bx bx-flag-checkered"></i> Completed — all ${total} slot${total === 1 ? "" : "s"} filled and dealt with.</div>
    `;
    return;
  }

  if (task.status === "expired") {
    container.innerHTML = `
      ${baseInfo}
      <div class="status-info-note"><i class="bx bx-hourglass"></i> This task was active for 30 days without being completed and has expired. It can no longer be edited or reposted.</div>
      ${task.refundedAmount > 0 ? `<div class="status-info-note"><i class="bx bx-undo"></i> ${formatNaira(task.refundedAmount)} was refunded to your Deposit Balance for the unfilled slots.</div>` : ""}
      <div class="action-row">
        <button type="button" class="action-btn danger" id="deleteBtn-${taskId}"><span class="action-spinner"></span><i class="bx bx-trash"></i> Delete</button>
      </div>
    `;
    wireDelete(taskId, false);
    return;
  }

  if (task.status === "declined") {
    const history = task.declineHistory || [];
    const atMax = history.length >= MAX_DECLINES;

    container.innerHTML = `
      ${baseInfo}
      <div class="td-section">
        <h3>Decline history</h3>
        ${history.length ? `
          <ul class="decline-history-list">
            ${history.map((reason, i) => `<li><i class="bx bx-x-circle"></i><span>${i + 1}. ${reason}</span></li>`).join("")}
          </ul>` : `<p>No reason on record yet.</p>`}
      </div>
      ${atMax
        ? `<div class="max-declines-note"><i class="bx bx-block"></i> Maximum declines reached (${MAX_DECLINES}/${MAX_DECLINES}). This task can no longer be edited or reposted.</div>`
        : `<div class="action-row">
             <a class="action-btn primary" href="post-task.html?edit=${taskId}"><i class="bx bx-edit-alt"></i> Edit &amp; Repost</a>
           </div>`
      }
      <div class="action-row">
        <button type="button" class="action-btn danger" id="deleteBtn-${taskId}"><span class="action-spinner"></span><i class="bx bx-trash"></i> Delete &amp; Refund</button>
      </div>
    `;
    wireDelete(taskId, true);
    return;
  }

  // Active
  const canComplete = filled >= total;
  container.innerHTML = `
    ${baseInfo}

    <div class="action-row">
      <button type="button" class="action-btn" id="hideBtn-${taskId}">
        <span class="action-spinner"></span>
        <i class="bx ${task.hidden ? "bx-show" : "bx-hide"}"></i> ${task.hidden ? "Unhide" : "Hide"}
      </button>
      <button type="button" class="action-btn success" id="completeBtn-${taskId}" ${canComplete ? "" : "disabled"}>
        <span class="action-spinner"></span>
        <i class="bx bx-flag-checkered"></i> Mark Completed
      </button>
      <button type="button" class="action-btn danger" id="deleteBtn-${taskId}">
        <span class="action-spinner"></span>
        <i class="bx bx-trash"></i> Delete
      </button>
    </div>
    <p class="refund-note">Deleting refunds unused slots only — slots already filled or paid out are non-refundable. Tasks left active for 30 days without completing all slots expire automatically and refund unused slots the same way.</p>

    <div class="td-section">
      <h3>Submissions awaiting approval</h3>
      <div class="submissions-block" id="submissions-${taskId}">
        <div class="submissions-empty"><i class="bx bx-loader-alt bx-spin"></i> Loading…</div>
      </div>
    </div>
  `;

  wireHide(taskId, task.hidden);
  wireComplete(taskId);
  wireDelete(taskId, true);
  subscribeSubmissions(taskId);
}

/* ---------------------------------------------------------
   SUBMISSIONS (live, only while the task item is expanded)
   --------------------------------------------------------- */
function subscribeSubmissions(taskId) {
  const q = query(
    collection(db, "tasks", taskId, "submissions"),
    where("status", "==", "pending"),
    orderBy("submittedAt", "desc")
  );

  submissionsUnsub = onSnapshot(q, (snap) => {
    const wrap = document.getElementById(`submissions-${taskId}`);
    if (!wrap) return;

    if (snap.empty) {
      wrap.innerHTML = `<div class="submissions-empty">No pending submissions right now.</div>`;
      return;
    }

    wrap.innerHTML = snap.docs.map((d) => renderSubmissionCard(taskId, d.id, d.data())).join("");

    snap.docs.forEach((d) => wireSubmissionCard(taskId, d.id, d.data()));
  }, (err) => {
    console.error("Submissions listener error:", err);
  });
}

function renderSubmissionCard(taskId, subId, sub) {
  const when = sub.submittedAt?.toDate ? sub.submittedAt.toDate().toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

  return `
    <div class="submission-card" id="sub-${taskId}-${subId}">
      <div class="sc-head">
        <div class="sc-avatar">${(sub.workerUsername || "W").charAt(0).toUpperCase()}</div>
        <div class="sc-meta">
          <strong>${sub.workerUsername ? "@" + sub.workerUsername : "Worker"}</strong>
          <span>Submitted ${when}</span>
        </div>
      </div>

      ${(sub.screenshotUrls || []).length ? `
        <div class="sc-screenshots">
          ${sub.screenshotUrls.map((url) => `<img src="${url}" alt="Proof screenshot" onclick="window.open('${url}','_blank')">`).join("")}
        </div>` : ""}

      ${sub.textProof ? `<div class="sc-text">${sub.textProof}</div>` : ""}

      <div class="sc-actions">
        <button type="button" class="action-btn success" id="approveBtn-${subId}"><span class="action-spinner"></span><i class="bx bx-check"></i> Approve</button>
        <button type="button" class="action-btn danger" id="declineToggleBtn-${subId}"><i class="bx bx-x"></i> Decline</button>
      </div>

      <div class="sc-decline-reason" id="declineReason-${subId}">
        <textarea id="declineText-${subId}" placeholder="Reason for declining (shown to the worker)…"></textarea>
        <div class="sc-decline-buttons">
          <button type="button" class="action-btn danger" id="confirmDeclineBtn-${subId}"><span class="action-spinner"></span><i class="bx bx-x-circle"></i> Confirm Decline</button>
          <button type="button" class="action-btn" id="cancelDeclineBtn-${subId}">Cancel</button>
        </div>
      </div>
    </div>
  `;
}

function wireSubmissionCard(taskId, subId, sub) {
  document.getElementById(`approveBtn-${subId}`)?.addEventListener("click", () => approveSubmission(taskId, subId, sub));

  const declineToggle = document.getElementById(`declineToggleBtn-${subId}`);
  const reasonBox = document.getElementById(`declineReason-${subId}`);
  declineToggle?.addEventListener("click", () => reasonBox.classList.add("show"));
  document.getElementById(`cancelDeclineBtn-${subId}`)?.addEventListener("click", () => reasonBox.classList.remove("show"));
  document.getElementById(`confirmDeclineBtn-${subId}`)?.addEventListener("click", () => declineSubmission(taskId, subId));
}

/* ---------------------------------------------------------
   APPROVE / DECLINE SUBMISSION
   --------------------------------------------------------- */
async function approveSubmission(taskId, subId, sub) {
  const btn = document.getElementById(`approveBtn-${subId}`);
  btn.classList.add("loading");
  btn.disabled = true;

  try {
    const taskRef = doc(db, "tasks", taskId);
    const subRef = doc(db, "tasks", taskId, "submissions", subId);
    const workerRef = doc(db, "users", sub.workerUid);

    await runTransaction(db, async (transaction) => {
      const taskSnap = await transaction.get(taskRef);
      const subSnap = await transaction.get(subRef);
      const workerSnap = await transaction.get(workerRef);
      if (!taskSnap.exists() || !subSnap.exists() || !workerSnap.exists()) throw new Error("Record not found.");
      if (subSnap.data().status !== "pending") throw new Error("This submission was already handled.");

      const task = taskSnap.data();
      const workerEarned = workerSnap.data().wallet?.earned ?? 0;

      transaction.update(subRef, { status: "approved", approvedAt: serverTimestamp() });
      transaction.update(workerRef, { "wallet.earned": workerEarned + (task.workerPayout ?? task.amountPerWorker) });

      const txRef = doc(collection(db, "users", sub.workerUid, "transactions"));
      transaction.set(txRef, {
        type: "task_payment",
        direction: "credit",
        title: `Task approved: ${task.title}`,
        amount: task.workerPayout ?? task.amountPerWorker,
        status: "successful",
        createdAt: serverTimestamp()
      });
    });

    showToast("Submission approved — worker paid.");
  } catch (err) {
    console.error("Approve submission error:", err);
    showToast(err.message || "Couldn't approve — please try again.", "bx-error-circle");
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

async function declineSubmission(taskId, subId) {
  const reason = document.getElementById(`declineText-${subId}`)?.value.trim();
  if (!reason) {
    document.getElementById(`declineText-${subId}`)?.focus();
    return;
  }

  const btn = document.getElementById(`confirmDeclineBtn-${subId}`);
  btn.classList.add("loading");
  btn.disabled = true;

  try {
    const taskRef = doc(db, "tasks", taskId);
    const subRef = doc(db, "tasks", taskId, "submissions", subId);

    await runTransaction(db, async (transaction) => {
      const taskSnap = await transaction.get(taskRef);
      const subSnap = await transaction.get(subRef);
      if (!taskSnap.exists() || !subSnap.exists()) throw new Error("Record not found.");
      if (subSnap.data().status !== "pending") throw new Error("This submission was already handled.");

      const task = taskSnap.data();
      const newFilled = Math.max(0, (task.slotsFilled ?? 0) - 1);

      transaction.update(subRef, { status: "declined", declineReason: reason, declinedAt: serverTimestamp() });
      transaction.update(taskRef, { slotsFilled: newFilled, full: false }); // frees the slot back up on Earn
    });

    showToast("Submission declined — slot reopened.");
  } catch (err) {
    console.error("Decline submission error:", err);
    showToast(err.message || "Couldn't decline — please try again.", "bx-error-circle");
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

/* ---------------------------------------------------------
   HIDE / UNHIDE
   --------------------------------------------------------- */
function wireHide(taskId, currentlyHidden) {
  document.getElementById(`hideBtn-${taskId}`)?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.classList.add("loading");
    btn.disabled = true;
    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "tasks", taskId);
        const snap = await transaction.get(ref);
        if (!snap.exists()) throw new Error("Task not found.");
        transaction.update(ref, { hidden: !currentlyHidden });
      });
      showToast(currentlyHidden ? "Task unhidden." : "Task hidden.");
    } catch (err) {
      console.error("Hide/unhide error:", err);
      showToast("Something went wrong.", "bx-error-circle");
    } finally {
      btn.classList.remove("loading");
      btn.disabled = false;
    }
  });
}

/* ---------------------------------------------------------
   MARK COMPLETED
   --------------------------------------------------------- */
function wireComplete(taskId) {
  document.getElementById(`completeBtn-${taskId}`)?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.classList.add("loading");
    btn.disabled = true;

    try {
      const pendingSnap = await getDocsOnce(
        query(collection(db, "tasks", taskId, "submissions"), where("status", "==", "pending"))
      );
      if (!pendingSnap.empty) {
        showToast("Deal with the remaining pending submissions first.", "bx-error-circle");
        btn.classList.remove("loading");
        btn.disabled = false;
        return;
      }

      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "tasks", taskId);
        const snap = await transaction.get(ref);
        if (!snap.exists()) throw new Error("Task not found.");
        const data = snap.data();
        if ((data.slotsFilled ?? 0) < (data.workersRequired ?? 0)) throw new Error("Not all slots are filled yet.");
        transaction.update(ref, { status: "completed" });
      });

      showToast("Task marked completed.");
    } catch (err) {
      console.error("Mark completed error:", err);
      showToast(err.message || "Couldn't complete — please try again.", "bx-error-circle");
      btn.classList.remove("loading");
      btn.disabled = false;
    }
  });
}

async function getDocsOnce(q) {
  return getDocs(q);
}

/* ---------------------------------------------------------
   DELETE (with refund for unused slots — never for used ones)
   --------------------------------------------------------- */
function wireDelete(taskId, hasRefund) {
  document.getElementById(`deleteBtn-${taskId}`)?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const task = taskDocsMap.get(taskId);
    if (!task) return;

    const filled = task.slotsFilled ?? 0;
    const total = task.workersRequired ?? 0;

    if (task.status === "active") {
      // Block delete while submissions are still pending, per the doc's
      // Active Task Restrictions.
      const pendingSnap = await getDocsOnce(
        query(collection(db, "tasks", taskId, "submissions"), where("status", "==", "pending"))
      );
      if (!pendingSnap.empty) {
        showToast("Deal with pending submissions before deleting.", "bx-error-circle");
        return;
      }
    }

    let refund = 0;
    if (task.status === "pending_review" || task.status === "declined") {
      refund = task.totalCost || 0;
    } else if (task.status === "active" || task.status === "completed") {
      refund = Math.max(0, total - filled) * (task.amountPerWorker || 0);
    }
    // draft and expired always preview as 0 — drafts were never charged,
    // and expired tasks were already refunded automatically when they expired.

    const confirmMsg = refund > 0
      ? `Delete this task? ${formatNaira(refund)} for unused slots will be refunded to your Deposit Balance. This can't be undone.`
      : `Delete this task? This can't be undone.`;

    if (!window.confirm(confirmMsg)) return;

    btn.classList.add("loading");
    btn.disabled = true;

    try {
      const taskRef = doc(db, "tasks", taskId);

      await runTransaction(db, async (transaction) => {
        const taskSnap = await transaction.get(taskRef);
        if (!taskSnap.exists()) throw new Error("Task not found.");
        const data = taskSnap.data();

        let refundAmount = 0;
        if (data.status === "draft") {
          refundAmount = 0;
        } else if (data.status === "pending_review" || data.status === "declined") {
          refundAmount = data.totalCost || 0; // never went live — nothing was spent
        } else if (data.status === "active" || data.status === "completed") {
          const remaining = Math.max(0, (data.workersRequired ?? 0) - (data.slotsFilled ?? 0));
          refundAmount = remaining * (data.amountPerWorker || 0);
        }

        transaction.update(taskRef, { status: "deleted", hidden: true, deletedAt: serverTimestamp() });

        if (refundAmount > 0) {
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await transaction.get(userRef);
          const deposit = userSnap.data()?.wallet?.deposit ?? 0;
          transaction.update(userRef, { "wallet.deposit": deposit + refundAmount });

          const txRef = doc(collection(db, "users", currentUser.uid, "transactions"));
          transaction.set(txRef, {
            type: "refund",
            direction: "credit",
            title: `Refund from deleted task: ${data.title}`,
            amount: refundAmount,
            status: "successful",
            createdAt: serverTimestamp()
          });
        }
      });

      taskDocsMap.delete(taskId);
      openTaskId = null;
      render();
      showToast(refund > 0 ? `Task deleted — ${formatNaira(refund)} refunded.` : "Task deleted.");
    } catch (err) {
      console.error("Delete task error:", err);
      showToast(err.message || "Couldn't delete — please try again.", "bx-error-circle");
      btn.classList.remove("loading");
      btn.disabled = false;
    }
  });
}

/* ---------------------------------------------------------
   LIVE PAGINATED LIST (per status tab, employer's own tasks only)
   --------------------------------------------------------- */
function subscribeNextPage() {
  if (!currentUser || !hasMore || isLoading) return;
  isLoading = true;
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.disabled = true;

  const constraints = [
    where("employerUid", "==", currentUser.uid),
    where("status", "==", activeStatus),
    orderBy("createdAt", "desc")
  ];
  if (lastVisibleDoc) constraints.push(startAfter(lastVisibleDoc));
  constraints.push(limit(PAGE_SIZE));

  const q = query(collection(db, "tasks"), ...constraints);
  let firstFire = true;

  const unsub = onSnapshot(q, (snap) => {
    if (firstFire) {
      firstFire = false;
      isLoading = false;
      loadMoreBtn.classList.remove("loading");
      loadMoreBtn.disabled = false;

      if (snap.empty) {
        hasMore = false;
      } else {
        lastVisibleDoc = snap.docs[snap.docs.length - 1];
        hasMore = snap.docs.length === PAGE_SIZE;
      }
    }

    snap.docChanges().forEach((change) => {
      if (change.type === "removed") {
        taskDocsMap.delete(change.doc.id);
        if (openTaskId === change.doc.id) openTaskId = null;
      } else {
        taskDocsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
      }
    });

    render();

    // Keep an already-open task's detail fresh (e.g. slotsFilled changing
    // live while an employer is looking at it) without collapsing it.
    if (openTaskId && document.getElementById(`detail-${openTaskId}`)) {
      renderTaskDetail(openTaskId);
    }
  }, (err) => {
    console.error("Track posted tasks listener error:", err);
    isLoading = false;
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  });

  pageListeners.push(unsub);
}

function resetFeed() {
  pageListeners.forEach((unsub) => unsub());
  pageListeners = [];
  if (submissionsUnsub) { submissionsUnsub(); submissionsUnsub = null; }
  taskDocsMap = new Map();
  lastVisibleDoc = null;
  hasMore = true;
  openTaskId = null;
  taskList.innerHTML = `<div class="task-skeleton"></div><div class="task-skeleton"></div><div class="task-skeleton"></div>`;
  subscribeNextPage();
}

loadMoreBtn.addEventListener("click", subscribeNextPage);

statusTabs.addEventListener("click", (e) => {
  const chip = e.target.closest(".filter-chip");
  if (!chip || chip.dataset.status === activeStatus) return;
  statusTabs.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  activeStatus = chip.dataset.status;
  resetFeed();
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

  subscribeNextPage();
});

/* ===========================================================
   NOTES
   ===========================================================
   - Approve/Decline are real, working client-side Firestore
     transactions — no Cloud Function needed, since both are just
     the employer's own action moving data/wallet balances they
     already have permission over. Declining decrements
     slotsFilled and sets full: false, which is exactly what makes
     a task reappear on the live Earn feed automatically.

   - "Continue Editing" (Drafts) and "Edit & Repost" (Declined)
     link to post-task.html?draft=ID / ?edit=ID. post-task.html
     doesn't currently read those query params or pre-fill an
     existing task's data — that's a follow-up needed there before
     these buttons do anything beyond navigate.

   - Auto-approval after 24 hours (per the doc's Auto-Approval rule)
     genuinely needs a scheduled Cloud Function — it has to run
     whether or not the employer ever opens the app again. Nothing
     in this page can substitute for that.

   - declineHistory isn't written anywhere yet — that's the
     not-yet-built Admin Task Approval flow's job (admin declines
     a task pre-launch, appends a reason to declineHistory). Until
     that exists, the Declined tab will only show tasks if you add
     that field manually for testing.

   - Refund math on delete: pending_review/declined tasks refund
     their full totalCost (never went live, nothing spent). Active/
     completed tasks refund only (workersRequired - slotsFilled) *
     amountPerWorker — slots already filled (pending or approved)
     are treated as spent and non-refundable, matching the
     platform's non-refundable stance once money has actually gone
     toward real work.

   - Expired tasks: an active task that sits for 30 days without
     all slots being filled needs a scheduled Cloud Function (same
     category as auto-approval — must fire regardless of whether
     the employer ever reopens the app) that, once expired:
       - sets status: "expired"
       - computes refundAmount = (workersRequired - slotsFilled) *
         amountPerWorker, credits it to wallet.deposit, and stores
         that same number on the task doc as refundedAmount (this
         page reads that field to show "Refunded: ₦X" right on the
         card, and again in the expired detail view)
       - writes a transactions doc titled
         "Refund from expired task: <title>" so it shows up in
         Transaction History the same way a deleted-task refund
         does ("Refund from deleted task: <title>")
     Expired tasks cannot be edited or reposted — deleting one from
     this page afterward does NOT refund again (it was already
     refunded at the moment it expired); delete here is just
     cleanup.
   =========================================================== */
