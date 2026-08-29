/* =========================================================
   TASKNOVA — ADVERTISEMENTS PAGE LOGIC
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
  startAfter
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

/* ---------------------------------------------------------
   STATE
   --------------------------------------------------------- */
const PAGE_SIZE = 12;

let currentUser = null;
let adDocsMap = new Map();
let pageListeners = [];
let lastVisibleDoc = null;
let hasMore = true;
let isLoading = false;
let openAdId = null;
let adSearchTerm = "";

/* ---------------------------------------------------------
   DOM REFS
   --------------------------------------------------------- */
const adList = document.getElementById("adList");
const loadMoreWrap = document.getElementById("loadMoreWrap");
const loadMoreBtn = document.getElementById("loadMoreBtn");

const adSearchInput = document.getElementById("adSearchInput");
const adSearchClear = document.getElementById("adSearchClear");

/* ---------------------------------------------------------
   AD SEARCH
   --------------------------------------------------------- */
function updateSearchClearButton() {
  adSearchClear?.classList.toggle(
    "show",
    adSearchInput?.value.trim().length > 0
  );
}

adSearchInput?.addEventListener("input", () => {
  adSearchTerm = adSearchInput.value;
  updateSearchClearButton();

  // Close any expanded advertisement when the result set changes.
  openAdId = null;

  render();
});

adSearchClear?.addEventListener("click", () => {
  if (!adSearchInput) return;

  adSearchInput.value = "";
  adSearchTerm = "";
  updateSearchClearButton();

  openAdId = null;
  render();

  adSearchInput.focus();
});

/* ---------------------------------------------------------
   RENDER
   --------------------------------------------------------- */
function sortedAds() {
  const ads = Array.from(adDocsMap.values()).sort((a, b) => {
    const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return bt - at;
  });

  const search = adSearchTerm.trim().toLowerCase();

  if (!search) return ads;

  // Price range search: 1500:3000
  const rangeMatch = search.match(
    /^([\d,\s]+)\s*:\s*([\d,\s]+)$/
  );

  if (rangeMatch) {
    const minPrice = Number(rangeMatch[1].replace(/[,\s]/g, ""));
    const maxPrice = Number(rangeMatch[2].replace(/[,\s]/g, ""));

    if (
      Number.isFinite(minPrice) &&
      Number.isFinite(maxPrice)
    ) {
      const low = Math.min(minPrice, maxPrice);
      const high = Math.max(minPrice, maxPrice);

      return ads.filter((ad) => {
        const price = Number(ad.price);

        return Number.isFinite(price) &&
          price >= low &&
          price <= high;
      });
    }
  }

  /*
   * Normal search:
   * Every typed word must appear somewhere in the advertisement's
   * searchable text. This allows searches such as:
   *
   * phone
   * blue phone
   * laptop 50000
   * student shoes
   */
  const terms = search.split(/\s+/).filter(Boolean);

  return ads.filter((ad) => {
    const searchableText = Object.entries(ad)
      .filter(([key, value]) => {
        return (
          key !== "createdAt" &&
          key !== "updatedAt" &&
          value !== null &&
          value !== undefined &&
          typeof value !== "object"
        );
      })
      .map(([, value]) => String(value))
      .join(" ")
      .toLowerCase();

    return terms.every((term) => searchableText.includes(term));
  });
}

function render() {
  const ads = sortedAds();

  if (!ads.length) {
    const hasSearch = adSearchTerm.trim().length > 0;

    adList.innerHTML = `
      <div class="ad-empty">
        <i class="bx ${hasSearch ? "bx-search-alt" : "bx-megaphone-alt"}"></i>
        ${hasSearch
          ? "No advertisements match your search."
          : "No advertisements right now — check back soon."}
      </div>
    `;

    loadMoreWrap.style.display = hasSearch && hasMore ? "flex" : "none";
    return;
  }

  adList.innerHTML = ads.map(renderAdItem).join("");

  adList.querySelectorAll(".ad-row").forEach((row) => {
    row.addEventListener("click", () => {
      toggleAd(row.closest(".ad-item").dataset.id);
    });
  });

  loadMoreWrap.style.display = hasMore ? "flex" : "none";
}

function renderAdItem(ad) {
  const isOpen = ad.id === openAdId;

  return `
    <div class="ad-item ${isOpen ? "open" : ""}" data-id="${ad.id}">
      <div class="ad-row">
        <div class="ar-thumb">
          ${ad.imageUrl ? `<img src="${ad.imageUrl}" alt="">` : `<i class="bx bx-image"></i>`}
        </div>
        <div class="ar-body">
          <div class="ar-title">${ad.title || "Untitled ad"}</div>
          <div class="ar-price">${formatNaira(ad.price)}</div>
        </div>
        <div class="ar-view-more">
          View more <i class="bx bx-chevron-down"></i>
        </div>
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

function renderAdDetail(adId) {
  const ad = adDocsMap.get(adId);
  const container = document.getElementById(`detail-${adId}`);
  if (!ad || !container) return;

  container.innerHTML = `
    ${ad.imageUrl ? `<img class="ad-detail-image" src="${ad.imageUrl}" alt="${ad.title || "Advertisement"}">` : ""}
    <p class="ad-detail-desc">${ad.description || "—"}</p>
    ${ad.link
      ? `<button type="button" class="visit-btn" id="visitBtn-${adId}"><i class="bx bx-link-external"></i> Visit</button>`
      : `<div class="no-link-note">No link was provided for this advertisement.</div>`
    }
  `;

  document.getElementById(`visitBtn-${adId}`)?.addEventListener("click", () => {
    if (ad.link) window.open(ad.link, "_blank", "noopener");
  });
}

/* ---------------------------------------------------------
   LIVE PAGINATED FEED (self-posted ads excluded client-side —
   Firestore can't combine a "!=" filter on advertiserUid with
   the orderBy a feed needs without an awkward index)
   --------------------------------------------------------- */
function subscribeNextPage() {
  if (!currentUser || !hasMore || isLoading) return;
  isLoading = true;
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.disabled = true;

  const constraints = [
    where("status", "==", "active"),
    where("hidden", "==", false),
    orderBy("createdAt", "desc")
  ];
  if (lastVisibleDoc) constraints.push(startAfter(lastVisibleDoc));
  constraints.push(limit(PAGE_SIZE));

  const q = query(collection(db, "advertisements"), ...constraints);
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
      const data = change.doc.data();
      if (data.advertiserUid === currentUser.uid) return; // never show your own ad

      if (change.type === "removed") {
        adDocsMap.delete(change.doc.id);
        if (openAdId === change.doc.id) openAdId = null;
      } else {
        adDocsMap.set(change.doc.id, { id: change.doc.id, ...data });
      }
    });

    render();
  }, (err) => {
    console.error("Advertisements feed listener error:", err);
    isLoading = false;
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  });

  pageListeners.push(unsub);
}

loadMoreBtn.addEventListener("click", subscribeNextPage);

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
   - Per section 45 of the doc, campaign duration and any private
     campaign info are deliberately never rendered here — only
     image, title, price, description, and the link are shown.

   - This page is intentionally exactly what was asked for: cards
     with image/title/price, an expand for description + Visit.
     No view-count or click-count tracking has been added — the
     background pricing doc you shared describes a guaranteed-view
     rotation system with view/click tracking (views vs. clicks,
     CTR, unique-impression rules), but that's a meaningfully
     bigger feature (needs a dedup mechanism so reloading the page
     doesn't inflate an advertiser's numbers) that wasn't part of
     this specific request. Happy to build it as its own follow-up
     if you want it — flagging rather than quietly adding it.
   =========================================================== */
