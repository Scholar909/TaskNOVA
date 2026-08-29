/* =========================================================
   TASKNOVA — POST ADVERTISEMENT PAGE LOGIC
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
  where,
  limit,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";


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
const storage = getStorage(app);


/* ---------------------------------------------------------
   THEME
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

  if (themeIcon) {
    themeIcon.className = isDark ? "bx bx-sun" : "bx bx-moon";
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", isDark ? "#03070e" : "#f7faff");

  if (save) {
    localStorage.setItem("tasknova-theme", theme);
  }
}

const savedTheme = localStorage.getItem("tasknova-theme");

if (savedTheme === "dark" || savedTheme === "light") {
  setTheme(savedTheme, false);
} else {
  setTheme(
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light",
    false
  );
}

function toggleTheme() {
  setTheme(
    body.classList.contains("dark")
      ? "light"
      : "dark"
  );
}

themeToggle?.addEventListener("click", toggleTheme);
themeSwitch?.addEventListener("click", toggleTheme);


/* ---------------------------------------------------------
   HEADER SCROLL SHADOW
   --------------------------------------------------------- */

const siteHeader = document.getElementById("siteHeader");

function updateHeader() {
  siteHeader.classList.toggle(
    "scrolled",
    window.scrollY > 18
  );
}

updateHeader();

window.addEventListener("scroll", updateHeader, {
  passive: true
});


/* ---------------------------------------------------------
   SCROLL REVEALS
   --------------------------------------------------------- */

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          obs.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.08,
      rootMargin: "0px 0px -30px 0px"
    }
  );

  revealItems.forEach((item) => {
    observer.observe(item);
  });
} else {
  revealItems.forEach((item) => {
    item.classList.add("visible");
  });
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

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeMenu();
  }
});

mobileMenu
  ?.querySelectorAll("a")
  .forEach((link) => {
    link.addEventListener("click", closeMenu);
  });


/* ---------------------------------------------------------
   MENU GROUP ACCORDION
   --------------------------------------------------------- */

const menuGroups = document.querySelectorAll(".menu-group");

menuGroups.forEach((group) => {
  const label = group.querySelector(".menu-group-label");

  label?.addEventListener("click", () => {
    const isOpen = group.classList.contains("open");

    menuGroups.forEach((g) => {
      g.classList.remove("open");
    });

    if (!isOpen) {
      group.classList.add("open");
    }
  });
});


/* ---------------------------------------------------------
   LOGOUT
   --------------------------------------------------------- */

document
  .getElementById("logoutBtn")
  ?.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "../index.html";
    } catch (err) {
      console.error("Logout failed:", err);
    }
  });


/* ---------------------------------------------------------
   DEFAULT AD ELEMENTS
   --------------------------------------------------------- */

document
  .querySelectorAll("[data-default-ad]")
  .forEach((el) => {
    el.addEventListener("click", () => {
      document
        .getElementById("postAdForm")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    });
  });


/* ---------------------------------------------------------
   FLOATING AD + FLOATING SUPPORT
   --------------------------------------------------------- */

function makeDraggable(el, storageKey, defaults) {
  const saved =
    JSON.parse(
      localStorage.getItem(storageKey) || "null"
    ) || defaults;

  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.left = saved.left + "px";
  el.style.top = saved.top + "px";

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;
  let moved = false;

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

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

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      moved = true;
    }

    const maxLeft =
      window.innerWidth - el.offsetWidth - 8;

    const maxTop =
      window.innerHeight - el.offsetHeight - 8;

    const newLeft = clamp(
      startLeft + dx,
      8,
      maxLeft
    );

    const newTop = clamp(
      startTop + dy,
      8,
      maxTop
    );

    el.style.left = newLeft + "px";
    el.style.top = newTop + "px";
  }

  function onPointerUp() {
    if (!dragging) return;

    dragging = false;

    const rect = el.getBoundingClientRect();

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        left: rect.left,
        top: rect.top
      })
    );

    if (moved) {
      el._suppressClick = true;

      setTimeout(() => {
        el._suppressClick = false;
      }, 50);
    }
  }

  el.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  el.addEventListener("click", (e) => {
    if (el._suppressClick) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  window.addEventListener("resize", () => {
    const rect = el.getBoundingClientRect();

    const maxLeft =
      window.innerWidth - el.offsetWidth - 8;

    const maxTop =
      window.innerHeight - el.offsetHeight - 8;

    el.style.left =
      clamp(rect.left, 8, maxLeft) + "px";

    el.style.top =
      clamp(rect.top, 8, maxTop) + "px";
  });
}

const floatingAd =
  document.getElementById("floatingAd");

const supportFab =
  document.getElementById("supportFab");

if (floatingAd) {
  const adDefaultTop =
    window.innerHeight - 260;

  const adDefaultLeft =
    window.innerWidth - 112;

  makeDraggable(
    floatingAd,
    "tasknova-float-ad-pos",
    {
      left: adDefaultLeft,
      top: adDefaultTop
    }
  );
}

if (supportFab) {
  const supportDefaultTop =
    window.innerHeight - 160;

  const supportDefaultLeft =
    window.innerWidth - 96;

  makeDraggable(
    supportFab,
    "tasknova-float-support-pos",
    {
      left: supportDefaultLeft,
      top: supportDefaultTop
    }
  );
}

document
  .getElementById("floatingAdClose")
  ?.addEventListener("click", (e) => {
    e.stopPropagation();

    floatingAd.style.display = "none";
  });

supportFab?.addEventListener("click", (e) => {
  e.preventDefault();

  if (
    window.Tawk_API &&
    typeof Tawk_API.toggle === "function"
  ) {
    Tawk_API.toggle();
  }
});


/* ---------------------------------------------------------
   AD PACKAGES
   --------------------------------------------------------- */

const AD_PACKAGES = {
  starter: {
    label: "Starter (3 days)",
    duration: 3,
    items: [
      { views: 50, price: 150 },
      { views: 100, price: 250 },
      { views: 250, price: 450 },
      { views: 500, price: 750 }
    ]
  },

  standard: {
    label: "Standard (7 days)",
    duration: 7,
    items: [
      { views: 100, price: 300 },
      { views: 250, price: 550 },
      { views: 500, price: 900 },
      { views: 1000, price: 1500 },
      { views: 2500, price: 3000 }
    ]
  },

  extended: {
    label: "Extended (14 days)",
    duration: 14,
    items: [
      { views: 250, price: 700 },
      { views: 500, price: 1100 },
      { views: 1000, price: 1800 },
      { views: 2500, price: 3500 },
      { views: 5000, price: 6000 }
    ]
  }
};

const BANNER_PACKAGE = {
  label: "Banner (30 days)",
  duration: 30,
  items: [
    { views: 500, price: 1500 },
    { views: 1000, price: 2500 },
    { views: 2500, price: 4500 },
    { views: 5000, price: 7500 },
    { views: 10000, price: 12000 }
  ]
};

const MAX_BANNER_SLOTS = 3;


/* ---------------------------------------------------------
   BANNER MEDIA REQUIREMENTS
   --------------------------------------------------------- */

const BANNER_MAX_FILE_SIZE =
  2 * 1024 * 1024;

const BANNER_MAX_VIDEO_DURATION = 15;

/*
 * 720p means a maximum vertical resolution
 * of 720 pixels.
 *
 * The banner itself must remain 3:1.
 *
 * Therefore:
 * 2160 × 720 = valid 3:1
 * 1500 × 500 = valid 3:1
 * 1200 × 400 = valid 3:1
 *
 * 1280 × 720 = NOT valid because it is 16:9.
 */
const BANNER_MAX_HEIGHT = 720;

const BANNER_RATIO = 3;

const BANNER_RATIO_TOLERANCE = 0.01;


/* ---------------------------------------------------------
   FORMAT HELPERS
   --------------------------------------------------------- */

const nairaFormat = new Intl.NumberFormat(
  "en-NG",
  {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0
  }
);

function formatNaira(amount) {
  return nairaFormat.format(
    Number(amount) || 0
  );
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(0)} KB`;
  }

  return `${(
    bytes / (1024 * 1024)
  ).toFixed(2)} MB`;
}


/* ---------------------------------------------------------
   DOM REFS — PACK SELECTION
   --------------------------------------------------------- */

const adDurationSelect =
  document.getElementById("adDuration");

const adPackSelect =
  document.getElementById("adPack");

const packPreview =
  document.getElementById("packPreview");

const pvViews =
  document.getElementById("pvViews");

const pvDuration =
  document.getElementById("pvDuration");

const pvPrice =
  document.getElementById("pvPrice");

const bannerPackSelect =
  document.getElementById("bannerPack");

const bannerSlotNote =
  document.getElementById("bannerSlotNote");

const adTitleInput =
  document.getElementById("adTitle");

const adDescriptionInput =
  document.getElementById("adDescription");

const adLinkInput =
  document.getElementById("adLink");

const adPriceInput =
  document.getElementById("adPrice");

const priceFloorNote =
  document.getElementById("priceFloorNote");


/* ---------------------------------------------------------
   BANNER FORM DOM REFS
   --------------------------------------------------------- */

const normalMediaContent =
  document.getElementById("normalMediaContent");

const bannerMediaContent =
  document.getElementById("bannerMediaContent");

const mediaCardTitle =
  document.getElementById("mediaCardTitle");

const descriptionCard =
  document.getElementById("descriptionCard");

const bannerMediaUploadZone =
  document.getElementById(
    "bannerMediaUploadZone"
  );

const bannerMediaInput =
  document.getElementById(
    "bannerMediaInput"
  );

const bannerMediaEmpty =
  document.getElementById(
    "bannerMediaEmpty"
  );

const bannerMediaPreview =
  document.getElementById(
    "bannerMediaPreview"
  );

const bannerImagePreview =
  document.getElementById(
    "bannerImagePreview"
  );

const bannerVideoPreview =
  document.getElementById(
    "bannerVideoPreview"
  );

const bannerMediaRemove =
  document.getElementById(
    "bannerMediaRemove"
  );

const bannerMediaProgress =
  document.getElementById(
    "bannerMediaProgress"
  );

const bannerMediaFill =
  document.getElementById(
    "bannerMediaFill"
  );

const bannerMediaPercent =
  document.getElementById(
    "bannerMediaPercent"
  );

const bannerRequirements =
  document.getElementById(
    "bannerRequirements"
  );

const reqType =
  document.getElementById("reqType");

const reqSize =
  document.getElementById("reqSize");

const reqRatio =
  document.getElementById("reqRatio");

const reqDuration =
  document.getElementById("reqDuration");

const reqResolution =
  document.getElementById(
    "reqResolution"
  );

const reqDurationRow =
  document.getElementById(
    "reqDurationRow"
  );

const reqResolutionRow =
  document.getElementById(
    "reqResolutionRow"
  );


/* ---------------------------------------------------------
   STATE
   --------------------------------------------------------- */

let selectedPackage = null;

let selectedBannerMedia = null;

let bannerMediaValid = false;

let uploadedImageUrl = null;

let uploadedVideoUrl = null;

let isUploadingImage = false;

let isUploadingBannerMedia = false;


/* ---------------------------------------------------------
   PACKAGE SELECTION
   --------------------------------------------------------- */

Object.entries(AD_PACKAGES).forEach(
  ([key, cat]) => {
    const opt =
      document.createElement("option");

    opt.value = key;
    opt.textContent = cat.label;

    adDurationSelect.appendChild(opt);
  }
);


function isBannerSelected() {
  return selectedPackage?.type === "banner";
}


function updateBannerFormMode() {
  const banner = isBannerSelected();

  if (banner) {
    normalMediaContent.style.display =
      "none";

    bannerMediaContent.style.display =
      "grid";

    mediaCardTitle.innerHTML =
      '3. Banner creative <span class="optional-tag">required</span>';

    descriptionCard.style.display =
      "none";

  } else {
    normalMediaContent.style.display =
      "block";

    bannerMediaContent.style.display =
      "none";

    mediaCardTitle.innerHTML =
      '3. Ad image <span class="optional-tag">optional</span>';

    descriptionCard.style.display =
      "";
  }
}


function applySelection(pkg) {
  selectedPackage = pkg;

  pvViews.textContent =
    pkg.views.toLocaleString("en-NG");

  pvDuration.textContent =
    `${pkg.duration} days`;

  pvPrice.textContent =
    formatNaira(pkg.price);

  packPreview.style.display =
    "grid";

  adPriceInput.value =
    pkg.price;

  adPriceInput.min =
    pkg.price;

  priceFloorNote.textContent =
    `Set by the package you picked — you can raise it, but not lower it below ${formatNaira(pkg.price)}.`;

  updateBannerFormMode();

  updateBalanceCheck();
}


/* ---------------------------------------------------------
   REGULAR AD PACKAGE SELECTOR
   --------------------------------------------------------- */

adDurationSelect.addEventListener(
  "change",
  () => {
    const cat =
      AD_PACKAGES[
        adDurationSelect.value
      ];

    adPackSelect.innerHTML =
      `<option value="" disabled selected>Choose views</option>`;

    adPackSelect.disabled =
      !cat;

    if (!cat) return;

    // Picking a regular package clears
    // any banner selection.
    bannerPackSelect.value = "";

    clearBannerMediaState();

    cat.items.forEach(
      (item, idx) => {
        const opt =
          document.createElement("option");

        opt.value = idx;

        opt.textContent =
          `${item.views.toLocaleString("en-NG")} views — ${formatNaira(item.price)}`;

        adPackSelect.appendChild(opt);
      }
    );
  }
);


adPackSelect.addEventListener(
  "change",
  () => {
    const cat =
      AD_PACKAGES[
        adDurationSelect.value
      ];

    const item =
      cat?.items[
        Number(adPackSelect.value)
      ];

    if (!item) return;

    applySelection({
      type: adDurationSelect.value,
      views: item.views,
      price: item.price,
      duration: cat.duration
    });
  }
);


/* ---------------------------------------------------------
   BANNER PACKAGE SELECTOR
   --------------------------------------------------------- */

bannerPackSelect.addEventListener(
  "change",
  () => {
    const item =
      BANNER_PACKAGE.items[
        Number(bannerPackSelect.value)
      ];

    if (!item) return;

    // Picking a banner package clears
    // any regular selection.
    adDurationSelect.value = "";

    adPackSelect.innerHTML =
      `<option value="" disabled selected>Choose an ad type first</option>`;

    adPackSelect.disabled = true;

    clearBannerMediaState();

    applySelection({
      type: "banner",
      views: item.views,
      price: item.price,
      duration: BANNER_PACKAGE.duration
    });
  }
);


/* ---------------------------------------------------------
   BANNER SLOT AVAILABILITY
   Max 3 active/pending banner campaigns
   --------------------------------------------------------- */

const bannerSlotQuery =
  query(
    collection(
      db,
      "advertisements"
    ),
    where(
      "type",
      "==",
      "banner"
    ),
    where(
      "status",
      "in",
      [
        "pending_review",
        "active"
      ]
    )
  );


onSnapshot(
  bannerSlotQuery,
  (snap) => {
    const used = snap.size;

    const available =
      Math.max(
        0,
        MAX_BANNER_SLOTS - used
      );

    if (available > 0) {
      bannerSlotNote.className =
        "banner-slot-note available";

      bannerSlotNote.innerHTML =
        `<i class="bx bx-check-circle"></i><span>Banner — available slot ${available}/${MAX_BANNER_SLOTS}</span>`;

      bannerPackSelect.disabled =
        false;

      bannerPackSelect.innerHTML =
        `<option value="" disabled selected>Choose views</option>`;

      BANNER_PACKAGE.items.forEach(
        (item, idx) => {
          const opt =
            document.createElement(
              "option"
            );

          opt.value = idx;

          opt.textContent =
            `${item.views.toLocaleString("en-NG")} views — ${formatNaira(item.price)}`;

          bannerPackSelect.appendChild(
            opt
          );
        }
      );

    } else {
      bannerSlotNote.className =
        "banner-slot-note full";

      bannerSlotNote.innerHTML =
        `<i class="bx bx-x-circle"></i><span>Banner — 0/${MAX_BANNER_SLOTS} available. No banner slot open right now.</span>`;

      bannerPackSelect.disabled =
        true;

      bannerPackSelect.innerHTML =
        `<option value="" disabled selected>No slot available</option>`;
    }
  },
  (err) => {
    console.error(
      "Banner slot check error:",
      err
    );

    bannerSlotNote.className =
      "banner-slot-note";

    bannerSlotNote.innerHTML =
      `<i class="bx bx-error-circle"></i><span>Couldn't check banner availability.</span>`;
  }
);

/* ---------------------------------------------------------
   PRICE — FLOOR ENFORCED
   --------------------------------------------------------- */

adPriceInput.addEventListener(
  "input",
  updateBalanceCheck
);

adPriceInput.addEventListener(
  "blur",
  () => {
    const floor =
      selectedPackage?.price ?? 0;

    if (
      Number(adPriceInput.value) <
      floor
    ) {
      adPriceInput.value =
        floor;

      updateBalanceCheck();
    }
  }
);

/* ---------------------------------------------------------
   NORMAL IMAGE UPLOAD
   This remains unchanged for regular ads.
   --------------------------------------------------------- */

const imageUploadZone =
  document.getElementById(
    "imageUploadZone"
  );

const adImageInput =
  document.getElementById(
    "adImageInput"
  );

const imageUploadEmpty =
  document.getElementById(
    "imageUploadEmpty"
  );

const imagePreview =
  document.getElementById(
    "imagePreview"
  );

const imageUploadProgress =
  document.getElementById(
    "imageUploadProgress"
  );

const imageUploadFill =
  document.getElementById(
    "imageUploadFill"
  );

const imageUploadPercent =
  document.getElementById(
    "imageUploadPercent"
  );

const imageRemoveBtn =
  document.getElementById(
    "imageRemoveBtn"
  );


imageUploadZone.addEventListener(
  "click",
  (e) => {
    if (
      e.target === imageRemoveBtn ||
      imageRemoveBtn.contains(e.target)
    ) {
      return;
    }

    adImageInput.click();
  }
);


adImageInput.addEventListener(
  "change",
  () => {
    const file =
      adImageInput.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith("image/")
    ) {
      showMsg(
        "error",
        "Please choose an image file."
      );

      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      showMsg(
        "error",
        "Image should be under 5MB."
      );

      return;
    }

    clearMsg();

    imageUploadEmpty.style.display =
      "none";

    imagePreview.style.display =
      "block";

    imagePreview.src =
      URL.createObjectURL(file);

    imageUploadProgress.style.display =
      "flex";

    imageUploadFill.style.width =
      "0%";

    imageUploadPercent.textContent =
      "0%";

    isUploadingImage = true;

    const path =
      `ad-images/${currentUser.uid}/${Date.now()}-${file.name}`;

    const fileRef =
      storageRef(
        storage,
        path
      );

    const uploadTask =
      uploadBytesResumable(
        fileRef,
        file
      );

    uploadTask.on(
      "state_changed",

      (snapshot) => {
        const pct =
          Math.round(
            (
              snapshot.bytesTransferred /
              snapshot.totalBytes
            ) * 100
          );

        imageUploadFill.style.width =
          pct + "%";

        imageUploadPercent.textContent =
          pct + "%";
      },

      (err) => {
        console.error(
          "Image upload error:",
          err
        );

        showMsg(
          "error",
          "Image upload failed — you can still post without one, or try again."
        );

        imageUploadProgress.style.display =
          "none";

        isUploadingImage = false;
      },

      async () => {
        uploadedImageUrl =
          await getDownloadURL(
            uploadTask.snapshot.ref
          );

        imageUploadProgress.style.display =
          "none";

        imageRemoveBtn.style.display =
          "flex";

        isUploadingImage = false;
      }
    );
  }
);


imageRemoveBtn.addEventListener(
  "click",
  (e) => {
    e.stopPropagation();

    uploadedImageUrl = null;

    adImageInput.value = "";

    imagePreview.style.display =
      "none";

    imagePreview.src = "";

    imageUploadEmpty.style.display =
      "flex";

    imageRemoveBtn.style.display =
      "none";
  }
);

/* ---------------------------------------------------------
   BANNER MEDIA VALIDATION
   --------------------------------------------------------- */

function setRequirement(
  element,
  state,
  text
) {
  element.className = "";

  if (state === true) {
    element.classList.add("valid");
    element.textContent =
      text || "Valid";
  } else if (state === false) {
    element.classList.add("invalid");
    element.textContent =
      text || "Not valid";
  } else {
    element.classList.add("pending");
    element.textContent =
      text || "—";
  }
}


function checkBannerRatio(
  width,
  height
) {
  if (!width || !height) {
    return false;
  }

  const ratio =
    width / height;

  return Math.abs(
    ratio - BANNER_RATIO
  ) <= BANNER_RATIO_TOLERANCE;
}


function clearBannerMediaState() {
  selectedBannerMedia = null;

  bannerMediaValid = false;

  uploadedVideoUrl = null;

  bannerMediaInput.value = "";

  bannerMediaEmpty.style.display =
    "flex";

  bannerMediaPreview.style.display =
    "none";

  bannerImagePreview.style.display =
    "none";

  bannerImagePreview.src = "";

  bannerVideoPreview.pause();

  bannerVideoPreview.removeAttribute(
    "src"
  );

  bannerVideoPreview.load();

  bannerVideoPreview.style.display =
    "none";

  bannerRequirements.style.display =
    "none";

  setRequirement(
    reqType,
    null
  );

  setRequirement(
    reqSize,
    null
  );

  setRequirement(
    reqRatio,
    null
  );

  setRequirement(
    reqDuration,
    null
  );

  setRequirement(
    reqResolution,
    null
  );

  reqDurationRow.classList.remove(
    "hidden"
  );

  reqResolutionRow.classList.remove(
    "hidden"
  );

  bannerMediaProgress.style.display =
    "none";

  bannerMediaFill.style.width =
    "0%";

  bannerMediaPercent.textContent =
    "0%";

  isUploadingBannerMedia =
    false;
}

/* ---------------------------------------------------------
   BANNER MEDIA PICKER
   --------------------------------------------------------- */

bannerMediaUploadZone.addEventListener(
  "click",
  (e) => {
    if (
      e.target === bannerMediaRemove ||
      bannerMediaRemove.contains(e.target)
    ) {
      return;
    }

    bannerMediaInput.click();
  }
);


bannerMediaInput.addEventListener(
  "change",
  () => {
    const file =
      bannerMediaInput.files?.[0];

    if (!file) return;

    clearMsg();

    /*
     * Reset only the previous banner state.
     * The selected file remains in the input.
     */
    selectedBannerMedia = null;
    bannerMediaValid = false;

    bannerImagePreview.style.display =
      "none";

    bannerImagePreview.src = "";

    bannerVideoPreview.pause();

    bannerVideoPreview.removeAttribute(
      "src"
    );

    bannerVideoPreview.load();

    bannerVideoPreview.style.display =
      "none";

    bannerMediaPreview.style.display =
      "none";

    bannerMediaEmpty.style.display =
      "flex";

    bannerRequirements.style.display =
      "none";

    const isImage =
      file.type.startsWith("image/");

    const isVideo =
      file.type.startsWith("video/");

    const allowedImageTypes = [
      "image/webp",
      "image/jpeg",
      "image/jpg",
      "image/png"
    ];

    const allowedVideoTypes = [
      "video/webm",
      "video/mp4"
    ];


    /* -------------------------------------------------------
       TYPE
       ------------------------------------------------------- */

    if (
      (isImage &&
        !allowedImageTypes.includes(
          file.type
        )) ||
      (isVideo &&
        !allowedVideoTypes.includes(
          file.type
        )) ||
      (!isImage && !isVideo)
    ) {
      showMsg(
        "error",
        "Banner media must be WebP, JPG/JPEG, PNG, WebM or MP4."
      );

      bannerMediaInput.value = "";

      return;
    }


    /* -------------------------------------------------------
       FILE SIZE
       ------------------------------------------------------- */

    if (
      file.size >
      BANNER_MAX_FILE_SIZE
    ) {
      showMsg(
        "error",
        "Banner media must be 2MB or smaller."
      );

      bannerMediaInput.value = "";

      return;
    }


    selectedBannerMedia = {
      file,
      type: isImage
        ? "image"
        : "video",
      width: 0,
      height: 0,
      duration: 0
    };


    bannerRequirements.style.display =
      "grid";


    setRequirement(
      reqType,
      true,
      isImage
        ? "Image"
        : "Video"
    );


    setRequirement(
      reqSize,
      true,
      `${formatFileSize(file.size)} ✓`
    );

    /* -------------------------------------------------------
       IMAGE
       ------------------------------------------------------- */

    if (isImage) {
      const objectUrl =
        URL.createObjectURL(file);

      bannerImagePreview.src =
        objectUrl;

      bannerImagePreview.style.display =
        "block";

      bannerVideoPreview.style.display =
        "none";

      bannerMediaEmpty.style.display =
        "none";

      bannerMediaPreview.style.display =
        "block";


      bannerImagePreview.onload =
        () => {
          const width =
            bannerImagePreview.naturalWidth;

          const height =
            bannerImagePreview.naturalHeight;

          selectedBannerMedia.width =
            width;

          selectedBannerMedia.height =
            height;


          const ratioValid =
            checkBannerRatio(
              width,
              height
            );


          setRequirement(
            reqRatio,
            ratioValid,
            ratioValid
              ? `${width} × ${height} ✓`
              : `${width} × ${height} — must be 3:1`
          );


          /*
           * Duration and video-resolution
           * checks do not apply to images.
           */
          reqDurationRow.classList.add(
            "hidden"
          );

          reqResolutionRow.classList.add(
            "hidden"
          );


          bannerMediaValid =
            ratioValid;


          if (!ratioValid) {
            showMsg(
              "error",
              "Banner image must use a horizontal 3:1 ratio, such as 1500 × 500 px."
            );
          }
        };

      return;
    }

    /* -------------------------------------------------------
       VIDEO
       ------------------------------------------------------- */

    const objectUrl =
      URL.createObjectURL(file);

    bannerVideoPreview.src =
      objectUrl;

    bannerVideoPreview.style.display =
      "block";

    bannerImagePreview.style.display =
      "none";

    bannerMediaEmpty.style.display =
      "none";

    bannerMediaPreview.style.display =
      "block";

    reqDurationRow.classList.remove(
      "hidden"
    );

    reqResolutionRow.classList.remove(
      "hidden"
    );


    bannerVideoPreview.onloadedmetadata =
      () => {
        const width =
          bannerVideoPreview.videoWidth;

        const height =
          bannerVideoPreview.videoHeight;

        const duration =
          bannerVideoPreview.duration;


        selectedBannerMedia.width =
          width;

        selectedBannerMedia.height =
          height;

        selectedBannerMedia.duration =
          duration;


        /* ---------------------------------------------------
           RATIO
           --------------------------------------------------- */

        const ratioValid =
          checkBannerRatio(
            width,
            height
          );


        /* ---------------------------------------------------
           DURATION
           Maximum 15 seconds
           --------------------------------------------------- */

        const durationValid =
          Number.isFinite(duration) &&
          duration <=
            BANNER_MAX_VIDEO_DURATION;


        /* ---------------------------------------------------
           RESOLUTION
           
           720p means maximum vertical
           resolution of 720 pixels.

           Because the banner must be 3:1,
           a 2160 × 720 video is valid.
           --------------------------------------------------- */

        const resolutionValid =
          height <=
          BANNER_MAX_HEIGHT;


        setRequirement(
          reqRatio,
          ratioValid,
          ratioValid
            ? `${width} × ${height} ✓`
            : `${width} × ${height} — must be 3:1`
        );


        setRequirement(
          reqDuration,
          durationValid,
          durationValid
            ? `${duration.toFixed(1)}s ✓`
            : `${duration.toFixed(1)}s — max 15s`
        );


        setRequirement(
          reqResolution,
          resolutionValid,
          resolutionValid
            ? `${width} × ${height} ✓`
            : `${width} × ${height} — max 720px height`
        );


        bannerMediaValid =
          ratioValid &&
          durationValid &&
          resolutionValid;


        if (!bannerMediaValid) {
          showMsg(
            "error",
            "This video does not meet all banner requirements."
          );
        }
      };
  }
);

/* ---------------------------------------------------------
   REMOVE BANNER MEDIA
   --------------------------------------------------------- */

bannerMediaRemove.addEventListener(
  "click",
  (e) => {
    e.stopPropagation();

    clearBannerMediaState();
  }
);


/* ---------------------------------------------------------
   BANNER MEDIA UPLOAD
   Only happens after the media passes
   all local requirements.
   --------------------------------------------------------- */

async function uploadBannerMedia() {
  if (
    !selectedBannerMedia?.file
  ) {
    throw new Error(
      "Please choose a banner image or video."
    );
  }

  if (!bannerMediaValid) {
    throw new Error(
      "The banner creative does not meet the required specifications."
    );
  }

  isUploadingBannerMedia = true;

  bannerMediaProgress.style.display =
    "flex";

  bannerMediaFill.style.width =
    "0%";

  bannerMediaPercent.textContent =
    "0%";


  const file =
    selectedBannerMedia.file;

  const mediaFolder =
    selectedBannerMedia.type ===
    "video"
      ? "ad-videos"
      : "ad-images";


  const path =
    `${mediaFolder}/${currentUser.uid}/${Date.now()}-${file.name}`;


  const fileRef =
    storageRef(
      storage,
      path
    );


  const uploadTask =
    uploadBytesResumable(
      fileRef,
      file
    );


  return new Promise(
    (resolve, reject) => {

      uploadTask.on(
        "state_changed",

        (snapshot) => {
          const pct =
            Math.round(
              (
                snapshot.bytesTransferred /
                snapshot.totalBytes
              ) * 100
            );

          bannerMediaFill.style.width =
            pct + "%";

          bannerMediaPercent.textContent =
            pct + "%";
        },


        (err) => {
          console.error(
            "Banner media upload error:",
            err
          );

          bannerMediaProgress.style.display =
            "none";

          isUploadingBannerMedia =
            false;

          reject(
            new Error(
              "Banner media upload failed. Please try again."
            )
          );
        },


        async () => {
          try {
            const url =
              await getDownloadURL(
                uploadTask.snapshot.ref
              );


            if (
              selectedBannerMedia.type ===
              "video"
            ) {
              uploadedVideoUrl =
                url;
            } else {
              uploadedImageUrl =
                url;
            }


            bannerMediaProgress.style.display =
              "none";

            isUploadingBannerMedia =
              false;


            resolve(url);

          } catch (err) {
            console.error(
              "Banner media URL error:",
              err
            );

            bannerMediaProgress.style.display =
              "none";

            isUploadingBannerMedia =
              false;


            reject(
              new Error(
                "Couldn't finish processing the banner media."
              )
            );
          }
        }
      );
    }
  );
}

/* ---------------------------------------------------------
   BALANCE CHECK
   --------------------------------------------------------- */

const depositBalanceValue =
  document.getElementById(
    "depositBalanceValue"
  );

const balanceRow =
  document.querySelector(
    ".balance-row"
  );


function updateBalanceCheck() {
  const price =
    Number(adPriceInput.value) || 0;

  balanceRow.classList.toggle(
    "insufficient",
    price > currentDepositBalance
  );
}


/* ---------------------------------------------------------
   FORM MESSAGES
   --------------------------------------------------------- */

const formMsg =
  document.getElementById(
    "formMsg"
  );


function showMsg(type, text) {
  formMsg.className =
    "panel-msg show " + type;

  const icon =
    type === "error"
      ? "bx-error-circle"
      : "bx-check-circle";

  formMsg.innerHTML =
    `<i class="bx ${icon}"></i><span>${text}</span>`;
}


function clearMsg() {
  formMsg.className =
    "panel-msg";

  formMsg.innerHTML =
    "";
}


/* ---------------------------------------------------------
   VALIDATION
   --------------------------------------------------------- */

function validateForm() {

  if (!selectedPackage) {
    return "Pick a package first.";
  }


  if (!adTitleInput.value.trim()) {
    return "Add a title for your ad.";
  }


  /*
   * Regular advertisements still require
   * their description.
   *
   * Banner advertisements do NOT.
   */

  if (
    selectedPackage.type !==
      "banner" &&
    !adDescriptionInput.value.trim()
  ) {
    return "Add a short description.";
  }


  if (
    adLinkInput.value.trim() &&
    !/^https?:\/\//i.test(
      adLinkInput.value.trim()
    )
  ) {
    return "That link doesn't look right — it should start with http:// or https://";
  }


  if (
    !adPriceInput.value ||
    Number(adPriceInput.value) <
      selectedPackage.price
  ) {
    return "Price looks off — please recheck.";
  }


  if (
    selectedPackage.type ===
    "banner"
  ) {

    if (!selectedBannerMedia) {
      return "Choose a banner image or video.";
    }


    if (!bannerMediaValid) {
      return "Your banner creative does not meet all the required specifications.";
    }


    if (
      isUploadingBannerMedia
    ) {
      return "Your banner media is still uploading — please wait a moment.";
    }

  } else {

    if (isUploadingImage) {
      return "Your image is still uploading — please wait a moment.";
    }
  }


  return null;
}


/* ---------------------------------------------------------
   SUBMIT
   Reserve funds and create the ad
   in one Firestore transaction.
   --------------------------------------------------------- */

const postAdForm =
  document.getElementById(
    "postAdForm"
  );

const postAdSubmit =
  document.getElementById(
    "postAdSubmit"
  );


let currentUser = null;

let currentDepositBalance = 0;


postAdForm.addEventListener(
  "submit",
  async (e) => {

    e.preventDefault();

    clearMsg();


    const errorText =
      validateForm();

    if (errorText) {
      showMsg(
        "error",
        errorText
      );

      return;
    }


    if (!currentUser) {
      return;
    }


    const price =
      Number(
        adPriceInput.value
      );


    if (
      price >
      currentDepositBalance
    ) {

      postAdSubmit.classList.add(
        "shake"
      );

      setTimeout(
        () => {
          postAdSubmit.classList.remove(
            "shake"
          );
        },
        400
      );


      showMsg(
        "error",
        `Your Deposit Balance (${formatNaira(currentDepositBalance)}) is lower than ${formatNaira(price)}. Please deposit more before posting.`
      );

      return;
    }


    postAdSubmit.classList.add(
      "loading"
    );

    postAdSubmit.disabled =
      true;


    try {

      /*
       * Banner media is uploaded only
       * after local validation succeeds.
       */

      if (
        selectedPackage.type ===
        "banner"
      ) {
        await uploadBannerMedia();
      }


      const userRef =
        doc(
          db,
          "users",
          currentUser.uid
        );


      const adRef =
        doc(
          collection(
            db,
            "advertisements"
          )
        );


      const isBanner =
        selectedPackage.type ===
        "banner";


      const adData = {

        advertiserUid:
          currentUser.uid,

        type:
          selectedPackage.type,

        durationDays:
          selectedPackage.duration,

        guaranteedViews:
          selectedPackage.views,

        basePrice:
          selectedPackage.price,

        price,

        title:
          adTitleInput.value.trim(),


        /*
         * Regular ads keep their description.
         * Banner ads deliberately have no description.
         */

        description:
          isBanner
            ? null
            : adDescriptionInput.value.trim(),


        link:
          adLinkInput.value.trim() ||
          null,


        /*
         * Regular advertisement image.
         */

        imageUrl:
          isBanner
            ? null
            : uploadedImageUrl,


        /*
         * Banner media.
         */

        videoUrl:
          isBanner
            ? uploadedVideoUrl
            : null,


        mediaType:
          isBanner
            ? selectedBannerMedia?.type ||
              null
            : "image",


        /*
         * Banner creative dimensions.
         */

        mediaWidth:
          isBanner
            ? selectedBannerMedia?.width ||
              null
            : null,

        mediaHeight:
          isBanner
            ? selectedBannerMedia?.height ||
              null
            : null,


        /*
         * Only videos have a duration.
         */

        mediaDuration:
          isBanner &&
          selectedBannerMedia?.type ===
            "video"
            ? selectedBannerMedia.duration
            : null,


        currentViews:
          0,

        clicks:
          0,

        status:
          "pending_review",

        hidden:
          false,

        createdAt:
          serverTimestamp(),

        /*
         * Admin sets this when the
         * advertisement is approved.
         */

        expiresAt:
          null
      };


      await runTransaction(
        db,
        async (transaction) => {

          const snap =
            await transaction.get(
              userRef
            );


          if (!snap.exists()) {
            throw new Error(
              "Account not found."
            );
          }


          const deposit =
            snap.data()
              .wallet?.deposit ??
            0;


          if (
            price >
            deposit
          ) {
            throw new Error(
              "Your Deposit Balance is too low to post this ad."
            );
          }


          transaction.update(
            userRef,
            {
              "wallet.deposit":
                deposit - price
            }
          );


          transaction.set(
            adRef,
            adData
          );


          const txRef =
            doc(
              collection(
                db,
                "users",
                currentUser.uid,
                "transactions"
              )
            );


          transaction.set(
            txRef,
            {
              type:
                "ad_post",

              direction:
                "debit",

              title:
                `Posted advertisement: ${adData.title}`,

              amount:
                price,

              status:
                "successful",

              createdAt:
                serverTimestamp()
            }
          );
        }
      );


      showMsg(
        "success",
        "Advertisement posted! It'll go live once approved — usually within a few hours."
      );


      setTimeout(
        () => {
          window.location.href =
            "track-posted-ads.html";
        },
        1800
      );

    } catch (err) {

      console.error(
        "Post ad error:",
        err
      );

      showMsg(
        "error",
        err.message ||
          "Something went wrong posting your ad. Please try again."
      );

    } finally {

      postAdSubmit.classList.remove(
        "loading"
      );

      postAdSubmit.disabled =
        false;
    }
  }
);

/* ---------------------------------------------------------
   AUTH GUARD
   --------------------------------------------------------- */

const userNameEl =
  document.getElementById(
    "menuUserName"
  );

const userTypeEl =
  document.getElementById(
    "menuUserType"
  );

const userAvatarEl =
  document.getElementById(
    "menuUserAvatar"
  );

const alertDot =
  document.getElementById(
    "alertDot"
  );


let unsubscribeUserDoc =
  null;


onAuthStateChanged(
  auth,
  (user) => {

    if (!user) {
      window.location.href =
        "login.html";

      return;
    }


    if (!user.emailVerified) {
      window.location.href =
        "login.html";

      return;
    }


    currentUser = user;


    if (unsubscribeUserDoc) {
      unsubscribeUserDoc();
    }


    unsubscribeUserDoc =
      onSnapshot(
        doc(
          db,
          "users",
          user.uid
        ),

        (snap) => {

          if (!snap.exists()) {
            return;
          }


          const data =
            snap.data();


          const fullName =
            data.fullName ||
            "TaskNOVA User";


          const initial =
            fullName
              .trim()
              .charAt(0)
              .toUpperCase() ||
            "T";


          if (userNameEl) {
            userNameEl.textContent =
              fullName ||
              user.email;
          }


          if (userTypeEl) {
            userTypeEl.textContent =
              data.accountType
                ? data.accountType +
                  (
                    data.institutionAbbr
                      ? " · " +
                        data.institutionAbbr
                      : ""
                  )
                : user.email;
          }


          if (userAvatarEl) {
            userAvatarEl.textContent =
              initial;
          }


          currentDepositBalance =
            data.wallet?.deposit ??
            0;


          depositBalanceValue.textContent =
            formatNaira(
              currentDepositBalance
            );


          updateBalanceCheck();
        },

        (err) => {
          console.error(
            "User doc listener error:",
            err
          );
        }
      );


    /*
     * Lightweight unread check.
     */

    const unreadCheckQuery =
      query(
        collection(
          db,
          "users",
          user.uid,
          "notifications"
        ),
        where(
          "read",
          "==",
          false
        ),
        limit(1)
      );


    onSnapshot(
      unreadCheckQuery,
      (snap) => {

        alertDot?.classList.toggle(
          "show",
          !snap.empty
        );
      },

      (err) => {

        console.error(
          "Alert dot listener error:",
          err
        );
      }
    );
  }
);

/* =========================================================
   NOTES
   =========================================================

   - Regular advertisements keep their existing behavior.

   - Banner advertisements are 30-day campaigns.

   - Banner advertisements require:
       • Image or video
       • Image: WebP/JPG/JPEG/PNG
       • Video: WebM/MP4
       • Maximum file size: 2 MB
       • Horizontal 3:1 ratio
       • Video maximum duration: 15 seconds
       • Video maximum vertical resolution: 720px

   - A banner image does not have a duration requirement.

   - A banner video shorter than 15 seconds remains valid.
     The banner renderer will later keep the final frame visible
     for the remainder of its 15-second display cycle.

   - Banner advertisements do not require a description.

   - Banner advertisements may have a title and link.

   - Banner media is validated locally before being uploaded.

   - Banner media is stored using:
       mediaType
       imageUrl
       videoUrl
       mediaWidth
       mediaHeight
       mediaDuration

   - Regular ads continue using:
       imageUrl
       description

   - Advertisements begin as:
       status: "pending_review"

   - expiresAt is set by admin upon approval so the campaign
     duration begins from go-live.

   - Banner slot availability remains capped at 3.

   - The banner priority/rotation engine belongs to the
     advertisement renderer, not this posting page.

   ========================================================= */