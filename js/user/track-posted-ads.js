/* =========================================================
   TASKNOVA — TRACK POSTED ADS PAGE LOGIC
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
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
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

const STATUS_LABELS = {
  active: "Active",
  pending_review: "Pending",
  declined: "Declined",
  expired: "Expired"
};

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
  if (!date) return "—";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/* ---------------------------------------------------------
   STATE
   --------------------------------------------------------- */
const PAGE_SIZE = 10;

let currentUser = null;
let activeStatus = "active";

let adDocsMap = new Map(); // ALL of this advertiser's ads, every status
let hasMore = true;
let openAdId = null;

/* ---------------------------------------------------------
   DOM REFS
   --------------------------------------------------------- */
const adList = document.getElementById("adList");
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
function sortedAds() {
  return Array.from(adDocsMap.values())
    .filter((a) => a.status === activeStatus)
    .sort((a, b) => {
      const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bt - at;
    });
}

const EMPTY_MESSAGES = {
  active: "No active advertisements right now.",
  pending_review: "Nothing waiting on admin review right now.",
  declined: "No declined advertisements.",
  expired: "No expired advertisements yet."
};

function render() {
  const ads = sortedAds();

  if (!ads.length) {
    adList.innerHTML = `<div class="ad-empty"><i class="bx bx-inbox"></i>${EMPTY_MESSAGES[activeStatus] || "Nothing here yet."}</div>`;
    loadMoreWrap.style.display = "none";
    return;
  }

  adList.innerHTML = ads.map(renderAdItem).join("");

  adList.querySelectorAll(".ad-row").forEach((row) => {
    row.addEventListener("click", () => toggleAd(row.closest(".ad-item").dataset.id));
  });

  loadMoreWrap.style.display = hasMore ? "flex" : "none";
}

function renderAdItem(ad) {
  const isOpen = ad.id === openAdId;

  return `
    <div class="ad-item ${isOpen ? "open" : ""}" data-id="${ad.id}">
      <div class="ad-row">
        <div class="tr-icon">
          ${ad.imageUrl ? `<img src="${ad.imageUrl}" alt="">` : `<i class="bx bx-megaphone-alt"></i>`}
        </div>
        <div class="tr-body">
          <div class="tr-title">${ad.title || "Untitled ad"}</div>
          <div class="tr-price">${formatNaira(ad.price)}</div>
        </div>
        <div class="tr-badges">
          <span class="status-badge ${ad.status === "pending_review" ? "pending_review" : ad.status}">${STATUS_LABELS[ad.status] || ad.status}</span>
          ${ad.hidden ? `<span class="status-badge draft"><i class="bx bx-hide"></i></span>` : ""}
        </div>
        <i class="bx bx-chevron-down tr-chevron"></i>
      </div>
      <div class="ad-detail">
        <div>
          <div class="ad-detail-inner" id="detail-${ad.id}"></div>
        </div>
      </div>
    </div>`;
}

/* ---------------------------------------------------------
   EXPAND / COLLAPSE
   --------------------------------------------------------- */
function toggleAd(adId) {
  const wasOpen = openAdId === adId;
  openAdId = wasOpen ? null : adId;

  adList.querySelectorAll(".ad-item").forEach((item) => {
    item.classList.toggle("open", item.dataset.id === openAdId);
  });

  if (!wasOpen && openAdId) {
    renderAdDetail(openAdId);
  }
}

/* ---------------------------------------------------------
   DETAIL RENDER (differs per status)
   --------------------------------------------------------- */
function renderAdDetail(adId) {
  const ad = adDocsMap.get(adId);
  const container = document.getElementById(`detail-${adId}`);
  if (!ad || !container) return;

  const baseInfo = `
    ${ad.imageUrl ? `<img class="ad-detail-thumb" src="${ad.imageUrl}" alt="">` : ""}
    <div class="td-section">
      <h3>Description</h3>
      <p>${ad.description || "—"}</p>
    </div>
    <div class="ad-stats-grid">
      <div class="ad-stat-box"><div class="asb-label">Guaranteed views</div><div class="asb-value">${(ad.guaranteedViews ?? 0).toLocaleString("en-NG")}</div></div>
      <div class="ad-stat-box"><div class="asb-label">Current views</div><div class="asb-value">${(ad.currentViews ?? 0).toLocaleString("en-NG")}</div></div>
      <div class="ad-stat-box"><div class="asb-label">Duration</div><div class="asb-value">${ad.durationDays ?? "—"} days</div></div>
      <div class="ad-stat-box"><div class="asb-label">Expires</div><div class="asb-value">${ad.expiresAt ? formatDate(ad.expiresAt) : "—"}</div></div>
    </div>
  `;

  if (ad.status === "pending_review") {
    container.innerHTML = `
      ${baseInfo}
      <div class="status-info-note"><i class="bx bx-time-five"></i> Waiting for admin review — usually within a few hours.</div>
      <div class="action-row">
        <button type="button" class="action-btn danger" id="deleteBtn-${adId}"><span class="action-spinner"></span><i class="bx bx-trash"></i> Delete &amp; Refund</button>
      </div>
    `;
    wireDelete(adId);
    return;
  }

  if (ad.status === "declined") {
    const history = ad.declineHistory || [];

    if (ad.pendingEdit) {
      // Already resubmitted and charged — sitting in admin's Edit
      // Requests tab. No Edit/Delete while that's pending: editing again
      // would double up the request, and deleting would orphan the
      // charge already taken for this resubmission.
      container.innerHTML = `
        ${baseInfo}
        <div class="td-section">
          <h3>Decline history</h3>
          ${history.length ? `
            <ul class="decline-history-list">
              ${history.map((reason, i) => `<li><i class="bx bx-x-circle"></i><span>${i + 1}. ${reason}</span></li>`).join("")}
            </ul>` : `<p>No reason on record yet.</p>`}
        </div>
        <div class="status-info-note"><i class="bx bx-time-five"></i> Resubmitted — waiting on admin to review your changes.</div>
      `;
      return;
    }

    container.innerHTML = `
      ${baseInfo}
      <div class="td-section">
        <h3>Decline history</h3>
        ${history.length ? `
          <ul class="decline-history-list">
            ${history.map((reason, i) => `<li><i class="bx bx-x-circle"></i><span>${i + 1}. ${reason}</span></li>`).join("")}
          </ul>` : `<p>No reason on record yet.</p>`}
      </div>
      <div class="status-info-note"><i class="bx bx-info-circle"></i> Your balance for this ad was refunded when it was declined.</div>
      <div class="action-row">
        <a class="action-btn primary" href="post-advertisement.html?edit=${adId}"><i class="bx bx-edit-alt"></i> Edit &amp; Repost</a>
        <button type="button" class="action-btn danger" id="deleteBtn-${adId}"><span class="action-spinner"></span><i class="bx bx-trash"></i> Delete</button>
      </div>
    `;
    wireDelete(adId);
    return;
  }

  if (ad.status === "expired") {
    container.innerHTML = `
      ${baseInfo}
      <div class="status-info-note"><i class="bx bx-hourglass"></i> This campaign has run its full paid duration.</div>
      <div class="action-row">
        <a class="action-btn primary" href="post-advertisement.html?edit=${adId}&repost=1"><i class="bx bx-refresh"></i> Repost</a>
        <button type="button" class="action-btn danger" id="deleteBtn-${adId}"><span class="action-spinner"></span><i class="bx bx-trash"></i> Delete</button>
      </div>
    `;
    wireDelete(adId);
    return;
  }

  // Active
  container.innerHTML = `
    ${baseInfo}
    ${ad.pendingEdit ? `<div class="status-info-note"><i class="bx bx-time-five"></i> Your edit is waiting on admin approval — this ad keeps showing its current version until then.</div>` : ""}
    <div class="action-row">
      <button type="button" class="action-btn" id="hideBtn-${adId}">
        <span class="action-spinner"></span>
        <i class="bx ${ad.hidden ? "bx-show" : "bx-hide"}"></i> ${ad.hidden ? "Unhide" : "Hide"}
      </button>
      <a class="action-btn primary" href="post-advertisement.html?edit=${adId}"><i class="bx bx-edit-alt"></i> Edit</a>
      <button type="button" class="action-btn danger" id="deleteBtn-${adId}">
        <span class="action-spinner"></span>
        <i class="bx bx-trash"></i> Delete
      </button>
    </div>
    <p class="refund-note">Editing a live ad doesn't take it down — your changes are queued for admin approval and the current version keeps running until then. Advertisements are non-refundable once approved — deleting an active or expired ad does not return your balance.</p>
  `;

  wireHide(adId, ad.hidden);
  wireDelete(adId);
}

/* ---------------------------------------------------------
   HIDE / UNHIDE (free, no wallet impact)
   --------------------------------------------------------- */
function wireHide(adId, currentlyHidden) {
  document.getElementById(`hideBtn-${adId}`)?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.classList.add("loading");
    btn.disabled = true;
    try {
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "advertisements", adId);
        const snap = await transaction.get(ref);
        if (!snap.exists()) throw new Error("Advertisement not found.");
        transaction.update(ref, { hidden: !currentlyHidden });
      });
      showToast(currentlyHidden ? "Ad unhidden." : "Ad hidden.");
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
   DELETE — refund rules (per the platform's rules, distinct from
   Task refund rules):
     - Pending:  full refund — never reviewed, nothing spent.
     - Declined: no refund here — the balance was already returned
                 at the moment admin declined it (a future Admin
                 feature). Deleting now is just cleanup.
     - Active / Expired: NEVER refunded, regardless of remaining
                 duration or unused views — ads are non-refundable
                 once approved, full stop.
   --------------------------------------------------------- */
function wireDelete(adId) {
  document.getElementById(`deleteBtn-${adId}`)?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const ad = adDocsMap.get(adId);
    if (!ad) return;

    const willRefund = ad.status === "pending_review";
    const refundAmount = willRefund ? (ad.price || 0) : 0;

    const confirmMsg = refundAmount > 0
      ? `Delete this advertisement? ${formatNaira(refundAmount)} will be refunded to your Deposit Balance. This can't be undone.`
      : `Delete this advertisement? This can't be undone and it will not be refunded.`;

    if (!window.confirm(confirmMsg)) return;

    btn.classList.add("loading");
    btn.disabled = true;

    try {
      const adRef = doc(db, "advertisements", adId);

      await runTransaction(db, async (transaction) => {
        const adSnap = await transaction.get(adRef);
        if (!adSnap.exists()) throw new Error("Advertisement not found.");
        const data = adSnap.data();

        const refund = data.status === "pending_review" ? (data.price || 0) : 0;

        // Firestore transactions require every read before any write —
        // reading the wallet AFTER the ad update (as this used to) made
        // every refunding delete throw and roll back silently, which is
        // exactly the "delete and refund doesn't work" bug reported on
        // the tasks side too. Non-refunding deletes (nothing to read)
        // were never affected, which is why those looked fine.
        const userRef = doc(db, "users", currentUser.uid);
        let deposit = 0;
        if (refund > 0) {
          const userSnap = await transaction.get(userRef);
          deposit = userSnap.data()?.wallet?.deposit ?? 0;
        }

        transaction.update(adRef, { status: "deleted", hidden: true, deletedAt: serverTimestamp() });

        if (refund > 0) {
          transaction.update(userRef, { "wallet.deposit": deposit + refund });

          const txRef = doc(collection(db, "users", currentUser.uid, "transactions"));
          transaction.set(txRef, {
            type: "refund",
            direction: "credit",
            title: `Refund: deleted advertisement "${data.title}"`,
            amount: refund,
            status: "successful",
            createdAt: serverTimestamp()
          });
        }
      });

      adDocsMap.delete(adId);
      openAdId = null;
      render();
      showToast(refundAmount > 0 ? `Ad deleted — ${formatNaira(refundAmount)} refunded.` : "Ad deleted.");
    } catch (err) {
      console.error("Delete ad error:", err);
      showToast(err.message || "Couldn't delete — please try again.", "bx-error-circle");
      btn.classList.remove("loading");
      btn.disabled = false;
    }
  });
}

/* ---------------------------------------------------------
   ONE LISTENER FOR THE WHOLE PAGE
   Every tab (Pending/Active/Declined/Expired) is a client-side
   filter over the SAME onSnapshot — a single
   where("advertiserUid","==",...) query, no status filter —
   instead of a separate query+index per tab. Switching tabs is
   instant; "Load more" grows the one shared `limit` and
   re-subscribes. Same pattern as track-posted-tasks.js — see
   that file's notes for the full trade-off.
   --------------------------------------------------------- */
let pageSize = PAGE_SIZE;
let adsUnsub = null;

function subscribeAll() {
  if (!currentUser) return;
  if (adsUnsub) adsUnsub();
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.disabled = true;

  const q = query(
    collection(db, "advertisements"),
    where("advertiserUid", "==", currentUser.uid),
    orderBy("createdAt", "desc"),
    limit(pageSize)
  );

  adsUnsub = onSnapshot(q, (snap) => {
    adDocsMap = new Map();
    snap.docs.forEach((d) => adDocsMap.set(d.id, { id: d.id, ...d.data() }));
    hasMore = snap.docs.length === pageSize;

    if (openAdId && !adDocsMap.has(openAdId)) openAdId = null;

    render();
    if (openAdId && document.getElementById(`detail-${openAdId}`)) {
      renderAdDetail(openAdId);
    }

    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  }, (err) => {
    console.error("Track posted ads listener error:", err);
    showToast("Couldn't load your ads.", "bx-error-circle");
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  });
}

loadMoreBtn.addEventListener("click", () => {
  pageSize += PAGE_SIZE;
  subscribeAll();
});

statusTabs.addEventListener("click", (e) => {
  const chip = e.target.closest(".filter-chip");
  if (!chip || chip.dataset.status === activeStatus) return;
  statusTabs.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  activeStatus = chip.dataset.status;
  openAdId = null;
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

    if (userNameEl) userNameEl.textContent = fullName || user.email;
    // accountType/institutionAbbr are retired site-wide — show the
    // username instead.
    if (userTypeEl) userTypeEl.textContent = data.username ? "@" + data.username : user.email;
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

  subscribeAll();
});

/* ===========================================================
   NOTES
   ===========================================================
   - Hide/Unhide and Delete are real, working client-side Firestore
     transactions — no Cloud Function needed, since these are just
     the advertiser's own action on data they already own.

   - DELETE + REFUND BUG (fixed this pass): the transaction wrote
     to the ad doc and only then read the user's wallet inside the
     refund branch. Firestore requires every read before any write
     in a transaction, so any refunding delete (Pending) threw and
     silently rolled back — non-refunding deletes (Declined/Active/
     Expired, no wallet read at all) were never affected, which is
     exactly why only Pending looked broken. Reads now come first.
     track-posted-tasks.js had the identical bug, same fix.

   - One employer-wide onSnapshot now feeds every tab (see
     subscribeAll above) instead of a separate query per status —
     same consolidation as track-posted-tasks.js, for the same
     reason (fewer indexes, instant tab switching).

   - "Edit" (Active) and "Edit & Repost"/"Repost" (Declined/
     Expired) now work — post-advertisement.html reads ?edit=ID,
     loads the ad, and pre-fills the form:
       - Editing an ACTIVE ad locks the package/price entirely and
         writes a `pendingEdit` object on the ad doc instead of
         touching the live fields — no charge, and the ad keeps
         showing its current version until admin approves or
         declines the change (see admin/advertisements.js's Edit
         Requests tab, which already existed and expects exactly
         this shape). The banner near the top of this file's Active
         branch, and the pendingEdit badge in its detail view,
         reflect that.
       - Editing a DECLINED ad charges in full right away (it was
         refunded at decline time, so nothing is double-charged) but
         — as of a later pass — does NOT resubmit directly to
         "pending_review" either. It writes the whole proposal as a
         `pendingEdit` (isResubmission: true) and leaves the ad's
         status as "declined" until admin acts from Edit Requests,
         so it never mixes into the ordinary Pending queue. This
         file's Declined-tab detail view reflects that: once
         ad.pendingEdit is set, Edit/Delete are replaced with a
         "waiting on admin" note (editing again would double up the
         request, and deleting would orphan the charge already
         taken). Editing an EXPIRED ad is unchanged — still a full,
         direct resubmission straight to "pending_review" — since an
         expired campaign was never declined and wasn't part of this
         change.

   - Expiring an ad (flipping status: "active" → "expired" once
     expiresAt has passed) needs a scheduled Cloud Function — it
     must fire whether or not the advertiser ever reopens the app.
     Nothing in this page can substitute for that.

   - Approve/decline (and the refund that comes with a decline) are
     already built on admin/advertisements.js — that page existed
     and was substantially complete before this pass touched it;
     it wasn't something still to build. declineHistory is written
     there, not here.
   =========================================================== */
