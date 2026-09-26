/* =========================================================
   TASKNOVA ADMIN — MANUAL TRANSACTIONS PAGE LOGIC
   Firebase v12.17.1 modular SDK
   ========================================================= */
import { applyAccessRestrictions } from "./restricted.js";
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
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getCountFromServer,
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

const PAGE_SIZE = 15;
const WALLET_LABELS = { deposit: "Deposit Balance", earned: "Earned Balance" };

/* ---------------------------------------------------------
   THEME (persists site-wide — same key used on every page)
   --------------------------------------------------------- */
const body = document.body;
const themeSwitch = document.getElementById("themeSwitch");
const themeIcon = document.getElementById("themeIcon");
const themeImages = document.querySelectorAll("[data-light][data-dark]");

function setTheme(theme, save = true) {
  const isDark = theme === "dark";
  body.classList.toggle("dark", isDark);
  themeImages.forEach((img) => { img.src = isDark ? img.dataset.dark : img.dataset.light; });
  if (themeIcon) themeIcon.className = isDark ? "bx bx-sun" : "bx bx-moon";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#03070e" : "#f7faff");
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
function updateHeader() { siteHeader.classList.toggle("scrolled", window.scrollY > 18); }
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
   TOAST
   --------------------------------------------------------- */
const toastEl = document.getElementById("toast");
const toastMsgEl = document.getElementById("toastMsg");
let toastTimer = null;

function showToast(message, type = "success") {
  clearTimeout(toastTimer);
  toastEl.className = "toast show " + (type === "error" ? "error" : "");
  toastEl.querySelector("i").className = type === "error" ? "bx bx-error-circle" : "bx bx-check-circle";
  toastMsgEl.textContent = message;
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
}

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */
function formatNaira(n) {
  return "₦" + (Number(n) || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// destinationBank is stored as the full admin bank-account object
// (settings.js: { id, bankName, accountNumber, accountName }), not a
// string — this is why "Sent to" rendered blank/[object Object] before.
function formatBankDetails(bank) {
  if (!bank || typeof bank !== "object" || !bank.bankName) return "—";
  const last4 = bank.accountNumber ? String(bank.accountNumber).slice(-4) : "";
  const acctName = bank.accountName ? ` (${escapeHtml(bank.accountName)})` : "";
  return `${escapeHtml(bank.bankName)}${last4 ? " •••" + escapeHtml(last4) : ""}${acctName}`;
}

const userCache = new Map();
async function getUserSummary(uid) {
  if (!uid) return { fullName: "Unknown user", username: "", accountType: "" };
  if (userCache.has(uid)) return userCache.get(uid);
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const summary = snap.exists()
      ? { fullName: snap.data().fullName || "TaskNOVA User", username: snap.data().username || "", accountType: snap.data().accountType || "" }
      : { fullName: "Deleted user", username: "", accountType: "" };
    userCache.set(uid, summary);
    return summary;
  } catch {
    return { fullName: "Unknown user", username: "", accountType: "" };
  }
}

async function findUserByUsername(username) {
  const snap = await getDocs(query(collection(db, "users"), where("username", "==", username), limit(1)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() };
}

/* ---------------------------------------------------------
   TABS
   --------------------------------------------------------- */
const tabButtons = document.querySelectorAll(".tnr-tab");
const panels = document.querySelectorAll(".tnr-panel");
const loadedTabs = new Set();

function activateTab(tab) {
  tabButtons.forEach((b) => { b.classList.toggle("active", b.dataset.tab === tab); b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false"); });
  panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === tab));
  if (!loadedTabs.has(tab)) {
    loadedTabs.add(tab);
    if (tab === "deposits") loadDeposits(true);
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

/* ===========================================================
   MANUAL DEPOSITS TAB
   Schema per wallet.js's own backend notes: manualDeposits/{id}:
   { uid, amount, fee, totalExpected, destinationBank, senderBank,
     senderName, status: "pending_review", createdAt }, mirrored at
   users/{uid}/transactions/{id} using the SAME doc id (assumption —
   see NOTES at the bottom).
   =========================================================== */
const depositState = { lastDoc: null, hasMore: true, isLoading: false, count: 0 };

async function loadDeposits(reset = false) {
  if (depositState.isLoading) return;
  if (reset) {
    Object.assign(depositState, { lastDoc: null, hasMore: true, isLoading: false, count: 0 });
    document.getElementById("listDeposits").innerHTML = `<div class="tc-skeleton"></div><div class="tc-skeleton"></div>`;
    document.getElementById("emptyDeposits").style.display = "none";
  }
  if (!depositState.hasMore) return;

  depositState.isLoading = true;
  const loadMoreBtn = document.getElementById("loadMoreDeposits");
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.disabled = true;

  try {
    const constraints = [where("status", "==", "pending_review"), orderBy("createdAt", "asc")];
    if (depositState.lastDoc) constraints.push(startAfter(depositState.lastDoc));
    constraints.push(limit(PAGE_SIZE));

    const snap = await getDocs(query(collection(db, "manualDeposits"), ...constraints));
    const listEl = document.getElementById("listDeposits");
    if (reset) listEl.innerHTML = "";

    if (snap.empty && depositState.count === 0) {
      document.getElementById("emptyDeposits").style.display = "flex";
      document.getElementById("metaDeposits").textContent = "No manual deposits waiting for review.";
      depositState.hasMore = false;
      loadMoreBtn.style.display = "none";
      return;
    }

    for (const docSnap of snap.docs) {
      listEl.appendChild(await renderDepositCard(docSnap.id, docSnap.data()));
    }

    depositState.count += snap.docs.length;
    depositState.lastDoc = snap.docs[snap.docs.length - 1] || depositState.lastDoc;
    depositState.hasMore = snap.docs.length === PAGE_SIZE;
    loadMoreBtn.style.display = depositState.hasMore ? "inline-flex" : "none";
    document.getElementById("metaDeposits").textContent = `${depositState.count} deposit${depositState.count === 1 ? "" : "s"} loaded`;
  } catch (err) {
    console.error("Load manual deposits error:", err);
    showToast("Couldn't load manual deposits. Please try again.", "error");
  } finally {
    depositState.isLoading = false;
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  }
}
document.getElementById("loadMoreDeposits")?.addEventListener("click", () => loadDeposits(false));

async function renderDepositCard(depositId, deposit) {
  const advertiser = await getUserSummary(deposit.uid);
  const fee = deposit.fee !== undefined ? deposit.fee : Math.max(0, (deposit.totalExpected || 0) - (deposit.amount || 0));
  const senderLine = deposit.senderBank
    ? `From ${escapeHtml(deposit.senderBank)}${deposit.senderName ? ", " + escapeHtml(deposit.senderName) : ""}`
    : "From —";

  const card = document.createElement("div");
  card.className = "rc-card";
  card.innerHTML = `
    <div class="rc-main">
      <div class="rc-content">
        <div class="rc-row1">
          <span class="rc-name">${escapeHtml(advertiser.fullName)}</span>
          <span class="rc-amount-wrap">
            <span class="rc-amount">${formatNaira(deposit.amount)}</span>
            <span class="rc-status" data-status hidden></span>
          </span>
        </div>
        <div class="rc-row2">
          <span><i class="bx bx-building-house"></i> ${formatBankDetails(deposit.destinationBank)}</span>
          <span class="rc-sep">•</span>
          <span>${senderLine}</span>
          <span class="rc-sep">•</span>
          <span>Sent ${formatNaira(deposit.totalExpected)} <span class="rc-fee">(Fee: ${formatNaira(fee)})</span></span>
        </div>
        <div class="rc-row3">Submitted ${formatDate(deposit.createdAt)}</div>
      </div>
      <div class="rc-actions" data-actions>
        <button type="button" class="rc-icon-btn approve" data-act="approve" title="Approve" aria-label="Approve deposit"><span class="btn-spinner"></span><i class="bx bx-check"></i></button>
        <button type="button" class="rc-icon-btn reject" data-act="reject-toggle" title="Reject" aria-label="Reject deposit"><i class="bx bx-x"></i></button>
      </div>
    </div>
    <div class="tc-decline-panel" id="rejectPanel-${depositId}"><div><div class="tc-decline-inner">
      <textarea id="rejectReason-${depositId}" placeholder="Reason (optional) — e.g. amount doesn't match, no matching transfer found…"></textarea>
      <div class="tc-actions">
        <button type="button" class="btn btn-ghost" data-act="reject-cancel">Cancel</button>
        <button type="button" class="btn btn-danger" data-act="reject-confirm"><span class="btn-spinner"></span><i class="bx bx-x-circle"></i><span class="btn-label">Confirm Reject</span></button>
      </div>
    </div></div></div>
  `;

  const rejectPanel = card.querySelector(`#rejectPanel-${depositId}`);
  card.querySelector('[data-act="approve"]').addEventListener("click", (e) => approveDeposit(depositId, deposit, fee, card, e.currentTarget));
  card.querySelector('[data-act="reject-toggle"]').addEventListener("click", () => rejectPanel.classList.add("show"));
  card.querySelector('[data-act="reject-cancel"]').addEventListener("click", () => rejectPanel.classList.remove("show"));
  card.querySelector('[data-act="reject-confirm"]').addEventListener("click", (e) => rejectDeposit(depositId, deposit, card, e.currentTarget));

  return card;
}

// Swaps the tick/cross icon column for a small status pill next to the
// amount — used both mid-flight ("busy") and for the final result.
function setCardStatus(card, label, type) {
  const actions = card.querySelector("[data-actions]");
  const status = card.querySelector("[data-status]");
  if (label) {
    actions.hidden = true;
    status.hidden = false;
    status.className = `rc-status ${type}`;
    status.innerHTML = type === "busy"
      ? `<span class="btn-spinner"></span>${escapeHtml(label)}`
      : `<i class="bx ${type === "approved" ? "bx-check-circle" : "bx-x-circle"}"></i>${escapeHtml(label)}`;
  } else {
    actions.hidden = false;
    status.hidden = true;
  }
}

async function findMirrorTransactionRef(uid, depositId) {
  const snap = await getDocs(query(collection(db, "users", uid, "transactions"), where("manualDepositId", "==", depositId), limit(1)));
  return snap.empty ? null : snap.docs[0].ref;
}

async function approveDeposit(depositId, deposit, fee, cardEl, btnEl) {
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  setCardStatus(cardEl, "Processing…", "busy");
  try {
    const depositRef = doc(db, "manualDeposits", depositId);
    const userRef = doc(db, "users", deposit.uid);
    const mirrorTxRef = await findMirrorTransactionRef(deposit.uid, depositId);
    if (!mirrorTxRef) throw new Error("Couldn't find this deposit's transaction record.");
    const advertiser = await getUserSummary(deposit.uid);

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("User account not found.");
      const balance = userSnap.data().wallet?.deposit ?? 0;
      const lifetimeDeposited = userSnap.data().lifetimeDeposited ?? 0;

      transaction.update(userRef, {
        "wallet.deposit": balance + (deposit.amount || 0),
        // Separate, never-decreasing counter — refer.js's one-time ₦100
        // referral reward is keyed off this, not the spendable balance
        // above, so every real deposit path has to touch it.
        lifetimeDeposited: lifetimeDeposited + (deposit.amount || 0)
      });
      transaction.update(depositRef, { status: "approved", resolvedAt: serverTimestamp() });
      transaction.update(mirrorTxRef, { status: "successful", direction: "credit" });

      if (fee > 0) {
        const ledgerRef = doc(collection(db, "platformLedger"));
        transaction.set(ledgerRef, {
          source: { uid: deposit.uid, name: advertiser.fullName, username: advertiser.username },
          reason: "Manual deposit fee",
          destination: { name: "TaskNOVA Revenue" },
          amount: fee,
          category: "manual_deposit",
          createdAt: serverTimestamp()
        });
      }
    });

    showToast("Deposit approved and credited.");
    setCardStatus(cardEl, "Approved", "approved");
    depositState.count = Math.max(0, depositState.count - 1);
    bumpCount("countDeposits", -1);
    setTimeout(() => animateOutAndRemove(cardEl), 850);
  } catch (err) {
    console.error("Approve deposit error:", err);
    showToast(err.message || "Couldn't approve this deposit. Please try again.", "error");
    setCardStatus(cardEl, null);
  } finally {
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

async function rejectDeposit(depositId, deposit, cardEl, btnEl) {
  const reason = document.getElementById(`rejectReason-${depositId}`)?.value.trim() || "";
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  setCardStatus(cardEl, "Processing…", "busy");
  try {
    const depositRef = doc(db, "manualDeposits", depositId);
    const mirrorTxRef = await findMirrorTransactionRef(deposit.uid, depositId);

    await updateDoc(depositRef, { status: "rejected", rejectionReason: reason || null, resolvedAt: serverTimestamp() });
    if (mirrorTxRef) await updateDoc(mirrorTxRef, { status: "rejected" });

    showToast("Deposit rejected — the wallet was left untouched.");
    setCardStatus(cardEl, "Rejected", "rejected");
    cardEl.querySelector(`#rejectPanel-${depositId}`)?.classList.remove("show");
    depositState.count = Math.max(0, depositState.count - 1);
    bumpCount("countDeposits", -1);
    setTimeout(() => animateOutAndRemove(cardEl), 850);
  } catch (err) {
    console.error("Reject deposit error:", err);
    showToast(err.message || "Couldn't reject this deposit. Please try again.", "error");
    setCardStatus(cardEl, null);
  } finally {
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

/* ===========================================================
   MANUAL CHANGES TAB
   =========================================================== */
let currentFetchedUser = null; // { uid, fullName, username, wallet }

const usernameInput = document.getElementById("usernameInput");
const mcSearchWrap = document.getElementById("mcSearchWrap");
const mcSuggest = document.getElementById("mcSuggest");
const mcSearchMsg = document.getElementById("mcSearchMsg");
const mcUserCard = document.getElementById("mcUserCard");

function showMcMsg(text, type) {
  mcSearchMsg.textContent = text;
  mcSearchMsg.className = `mc-msg ${type}`;
  mcSearchMsg.style.display = "block";
}
function clearMcMsg() {
  mcSearchMsg.style.display = "none";
}

function renderUserCard() {
  if (!currentFetchedUser) { mcUserCard.style.display = "none"; return; }
  const { fullName, username, wallet } = currentFetchedUser;
  document.getElementById("mcAvatar").textContent = (fullName || "?").trim().charAt(0).toUpperCase() || "?";
  document.getElementById("mcFullName").textContent = fullName || "—";
  document.getElementById("mcUsername").textContent = "@" + (username || "—");

  const depositEl = document.getElementById("mcDepositValue");
  const earnedEl = document.getElementById("mcEarnedValue");
  depositEl.textContent = formatNaira(wallet.deposit);
  depositEl.classList.toggle("negative", (wallet.deposit || 0) < 0);
  earnedEl.textContent = formatNaira(wallet.earned);
  earnedEl.classList.toggle("negative", (wallet.earned || 0) < 0);

  mcUserCard.style.display = "block";
}

function selectUser(found) {
  currentFetchedUser = {
    uid: found.uid,
    fullName: found.fullName || "TaskNOVA User",
    username: found.username,
    wallet: { deposit: found.wallet?.deposit ?? 0, earned: found.wallet?.earned ?? 0 }
  };
  closeAllMcPanels();
  renderUserCard();
  hideSuggestions();
}

// Exact-match fallback — used for Enter key and the ?username= prefill
// link (from User Details' "Wallet Edits" button), where the type-ahead
// dropdown was never opened.
async function loadUserByUsername(username) {
  username = username.trim();
  if (!username) { showMcMsg("Enter a username to search.", "error"); return; }
  clearMcMsg();
  mcSearchWrap.classList.add("loading");
  try {
    const found = await findUserByUsername(username);
    if (!found) {
      currentFetchedUser = null;
      renderUserCard();
      showMcMsg(`No user found with username "${username}".`, "error");
      return;
    }
    selectUser(found);
  } catch (err) {
    console.error("Fetch user error:", err);
    showMcMsg("Couldn't fetch that user. Please try again.", "error");
  } finally {
    mcSearchWrap.classList.remove("loading");
  }
}

/* ---------- LIVE SEARCH (type-ahead, no Fetch button) ---------- */
function hideSuggestions() {
  mcSuggest.classList.remove("show");
  mcSuggest.innerHTML = "";
}

function renderSuggestions(users) {
  if (!users.length) {
    mcSuggest.innerHTML = `<div class="mc-suggest-empty">No matching usernames.</div>`;
    mcSuggest.classList.add("show");
    return;
  }
  mcSuggest.innerHTML = users.map((u) => `
    <button type="button" class="mc-suggest-item" data-uid="${escapeHtml(u.uid)}">
      <span class="mc-suggest-avatar">${escapeHtml((u.fullName || "?").trim().charAt(0).toUpperCase() || "?")}</span>
      <span class="mc-suggest-info">
        <strong>${escapeHtml(u.fullName || "TaskNOVA User")}</strong>
        <span>@${escapeHtml(u.username || "—")}</span>
      </span>
    </button>
  `).join("");
  mcSuggest.querySelectorAll(".mc-suggest-item").forEach((btn, i) => {
    btn.addEventListener("click", () => {
      usernameInput.value = users[i].username || "";
      clearMcMsg();
      selectUser(users[i]);
    });
  });
  mcSuggest.classList.add("show");
}

let searchDebounce = null;
let searchToken = 0;

async function runLiveSearch(term) {
  const myToken = ++searchToken;
  mcSearchWrap.classList.add("loading");
  try {
    const snap = await getDocs(query(
      collection(db, "users"),
      orderBy("username"),
      where("username", ">=", term),
      where("username", "<=", term + "\uf8ff"),
      limit(6)
    ));
    if (myToken !== searchToken) return; // a newer keystroke already fired
    const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    renderSuggestions(users);
  } catch (err) {
    console.error("Live search error:", err);
  } finally {
    if (myToken === searchToken) mcSearchWrap.classList.remove("loading");
  }
}

usernameInput.addEventListener("input", () => {
  clearMcMsg();
  const term = usernameInput.value.trim();
  clearTimeout(searchDebounce);
  if (term.length < 2) {
    searchToken++; // invalidate any in-flight search
    hideSuggestions();
    mcSearchWrap.classList.remove("loading");
    return;
  }
  searchDebounce = setTimeout(() => runLiveSearch(term), 300);
});

usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { clearTimeout(searchDebounce); loadUserByUsername(usernameInput.value); }
  if (e.key === "Escape") hideSuggestions();
});

document.addEventListener("click", (e) => {
  if (!mcSearchWrap.contains(e.target) && !mcSuggest.contains(e.target)) hideSuggestions();
});

/* ---------------------------------------------------------
   INCREMENT / DECREMENT / TRANSFER — slide-out panels
   --------------------------------------------------------- */
const incrementPanel = document.getElementById("incrementPanel");
const decrementPanel = document.getElementById("decrementPanel");
const transferPanel = document.getElementById("transferPanel");

function closeAllMcPanels() {
  [incrementPanel, decrementPanel, transferPanel].forEach((p) => p.classList.remove("show"));
}

document.getElementById("incrementToggleBtn").addEventListener("click", () => {
  const wasOpen = incrementPanel.classList.contains("show");
  closeAllMcPanels();
  if (!wasOpen) incrementPanel.classList.add("show");
});
document.getElementById("decrementToggleBtn").addEventListener("click", () => {
  const wasOpen = decrementPanel.classList.contains("show");
  closeAllMcPanels();
  if (!wasOpen) decrementPanel.classList.add("show");
});
document.getElementById("transferToggleBtn").addEventListener("click", () => {
  const wasOpen = transferPanel.classList.contains("show");
  closeAllMcPanels();
  if (!wasOpen) transferPanel.classList.add("show");
});
document.querySelector('[data-act="cancel-increment"]').addEventListener("click", () => incrementPanel.classList.remove("show"));
document.querySelector('[data-act="cancel-decrement"]').addEventListener("click", () => decrementPanel.classList.remove("show"));
document.querySelector('[data-act="cancel-transfer"]').addEventListener("click", () => transferPanel.classList.remove("show"));

/* ---------- INCREMENT ---------- */
document.getElementById("incrementSubmitBtn").addEventListener("click", async (e) => {
  if (!currentFetchedUser) return;
  const walletKey = document.getElementById("incrementWallet").value;
  const amount = Number(document.getElementById("incrementAmount").value);
  const note = document.getElementById("incrementNote").value.trim();

  if (!amount || amount <= 0) { showToast("Enter a valid amount.", "error"); return; }

  const btn = e.currentTarget;
  btn.classList.add("loading");
  btn.disabled = true;
  try {
    const userRef = doc(db, "users", currentFetchedUser.uid);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) throw new Error("User account not found.");
      const current = snap.data().wallet?.[walletKey] ?? 0;
      transaction.update(userRef, { [`wallet.${walletKey}`]: current + amount });

      const txRef = doc(collection(db, "users", currentFetchedUser.uid, "transactions"));
      transaction.set(txRef, {
        type: "admin_adjustment",
        direction: "credit",
        title: note ? `Manual credit — ${note}` : "Manual balance adjustment",
        amount,
        balanceType: WALLET_LABELS[walletKey],
        status: "successful",
        createdAt: serverTimestamp()
      });
    });

    currentFetchedUser.wallet[walletKey] += amount;
    renderUserCard();
    showToast(`${formatNaira(amount)} added to ${WALLET_LABELS[walletKey]}.`);
    document.getElementById("incrementAmount").value = "";
    document.getElementById("incrementNote").value = "";
    incrementPanel.classList.remove("show");
  } catch (err) {
    console.error("Increment error:", err);
    showToast(err.message || "Couldn't complete that adjustment. Please try again.", "error");
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
});

/* ---------- DECREMENT ---------- */
document.getElementById("decrementSubmitBtn").addEventListener("click", async (e) => {
  if (!currentFetchedUser) return;
  const walletKey = document.getElementById("decrementWallet").value;
  const amount = Number(document.getElementById("decrementAmount").value);
  const note = document.getElementById("decrementNote").value.trim();

  if (!amount || amount <= 0) { showToast("Enter a valid amount.", "error"); return; }

  const btn = e.currentTarget;
  btn.classList.add("loading");
  btn.disabled = true;
  try {
    const userRef = doc(db, "users", currentFetchedUser.uid);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) throw new Error("User account not found.");
      const current = snap.data().wallet?.[walletKey] ?? 0;
      transaction.update(userRef, { [`wallet.${walletKey}`]: current - amount });

      const txRef = doc(collection(db, "users", currentFetchedUser.uid, "transactions"));
      transaction.set(txRef, {
        type: "admin_adjustment",
        direction: "debit",
        title: note ? `Manual debit — ${note}` : "Manual balance adjustment",
        amount,
        balanceType: WALLET_LABELS[walletKey],
        status: "successful",
        createdAt: serverTimestamp()
      });
    });

    currentFetchedUser.wallet[walletKey] -= amount;
    renderUserCard();
    showToast(`${formatNaira(amount)} deducted from ${WALLET_LABELS[walletKey]}.`);
    document.getElementById("decrementAmount").value = "";
    document.getElementById("decrementNote").value = "";
    decrementPanel.classList.remove("show");
  } catch (err) {
    console.error("Decrement error:", err);
    showToast(err.message || "Couldn't complete that adjustment. Please try again.", "error");
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
});

/* ---------- TRANSFER ---------- */
document.getElementById("transferSubmitBtn").addEventListener("click", async (e) => {
  if (!currentFetchedUser) return;
  const fromWallet = document.getElementById("transferFromWallet").value;
  const toWallet = document.getElementById("transferToWallet").value;
  const toUsername = document.getElementById("transferToUsername").value.trim();
  const amount = Number(document.getElementById("transferAmount").value);
  const note = document.getElementById("transferNote").value.trim();

  if (!toUsername) { showToast("Enter the recipient's username.", "error"); return; }
  if (!amount || amount <= 0) { showToast("Enter a valid amount.", "error"); return; }
  if (toUsername.toLowerCase() === currentFetchedUser.username?.toLowerCase()) {
    showToast("Recipient can't be the same as the sender.", "error");
    return;
  }

  const btn = e.currentTarget;
  btn.classList.add("loading");
  btn.disabled = true;
  try {
    const recipient = await findUserByUsername(toUsername);
    if (!recipient) throw new Error(`No user found with username "${toUsername}".`);

    const senderRef = doc(db, "users", currentFetchedUser.uid);
    const recipientRef = doc(db, "users", recipient.uid);

    await runTransaction(db, async (transaction) => {
      const senderSnap = await transaction.get(senderRef);
      const recipientSnap = await transaction.get(recipientRef);
      if (!senderSnap.exists()) throw new Error("Sender account not found.");
      if (!recipientSnap.exists()) throw new Error("Recipient account not found.");

      const senderBalance = senderSnap.data().wallet?.[fromWallet] ?? 0;
      const recipientBalance = recipientSnap.data().wallet?.[toWallet] ?? 0;

      transaction.update(senderRef, { [`wallet.${fromWallet}`]: senderBalance - amount });
      transaction.update(recipientRef, { [`wallet.${toWallet}`]: recipientBalance + amount });

      const senderTxRef = doc(collection(db, "users", currentFetchedUser.uid, "transactions"));
      transaction.set(senderTxRef, {
        type: "transfer",
        direction: "debit",
        title: note ? `Transfer to @${recipient.username} — ${note}` : `Transfer to @${recipient.username}`,
        amount,
        balanceType: WALLET_LABELS[fromWallet],
        status: "successful",
        createdAt: serverTimestamp()
      });

      const recipientTxRef = doc(collection(db, "users", recipient.uid, "transactions"));
      transaction.set(recipientTxRef, {
        type: "transfer",
        direction: "credit",
        title: note ? `Transfer from @${currentFetchedUser.username} — ${note}` : `Transfer from @${currentFetchedUser.username}`,
        amount,
        balanceType: WALLET_LABELS[toWallet],
        status: "successful",
        createdAt: serverTimestamp()
      });
    });

    currentFetchedUser.wallet[fromWallet] -= amount;
    renderUserCard();
    showToast(`${formatNaira(amount)} transferred to @${recipient.username}.`);
    document.getElementById("transferToUsername").value = "";
    document.getElementById("transferAmount").value = "";
    document.getElementById("transferNote").value = "";
    transferPanel.classList.remove("show");
  } catch (err) {
    console.error("Transfer error:", err);
    showToast(err.message || "Couldn't complete that transfer. Please try again.", "error");
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
});

/* ---------------------------------------------------------
   UI HELPERS
   --------------------------------------------------------- */
function animateOutAndRemove(cardEl) {
  cardEl.style.transition = "opacity .3s ease, transform .3s ease";
  cardEl.style.opacity = "0";
  cardEl.style.transform = "translateX(12px)";
  setTimeout(() => cardEl.remove(), 300);
}
function bumpCount(elId, delta) {
  const el = document.getElementById(elId);
  if (!el) return;
  const current = parseInt(el.textContent, 10);
  if (Number.isNaN(current)) return;
  el.textContent = String(Math.max(0, current + delta));
}

/* ---------------------------------------------------------
   TAB BADGE COUNT
   --------------------------------------------------------- */
async function loadCounts() {
  try {
    const snap = await getCountFromServer(query(collection(db, "manualDeposits"), where("status", "==", "pending_review")));
    document.getElementById("countDeposits").textContent = snap.data().count;
  } catch (err) {
    console.error("Load deposit count error:", err);
  }
}

/* ---------------------------------------------------------
   AUTH GUARD + URL PREFILL
   (?tab=manual-changes&username=… — reached from User Details'
   "Wallet Edits" button)
   --------------------------------------------------------- */
const userNameEl = document.getElementById("menuUserName");
const userTypeEl = document.getElementById("menuUserType");
const userAvatarEl = document.getElementById("menuUserAvatar");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    await applyAccessRestrictions({ auth, isFullPage: true });
  } catch (err) {
    // Execution stopped for support user
    return;
  }

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.exists() ? snap.data() : {};
    const fullName = data.fullName || "Admin";
    const initial = fullName.trim().charAt(0).toUpperCase() || "A";
    if (userNameEl) userNameEl.textContent = fullName;
    if (userTypeEl) userTypeEl.textContent = "Admin";
    if (userAvatarEl) userAvatarEl.textContent = initial;
  } catch (err) {
    console.error("Load admin profile error:", err);
  }

  loadCounts();

  const params = new URLSearchParams(window.location.search);
  const prefillUsername = params.get("username");
  const wantsChangesTab = params.get("tab") === "manual-changes";

  if (wantsChangesTab) {
    activateTab("changes");
    if (prefillUsername) {
      usernameInput.value = prefillUsername;
      loadUserByUsername(prefillUsername);
    }
  } else {
    loadedTabs.add("deposits");
    loadDeposits(true);
  }
});

/* ===========================================================
   NOTES
   ===========================================================
   - Admin identity read (users/{uid}) mirrors the same assumption
     flagged on every other admin page.

   - Manual Deposits' mirrored users/{uid}/transactions doc is found
     by querying for manualDepositId == depositId (limit 1) rather
     than assuming a shared doc ID — confirmed against wallet.js's
     actual deposit flow, which writes the mirror with its own
     auto-generated ID and stores the manualDeposits doc's ID on it
     as `manualDepositId` for exactly this kind of lookup. The
     lookup runs before the runTransaction (Firestore transactions
     can only read/write specific document references, not run
     queries), so Approve/Reject each do one query first, then use
     the resolved ref inside the transaction/update. If no matching
     transaction doc is found, Approve throws and stops (declining
     to touch the wallet without also being able to update the
     matching record); Reject proceeds anyway since leaving the
     wallet untouched is safe either way.

   - Approve credits wallet.deposit by `amount` (not totalExpected,
     matching wallet.js's own note that the difference is a ₦20
     transfer fee that stays with TaskNOVA) and logs that fee to
     platformLedger under category "manual_deposit" — one of two
     writers to the ledger now (post-advertisement.js's ad/banner
     purchase is the other). source.username is included alongside
     source.name so Finance's Revenue History can show "@username"
     per its spec, falling back to name for older/system entries.

   - Manual Changes' Increment/Decrement/Transfer intentionally do
     NOT write to platformLedger — these are wallet corrections,
     giveaways, or internal transfers, not new platform revenue.
     Flag if a specific adjustment should count as revenue; that'd
     need its own opt-in rather than logging every adjustment.

   - Transfer lets admin choose the wallet on both sides
     independently (e.g. move from one user's Deposit Balance into
     another user's Earned Balance) since the spec didn't restrict
     it — narrow this to deposit-to-deposit only if that's not
     actually wanted.

   - Both Decrement and Transfer's debit side allow the balance to
     go negative with no floor, consistent with how Increment/
     Decrement was already specified — same math applies to a
     transfer's sending side.

   - Manual Changes' username search now type-ahead: input is debounced
     (300ms, 2+ chars) into a prefix range query on `username`
     (>= term, <= term+"\uf8ff", limit 6), rendered as a picklist —
     no Fetch button/click required. Selecting a suggestion uses the
     doc data already returned by that query (no second read).
     Resolving a transfer recipient, and the Enter-key/?username=
     prefill fallback, still use the exact where("username","==",...)
     lookup with limit(1) — this assumes usernames are unique and
     requires a single-field index, which Firestore creates
     automatically. The prefix query needs the same index (range +
     orderBy on the same single field), also automatic.
   =========================================================== */
