/* =========================================================
   TASKNOVA ADMIN — DASHBOARD PAGE LOGIC
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
  onSnapshot,
  collection,
  query,
  where,
  getCountFromServer
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
   THEME (persists site-wide — same key used on every page,
   user and admin alike, so a preference set on one side
   carries over to the other)
   --------------------------------------------------------- */
const body = document.body;
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

themeSwitch?.addEventListener("click", () => {
  setTheme(body.classList.contains("dark") ? "light" : "dark");
});

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
   MENU GROUP ACCORDION (Users / Tasks / Advertising / Finance /
   Reports & Support / Administration) — only one group open at
   a time; tapping an open group's label closes it again.
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
    window.location.href = "login.html";
  } catch (err) {
    console.error("Logout failed:", err);
  }
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

/* ===========================================================
   AUTH GUARD — admin only.
   ASSUMPTION: users/{uid}.isAdmin === true marks an admin
   account, matching the accountType-style fields already used
   on the user side. If the existing admin login page checks
   something else (custom claims, a separate "admins" collection,
   etc.) let me know so every admin page can be aligned to it.
   =========================================================== */
const menuUserName = document.getElementById("menuUserName");
const menuUserAvatar = document.getElementById("menuUserAvatar");

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : {};

    if (!data.isAdmin) {
      window.location.href = "login.html";
      return;
    }

    currentUser = user;

    const fullName = data.fullName || "Admin";
    const initial = fullName.trim().charAt(0).toUpperCase() || "A";
    if (menuUserName) menuUserName.textContent = fullName;
    if (menuUserAvatar) menuUserAvatar.textContent = initial;

    loadDashboardData();
  } catch (err) {
    console.error("Admin auth check failed:", err);
    window.location.href = "login.html";
  }
});

/* ===========================================================
   TOTAL USERS + ACCOUNT BREAKDOWN
   =========================================================== */
const totalUsersValue = document.getElementById("totalUsersValue");
const breakdownDonut = document.getElementById("breakdownDonut");
const donutTotal = document.getElementById("donutTotal");
const breakdownLegend = document.getElementById("breakdownLegend");

function renderBreakdown({ students, teachers, none, total }) {
  const pct = (n) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

  const segments = [
    { label: "Students", count: students, color: "var(--primary)" },
    { label: "Teachers", count: teachers, color: "var(--veltrix)" },
    { label: "None", count: none, color: "var(--warning)" }
  ];

  let cursor = 0;
  const stops = segments.map((s) => {
    const share = total > 0 ? (s.count / total) * 100 : 0;
    const start = cursor;
    cursor += share;
    return `${s.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  }).join(", ");

  breakdownDonut.style.background = total > 0
    ? `conic-gradient(${stops})`
    : `conic-gradient(var(--line) 0 100%)`;

  donutTotal.textContent = total.toLocaleString("en-NG");

  breakdownLegend.innerHTML = segments.map((s) => `
    <div class="legend-row">
      <span class="legend-dot" style="background:${s.color}"></span>
      <span class="legend-label">${s.label}</span>
      <span class="legend-count">${s.count.toLocaleString("en-NG")}</span>
      <span class="legend-pct">${pct(s.count)}%</span>
    </div>
  `).join("");
}

async function loadTotalsAndBreakdown() {
  try {
    const usersRef = collection(db, "users");
    const [totalSnap, studentsSnap, teachersSnap] = await Promise.all([
      getCountFromServer(usersRef),
      getCountFromServer(query(usersRef, where("accountType", "==", "Student"))),
      getCountFromServer(query(usersRef, where("accountType", "==", "Teacher")))
    ]);

    const total = totalSnap.data().count;
    const students = studentsSnap.data().count;
    const teachers = teachersSnap.data().count;
    const none = Math.max(0, total - students - teachers);

    totalUsersValue.classList.remove("skeleton");
    totalUsersValue.textContent = total.toLocaleString("en-NG");

    renderBreakdown({ students, teachers, none, total });
  } catch (err) {
    console.error("Totals/breakdown load error:", err);
    totalUsersValue.classList.remove("skeleton");
    totalUsersValue.textContent = "—";
  }
}

/* ===========================================================
   TOTAL PROFIT — reads the same analytics/revenue doc the
   future Finance > Revenue tab will read/write. Never includes
   user wallet deposits, only actual platform earnings.
   =========================================================== */
const totalProfitValue = document.getElementById("totalProfitValue");

function listenRevenue() {
  onSnapshot(doc(db, "analytics", "revenue"), (snap) => {
    const data = snap.exists() ? snap.data() : {};
    const total = (data.taskFees || 0) + (data.adRevenue || 0) + (data.bannerRevenue || 0) + (data.other || 0);
    totalProfitValue.classList.remove("skeleton");
    totalProfitValue.textContent = formatNaira(total);
  }, (err) => {
    console.error("Revenue listener error:", err);
    totalProfitValue.classList.remove("skeleton");
    totalProfitValue.textContent = "—";
  });
}

/* ===========================================================
   SIGNUP GROWTH CHART — reads a precomputed
   analytics/signupsByMonth doc ({ "YYYY-MM": count, ... })
   rather than scanning the whole users collection on every
   dashboard load. See BACKEND NOTES at the bottom.
   =========================================================== */
const growthChartSvg = document.getElementById("growthChartSvg");
const growthChartLabels = document.getElementById("growthChartLabels");
const growthChartEmpty = document.getElementById("growthChartEmpty");

function renderGrowthChart(monthMap) {
  const entries = Object.entries(monthMap || {})
    .filter(([, count]) => typeof count === "number")
    .sort(([a], [b]) => a.localeCompare(b));

  if (!entries.length) {
    growthChartSvg.style.display = "none";
    growthChartLabels.innerHTML = "";
    growthChartEmpty.classList.add("show");
    return;
  }

  growthChartEmpty.classList.remove("show");
  growthChartSvg.style.display = "block";

  let running = 0;
  const points = entries.map(([month, count]) => {
    running += count;
    return { month, total: running };
  });

  const W = 600, H = 220, PAD_L = 6, PAD_R = 6, PAD_T = 14, PAD_B = 14;
  const maxVal = Math.max(...points.map((p) => p.total), 1);
  const stepX = points.length > 1 ? (W - PAD_L - PAD_R) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = PAD_L + stepX * i;
    const y = H - PAD_B - (p.total / maxVal) * (H - PAD_T - PAD_B);
    return { x, y, month: p.month, total: p.total };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${H - PAD_B} L${coords[0].x.toFixed(1)},${H - PAD_B} Z`;

  const dots = coords.map((c) => `
    <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3.2" class="gc-dot">
      <title>${c.month}: ${c.total.toLocaleString("en-NG")} signups</title>
    </circle>
  `).join("");

  growthChartSvg.innerHTML = `
    <defs>
      <linearGradient id="gcGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.35" />
        <stop offset="100%" stop-color="var(--primary)" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path d="${areaPath}" class="gc-area" fill="url(#gcGradient)"></path>
    <path d="${linePath}" class="gc-line"></path>
    ${dots}
  `;

  const maxLabels = 6;
  const labelEvery = Math.max(1, Math.ceil(coords.length / maxLabels));
  growthChartLabels.innerHTML = coords.map((c, i) => {
    if (i !== 0 && i !== coords.length - 1 && i % labelEvery !== 0) return "";
    const [y, m] = c.month.split("-");
    const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-NG", { month: "short", year: "2-digit" });
    return `<span style="left:${((c.x / W) * 100).toFixed(2)}%">${label}</span>`;
  }).join("");
}

function listenSignupGrowth() {
  onSnapshot(doc(db, "analytics", "signupsByMonth"), (snap) => {
    renderGrowthChart(snap.exists() ? snap.data() : {});
  }, (err) => {
    console.error("Signup growth listener error:", err);
    renderGrowthChart({});
  });
}

/* ---------------------------------------------------------
   Kick everything off once the admin check passes.
   --------------------------------------------------------- */
function loadDashboardData() {
  loadTotalsAndBreakdown();
  listenRevenue();
  listenSignupGrowth();
}

/* ===========================================================
   BACKEND NOTES (read before going live)
   ===========================================================
   This page never scans the full users collection for anything
   growth-related — it reads two small precomputed docs instead.
   Two things need to exist server-side:

   1. analytics/signupsByMonth — a single doc shaped like
      { "2026-01": 34, "2026-02": 51, ... }. A Cloud Function
      triggered on users/{uid} create should do:
        analytics/signupsByMonth.update({
          [currentYearMonth]: FieldValue.increment(1)
        })
      (with { merge: true } / setDoc so the first-ever signup of
      a new month creates the field instead of failing.)

   2. analytics/revenue — a single doc with fields
      { taskFees, adRevenue, bannerRevenue, other }, each
      incremented server-side at the moment real platform
      revenue is taken (a task fee deducted, an ad/banner
      package paid for) — never when a user deposits into their
      own wallet. This is the same doc the Finance > Revenue tab
      (admin page 5) will read and let an admin reconcile, so
      build it once and both pages stay in sync automatically.

   3. Total Users and the Student/Teacher/None breakdown use
      getCountFromServer (Firestore aggregation queries) instead
      of downloading every user document — cheap regardless of
      how large the users collection grows. accountType is
      assumed to be exactly "Student" or "Teacher" (matching
      what's already stored today); anything else, including a
      missing field, falls into "None".

   4. Admin auth guard assumes users/{uid}.isAdmin === true. If
      the admin login page already built uses a different check
      (custom claims, a separate admins/{uid} collection, etc.),
      tell me and I'll update this guard everywhere going forward
      instead of just here.
   =========================================================== */
