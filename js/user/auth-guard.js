import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
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

  onSnapshot(doc(db, "settings", "systemLock"), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

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
        if (data.message) {
          localStorage.setItem("tasknova_lock_message", data.message);
        }
        signOut(auth).then(() => {
          window.location.href = "login.html?reason=maintenance";
        });
      }
    }
  });
}
