/* =========================================================
   TASKNOVA — REFER A FRIEND PAGE LOGIC
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
  orderBy
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

  supportFab.addEventListener("click", (e) => {
    e.preventDefault();

    if (window.Tawk_API && typeof Tawk_API.toggle === "function") {
      Tawk_API.toggle();
    }
  });
}

document.getElementById("floatingAdClose")?.addEventListener("click", (e) => {
  e.stopPropagation();
  floatingAd.style.display = "none";
});

/* ---------------------------------------------------------
   FORMAT HELPERS
   --------------------------------------------------------- */
const nairaFormat = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2
});

function formatNaira(amount) {
  return nairaFormat.format(Number(amount) || 0);
}

function formatJoinedDate(date) {
  if (!date) return "";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/* ---------------------------------------------------------
   DOM REFS
   --------------------------------------------------------- */
const referralCodeEl = document.getElementById("referralCode");
const referralLinkInput = document.getElementById("referralLink");
const copyCodeBtn = document.getElementById("copyCodeBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const shareBtn = document.getElementById("shareBtn");
const copiedNote = document.getElementById("copiedNote");

const statTotal = document.getElementById("statTotal");
const statRewarded = document.getElementById("statRewarded");
const statEarned = document.getElementById("statEarned");
const referredList = document.getElementById("referredList");

const userNameEl = document.getElementById("menuUserName");
const userTypeEl = document.getElementById("menuUserType");
const userAvatarEl = document.getElementById("menuUserAvatar");
const alertDot = document.getElementById("alertDot");
const removeAdsStatus = document.getElementById("removeAdsStatus");

let currentUsername = "";
let currentReferralLink = "";

/* ---------------------------------------------------------
   COPY / SHARE
   --------------------------------------------------------- */
function flashCopiedNote() {
  copiedNote.classList.add("show");
  setTimeout(() => copiedNote.classList.remove("show"), 1800);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Fallback for browsers without Clipboard API access
    const temp = document.createElement("textarea");
    temp.value = text;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
  }
  flashCopiedNote();
}

copyCodeBtn.addEventListener("click", () => {
  if (!currentUsername) return;
  copyText(currentUsername);
});

copyLinkBtn.addEventListener("click", () => {
  if (!currentReferralLink) return;
  copyText(currentReferralLink);
});

referralLinkInput.addEventListener("click", () => {
  referralLinkInput.select();
});

shareBtn.addEventListener("click", async () => {
  if (!currentReferralLink) return;
  const shareData = {
    title: "Join me on TaskNOVA",
    text: `Use my code ${currentUsername} to sign up on TaskNOVA and start earning:`,
    url: currentReferralLink
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      // User cancelled the share sheet — nothing to do.
    }
  } else {
    copyText(currentReferralLink);
  }
});

/* ---------------------------------------------------------
   RENDER: referred people list
   --------------------------------------------------------- */
function renderReferredList(rows) {
  if (!rows.length) {
    referredList.innerHTML = `<div class="ref-empty">No referrals yet — share your code to get started.</div>`;
    return;
  }

  referredList.innerHTML = rows.map((ref) => {
    const initial = (ref.username || "?").trim().charAt(0).toUpperCase();
    const statusClass = ref.rewarded ? "rewarded" : "pending";
    const statusLabel = ref.rewarded ? "Rewarded ₦100" : "Pending deposit";

    return `
      <div class="ref-row">
        <div class="ref-avatar">${initial}</div>
        <div class="ref-info">
          <strong>@${ref.username || "unknown"}</strong>
          <span>Joined ${formatJoinedDate(ref.joinedDate)}</span>
        </div>
        <span class="ref-status ${statusClass}">${statusLabel}</span>
      </div>`;
  }).join("");
}

/* ---------------------------------------------------------
   AUTH GUARD + LIVE DATA
   Referral code = the user's own username (matches what new
   users are asked to enter as "Referral code" at signup).
   Reads users/{uid}/referrals — one doc per person referred.
   Expected shape per doc: { username, rewarded, joinedAt }.
   See the note at the end of this file for how that
   subcollection gets populated.
   --------------------------------------------------------- */
let unsubscribeUserDoc = null;
let unsubscribeReferrals = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (!user.emailVerified) {
    window.location.href = "login.html";
    return;
  }

  if (unsubscribeUserDoc) unsubscribeUserDoc();
  if (unsubscribeReferrals) unsubscribeReferrals();

  unsubscribeUserDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    const fullName = data.fullName || "TaskNOVA User";
    const initial = fullName.trim().charAt(0).toUpperCase() || "T";

    if (userNameEl) userNameEl.textContent = fullName || user.email;
    if (userTypeEl) userTypeEl.textContent = data.accountType ? data.accountType + (data.institutionAbbr ? " · " + data.institutionAbbr : "") : user.email;
    if (userAvatarEl) userAvatarEl.textContent = initial;
    if (removeAdsStatus) removeAdsStatus.style.display = data.popupRemovalActive ? "inline-flex" : "none";

    currentUsername = data.username || "";
    currentReferralLink = currentUsername
      ? `${window.location.origin}/user/login.html?ref=${encodeURIComponent(currentUsername)}`
      : "";

    referralCodeEl.textContent = currentUsername || "—";
    referralCodeEl.classList.remove("skeleton");
    referralLinkInput.value = currentReferralLink || "Set up your account to get a link";
  }, (err) => {
    console.error("User doc listener error:", err);
  });

  const refQuery = query(
    collection(db, "users", user.uid, "referrals"),
    orderBy("joinedAt", "desc")
  );

  unsubscribeReferrals = onSnapshot(refQuery, (snap) => {
    let total = 0;
    let rewarded = 0;
    let earned = 0;

    const rows = snap.docs.map((d) => {
      const data = d.data();
      total += 1;
      if (data.rewarded) {
        rewarded += 1;
        earned += 100;
      }
      return {
        username: data.username || "",
        rewarded: !!data.rewarded,
        joinedDate: data.joinedAt?.toDate ? data.joinedAt.toDate() : null
      };
    });

    statTotal.textContent = String(total);
    statTotal.classList.remove("skeleton");
    statRewarded.textContent = String(rewarded);
    statRewarded.classList.remove("skeleton");
    statEarned.textContent = formatNaira(earned);
    statEarned.classList.remove("skeleton");

    renderReferredList(rows);
  }, (err) => {
    console.error("Referrals listener error:", err);
    renderReferredList([]);
  });

  alertDot?.classList.remove("show");
});

/* ===========================================================
   BACKEND NOTE
   ===========================================================
   This page only reads users/{uid}/referrals — it never writes
   to it, since a new user can't safely write into a stranger's
   subcollection under normal Firestore rules. That subcollection
   should be populated by a Cloud Function triggered on new user
   creation:

   1. On signup, if referralCodeUsed is set, look up the user
      whose username matches it.
   2. If found, create a doc at
      users/{referrerUid}/referrals/{newUserUid} with:
        { username: <new user's username>, rewarded: false, joinedAt: serverTimestamp() }
   3. When that new user's first deposit of >= ₦500 is verified
      (in the deposit-verification Cloud Function), check whether
      their referrals doc is still unrewarded, then:
        - set rewarded: true on that doc
        - credit the referrer's wallet.earned by 100
        - write a "referral" transaction doc for the referrer
      Skip all of this if the doc is already rewarded (one-time
      reward per referral, per the doc's rules).
   =========================================================== */
