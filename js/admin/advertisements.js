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
  updateDoc,
  deleteField,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  getCountFromServer,
  arrayUnion,
  runTransaction,
  Timestamp,
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

const PAGE_SIZE = 15;
const MAX_ACTIVE_BANNERS = 3;
const MAX_DECLINES = 5;
const MS_HOUR = 1000 * 60 * 60;
const MS_DAY = MS_HOUR * 24;

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
      if (tab === "banners") startBannerMonitor();
      else loadTab(tab, true);
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
    const constraints = [...cfg.constraints];
    if (cfg.order) constraints.push(orderBy(cfg.order[0], cfg.order[1]));
    if (state.lastDoc) constraints.push(startAfter(state.lastDoc));
    constraints.push(limit(PAGE_SIZE));

    const snap = await getDocs(query(collection(db, "advertisements"), ...constraints));
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
        <div class="tc-sub">${escapeHtml(advertiser.fullName)}${advertiser.accountType ? " · " + escapeHtml(advertiser.accountType) : ""}</div>
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
        <div class="tc-sub">${escapeHtml(advertiser.fullName)}${advertiser.accountType ? " · " + escapeHtml(advertiser.accountType) : ""}</div>
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

function startBannerMonitor() {
  const listEl = document.getElementById("listBanners");
  const emptyEl = document.getElementById("emptyBanners");
  const metaEl = document.getElementById("metaBanners");

  const q = query(collection(db, "advertisements"), where("type", "==", "banner"), where("status", "==", "active"));
  bannerUnsub = onSnapshot(q, async (snap) => {
    document.getElementById("countBanners").textContent = String(snap.size);

    if (snap.empty) {
      listEl.innerHTML = "";
      emptyEl.style.display = "flex";
      metaEl.textContent = "No banner campaigns are active right now.";
      return;
    }

    emptyEl.style.display = "none";
    metaEl.textContent = `${snap.size} of ${MAX_ACTIVE_BANNERS} banner slots in rotation`;
    listEl.innerHTML = "";

    // Sort worst-delivery-first so the campaign needing the most
    // attention surfaces at the top of the monitor.
    const rows = await Promise.all(snap.docs.map((d) => buildBannerRow(d.id, d.data())));
    rows.sort((a, b) => a.rank - b.rank);
    rows.forEach((r) => listEl.appendChild(r.el));
  }, (err) => {
    console.error("Banner monitor error:", err);
    showToast("Couldn't load the banner monitor.", "error");
  });
}

async function buildBannerRow(adId, ad) {
  const advertiser = await getUserSummary(ad.advertiserUid);

  const now = Date.now();
  const approvedAtMs = ad.approvedAt?.toMillis ? ad.approvedAt.toMillis() : (ad.createdAt?.toMillis ? ad.createdAt.toMillis() : now);
  const expiresAtMs = ad.expiresAt?.toMillis ? ad.expiresAt.toMillis() : now;
  const guaranteedViews = ad.guaranteedViews || 0;
  const currentViews = ad.currentViews || 0;
  const remainingViews = Math.max(0, guaranteedViews - currentViews);
  const elapsedMs = Math.max(0, now - approvedAtMs);
  const remainingMs = Math.max(0, expiresAtMs - now);

  const actualRatePerHour = elapsedMs > 0 ? currentViews / (elapsedMs / MS_HOUR) : 0;
  const requiredRatePerHour = remainingMs > 0 ? remainingViews / (remainingMs / MS_HOUR) : (remainingViews > 0 ? Infinity : 0);

  let level, label, rank;
  if (remainingViews <= 0) {
    level = "ahead"; label = "🟢 Guarantee met"; rank = 0;
  } else if (requiredRatePerHour === Infinity) {
    level = "critical"; label = "🔴 Critically behind"; rank = 4;
  } else {
    const ratio = requiredRatePerHour > 0 ? actualRatePerHour / requiredRatePerHour : 1;
    if (ratio >= 1.15) { level = "ahead"; label = "🟢 Ahead of schedule"; rank = 1; }
    else if (ratio >= 0.85) { level = "onschedule"; label = "🟡 On schedule"; rank = 2; }
    else if (ratio >= 0.5) { level = "behind"; label = "🟠 Behind schedule"; rank = 3; }
    else { level = "critical"; label = "🔴 Critically behind"; rank = 3.5; }
  }

  const pct = guaranteedViews ? Math.min(100, Math.round((currentViews / guaranteedViews) * 100)) : 0;
  const daysLeft = Math.max(0, Math.ceil(remainingMs / MS_DAY));

  const el = document.createElement("div");
  el.className = "task-card";
  el.innerHTML = `
    <div class="tc-head">
      <div class="tc-title-wrap">
        <div class="tc-title">${escapeHtml(ad.title || "Untitled banner")}</div>
        <div class="tc-sub">${escapeHtml(advertiser.fullName)}${advertiser.accountType ? " · " + escapeHtml(advertiser.accountType) : ""}</div>
      </div>
      <span class="priority-badge ${level}">${label}</span>
    </div>
    <div class="tc-progress-wrap">
      <div class="tc-progress-label"><span>${currentViews.toLocaleString("en-NG")} / ${guaranteedViews.toLocaleString("en-NG")} guaranteed views</span><span>${pct}%</span></div>
      <div class="tc-progress-track views-track"><div class="tc-progress-fill views-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="banner-stats-grid">
      <div class="banner-stat-box"><div class="bsb-label">Remaining views</div><div class="bsb-value">${remainingViews.toLocaleString("en-NG")}</div></div>
      <div class="banner-stat-box"><div class="bsb-label">Days left</div><div class="bsb-value">${daysLeft}</div></div>
      <div class="banner-stat-box"><div class="bsb-label">Actual pace</div><div class="bsb-value">${actualRatePerHour.toFixed(1)}/hr</div></div>
      <div class="banner-stat-box"><div class="bsb-label">Required pace</div><div class="bsb-value">${requiredRatePerHour === Infinity ? "—" : requiredRatePerHour.toFixed(1) + "/hr"}</div></div>
    </div>
    <div class="tc-date">Expires ${formatDate(ad.expiresAt)}</div>
  `;

  return { el, rank };
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
  loadTab("pending", true);
});

window.addEventListener("beforeunload", () => { if (bannerUnsub) bannerUnsub(); });

/* ===========================================================
   NOTES
   ===========================================================
   - Admin identity read (users/{uid}) mirrors the same assumption
     flagged on Tasks & Requests — swap it if admins live elsewhere.

   - Decline refunds the advertiser's `wallet.deposit` immediately
     in the same transaction as the status change — Tasks & Requests
     now does the same thing on task decline (both pages refund in
     full immediately, since nothing was ever spent on a submission
     that never went live). The real difference between the two
     pages is what happens after approval: an approved/active ad
     that's later deleted (by the advertiser or admin) is NOT
     refunded — the guaranteed-views commitment is treated as spent
     once live — whereas an approved/active task that's deleted
     still refunds the balance for any unfilled worker slots. Ads
     have no equivalent "unfilled slots" concept once live, so there
     was nothing partial to refund and the admin panel accordingly
     has no delete action on the Active tab here — Hide/Unhide is
     the only lever admin has over a live ad.

   - Approving a banner-type ad is blocked once
     MAX_ACTIVE_BANNERS (3) are already active, per the spec's hard
     cap on simultaneous banner campaigns. There's no queue/waitlist
     UI for a blocked banner beyond the toast — it just stays in
     Pending until an admin retries after a slot frees up.

   - Edit Requests reads/writes a `pendingEdit` object on the ad
     doc (title/description/link/imageUrl or
     bannerMediaUrl+bannerMediaType/requestedAt), per the forward-
     looking note already left in post-advertisement.js. That
     object isn't written anywhere yet — the (not-yet-built) edit
     mode on post-advertisement.html needs to actually construct it
     when an advertiser edits a live ad, or this tab will stay
     permanently empty. track-posted-ads.js's existing "Edit" link
     (?edit=adId) is the natural place for that submission to land.

   - MAX_DECLINES (5) now mirrors Tasks & Requests exactly — same
     coloring tiers on the decline-count badge (low/mid at 3+/max at
     5). Like tasks, this is a display cap only: nothing here blocks
     the Decline action itself once an ad hits 5, since in practice
     an ad can't come back through Pending more than 5 times unless
     the (not-yet-built) edit-and-repost flow keeps allowing it past
     that count on the user side.

   - The Banners tab is entirely read-only: it does NOT assign Top/
     Bottom/Floating placements or run the 15-second rotation itself
     — that live rotation belongs on the public-facing pages
     (home.js, advertisements.js, etc., none of which implement it
     yet either). This tab only surfaces the same priority math
     (ahead/on schedule/behind/critically behind) those pages will
     need, so admins can see delivery health without waiting on that
     build. The ahead/on-schedule/behind/critical thresholds
     (ratio ≥1.15 / ≥0.85 / ≥0.5 / below) are a reasonable reading of
     the spec's qualitative language ("approximately where it should
     be") — no exact numbers were given, so tune these if you land
     on different ones once the real rotation engine is built (it
     should reuse this exact formula, per the spec's "one shared
     priority engine" requirement).

   - View/impression counting itself (the visitor-exposure rules —
     no double-count on refresh, new page = new exposure, advertiser
     never self-counts) lives entirely in the ad-rendering code on
     public pages, not here — this page only reads whatever
     `currentViews` those pages eventually write.
   =========================================================== */
