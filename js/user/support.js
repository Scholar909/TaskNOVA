/* =========================================================
   TASKNOVA — SUPPORT PAGE LOGIC
   Firebase v12.17.1 modular SDK

   Corrections applied this pass (see chat for full context):
   1. Ticket submission switched from a Cloud Function
      (submitSupportTicket) to sending directly via EmailJS —
      the same public-key, no-backend-secret model already used on
      request-task.js, just with its own separate template. The
      old Cloud Function is no longer needed at all.
   2. "Advertisement / Banner" and "Other" added to the ticket
      subject dropdown ("this is for incase Tawk.to live is
      offline, so it can be for anything at all") — added
      defensively via JS (checking for and only adding options
      that aren't already there) rather than assuming
      support.html's exact <option> markup.
   3. Skred removed entirely as a concept, not just reworded —
      previously this page framed Skred as "used only for ad
      banner inquiries"; now ad-banner questions are just another
      ticket subject, handled the same way as everything else.
   4. accountType/institutionAbbr removed from the menu subtitle,
      replaced with @username, per the site-wide removal.
   5. Tawk.to visitor auto-fill added (same block as every other
      reworked page) alongside the status-check/chat-toggle logic
      that was already here.
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
  limit
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
   every other reworked page — separate concern from the status-
   check/chat-toggle logic below, which just controls the widget
   itself.
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
   TAWK.TO STATUS + CHAT BUTTON
   --------------------------------------------------------- */
const statusDot = document.getElementById("statusDot");
const statusHeadline = document.getElementById("statusHeadline");
const statusSub = document.getElementById("statusSub");
const chatSupportBtn = document.getElementById("chatSupportBtn");

function applyStatus(status) {
  // Tawk_API.getStatus() returns 'online', 'away', or 'offline'
  if (status === "online") {
    statusDot.className = "status-dot online";
    statusHeadline.textContent = "Support is online";
    statusSub.textContent = "Chat with us now — average reply time is a few minutes.";
  } else {
    statusDot.className = "status-dot offline";
    statusHeadline.textContent = "Support is currently offline";
    statusSub.textContent = "Send a ticket below and we'll reply by email within 24 hours.";
  }
}

function checkTawkStatus() {
  if (window.Tawk_API && typeof Tawk_API.getStatus === "function") {
    applyStatus(Tawk_API.getStatus());
  } else {
    // Widget script hasn't finished loading yet — try again shortly.
    setTimeout(checkTawkStatus, 800);
  }
}
checkTawkStatus();

// Keep the banner in sync if status changes while the page is open
window.addEventListener("load", () => {
  if (window.Tawk_API) {
    Tawk_API.onStatusChange = function (status) {
      applyStatus(status);
    };
  }
});

chatSupportBtn.addEventListener("click", () => {
  if (window.Tawk_API && typeof Tawk_API.toggle === "function") {
    Tawk_API.toggle();
  } else {
    statusSub.textContent = "Chat is still loading — please try again in a moment.";
  }
});

/* ---------------------------------------------------------
   TICKET FORM
   Name + email are filled from the account and can't be edited —
   they're what identifies the ticket to support.
   --------------------------------------------------------- */
const ticketForm = document.getElementById("ticketForm");
const ticketNameInput = document.getElementById("ticketName");
const ticketEmailInput = document.getElementById("ticketEmail");
const ticketSubjectSelect = document.getElementById("ticketSubject");
const ticketMessageInput = document.getElementById("ticketMessage");
const ticketMsg = document.getElementById("ticketMsg");
const ticketSubmit = document.getElementById("ticketSubmit");

function showPanelMsg(el, type, text) {
  el.className = "panel-msg show " + type;
  const icon = type === "error" ? "bx-error-circle" : "bx-check-circle";
  el.innerHTML = `<i class="bx ${icon}"></i><span>${text}</span>`;
}

function clearPanelMsg(el) {
  el.className = "panel-msg";
  el.innerHTML = "";
}

// "This is for incase Tawk.to live is offline, so it can be for anything
// at all" — makes sure Advertisement/Banner and Other exist as subjects,
// added defensively (only if not already present) rather than assuming
// support.html's exact <option> markup.
function ensureSubjectOption(value, label) {
  if (!ticketSubjectSelect.querySelector(`option[value="${value}"]`)) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    ticketSubjectSelect.appendChild(opt);
  }
}
ensureSubjectOption("ad_banner", "Advertisement / Banner");
ensureSubjectOption("other", "Other");

/* ---------------------------------------------------------
   EMAILJS — sends the ticket straight to Tawk.to's ticket email
   Replaces the old submitSupportTicket Cloud Function entirely —
   EmailJS's public-key model needs no backend secret, so there's
   nothing left for a Cloud Function to protect here. Uses its own
   template, separate from request-task.js's — service stays the
   same, only the template differs.
   --------------------------------------------------------- */
const EMAILJS_SERVICE_ID = "service_9rc53vl";
// TODO: fill in manually — this page's own template id (kept
// separate from request-task.js's template_jdbogum).
const EMAILJS_SUPPORT_TEMPLATE_ID = "YOUR_SUPPORT_TEMPLATE_ID";
// TODO: fill in manually — EmailJS dashboard -> Account -> API Keys.
const EMAILJS_PUBLIC_KEY = "YOUR_EMAILJS_PUBLIC_KEY";

(function loadEmailJs() {
  if (window.emailjs || document.querySelector("script[data-emailjs]")) return;
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
  script.dataset.emailjs = "true";
  script.async = true;
  document.head.appendChild(script);
})();

let currentUser = null;

ticketForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearPanelMsg(ticketMsg);

  const subject = ticketSubjectSelect.value;
  const subjectLabel = ticketSubjectSelect.options[ticketSubjectSelect.selectedIndex]?.textContent || subject;
  const message = ticketMessageInput.value.trim();

  if (!subject) {
    showPanelMsg(ticketMsg, "error", "Please choose what this ticket is about.");
    return;
  }
  if (!message) {
    showPanelMsg(ticketMsg, "error", "Please describe the issue before sending.");
    return;
  }
  if (!currentUser) {
    showPanelMsg(ticketMsg, "error", "Please wait for your account to finish loading and try again.");
    return;
  }
  if (!window.emailjs) {
    showPanelMsg(ticketMsg, "error", "Ticket sending is still loading — please try again in a moment.");
    return;
  }

  ticketSubmit.classList.add("loading");
  ticketSubmit.disabled = true;

  try {
    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_SUPPORT_TEMPLATE_ID, {
      requester_name: ticketNameInput.value,
      requester_email: ticketEmailInput.value,
      subject: subjectLabel,
      message
    }, { publicKey: EMAILJS_PUBLIC_KEY });

    showPanelMsg(ticketMsg, "success", "Ticket sent! We'll reply to " + ticketEmailInput.value + " as soon as possible.");
    ticketSubjectSelect.value = "";
    ticketMessageInput.value = "";
  } catch (err) {
    console.error("Ticket submission error:", err);
    showPanelMsg(ticketMsg, "error", err.message || "Something went wrong. Please try again, or use the chat button above.");
  } finally {
    ticketSubmit.classList.remove("loading");
    ticketSubmit.disabled = false;
  }
});

/* ---------------------------------------------------------
   AUTH GUARD — fills the ticket form's Name/Email from the
   account and keeps the menu drawer in sync.
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
  ticketEmailInput.value = user.email || "";

  if (unsubscribeUserDoc) unsubscribeUserDoc();

  unsubscribeUserDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    const fullName = data.fullName || "TaskNOVA User";
    const initial = fullName.trim().charAt(0).toUpperCase() || "T";

    if (userNameEl) userNameEl.textContent = fullName || user.email;
    // accountType/institutionAbbr are retired site-wide (no more
    // Student/Teacher/None distinction) — show the username instead.
    if (userTypeEl) userTypeEl.textContent = data.username ? "@" + data.username : user.email;
    if (userAvatarEl) userAvatarEl.textContent = initial;
    ticketNameInput.value = fullName;

    if (!tawkSynced) {
      tawkSynced = true;
      syncTawkVisitor({ fullName: data.fullName, email: user.email, username: data.username });
    }
  }, (err) => {
    console.error("User doc listener error:", err);
  });

  // Lightweight unread check — existence only (limit 1), not a count.
  // Shows/hides the header dot, nothing more.
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
   - Ticket sending no longer needs a Cloud Function. EmailJS
     sends straight from the browser with a public key — the old
     submitSupportTicket function (and its "verify the ID token,
     hold the Tawk.to API key server-side" design) is gone entirely.
     The Tawk.to ticket-email address itself
     (tickets@tasknova-support.p.tawk.email) is assumed to be baked
     into the EmailJS template's own "To" field, the same way
     request-task.js's admin-alert template works — sending to that
     address is what turns the email into a real Tawk.to ticket/
     conversation, so agents can reply either by email or from the
     Tawk.to dashboard and it threads as one conversation either way.

   - EMAILJS_SUPPORT_TEMPLATE_ID and EMAILJS_PUBLIC_KEY are both
     still placeholders — nothing will actually send until the real
     values (a separate template from request-task.js's
     template_jdbogum, plus the account's public key from EmailJS's
     dashboard) are filled in above.

   - Template param names (requester_name, requester_email, subject,
     message) are this file's own reasonable guess — verify/rename
     them to match whatever the actual support template expects,
     same caveat as request-task.js.

   - Tawk.to's own API key (0daf0077e92f316573933fa6635c42c977f4b81c)
     is never used in this file at all — it's only needed for
     Tawk.to's own widget script (loaded elsewhere in the page,
     outside this file's control) and for anything that calls
     Tawk.to's REST API directly, which nothing here does anymore.
   =========================================================== */
