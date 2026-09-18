/* =========================================================
   TASKNOVA — HOME PAGE LOGIC
   Firebase v12.17.1 modular SDK

   Corrections applied:
   1. Tawk.to visitor auto-fill — once the signed-in user's name/
      email/username are known, they're pushed to Tawk so any
      chat started from this page (via the floating support
      button) arrives pre-filled.
   2. accountType / institutionAbbr removed from the menu
      subtitle — TaskNOVA no longer distinguishes Student/
      Teacher/None or tracks location, per the site-wide removal
      instruction. Shows the username instead.
   ========================================================= */
import { callEdgeFunction } from "../supabase.js";

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
  orderBy,
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
   NAIRA FORMATTER
   --------------------------------------------------------- */
const nairaFormat = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  minimumFractionDigits: 2
});

function formatNaira(amount) {
  return nairaFormat.format(Number(amount) || 0);
}

/* ---------------------------------------------------------
   RELATIVE TIME (for transaction rows)
   --------------------------------------------------------- */
function formatRelativeTime(date) {
  if (!date) return "";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

/* ---------------------------------------------------------
   TRANSACTION ICON PER TYPE
   --------------------------------------------------------- */
const TX_ICONS = {
  deposit: "bx-download",
  withdrawal: "bx-upload",
  earning: "bx-trending-up",
  task_payment: "bx-briefcase",
  swap: "bx-transfer-alt",
  referral: "bx-user-plus",
  refund: "bx-undo",
  default: "bx-receipt"
};

function renderTransactions(rows) {
  const txList = document.getElementById("txList");
  if (!txList) return;

  if (!rows.length) {
    txList.innerHTML = `<div class="tx-empty">No transactions yet. Your activity will show up here.</div>`;
    return;
  }

  txList.innerHTML = rows.map((tx) => {
    const kind = tx.direction === "credit" ? "credit" : tx.direction === "pending" ? "pending" : "debit";
    const icon = TX_ICONS[tx.type] || TX_ICONS.default;
    const sign = kind === "credit" ? "+" : kind === "pending" ? "" : "−";
    const when = formatRelativeTime(tx.date);

    return `
      <div class="tx-row ${kind}">
        <div class="tx-icon"><i class="bx ${icon}"></i></div>
        <div class="tx-info">
          <strong>${tx.title}</strong>
          <span>${when}${tx.status ? " · " + tx.status : ""}</span>
        </div>
        <div class="tx-amount">${sign}${formatNaira(tx.amount)}</div>
      </div>`;
  }).join("");
}

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

/* ===========================================================
   VELTRIX DATA & AIRTIME WIDGET
   The widget is Veltrix's own hosted checkout — it never touches
   TaskNOVA's Firestore or wallet, and never needs the Veltrix
   Secret API Key (that key is B2B-API-only and must stay
   server-side; the embeddable widget only needs the public
   partner ID, which is safe in frontend code).
   =========================================================== */

/* ===========================================================
   TASKNOVA DATA & AIRTIME UTILITY LOGIC
   =========================================================== */
const VELTRIX_PARTNER_ID = "536ba438-bfc9-4af7-9ef6-bf0103691ab8";

const PREFIXES = {
  mtn: ["0803","0806","0703","0706","0813","0816","0810","0814","0903","0906","0913","0916","0704"],
  airtel: ["0802","0808","0708","0812","0701","0902","0901","0904","0907","0912"],
  glo: ["0805","0807","0705","0815","0811","0905","0915"],
  "9mobile": ["0809","0817","0818","0909","0908"]
};

const NETWORK_IDS = { mtn: 1, airtel: 2, glo: 3, "9mobile": 4 };

let state = {
  phone: "",
  network: null,       // "mtn" | "airtel" | "glo" | "9mobile"
  netId: null,         // 1 | 2 | 3 | 4
  type: "airtime",     // "airtime" | "data"
  airtimeAmount: 0,
  selectedPlan: null,  // plan object from Veltrix
  plans: [],
  selectedPlanType: "SME"
};

function detectNetwork(phone) {
  if (phone.length < 4) return null;
  const prefix = phone.substring(0, 4);
  for (const [net, list] of Object.entries(PREFIXES)) {
    if (list.includes(prefix)) return net;
  }
  return null;
}

function initUtilityWidget() {
  const phoneInput = document.getElementById("vPhoneInput");
  const netBadge = document.getElementById("vNetBadge");
  const netBtns = document.querySelectorAll(".v-net-btn");
  const typeSelect = document.getElementById("vTypeSelect");
  const airtimeSection = document.getElementById("vAirtimeSection");
  const dataSection = document.getElementById("vDataSection");
  const airtimeInput = document.getElementById("vAirtimeAmount");
  const quickBtns = document.querySelectorAll(".v-quick-btn");
  const plansContainer = document.getElementById("vPlansContainer");
  const payBtn = document.getElementById("vPayBtn");
  const statusMsg = document.getElementById("vUtilityStatus");
  const form = document.getElementById("vUtilityForm");

  if (!phoneInput || !form) return;

  function setNetwork(netKey, isAuto = false) {
    state.network = netKey;
    state.netId = netKey ? NETWORK_IDS[netKey] : null;

    netBtns.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.network === netKey);
    });

    if (netBadge) {
      netBadge.textContent = netKey ? netKey.toUpperCase() : (isAuto ? "Auto" : "Select");
    }

    if (state.type === "data") {
      fetchPlans();
    } else {
      updatePayButton();
    }
  }

  phoneInput.addEventListener("input", (e) => {
    state.phone = e.target.value.trim();
    const detected = detectNetwork(state.phone);
    if (detected) {
      setNetwork(detected, true);
    } else if (state.phone.length < 4) {
      setNetwork(null, false);
    }
  });

  netBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      setNetwork(btn.dataset.network, false);
    });
  });

  typeSelect.addEventListener("change", (e) => {
    state.type = e.target.value;
    if (state.type === "airtime") {
      airtimeSection.style.display = "block";
      dataSection.style.display = "none";
    } else {
      airtimeSection.style.display = "none";
      dataSection.style.display = "block";
      fetchPlans();
    }
    updatePayButton();
  });

  airtimeInput.addEventListener("input", (e) => {
    state.airtimeAmount = parseFloat(e.target.value) || 0;
    updatePayButton();
  });

  quickBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const val = parseFloat(btn.dataset.amount);
      airtimeInput.value = val;
      state.airtimeAmount = val;
      updatePayButton();
    });
  });

  // Filter button event listeners
  const filterBtns = document.querySelectorAll(".v-type-btn");
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.selectedPlanType = btn.dataset.type;
      renderFilteredPlans();
    });
  });

  function formatDataSize(p) {
  let val = p.plan_name || p.name || p.plan || p.size || p.plan_size || p.volume || "";
  if (!val) return "Data Plan";
  
  val = String(val).trim();
  
  // Return as-is if unit is already present
  if (/(MB|GB|TB|KB)/i.test(val)) {
    return val;
  }
  
  // Format numeric values missing units
  const num = parseFloat(val);
  if (!isNaN(num)) {
    return num >= 10 ? `${num} MB` : `${num} GB`;
  }
  
  return val;
}


  function renderFilteredPlans() {
  if (!state.plans.length) return;

  const filtered = state.plans.filter((p) => {
    const pType = String(p.plantype || p.plan_type || "").toLowerCase().replace(/[\s_]+/g, "");
    const targetType = state.selectedPlanType.toLowerCase().replace(/[\s_]+/g, "");
    return pType.includes(targetType) || targetType.includes(pType);
  });

  if (!filtered.length) {
    plansContainer.innerHTML = `<div class="v-plans-state">No ${state.selectedPlanType} plans available for this network.</div>`;
    state.selectedPlan = null;
    updatePayButton();
    return;
  }

  plansContainer.innerHTML = filtered.map((p) => {
    const sizeDisplay = formatDataSize(p);
    const isSelected = state.selectedPlan && String(state.selectedPlan.id) === String(p.id);

    return `
      <div class="v-plan-card ${isSelected ? "selected" : ""}" data-plan-id="${p.id}">
        <div class="v-plan-info">
          <strong>${sizeDisplay}</strong>
          <span>Validity: ${p.validity || p.month_validate || "N/A"}</span>
        </div>
        <div class="v-plan-price">₦${Number(p.amount).toLocaleString()}</div>
      </div>
    `;
  }).join("");

  plansContainer.querySelectorAll(".v-plan-card").forEach((card) => {
    card.addEventListener("click", () => {
      plansContainer.querySelectorAll(".v-plan-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      const planId = card.dataset.planId;
      state.selectedPlan = state.plans.find((p) => String(p.id) === String(planId));
      updatePayButton();
    });
  });
}


  async function fetchPlans() {
    if (!state.network) {
      plansContainer.innerHTML = `<div class="v-plans-state">Select network provider first.</div>`;
      return;
    }

    plansContainer.innerHTML = `<div class="v-plans-state">Loading plans...</div>`;
    state.selectedPlan = null;
    updatePayButton();

    try {
      const data = await callEdgeFunction("buy-utility?action=get-plans");
      if (data.error) throw new Error(data.error);

      const netPlans = data.filter(
        (p) => p.network === state.netId || p.network_name?.toLowerCase() === state.network
      );

      if (!netPlans.length) {
        plansContainer.innerHTML = `<div class="v-plans-state">No plans available for this network.</div>`;
        return;
      }

      state.plans = netPlans;
      renderFilteredPlans();
    } catch (err) {
      plansContainer.innerHTML = `<div class="v-plans-state">Error fetching plans. Try again.</div>`;
    }
  }


  function updatePayButton() {
    if (state.type === "airtime") {
      if (state.phone.length === 11 && state.network && state.airtimeAmount >= 50) {
        // Airtime receives 5% markup for TaskNOVA
        const totalPayable = state.airtimeAmount * 1.05;
        payBtn.disabled = false;
        payBtn.textContent = `Pay ₦${totalPayable.toFixed(2)}`;
      } else {
        payBtn.disabled = true;
        payBtn.textContent = `Pay ₦0.00`;
      }
    } else {
      if (state.phone.length === 11 && state.network && state.selectedPlan) {
        // Data plan price already incorporates Veltrix partner markup
        payBtn.disabled = false;
        payBtn.textContent = `Pay ₦${Number(state.selectedPlan.amount).toLocaleString()}`;
      } else {
        payBtn.disabled = true;
        payBtn.textContent = `Pay ₦0.00`;
      }
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (payBtn.disabled) return;

    payBtn.disabled = true;
    payBtn.textContent = "Processing...";
    statusMsg.style.display = "none";

    try {
      // UPDATED CODE
const user = auth.currentUser;
if (!user) throw new Error("User session expired. Please refresh and log in.");

const idToken = await user.getIdToken();

const payload = {
  type: state.type,
  network: state.type === "data" ? state.netId : state.network,
  phone: state.phone,
  amount: state.airtimeAmount,
  plan_id: state.selectedPlan ? state.selectedPlan.id : null
};

const res = await callEdgeFunction("buy-utility", payload, idToken);

      if (res.error) throw new Error(res.error);

      statusMsg.className = "v-status-msg success";
      statusMsg.textContent = res.message || "Purchase successful!";
      statusMsg.style.display = "block";
      
      form.reset();
      state.selectedPlan = null;
      setNetwork(null);
      updatePayButton();

    } catch (err) {
      statusMsg.className = "v-status-msg error";
      statusMsg.textContent = err.message || "Transaction failed. Please try again.";
      statusMsg.style.display = "block";
    } finally {
      payBtn.disabled = false;
      updatePayButton();
    }
  });
}

// Call init inside DOM loads / auth state ready
document.addEventListener("DOMContentLoaded", initUtilityWidget);


// The widget auto-binds itself to any element carrying the
// data-veltrix-open attribute (home.html's "Buy Now" button already
// has it), including ones added after the script loads.

/* ===========================================================
   TAWK.TO VISITOR AUTO-FILL
   Pushes the signed-in user's name/email/username to Tawk so any
   chat opened from this page arrives pre-filled instead of asking
   for them again.
   =========================================================== */
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

/* ---------------------------------------------------------
   AUTH GUARD + LIVE WALLET DATA
   --------------------------------------------------------- */
const depositValueEl = document.getElementById("depositValue");
const earnedValueEl = document.getElementById("earnedValue");
const outstandingBanner = document.getElementById("outstandingBanner");
const outstandingText = document.getElementById("outstandingText");
const userNameEl = document.getElementById("menuUserName");
const userTypeEl = document.getElementById("menuUserType");
const userAvatarEl = document.getElementById("menuUserAvatar");
const alertDot = document.getElementById("alertDot");
const greetingName = document.getElementById("greetingName");

let unsubscribeUserDoc = null;
let unsubscribeTx = null;
let tawkSynced = false;

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
  if (unsubscribeTx) unsubscribeTx();

  unsubscribeUserDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    const firstName = (data.fullName || "there").split(" ")[0];
    if (greetingName) greetingName.textContent = firstName;
    if (userNameEl) userNameEl.textContent = data.fullName || user.email;
    if (userTypeEl) userTypeEl.textContent = data.username ? "@" + data.username : user.email;
    if (userAvatarEl) userAvatarEl.textContent = (data.fullName || "T").trim().charAt(0).toUpperCase();

    const deposit = data.wallet?.deposit ?? 0;
    const earned = data.wallet?.earned ?? 0;

    if (depositValueEl) {
      depositValueEl.classList.remove("skeleton");
      depositValueEl.textContent = formatNaira(deposit);
    }
    if (earnedValueEl) {
      earnedValueEl.classList.remove("skeleton");
      earnedValueEl.textContent = formatNaira(earned);
    }

    const outstanding = data.outstanding ?? 0;
    if (outstanding > 0) {
      outstandingBanner.classList.add("show");
      outstandingText.textContent = `You have an outstanding balance of ${formatNaira(outstanding)}. This is deducted automatically from your next deposit.`;
    } else {
      outstandingBanner.classList.remove("show");
    }

    if (!tawkSynced) {
      tawkSynced = true;
      syncTawkVisitor({ fullName: data.fullName, email: user.email, username: data.username });
    }
  }, (err) => {
    console.error("Wallet listener error:", err);
  });

  const txQuery = query(
    collection(db, "users", user.uid, "transactions"),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  unsubscribeTx = onSnapshot(txQuery, (snap) => {
    const rows = snap.docs.map((d) => {
      const data = d.data();
      return {
        title: data.title || data.type || "Transaction",
        type: data.type || "default",
        direction: data.direction || "debit",
        amount: data.amount || 0,
        status: data.status || "",
        date: data.createdAt?.toDate ? data.createdAt.toDate() : null
      };
    });
    renderTransactions(rows);
  }, (err) => {
    console.error("Transactions listener error:", err);
    renderTransactions([]);
  });

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
