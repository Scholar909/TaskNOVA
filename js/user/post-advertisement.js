/* =========================================================
   TASKNOVA — POST ADVERTISEMENT PAGE LOGIC
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
  limit,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

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
const storage = getStorage(app);

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
   DEFAULT AD ELEMENTS
   No more Skred for advertising — the default ad banner across
   the site now links straight to this page. Since we're already
   here, clicking the floating ad just scrolls to the form.
   --------------------------------------------------------- */
document.querySelectorAll("[data-default-ad]").forEach((el) => {
  el.addEventListener("click", () => {
    document.getElementById("postAdForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
   AD PACKAGES — Starter/Standard/Extended shown as regular
   options; Banner is Monthly-only and gated by slot availability
   (max 3 banner slots at a time, site-wide).
   --------------------------------------------------------- */
const AD_PACKAGES = {
  starter: { label: "Starter (3 days)", duration: 3, items: [
    { views: 50, price: 150 },
    { views: 100, price: 250 },
    { views: 250, price: 450 },
    { views: 500, price: 750 }
  ]},
  standard: { label: "Standard (7 days)", duration: 7, items: [
    { views: 100, price: 300 },
    { views: 250, price: 550 },
    { views: 500, price: 900 },
    { views: 1000, price: 1500 },
    { views: 2500, price: 3000 }
  ]},
  extended: { label: "Extended (14 days)", duration: 14, items: [
    { views: 250, price: 700 },
    { views: 500, price: 1100 },
    { views: 1000, price: 1800 },
    { views: 2500, price: 3500 },
    { views: 5000, price: 6000 }
  ]}
};

const BANNER_PACKAGE = { label: "Banner (30 days)", duration: 30, items: [
  { views: 500, price: 1500 },
  { views: 1000, price: 2500 },
  { views: 2500, price: 4500 },
  { views: 5000, price: 7500 },
  { views: 10000, price: 12000 }
]};

const MAX_BANNER_SLOTS = 3;

/* ---------------------------------------------------------
   BANNER CREATIVE SPECS — banner placements (top/bottom/
   floating) are a fixed-height, wide strip, so the creative
   must be landscape and must never exceed this box. Smaller
   is always fine; these are ceilings, not targets.

   NOTE: maxWidth/maxHeight/minAspectRatio describe the actual
   banner slot on the live site. If that slot's real pixel size
   ever changes, update the three numbers below — everything
   else (labels, checklist, validation) reads from them.
   --------------------------------------------------------- */
const BANNER_MEDIA_SPECS = {
  maxWidth: 1200,
  maxHeight: 300,
  minAspectRatio: 3, // width must be at least 3x the height — a wide banner shape
  image: {
    types: ["image/webp", "image/jpeg", "image/jpg", "image/png"],
    typeLabel: "WebP, JPG or PNG",
    maxSizeMB: 5
  },
  video: {
    types: ["video/webm", "video/mp4"],
    typeLabel: "WebM (preferred) or MP4",
    maxDurationSec: 15,
    maxSizeMB: 2,
    maxHeightPx: 720
  }
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

/* ---------------------------------------------------------
   DOM REFS — pack selection
   --------------------------------------------------------- */
const adDurationSelect = document.getElementById("adDuration");
const adPackSelect = document.getElementById("adPack");
const packPreview = document.getElementById("packPreview");
const pvViews = document.getElementById("pvViews");
const pvDuration = document.getElementById("pvDuration");
const pvPrice = document.getElementById("pvPrice");

const bannerPackSelect = document.getElementById("bannerPack");
const bannerSlotNote = document.getElementById("bannerSlotNote");

const adTitleInput = document.getElementById("adTitle");
const descriptionCard = document.getElementById("descriptionCard");
const adDescriptionInput = document.getElementById("adDescription");
const adLinkInput = document.getElementById("adLink");
const adPriceInput = document.getElementById("adPrice");
const priceFloorNote = document.getElementById("priceFloorNote");

const mediaSectionTitle = document.getElementById("mediaSectionTitle");
const mediaOptionalTag = document.getElementById("mediaOptionalTag");
const mediaUploadHint = document.getElementById("mediaUploadHint");
const mediaSpecsNote = document.getElementById("mediaSpecsNote");
const mediaSpecsList = document.getElementById("mediaSpecsList");
const mediaChecklist = document.getElementById("mediaChecklist");

let isBannerMode = false;

Object.entries(AD_PACKAGES).forEach(([key, cat]) => {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = cat.label;
  adDurationSelect.appendChild(opt);
});

let selectedPackage = null; // { type, views, price, duration }

function applySelection(pkg) {
  selectedPackage = pkg;

  pvViews.textContent = pkg.views.toLocaleString("en-NG");
  pvDuration.textContent = `${pkg.duration} days`;
  pvPrice.textContent = formatNaira(pkg.price);
  packPreview.style.display = "grid";

  adPriceInput.value = pkg.price;
  adPriceInput.min = pkg.price;
  priceFloorNote.textContent = `Set by the package you picked — you can raise it, but not lower it below ${formatNaira(pkg.price)}.`;

  updateBalanceCheck();
}

/* ---------------------------------------------------------
   BANNER MODE TOGGLE — the only structural change the spec
   calls for: Banner packages drop the Description field
   entirely and turn the image zone into an image-or-video
   zone with its own specs + a live requirement checklist.
   Everything else on the page is untouched.
   --------------------------------------------------------- */
function setBannerMode(isBanner) {
  isBannerMode = isBanner;

  descriptionCard.style.display = isBanner ? "none" : "";
  adDescriptionInput.required = !isBanner;

  mediaSectionTitle.textContent = isBanner ? "3. Banner creative (image or video)" : "3. Ad image";
  mediaOptionalTag.textContent = isBanner ? "required" : "optional";
  mediaUploadHint.textContent = isBanner ? "Tap to add an image or video" : "Tap to add an image";
  adImageInput.accept = isBanner ? "image/*,video/*" : "image/*";

  mediaSpecsNote.style.display = isBanner ? "flex" : "none";
  if (isBanner && !mediaSpecsList.dataset.filled) {
    mediaSpecsList.innerHTML = `
      <li><i class="bx bx-image"></i> Image — ${BANNER_MEDIA_SPECS.image.typeLabel}, up to ${BANNER_MEDIA_SPECS.maxWidth}×${BANNER_MEDIA_SPECS.maxHeight}px, wide (landscape) shape.</li>
      <li><i class="bx bx-video"></i> Video — ${BANNER_MEDIA_SPECS.video.typeLabel}, up to ${BANNER_MEDIA_SPECS.video.maxDurationSec}s, up to ${BANNER_MEDIA_SPECS.video.maxSizeMB}MB, up to ${BANNER_MEDIA_SPECS.video.maxHeightPx}p, same wide shape.</li>
      <li><i class="bx bx-check-shield"></i> These are all maximums — smaller, shorter or lighter is always fine.</li>
    `;
    mediaSpecsList.dataset.filled = "true";
  }

  // Switching modes invalidates whatever was picked under the other mode.
  resetMediaUpload();
}

/* ---------------------------------------------------------
   PACK SELECTION HANDLERS
   --------------------------------------------------------- */
adDurationSelect.addEventListener("change", () => {
  const cat = AD_PACKAGES[adDurationSelect.value];
  adPackSelect.innerHTML = `<option value="" disabled selected>Choose views</option>`;
  adPackSelect.disabled = !cat;
  if (!cat) return;

  // Picking a regular package clears any banner selection, and vice versa.
  bannerPackSelect.value = "";
  setBannerMode(false);

  cat.items.forEach((item, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = `${item.views.toLocaleString("en-NG")} views — ${formatNaira(item.price)}`;
    adPackSelect.appendChild(opt);
  });
});

adPackSelect.addEventListener("change", () => {
  const cat = AD_PACKAGES[adDurationSelect.value];
  const item = cat?.items[Number(adPackSelect.value)];
  if (!item) return;
  applySelection({ type: adDurationSelect.value, views: item.views, price: item.price, duration: cat.duration });
});

bannerPackSelect.addEventListener("change", () => {
  const item = BANNER_PACKAGE.items[Number(bannerPackSelect.value)];
  if (!item) return;
  // Picking a banner package clears any regular selection.
  adDurationSelect.value = "";
  adPackSelect.innerHTML = `<option value="" disabled selected>Choose an ad type first</option>`;
  adPackSelect.disabled = true;
  setBannerMode(true);
  applySelection({ type: "banner", views: item.views, price: item.price, duration: BANNER_PACKAGE.duration });
});

/* ---------------------------------------------------------
   BANNER SLOT AVAILABILITY (live) — max 3 slots, site-wide.
   Counts anything that could still occupy a slot: pending review
   or already active. A lightweight existence/count check, not a
   constant poll — it's a single onSnapshot on a small query.
   --------------------------------------------------------- */
const bannerSlotQuery = query(
  collection(db, "advertisements"),
  where("type", "==", "banner"),
  where("status", "in", ["pending_review", "active"])
);

onSnapshot(bannerSlotQuery, (snap) => {
  const used = snap.size;
  const available = Math.max(0, MAX_BANNER_SLOTS - used);

  if (available > 0) {
    bannerSlotNote.className = "banner-slot-note available";
    bannerSlotNote.innerHTML = `<i class="bx bx-check-circle"></i><span>Banner — available slot ${available}/${MAX_BANNER_SLOTS}</span>`;
    bannerPackSelect.disabled = false;
    bannerPackSelect.innerHTML = `<option value="" disabled selected>Choose views</option>`;
    BANNER_PACKAGE.items.forEach((item, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = `${item.views.toLocaleString("en-NG")} views — ${formatNaira(item.price)}`;
      bannerPackSelect.appendChild(opt);
    });
  } else {
    bannerSlotNote.className = "banner-slot-note full";
    bannerSlotNote.innerHTML = `<i class="bx bx-x-circle"></i><span>Banner — 0/${MAX_BANNER_SLOTS} available. No banner slot open right now.</span>`;
    bannerPackSelect.disabled = true;
    bannerPackSelect.innerHTML = `<option value="" disabled selected>No slot available</option>`;
  }
}, (err) => {
  console.error("Banner slot check error:", err);
  bannerSlotNote.className = "banner-slot-note";
  bannerSlotNote.innerHTML = `<i class="bx bx-error-circle"></i><span>Couldn't check banner availability.</span>`;
});

/* ---------------------------------------------------------
   PRICE — floor enforced, never reduce-able below the package price
   --------------------------------------------------------- */
adPriceInput.addEventListener("input", updateBalanceCheck);
adPriceInput.addEventListener("blur", () => {
  const floor = selectedPackage?.price ?? 0;
  if (Number(adPriceInput.value) < floor) {
    adPriceInput.value = floor;
    updateBalanceCheck();
  }
});

/* ---------------------------------------------------------
   IMAGE / VIDEO UPLOAD — Firebase Storage, uploaded on select.
   Regular packages: image only, exactly as before.
   Banner packages: image OR video, validated against
   BANNER_MEDIA_SPECS with a live pass/fail checklist before
   the file is ever uploaded.
   --------------------------------------------------------- */
const imageUploadZone = document.getElementById("imageUploadZone");
const adImageInput = document.getElementById("adImageInput");
const imageUploadEmpty = document.getElementById("imageUploadEmpty");
const imagePreview = document.getElementById("imagePreview");
const videoPreview = document.getElementById("videoPreview");
const imageUploadProgress = document.getElementById("imageUploadProgress");
const imageUploadFill = document.getElementById("imageUploadFill");
const imageUploadPercent = document.getElementById("imageUploadPercent");
const imageRemoveBtn = document.getElementById("imageRemoveBtn");

let uploadedMediaUrl = null;
let uploadedMediaType = null; // "image" | "video"
let isUploadingImage = false;

imageUploadZone.addEventListener("click", (e) => {
  if (e.target === imageRemoveBtn || imageRemoveBtn.contains(e.target)) return;
  adImageInput.click();
});

function showLocalPreview(type, url) {
  imageUploadEmpty.style.display = "none";
  if (type === "video") {
    imagePreview.style.display = "none";
    imagePreview.removeAttribute("src");
    videoPreview.style.display = "block";
    videoPreview.src = url;
  } else {
    videoPreview.pause?.();
    videoPreview.style.display = "none";
    videoPreview.removeAttribute("src");
    imagePreview.style.display = "block";
    imagePreview.src = url;
  }
  imageRemoveBtn.style.display = "flex";
}

function resetMediaUpload() {
  uploadedMediaUrl = null;
  uploadedMediaType = null;
  isUploadingImage = false;
  adImageInput.value = "";
  imagePreview.style.display = "none";
  imagePreview.removeAttribute("src");
  videoPreview.pause?.();
  videoPreview.style.display = "none";
  videoPreview.removeAttribute("src");
  imageUploadEmpty.style.display = "flex";
  imageRemoveBtn.style.display = "none";
  imageUploadProgress.style.display = "none";
  mediaChecklist.style.display = "none";
  mediaChecklist.innerHTML = "";
}

function buildBannerChecks(cfg) {
  const list = [
    { label: `Format: ${cfg.typeLabel}`, pass: cfg.typeOk },
    { label: cfg.sizeLabel, pass: cfg.sizeOk }
  ];
  if (cfg.durationLabel) list.push({ label: cfg.durationLabel, pass: cfg.durationOk });
  if (cfg.resolutionLabel) list.push({ label: cfg.resolutionLabel, pass: cfg.resolutionOk });
  list.push({ label: cfg.dimsLabel, pass: cfg.dimsOk });
  list.push({ label: cfg.ratioLabel, pass: cfg.ratioOk });
  return list;
}

function renderChecklist(checks, overallValid) {
  mediaChecklist.style.display = "grid";
  const items = checks.map((c) => `
    <div class="mc-item ${c.pass ? "pass" : "fail"}">
      <i class="bx ${c.pass ? "bx-check-circle" : "bx-x-circle"}"></i>
      <span>${c.label}</span>
    </div>
  `).join("");
  const summary = `<div class="mc-summary ${overallValid ? "ok" : "blocked"}">${
    overallValid ? "Meets all requirements — ready to upload." : "Doesn't meet one or more requirements above — pick a different file."
  }</div>`;
  mediaChecklist.innerHTML = items + summary;
}

function validateBannerImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      const checks = buildBannerChecks({
        typeOk: BANNER_MEDIA_SPECS.image.types.includes(file.type),
        typeLabel: BANNER_MEDIA_SPECS.image.typeLabel,
        sizeOk: file.size <= BANNER_MEDIA_SPECS.image.maxSizeMB * 1024 * 1024,
        sizeLabel: `Under ${BANNER_MEDIA_SPECS.image.maxSizeMB}MB`,
        dimsOk: w <= BANNER_MEDIA_SPECS.maxWidth && h <= BANNER_MEDIA_SPECS.maxHeight,
        dimsLabel: `Fits within ${BANNER_MEDIA_SPECS.maxWidth}×${BANNER_MEDIA_SPECS.maxHeight}px (yours: ${w}×${h}px)`,
        ratioOk: w >= h * BANNER_MEDIA_SPECS.minAspectRatio,
        ratioLabel: "Wide, landscape banner shape"
      });
      resolve({ valid: checks.every((c) => c.pass), checks, url });
    };
    img.onerror = () => {
      resolve({ valid: false, checks: [{ label: "Couldn't read this image — try a different file.", pass: false }], url });
    };
    img.src = url;
  });
}

function validateBannerVideo(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.muted = true;
    vid.onloadedmetadata = () => {
      const w = vid.videoWidth, h = vid.videoHeight;
      const duration = vid.duration || 0;
      const checks = buildBannerChecks({
        typeOk: BANNER_MEDIA_SPECS.video.types.includes(file.type),
        typeLabel: BANNER_MEDIA_SPECS.video.typeLabel,
        sizeOk: file.size <= BANNER_MEDIA_SPECS.video.maxSizeMB * 1024 * 1024,
        sizeLabel: `Under ${BANNER_MEDIA_SPECS.video.maxSizeMB}MB`,
        durationOk: duration <= BANNER_MEDIA_SPECS.video.maxDurationSec + 0.15,
        durationLabel: `${BANNER_MEDIA_SPECS.video.maxDurationSec}s or shorter (yours: ${duration.toFixed(1)}s)`,
        resolutionOk: h <= BANNER_MEDIA_SPECS.video.maxHeightPx,
        resolutionLabel: `${BANNER_MEDIA_SPECS.video.maxHeightPx}p or lower`,
        dimsOk: w <= BANNER_MEDIA_SPECS.maxWidth && h <= BANNER_MEDIA_SPECS.maxHeight,
        dimsLabel: `Fits within ${BANNER_MEDIA_SPECS.maxWidth}×${BANNER_MEDIA_SPECS.maxHeight}px (yours: ${w}×${h}px)`,
        ratioOk: w >= h * BANNER_MEDIA_SPECS.minAspectRatio,
        ratioLabel: "Wide, landscape banner shape"
      });
      resolve({ valid: checks.every((c) => c.pass), checks, url });
    };
    vid.onerror = () => {
      resolve({ valid: false, checks: [{ label: "Couldn't read this video — try a different file.", pass: false }], url });
    };
    vid.src = url;
  });
}

function startMediaUpload(file, type, previewUrl) {
  showLocalPreview(type, previewUrl || URL.createObjectURL(file));

  imageUploadProgress.style.display = "flex";
  imageUploadFill.style.width = "0%";
  imageUploadPercent.textContent = "0%";
  isUploadingImage = true;
  uploadedMediaType = type;

  const folder = type === "video" ? "ad-videos" : "ad-images";
  const path = `${folder}/${currentUser.uid}/${Date.now()}-${file.name}`;
  const fileRef = storageRef(storage, path);
  const uploadTask = uploadBytesResumable(fileRef, file);

  uploadTask.on("state_changed",
    (snapshot) => {
      const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      imageUploadFill.style.width = pct + "%";
      imageUploadPercent.textContent = pct + "%";
    },
    (err) => {
      console.error("Media upload error:", err);
      showMsg("error", isBannerMode
        ? "Upload failed — please try again."
        : "Image upload failed — you can still post without one, or try again.");
      imageUploadProgress.style.display = "none";
      isUploadingImage = false;
    },
    async () => {
      uploadedMediaUrl = await getDownloadURL(uploadTask.snapshot.ref);
      imageUploadProgress.style.display = "none";
      imageRemoveBtn.style.display = "flex";
      isUploadingImage = false;
    }
  );
}

adImageInput.addEventListener("change", () => {
  const file = adImageInput.files?.[0];
  if (!file) return;
  clearMsg();

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  if (!isBannerMode) {
    // Regular packages: unchanged image-only behaviour.
    if (!isImage) { showMsg("error", "Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { showMsg("error", "Image should be under 5MB."); return; }
    startMediaUpload(file, "image");
    return;
  }

  // Banner packages: image or video, checked against the specs above
  // the upload zone before anything is sent to storage.
  if (!isImage && !isVideo) {
    showMsg("error", "Please choose an image or a video file.");
    return;
  }

  const validate = isImage ? validateBannerImage(file) : validateBannerVideo(file);
  validate.then((result) => {
    showLocalPreview(isImage ? "image" : "video", result.url);
    renderChecklist(result.checks, result.valid);
    if (result.valid) {
      startMediaUpload(file, isImage ? "image" : "video", result.url);
    } else {
      uploadedMediaUrl = null;
      uploadedMediaType = null;
      isUploadingImage = false;
    }
  });
});

imageRemoveBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  resetMediaUpload();
});

/* ---------------------------------------------------------
   BALANCE CHECK
   --------------------------------------------------------- */
const depositBalanceValue = document.getElementById("depositBalanceValue");
const balanceRow = document.querySelector(".balance-row");

function updateBalanceCheck() {
  const price = Number(adPriceInput.value) || 0;
  balanceRow.classList.toggle("insufficient", price > currentDepositBalance);
}

/* ---------------------------------------------------------
   FORM MESSAGES
   --------------------------------------------------------- */
const formMsg = document.getElementById("formMsg");

function showMsg(type, text) {
  formMsg.className = "panel-msg show " + type;
  const icon = type === "error" ? "bx-error-circle" : "bx-check-circle";
  formMsg.innerHTML = `<i class="bx ${icon}"></i><span>${text}</span>`;
}
function clearMsg() {
  formMsg.className = "panel-msg";
  formMsg.innerHTML = "";
}

/* ---------------------------------------------------------
   VALIDATION
   --------------------------------------------------------- */
function validateForm() {
  if (!selectedPackage) return "Pick a package first.";
  if (!adTitleInput.value.trim()) return "Add a title for your ad.";
  if (isBannerMode) {
    if (!uploadedMediaUrl) return "Banner ads need an image or video that meets the specs above.";
  } else {
    if (!adDescriptionInput.value.trim()) return "Add a short description.";
  }
  if (adLinkInput.value.trim() && !/^https?:\/\//i.test(adLinkInput.value.trim())) return "That link doesn't look right — it should start with http:// or https://";
  if (!adPriceInput.value || Number(adPriceInput.value) < selectedPackage.price) return "Price looks off — please recheck.";
  if (isUploadingImage) return "Your media is still uploading — please wait a moment.";
  return null;
}

/* ---------------------------------------------------------
   SUBMIT — reserve funds and create the ad doc in one Firestore
   transaction (pure internal wallet movement, no Cloud Function).
   --------------------------------------------------------- */
const postAdForm = document.getElementById("postAdForm");
const postAdSubmit = document.getElementById("postAdSubmit");

let currentUser = null;
let currentDepositBalance = 0;

postAdForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();

  const errorText = validateForm();
  if (errorText) { showMsg("error", errorText); return; }
  if (!currentUser) return;

  const price = Number(adPriceInput.value);

  if (price > currentDepositBalance) {
    postAdSubmit.classList.add("shake");
    setTimeout(() => postAdSubmit.classList.remove("shake"), 400);
    showMsg("error", `Your Deposit Balance (${formatNaira(currentDepositBalance)}) is lower than ${formatNaira(price)}. Please deposit more before posting.`);
    return;
  }

  postAdSubmit.classList.add("loading");
  postAdSubmit.disabled = true;

  try {
    const userRef = doc(db, "users", currentUser.uid);
    const adRef = doc(collection(db, "advertisements"));

    const adData = {
      advertiserUid: currentUser.uid,
      type: selectedPackage.type,
      durationDays: selectedPackage.duration,
      guaranteedViews: selectedPackage.views,
      basePrice: selectedPackage.price,
      price,
      title: adTitleInput.value.trim(),
      description: isBannerMode ? null : adDescriptionInput.value.trim(),
      link: adLinkInput.value.trim() || null,
      imageUrl: isBannerMode ? null : uploadedMediaUrl,
      bannerMediaType: isBannerMode ? uploadedMediaType : null,
      bannerMediaUrl: isBannerMode ? uploadedMediaUrl : null,
      currentViews: 0,
      clicks: 0,
      status: "pending_review", // admin approves before it appears anywhere
      hidden: false,
      createdAt: serverTimestamp(),
      expiresAt: null // set by admin on approval, so the duration counts from go-live, not submission
    };

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) throw new Error("Account not found.");

      const deposit = snap.data().wallet?.deposit ?? 0;
      if (price > deposit) throw new Error("Your Deposit Balance is too low to post this ad.");

      transaction.update(userRef, { "wallet.deposit": deposit - price });
      transaction.set(adRef, adData);

      const txRef = doc(collection(db, "users", currentUser.uid, "transactions"));
      transaction.set(txRef, {
        type: "ad_post",
        direction: "debit",
        title: `Posted advertisement: ${adData.title}`,
        amount: price,
        status: "successful",
        createdAt: serverTimestamp()
      });
    });

    showMsg("success", "Advertisement posted! It'll go live once approved — usually within a few hours.");
    setTimeout(() => { window.location.href = "track-posted-ads.html"; }, 1800);
  } catch (err) {
    console.error("Post ad error:", err);
    showMsg("error", err.message || "Something went wrong posting your ad. Please try again.");
  } finally {
    postAdSubmit.classList.remove("loading");
    postAdSubmit.disabled = false;
  }
});

/* ---------------------------------------------------------
   AUTH GUARD
   --------------------------------------------------------- */
const userNameEl = document.getElementById("menuUserName");
const userTypeEl = document.getElementById("menuUserType");
const userAvatarEl = document.getElementById("menuUserAvatar");
const alertDot = document.getElementById("alertDot");
const removeAdsStatus = document.getElementById("removeAdsStatus");

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
    if (removeAdsStatus) removeAdsStatus.style.display = data.popupRemovalActive ? "inline-flex" : "none";

    currentDepositBalance = data.wallet?.deposit ?? 0;
    depositBalanceValue.textContent = formatNaira(currentDepositBalance);
    updateBalanceCheck();
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
});

/* ===========================================================
   NOTES
   ===========================================================
   - No Cloud Function is used to post an ad — the deposit
     deduction and ad-doc creation happen in a single client-side
     Firestore transaction, same lightweight pattern as Post Task
     and Wallet's Swap. Firestore rules should still enforce that
     a user can only ever decrease their own wallet.deposit from
     client code, never increase it.

   - Ads start at status: "pending_review" and only appear on the
     Advertisements page, home feed, task feed, etc. once an admin
     sets status: "active" and stamps expiresAt (createdAt + the
     package's duration, counted from approval, not submission —
     that's deliberate, so nobody loses days waiting on review).

   - advertiserUid is what the Advertisements/Earn feeds must
     filter out client-side (advertiserUid !== currentUser.uid) so
     a user never sees their own posted ad in their own browsing
     view — same rule as Post Task's employerUid.

   - Editing an already-approved ad should NOT overwrite the live
     version immediately: per the spec, save the edit as a pending
     revision (e.g. a "pendingEdit" object on the ad doc) that an
     admin reviews. If approved, apply it to the live fields; if
     declined, discard it and the ad keeps running as-is until it
     expires. That logic belongs on the (not-yet-built) Track
     Posted Ads page, not here — this page only creates new ads.

   - Deleting an ad is non-refundable regardless of remaining days
     or views — enforce that server-side too (an admin action or a
     user-triggered delete should never trigger a wallet credit).

   - Guaranteed-view delivery (weighted rotation so under-delivered
     ads get shown more often) is a display/rotation algorithm for
     wherever ads are rendered (home, task feed, Advertisements
     page) — not something this posting page needs to implement.

   - Banner packages (type: "banner") never write a description —
     it's forced to null — and store their creative under
     bannerMediaUrl/bannerMediaType ("image" | "video") instead of
     imageUrl, which stays null for banners. Regular packages are
     untouched: they still use description + imageUrl exactly as
     before.

   - BANNER_MEDIA_SPECS (maxWidth/maxHeight/minAspectRatio) is a
     placeholder for the banner slot's real pixel footprint. Once
     the actual Top/Bottom/Floating banner box is built out with a
     real size, update just those three numbers — the checklist,
     labels, and validation all read from that one object.
   =========================================================== */
