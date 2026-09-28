/* =========================================================
   TASKNOVA ADMIN — TASKS & REQUESTS PAGE LOGIC
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
  where,
  orderBy,
  limit,
  onSnapshot,
  getCountFromServer,
  arrayUnion,
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

const MAX_DECLINES = 5;
const PAGE_SIZE = 15;

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

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */
function formatNaira(n) {
  return "₦" + (Number(n) || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// Cache of employerUid/requesterUid -> { fullName, username }
const userCache = new Map();
async function getUserSummary(uid) {
  if (!uid) return { fullName: "Unknown user", username: "" };
  if (userCache.has(uid)) return userCache.get(uid);
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const summary = snap.exists()
      ? { fullName: snap.data().fullName || "TaskNOVA User", username: snap.data().username || "" }
      : { fullName: "Deleted user", username: "" };
    userCache.set(uid, summary);
    return summary;
  } catch {
    return { fullName: "Unknown user", username: "" };
  }
}

/* ---------------------------------------------------------
   TABS
   --------------------------------------------------------- */
const tabButtons = document.querySelectorAll(".tnr-tab");
const panels = document.querySelectorAll(".tnr-panel");
const loadedTabs = new Set();

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    tabButtons.forEach((b) => { b.classList.toggle("active", b === btn); b.setAttribute("aria-selected", b === btn ? "true" : "false"); });
    panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === tab));
    if (!loadedTabs.has(tab)) {
      loadedTabs.add(tab);
      subscribeTab(tab, true);
    }
  });
});

/* ---------------------------------------------------------
   TAB CONFIG
   --------------------------------------------------------- */
const TAB_CONFIG = {
  pending: {
    coll: "tasks",
    constraints: [where("status", "==", "pending_review")],
    order: ["createdAt", "asc"],
    listEl: "listPending", emptyEl: "emptyPending", metaEl: "metaPending", loadMoreEl: "loadMorePending",
    emptyText: "No tasks waiting for review.",
    render: renderTaskCard
  },
  active: {
    coll: "tasks",
    constraints: [where("status", "==", "active")],
    order: ["createdAt", "desc"],
    listEl: "listActive", emptyEl: "emptyActive", metaEl: "metaActive", loadMoreEl: "loadMoreActive",
    emptyText: "No active tasks right now.",
    render: renderTaskCard
  },
  declined: {
    coll: "tasks",
    constraints: [where("status", "==", "declined")],
    order: ["declinedAt", "desc"],
    listEl: "listDeclined", emptyEl: "emptyDeclined", metaEl: "metaDeclined", loadMoreEl: "loadMoreDeclined",
    emptyText: "No declined tasks.",
    render: renderTaskCard
  },
  completed: {
    coll: "tasks",
    constraints: [where("status", "==", "completed")],
    order: ["createdAt", "desc"],
    listEl: "listCompleted", emptyEl: "emptyCompleted", metaEl: "metaCompleted", loadMoreEl: "loadMoreCompleted",
    emptyText: "No completed tasks yet.",
    render: renderTaskCard
  },
  requests: {
    coll: "taskRequests",
    constraints: [where("status", "==", "pending_review")],
    order: ["createdAt", "desc"],
    listEl: "listRequests", emptyEl: "emptyRequests", metaEl: "metaRequests", loadMoreEl: "loadMoreRequests",
    emptyText: "Nothing here.",
    render: renderRequestCard
  }
};

// per-tab live state: a single onSnapshot per tab, re-subscribed with a
// bigger `limit` each time "Load more" is clicked (see subscribeTab notes)
const tabState = {};
function freshState() { return { unsub: null, pageSize: PAGE_SIZE, hasMore: true, count: 0 }; }
Object.keys(TAB_CONFIG).forEach((k) => { tabState[k] = freshState(); });

/* ---------------------------------------------------------
   SUBSCRIBE A TAB — one onSnapshot per tab (live updates), whose
   `limit` grows by PAGE_SIZE each time "Load more" is clicked.
   Re-subscribing on every growth re-sends the whole (bigger)
   window, which is simpler than merging realtime updates with a
   startAfter cursor and still gives every loaded row live data
   (an admin approving/declining elsewhere updates this list
   instantly instead of needing a refresh).
   --------------------------------------------------------- */
async function subscribeTab(tabKey, reset = false) {
  const cfg = TAB_CONFIG[tabKey];
  const state = tabState[tabKey];

  if (reset) {
    if (state.unsub) { state.unsub(); state.unsub = null; }
    Object.assign(state, freshState());
    document.getElementById(cfg.listEl).innerHTML = `<div class="tc-skeleton"></div><div class="tc-skeleton"></div>`;
    document.getElementById(cfg.emptyEl).style.display = "none";
  }

  const loadMoreBtn = document.getElementById(cfg.loadMoreEl);
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.disabled = true;

  if (state.unsub) state.unsub();

  const constraints = [...cfg.constraints, orderBy(cfg.order[0], cfg.order[1]), limit(state.pageSize)];

  state.unsub = onSnapshot(query(collection(db, cfg.coll), ...constraints), async (snap) => {
    const listEl = document.getElementById(cfg.listEl);
    const emptyEl = document.getElementById(cfg.emptyEl);

    if (snap.empty) {
      listEl.innerHTML = "";
      emptyEl.style.display = "flex";
      document.getElementById(cfg.metaEl).textContent = cfg.emptyText;
      state.hasMore = false;
      state.count = 0;
      loadMoreBtn.style.display = "none";
      loadMoreBtn.classList.remove("loading");
      loadMoreBtn.disabled = false;
      return;
    }

    emptyEl.style.display = "none";
    listEl.innerHTML = "";
    for (const docSnap of snap.docs) {
      listEl.appendChild(await cfg.render(docSnap.id, docSnap.data(), tabKey));
    }

    state.count = snap.docs.length;
    state.hasMore = snap.docs.length === state.pageSize;
    loadMoreBtn.style.display = state.hasMore ? "inline-flex" : "none";
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
    document.getElementById(cfg.metaEl).textContent = `${state.count} item${state.count === 1 ? "" : "s"} loaded`;
  }, (err) => {
    console.error(`Subscribe ${tabKey} error:`, err);
    showToast("Couldn't load that tab. Please try again.", "error");
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  });
}

Object.keys(TAB_CONFIG).forEach((tabKey) => {
  document.getElementById(TAB_CONFIG[tabKey].loadMoreEl)?.addEventListener("click", () => {
    const state = tabState[tabKey];
    state.pageSize += PAGE_SIZE;
    subscribeTab(tabKey, false);
  });
});

/* ---------------------------------------------------------
   TASK REQUESTS — status filter chips (Pending / Resolved)
   --------------------------------------------------------- */
let requestsFilter = "pending_review";
document.querySelectorAll(".rf-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    if (chip.dataset.rf === requestsFilter) return;
    document.querySelectorAll(".rf-chip").forEach((c) => c.classList.toggle("active", c === chip));
    requestsFilter = chip.dataset.rf;
    TAB_CONFIG.requests.constraints = [where("status", "==", requestsFilter)];
    subscribeTab("requests", true);
  });
});

/* ---------------------------------------------------------
   CATEGORY ICON MAP
   --------------------------------------------------------- */
const CATEGORY_ICON = {
  survey: "bx-list-check", social: "bx-share-alt", app_install: "bx-mobile",
  signup: "bx-user-plus", review: "bx-star", watch: "bx-play-circle", other: "bx-task"
};

/* ===========================================================
   RENDER — PENDING / ACTIVE / DECLINED / COMPLETED TASK CARD
   =========================================================== */
async function renderTaskCard(taskId, task, tabKey) {
  const card = document.createElement("div");
  card.className = "task-card" + (task.hidden ? " hidden-task" : "");
  card.dataset.id = taskId;

  const employer = await getUserSummary(task.employerUid);
  const icon = CATEGORY_ICON[task.category] || "bx-task";

  const tags = [
    `<span class="tc-tag category"><i class="bx ${icon}"></i> ${escapeHtml(task.categoryLabel || task.category || "Task")}</span>`,
    task.urgent ? `<span class="tc-tag urgent"><i class="bx bx-bolt"></i> Urgent</span>` : ""
  ].join("");

  let progressHtml = "";
  let statusExtra = "";
  if (tabKey === "active" || tabKey === "completed") {
    const total = task.workersRequired || 0;
    const filled = task.slotsFilled || 0;
    const pct = total ? Math.min(100, Math.round((filled / total) * 100)) : 0;
    progressHtml = `
      <div class="tc-progress-wrap">
        <div class="tc-progress-label"><span>${filled} / ${total} slots filled</span><span>${pct}%</span></div>
        <div class="tc-progress-track"><div class="tc-progress-fill" style="width:${pct}%"></div></div>
      </div>`;
  }
  if (tabKey === "active") {
    statusExtra = task.hidden
      ? `<span class="tc-tag hidden"><i class="bx bx-hide"></i> Hidden from feed</span>`
      : `<span class="tc-tag visible"><i class="bx bx-show"></i> Visible on Earn feed</span>`;
  }

  let declineBlock = "";
  if (tabKey === "declined") {
    const history = task.declineHistory || [];
    const atMax = history.length >= MAX_DECLINES;
    const badgeClass = atMax ? "max" : history.length >= 3 ? "mid" : "low";
    declineBlock = `<span class="decline-badge ${badgeClass}"><i class="bx bx-x-circle"></i> ${history.length}/${MAX_DECLINES} declines</span>`;
  }

  card.innerHTML = `
    <div class="tc-head">
      <div class="tc-title-wrap">
        <div class="tc-title">${escapeHtml(task.title || "Untitled task")}</div>
        <div class="tc-sub">${escapeHtml(employer.fullName)}${employer.username ? " · @" + escapeHtml(employer.username) : ""}</div>
      </div>
      <div class="tc-amount">${formatNaira(task.amountPerWorker)}<span>per worker</span></div>
    </div>
    <div class="tc-tags">${tags}${statusExtra}${declineBlock}</div>
    ${progressHtml}
    <button type="button" class="tc-toggle"><i class="bx bx-chevron-down"></i> View details</button>
    <div class="tc-body"><div class="tc-detail-grid">
      <div class="tc-detail-row"><strong>Description</strong><p>${escapeHtml(task.description || "—")}</p></div>
      <div class="tc-detail-row"><strong>Instructions</strong><p>${escapeHtml(task.instructions || "—")}</p></div>
      <div class="tc-detail-row"><strong>Task link</strong><p><a class="tc-link" href="${escapeHtml(task.taskLink || "#")}" target="_blank" rel="noopener">${escapeHtml(task.taskLink || "—")} <i class="bx bx-link-external"></i></a></p></div>
      <div class="tc-detail-row"><strong>Proof requirements</strong><div class="tc-proof-list">${(task.proofRequirements || []).map((p) => `<span>${escapeHtml(p)}</span>`).join("") || "<span>—</span>"}</div></div>
      <div class="tc-detail-row"><strong>Screenshots required</strong><p>${task.screenshotRequired ? `Yes — ${task.screenshotCount || 0}` : "No"}</p></div>
      <div class="tc-detail-row"><strong>Cost breakdown</strong><p>${formatNaira(task.amountPerWorker)} × ${task.workersRequired || 0} workers${task.urgent ? ` + ${formatNaira(task.urgentFee)} urgent fee` : ""} = <strong>${formatNaira(task.totalCost)}</strong> reserved</p></div>
      ${tabKey === "declined" && (task.declineHistory || []).length ? `
      <div class="tc-detail-row"><strong>Decline history</strong>
        <ul class="decline-history-list">${task.declineHistory.map((r, i) => `<li><i class="bx bx-x-circle"></i><span>${i + 1}. ${escapeHtml(r)}</span></li>`).join("")}</ul>
      </div>` : ""}
    </div></div>
    <div class="tc-date">Submitted ${formatDate(task.createdAt)}</div>
    <div class="tc-action-slot"></div>
  `;

  card.querySelector(".tc-toggle").addEventListener("click", (e) => {
    e.currentTarget.classList.toggle("open");
  });

  const actionSlot = card.querySelector(".tc-action-slot");

    if (tabKey === "pending") {
    actionSlot.innerHTML = `
      <div class="tc-actions">
        <button type="button" class="btn btn-success" data-act="approve" title="Approve" aria-label="Approve"><span class="btn-spinner"></span><i class="bx bx-check"></i><span class="btn-label">Approve</span></button>
        <button type="button" class="btn btn-danger" data-act="decline-toggle" title="Decline" aria-label="Decline"><i class="bx bx-x"></i><span class="btn-label">Decline</span></button>
        <button type="button" class="btn btn-share" data-act="share" title="Share" aria-label="Share"><i class="bx bx-share-alt"></i><span class="btn-label">Share</span></button>
      </div>
      <div class="tc-decline-panel" id="declinePanel-${taskId}"><div><div class="tc-decline-inner">
        <textarea id="declineReason-${taskId}" placeholder="Reason for declining (shown to the employer)…"></textarea>
        <div class="tc-actions" style="grid-template-columns: repeat(2, 1fr);">
          <button type="button" class="btn btn-ghost" data-act="decline-cancel">Cancel</button>
          <button type="button" class="btn btn-danger" data-act="decline-confirm"><span class="btn-spinner"></span><i class="bx bx-x-circle"></i><span class="btn-label">Confirm Decline &amp; Refund</span></button>
        </div>
      </div></div></div>
    `;

  if (tabKey === "active") {
    // Only the worker's own portion of each unfilled slot comes back —
    // TaskNOVA's per-worker platform fee (and any urgent placement fee)
    // is never refundable, matching Pending's decline/delete rule.
    const refundAmount = Math.max(0, (task.workersRequired || 0) - (task.slotsFilled || 0)) * (task.workerPayout ?? Math.max(0, (task.amountPerWorker || 0) - (task.platformFee || 0)));
    actionSlot.innerHTML = `
      <div class="tc-actions">
        <button type="button" class="btn btn-ghost btn-icon-only" data-act="toggle-hide" title="${task.hidden ? "Unhide" : "Hide"}" aria-label="${task.hidden ? "Unhide" : "Hide"}"><span class="btn-spinner"></span><i class="bx ${task.hidden ? "bx-show" : "bx-hide"}"></i><span class="btn-label sr-only">${task.hidden ? "Unhide" : "Hide"}</span></button>
        <button type="button" class="btn btn-share btn-icon-only" data-act="share" title="Share" aria-label="Share"><i class="bx bx-share-alt"></i><span class="btn-label sr-only">Share</span></button>
        <button type="button" class="btn btn-danger btn-icon-only" data-act="delete-toggle" title="Delete" aria-label="Delete"><i class="bx bx-trash"></i><span class="btn-label sr-only">Delete</span></button>
      </div>
      <div class="tc-decline-panel" id="deletePanel-${taskId}"><div><div class="tc-decline-inner">
        <p style="font-size:.82rem;color:var(--text-soft);">This permanently deletes the task. ${task.slotsFilled ? `${task.slotsFilled} slot${task.slotsFilled === 1 ? "" : "s"} already filled stay${task.slotsFilled === 1 ? "s" : ""} spent — only the unfilled workers' share is refunded (TaskNOVA's platform fee is never refundable):` : "No slots have been filled yet, so the workers' share of the full balance is refunded (TaskNOVA's platform fee is never refundable):"} <strong>${formatNaira(refundAmount)}</strong> back to ${escapeHtml(employer.fullName)}'s wallet.</p>
        <div class="tc-actions">
          <button type="button" class="btn btn-ghost" data-act="delete-cancel">Cancel</button>
          <button type="button" class="btn btn-danger" data-act="delete-confirm"><span class="btn-spinner"></span><i class="bx bx-trash"></i><span class="btn-label">Confirm Delete &amp; Refund</span></button>
        </div>
      </div></div></div>
    `;
    actionSlot.querySelector('[data-act="toggle-hide"]').addEventListener("click", (e) => toggleHide(taskId, task.hidden, card, e.currentTarget));
    actionSlot.querySelector('[data-act="share"]').addEventListener("click", () => shareTask(task.title, task.urgent));
    const deletePanel = actionSlot.querySelector(`#deletePanel-${taskId}`);
    actionSlot.querySelector('[data-act="delete-toggle"]').addEventListener("click", () => deletePanel.classList.add("show"));
    actionSlot.querySelector('[data-act="delete-cancel"]').addEventListener("click", () => deletePanel.classList.remove("show"));
    actionSlot.querySelector('[data-act="delete-confirm"]').addEventListener("click", (e) => deleteActiveTask(taskId, task, refundAmount, card, e.currentTarget));
  }

  return card;
}

/* ===========================================================
   RENDER — TASK REQUEST CARD
   =========================================================== */
async function renderRequestCard(reqId, req) {
  const card = document.createElement("div");
  card.className = "task-card";
  card.dataset.id = reqId;

  const requester = await getUserSummary(req.requesterUid);
  const isResolved = req.status !== "pending_review";

  card.innerHTML = `
    <div class="tc-head">
      <div class="tc-title-wrap">
        <div class="tc-title">${escapeHtml(req.whatWanted || "Custom task request")}</div>
        <div class="tc-sub">${escapeHtml(requester.fullName)}${requester.username ? " · @" + escapeHtml(requester.username) : ""}</div>
      </div>
    </div>
    <div class="tc-tags">
      <span class="tc-tag"><i class="bx bx-window-alt"></i> ${escapeHtml(req.platform || "—")}</span>
      <span class="tc-tag"><i class="bx bx-group"></i> ${req.workersRequired || 0} workers</span>
      ${isResolved ? `<span class="tc-tag ${req.verdict === "rejected" ? "hidden" : "visible"}"><i class="bx ${req.verdict === "rejected" ? "bx-x-circle" : "bx-check"}"></i> ${req.verdict === "rejected" ? "Rejected" : "Approved"}</span>` : ""}
    </div>
    <button type="button" class="tc-toggle"><i class="bx bx-chevron-down"></i> View details</button>
    <div class="tc-body"><div class="tc-detail-grid">
      <div class="tc-detail-row"><strong>Instructions</strong><p>${escapeHtml(req.instructions || "—")}</p></div>
      <div class="tc-detail-row"><strong>Desired result</strong><p>${escapeHtml(req.desiredResult || "—")}</p></div>
      <div class="tc-detail-row"><strong>Proof requirements</strong><div class="tc-proof-list">${(req.proofRequirements || []).map((p) => `<span>${escapeHtml(p)}</span>`).join("") || "<span>—</span>"}</div></div>
      ${isResolved ? `<div class="tc-detail-row"><strong>Verdict</strong><p>${req.verdict === "rejected" ? "Rejected" : "Approved"}${req.resolutionNote ? " — " + escapeHtml(req.resolutionNote) : ""}</p></div>` : ""}
    </div></div>
    <div class="tc-date">Requested ${formatDate(req.createdAt)}${isResolved && req.resolvedAt ? ` · Resolved ${formatDate(req.resolvedAt)}` : ""}</div>
    <div class="tc-action-slot"></div>
  `;

  card.querySelector(".tc-toggle").addEventListener("click", (e) => e.currentTarget.classList.toggle("open"));

  const actionSlot = card.querySelector(".tc-action-slot");
  if (!isResolved) {
    actionSlot.innerHTML = `
      <div class="tc-actions">
        <button type="button" class="btn btn-success" data-act="resolve-toggle"><i class="bx bx-check-circle"></i><span class="btn-label">Mark Resolved</span></button>
      </div>
      <div class="tc-decline-panel" id="resolvePanel-${reqId}"><div><div class="tc-resolve-inner">
        <div class="w-field">
          <label for="resolveVerdict-${reqId}">Verdict</label>
          <select id="resolveVerdict-${reqId}" required>
            <option value="" disabled selected>Choose a verdict…</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <textarea id="resolveNote-${reqId}" placeholder="Note to keep on record (optional) — e.g. added to catalogue, not feasible, etc."></textarea>
        <div class="tc-actions">
          <button type="button" class="btn btn-ghost" data-act="resolve-cancel">Cancel</button>
          <button type="button" class="btn btn-success" data-act="resolve-confirm"><span class="btn-spinner"></span><i class="bx bx-check"></i><span class="btn-label">Confirm</span></button>
        </div>
      </div></div></div>
    `;
    const resolvePanel = actionSlot.querySelector(`#resolvePanel-${reqId}`);
    actionSlot.querySelector('[data-act="resolve-toggle"]').addEventListener("click", () => resolvePanel.classList.add("show"));
    actionSlot.querySelector('[data-act="resolve-cancel"]').addEventListener("click", () => resolvePanel.classList.remove("show"));
    actionSlot.querySelector('[data-act="resolve-confirm"]').addEventListener("click", (e) => resolveRequest(reqId, card, e.currentTarget));
  }

  return card;
}

/* ---------------------------------------------------------
   ACTION — APPROVE (+ optional share)
   Sets status: "active" so the task immediately appears on the
   Earn feed's live query (status active, hidden false, full
   false) — urgent tasks carry their bolt badge automatically
   since that's read straight off the task doc by earn.js.
   --------------------------------------------------------- */
async function approveTask(taskId, cardEl, btnEl) {
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    await updateDoc(doc(db, "tasks", taskId), {
      status: "active",
      hidden: false,
      approvedAt: serverTimestamp()
    });

    showToast("Task approved — now live on the Earn feed.");
    animateOutAndRemove(cardEl);
    bumpCount("countPending", -1);
    bumpCount("countActive", 1);
  } catch (err) {
    console.error("Approve task error:", err);
    showToast("Couldn't approve this task. Please try again.", "error");
  } finally {
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

/* ---------------------------------------------------------
   ACTION — SHARE (Pending and Active both use this — sharing a
   task doesn't depend on its approval state, so it's a plain,
   standalone icon rather than bundled into Approve.)
   --------------------------------------------------------- */
async function shareTask(title, urgent) {
  const shareText = `New task on TaskNOVA${urgent ? " ⚡ (Urgent)" : ""}: ${title || "Check it out"} — earn money completing it now.`;
  const shareUrl = `${window.location.origin}/user/earn.html`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "TaskNOVA", text: shareText, url: shareUrl });
    } catch {
      /* user cancelled share sheet — no-op */
    }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
    showToast("Share link copied to clipboard.");
  }
}

/* ---------------------------------------------------------
   ACTION — DECLINE (refunds immediately)
   Appends the reason to declineHistory and flips status, and
   credits the employer's wallet.deposit with the task's full
   totalCost in the same transaction — nothing was ever spent
   since the task never went live, so the whole reserve comes
   back right away (mirrors how Advertisements handles decline).
   --------------------------------------------------------- */
async function declineTask(taskId, task, cardEl, btnEl) {
  const textarea = document.getElementById(`declineReason-${taskId}`);
  const reason = textarea.value.trim();
  if (!reason) { textarea.focus(); return; }

  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    const taskRef = doc(db, "tasks", taskId);
    const userRef = doc(db, "users", task.employerUid);

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("Employer account not found.");
      const deposit = userSnap.data().wallet?.deposit ?? 0;

      transaction.update(userRef, { "wallet.deposit": deposit + (task.totalCost || 0) });
      transaction.update(taskRef, {
        status: "declined",
        declineHistory: arrayUnion(reason),
        declinedAt: serverTimestamp()
      });

      const txRef = doc(collection(db, "users", task.employerUid, "transactions"));
      transaction.set(txRef, {
        type: "refund",
        direction: "credit",
        title: `Refund from declined task: ${task.title || "Untitled"}`,
        amount: task.totalCost || 0,
        status: "successful",
        createdAt: serverTimestamp()
      });
    });

    showToast("Task declined — the employer has been refunded.");
    animateOutAndRemove(cardEl);
    bumpCount("countPending", -1);
    bumpCount("countDeclined", 1);
  } catch (err) {
    console.error("Decline task error:", err);
    showToast(err.message || "Couldn't decline this task. Please try again.", "error");
  } finally {
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

/* ---------------------------------------------------------
   ACTION — HIDE / UNHIDE (active tasks)
   --------------------------------------------------------- */
async function toggleHide(taskId, currentlyHidden, cardEl, btnEl) {
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    await updateDoc(doc(db, "tasks", taskId), { hidden: !currentlyHidden });
    cardEl.classList.toggle("hidden-task", !currentlyHidden);
    const tag = cardEl.querySelector(".tc-tag.hidden, .tc-tag.visible");
    if (tag) {
      tag.className = !currentlyHidden ? "tc-tag hidden" : "tc-tag visible";
      tag.innerHTML = !currentlyHidden ? `<i class="bx bx-hide"></i> Hidden from feed` : `<i class="bx bx-show"></i> Visible on Earn feed`;
    }
    const icon = btnEl.querySelector("i");
    const label = btnEl.querySelector(".btn-label");
    icon.className = !currentlyHidden ? "bx bx-show" : "bx bx-hide";
    label.textContent = !currentlyHidden ? "Unhide" : "Hide";
    btnEl.title = !currentlyHidden ? "Unhide" : "Hide";
    btnEl.setAttribute("aria-label", !currentlyHidden ? "Unhide" : "Hide");
    btnEl.dataset.act = "toggle-hide";
    btnEl.onclick = null;
    btnEl.replaceWith(btnEl.cloneNode(true));
    const freshBtn = cardEl.querySelector('[data-act="toggle-hide"]');
    freshBtn.addEventListener("click", (e) => toggleHide(taskId, !currentlyHidden, cardEl, e.currentTarget));
    showToast(!currentlyHidden ? "Task hidden from the Earn feed." : "Task is visible on the Earn feed again.");
  } catch (err) {
    console.error("Toggle hide error:", err);
    showToast("Couldn't update visibility. Please try again.", "error");
  } finally {
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

/* ---------------------------------------------------------
   ACTION — MARK REQUEST RESOLVED
   --------------------------------------------------------- */
async function resolveRequest(reqId, cardEl, btnEl) {
  const verdictSelect = document.getElementById(`resolveVerdict-${reqId}`);
  const verdict = verdictSelect?.value || "";
  if (!verdict) { verdictSelect?.focus(); return; }

  const note = document.getElementById(`resolveNote-${reqId}`)?.value.trim() || "";
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    await updateDoc(doc(db, "taskRequests", reqId), {
      status: "resolved",
      verdict,
      resolutionNote: note,
      resolvedAt: serverTimestamp()
    });
    showToast(`Request marked resolved — ${verdict}.`);
    animateOutAndRemove(cardEl);
    bumpCount("countRequests", -1);
  } catch (err) {
    console.error("Resolve request error:", err);
    showToast("Couldn't update this request. Please try again.", "error");
  } finally {
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

/* ---------------------------------------------------------
   ACTION — DELETE ACTIVE TASK (partial refund, workers' share only)
   Slots already filled are treated as spent and non-refundable.
   Of the unfilled balance, only the workers' own payout comes
   back — (workersRequired - slotsFilled) * workerPayout —
   TaskNOVA's per-worker platform fee is never refunded, matching
   the employer's own "delete an active task" flow on Track Posted
   Tasks, which uses this exact same math.
   --------------------------------------------------------- */
async function deleteActiveTask(taskId, task, refundAmount, cardEl, btnEl) {
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    const taskRef = doc(db, "tasks", taskId);
    const userRef = doc(db, "users", task.employerUid);

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("Employer account not found.");
      const deposit = userSnap.data().wallet?.deposit ?? 0;

      if (refundAmount > 0) {
        transaction.update(userRef, { "wallet.deposit": deposit + refundAmount });
        const txRef = doc(collection(db, "users", task.employerUid, "transactions"));
        transaction.set(txRef, {
          type: "refund",
          direction: "credit",
          title: `Refund from deleted task: ${task.title || "Untitled"}`,
          amount: refundAmount,
          status: "successful",
          createdAt: serverTimestamp()
        });
      }
      transaction.delete(taskRef);
    });

    showToast(refundAmount > 0 ? `Task deleted — ${formatNaira(refundAmount)} refunded for unfilled slots.` : "Task deleted — no unfilled slots to refund.");
    animateOutAndRemove(cardEl);
    bumpCount("countActive", -1);
  } catch (err) {
    console.error("Delete active task error:", err);
    showToast(err.message || "Couldn't delete this task. Please try again.", "error");
  } finally {
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

/* ---------------------------------------------------------
   UI HELPERS
   --------------------------------------------------------- */
function animateOutAndRemove(cardEl) {
  cardEl.style.transition = "opacity .3s ease, transform .3s ease";
  cardEl.style.opacity = "0";
  cardEl.style.transform = "translateX(12px)";
  setTimeout(() => cardEl.remove(), 300);
}

function bumpCount(elId, delta) {
  const el = document.getElementById(elId);
  if (!el) return;
  const current = parseInt(el.textContent, 10);
  if (Number.isNaN(current)) return;
  el.textContent = String(Math.max(0, current + delta));
}

/* ---------------------------------------------------------
   TAB BADGE COUNTS (aggregate query — one read each, cheap)
   --------------------------------------------------------- */
async function loadCounts() {
  try {
    const [pendingSnap, activeSnap, declinedSnap, requestsSnap] = await Promise.all([
      getCountFromServer(query(collection(db, "tasks"), where("status", "==", "pending_review"))),
      getCountFromServer(query(collection(db, "tasks"), where("status", "==", "active"))),
      getCountFromServer(query(collection(db, "tasks"), where("status", "==", "declined"))),
      getCountFromServer(query(collection(db, "taskRequests"), where("status", "==", "pending_review")))
    ]);
    document.getElementById("countPending").textContent = pendingSnap.data().count;
    document.getElementById("countActive").textContent = activeSnap.data().count;
    document.getElementById("countDeclined").textContent = declinedSnap.data().count;
    document.getElementById("countRequests").textContent = requestsSnap.data().count;
  } catch (err) {
    console.error("Load tab counts error:", err);
  }
}

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

  // Load counts + the first tab (Pending) immediately; other tabs
  // are lazy-loaded the first time their button is clicked.
  loadCounts();
  loadedTabs.add("pending");
  subscribeTab("pending", true);
});

/* ===========================================================
   NOTES
   ===========================================================
   - Admin identity/avatar reads users/{uid} the same way the
     user-side pages do. If admins actually live in a separate
     "admins" collection or carry a custom claim instead, swap
     the getDoc target in the auth guard above accordingly —
     nothing else on this page depends on which it is.

   - Every tab (Pending/Active/Declined/Completed/Requests) is now
     a live onSnapshot instead of a one-time getDocs read, so an
     approval/decline/resolve from another admin's session (or
     this one, in another tab) shows up without a refresh. "Load
     more" grows that tab's own `limit` by PAGE_SIZE and
     re-subscribes rather than paging with a startAfter cursor —
     simpler to keep live, at the cost of re-sending the whole
     (bigger) window each time instead of only the new slice. One
     side effect worth knowing: any snapshot update — even one
     from an unrelated task in the same tab — re-renders the whole
     list, so an open "View details" toggle or a decline/delete
     reason typed but not yet confirmed will collapse/reset if
     another change comes in first. Fine for admin's usage pattern
     here; flag it if that becomes annoying in practice.

   - accountType/institutionAbbr are retired site-wide — task and
     request card subtitles now show @username instead.

   - declineHistory is a plain array of reason strings (matching
     how track-posted-tasks.js already reads it), appended via
     arrayUnion each time this page declines a task. declinedAt
     is a new field this page introduces so the Declined tab can
     sort by most-recently-declined rather than original
     createdAt; track-posted-tasks.js doesn't need to read it.

   - There's no stored "old vs new" diff when an employer edits
     and reposts a declined or approved task — post-task.html
     overwrites the same task doc in place, so only the current
     version and the running declineHistory reasons exist to show
     here. An approved task that gets edited comes back through
     with status: "pending_review" and isEditResubmission: true
     (post-task.js sets that flag) — this page doesn't need to
     treat it specially since the Pending tab already shows every
     pending_review task regardless of that flag; it's there so
     track-posted-tasks.js can split its own "Pending" and "Edit
     Requests" tabs apart. A true version-by-version comparison
     would need the edit flow to snapshot the previous version
     before overwriting (e.g. into a taskVersions subcollection) —
     flag if you want that built out.

   - Pending's three actions are now icon-only: Approve (check),
     Decline (x, opens the reason panel), Share. The old "Approve &
     Share" combo button is gone — Share is its own standalone
     action (shareTask()) that works the same whether the task is
     still Pending or already Active, since sharing doesn't depend
     on approval state. It uses the Web Share API on mobile (falls
     back to clipboard copy on desktop) and links to the general
     Earn feed rather than a specific task, since earn.html doesn't
     currently read a ?task= query param to deep-link or highlight
     one card — say the word if you'd like that added so the
     shared link jumps straight to the approved task.

   - Active tab now shows the same Share icon alongside Hide/Unhide
     and Delete (it was missing here before — Pending and Active
     both offer it now).

   - Tab counts use getCountFromServer (one aggregate read per
     badge) and don't live-update — reopen the tab or refresh the
     page to see a count change from another admin's action.

   - Active tab's Hide/Unhide only flips the `hidden` field, which
     is exactly what earn.js's live query already filters on
     (status active + hidden false + full false) — no other change
     needed for a hidden task to disappear from workers' feeds.

   - Completed tab is read-only for now: nothing in the codebase
     yet sets status: "completed" (that's the scheduled/records
     side of the task lifecycle, not an admin action), so this tab
     will stay empty until that's wired up elsewhere.

   - Decline refunds the employer's full totalCost immediately in
     the same transaction as the status change. track-posted-
     tasks.js's own delete flow must NOT refund again for a
     declined task (it already doesn't — see that file's notes) or
     an employer who deletes a task admin already declined would be
     refunded twice. This mirrors how track-posted-ads.js already
     correctly handles the ads side.

   - Active tab's Delete action (and the employer's equivalent on
     Track Posted Tasks) now refunds only the *workers' own share*
     of the unfilled balance — (workersRequired - slotsFilled) *
     workerPayout — not the old (…) * amountPerWorker, which was
     wrongly including TaskNOVA's per-worker platform fee in the
     refund. The platform fee (and any urgent-placement fee) is
     never refundable, matching the same rule Pending's decline
     already followed. workerPayout falls back to amountPerWorker
     minus platformFee for any older task doc that predates the
     workerPayout field.

   - Task Requests' Mark Resolved now requires an explicit
     Approved/Rejected verdict (a <select>, not just free text) —
     the resolution note is still optional and just adds context.
     The verdict shows as a colored tag on the card and in its
     detail view. This still doesn't create or convert anything
     into a real task automatically — per the spec it's admin's
     judgment call whether/how to support the request.
   =========================================================== */
