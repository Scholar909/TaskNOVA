/* =========================================================
   TASKNOVA ADMIN — ADVERTISEMENTS PAGE LOGIC
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
  setDoc,
  updateDoc,
  deleteField,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getCountFromServer,
  arrayUnion,
  runTransaction,
  Timestamp,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  computeDeliveryStatus,
  pickBannerTriplet,
  BANNER_CYCLE_MS,
  BANNER_PLACEMENTS,
  MAX_ACTIVE_BANNERS,
  MS_HOUR,
  MS_DAY
} from "./ad-priority.js";

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

const PAGE_SIZE = 15;
const MAX_DECLINES = 5;

const TYPE_LABELS = {
  starter: "Starter (3-day)",
  standard: "Standard (7-day)",
  extended: "Extended (14-day)",
  banner: "Banner (30-day)"
};

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
      if (tab === "banners") startBannerMonitor();
      else subscribeTab(tab, true);
    }
  });
});

/* ---------------------------------------------------------
   TAB CONFIG (Pending / Active / Edit Requests / Declined)
   Banners has its own realtime monitor further below.
   --------------------------------------------------------- */
const TAB_CONFIG = {
  pending: {
    constraints: [where("status", "==", "pending_review")],
    order: ["createdAt", "asc"],
    listEl: "listPending", emptyEl: "emptyPending", metaEl: "metaPending", loadMoreEl: "loadMorePending",
    emptyText: "No advertisements waiting for review.",
    render: renderAdCard
  },
  active: {
    constraints: [where("status", "==", "active")],
    order: ["createdAt", "desc"],
    listEl: "listActive", emptyEl: "emptyActive", metaEl: "metaActive", loadMoreEl: "loadMoreActive",
    emptyText: "No active advertisements right now.",
    render: renderAdCard
  },
  edits: {
    // Ads with a pending creative edit awaiting approval. No orderBy is
    // used alongside this inequality filter to avoid needing a composite
    // index — results come back in default (roughly insertion) order.
    constraints: [where("pendingEdit", "!=", null)],
    order: null,
    listEl: "listEdits", emptyEl: "emptyEdits", metaEl: "metaEdits", loadMoreEl: "loadMoreEdits",
    emptyText: "No pending edit requests.",
    render: renderEditCard
  },
  declined: {
    constraints: [where("status", "==", "declined")],
    order: ["declinedAt", "desc"],
    listEl: "listDeclined", emptyEl: "emptyDeclined", metaEl: "metaDeclined", loadMoreEl: "loadMoreDeclined",
    emptyText: "No declined advertisements.",
    render: renderAdCard
  }
};

const tabState = {};
function freshState() { return { unsub: null, pageSize: PAGE_SIZE, hasMore: true, count: 0 }; }
Object.keys(TAB_CONFIG).forEach((k) => { tabState[k] = freshState(); });

/* ---------------------------------------------------------
   SUBSCRIBE A TAB — one onSnapshot per tab (live updates), whose
   `limit` grows by PAGE_SIZE each time "Load more" is clicked.
   Same pattern as admin/tasks.js's subscribeTab — see that file's
   notes for the realtime/pagination trade-off this implies.
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

  const constraints = [...cfg.constraints];
  if (cfg.order) constraints.push(orderBy(cfg.order[0], cfg.order[1]));
  constraints.push(limit(state.pageSize));

  state.unsub = onSnapshot(query(collection(db, "advertisements"), ...constraints), async (snap) => {
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

/* ===========================================================
   RENDER — PENDING / ACTIVE / DECLINED AD CARD
   =========================================================== */
async function renderAdCard(adId, ad, tabKey) {
  const card = document.createElement("div");
  card.className = "task-card" + (ad.hidden ? " hidden-task" : "");
  card.dataset.id = adId;

  const advertiser = await getUserSummary(ad.advertiserUid);
  const isBanner = ad.type === "banner";

  const tags = [
    `<span class="tc-tag${isBanner ? " type-banner" : ""}"><i class="bx ${isBanner ? "bx-carousel" : "bx-megaphone"}"></i> ${escapeHtml(TYPE_LABELS[ad.type] || ad.type)}</span>`
  ].join("");

  let statusExtra = "";
  if (tabKey === "active") {
    statusExtra = ad.hidden
      ? `<span class="tc-tag hidden"><i class="bx bx-hide"></i> Hidden</span>`
      : `<span class="tc-tag visible"><i class="bx bx-show"></i> Visible</span>`;
  }

  let declineBlock = "";
  if (tabKey === "declined") {
    const history = ad.declineHistory || [];
    const atMax = history.length >= MAX_DECLINES;
    const badgeClass = atMax ? "max" : history.length >= 3 ? "mid" : "low";
    declineBlock = `<span class="decline-badge ${badgeClass}"><i class="bx bx-x-circle"></i> ${history.length}/${MAX_DECLINES} declines</span>`;
  }

  let progressHtml = "";
  if (tabKey === "active") {
    const total = ad.guaranteedViews || 0;
    const current = ad.currentViews || 0;
    const pct = total ? Math.min(100, Math.round((current / total) * 100)) : 0;
    progressHtml = `
      <div class="tc-progress-wrap">
        <div class="tc-progress-label"><span>${current.toLocaleString("en-NG")} / ${total.toLocaleString("en-NG")} guaranteed views</span><span>${pct}%</span></div>
        <div class="tc-progress-track views-track"><div class="tc-progress-fill views-fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  const mediaHtml = isBanner
    ? (ad.bannerMediaType === "video"
        ? `<video class="tc-media-video" src="${escapeHtml(ad.bannerMediaUrl || "")}" muted loop playsinline controls></video>`
        : ad.bannerMediaUrl ? `<img class="tc-media-thumb" src="${escapeHtml(ad.bannerMediaUrl)}" alt="">` : "")
    : (ad.imageUrl ? `<img class="tc-media-thumb" src="${escapeHtml(ad.imageUrl)}" alt="">` : "");

  card.innerHTML = `
    <div class="tc-head">
      <div class="tc-title-wrap">
        <div class="tc-title">${escapeHtml(ad.title || "Untitled advertisement")}</div>
        <div class="tc-sub">${escapeHtml(advertiser.fullName)}${advertiser.username ? " · @" + escapeHtml(advertiser.username) : ""}</div>
      </div>
      <div class="tc-amount">${formatNaira(ad.price)}</div>
    </div>
    <div class="tc-tags">${tags}${statusExtra}${declineBlock}</div>
    ${progressHtml}
    <button type="button" class="tc-toggle"><i class="bx bx-chevron-down"></i> View details</button>
    <div class="tc-body"><div class="tc-detail-grid">
      ${mediaHtml}
      ${!isBanner ? `<div class="tc-detail-row"><strong>Description</strong><p>${escapeHtml(ad.description || "—")}</p></div>` : ""}
      <div class="tc-detail-row"><strong>Destination link</strong><p>${ad.link ? `<a class="tc-link" href="${escapeHtml(ad.link)}" target="_blank" rel="noopener">${escapeHtml(ad.link)} <i class="bx bx-link-external"></i></a>` : "—"}</p></div>
      <div class="tc-detail-row"><strong>Package</strong><p>${escapeHtml(TYPE_LABELS[ad.type] || ad.type)} · ${ad.durationDays || 0} days · ${(ad.guaranteedViews || 0).toLocaleString("en-NG")} guaranteed views · ${formatNaira(ad.price)}</p></div>
      ${tabKey !== "pending" ? `<div class="tc-detail-row"><strong>Views &amp; clicks</strong><p>${(ad.currentViews || 0).toLocaleString("en-NG")} views · ${(ad.clicks || 0).toLocaleString("en-NG")} clicks</p></div>` : ""}
      ${ad.expiresAt ? `<div class="tc-detail-row"><strong>Expires</strong><p>${formatDate(ad.expiresAt)}</p></div>` : ""}
      ${tabKey === "declined" && (ad.declineHistory || []).length ? `
      <div class="tc-detail-row"><strong>Decline history</strong>
        <ul class="decline-history-list">${ad.declineHistory.map((r, i) => `<li><i class="bx bx-x-circle"></i><span>${i + 1}. ${escapeHtml(r)}</span></li>`).join("")}</ul>
      </div>` : ""}
    </div></div>
    <div class="tc-date">Submitted ${formatDate(ad.createdAt)}</div>
    <div class="tc-action-slot"></div>
  `;

  card.querySelector(".tc-toggle").addEventListener("click", (e) => e.currentTarget.classList.toggle("open"));

  const actionSlot = card.querySelector(".tc-action-slot");

  if (tabKey === "pending") {
    actionSlot.innerHTML = `
      <div class="tc-actions">
        <button type="button" class="btn btn-success" data-act="approve"><span class="btn-spinner"></span><i class="bx bx-check"></i><span class="btn-label">Approve</span></button>
        <button type="button" class="btn btn-danger" data-act="decline-toggle"><i class="bx bx-x"></i><span class="btn-label">Decline</span></button>
      </div>
      <div class="tc-decline-panel" id="declinePanel-${adId}"><div><div class="tc-decline-inner">
        <textarea id="declineReason-${adId}" placeholder="Reason for declining (shown to the advertiser)…"></textarea>
        <div class="tc-actions">
          <button type="button" class="btn btn-ghost" data-act="decline-cancel">Cancel</button>
          <button type="button" class="btn btn-danger" data-act="decline-confirm"><span class="btn-spinner"></span><i class="bx bx-x-circle"></i><span class="btn-label">Confirm Decline &amp; Refund</span></button>
        </div>
      </div></div></div>
    `;
    const declinePanel = actionSlot.querySelector(`#declinePanel-${adId}`);
    actionSlot.querySelector('[data-act="approve"]').addEventListener("click", (e) => approveAd(adId, ad, card, e.currentTarget));
    actionSlot.querySelector('[data-act="decline-toggle"]').addEventListener("click", () => declinePanel.classList.add("show"));
    actionSlot.querySelector('[data-act="decline-cancel"]').addEventListener("click", () => declinePanel.classList.remove("show"));
    actionSlot.querySelector('[data-act="decline-confirm"]').addEventListener("click", (e) => declineAd(adId, ad, card, e.currentTarget));
  }

  if (tabKey === "active") {
    actionSlot.innerHTML = `
      <div class="tc-actions">
        <button type="button" class="btn btn-ghost" data-act="toggle-hide"><span class="btn-spinner"></span><i class="bx ${ad.hidden ? "bx-show" : "bx-hide"}"></i><span class="btn-label">${ad.hidden ? "Unhide" : "Hide"}</span></button>
      </div>
    `;
    actionSlot.querySelector('[data-act="toggle-hide"]').addEventListener("click", (e) => toggleHideAd(adId, ad.hidden, card, e.currentTarget));
  }

  return card;
}

/* ===========================================================
   RENDER — EDIT REQUEST CARD (old vs new)
   =========================================================== */
async function renderEditCard(adId, ad) {
  const card = document.createElement("div");
  card.className = "task-card";
  card.dataset.id = adId;

  const advertiser = await getUserSummary(ad.advertiserUid);
  const edit = ad.pendingEdit || {};
  const isBanner = ad.type === "banner";

  function field(label, oldVal) {
    return `<div class="diff-field"><strong>${label}</strong><p>${escapeHtml(oldVal || "—")}</p></div>`;
  }
  function newField(label, oldVal, newVal) {
    const has = newVal !== undefined && newVal !== null;
    const changed = has && newVal !== oldVal;
    return `<div class="diff-field"><strong>${label}</strong><p class="${changed ? "changed" : ""}">${has ? escapeHtml(newVal) : "<em>unchanged</em>"}</p></div>`;
  }

  card.innerHTML = `
    <div class="tc-head">
      <div class="tc-title-wrap">
        <div class="tc-title">${escapeHtml(ad.title || "Untitled advertisement")}</div>
        <div class="tc-sub">${escapeHtml(advertiser.fullName)}${advertiser.username ? " · @" + escapeHtml(advertiser.username) : ""}</div>
      </div>
    </div>
    <div class="tc-tags">
      <span class="tc-tag${isBanner ? " type-banner" : ""}"><i class="bx ${isBanner ? "bx-carousel" : "bx-megaphone"}"></i> ${escapeHtml(TYPE_LABELS[ad.type] || ad.type)}</span>
      <span class="tc-tag urgent"><i class="bx bx-edit-alt"></i> Edit pending</span>
    </div>
    <div class="diff-grid">
      <div class="diff-col">
        <div class="diff-col-label"><i class="bx bx-history"></i> Currently live</div>
        ${field("Title", ad.title)}
        ${!isBanner ? field("Description", ad.description) : ""}
        ${field("Link", ad.link)}
        ${!isBanner
          ? (ad.imageUrl ? `<div class="diff-field"><strong>Image</strong><img class="tc-media-thumb" src="${escapeHtml(ad.imageUrl)}" alt=""></div>` : "")
          : (ad.bannerMediaUrl ? `<div class="diff-field"><strong>Media</strong>${ad.bannerMediaType === "video" ? `<video class="tc-media-video" src="${escapeHtml(ad.bannerMediaUrl)}" muted loop playsinline controls></video>` : `<img class="tc-media-thumb" src="${escapeHtml(ad.bannerMediaUrl)}" alt="">`}</div>` : "")}
      </div>
      <div class="diff-col new-col">
        <div class="diff-col-label"><i class="bx bx-edit-alt"></i> Requested change</div>
        ${newField("Title", ad.title, edit.title)}
        ${!isBanner ? newField("Description", ad.description, edit.description) : ""}
        ${newField("Link", ad.link, edit.link)}
        ${!isBanner
          ? (edit.imageUrl ? `<div class="diff-field"><strong>Image</strong><img class="tc-media-thumb" src="${escapeHtml(edit.imageUrl)}" alt=""></div>` : "")
          : (edit.bannerMediaUrl ? `<div class="diff-field"><strong>Media</strong>${edit.bannerMediaType === "video" ? `<video class="tc-media-video" src="${escapeHtml(edit.bannerMediaUrl)}" muted loop playsinline controls></video>` : `<img class="tc-media-thumb" src="${escapeHtml(edit.bannerMediaUrl)}" alt="">`}</div>` : "")}
      </div>
    </div>
    <div class="tc-date">Requested ${formatDate(edit.requestedAt)}</div>
    <div class="tc-actions">
      <button type="button" class="btn btn-success" data-act="approve-edit"><span class="btn-spinner"></span><i class="bx bx-check"></i><span class="btn-label">Approve Changes</span></button>
      <button type="button" class="btn btn-danger" data-act="decline-edit"><span class="btn-spinner"></span><i class="bx bx-x"></i><span class="btn-label">Decline Changes</span></button>
    </div>
  `;

  card.querySelector('[data-act="approve-edit"]').addEventListener("click", (e) => resolveEditRequest(adId, edit, true, card, e.currentTarget));
  card.querySelector('[data-act="decline-edit"]').addEventListener("click", (e) => resolveEditRequest(adId, edit, false, card, e.currentTarget));

  return card;
}

/* ---------------------------------------------------------
   ACTION — APPROVE AD
   Sets status: active, hidden: false, and stamps an expiresAt
   counted from approval (not submission). Banner-type ads are
   capped at MAX_ACTIVE_BANNERS running at once — approval is
   blocked past that cap until one expires.
   --------------------------------------------------------- */
async function approveAd(adId, ad, cardEl, btnEl) {
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    if (ad.type === "banner") {
      const activeBannersSnap = await getCountFromServer(
        query(collection(db, "advertisements"), where("type", "==", "banner"), where("status", "==", "active"))
      );
      if (activeBannersSnap.data().count >= MAX_ACTIVE_BANNERS) {
        showToast(`Already ${MAX_ACTIVE_BANNERS} banner campaigns are live — wait for one to expire before approving another.`, "error");
        return;
      }
    }

    const approvedAtMs = Date.now();
    const expiresAtMs = approvedAtMs + (ad.durationDays || 0) * MS_DAY;

    await updateDoc(doc(db, "advertisements", adId), {
      status: "active",
      hidden: false,
      approvedAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(expiresAtMs)
    });

    showToast(ad.type === "banner" ? "Banner campaign approved — now in rotation." : "Advertisement approved and now live.");
    animateOutAndRemove(cardEl);
    bumpCount("countPending", -1);
    bumpCount("countActive", 1);
    if (ad.type === "banner") bumpCount("countBanners", 1);
  } catch (err) {
    console.error("Approve ad error:", err);
    showToast("Couldn't approve this advertisement. Please try again.", "error");
  } finally {
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

/* ---------------------------------------------------------
   ACTION — DECLINE AD (refunds immediately, unlike Tasks)
   track-posted-ads.js's declined view already tells the
   advertiser "your balance was refunded when it was declined" —
   so the refund has to actually happen here, in the same
   transaction as the status change.
   --------------------------------------------------------- */
async function declineAd(adId, ad, cardEl, btnEl) {
  const textarea = document.getElementById(`declineReason-${adId}`);
  const reason = textarea.value.trim();
  if (!reason) { textarea.focus(); return; }

  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    const adRef = doc(db, "advertisements", adId);
    const userRef = doc(db, "users", ad.advertiserUid);

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("Advertiser account not found.");
      const deposit = userSnap.data().wallet?.deposit ?? 0;

      transaction.update(userRef, { "wallet.deposit": deposit + (ad.price || 0) });
      transaction.update(adRef, {
        status: "declined",
        declineHistory: arrayUnion(reason),
        declinedAt: serverTimestamp()
      });

      const txRef = doc(collection(db, "users", ad.advertiserUid, "transactions"));
      transaction.set(txRef, {
        type: "refund",
        direction: "credit",
        title: `Refund from declined advertisement: ${ad.title || "Untitled"}`,
        amount: ad.price || 0,
        status: "successful",
        createdAt: serverTimestamp()
      });
    });

    showToast("Advertisement declined — the advertiser was refunded.");
    animateOutAndRemove(cardEl);
    bumpCount("countPending", -1);
    bumpCount("countDeclined", 1);
  } catch (err) {
    console.error("Decline ad error:", err);
    showToast(err.message || "Couldn't decline this advertisement. Please try again.", "error");
  } finally {
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

/* ---------------------------------------------------------
   ACTION — HIDE / UNHIDE (active ads, free, no wallet impact)
   --------------------------------------------------------- */
async function toggleHideAd(adId, currentlyHidden, cardEl, btnEl) {
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    await updateDoc(doc(db, "advertisements", adId), { hidden: !currentlyHidden });
    cardEl.classList.toggle("hidden-task", !currentlyHidden);
    const tag = cardEl.querySelector(".tc-tag.hidden, .tc-tag.visible");
    if (tag) {
      tag.className = !currentlyHidden ? "tc-tag hidden" : "tc-tag visible";
      tag.innerHTML = !currentlyHidden ? `<i class="bx bx-hide"></i> Hidden` : `<i class="bx bx-show"></i> Visible`;
    }
    const icon = btnEl.querySelector("i");
    const label = btnEl.querySelector(".btn-label");
    icon.className = !currentlyHidden ? "bx bx-show" : "bx bx-hide";
    label.textContent = !currentlyHidden ? "Unhide" : "Hide";
    btnEl.replaceWith(btnEl.cloneNode(true));
    const freshBtn = cardEl.querySelector('[data-act="toggle-hide"]');
    freshBtn.addEventListener("click", (e) => toggleHideAd(adId, !currentlyHidden, cardEl, e.currentTarget));
    showToast(!currentlyHidden ? "Ad hidden from view." : "Ad is visible again.");
  } catch (err) {
    console.error("Toggle hide error:", err);
    showToast("Couldn't update visibility. Please try again.", "error");
  } finally {
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

/* ---------------------------------------------------------
   ACTION — RESOLVE EDIT REQUEST (approve merges, decline discards)
   --------------------------------------------------------- */
async function resolveEditRequest(adId, edit, approve, cardEl, btnEl) {
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    if (approve) {
      const patch = { pendingEdit: deleteField() };
      if (edit.title !== undefined) patch.title = edit.title;
      if (edit.description !== undefined) patch.description = edit.description;
      if (edit.link !== undefined) patch.link = edit.link;
      if (edit.imageUrl !== undefined) patch.imageUrl = edit.imageUrl;
      if (edit.bannerMediaUrl !== undefined) patch.bannerMediaUrl = edit.bannerMediaUrl;
      if (edit.bannerMediaType !== undefined) patch.bannerMediaType = edit.bannerMediaType;
      await updateDoc(doc(db, "advertisements", adId), patch);
      showToast("Changes approved and applied to the live advertisement.");
    } else {
      await updateDoc(doc(db, "advertisements", adId), { pendingEdit: deleteField() });
      showToast("Changes declined — the ad keeps running as-is.");
    }
    animateOutAndRemove(cardEl);
    bumpCount("countEdits", -1);
  } catch (err) {
    console.error("Resolve edit request error:", err);
    showToast("Couldn't update this request. Please try again.", "error");
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

/* ===========================================================
   BANNERS TAB — read-only delivery-priority monitor
   Realtime (max 3 docs, cheap) since this tab exists specifically
   to watch delivery health change. Priority formula per the spec:
   compare each campaign's actual views/hour pace since approval
   against the pace it would still need to hit its guaranteed
   views by expiresAt.
   =========================================================== */
let bannerUnsub = null;
let latestActiveBanners = []; // [{id, ...data}] — kept in sync by the monitor listener
let defaultBannerCache = null; // siteSettings/defaultBanner doc, loaded once
let previewCycleIndex = 0;
let previewTimer = null;

const FALLBACK_DEFAULT_BANNER = {
  title: "Advertise your business on TaskNOVA",
  link: "post-advertisement.html",
  imageUrl: null
};

async function loadDefaultBanner() {
  try {
    const snap = await getDoc(doc(db, "siteSettings", "defaultBanner"));
    defaultBannerCache = snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("Load default banner error:", err);
    defaultBannerCache = null;
  }
  renderDefaultBannerCard();
}

function startBannerMonitor() {
  const listEl = document.getElementById("listBanners");
  const emptyEl = document.getElementById("emptyBanners");
  const metaEl = document.getElementById("metaBanners");

  loadDefaultBanner();
  startLivePreviewLoop();

  const q = query(collection(db, "advertisements"), where("type", "==", "banner"), where("status", "==", "active"));
  bannerUnsub = onSnapshot(q, async (snap) => {
    document.getElementById("countBanners").textContent = String(snap.size);
    latestActiveBanners = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderLivePreview();

    if (snap.empty) {
      listEl.innerHTML = "";
      emptyEl.style.display = "flex";
      metaEl.textContent = "No banner campaigns are active right now — every slot is showing the default TaskNOVA banner.";
    } else {
      emptyEl.style.display = "none";
      metaEl.textContent = `${snap.size} of ${MAX_ACTIVE_BANNERS} banner slots filled by paid campaigns`;
      listEl.innerHTML = "";

      // Sort worst-delivery-first so the campaign needing the most
      // attention surfaces at the top of the monitor.
      const rows = await Promise.all(snap.docs.map((d) => buildBannerRow(d.id, d.data())));
      rows.sort((a, b) => a.rank - b.rank);
      rows.forEach((r) => listEl.appendChild(r.el));
    }

    renderEmptySlotCards(snap.size);
  }, (err) => {
    console.error("Banner monitor error:", err);
    showToast("Couldn't load the banner monitor.", "error");
  });
}

/* ---------------------------------------------------------
   LIVE 3-SLOT PREVIEW — exactly what a visitor sees right now on
   Top/Bottom/Floating, using the same rotation math every future
   ad-rendering page will use (ad-priority.js's pickBannerTriplet).
   Recomputes every BANNER_CYCLE_MS so admin can literally watch
   the rotation happen, same as a real visitor would.
   --------------------------------------------------------- */
function startLivePreviewLoop() {
  if (previewTimer) clearInterval(previewTimer);
  previewTimer = setInterval(() => {
    previewCycleIndex++;
    renderLivePreview();
  }, BANNER_CYCLE_MS);
}

function renderLivePreview() {
  const triplet = pickBannerTriplet(latestActiveBanners, previewCycleIndex);
  BANNER_PLACEMENTS.forEach((slot) => {
    const el = document.getElementById(`bannerPreview-${slot}`);
    if (!el) return;
    const ad = triplet[slot];
    if (ad) {
      const mediaUrl = ad.bannerMediaUrl;
      const isVideo = ad.bannerMediaType === "video";
      el.innerHTML = mediaUrl
        ? (isVideo
          ? `<video src="${mediaUrl}" autoplay muted loop playsinline></video>`
          : `<img src="${mediaUrl}" alt="${escapeHtml(ad.title || "")}">`)
        : `<div class="bp-fallback-text">${escapeHtml(ad.title || "Untitled banner")}</div>`;
      el.classList.remove("default");
      el.title = ad.title || "";
    } else {
      const fallback = defaultBannerCache || FALLBACK_DEFAULT_BANNER;
      el.innerHTML = fallback.imageUrl
        ? `<img src="${fallback.imageUrl}" alt="${escapeHtml(fallback.title || "")}">`
        : `<div class="bp-fallback-text">${escapeHtml(fallback.title || "TaskNOVA")}</div>`;
      el.classList.add("default");
      el.title = fallback.title || "";
    }
  });
}

/* ---------------------------------------------------------
   SETTINGS: default banner + empty-slot placeholders — "if there
   is nothing then admin already knows that it's the default
   banner that's there" (the live preview above already shows
   this; these cards make it explicit + editable).
   --------------------------------------------------------- */
function renderDefaultBannerCard() {
  const el = document.getElementById("defaultBannerCard");
  if (!el) return;
  const banner = defaultBannerCache || FALLBACK_DEFAULT_BANNER;
  el.innerHTML = `
    <div class="db-preview ${banner.imageUrl ? "" : "default"}">
      ${banner.imageUrl ? `<img src="${banner.imageUrl}" alt="">` : `<div class="bp-fallback-text">${escapeHtml(banner.title)}</div>`}
    </div>
    <div class="db-info">
      <strong>${escapeHtml(banner.title)}</strong>
      <span>Shown in any banner slot with no paid campaign — ${defaultBannerCache ? "custom" : "built-in fallback, not yet customized"}.</span>
    </div>
    <button type="button" class="btn btn-ghost" id="editDefaultBannerBtn"><i class="bx bx-edit-alt"></i><span class="btn-label">Edit</span></button>
  `;
  document.getElementById("editDefaultBannerBtn").addEventListener("click", editDefaultBanner);
}

async function editDefaultBanner() {
  const current = defaultBannerCache || FALLBACK_DEFAULT_BANNER;
  const title = window.prompt("Default banner title:", current.title || "");
  if (title === null) return;
  const link = window.prompt("Default banner link:", current.link || "");
  if (link === null) return;
  const imageUrl = window.prompt("Default banner image URL (leave blank for a plain text banner):", current.imageUrl || "");
  if (imageUrl === null) return;

  try {
    await setDoc(doc(db, "siteSettings", "defaultBanner"), {
      title: title.trim() || FALLBACK_DEFAULT_BANNER.title,
      link: link.trim() || null,
      imageUrl: imageUrl.trim() || null,
      updatedAt: serverTimestamp()
    });
    defaultBannerCache = { title: title.trim(), link: link.trim() || null, imageUrl: imageUrl.trim() || null };
    renderDefaultBannerCard();
    renderLivePreview();
    showToast("Default banner updated.");
  } catch (err) {
    console.error("Save default banner error:", err);
    showToast("Couldn't save the default banner. Please try again.", "error");
  }
}

function renderEmptySlotCards(occupiedCount) {
  const wrap = document.getElementById("emptySlotCards");
  if (!wrap) return;
  const emptyCount = Math.max(0, MAX_ACTIVE_BANNERS - occupiedCount);
  wrap.innerHTML = Array.from({ length: emptyCount }).map(() => `
    <div class="empty-slot-card">
      <i class="bx bx-image-add"></i>
      <span>Slot open — no paid campaign. Showing the default TaskNOVA banner above.</span>
    </div>
  `).join("");
}

async function buildBannerRow(adId, ad) {
  const advertiser = await getUserSummary(ad.advertiserUid);
  const status = computeDeliveryStatus(ad, Date.now());
  const { level, label, remainingViews, daysLeft, actualRatePerHour, requiredRatePerHour, pct } = status;

  const el = document.createElement("div");
  el.className = "task-card";
  el.innerHTML = `
    <div class="tc-head">
      <div class="tc-title-wrap">
        <div class="tc-title">${escapeHtml(ad.title || "Untitled banner")}</div>
        <div class="tc-sub">${escapeHtml(advertiser.fullName)}${advertiser.username ? " · @" + escapeHtml(advertiser.username) : ""}</div>
      </div>
      <span class="priority-badge ${level}">${label}</span>
    </div>
    <div class="tc-progress-wrap">
      <div class="tc-progress-label"><span>${(ad.currentViews || 0).toLocaleString("en-NG")} / ${(ad.guaranteedViews || 0).toLocaleString("en-NG")} guaranteed views</span><span>${pct}%</span></div>
      <div class="tc-progress-track views-track"><div class="tc-progress-fill views-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="banner-stats-grid">
      <div class="banner-stat-box"><div class="bsb-label">Remaining views</div><div class="bsb-value">${remainingViews.toLocaleString("en-NG")}</div></div>
      <div class="banner-stat-box"><div class="bsb-label">Days left</div><div class="bsb-value">${daysLeft}</div></div>
      <div class="banner-stat-box"><div class="bsb-label">Actual pace</div><div class="bsb-value">${actualRatePerHour.toFixed(1)}/hr</div></div>
      <div class="banner-stat-box"><div class="bsb-label">Required pace</div><div class="bsb-value">${requiredRatePerHour === Infinity ? "—" : requiredRatePerHour.toFixed(1) + "/hr"}</div></div>
    </div>
    <div class="tc-date">Expires ${formatDate(ad.expiresAt)}</div>
    <div class="tc-actions">
      <button type="button" class="btn btn-ghost" data-act="edit"><i class="bx bx-edit-alt"></i><span class="btn-label">Edit</span></button>
      <button type="button" class="btn btn-danger" data-act="pull-toggle"><i class="bx bx-trash"></i><span class="btn-label">Pull</span></button>
    </div>
    <div class="tc-decline-panel" id="pullPanel-${adId}"><div><div class="tc-decline-inner">
      <p style="font-size:.82rem;color:var(--text-soft);">Pulls this banner out of rotation early. Advertisements are non-refundable once approved, same as the Active tab — ${escapeHtml(advertiser.fullName)} will not be credited back.</p>
      <div class="tc-actions">
        <button type="button" class="btn btn-ghost" data-act="pull-cancel">Cancel</button>
        <button type="button" class="btn btn-danger" data-act="pull-confirm"><span class="btn-spinner"></span><i class="bx bx-trash"></i><span class="btn-label">Confirm Pull</span></button>
      </div>
    </div></div></div>
  `;

  el.querySelector('[data-act="edit"]').addEventListener("click", () => openBannerEditor(adId, ad));
  const pullPanel = el.querySelector(`#pullPanel-${adId}`);
  el.querySelector('[data-act="pull-toggle"]').addEventListener("click", () => pullPanel.classList.add("show"));
  el.querySelector('[data-act="pull-cancel"]').addEventListener("click", () => pullPanel.classList.remove("show"));
  el.querySelector('[data-act="pull-confirm"]').addEventListener("click", (e) => pullBanner(adId, ad.title, el, e.currentTarget));

  return { el, rank: level === "critical" ? 3.5 : level === "behind" ? 3 : level === "onschedule" ? 2 : status.remainingViews <= 0 ? 0 : 1 };
}

/* ---------------------------------------------------------
   ACTION — PULL A LIVE BANNER (admin-initiated early removal)
   Same non-refundable policy as every other approved-ad delete
   on this site — see track-posted-ads.js's own delete rules.
   --------------------------------------------------------- */
async function pullBanner(adId, title, cardEl, btnEl) {
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    await updateDoc(doc(db, "advertisements", adId), {
      status: "deleted",
      hidden: true,
      deletedAt: serverTimestamp(),
      deletedBy: "admin"
    });
    showToast(`"${title || "Banner"}" pulled from rotation.`);
    animateOutAndRemove(cardEl);
  } catch (err) {
    console.error("Pull banner error:", err);
    showToast("Couldn't pull this banner. Please try again.", "error");
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

/* ---------------------------------------------------------
   ADMIN BANNER EDIT — direct edit of a live campaign's creative.
   Unlike the advertiser's own edit (which queues a pendingEdit for
   approval, since they're not the approver), admin editing here
   updates the live fields immediately — admin's own approval IS
   the review. Keeps it to a simple prompt() each rather than a
   full modal, since this is an occasional touch-up action, not a
   primary workflow.
   --------------------------------------------------------- */
async function openBannerEditor(adId, ad) {
  const newTitle = window.prompt("Banner title:", ad.title || "");
  if (newTitle === null) return;
  const newLink = window.prompt("Banner link (destination URL):", ad.link || "");
  if (newLink === null) return;

  try {
    await updateDoc(doc(db, "advertisements", adId), {
      title: newTitle.trim() || ad.title,
      link: newLink.trim() || null
    });
    showToast("Banner updated.");
  } catch (err) {
    console.error("Edit banner error:", err);
    showToast("Couldn't update this banner. Please try again.", "error");
  }
}

/* ---------------------------------------------------------
   TAB BADGE COUNTS (aggregate query — one read each, cheap)
   --------------------------------------------------------- */
async function loadCounts() {
  try {
    const [pendingSnap, activeSnap, declinedSnap, bannersSnap] = await Promise.all([
      getCountFromServer(query(collection(db, "advertisements"), where("status", "==", "pending_review"))),
      getCountFromServer(query(collection(db, "advertisements"), where("status", "==", "active"))),
      getCountFromServer(query(collection(db, "advertisements"), where("status", "==", "declined"))),
      getCountFromServer(query(collection(db, "advertisements"), where("type", "==", "banner"), where("status", "==", "active")))
    ]);
    document.getElementById("countPending").textContent = pendingSnap.data().count;
    document.getElementById("countActive").textContent = activeSnap.data().count;
    document.getElementById("countDeclined").textContent = declinedSnap.data().count;
    document.getElementById("countBanners").textContent = bannersSnap.data().count;

    // Edit-requests count needs the same inequality filter as its tab query.
    const editsSnap = await getCountFromServer(query(collection(db, "advertisements"), where("pendingEdit", "!=", null)));
    document.getElementById("countEdits").textContent = editsSnap.data().count;
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

  loadCounts();
  loadedTabs.add("pending");
  subscribeTab("pending", true);
});

window.addEventListener("beforeunload", () => {
  if (bannerUnsub) bannerUnsub();
  if (previewTimer) clearInterval(previewTimer);
});

/* ===========================================================
   NOTES
   ===========================================================
   - Admin identity read (users/{uid}) mirrors the same assumption
     flagged on Tasks & Requests — swap it if admins live elsewhere.

   - Pending/Active/Edit Requests/Declined are now realtime
     (subscribeTab, onSnapshot with a growing `limit`) instead of
     one-time getDocs reads — same conversion, same trade-off, as
     admin/tasks.js's subscribeTab (see that file's notes). Banners
     was already realtime before this pass.

   - accountType/institutionAbbr are retired site-wide — card
     subtitles show @username instead, matching every other admin
     page.

   - Decline refunds the advertiser's `wallet.deposit` immediately
     in the same transaction as the status change — Tasks & Requests
     now does the same thing on task decline (both pages refund in
     full immediately, since nothing was ever spent on a submission
     that never went live). The real difference between the two
     pages is what happens after approval: an approved/active ad
     that's later deleted (by the advertiser, or now by admin via
     the Banners tab's Pull action) is NOT refunded — the
     guaranteed-views commitment is treated as spent once live —
     whereas an approved/active task that's deleted still refunds
     the balance for any unfilled worker slots. Ads have no
     equivalent "unfilled slots" concept once live, so there's
     nothing partial to refund; Hide/Unhide + (for banners) Pull are
     the only levers admin has over a live ad.

   - Approving a banner-type ad is blocked once
     MAX_ACTIVE_BANNERS (3) are already active, per the spec's hard
     cap on simultaneous banner campaigns. There's no queue/waitlist
     UI for a blocked banner beyond the toast — it just stays in
     Pending until an admin retries after a slot frees up.

   - Edit Requests' `pendingEdit` object is now actually written —
     post-advertisement.js's ?edit=adId mode constructs it when an
     advertiser edits a currently-active ad (title/link, plus either
     description+imageUrl or bannerMediaUrl+bannerMediaType). This
     tab (already built before this pass) approves/declines it
     exactly as before; nothing here needed to change for that.

   - The priority math (ahead/on-schedule/behind/critical, and the
     ratio thresholds ≥1.15/≥0.85/≥0.5) now lives in ad-priority.js
     (computeDeliveryStatus) instead of being duplicated inline in
     buildBannerRow — per the spec's "one shared priority engine"
     rule. The Banners tab's stat rows are unchanged visually; only
     where the numbers come from moved.

   - THIS PASS's main addition — the live preview + settings:
       * The three preview boxes (#bannerPreview-top/bottom/
         floating) show exactly what pickBannerTriplet() computes
         right now, re-rendered every BANNER_CYCLE_MS (15s) by a
         plain setInterval — the same cadence (and the same
         function) any public page's real rotation should use once
         built, so this preview will already match reality the
         moment that's wired up elsewhere. It is *this admin page*
         computing and displaying the triplet for admin's benefit —
         it does not control what any visitor actually sees; each
         page that renders banners still needs its own call to
         pickBannerTriplet (or its own timer) to do that.
       * Empty slots (fewer than 3 active banner campaigns) render
         the configured default banner (siteSettings/defaultBanner)
         in the preview, and a dashed "slot open" placeholder card
         in the settings list below — this is the "if there is
         nothing then admin already knows it's the default banner"
         behaviour from the spec, made explicit rather than implicit.
       * The default banner is editable via a trio of prompt()
         dialogs (title/link/image URL) rather than a full modal —
         deliberately minimal since this is an occasional config
         action, not a primary workflow. Worth upgrading to a real
         form with a Cloudinary upload (matching post-advertisement.js)
         if this turns out to be touched often.
       * Each occupied banner slot's Edit is the same lightweight
         prompt()-based pattern, applied directly to the live ad
         (no approval step needed — admin editing IS the approval).
         Pull is a permanent, non-refundable early removal — see the
         refund-policy note above.

   - View/impression counting itself (the visitor-exposure rules —
     no double-count on refresh, new page = new exposure, advertiser
     never self-counts) is now implemented too, as
     ad-priority.js's claimImpressionSlot/isOwnAd — but only as
     importable helpers. Nothing calls them yet, because no ad-
     rendering page (home.js, earn.js, post-task.js's static banner
     placeholders, etc.) was part of this pass. Whoever builds that
     rendering should import claimImpressionSlot + isOwnAd +
     pickBannerTriplet/rankFeedAds from ad-priority.js rather than
     re-deriving any of this math a third time.
   =========================================================== */
