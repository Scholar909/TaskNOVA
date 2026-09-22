import { doc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

const sessionStartTime = Date.now();

/**
 * Monitors systemLock in Firestore and forces logout across user pages when triggered.
 * @param {Object} db - Firestore instance
 * @param {Object} auth - Firebase Auth instance
 * @param {Object} user - Currently authenticated user
 */
export function initAuthGuard(db, auth, user) {
  if (!user || !db || !auth) return;

  onSnapshot(doc(db, "settings", "systemLock"), async (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    // 1. Exempt Admin/Staff accounts from being kicked out
    try {
      const staffSnap = await getDoc(doc(db, "staffAccounts", user.uid));
      if (staffSnap.exists()) return;
    } catch (err) {
      console.error("Auth guard staff check error:", err);
    }

    // 2. Force Logout Check
    let shouldLogout = false;
    if (data.forceLogoutAt) {
      const forceLogoutTime = data.forceLogoutAt.toDate
        ? data.forceLogoutAt.toDate().getTime()
        : new Date(data.forceLogoutAt).getTime();

      const lastSessionClear = parseInt(
        localStorage.getItem("tasknova_last_force_logout") || "0",
        10
      );

      if (forceLogoutTime > sessionStartTime && forceLogoutTime > lastSessionClear) {
        localStorage.setItem("tasknova_last_force_logout", forceLogoutTime.toString());
        shouldLogout = true;
      }
    }

        // 3. Active System Lock Check
    if (data.locked) {
      shouldLogout = true;
    }

    // 4. Execute Sign Out and Redirect
    if (shouldLogout) {
      const msg = data.message || "System is undergoing maintenance. Please check back shortly.";
      localStorage.setItem("tasknova_lock_message", msg);
      await signOut(auth);
      window.location.href = `login.html?maintenance=true&msg=${encodeURIComponent(msg)}`;
    }
  });

  // 5. User Account Block Check (Real-time monitoring)
  onSnapshot(doc(db, "users", user.uid), async (userSnap) => {
    if (!userSnap.exists()) return;
    const userData = userSnap.data();
    if (userData.blocked === true) {
      await signOut(auth);
      window.location.href = `login.html?reason=blocked`;
    }
  });
}
