/* =========================================================
   TASKNOVA — EARN PAGE LOGIC
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
   CATEGORY LABELS + ICONS (must match Post Task's TASK_CATALOG
   keys so category filter chips line up with what employers pick)
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

/* ---------------------------------------------------------
   CIRCULAR RING (used/total, per-instance unique gradient id
   so multiple rings on screen at once don't clash)
   --------------------------------------------------------- */
let ringIdCounter = 0;

function ringSVG(filled, total, size, stroke) {
  const gradId = "ring-grad-" + (ringIdCounter++);
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
let userLocation = null;
let activeLocation = "All";
let activeCategory = "all";

let taskDocsMap = new Map();   // taskId -> task data (live, across all loaded pages)
let pageListeners = [];        // active onSnapshot unsubscribe functions
let lastVisibleDoc = null;
let hasMore = true;
let isLoading = false;

let openTaskId = null;         // currently expanded task
let justSubmittedTaskId = null; // suppress the "filled" toast for your own submission

/* ---------------------------------------------------------
   DOM REFS
   --------------------------------------------------------- */
const taskList = document.getElementById("taskList");
const loadMoreWrap = document.getElementById("loadMoreWrap");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const locationFilterScroll = document.getElementById("locationFilterScroll");
const categoryFilterScroll = document.getElementById("categoryFilterScroll");
const slotToast = document.getElementById("slotToast");
const slotToastText = document.getElementById("slotToastText");

Object.entries(CATEGORY_META).forEach(([key, meta]) => {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "filter-chip";
  chip.dataset.category = key;
  chip.innerHTML = `<i class="bx ${meta.icon}"></i> ${meta.label}`;
  categoryFilterScroll.appendChild(chip);
});

function showToast(text) {
  slotToastText.textContent = text;
  slotToast.classList.add("show");
  setTimeout(() => slotToast.classList.remove("show"), 3200);
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

function render() {
  const tasks = sortedTasks();

  if (!tasks.length) {
    taskList.innerHTML = `<div class="task-empty"><i class="bx bx-search-alt"></i>No tasks match right now — try a different filter, or check back soon.</div>`;
    loadMoreWrap.style.display = "none";
    return;
  }

  taskList.innerHTML = tasks.map(renderTaskItem).join("");

  taskList.querySelectorAll(".task-row").forEach((row) => {
    row.addEventListener("click", () => toggleTask(row.closest(".task-item").dataset.id));
  });

  loadMoreWrap.style.display = hasMore ? "flex" : "none";
}

// Updates just one task's ring/price/slots-left in place, without touching
// any other task's DOM — critical for not wiping out an in-progress proof
// form (uploaded screenshots, typed text) elsewhere on the page whenever
// live data changes for a task that isn't the one currently expanded.
function updateRowInPlace(taskId) {
  const task = taskDocsMap.get(taskId);
  const item = taskList.querySelector(`.task-item[data-id="${taskId}"]`);
  if (!task || !item) return;

  const filled = task.slotsFilled ?? 0;
  const total = task.workersRequired ?? 0;

  const ringWrap = item.querySelector(".tr-ring-wrap");
  if (ringWrap) ringWrap.innerHTML = ringSVG(filled, total, 44, 5);

  const priceEl = item.querySelector(".tr-price");
  if (priceEl) priceEl.textContent = formatNaira(task.amountPerWorker);

  // If this task is currently expanded and still showing the live
  // submission form (not "already submitted" / "full"), refresh just
  // the slots-left line and the submit button's disabled state.
  if (taskId === openTaskId) {
    const slotsLeft = Math.max(0, total - filled);
    const slotsLine = document.getElementById(`slotsLeftLine-${taskId}`);
    const submitBtn = document.getElementById(`submitProofBtn-${taskId}`);

    if (slotsLine) {
      slotsLine.className = "slots-left-line" + (slotsLeft <= 0 ? " full" : "");
      slotsLine.innerHTML = `<i class="bx bx-group"></i><span>${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} left</span>`;
    }
    if (submitBtn) submitBtn.disabled = slotsLeft <= 0;
  }
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
          <div class="tr-title">${task.title}</div>
          <div class="tr-price">${formatNaira(task.amountPerWorker)}</div>
        </div>
        <div class="tr-ring-wrap">${ringSVG(filled, total, 44, 5)}</div>
        <i class="bx bx-chevron-down tr-chevron"></i>
      </div>
      <div class="task-detail">
        <div>
          <div class="task-detail-inner" id="detail-${task.id}">
            <!-- filled in lazily on first expand -->
          </div>
        </div>
      </div>
    </div>`;
}

/* ---------------------------------------------------------
   EXPAND / COLLAPSE
   --------------------------------------------------------- */
async function toggleTask(taskId) {
  const wasOpen = openTaskId === taskId;
  openTaskId = wasOpen ? null : taskId;

  taskList.querySelectorAll(".task-item").forEach((item) => {
    item.classList.toggle("open", item.dataset.id === openTaskId);
  });

  if (!wasOpen && openTaskId) {
    await renderTaskDetail(openTaskId);
  }
}

async function renderTaskDetail(taskId) {
  const task = taskDocsMap.get(taskId);
  const container = document.getElementById(`detail-${taskId}`);
  if (!task || !container) return;

  const filled = task.slotsFilled ?? 0;
  const total = task.workersRequired ?? 0;
  const slotsLeft = Math.max(0, total - filled);
  const isFull = task.full || slotsLeft <= 0;

  container.innerHTML = `
    <div class="td-section">
      <h3>Description</h3>
      <p>${task.description || "—"}</p>
    </div>

    ${task.instructions ? `
      <div class="td-section">
        <h3>Instructions</h3>
        <p>${task.instructions}</p>
      </div>` : ""}

    ${task.urgent || task.location ? `
      <div class="td-tags-row">
        ${task.urgent ? `<span class="td-tag"><i class="bx bx-bolt"></i> Urgent</span>` : ""}
        ${task.location ? `<span class="td-tag"><i class="bx bx-map-pin"></i> ${task.location}</span>` : ""}
      </div>` : ""}

    <button type="button" class="do-task-btn" id="doTaskBtn-${taskId}">
      <i class="bx bx-link-external"></i> Do Task
    </button>

    <div id="proofArea-${taskId}">
      <div class="proof-submit-msg"><i class="bx bx-loader-alt bx-spin"></i><span>Checking status…</span></div>
    </div>
  `;

  document.getElementById(`doTaskBtn-${taskId}`).addEventListener("click", () => {
    if (task.taskLink) window.open(task.taskLink, "_blank", "noopener");
  });

  await loadProofArea(taskId, isFull, slotsLeft);
}

/* ---------------------------------------------------------
   PROOF SUBMISSION AREA
   --------------------------------------------------------- */
async function loadProofArea(taskId, isFull, slotsLeft) {
  const task = taskDocsMap.get(taskId);
  const proofArea = document.getElementById(`proofArea-${taskId}`);
  if (!task || !proofArea) return;

  if (isFull) {
    proofArea.innerHTML = `<div class="task-full-note"><i class="bx bx-x-circle"></i><span>This task is currently full.</span></div>`;
    return;
  }

  // Check if this worker already submitted — one submission per task per worker.
  let alreadySubmitted = false;
  try {
    const subSnap = await getDoc(doc(db, "tasks", taskId, "submissions", currentUser.uid));
    alreadySubmitted = subSnap.exists();
  } catch (err) {
    console.error("Submission check error:", err);
  }

  if (alreadySubmitted) {
    proofArea.innerHTML = `<div class="already-submitted-note"><i class="bx bx-check-circle"></i><span>You've already submitted this task — pending review.</span></div>`;
    return;
  }

  const screenshotCount = task.screenshotRequired ? (task.screenshotCount || 1) : 0;
  const proofItems = task.proofRequirements || [];
  const textProofItems = proofItems.filter((p) => !p.toLowerCase().includes("screenshot"));
  const textProofRequired = textProofItems.length > 0;

  proofArea.innerHTML = `
    <div class="proof-section">
      <div class="proof-section-label">Submit your proof</div>

      ${proofItems.length ? `
        <ul class="proof-reminder-list">
          ${proofItems.map((p) => `<li><i class="bx bx-check-circle"></i><span>${p}</span></li>`).join("")}
        </ul>` : ""}

      ${screenshotCount > 0 ? `
        <div class="screenshot-slots" id="screenshotSlots-${taskId}">
          ${Array.from({ length: screenshotCount }).map((_, i) => `
            <div class="screenshot-slot" data-index="${i}">
              <input type="file" accept="image/*" hidden>
              <div class="ss-empty"><i class="bx bx-image-add"></i><span>Screenshot ${i + 1}</span></div>
            </div>
          `).join("")}
        </div>` : ""}

      ${textProofItems.length || !screenshotCount ? `
        <div class="proof-text-field w-field">
          <label for="textProof-${taskId}">${textProofItems.length ? "Text proof / links" : "Additional notes (optional)"}</label>
          <textarea id="textProof-${taskId}" rows="4" placeholder="${textProofItems.length ? textProofItems.join(" · ") : "Anything else to add…"}"></textarea>
        </div>` : ""}

      <div class="slots-left-line" id="slotsLeftLine-${taskId}">
        <i class="bx bx-group"></i><span>${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} left</span>
      </div>

      <div class="proof-submit-msg" id="proofMsg-${taskId}"></div>

      <button type="button" class="submit-proof-btn" id="submitProofBtn-${taskId}" ${slotsLeft <= 0 ? "disabled" : ""}>
        <span class="submit-proof-spinner"></span>
        <span>Submit Proof</span>
      </button>
    </div>
  `;

  wireProofForm(taskId, screenshotCount, textProofRequired);
}

/* ---------------------------------------------------------
   SCREENSHOT UPLOAD SLOTS
   --------------------------------------------------------- */
const screenshotUrls = new Map(); // taskId -> array of uploaded URLs (sparse)

function wireProofForm(taskId, screenshotCount, textProofRequired) {
  screenshotUrls.set(taskId, new Array(screenshotCount).fill(null));

  const slotsWrap = document.getElementById(`screenshotSlots-${taskId}`);
  slotsWrap?.querySelectorAll(".screenshot-slot").forEach((slot) => {
    const index = Number(slot.dataset.index);
    const input = slot.querySelector("input[type=file]");

    slot.addEventListener("click", (e) => {
      if (e.target.closest(".ss-remove")) return;
      input.click();
    });

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      uploadScreenshot(taskId, index, file, slot);
    });
  });

  const submitBtn = document.getElementById(`submitProofBtn-${taskId}`);
  submitBtn?.addEventListener("click", () => submitProof(taskId, screenshotCount, textProofRequired));
}

function uploadScreenshot(taskId, index, file, slotEl) {
  if (!file.type.startsWith("image/")) return;
  if (file.size > 5 * 1024 * 1024) {
    const msg = document.getElementById(`proofMsg-${taskId}`);
    if (msg) { msg.className = "proof-submit-msg show error"; msg.innerHTML = `<i class="bx bx-error-circle"></i><span>Image should be under 5MB.</span>`; }
    return;
  }

  slotEl.innerHTML = `
    <img src="${URL.createObjectURL(file)}" alt="">
    <div class="ss-uploading">Uploading…</div>
  `;

  const path = `task-submissions/${taskId}/${currentUser.uid}/${index}-${Date.now()}-${file.name}`;
  const fileRef = storageRef(storage, path);
  const uploadTask = uploadBytesResumable(fileRef, file);

  uploadTask.on("state_changed",
    () => {},
    (err) => {
      console.error("Screenshot upload error:", err);
      slotEl.innerHTML = `<div class="ss-empty"><i class="bx bx-error-circle"></i><span>Failed — tap to retry</span></div><input type="file" accept="image/*" hidden>`;
      wireOneSlot(taskId, index, slotEl);
    },
    async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref);
      const arr = screenshotUrls.get(taskId) || [];
      arr[index] = url;
      screenshotUrls.set(taskId, arr);

      slotEl.innerHTML = `
        <img src="${url}" alt="">
        <button type="button" class="ss-remove" aria-label="Remove"><i class="bx bx-x"></i></button>
      `;
      slotEl.querySelector(".ss-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        arr[index] = null;
        screenshotUrls.set(taskId, arr);
        slotEl.innerHTML = `<input type="file" accept="image/*" hidden><div class="ss-empty"><i class="bx bx-image-add"></i><span>Screenshot ${index + 1}</span></div>`;
        wireOneSlot(taskId, index, slotEl);
      });
    }
  );
}

function wireOneSlot(taskId, index, slotEl) {
  const input = slotEl.querySelector("input[type=file]");
  slotEl.addEventListener("click", (e) => {
    if (e.target.closest(".ss-remove")) return;
    input.click();
  });
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (file) uploadScreenshot(taskId, index, file, slotEl);
  });
}

/* ---------------------------------------------------------
   SUBMIT PROOF — transaction reserves the slot at submission
   time (not on approval), matching "task disappears once full,
   reappears if declined" behavior.
   --------------------------------------------------------- */
async function submitProof(taskId, screenshotCount, textProofRequired) {
  const task = taskDocsMap.get(taskId);
  if (!task || !currentUser) return;

  const msg = document.getElementById(`proofMsg-${taskId}`);
  const btn = document.getElementById(`submitProofBtn-${taskId}`);
  const textInput = document.getElementById(`textProof-${taskId}`);
  const urls = screenshotUrls.get(taskId) || [];

  function showErr(text) {
    msg.className = "proof-submit-msg show error";
    msg.innerHTML = `<i class="bx bx-error-circle"></i><span>${text}</span>`;
  }

  if (screenshotCount > 0 && urls.filter(Boolean).length < screenshotCount) {
    showErr(`Please upload all ${screenshotCount} screenshot${screenshotCount > 1 ? "s" : ""}.`);
    return;
  }
  if (textProofRequired && !textInput?.value.trim()) {
    showErr("Please fill in the required text proof.");
    return;
  }

  btn.classList.add("loading");
  btn.disabled = true;

  try {
    const taskRef = doc(db, "tasks", taskId);
    const subRef = doc(db, "tasks", taskId, "submissions", currentUser.uid);

    await runTransaction(db, async (transaction) => {
      const taskSnap = await transaction.get(taskRef);
      if (!taskSnap.exists()) throw new Error("This task no longer exists.");

      const data = taskSnap.data();
      const filled = data.slotsFilled ?? 0;
      const total = data.workersRequired ?? 0;
      if (filled >= total) throw new Error("This task just filled up — sorry!");

      const subSnap = await transaction.get(subRef);
      if (subSnap.exists()) throw new Error("You've already submitted this task.");

      const newFilled = filled + 1;
      transaction.update(taskRef, {
        slotsFilled: newFilled,
        full: newFilled >= total
      });

      transaction.set(subRef, {
        workerUid: currentUser.uid,
        taskId,
        taskTitle: data.title || "",
        category: data.category || "",
        amountPerWorker: data.amountPerWorker || 0,
        employerUid: data.employerUid || null,
        screenshotUrls: urls.filter(Boolean),
        textProof: textInput?.value.trim() || "",
        status: "pending",
        reported: false,
        submittedAt: serverTimestamp()
      });
    });

    justSubmittedTaskId = taskId;
    msg.className = "proof-submit-msg show";
    document.getElementById(`proofArea-${taskId}`).innerHTML =
      `<div class="already-submitted-note"><i class="bx bx-check-circle"></i><span>Proof submitted — pending review.</span></div>`;
  } catch (err) {
    console.error("Submit proof error:", err);
    showErr(err.message || "Something went wrong. Please try again.");
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

/* ---------------------------------------------------------
   LIVE PAGINATED FEED (real-time — tasks disappear the instant
   they're full, reappear automatically if a decline frees a slot)
   --------------------------------------------------------- */
function subscribeNextPage() {
  if (!currentUser || !hasMore || isLoading) return;
  isLoading = true;
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.disabled = true;

  const constraints = [
    where("status", "==", "active"),
    where("hidden", "==", false),
    where("full", "==", false)
  ];
  if (activeCategory !== "all") constraints.push(where("category", "==", activeCategory));
  if (activeLocation !== "All") constraints.push(where("location", "==", activeLocation));

  constraints.push(orderBy("createdAt", "desc"));
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

      render();
      return;
    }

    let structuralChange = false;
    const modifiedIds = [];

    snap.docChanges().forEach((change) => {
      const data = change.doc.data();
      if (data.employerUid === currentUser.uid) return; // never show your own tasks

      if (change.type === "removed") {
        if (taskDocsMap.has(change.doc.id)) {
          taskDocsMap.delete(change.doc.id);
          structuralChange = true;

          if (openTaskId === change.doc.id) {
            openTaskId = null;
            if (justSubmittedTaskId === change.doc.id) {
              justSubmittedTaskId = null; // your own submission filled it — no "sorry" toast needed
            } else {
              showToast("This task's slots just got filled.");
            }
          }
        }
      } else if (change.type === "added") {
        taskDocsMap.set(change.doc.id, { id: change.doc.id, ...data });
        structuralChange = true;
      } else {
        // "modified" — data-only change (e.g. someone else's submission
        // updated slotsFilled). Update in place so an open proof form
        // elsewhere on the page isn't wiped out by a full re-render.
        taskDocsMap.set(change.doc.id, { id: change.doc.id, ...data });
        modifiedIds.push(change.doc.id);
      }
    });

    if (structuralChange) {
      render();
    } else {
      modifiedIds.forEach(updateRowInPlace);
    }
  }, (err) => {
    console.error("Earn feed listener error:", err);
    isLoading = false;
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  });

  pageListeners.push(unsub);
}

function resetFeed() {
  pageListeners.forEach((unsub) => unsub());
  pageListeners = [];
  taskDocsMap = new Map();
  lastVisibleDoc = null;
  hasMore = true;
  openTaskId = null;
  taskList.innerHTML = `<div class="task-skeleton"></div><div class="task-skeleton"></div><div class="task-skeleton"></div><div class="task-skeleton"></div>`;
  subscribeNextPage();
}

loadMoreBtn.addEventListener("click", subscribeNextPage);

/* ---------------------------------------------------------
   FILTERS
   --------------------------------------------------------- */
categoryFilterScroll.addEventListener("click", (e) => {
  const chip = e.target.closest(".filter-chip");
  if (!chip || chip.dataset.category === activeCategory) return;
  categoryFilterScroll.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  activeCategory = chip.dataset.category;
  resetFeed();
});

locationFilterScroll.addEventListener("click", (e) => {
  const chip = e.target.closest(".filter-chip");
  if (!chip || chip.dataset.location === activeLocation) return;
  locationFilterScroll.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  activeLocation = chip.dataset.location;
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

    // "All + user's location" — add their own location as a quick filter chip
    if (data.institutionAbbr && userLocation !== data.institutionAbbr) {
      userLocation = data.institutionAbbr;
      if (!locationFilterScroll.querySelector(`[data-location="${userLocation}"]`)) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "filter-chip";
        chip.dataset.location = userLocation;
        chip.innerHTML = `<i class="bx bx-map-pin"></i> ${userLocation}`;
        locationFilterScroll.appendChild(chip);
      }
    }
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
   - The whole feed is real-time (onSnapshot per page, not a
     one-time fetch). Each task doc carries a "full" boolean the
     query filters on (where full == false) — the instant a task
     fills, Firestore's own live-query mechanics drop it from every
     open Earn page automatically. If an employer later declines a
     submission and frees a slot (slotsFilled--, full → false), the
     task reappears the same way, with no extra code needed here.

   - A submission reserves a slot immediately (slotsFilled++ in the
     same transaction that writes the submission doc) rather than
     waiting for approval — that's what makes "task disappears the
     moment slots run out" possible. Employer approval/decline is a
     separate, not-yet-built flow (Track Posted Tasks) that must:
       - Decline: slotsFilled--, full = false, delete/mark the
         submission declined so the worker could theoretically be
         allowed to resubmit if that's ever wanted.
       - Approve: leave slotsFilled as-is, mark submission approved,
         release the worker's payout from the employer's already-
         reserved funds.

   - One submission per worker per task is enforced by using the
     worker's uid as the submission doc ID (tasks/{id}/submissions/
     {uid}) — a second submission attempt is blocked both by the
     pre-check (getDoc) and, more importantly, inside the same
     transaction (transaction.get on the sub ref) so a race between
     two rapid clicks can't double-submit.

   - Filtering by category/location/full/status/hidden together
     needs a composite index — Firestore's console error the first
     time each filter combination runs includes a direct link to
     create it. Normal, one-time, not a bug.

   - Submission docs now carry taskId/taskTitle/category/
     amountPerWorker/employerUid alongside the proof itself — that
     denormalization is for Track Work Done, so it can render a
     worker's own submissions across every task via a single
     collectionGroup query without a lookup per card.
   =========================================================== */
