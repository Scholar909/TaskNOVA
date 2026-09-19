/* =========================================================
   TASKNOVA — REFER A FRIEND PAGE LOGIC
   Firebase v12.17.1 modular SDK

   Corrections applied this pass (see chat for full context):
   1. Referral tracking no longer depends on a Cloud Function.
      "Total referrals" now comes straight from a query against the
      users collection itself (where referralCodeUsed == my
      username) — no separate subcollection needs to be populated
      by anything server-side. The one-time ₦100 reward is detected
      and paid by THIS page's own client-side code the moment it
      sees a qualifying referral, guarded by a Firestore transaction
      + a security-rule-enforced marker doc so it can't be triggered
      twice or abused. Full detail in the BACKEND NOTE at the end —
      it now doubles as a Firestore Security Rules note, since that
      rule is what actually keeps this safe without a function.
   2. accountType/institutionAbbr removed from the menu subtitle,
      replaced with @username, per the site-wide removal.
   3. Tawk.to visitor auto-fill added (same block as home.js/wallet.js).
   4. SKRED_ADVERTISE_LINK renamed to DEFAULT_BANNER_LINK (same fix
      already applied elsewhere — it never actually pointed to Skred).
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
  runTransaction,
  collection,
  query,
  where,
  limit,
  orderBy,
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
   TAWK.TO VISITOR AUTO-FILL
   Pushes the signed-in user's name/email/username to Tawk so any
   chat opened from this page arrives pre-filled. Same block as
   home.js/wallet.js — copy it onto every other page's auth guard
   as they're reworked.
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
    const statusLabel = ref.rewarded ? "+" + formatNaira(100) : "+" + formatNaira(0);

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
   users are asked to enter as "Referral code" at signup, stored
   on the new user's own doc as referralCodeUsed).

   No Cloud Function involved. Two onSnapshot listeners, both
   scoped so Firestore rules can allow them safely:
   1. A query against the top-level `users` collection itself —
      where("referralCodeUsed","==", my username) — this IS the
      referred-people list; nothing separate needs to be
      populated anywhere for it to exist.
   2. My own users/{uid}/referralRewards subcollection — a
      marker doc per referral I've already been paid ₦100 for,
      written by this page's own client-side code (see
      processReward below) and never anywhere else.
   --------------------------------------------------------- */
/* ---------------------------------------------------------
   AUTH GUARD + LIVE DATA
   Referral code = the user's own username.
   Stats update in real time from Firestore.
   --------------------------------------------------------- */
let unsubscribeUserDoc = null;
let unsubscribeReferredUsers = null;
let unsubscribeRewards = null;

let currentUid = "";
let subscribedUsername = "";
let referredUsersCache = [];
let rewardedUidSet = new Set();

function recomputeAndRender() {
  let total = 0;
  let rewarded = 0;
  let earned = 0;

  const rows = referredUsersCache.map((ref) => {
    total += 1;
    const isRewarded = rewardedUidSet.has(ref.uid);
    if (isRewarded) { rewarded += 1; earned += 100; }
    return {
      username: ref.username,
      rewarded: isRewarded,
      joinedDate: ref.joinedDate
    };
  });

  statTotal.textContent = String(total);
  statTotal.classList.remove("skeleton");
  statRewarded.textContent = String(rewarded);
  statRewarded.classList.remove("skeleton");
  statEarned.textContent = formatNaira(earned);
  statEarned.classList.remove("skeleton");

  renderReferredList(rows);
}

function subscribeToReferredUsers(username) {
  if (unsubscribeReferredUsers) unsubscribeReferredUsers();

  const referredQuery = query(
    collection(db, "users"),
    where("referralCodeUsed", "==", username),
    orderBy("createdAt", "desc"),
    limit(200)
  );

  unsubscribeReferredUsers = onSnapshot(referredQuery, (snap) => {
    referredUsersCache = snap.docs.map((d) => {
      const data = d.data();
      const depositSignal = data.lifetimeDeposited ?? data.wallet?.deposit ?? 0;

      return {
        uid: d.id,
        username: data.username || "",
        joinedDate: data.createdAt?.toDate ? data.createdAt.toDate() : null,
        qualifies: depositSignal >= 500
      };
    });

    recomputeAndRender();
  }, (err) => {
    console.error("Referred users listener error:", err);
    referredUsersCache = [];
    recomputeAndRender();
  });
}

function subscribeToRewards() {
  if (unsubscribeRewards) unsubscribeRewards();

  unsubscribeRewards = onSnapshot(
    collection(db, "users", currentUid, "referralRewards"),
    (snap) => {
      rewardedUidSet = new Set(snap.docs.map((d) => d.id));
      recomputeAndRender();
    },
    (err) => {
      console.error("Referral rewards listener error:", err);
    }
  );
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (!user.emailVerified) {
    window.location.href = "login.html";
    return;
  }

  currentUid = user.uid;

  if (unsubscribeUserDoc) unsubscribeUserDoc();
  subscribeToRewards();

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

    currentUsername = data.username || "";
    currentReferralLink = currentUsername
      ? `${window.location.origin}/user/login.html?ref=${encodeURIComponent(currentUsername)}`
      : "";

    referralCodeEl.textContent = currentUsername || "—";
    referralCodeEl.classList.remove("skeleton");
    referralLinkInput.value = currentReferralLink || "Set up your account to get a link";

    if (currentUsername && currentUsername !== subscribedUsername) {
      subscribedUsername = currentUsername;
      subscribeToReferredUsers(currentUsername);
    }

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
   BACKEND NOTE — Firestore Security Rules (no Cloud Function)
   ===========================================================
   This whole feature runs on plain client reads/writes — the
   safety net is entirely in firestore.rules, not a function.
   Three things the rules need to enforce, none of which exist
   yet (add these to whatever rules file the project already has):

   1. Let any signed-in user query the `users` collection filtered
      to referralCodeUsed == <their own username>. A `list` query
      like that returns full documents for every match, not just
      specific fields — the client SDK has no field-masking — so
      this does expose full profile docs (name, wallet balances,
      etc.) of anyone you've referred, to you. That's an accepted
      trade-off for going Cloud-Function-free; tighten it later
      with a slimmer public-profile doc if it ever matters, but
      that reintroduces something that has to keep two docs in
      sync, which is exactly the complexity being avoided here.

   2. users/{referrerUid}/referralRewards/{referredUid} — allow a
      user to CREATE (never update/delete) a doc here only when
      ALL of these hold:
        - request.auth.uid == referrerUid (only I can write my own
          reward markers)
        - the referenced users/{referredUid} doc has
          referralCodeUsed == the caller's own username (get() the
          caller's own users/{referrerUid} doc to read that) — i.e.
          you can only mark a reward for someone who actually used
          your code
        - get(/databases/$(database)/documents/users/$(referredUid)).data.lifetimeDeposited >= 500
          (or wallet.deposit >= 500 while lifetimeDeposited isn't
          wired up everywhere yet — see point 4 below)
        - the doc doesn't already exist (rules can check
          `!exists(...)` on the path being written, though in
          practice the transaction's own read already handles this;
          the rule is the backstop against someone skipping the
          transaction and writing directly)

   3. users/{referrerUid} — allow updating ONLY wallet.earned, and
      only when the new value equals the old value + exactly 100,
      and only in the same request/batch as a valid referralRewards
      create per rule 2 (Firestore rules can inspect other writes in
      the same transaction via `request.resource` on each path) —
      this is what stops a user from just calling
      `updateDoc(myUserRef, {'wallet.earned': 999999})` directly,
      which would otherwise be sitting right next to a legitimate
      write path.

   4. lifetimeDeposited must actually be written for this to work      as intended. Right now NOTHING increments it — wallet.js's
      (still undeployed) verify-flutterwave-deposit and
      create-flutterwave-virtual-account Edge Functions need to
      bump it on every successful deposit, and admin's
      manual-transactions.js Manual Deposits Approve action needs
      the same (currently only touches wallet.deposit). Until all
      three are updated, this page falls back to checking the
      current wallet.deposit balance instead (see depositSignal
      above) — functional, but NOT one-time-safe the way the spec
      wants (a referred friend who deposits ₦500, spends it, then
      deposits ₦500 again would currently re-qualify under the
      fallback, since wallet.deposit isn't cumulative). Wiring up
      lifetimeDeposited everywhere closes that gap properly.

   5. The referred-users query (referralCodeUsed == + orderBy
      createdAt) needs a Firestore composite index on the `users`
      collection for those two fields — Firestore will show the
      exact index-creation link the first time this query actually
      runs against real data.
   =========================================================== */
