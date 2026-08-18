/* =========================================================
   TASKNOVA — POST TASK PAGE LOGIC
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
  addDoc,
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
const SKRED_ADVERTISE_LINK = "../user/post-advertisement.html";

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
   TASK CATALOG — curated set, no fake-engagement tasks, no
   duplicates. Worker/platform split stays internal for backend
   bookkeeping; the UI only ever shows the combined total.

   Long-term this should move to an Admin-configurable Firestore
   collection so prices can be tuned without a code change.
   --------------------------------------------------------- */
const PROOF_SETS = {
  follow: ["Screenshot showing you followed/joined", "Your username or handle used"],
  share: ["Screenshot of your share/post", "Link to the post (if public)"],
  visit: ["Screenshot showing the page you visited"],
  feedback: ["Written feedback (at least 30 words)"],
  test: ["Screenshot(s) taken while testing", "Written notes on what you found"],
  bug: ["Screenshot or screen recording of the issue", "Description of the issue and steps to reproduce it"],
  confirm: ["Screenshot or confirmation code showing completion"],
  data: ["Link or file with the completed work", "Short summary of what was done"],
  watch: ["Screenshot showing you watched/listened (e.g. watch history, timestamp)"]
};

// Simple, literal, do-exactly-this-and-submit-proof instructions —
// matches the task title, nothing extra.
const SIMPLE_STEPS = {
  follow: (title) => `Tap the task button, then ${title.replace(/^Follow\/?/i, "follow").replace(/^Join/i, "join")}. Submit your proof once done.`,
  share: (title) => `Tap the task button, then ${title.toLowerCase()}. Submit your proof once done.`,
  visit: (title) => `Tap the task button and visit the page. Submit your proof once done.`,
  feedback: (title) => `Tap the task button, review it, then write your genuine feedback and submit it.`,
  test: (title) => `Tap the task button and try it out as instructed. Submit your proof once done.`,
  bug: () => `Tap the task button, look for issues, and report anything you find with a screenshot/recording and clear steps.`,
  confirm: (title) => `Tap the task button and ${title.toLowerCase()}. Submit your proof once done.`,
  data: (title) => `Tap the task button and complete the work described. Submit your proof once done.`,
  watch: (title) => `Tap the task button and watch/listen as instructed. Submit your proof once done.`
};

const TASK_CATALOG = {
  whatsapp: { label: "WhatsApp", items: [
    { title: "Post provided advert to WhatsApp Status", worker: 50, platform: 20, proof: "share" },
    { title: "Share provided advert to up to 3 relevant groups", worker: 60, platform: 20, proof: "share" },
    { title: "Join WhatsApp group", worker: 40, platform: 20, proof: "follow" },
    { title: "Follow/subscribe to WhatsApp Channel", worker: 40, platform: 20, proof: "follow" },
    { title: "Turn on channel notifications", worker: 30, platform: 10, proof: "confirm" },
    { title: "Save a business contact", worker: 40, platform: 20, proof: "confirm" },
    { title: "Send a specified message to a business", worker: 40, platform: 20, proof: "confirm" },
    { title: "Participate in an approved discussion", worker: 50, platform: 20, proof: "feedback" },
    { title: "Submit feedback about a WhatsApp community", worker: 50, platform: 20, proof: "feedback" }
  ]},
  telegram: { label: "Telegram", items: [
    { title: "Join Telegram Channel", worker: 40, platform: 20, proof: "follow" },
    { title: "Join Telegram Group", worker: 40, platform: 20, proof: "follow" },
    { title: "Start a Telegram Bot", worker: 30, platform: 20, proof: "confirm" },
    { title: "Complete an action through a Telegram Bot", worker: 50, platform: 20, proof: "confirm" },
    { title: "Submit information through a bot", worker: 50, platform: 20, proof: "confirm" },
    { title: "Read provided announcement and confirm", worker: 30, platform: 10, proof: "confirm" },
    { title: "Participate in an approved community activity", worker: 50, platform: 20, proof: "feedback" },
    { title: "Submit community feedback", worker: 50, platform: 20, proof: "feedback" }
  ]},
  facebook: { label: "Facebook", items: [
    { title: "Join Facebook Group", worker: 40, platform: 20, proof: "follow" },
    { title: "Follow Facebook Page", worker: 40, platform: 20, proof: "follow" },
    { title: "Visit Facebook Page", worker: 25, platform: 10, proof: "visit" },
    { title: "Share advertiser's content to own audience", worker: 50, platform: 20, proof: "share" },
    { title: "Share provided information to approved community", worker: 60, platform: 20, proof: "share" },
    { title: "Participate in an approved discussion", worker: 50, platform: 20, proof: "feedback" },
    { title: "Provide feedback about a Facebook campaign", worker: 50, platform: 20, proof: "feedback" }
  ]},
  instagram: { label: "Instagram", items: [
    { title: "Follow Instagram account", worker: 40, platform: 20, proof: "follow" },
    { title: "Visit Instagram profile", worker: 25, platform: 10, proof: "visit" },
    { title: "Share advertiser's post to Story", worker: 50, platform: 20, proof: "share" },
    { title: "Share promotional material through permitted channel", worker: 50, platform: 20, proof: "share" },
    { title: "Test Instagram promotional content", worker: 50, platform: 20, proof: "test" },
    { title: "Give campaign feedback", worker: 50, platform: 20, proof: "feedback" }
  ]},
  tiktok: { label: "TikTok", items: [
    { title: "Follow TikTok account", worker: 40, platform: 20, proof: "follow" },
    { title: "Like TikTok promotional content", worker: 25, platform: 10, proof: "visit" },
    { title: "Watch provided promotional content", worker: 30, platform: 10, proof: "watch" },
    { title: "Share promotional content through permitted channel", worker: 50, platform: 20, proof: "share" },
    { title: "Test promotional content", worker: 50, platform: 20, proof: "test" },
    { title: "Give genuine content feedback", worker: 50, platform: 20, proof: "feedback" }
  ]},
  x: { label: "X / Twitter", items: [
    { title: "Follow X account", worker: 40, platform: 20, proof: "follow" },
    { title: "Visit profile", worker: 25, platform: 10, proof: "visit" },
    { title: "Share/repost promotional content", worker: 50, platform: 20, proof: "share" },
    { title: "Participate in approved discussion", worker: 50, platform: 20, proof: "feedback" },
    { title: "Provide genuine content feedback", worker: 50, platform: 20, proof: "feedback" },
    { title: "Test a promotional post", worker: 50, platform: 20, proof: "test" }
  ]},
  youtube: { label: "YouTube", items: [
    { title: "Subscribe to YouTube channel", worker: 60, platform: 20, proof: "follow" },
    { title: "Watch specified video", worker: 40, platform: 20, proof: "watch" },
    { title: "Share video through permitted channel", worker: 50, platform: 20, proof: "share" },
    { title: "Test video/content", worker: 50, platform: 20, proof: "test" },
    { title: "Provide genuine video feedback", worker: 50, platform: 20, proof: "feedback" }
  ]},
  linkedin: { label: "LinkedIn", items: [
    { title: "Follow company page", worker: 50, platform: 20, proof: "follow" },
    { title: "Visit company profile", worker: 30, platform: 10, proof: "visit" },
    { title: "Share professional announcement", worker: 60, platform: 20, proof: "share" },
    { title: "Participate in approved discussion", worker: 60, platform: 20, proof: "feedback" },
    { title: "Review campaign material and give feedback", worker: 70, platform: 20, proof: "feedback" }
  ]},
  snapchat: { label: "Snapchat", items: [
    { title: "Add/follow account", worker: 40, platform: 20, proof: "follow" },
    { title: "View promotional content", worker: 30, platform: 10, proof: "watch" },
    { title: "Share promotional material", worker: 50, platform: 20, proof: "share" },
    { title: "Give genuine content feedback", worker: 50, platform: 20, proof: "feedback" }
  ]},
  discord: { label: "Discord", items: [
    { title: "Join Discord server", worker: 50, platform: 20, proof: "follow" },
    { title: "Complete server onboarding", worker: 50, platform: 20, proof: "confirm" },
    { title: "Read rules and confirm", worker: 30, platform: 10, proof: "confirm" },
    { title: "Participate in approved community activity", worker: 60, platform: 20, proof: "feedback" },
    { title: "Give server feedback", worker: 60, platform: 20, proof: "feedback" }
  ]},
  music: { label: "Spotify / Audiomack", items: [
    { title: "Follow artist/profile", worker: 40, platform: 20, proof: "follow" },
    { title: "Listen to specified content", worker: 30, platform: 10, proof: "watch" },
    { title: "Test a release and give feedback", worker: 50, platform: 20, proof: "feedback" },
    { title: "Submit music feedback", worker: 60, platform: 20, proof: "feedback" }
  ]},
  app_testing: { label: "App Testing", items: [
    { title: "Download and open app", worker: 70, platform: 20, proof: "confirm" },
    { title: "Test specified feature", worker: 100, platform: 30, proof: "test" },
    { title: "Complete onboarding test", worker: 80, platform: 20, proof: "test" },
    { title: "Test app navigation", worker: 80, platform: 20, proof: "test" },
    { title: "Find a specified feature", worker: 70, platform: 20, proof: "test" },
    { title: "Report a bug", worker: 150, platform: 30, proof: "bug" },
    { title: "Test app on specified device", worker: 100, platform: 30, proof: "test" },
    { title: "Give usability feedback", worker: 100, platform: 30, proof: "feedback" },
    { title: "Compare two app screens", worker: 70, platform: 20, proof: "test" }
  ]},
  website_testing: { label: "Website Testing", items: [
    { title: "Visit website", worker: 25, platform: 10, proof: "visit" },
    { title: "Find specified information", worker: 40, platform: 20, proof: "test" },
    { title: "Test signup process", worker: 60, platform: 20, proof: "test" },
    { title: "Test login process", worker: 50, platform: 20, proof: "test" },
    { title: "Test checkout flow", worker: 80, platform: 20, proof: "test" },
    { title: "Test contact form", worker: 50, platform: 20, proof: "test" },
    { title: "Find/report broken link", worker: 70, platform: 20, proof: "bug" },
    { title: "Website usability test", worker: 100, platform: 30, proof: "feedback" },
    { title: "Website feedback", worker: 70, platform: 20, proof: "feedback" }
  ]},
  surveys: { label: "Surveys & Forms", items: [
    { title: "Short survey", worker: 40, platform: 20, proof: "confirm" },
    { title: "Medium survey", worker: 80, platform: 20, proof: "confirm" },
    { title: "Long survey", worker: 150, platform: 30, proof: "confirm" },
    { title: "Google Form", worker: 40, platform: 20, proof: "confirm" },
    { title: "Detailed questionnaire", worker: 100, platform: 30, proof: "confirm" },
    { title: "Product feedback form", worker: 80, platform: 20, proof: "confirm" },
    { title: "Market research questionnaire", worker: 120, platform: 30, proof: "confirm" }
  ]},
  ai_tasks: { label: "AI Tasks", items: [
    { title: "Rate AI response", worker: 50, platform: 20, proof: "data" },
    { title: "Compare two AI responses", worker: 70, platform: 20, proof: "data" },
    { title: "Test AI prompt", worker: 70, platform: 20, proof: "data" },
    { title: "Provide prompt feedback", worker: 80, platform: 20, proof: "feedback" },
    { title: "Categorize AI output", worker: 70, platform: 20, proof: "data" },
    { title: "Image labeling", worker: 80, platform: 20, proof: "data" },
    { title: "Text classification", worker: 70, platform: 20, proof: "data" },
    { title: "Transcription checking", worker: 100, platform: 30, proof: "data" },
    { title: "AI answer quality assessment", worker: 100, platform: 30, proof: "data" }
  ]},
  research: { label: "Data & Research", items: [
    { title: "Find specified information", worker: 50, platform: 20, proof: "data" },
    { title: "Collect publicly available information", worker: 80, platform: 20, proof: "data" },
    { title: "Compare products", worker: 80, platform: 20, proof: "data" },
    { title: "Research a business", worker: 100, platform: 30, proof: "data" },
    { title: "Verify publicly available information", worker: 80, platform: 20, proof: "data" },
    { title: "Categorize information", worker: 70, platform: 20, proof: "data" },
    { title: "Data entry", worker: 80, platform: 20, proof: "data" },
    { title: "Spreadsheet task", worker: 100, platform: 30, proof: "data" }
  ]},
  documents: { label: "File & Document Tasks", items: [
    { title: "Copy information into spreadsheet", worker: 80, platform: 20, proof: "data" },
    { title: "Organize spreadsheet", worker: 100, platform: 30, proof: "data" },
    { title: "Categorize files", worker: 70, platform: 20, proof: "data" },
    { title: "Check document information", worker: 70, platform: 20, proof: "data" },
    { title: "Convert/format information", worker: 100, platform: 30, proof: "data" },
    { title: "Proofread short text", worker: 80, platform: 20, proof: "data" },
    { title: "Transcribe short audio", worker: 100, platform: 30, proof: "data" }
  ]},
  promotional: { label: "Promotional Tasks", items: [
    { title: "View promotional material", worker: 25, platform: 10, proof: "watch" },
    { title: "Visit business website", worker: 30, platform: 10, proof: "visit" },
    { title: "View product catalogue", worker: 30, platform: 10, proof: "watch" },
    { title: "Visit business social profile", worker: 30, platform: 10, proof: "visit" },
    { title: "Read promotional information", worker: 30, platform: 10, proof: "confirm" },
    { title: "Give genuine feedback about advertisement", worker: 50, platform: 20, proof: "feedback" }
  ]},
  product_feedback: { label: "Product & Service Feedback", items: [
    { title: "Product feedback", worker: 70, platform: 20, proof: "feedback" },
    { title: "Packaging feedback", worker: 70, platform: 20, proof: "feedback" },
    { title: "Website/product-page feedback", worker: 70, platform: 20, proof: "feedback" },
    { title: "User experience survey", worker: 100, platform: 30, proof: "feedback" },
    { title: "Product comparison", worker: 100, platform: 30, proof: "feedback" }
  ]},
  education: { label: "Educational / Student Tasks", items: [
    { title: "Fill academic questionnaire", worker: 50, platform: 20, proof: "confirm" },
    { title: "Participate in student research", worker: 80, platform: 20, proof: "feedback" },
    { title: "Course feedback", worker: 50, platform: 20, proof: "feedback" },
    { title: "Test educational website", worker: 80, platform: 20, proof: "test" },
    { title: "Test educational app", worker: 100, platform: 30, proof: "test" },
    { title: "Review usability of learning material", worker: 80, platform: 20, proof: "feedback" },
    { title: "Data collection for research", worker: 100, platform: 30, proof: "data" }
  ]}
};

const RETENTION_CLAUSE = "This task must remain completed for at least 7 days. If it's undone before then and reported, the worker responsible may forfeit payment for this task, receive a decline strike, and repeated violations can lead to earning restrictions or account suspension.";

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
   DOM REFS — category / task selection
   --------------------------------------------------------- */
const categorySelect = document.getElementById("taskCategory");
const subcategorySelect = document.getElementById("taskSubcategory");
const titleInput = document.getElementById("taskTitle");
const descriptionInput = document.getElementById("taskDescription");
const retentionClausePreview = document.getElementById("retentionClausePreview");
const taskLinkInput = document.getElementById("taskLink");
const instructionsInput = document.getElementById("taskInstructions");
const scopeTitleRef = document.getElementById("scopeTitleRef");
const proofListEl = document.getElementById("proofList");
const amountPerWorkerInput = document.getElementById("amountPerWorker");
const amountFloorNote = document.getElementById("amountFloorNote");
const workersRequiredInput = document.getElementById("workersRequired");
const taskLocationSelect = document.getElementById("taskLocation");

retentionClausePreview.textContent = RETENTION_CLAUSE;

Object.entries(TASK_CATALOG).forEach(([key, cat]) => {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = cat.label;
  categorySelect.appendChild(opt);
});

let selectedPreset = null; // { title, worker, platform, proof, floor }

categorySelect.addEventListener("change", () => {
  const cat = TASK_CATALOG[categorySelect.value];
  subcategorySelect.innerHTML = `<option value="" disabled selected>Choose a task</option>`;
  subcategorySelect.disabled = !cat;
  selectedPreset = null;
  if (!cat) return;

  cat.items.forEach((item, idx) => {
    const total = item.worker + item.platform;
    const opt = document.createElement("option");
    opt.value = idx;
    // Only the combined total is ever shown — no worker/platform split.
    opt.textContent = `${item.title} — ${formatNaira(total)}`;
    subcategorySelect.appendChild(opt);
  });
});

subcategorySelect.addEventListener("change", () => {
  const cat = TASK_CATALOG[categorySelect.value];
  const item = cat?.items[Number(subcategorySelect.value)];
  if (!item) return;

  const floor = item.worker + item.platform;
  selectedPreset = { ...item, floor };

  titleInput.value = item.title;
  descriptionInput.value = (SIMPLE_STEPS[item.proof] || SIMPLE_STEPS.confirm)(item.title);
  scopeTitleRef.textContent = item.title;

  amountPerWorkerInput.value = floor;
  amountPerWorkerInput.min = floor;
  amountFloorNote.textContent = `This already includes TaskNOVA's fee — it can't be set lower than ${formatNaira(floor)} for this task.`;

  renderProofList(item.proof);
  updateCostSummary();
});

/* ---------------------------------------------------------
   PROOF LIST + SCREENSHOT TOGGLE/STEPPER
   --------------------------------------------------------- */
function renderProofList(proofKey) {
  const items = PROOF_SETS[proofKey] || PROOF_SETS.confirm;
  proofListEl.innerHTML = items.map((text) =>
    `<li><i class="bx bx-check-circle"></i><span>${text}</span></li>`
  ).join("");
}
renderProofList("confirm");

const screenshotSwitch = document.getElementById("screenshotSwitch");
const screenshotStepperRow = document.getElementById("screenshotStepperRow");
const screenshotMinus = document.getElementById("screenshotMinus");
const screenshotPlus = document.getElementById("screenshotPlus");
const screenshotCountEl = document.getElementById("screenshotCount");

let screenshotCount = 1;
const SCREENSHOT_MAX = 3;
const SCREENSHOT_MIN = 1;

function updateScreenshotStepper() {
  screenshotCountEl.textContent = String(screenshotCount);
  screenshotMinus.disabled = screenshotCount <= SCREENSHOT_MIN;
  screenshotPlus.disabled = screenshotCount >= SCREENSHOT_MAX;
}
updateScreenshotStepper();

screenshotSwitch.addEventListener("click", () => {
  const next = screenshotSwitch.getAttribute("aria-checked") !== "true";
  screenshotSwitch.setAttribute("aria-checked", String(next));
  screenshotStepperRow.classList.toggle("disabled", !next);
});

screenshotMinus.addEventListener("click", () => {
  if (screenshotCount > SCREENSHOT_MIN) { screenshotCount--; updateScreenshotStepper(); }
});
screenshotPlus.addEventListener("click", () => {
  if (screenshotCount < SCREENSHOT_MAX) { screenshotCount++; updateScreenshotStepper(); }
});

/* ---------------------------------------------------------
   AMOUNT PER WORKER — floor enforced, never reduce-able below preset
   --------------------------------------------------------- */
amountPerWorkerInput.addEventListener("input", updateCostSummary);
amountPerWorkerInput.addEventListener("blur", () => {
  const floor = selectedPreset?.floor ?? 0;
  if (Number(amountPerWorkerInput.value) < floor) {
    amountPerWorkerInput.value = floor;
    updateCostSummary();
  }
});

/* ---------------------------------------------------------
   WORKERS REQUIRED — auto-corrects to minimum of 5
   --------------------------------------------------------- */
const WORKERS_MIN = 5;

function clampWorkers() {
  const val = Number(workersRequiredInput.value);
  if (!val || val < WORKERS_MIN) {
    workersRequiredInput.value = WORKERS_MIN;
  }
  updateCostSummary();
}
workersRequiredInput.addEventListener("input", updateCostSummary);
workersRequiredInput.addEventListener("blur", clampWorkers);

/* ---------------------------------------------------------
   URGENT TOGGLE + SLIDE-DOWN AMOUNT (base ₦200, editable up)
   --------------------------------------------------------- */
const urgentSwitch = document.getElementById("urgentSwitch");
const urgentAmountViewport = document.getElementById("urgentAmountViewport");
const urgentAmountInput = document.getElementById("urgentAmount");
const URGENT_BASE = 200;

urgentSwitch.addEventListener("click", () => {
  const next = urgentSwitch.getAttribute("aria-checked") !== "true";
  urgentSwitch.setAttribute("aria-checked", String(next));
  urgentAmountViewport.classList.toggle("open", next);
  if (!next) urgentAmountInput.value = URGENT_BASE;
  updateCostSummary();
});

urgentAmountInput.addEventListener("input", updateCostSummary);
urgentAmountInput.addEventListener("blur", () => {
  if (Number(urgentAmountInput.value) < URGENT_BASE) {
    urgentAmountInput.value = URGENT_BASE;
    updateCostSummary();
  }
});

/* ---------------------------------------------------------
   COST SUMMARY — the only maths shown to the employer:
   amount per worker × workers + urgent = total
   --------------------------------------------------------- */
const csPerWorker = document.getElementById("csPerWorker");
const csWorkers = document.getElementById("csWorkers");
const csSubtotal = document.getElementById("csSubtotal");
const csUrgentRow = document.getElementById("csUrgentRow");
const csUrgentFee = document.getElementById("csUrgentFee");
const csGrandTotal = document.getElementById("csGrandTotal");
const csBalance = document.getElementById("csBalance");
const balanceRow = document.querySelector(".balance-row");

function updateCostSummary() {
  const perWorker = Number(amountPerWorkerInput.value) || 0;
  const workers = Math.max(WORKERS_MIN, Number(workersRequiredInput.value) || WORKERS_MIN);
  const urgent = urgentSwitch.getAttribute("aria-checked") === "true";
  const urgentFee = urgent ? Math.max(URGENT_BASE, Number(urgentAmountInput.value) || URGENT_BASE) : 0;

  const subtotal = perWorker * workers;
  const grandTotal = subtotal + urgentFee;

  csPerWorker.textContent = perWorker.toLocaleString("en-NG");
  csWorkers.textContent = String(workers);
  csSubtotal.textContent = formatNaira(subtotal);
  csUrgentRow.style.display = urgent ? "flex" : "none";
  csUrgentFee.textContent = formatNaira(urgentFee);
  csGrandTotal.textContent = formatNaira(grandTotal);

  balanceRow.classList.toggle("insufficient", grandTotal > currentDepositBalance);

  return { perWorker, workers, urgentFee, grandTotal };
}

/* ---------------------------------------------------------
   VALIDATION + BUILD DOC DATA
   --------------------------------------------------------- */
function buildTaskData(status) {
  const { perWorker, workers, urgentFee, grandTotal } = updateCostSummary();
  const urgent = urgentSwitch.getAttribute("aria-checked") === "true";
  const screenshotRequired = screenshotSwitch.getAttribute("aria-checked") === "true";
  const proof = selectedPreset?.proof || "confirm";

  // If the employer raised the amount above the preset floor, the extra
  // goes entirely to the worker — TaskNOVA's platform fee for a given
  // preset never changes just because the price was raised.
  const platformFee = selectedPreset?.platform ?? Math.round(perWorker * 0.3);
  const workerPayout = Math.max(0, perWorker - platformFee);

  return {
    employerUid: currentUser.uid,
    category: categorySelect.value || null,
    categoryLabel: TASK_CATALOG[categorySelect.value]?.label || "",
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim()
      ? `${descriptionInput.value.trim()}\n\n${RETENTION_CLAUSE}`
      : "",
    taskLink: taskLinkInput.value.trim(),
    instructions: instructionsInput.value.trim(),
    proofRequirements: PROOF_SETS[proof] || PROOF_SETS.confirm,
    screenshotRequired,
    screenshotCount: screenshotRequired ? screenshotCount : 0,
    amountPerWorker: perWorker,
    workerPayout,
    platformFee,
    workersRequired: workers,
    location: taskLocationSelect.value,
    urgent,
    urgentFee,
    totalCost: grandTotal,
    status,
    hidden: false,
    createdAt: serverTimestamp()
  };
}

function validateForm() {
  if (!categorySelect.value || !subcategorySelect.value) return "Pick a task above first.";
  if (!titleInput.value.trim()) return "Task title is missing.";
  if (!descriptionInput.value.trim()) return "Add a short description.";
  if (!taskLinkInput.value.trim() || !/^https?:\/\//i.test(taskLinkInput.value.trim())) return "Add a valid task link starting with http:// or https://";
  if (!amountPerWorkerInput.value || Number(amountPerWorkerInput.value) < (selectedPreset?.floor || 0)) return "Amount per worker looks off — please recheck.";
  if (Number(workersRequiredInput.value) < WORKERS_MIN) return `Minimum ${WORKERS_MIN} workers required.`;
  return null;
}

/* ---------------------------------------------------------
   SUBMIT — reserve funds and create the task in one Firestore
   transaction (pure internal wallet movement, same lightweight
   approach as Wallet's Swap — no Cloud Function needed).
   --------------------------------------------------------- */
const postTaskForm = document.getElementById("postTaskForm");
const wizardSubmitBtn = document.getElementById("wizardSubmit");
const wizardMsg = document.getElementById("wizardMsg");
const saveDraftBtn = document.getElementById("saveDraftBtn");

let currentUser = null;
let currentDepositBalance = 0;

function showMsg(type, text) {
  wizardMsg.className = "panel-msg show " + type;
  const icon = type === "error" ? "bx-error-circle" : "bx-check-circle";
  wizardMsg.innerHTML = `<i class="bx ${icon}"></i><span>${text}</span>`;
}
function clearMsg() {
  wizardMsg.className = "panel-msg";
  wizardMsg.innerHTML = "";
}

postTaskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();

  const errorText = validateForm();
  if (errorText) { showMsg("error", errorText); return; }
  if (!currentUser) return;

  const { grandTotal } = updateCostSummary();

  if (grandTotal > currentDepositBalance) {
    wizardSubmitBtn.classList.add("shake");
    setTimeout(() => wizardSubmitBtn.classList.remove("shake"), 400);
    showMsg("error", `Your Deposit Balance (${formatNaira(currentDepositBalance)}) is lower than the total (${formatNaira(grandTotal)}). Please deposit more, or save this as a draft for now.`);
    return;
  }

  wizardSubmitBtn.classList.add("loading");
  wizardSubmitBtn.disabled = true;

  try {
    const userRef = doc(db, "users", currentUser.uid);
    const taskRef = doc(collection(db, "tasks"));
    const taskData = buildTaskData("pending_review");

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) throw new Error("Account not found.");

      const deposit = snap.data().wallet?.deposit ?? 0;
      if (taskData.totalCost > deposit) throw new Error("Your Deposit Balance is too low to post this task.");

      transaction.update(userRef, { "wallet.deposit": deposit - taskData.totalCost });
      transaction.set(taskRef, taskData);

      const txRef = doc(collection(db, "users", currentUser.uid, "transactions"));
      transaction.set(txRef, {
        type: "task_post",
        direction: "debit",
        title: `Posted task: ${taskData.title}`,
        amount: taskData.totalCost,
        status: "successful",
        createdAt: serverTimestamp()
      });
    });

    showMsg("success", "Task posted! It'll appear on the Earn feed once approved — usually within a few hours.");
    setTimeout(() => { window.location.href = "track-posted-tasks.html"; }, 1800);
  } catch (err) {
    console.error("Post task error:", err);
    showMsg("error", err.message || "Something went wrong posting your task. Please try again.");
  } finally {
    wizardSubmitBtn.classList.remove("loading");
    wizardSubmitBtn.disabled = false;
  }
});

/* ---------------------------------------------------------
   SAVE AS DRAFT — no wallet deduction, just stores the form so
   they can come back and finish once they've deposited enough.
   --------------------------------------------------------- */
saveDraftBtn.addEventListener("click", async () => {
  clearMsg();
  if (!currentUser) return;
  if (!categorySelect.value) { showMsg("error", "Pick a task type before saving a draft."); return; }

  saveDraftBtn.classList.add("loading");
  saveDraftBtn.disabled = true;

  try {
    const taskData = buildTaskData("draft");
    await addDoc(collection(db, "tasks"), taskData);
    showMsg("success", "Saved as a draft. Find it under Track Posted Tasks whenever you're ready to continue.");
  } catch (err) {
    console.error("Save draft error:", err);
    showMsg("error", "Couldn't save the draft. Please try again.");
  } finally {
    saveDraftBtn.classList.remove("loading");
    saveDraftBtn.disabled = false;
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
    csBalance.textContent = formatNaira(currentDepositBalance);
    updateCostSummary();

    if (data.institutionAbbr && !taskLocationSelect.querySelector(`option[value="${data.institutionAbbr}"]`)) {
      const opt = document.createElement("option");
      opt.value = data.institutionAbbr;
      opt.textContent = `${data.institutionAbbr} only`;
      taskLocationSelect.appendChild(opt);
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
});

/* ===========================================================
   NOTES
   ===========================================================
   - No Cloud Function is used to post a task or save a draft —
     both write directly to Firestore from the client. Posting
     also reserves funds in the same transaction, exactly like
     Wallet's Swap feature. Firestore rules should still enforce
     that a user can only ever decrease their own wallet.deposit
     from client code, never increase it.

   - Tasks start at status: "pending_review" (or "draft") and only
     appear on the Earn feed once an admin sets status: "active".
     employerUid is what the Earn/Advertisements feeds must filter
     out client-side (employerUid !== currentUser.uid) so a user
     never sees their own posted tasks/ads in their own feed.

   - Platform fee is fixed per preset (TASK_CATALOG[...].platform)
     and never changes even if the employer raises the amount per
     worker above the floor — the extra goes straight to the
     worker's payout, matching the pricing model where TaskNOVA
     doesn't need to recalculate its own fee when prices move.
   =========================================================== */
