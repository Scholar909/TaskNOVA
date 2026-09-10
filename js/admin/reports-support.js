/* =========================================================
   TASKNOVA ADMIN — REPORTS & SUPPORT PAGE LOGIC
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
  updateDoc,
  collection,
  collectionGroup,
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

// TODO: replace with the real Skred link for banner-ad inquiries
// (mirrors the SKRED_ADVERTISE_LINK placeholder already used on the
// user side in home.js / advertisements.js).
const SKRED_LINK = "https://skred.example/tasknova-banner-ads";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PAGE_SIZE = 10;

document.getElementById("skredLink").href = SKRED_LINK;

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
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeMenu(); closeReportModal(); } });
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

const userCache = new Map();
async function getUserSummary(uid) {
  if (!uid) return { fullName: "Unknown user", username: "—" };
  if (userCache.has(uid)) return userCache.get(uid);
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const summary = snap.exists()
      ? { fullName: snap.data().fullName || "TaskNOVA User", username: snap.data().username || "—" }
      : { fullName: "Deleted user", username: "—" };
    userCache.set(uid, summary);
    return summary;
  } catch {
    return { fullName: "Unknown user", username: "—" };
  }
}

/* ---------------------------------------------------------
   TABS
   --------------------------------------------------------- */
const tabButtons = document.querySelectorAll(".tnr-tab");
const panels = document.querySelectorAll(".tnr-panel");
const loadedTabs = new Set();

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    tabButtons.forEach((b) => { b.classList.toggle("active", b === btn); b.setAttribute("aria-selected", b === btn ? "true" : "false"); });
    panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === tab));
    if (tab === "reports" && !loadedTabs.has("reports")) {
      loadedTabs.add("reports");
      loadReports(true);
    }
  });
});

/* ===========================================================
   REPORTS TAB
   Reads across every task's own "submissions" subcollection via
   a collectionGroup query, filtered to reported == true and
   reportStatus == "pending" — this is the same doc track-work.js
   already writes to (tasks/{taskId}/submissions/{workerUid}) when
   a worker disputes a decline, just queried across everyone.
   =========================================================== */
const reportState = { lastDoc: null, hasMore: true, isLoading: false, count: 0 };

async function loadReports(reset = false) {
  if (reportState.isLoading) return;
  if (reset) {
    Object.assign(reportState, { lastDoc: null, hasMore: true, isLoading: false, count: 0 });
    document.getElementById("listReports").innerHTML = `<div class="tc-skeleton"></div><div class="tc-skeleton"></div>`;
    document.getElementById("emptyReports").style.display = "none";
  }
  if (!reportState.hasMore) return;

  reportState.isLoading = true;
  const loadMoreBtn = document.getElementById("loadMoreReports");
  loadMoreBtn.classList.add("loading");
  loadMoreBtn.disabled = true;

  try {
    const constraints = [
      where("reported", "==", true),
      where("reportStatus", "==", "pending"),
      orderBy("reportedAt", "asc")
    ];
    if (reportState.lastDoc) constraints.push(startAfter(reportState.lastDoc));
    constraints.push(limit(PAGE_SIZE));

    const snap = await getDocs(query(collectionGroup(db, "submissions"), ...constraints));
    const listEl = document.getElementById("listReports");
    if (reset) listEl.innerHTML = "";

    if (snap.empty && reportState.count === 0) {
      document.getElementById("emptyReports").style.display = "flex";
      document.getElementById("metaReports").textContent = "No reports waiting for review.";
      reportState.hasMore = false;
      loadMoreBtn.style.display = "none";
      return;
    }

    for (const docSnap of snap.docs) {
      listEl.appendChild(await renderReportCard(docSnap));
    }

    reportState.count += snap.docs.length;
    reportState.lastDoc = snap.docs[snap.docs.length - 1] || reportState.lastDoc;
    reportState.hasMore = snap.docs.length === PAGE_SIZE;
    loadMoreBtn.style.display = reportState.hasMore ? "inline-flex" : "none";
    document.getElementById("metaReports").textContent = `${reportState.count} report${reportState.count === 1 ? "" : "s"} loaded`;
  } catch (err) {
    console.error("Load reports error:", err);
    showToast("Couldn't load reports. Please try again.", "error");
  } finally {
    reportState.isLoading = false;
    loadMoreBtn.classList.remove("loading");
    loadMoreBtn.disabled = false;
  }
}
document.getElementById("loadMoreReports")?.addEventListener("click", () => loadReports(false));

async function renderReportCard(docSnap) {
  const sub = docSnap.data();
  const taskId = docSnap.ref.parent.parent.id;
  const workerUid = docSnap.id;
  const worker = await getUserSummary(workerUid);

  const card = document.createElement("div");
  card.className = "report-card";
  card.innerHTML = `
    <div class="rc-top">
      <div class="rc-title">${escapeHtml(sub.taskTitle || "Task")}</div>
      <div class="rc-amount">${formatNaira(sub.amountPerWorker)}</div>
    </div>
    <div class="rc-names"><i class="bx bx-user"></i> Reported by ${escapeHtml(worker.fullName)}</div>
    <div class="rc-date">${formatDate(sub.reportedAt)}</div>
    <div class="rc-view"><span>View details</span><i class="bx bx-chevron-right"></i></div>
  `;
  card.addEventListener("click", () => openReportModal(taskId, workerUid, sub, card));
  return card;
}

/* ===========================================================
   REPORT DETAIL MODAL
   =========================================================== */
const reportModal = document.getElementById("reportModal");
const reportModalBackdrop = document.getElementById("reportModalBackdrop");
const reportModalClose = document.getElementById("reportModalClose");
const reportModalBody = document.getElementById("reportModalBody");

function openReportModalShell() {
  reportModal.classList.add("open");
  reportModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeReportModal() {
  reportModal.classList.remove("open");
  reportModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}
reportModalBackdrop.addEventListener("click", closeReportModal);
reportModalClose.addEventListener("click", closeReportModal);

async function openReportModal(taskId, workerUid, sub, cardEl) {
  reportModalBody.innerHTML = `<div class="tc-skeleton" style="height:200px;"></div>`;
  openReportModalShell();

  const [worker, taskSnap] = await Promise.all([
    getUserSummary(workerUid),
    getDoc(doc(db, "tasks", taskId))
  ]);
  const task = taskSnap.exists() ? taskSnap.data() : {};
  const employer = await getUserSummary(sub.employerUid || task.employerUid);

  const screenshots = sub.screenshotUrls || [];
  const proofHtml = screenshots.length
    ? screenshots.map((url) => `<img src="${escapeHtml(url)}" alt="" onclick="window.open('${escapeHtml(url)}','_blank')">`).join("")
    : `<span class="no-screenshots">No screenshots attached.</span>`;

  reportModalBody.innerHTML = `
    <div class="rd-section">
      <h4>Task</h4>
      <p><strong>${escapeHtml(sub.taskTitle || task.title || "Untitled task")}</strong></p>
      ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ""}
      ${task.instructions ? `<p><strong>Instructions:</strong> ${escapeHtml(task.instructions)}</p>` : ""}
      ${(task.proofRequirements || []).length ? `<div class="tc-proof-list">${task.proofRequirements.map((p) => `<span>${escapeHtml(p)}</span>`).join("")}</div>` : ""}
    </div>

    <div class="rd-section">
      <h4>People</h4>
      <div class="rd-people-flow">
        <div class="rd-people-row"><span class="rpr-role">Creator</span><strong>${escapeHtml(employer.fullName)}</strong>&nbsp;@${escapeHtml(employer.username)}</div>
        <div class="rd-people-arrow"><i class="bx bx-down-arrow-alt"></i></div>
        <div class="rd-people-row"><span class="rpr-role">Reporter</span><strong>${escapeHtml(worker.fullName)}</strong>&nbsp;@${escapeHtml(worker.username)}</div>
      </div>
    </div>

    <div class="rd-section">
      <h4>Submitted proof</h4>
      ${sub.textProof ? `<p>${escapeHtml(sub.textProof)}</p>` : ""}
      <div class="proof-gallery">${proofHtml}</div>
    </div>

    ${sub.declineReason ? `<div class="rd-section"><h4>Employer's decline reason</h4><p>${escapeHtml(sub.declineReason)}</p></div>` : ""}

    <div class="rd-section">
      <h4>The complaint</h4>
      <p>${escapeHtml(sub.reportReason || "—")}</p>
    </div>

    <div class="rd-actions">
      <button type="button" class="btn btn-success" data-act="approve-toggle"><i class="bx bx-check"></i><span class="btn-label">Approve</span></button>
      <button type="button" class="btn btn-danger" data-act="decline-toggle"><i class="bx bx-x"></i><span class="btn-label">Decline</span></button>
    </div>

    <div class="tc-decline-panel" id="approvePanel"><div><div class="tc-decline-inner">
      <div class="force-pay-flow">
        <div class="fpf-row"><span>Task creator</span>${escapeHtml(employer.fullName)} · @${escapeHtml(employer.username)}</div>
        <div class="fpf-arrow"><i class="bx bx-down-arrow-alt"></i></div>
        <div class="fpf-row"><span>Reporter (to be paid)</span>${escapeHtml(worker.fullName)} · @${escapeHtml(worker.username)}</div>
        <div class="fpf-row"><span>Force-pay amount</span><span class="fpf-amount">${formatNaira(sub.amountPerWorker)}</span></div>
      </div>
      <div class="tc-actions">
        <button type="button" class="btn btn-ghost" data-act="approve-cancel">Cancel</button>
        <button type="button" class="btn btn-success" id="forcePayBtn"><span class="btn-spinner"></span><i class="bx bx-money"></i><span class="btn-label">Force Pay</span></button>
      </div>
    </div></div></div>

    <div class="tc-decline-panel" id="declinePanel"><div><div class="tc-decline-inner">
      <textarea id="adminDeclineReason" placeholder="Required — explain why this report is being declined…"></textarea>
      <div class="tc-actions">
        <button type="button" class="btn btn-ghost" data-act="decline-cancel">Cancel</button>
        <button type="button" class="btn btn-danger" id="declineReportBtn" disabled><span class="btn-spinner"></span><i class="bx bx-x-circle"></i><span class="btn-label">Decline Report</span></button>
      </div>
    </div></div></div>
  `;

  const approvePanel = reportModalBody.querySelector("#approvePanel");
  const declinePanel = reportModalBody.querySelector("#declinePanel");

  reportModalBody.querySelector('[data-act="approve-toggle"]').addEventListener("click", () => { declinePanel.classList.remove("show"); approvePanel.classList.add("show"); });
  reportModalBody.querySelector('[data-act="approve-cancel"]').addEventListener("click", () => approvePanel.classList.remove("show"));
  reportModalBody.querySelector('[data-act="decline-toggle"]').addEventListener("click", () => { approvePanel.classList.remove("show"); declinePanel.classList.add("show"); });
  reportModalBody.querySelector('[data-act="decline-cancel"]').addEventListener("click", () => declinePanel.classList.remove("show"));

  const declineTextarea = reportModalBody.querySelector("#adminDeclineReason");
  const declineBtn = reportModalBody.querySelector("#declineReportBtn");
  declineTextarea.addEventListener("input", () => {
    declineBtn.disabled = declineTextarea.value.trim().length === 0;
  });

  reportModalBody.querySelector("#forcePayBtn").addEventListener("click", (e) => forcePayReport(taskId, workerUid, sub, cardEl, e.currentTarget));
  declineBtn.addEventListener("click", (e) => declineReport(taskId, workerUid, cardEl, e.currentTarget));
}

/* ---------------------------------------------------------
   ACTION — FORCE PAY (approve the report)
   Credits the worker's Earned Balance and flips the submission
   to "approved" — same outcome as a normal employer approval.
   No task-doc change needed: slotsFilled is incremented at
   submission time in earn.js, not at approval time, so a
   declined-then-force-paid submission was already counted.
   --------------------------------------------------------- */
async function forcePayReport(taskId, workerUid, sub, cardEl, btnEl) {
  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    const subRef = doc(db, "tasks", taskId, "submissions", workerUid);
    const userRef = doc(db, "users", workerUid);

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("Worker account not found.");
      const earned = userSnap.data().wallet?.earned ?? 0;

      transaction.update(userRef, { "wallet.earned": earned + (sub.amountPerWorker || 0) });
      transaction.update(subRef, {
        status: "approved",
        reportStatus: "approved",
        resolvedAt: serverTimestamp()
      });

      const txRef = doc(collection(db, "users", workerUid, "transactions"));
      transaction.set(txRef, {
        type: "task_payout",
        direction: "credit",
        title: `Report approved — payment for "${sub.taskTitle || "task"}"`,
        amount: sub.amountPerWorker || 0,
        status: "successful",
        createdAt: serverTimestamp()
      });
    });

    showToast("Force paid — the worker's report was upheld.");
    closeReportModal();
    animateOutAndRemove(cardEl);
    reportState.count = Math.max(0, reportState.count - 1);
    bumpCount("countReports", -1);
  } catch (err) {
    console.error("Force pay error:", err);
    showToast(err.message || "Couldn't force pay this report. Please try again.", "error");
  } finally {
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

/* ---------------------------------------------------------
   ACTION — DECLINE REPORT
   Submission stays "declined" (the employer's original call
   stands); this just resolves the report itself and gives the
   worker a second reason to read on their Declined tab.
   --------------------------------------------------------- */
async function declineReport(taskId, workerUid, cardEl, btnEl) {
  const reason = document.getElementById("adminDeclineReason").value.trim();
  if (!reason) return;

  btnEl.classList.add("loading");
  btnEl.disabled = true;
  try {
    await updateDoc(doc(db, "tasks", taskId, "submissions", workerUid), {
      reportStatus: "declined",
      adminDeclineReason: reason,
      resolvedAt: serverTimestamp()
    });

    showToast("Report declined — the employer's decision stands.");
    closeReportModal();
    animateOutAndRemove(cardEl);
    reportState.count = Math.max(0, reportState.count - 1);
    bumpCount("countReports", -1);
  } catch (err) {
    console.error("Decline report error:", err);
    showToast(err.message || "Couldn't decline this report. Please try again.", "error");
  } finally {
    btnEl.classList.remove("loading");
    btnEl.disabled = false;
  }
}

/* ---------------------------------------------------------
   UI HELPERS
   --------------------------------------------------------- */
function animateOutAndRemove(cardEl) {
  cardEl.style.transition = "opacity .3s ease, transform .3s ease";
  cardEl.style.opacity = "0";
  cardEl.style.transform = "translateY(8px)";
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
    const snap = await getCountFromServer(
      query(collectionGroup(db, "submissions"), where("reported", "==", true), where("reportStatus", "==", "pending"))
    );
    document.getElementById("countReports").textContent = snap.data().count;
  } catch (err) {
    console.error("Load report count error:", err);
  }
}

/* ---------------------------------------------------------
   AUTH GUARD
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
  loadedTabs.add("reports");
  loadReports(true);
});

/* ===========================================================
   NOTES
   ===========================================================
   - Admin identity read (users/{uid}) mirrors the same assumption
     flagged on every other admin page.

   - Reports reads across every task's "submissions" subcollection
     via a collectionGroup query (reported==true, reportStatus==
     "pending"), the exact doc track-work.js's report modal already
     writes to — no new schema introduced here. Needs a Firestore
     composite index on the "submissions" collection group for
     (reported ==, reportStatus ==, reportedAt asc); Firestore will
     surface the exact index-creation link on first real use.

   - Force Pay only credits the worker and flips the submission to
     "approved" — it does NOT touch the task doc or the employer's
     wallet. That's because earn.js increments task.slotsFilled at
     submission time (not at approval time), so a since-declined
     submission was already counted as a filled slot; and because
     the worker's payout comes out of the totalCost the employer
     already paid upfront when posting the task, not a fresh charge
     — Force Pay just releases money that's already sitting in
     escrow, same as a normal employer approval would.

   - The detail view opens as a modal (bottom sheet on mobile,
     centered dialog on wider screens) rather than a separate HTML
     page, to stay consistent with how every other admin tab on
     this build shows detail (inline expand/diff) instead of
     spinning up a new page per record — flagged as a conscious
     deviation from the spec's literal "detail page" wording.

   - Approve's three fields (creator id/username, reporter id/
     username, force-pay amount) are shown twice by design: once in
     the main "People" section for context, and again inside the
     Approve slide-out as a final read-only confirmation right
     before the Force Pay button, matching the spec's "slides out
     three non-editable fields... then a Force Pay button."

   - Decline's textarea gates the Decline button live via an input
     listener (disabled until non-empty), not just on click, per
     the spec's "must be filled before the Decline button
     activates."

   - Support tab is intentionally static — no custom ticket
     database, just two outbound links (Tawk.to's own dashboard,
     and Skred for banner-ad inquiries specifically) since offline
     tickets are handled entirely by Tawk.to itself (support.js's
     existing SUBMIT_TICKET_ENDPOINT / tickets@tasknova-support.
     p.tawk.email flow on the user side). SKRED_LINK at the top of
     this file is a placeholder — swap in the real Skred URL.
   =========================================================== */
