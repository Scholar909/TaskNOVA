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
  startAfter,
  getDocs,
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

// Cache of employerUid/requesterUid -> { fullName, accountType }
const userCache = new Map();
async function getUserSummary(uid) {
  if (!uid) return { fullName: "Unknown user", accountType: "" };
  if (userCache.has(uid)) return userCache.get(uid);
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const summary = snap.exists()
      ? { fullName: snap.data().fullName || "TaskNOVA User", accountType: snap.data().accountType || "" }
      : { fullName: "Deleted user", accountType: "" };
    userCache.set(uid, summary);
    return summary;
  } catch {
    return { fullName: "Unknown user", accountType: "" };
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
      loadTab(tab, true);
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

// pagination cursors per tab key
const tabState = {};
function freshState() { return { lastDoc: null, hasMore: true, isLoading: false, count: 0 }; }
Object.keys(TAB_CONFIG).forEach((k) => { tabState[k] = freshState(); });

/* ---------------------------------------------------------
   LOAD A TAB PAGE
   --------------------------------------------------------- */
async function loadTab(tabKey, reset = false) {
  const cfg = TAB_CONFIG[tabKey];
  const state = tabState[tabKey];
  if (state.isLoading) return;
  if (reset) {
    Object.assign(state, freshState());
    document.getElementById(cfg.listEl).innerHTML = `<div class="tc-skeleton"></div><div class="tc-skeleton"></div>`;
    document.getElementById(cfg.emptyEl).style.display = "none";
  }
  if (!state.hasMore) return;

  state.isLoading = true;
  const loadMoreBtn = document.getElementById(cfg.loadMoreEl);
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.disabled = true;

  try {
    const constraints = [...cfg.constraints, orderBy(cfg.order[0], cfg.order[1])];
    if (state.lastDoc) constraints.push(startAfter(state.lastDoc));
    constraints.push(limit(PAGE_SIZE));

    const snap = await getDocs(query(collection(db, cfg.coll), ...constraints));
    const listEl = document.getElementById(cfg.listEl);
    if (reset) listEl.innerHTML = "";

    if (snap.empty && state.count === 0) {
      document.getElementById(cfg.emptyEl).style.display = "flex";
      document.getElementById(cfg.metaEl).textContent = cfg.emptyText;
      state.hasMore = false;
      loadMoreBtn.style.display = "none";
      return;
    }

    for (const docSnap of snap.docs) {
      const cardEl = await cfg.render(docSnap.id, docSnap.data(), tabKey);
      listEl.appendChild(cardEl);
    }

    state.count += snap.docs.length;
    state.lastDoc = snap.docs[snap.docs.length - 1] || state.lastDoc;
    state.hasMore = snap.docs.length === PAGE_SIZE;
    loadMoreBtn.style.display = state.hasMore ? "inline-flex" : "none";
    document.getElementById(cfg.metaEl).textContent = `${state.count} item${state.count === 1 ? "" : "s"} loaded`;
  } catch (err) {
    console.error(`Load ${tabKey} error:`, err);
    showToast("Couldn't load that tab. Please try again.", "error");
  } finally {
    state.isLoading = false;
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  }
}

Object.keys(TAB_CONFIG).forEach((tabKey) => {
  document.getElementById(TAB_CONFIG[tabKey].loadMoreEl)?.addEventListener("click", () => loadTab(tabKey, false));
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
    loadTab("requests", true);
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
    task.location ? `<span class="tc-tag"><i class="bx bx-map-pin"></i> ${escapeHtml(task.location)}</span>` : "",
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
        <div class="tc-sub">${escapeHtml(employer.fullName)}${employer.accountType ? " · " + escapeHtml(employer.accountType) : ""}</div>
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
        <button type="button" class="btn btn-success" data-act="approve"><span class="btn-spinner"></span><i class="bx bx-check"></i><span class="btn-label">Approve</span></button>
        <button type="button" class="btn btn-share" data-act="approve-share"><span class="btn-spinner"></span><i class="bx bx-share-alt"></i><span class="btn-label">Approve &amp; Share</span></button>
        <button type="button" class="btn btn-danger" data-act="decline-toggle"><i class="bx bx-x"></i><span class="btn-label">Decline</span></button>
      </div>
      <div class="tc-decline-panel" id="declinePanel-${taskId}"><div><div class="tc-decline-inner">
        <textarea id="declineReason-${taskId}" placeholder="Reason for declining (shown to the employer)…"></textarea>
        <div class="tc-actions">
          <button type="button" class="btn btn-ghost" data-act="decline-cancel">Cancel</button>
          <button type="button" class="btn btn-danger" data-act="decline-confirm"><span class="btn-spinner"></span><i class="bx bx-x-circle"></i><span class="btn-label">Confirm Decline &amp; Refund</span></button>
        </div>
      </div></div></div>
    `;

    const declinePanel = actionSlot.querySelector(`#declinePanel-${taskId}`);
    actionSlot.querySelector('[data-act="approve"]').addEventListener("click", (e) => approveTask(taskId, card, e.currentTarget, false));
    actionSlot.querySelector('[data-act="approve-share"]').addEventListener("click", (e) => approveTask(taskId, card, e.currentTarget, true, task.title, task.urgent));
    actionSlot.querySelector('[data-act="decline-toggle"]').addEventListener("click", () => declinePanel.classList.add("show"));
    actionSlot.querySelector('[data-act="decline-cancel"]').addEventListener("click", () => declinePanel.classList.remove("show"));
    actionSlot.querySelector('[data-act="decline-confirm"]').addEventListener("click", (e) => declineTask(taskId, task, card, e.currentTarget));
  }

  if (tabKey === "active") {
    const refundAmount = Math.max(0, (task.workersRequired || 0) - (task.slotsFilled || 0)) * (task.amountPerWorker || 0);
    actionSlot.innerHTML = `
      <div class="tc-actions">
        <button type="button" class="btn btn-ghost" data-act="toggle-hide"><span class="btn-spinner"></span><i class="bx ${task.hidden ? "bx-show" : "bx-hide"}"></i><span class="btn-label">${task.hidden ? "Unhide" : "Hide"}</span></button>
        <button type="button" class="btn btn-danger" data-act="delete-toggle"><i class="bx bx-trash"></i><span class="btn-label">Delete</span></button>
      </div>
      <div class="tc-decline-panel" id="deletePanel-${taskId}"><div><div class="tc-decline-inner">
        <p style="font-size:.82rem;color:var(--text-soft);">This permanently deletes the task. ${task.slotsFilled ? `${task.slotsFilled} slot${task.slotsFilled === 1 ? "" : "s"} already filled stay${task.slotsFilled === 1 ? "s" : ""} spent — only the unfilled balance is refunded:` : "No slots have been filled yet, so the full balance is refunded:"} <strong>${formatNaira(refundAmount)}</strong> back to ${escapeHtml(employer.fullName)}'s wallet.</p>
        <div class="tc-actions">
          <button type="button" class="btn btn-ghost" data-act="delete-cancel">Cancel</button>
          <button type="button" class="btn btn-danger" data-act="delete-confirm"><span class="btn-spinner"></span><i class="bx bx-trash"></i><span class="btn-label">Confirm Delete &amp; Refund</span></button>
        </div>
      </div></div></div>
    `;
    actionSlot.querySelector('[data-act="toggle-hide"]').addEventListener("click", (e) => toggleHide(taskId, task.hidden, card, e.currentTarget));
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
        <div class="tc-sub">${escapeHtml(requester.fullName)}${requester.accountType ? " · " + escapeHtml(requester.accountType) : ""}</div>
      </div>
    </div>
    <div class="tc-tags">
      <span class="tc-tag"><i class="bx bx-window-alt"></i> ${escapeHtml(req.platform || "—")}</span>
      <span class="tc-tag"><i class="bx bx-group"></i> ${req.workersRequired || 0} workers</span>
      ${isResolved ? `<span class="tc-tag visible"><i class="bx bx-check"></i> Resolved</span>` : ""}
    </div>
    <button type="button" class="tc-toggle"><i class="bx bx-chevron-down"></i> View details</button>
    <div class="tc-body"><div class="tc-detail-grid">
      <div class="tc-detail-row"><strong>Instructions</strong><p>${escapeHtml(req.instructions || "—")}</p></div>
      <div class="tc-detail-row"><strong>Desired result</strong><p>${escapeHtml(req.desiredResult || "—")}</p></div>
      <div class="tc-detail-row"><strong>Proof requirements</strong><div class="tc-proof-list">${(req.proofRequirements || []).map((p) => `<span>${escapeHtml(p)}</span>`).join("") || "<span>—</span>"}</div></div>
      ${isResolved && req.resolutionNote ? `<div class="tc-detail-row"><strong>Resolution note</strong><p>${escapeHtml(req.resolutionNote)}</p></div>` : ""}
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
        <textarea id="resolveNote-${reqId}" placeholder="Resolution note (optional) — e.g. added to catalogue, not feasible, etc."></textarea>
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
async function approveTask(taskId, cardEl, btnEl, alsoShare, title, urgent) {
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    await updateDoc(doc(db, "tasks", taskId), {
      status: "active",
      hidden: false,
      approvedAt: serverTimestamp()
    });

    if (alsoShare) {
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
        showToast("Task approved — share link copied to clipboard.");
      }
    }

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
  const note = document.getElementById(`resolveNote-${reqId}`)?.value.trim() || "";
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    await updateDoc(doc(db, "taskRequests", reqId), {
      status: "resolved",
      resolutionNote: note,
      resolvedAt: serverTimestamp()
    });
    showToast("Request marked resolved.");
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
   ACTION — DELETE ACTIVE TASK (partial refund)
   Slots already filled are treated as spent and non-refundable;
   only the unfilled balance — (workersRequired - slotsFilled) *
   amountPerWorker — is credited back. This is the same math the
   employer's own "delete an active task" flow on Track Posted
   Tasks uses; this just gives admin the equivalent action.
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
  loadTab("pending", true);
});

/* ===========================================================
   NOTES
   ===========================================================
   - Admin identity/avatar reads users/{uid} the same way the
     user-side pages do. If admins actually live in a separate
     "admins" collection or carry a custom claim instead, swap
     the getDoc target in the auth guard above accordingly —
     nothing else on this page depends on which it is.

   - declineHistory is a plain array of reason strings (matching
     how track-posted-tasks.js already reads it), appended via
     arrayUnion each time this page declines a task. declinedAt
     is a new field this page introduces so the Declined tab can
     sort by most-recently-declined rather than original
     createdAt; track-posted-tasks.js doesn't need to read it.

   - There's no stored "old vs new" diff when an employer edits
     and reposts a declined task — post-task.html currently
     overwrites the same task doc in place, so only the current
     version and the running declineHistory reasons exist to show
     here. A true version-by-version comparison would need the
     edit flow to snapshot the previous version before overwriting
     (e.g. into a taskVersions subcollection) — flag if you want
     that built out.

   - Approve & Share uses the Web Share API on mobile (falls back
     to clipboard copy on desktop). It links to the general Earn
     feed rather than a specific task, since earn.html doesn't
     currently read a ?task= query param to deep-link or highlight
     one card — say the word if you'd like that added so the
     shared link jumps straight to the approved task.

   - Tab counts use getCountFromServer (one aggregate read per
     badge) and don't live-update — reopen the tab or refresh the
     page to see a count change from another admin's action. Each
     list itself is paginated (15/page, "Load more") rather than a
     realtime listener, matching the Load-more convention already
     used on User Management.

   - Active tab's Hide/Unhide only flips the `hidden` field, which
     is exactly what earn.js's live query already filters on
     (status active + hidden false + full false) — no other change
     needed for a hidden task to disappear from workers' feeds.

   - Completed tab is read-only for now: nothing in the codebase
     yet sets status: "completed" (that's the scheduled/records
     side of the task lifecycle, not an admin action), so this tab
     will stay empty until that's wired up elsewhere.

   - Decline now refunds the employer's full totalCost immediately
     in the same transaction as the status change (a change from
     this page's first version, which left refunds to the
     employer's own delete flow). This means track-posted-tasks.js's
     existing "delete a pending_review/declined task = full refund"
     logic needs to stop refunding declined tasks on delete, or an
     employer who deletes a task admin already declined would be
     refunded twice — pending_review tasks (never touched by admin)
     should keep refunding in full on delete as before. This mirrors
     how track-posted-ads.js already correctly handles the ads side
     (its delete flow explicitly does NOT refund a declined ad,
     since the balance already came back at decline time) — tasks
     just needs the same fix applied.

   - Active tab now has a Delete action alongside Hide/Unhide, for
     when admin needs to pull a live task down directly rather than
     via the employer. It refunds only the unfilled balance —
     (workersRequired - slotsFilled) * amountPerWorker — since
     filled slots are treated as spent and non-refundable, then
     permanently deletes the task doc. This is the same math the
     employer's own "delete an active task" flow on Track Posted
     Tasks is expected to use, so an admin delete and an employer
     delete of the same active task refund identically.

   - Declined tasks still show no refund messaging distinct from
     ads' declined view, since track-posted-tasks.js's copy for
     declined tasks wasn't shown here — worth checking that page's
     wording now says the balance was already refunded, matching
     what actually happens.

   - Task Requests' Mark Resolved doesn't create or convert
     anything into a real task automatically — per the spec it's
     admin's judgment call whether/how to support the request, so
     resolving here is just a status + optional note for the
     admin's own tracking.
   =========================================================== */
