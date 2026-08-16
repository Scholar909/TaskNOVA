/* =========================================================
   TASKNOVA — SUPPORT PAGE LOGIC
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
  onSnapshot
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

// Cloud Function endpoint — see the backend note at the end of this file
// for exactly what it needs to do. No email-sending secrets live here.
const SUBMIT_TICKET_ENDPOINT = "https://REGION-PROJECT.cloudfunctions.net/submitSupportTicket";

let currentUser = null;

ticketForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearPanelMsg(ticketMsg);

  const subject = ticketSubjectSelect.value;
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

  ticketSubmit.classList.add("loading");
  ticketSubmit.disabled = true;

  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch(SUBMIT_TICKET_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + idToken
      },
      body: JSON.stringify({
        name: ticketNameInput.value,
        email: ticketEmailInput.value,
        subject,
        message
      })
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || "Couldn't send your ticket.");

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
  ticketEmailInput.value = user.email || "";

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

    ticketNameInput.value = fullName;
  }, (err) => {
    console.error("User doc listener error:", err);
  });

  alertDot?.classList.remove("show");
});

/* ===========================================================
   BACKEND NOTE
   ===========================================================
   This file never sends email directly — a browser can't do that
   safely, and the Tawk.to API key must never sit in client code.
   One Cloud Function needs to exist:

   submitSupportTicket({ name, email, subject, message })
     - Verify the caller's Firebase ID token (from the Authorization header).
     - Send an email to: tickets@tasknova-support.p.tawk.email
         From:    TaskNOVA <no-reply@yourdomain.com> (or similar, via
                  whatever transactional mail service you use —
                  e.g. Nodemailer + SMTP, SendGrid, Mailgun, etc.)
         Reply-To: the user's own email, so agents replying from
                  their inbox reach the user directly.
         Subject: "[<subject>] " + name
         Body:    message, plus name/email for reference.
     - Sending to that address is what turns it into a Tawk.to
       ticket/conversation — agents can then reply either by email
       or straight from the Tawk.to dashboard, and it threads as
       one continuing conversation either way.
     - Alternatively, if preferred, this same function can call
       Tawk.to's REST API directly using the API key
       (0daf0077e92f316573933fa6635c42c977f4b81c) to create the
       conversation instead of sending an email — either approach
       lands in the same place. Keep that key as a server-side
       secret/environment variable, never in this file.

   Update SUBMIT_TICKET_ENDPOINT above once this function exists.
   =========================================================== */
