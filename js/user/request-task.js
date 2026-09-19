/* =========================================================
   TASKNOVA — REQUEST TASK PAGE LOGIC
   Firebase v12.17.1 modular SDK

   Corrections applied this pass (see chat for full context):
   1. Submitting a request now also sends an EmailJS alert to
      admin's inbox (best-effort — never blocks or fails the
      actual submission, since the Firestore write is the real
      record admin/tasks.html's Task Requests tab already reads).
   2. accountType/institutionAbbr removed from the menu subtitle,
      replaced with @username, per the site-wide removal.
   3. Tawk.to visitor auto-fill added (same block as every other
      reworked page).
   4. SKRED_ADVERTISE_LINK renamed to DEFAULT_BANNER_LINK (same
      fix already applied elsewhere).
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
   DEFAULT BANNER -> INTERNAL "ADVERTISE WITH US" LINK
   (Used whenever a paid banner slot is empty. Renamed from the
   old SKRED_ADVERTISE_LINK name — it already pointed internally,
   not to Skred, and Skred is being removed from the app entirely
   as a support/contact channel, so the old name was misleading.)
   --------------------------------------------------------- */
const DEFAULT_BANNER_LINK = "../user/post-advertisement.html";

document.querySelectorAll("[data-default-ad]").forEach((el) => {
  el.addEventListener("click", () => {
    window.open(DEFAULT_BANNER_LINK, "_blank", "noopener");
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

// Floating support opens the Tawk.to chat widget.
supportFab?.addEventListener("click", (e) => {
  e.preventDefault();
  if (window.Tawk_API && typeof Tawk_API.toggle === "function") {
    Tawk_API.toggle();
  }
});

/* ---------------------------------------------------------
   TAWK.TO VISITOR AUTO-FILL
   Pushes the signed-in user's name/email/username to Tawk so any
   chat opened from this page arrives pre-filled. Same block as
   every other reworked page.
   --------------------------------------------------------- */
function syncTawkVisitor({ fullName, email, username }) {
  const attrs = {
    name: fullName || undefined,
    email: email || undefined,
    username: username || undefined
  };

  const apply = () => {
    if (window.Tawk_API && typeof Tawk_API.setAttributes === "function") {
      Tawk_API.setAttributes(attrs, (err) => {
        if (err) console.error("Tawk setAttributes error:", err);
      });
    }
  };

  if (window.Tawk_API && typeof Tawk_API.setAttributes === "function") {
    apply();
  } else {
    window.Tawk_API = window.Tawk_API || {};
    const previousOnLoad = window.Tawk_API.onLoad;
    window.Tawk_API.onLoad = function () {
      if (typeof previousOnLoad === "function") previousOnLoad();
      apply();
    };
  }
}
let tawkSynced = false;

/* ---------------------------------------------------------
   EMAILJS — admin alert on new task request
   Loaded the same way Veltrix/Flutterwave's scripts are —
   injected here rather than assumed to already be in the page's
   <head>. EmailJS is built for this exact case (send straight from
   the browser with a public key, no backend needed), so this
   skips Supabase entirely — there's no secret to protect.
   --------------------------------------------------------- */
const EMAILJS_SERVICE_ID = "service_9rc53vl";
const EMAILJS_TEMPLATE_ID = "template_jb7jqv8";
// TODO: EmailJS's public key (Account -> API Keys in the EmailJS
// dashboard) hasn't been provided yet — every emailjs.send() call
// below will fail (visibly, in the console; silently to the user,
// by design) until this is filled in.
const EMAILJS_PUBLIC_KEY = "U1tt86J8H_-S_0QfH";

(function loadEmailJs() {
  if (window.emailjs || document.querySelector("script[data-emailjs]")) return;
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
  script.dataset.emailjs = "true";
  script.async = true;
  document.head.appendChild(script);
})();

// Best-effort only — a failed email never blocks or fails the
// request submission itself, since the Firestore write (already
// committed by the time this runs) is the real record
// admin/tasks.html's Task Requests tab reads.
async function sendAdminRequestAlert(requestData, requesterInfo) {
  try {
    if (!window.emailjs) {
      console.warn("EmailJS script not loaded yet — skipping admin alert email.");
      return;
    }
    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      requester_name: requesterInfo.fullName || "A TaskNOVA user",
      requester_username: requesterInfo.username || "",
      requester_email: requesterInfo.email || "",
      what_wanted: requestData.whatWanted,
      instructions: requestData.instructions,
      platform: requestData.platform,
      workers_required: String(requestData.workersRequired),
      desired_result: requestData.desiredResult,
      proof_requirements: requestData.proofRequirements.join(", ") || "None specified"
    }, { publicKey: EMAILJS_PUBLIC_KEY });
  } catch (err) {
    console.error("EmailJS admin alert failed (request was still saved):", err);
  }
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
   PROOF REQUIREMENTS — simple add/remove chip list
   --------------------------------------------------------- */
const proofChipList = document.getElementById("proofChipList");
const proofInput = document.getElementById("proofInput");
const proofAddBtn = document.getElementById("proofAddBtn");

let proofRequirements = [];

function renderProofChips() {
  proofChipList.innerHTML = proofRequirements.map((text, idx) => `
    <li>
      <span>${text}</span>
      <button type="button" data-idx="${idx}" aria-label="Remove"><i class="bx bx-x"></i></button>
    </li>
  `).join("");

  proofChipList.querySelectorAll("button[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      proofRequirements.splice(Number(btn.dataset.idx), 1);
      renderProofChips();
    });
  });
}

function addProofRequirement() {
  const value = proofInput.value.trim();
  if (!value) return;
  proofRequirements.push(value);
  proofInput.value = "";
  renderProofChips();
}

proofAddBtn.addEventListener("click", addProofRequirement);
proofInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addProofRequirement();
  }
});

/* ---------------------------------------------------------
   SUBMIT — writes a review request, no wallet involved.
   Admin reviews it (and may reach out or add it to the
   catalogue) — this page never charges anything.
   --------------------------------------------------------- */
const requestForm = document.getElementById("requestTaskForm");
const requestSubmit = document.getElementById("requestSubmit");

const whatWantedInput = document.getElementById("whatWanted");
const instructionsInput = document.getElementById("requestInstructions");
const platformInput = document.getElementById("requestPlatform");
const workersInput = document.getElementById("requestWorkers");
const desiredResultInput = document.getElementById("desiredResult");

let currentUser = null;
let currentUserData = { fullName: "", username: "", email: "" };

function validateForm() {
  if (!whatWantedInput.value.trim()) return "Tell us what you want done.";
  if (!instructionsInput.value.trim()) return "Add instructions for how workers should do this.";
  if (!platformInput.value.trim()) return "Tell us where this task happens (platform).";
  if (!workersInput.value || Number(workersInput.value) < 1) return "Enter how many workers you'd want.";
  if (!desiredResultInput.value.trim()) return "Describe what result you're looking for.";
  return null;
}

requestForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();

  const errorText = validateForm();
  if (errorText) { showMsg("error", errorText); return; }
  if (!currentUser) return;

  requestSubmit.classList.add("loading");
  requestSubmit.disabled = true;

  try {
    const requestData = {
      requesterUid: currentUser.uid,
      whatWanted: whatWantedInput.value.trim(),
      instructions: instructionsInput.value.trim(),
      platform: platformInput.value.trim(),
      workersRequired: Number(workersInput.value),
      desiredResult: desiredResultInput.value.trim(),
      proofRequirements,
      status: "pending_review",
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, "taskRequests"), requestData);
    sendAdminRequestAlert(requestData, currentUserData); // fire-and-forget, never blocks the UI below

    showMsg("success", "Request submitted! Our admin will review it and reach out if needed.");
    requestForm.reset();
    proofRequirements = [];
    renderProofChips();
  } catch (err) {
    console.error("Request task submission error:", err);
    showMsg("error", "Something went wrong sending your request. Please try again.");
  } finally {
    requestSubmit.classList.remove("loading");
    requestSubmit.disabled = false;
  }
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

    currentUserData = { fullName: data.fullName || "", username: data.username || "", email: user.email || "" };

    if (userNameEl) userNameEl.textContent = fullName || user.email;
    // accountType/institutionAbbr are retired site-wide (no more
    // Student/Teacher/None distinction) — show the username instead.
    if (userTypeEl) userTypeEl.textContent = data.username ? "@" + data.username : user.email;
    if (userAvatarEl) userAvatarEl.textContent = initial;

    if (!tawkSynced) {
      tawkSynced = true;
      syncTawkVisitor({ fullName: data.fullName, email: user.email, username: data.username });
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
   - No wallet, no Cloud Function — this is purely a suggestion/
     request document for admin to review. If admin decides to
     turn it into a real task type, that becomes a normal Post
     Task flow (via the catalogue) or a custom-priced task the
     admin sets up on the requester's behalf.

   - EMAILJS_PUBLIC_KEY is a placeholder — nothing will actually
     send until the real public key (EmailJS dashboard -> Account
     -> API Keys) is filled in above.

   - The template param names (requester_name, what_wanted,
     platform, etc.) are this file's own reasonable guess — they
     need to match whatever variable names the already-built-and-
     tested template_jdbogum template actually uses. If the email
     doesn't render right (blank fields, literal {{tags}} showing),
     that's the first thing to check — rename the keys in
     sendAdminRequestAlert to match the template exactly.

   - The template's "To" address is assumed to already be fixed to
     admin's inbox inside the EmailJS template's own settings (the
     normal way to do this), so this call only sends content
     params, no recipient. If the template instead expects the
     recipient passed in per-send, add a to_email param here with
     admin's actual address.

   - Not done here, flagged for whenever admin/tasks.html's Task
     Requests tab is next touched: the review asked for Mark
     Resolved to capture an explicit Approved/Rejected verdict (not
     just a free-text note), so admin's email reply and the
     resolution note agree on outcome. That's a small change to
     that tab's UI, not this file.
   =========================================================== */
