/* =========================================================
   TASKNOVA — ALERTS PAGE LOGIC
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
  orderBy,
  limit,
  startAfter,
  getDocs,
  updateDoc,
  writeBatch,
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
   FORMAT HELPERS
   --------------------------------------------------------- */
function formatTime(date) {
  if (!date) return "";
  return date.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
}

function dateGroupLabel(date) {
  if (!date) return "Earlier";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) return "Today";
  if (date >= startOfYesterday) return "Yesterday";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

/* ---------------------------------------------------------
   ALERT TYPE -> ICON / SEVERITY (per section 80 of the doc)
   --------------------------------------------------------- */
const ALERT_META = {
  task_approval: { icon: "bx-check-circle", severity: "success", label: "Task Approved" },
  task_decline: { icon: "bx-x-circle", severity: "danger", label: "Task Declined" },
  task_repost: { icon: "bx-refresh", severity: "neutral", label: "Task Reposted" },
  submission_approval: { icon: "bx-badge-check", severity: "success", label: "Submission Approved" },
  submission_decline: { icon: "bx-block", severity: "danger", label: "Submission Declined" },
  wrongful_decline_resolution: { icon: "bx-shield-quarter", severity: "success", label: "Wrongful Decline Resolved" },
  withdrawal_status: { icon: "bx-upload", severity: "neutral", label: "Withdrawal Update" },
  ad_approval: { icon: "bx-megaphone-alt", severity: "success", label: "Advertisement Approved" },
  ad_decline: { icon: "bx-megaphone-alt", severity: "danger", label: "Advertisement Declined" },
  ad_edit_approval: { icon: "bx-edit-alt", severity: "success", label: "Ad Edit Approved" },
  ad_edit_decline: { icon: "bx-edit-alt", severity: "danger", label: "Ad Edit Declined" },
  referral_reward: { icon: "bx-gift", severity: "success", label: "Referral Reward" },
  inactivity_reminder: { icon: "bx-time-five", severity: "neutral", label: "Inactivity Reminder" },
  account_deletion_warning: { icon: "bx-error", severity: "warning", label: "Account Deletion Warning" },
  account_deletion: { icon: "bx-user-x", severity: "danger", label: "Account Deleted" }
};

function metaFor(type) {
  return ALERT_META[type] || ALERT_META.other;
}

/* ---------------------------------------------------------
   STATE
   --------------------------------------------------------- */
const PAGE_SIZE = 20;

let currentUser = null;
let allLoadedAlerts = [];
let lastVisibleDoc = null;
let hasMore = true;
let isLoading = false;

/* ---------------------------------------------------------
   DOM REFS
   --------------------------------------------------------- */
const alertGroups = document.getElementById("alertGroups");
const loadMoreWrap = document.getElementById("loadMoreWrap");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const unreadSummary = document.getElementById("unreadSummary");
const markAllBtn = document.getElementById("markAllBtn");

const userNameEl = document.getElementById("menuUserName");
const userTypeEl = document.getElementById("menuUserType");
const userAvatarEl = document.getElementById("menuUserAvatar");
const alertDot = document.getElementById("alertDot");

/* ---------------------------------------------------------
   RENDER
   --------------------------------------------------------- */
function render() {
  if (!allLoadedAlerts.length) {
    alertGroups.innerHTML = `
      <div class="alert-empty">
        <i class="bx bx-bell-off"></i>
        No alerts yet.
      </div>`;
    loadMoreWrap.style.display = "none";
    return;
  }

  const groups = [];
  let currentLabel = null;
  let currentBucket = null;

  allLoadedAlerts.forEach((alert) => {
    const label = dateGroupLabel(alert.date);
    if (label !== currentLabel) {
      currentLabel = label;
      currentBucket = { label, rows: [] };
      groups.push(currentBucket);
    }
    currentBucket.rows.push(alert);
  });

  alertGroups.innerHTML = groups.map((group) => `
    <div class="alert-date-group">
      <div class="alert-date-heading">${group.label}</div>
      <div class="alert-list">
        ${group.rows.map(renderAlertItem).join("")}
      </div>
    </div>
  `).join("");

  alertGroups.querySelectorAll(".alert-item").forEach((item) => {
    const row = item.querySelector(".alert-row");
    row.addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      alertGroups.querySelectorAll(".alert-item.open").forEach((el) => el.classList.remove("open"));
      if (!wasOpen) {
        item.classList.add("open");
        const id = item.dataset.id;
        const alert = allLoadedAlerts.find((a) => a.id === id);
        if (alert && !alert.read) markAsRead(alert);
      }
    });
  });

  loadMoreWrap.style.display = hasMore ? "flex" : "none";
}

function renderAlertItem(alert) {
  const meta = metaFor(alert.type);
  return `
    <div class="alert-item ${meta.severity} ${alert.read ? "" : "unread"}" data-id="${alert.id}">
      <div class="alert-row">
        <div class="alert-icon"><i class="bx ${meta.icon}"></i></div>
        <div class="alert-info">
          <div class="alert-info-top">
            <strong>${alert.title || meta.label}</strong>
            ${alert.read ? "" : `<span class="unread-dot"></span>`}
          </div>
          <span class="alert-snippet">${alert.message || ""}</span>
          <span class="alert-time">${formatTime(alert.date)}</span>
        </div>
        <i class="bx bx-chevron-down alert-chevron"></i>
      </div>
      <div class="alert-detail">
        <div>
          <div class="alert-detail-inner">${alert.message || "No further details."}</div>
        </div>
      </div>
    </div>`;
}

function updateUnreadSummary() {
  const unreadCount = allLoadedAlerts.filter((a) => !a.read).length;
  if (unreadCount === 0) {
    unreadSummary.textContent = "All caught up";
    markAllBtn.style.display = "none";
  } else {
    unreadSummary.textContent = `${unreadCount} unread`;
    markAllBtn.style.display = "inline-flex";
  }
}

/* ---------------------------------------------------------
   MARK AS READ
   --------------------------------------------------------- */
async function markAsRead(alert) {
  alert.read = true; // optimistic update
  updateUnreadSummary();
  document.querySelector(`.alert-item[data-id="${alert.id}"]`)?.classList.remove("unread");

  try {
    await updateDoc(doc(db, "users", currentUser.uid, "notifications", alert.id), {
      read: true,
      readAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Mark as read error:", err);
  }
}

markAllBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  markAllBtn.disabled = true;

  try {
    const unreadQuery = query(
      collection(db, "users", currentUser.uid, "notifications"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(unreadQuery);

    // Firestore batches cap at 500 writes — chunk just in case there's a
    // very long unread backlog.
    const unreadDocs = snap.docs.filter((d) => d.data().read !== true);
    for (let i = 0; i < unreadDocs.length; i += 450) {
      const chunk = unreadDocs.slice(i, i + 450);
      const batch = writeBatch(db);
      chunk.forEach((d) => {
        batch.update(d.ref, { read: true, readAt: serverTimestamp() });
      });
      await batch.commit();
    }

    allLoadedAlerts = allLoadedAlerts.map((a) => ({ ...a, read: true }));
    render();
    updateUnreadSummary();
  } catch (err) {
    console.error("Mark all as read error:", err);
  } finally {
    markAllBtn.disabled = false;
  }
});

/* ---------------------------------------------------------
   FETCH (paginated)
   --------------------------------------------------------- */
async function fetchPage(reset = false) {
  if (!currentUser || isLoading) return;
  isLoading = true;
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.disabled = true;

  if (reset) {
    allLoadedAlerts = [];
    lastVisibleDoc = null;
    hasMore = true;
    alertGroups.innerHTML = `<div class="alert-list"><div class="alert-skeleton"></div><div class="alert-skeleton"></div><div class="alert-skeleton"></div></div>`;
  }

  try {
    const baseRef = collection(db, "users", currentUser.uid, "notifications");
    const constraints = [orderBy("createdAt", "desc")];
    if (lastVisibleDoc) constraints.push(startAfter(lastVisibleDoc));
    constraints.push(limit(PAGE_SIZE));

    const snap = await getDocs(query(baseRef, ...constraints));

    if (snap.empty) {
      hasMore = false;
    } else {
      lastVisibleDoc = snap.docs[snap.docs.length - 1];
      hasMore = snap.docs.length === PAGE_SIZE;

      snap.docs.forEach((d) => {
        const data = d.data();
        allLoadedAlerts.push({
          id: d.id,
          type: data.type || "other",
          title: data.title || "",
          message: data.message || "",
          read: !!data.read,
          date: data.createdAt?.toDate ? data.createdAt.toDate() : null
        });
      });
    }

    render();
    updateUnreadSummary();
  } catch (err) {
    console.error("Alerts fetch error:", err);
    alertGroups.innerHTML = `<div class="alert-empty"><i class="bx bx-error-circle"></i>Couldn't load alerts. Please try again.</div>`;
  } finally {
    isLoading = false;
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  }
}

loadMoreBtn.addEventListener("click", () => fetchPage(false));

/* ---------------------------------------------------------
   AUTH GUARD
   --------------------------------------------------------- */
let unsubscribeUserDoc = null;

/* ---------------------------------------------------------
   NOTIFICATION SETTINGS PANEL
   Slides open/closed. Preferences are read and written directly
   on the user doc (users/{uid}.notificationPrefs) — a plain
   real-time Firestore write, no Cloud Function involved.
   --------------------------------------------------------- */
const settingsToggleBtn = document.getElementById("settingsToggleBtn");
const settingsPanelViewport = document.getElementById("settingsPanelViewport");
const emailPrefSwitch = document.getElementById("emailPrefSwitch");
const devicePrefSwitch = document.getElementById("devicePrefSwitch");
const settingsNote = document.getElementById("settingsNote");

settingsToggleBtn.addEventListener("click", () => {
  const isOpen = settingsPanelViewport.classList.toggle("open");
  settingsToggleBtn.setAttribute("aria-expanded", String(isOpen));
});

function setSwitch(el, on) {
  el.setAttribute("aria-checked", String(!!on));
}

// Each toggle only touches its own field via dot-notation, so the two
// switches never clobber each other.
async function savePref(field, value) {
  if (!currentUser) return;
  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      [`notificationPrefs.${field}`]: value
    });
  } catch (err) {
    console.error("Save notification pref error:", err);
    settingsNote.textContent = "Couldn't save that — please try again.";
    settingsNote.classList.add("error");
  }
}

emailPrefSwitch.addEventListener("click", () => {
  const next = emailPrefSwitch.getAttribute("aria-checked") !== "true";
  setSwitch(emailPrefSwitch, next);
  settingsNote.classList.remove("error");
  settingsNote.textContent = "";
  savePref("email", next);
});

devicePrefSwitch.addEventListener("click", async () => {
  const next = devicePrefSwitch.getAttribute("aria-checked") !== "true";
  settingsNote.classList.remove("error");

  if (next) {
    // Turning device notifications on — ask the browser/OS for permission.
    // In a wrapped app (e.g. via Capacitor), the equivalent native push
    // permission prompt would replace this call, but the stored
    // preference and Firestore field stay the same either way.
    if (!("Notification" in window)) {
      settingsNote.textContent = "Device notifications aren't supported in this browser.";
      settingsNote.classList.add("error");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      settingsNote.textContent = "Permission was denied — enable notifications for this site in your browser/device settings to turn this on.";
      settingsNote.classList.add("error");
      setSwitch(devicePrefSwitch, false);
      savePref("device", false);
      return;
    }
    settingsNote.textContent = "";
  }

  setSwitch(devicePrefSwitch, next);
  savePref("device", next);
});

/* ---------------------------------------------------------
   AUTH GUARD
   --------------------------------------------------------- */
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

    // Reflect saved preferences in the toggle switches (defaults: email on, device off)
    const prefs = data.notificationPrefs || {};
    setSwitch(emailPrefSwitch, prefs.email !== false);
    setSwitch(devicePrefSwitch, prefs.device === true);
  }, (err) => {
    console.error("User doc listener error:", err);
  });

  // The header badge on every other page uses its own lightweight
  // existence-check listener (see the snippet shared alongside this page) —
  // this page doesn't need to duplicate that here.
  alertDot?.classList.remove("show");

  fetchPage(true);
});

/* ===========================================================
   BACKEND NOTE
   ===========================================================
   Keep this lightweight — per the platform's notification design:

   - Notifications are just documents at
     users/{uid}/notifications/{id}, written directly by whatever
     already handles the underlying event. e.g. when an admin
     approves a submission, that same write (update the submission,
     credit the wallet) also creates the notification doc right
     there — no separate Cloud Function needed just to create it.

   - Reserve actual Cloud Functions for things that genuinely can't
     depend on a user's browser being open: scheduled inactivity
     reminders, automatic account deletion, and similar timed jobs.
     A scheduled function to delete notifications older than
     30–60 days is a reasonable one to add later, so the
     subcollection doesn't grow forever — not required to launch.

   - This page deliberately avoids expensive patterns: it fetches
     a bounded page of recent notifications (not the whole history),
     and the header's unread dot (see the snippet applied across
     every page) checks existence with limit(1) rather than
     counting the whole unread set.

   Expected doc shape at users/{uid}/notifications/{id}:
     {
       type: "task_approval" | "task_decline" | "task_repost" |
             "submission_approval" | "submission_decline" |
             "wrongful_decline_resolution" | "withdrawal_status" |
             "ad_approval" | "ad_decline" | "ad_edit_approval" |
             "ad_edit_decline" | "referral_reward" |
             "inactivity_reminder" | "account_deletion_warning" |
             "account_deletion" | "popup_removal_activation" |
             "popup_removal_expiration" | "other",
       title: "Short headline shown in the list",
       message: "Full detail shown when the alert is expanded",
       read: false,
       createdAt: serverTimestamp()
     }

   users/{uid}.notificationPrefs (this page reads/writes it directly):
     { email: true, device: false }
   ===========================================================
   NOTE ON THE SETTINGS PANEL LOAD:
   The toggles above are set from the live user-doc listener in the
   auth guard block — see the onSnapshot callback, which reads
   data.notificationPrefs and calls setSwitch() for each one.
   =========================================================== */
