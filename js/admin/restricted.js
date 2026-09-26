/* =========================================================
   TASKNOVA ADMIN — ACCESS CONTROL & RESTRICTION UTILITY
   restricted.js
   ========================================================= */

import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

/**
   HOW TO ADD OR EDIT RESTRICTED AREAS IN THIS FILE:
   -------------------------------------------------
   1. Page-level restrictions (e.g., finance.html):
      Call `applyAccessRestrictions({ isFullPage: true })` inside onAuthStateChanged.
      If the user is 'support', the entire body content will be replaced by a centered 
      responsive text "Access restricted".

   2. Hidden elements/tabs (e.g., hiding a tab or button):
      Pass an array of CSS selectors to `hideSelectors`.
      Example: `applyAccessRestrictions({ hideSelectors: ['[data-tab="reports"]', '#reportsTab'] })`

   3. Custom container restriction (e.g., replacing a specific div with text):
      Pass an array of CSS selectors to `restrictContainers`.
      Example: `applyAccessRestrictions({ restrictContainers: ['#reportsSection'] })`
*/

export async function applyAccessRestrictions({
  auth,
  isFullPage = false,
  hideSelectors = [],
  restrictContainers = []
} = {}) {
  const user = auth.currentUser;
  if (!user) return { isSupport: false, role: null };

  const db = getFirestore();
  let role = "admin";

  try {
    const snap = await getDoc(doc(db, "staffAccounts", user.uid));
    if (snap.exists()) {
      role = snap.data().role || "admin";
    }
  } catch (err) {
    console.error("Error reading staff role in restricted.js:", err);
  }

  const isSupport = role === "support";

  if (isSupport) {
    // 1. FULL PAGE RESTRICTION
    if (isFullPage) {
      document.body.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          width: 100%;
          margin: 0;
          padding: 20px;
          box-sizing: border-box;
          font-family: inherit;
          font-size: 1.125rem;
          font-weight: 600;
          color: #53627a;
          text-align: center;
        ">
          Access restricted
        </div>
      `;
      // Stop further execution on the page if full page is blocked
      throw new Error("Access Restricted: User is support.");
    }

    // 2. HIDE TABS OR SPECIFIC ELEMENTS
    hideSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        el.style.display = "none";
        el.setAttribute("aria-hidden", "true");
        el.setAttribute("disabled", "true");
      });
    });

    // 3. RESTRICT SPECIFIC CONTAINERS/SECTIONS (Replace container HTML with plain text)
    restrictContainers.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        el.innerHTML = `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            width: 100%;
            box-sizing: border-box;
            font-size: 1rem;
            font-weight: 600;
            color: #53627a;
            text-align: center;
          ">
            Access restricted
          </div>
        `;
      });
    });
  }

  return { isSupport, role };
}
