/* =========================================================
   TASKNOVA — AD DELIVERY-PRIORITY ENGINE (shared)
   One mathematical engine, two presentations — per the spec's
   own "25. The same mathematical priority engine powers both
   systems" rule. Both admin/advertisements.js's Banners tab and
   this module compute delivery status the same way; the formula
   lives here so there's exactly one copy of it.

   No AI, nothing async — pure math over fields every
   advertisements/{id} doc already has: guaranteedViews,
   currentViews, approvedAt, expiresAt.
   ========================================================= */

export const MS_MINUTE = 1000 * 60;
export const MS_HOUR = MS_MINUTE * 60;
export const MS_DAY = MS_HOUR * 24;

export const BANNER_CYCLE_MS = 15 * 1000; // one 15-second display cycle per placement
export const BANNER_PLACEMENTS = ["top", "bottom", "floating"];
export const MAX_ACTIVE_BANNERS = 3;

/**
 * How far ahead/behind an active campaign is on its guaranteed-views
 * delivery, and how urgently it should be shown as a result.
 *
 *   remainingViews   = guaranteedViews - currentViews
 *   remainingMs      = expiresAt - now
 *   requiredRate     = remainingViews needed per hour to still hit the
 *                      guarantee before expiry
 *   actualRate       = views actually delivered per hour so far
 *   ratio            = actualRate / requiredRate
 *
 * ratio >=1.15  ahead        — comfortably on track, low priority
 * ratio >=0.85  onschedule   — normal priority
 * ratio >=0.5   behind       — increased priority
 * ratio <0.5    critical     — very high priority / catch-up mode
 *
 * These four bands are a reasonable, documented reading of the
 * spec's qualitative language ("approximately where it should
 * be") — there's no exact number given, so tune them here (one
 * place) if a different split is wanted later.
 */
export function computeDeliveryStatus(ad, now = Date.now()) {
  const approvedAtMs = ad.approvedAt?.toMillis ? ad.approvedAt.toMillis() : (ad.createdAt?.toMillis ? ad.createdAt.toMillis() : now);
  const expiresAtMs = ad.expiresAt?.toMillis ? ad.expiresAt.toMillis() : now;
  const guaranteedViews = ad.guaranteedViews || 0;
  const currentViews = ad.currentViews || 0;

  const remainingViews = Math.max(0, guaranteedViews - currentViews);
  const elapsedMs = Math.max(0, now - approvedAtMs);
  const remainingMs = Math.max(0, expiresAtMs - now);

  const actualRatePerHour = elapsedMs > 0 ? currentViews / (elapsedMs / MS_HOUR) : 0;
  const requiredRatePerHour = remainingMs > 0 ? remainingViews / (remainingMs / MS_HOUR) : (remainingViews > 0 ? Infinity : 0);

  let level, label, score;
  if (remainingViews <= 0) {
    // Guarantee already met — still eligible to show, just never
    // fights for priority against campaigns that still need views.
    level = "ahead"; label = "🟢 Guarantee met"; score = 0;
  } else if (requiredRatePerHour === Infinity) {
    // Time's up (or about to be) with views still owed.
    level = "critical"; label = "🔴 Critically behind"; score = 1000 + remainingViews;
  } else {
    const ratio = requiredRatePerHour > 0 ? actualRatePerHour / requiredRatePerHour : 1;
    if (ratio >= 1.15) { level = "ahead"; label = "🟢 Ahead of schedule"; score = 10 - Math.min(10, ratio); }
    else if (ratio >= 0.85) { level = "onschedule"; label = "🟡 On schedule"; score = 20; }
    else if (ratio >= 0.5) { level = "behind"; label = "🟠 Behind schedule"; score = 40 + (1 - ratio) * 40; }
    else { level = "critical"; label = "🔴 Critically behind"; score = 80 + (0.5 - ratio) * 80; }
  }

  return {
    level, label, score,
    remainingViews, remainingMs, elapsedMs,
    actualRatePerHour, requiredRatePerHour,
    pct: guaranteedViews ? Math.min(100, Math.round((currentViews / guaranteedViews) * 100)) : 0,
    daysLeft: Math.max(0, Math.ceil(remainingMs / MS_DAY))
  };
}

/**
 * Feed ranking: newness first (existing "newest first" behaviour),
 * then a delivery-priority nudge within that — a campaign that's
 * badly behind can jump ahead of slightly-newer ones, but a brand
 * new, on-schedule ad still generally beats an old, comfortably-
 * ahead one. Call once per page load/refresh and hold the result
 * for the browsing session — don't re-rank while someone is
 * scrolling (per spec #22).
 */
export function rankFeedAds(ads, now = Date.now()) {
  const withScore = ads.map((ad) => {
    const status = computeDeliveryStatus(ad, now);
    const createdMs = ad.createdAt?.toMillis ? ad.createdAt.toMillis() : 0;
    // Newness dominates (createdMs is huge relative to score), delivery
    // urgency only re-orders ads that are otherwise close in age.
    const rankValue = createdMs / MS_HOUR + status.score * 6;
    return { ad, status, rankValue };
  });
  withScore.sort((a, b) => b.rankValue - a.rankValue);
  return withScore;
}

/**
 * Which campaign occupies Top/Bottom/Floating for the *next* 15s
 * cycle. Takes every currently-active banner campaign, sorts by
 * urgency, and rotates which physical slot each one lands in from
 * cycle to cycle (cycleIndex increments every 15s) — so a
 * campaign that stays most-urgent keeps winning a slot every
 * cycle (natural catch-up behaviour) while still visibly moving
 * between Top/Bottom/Floating rather than sitting frozen in one
 * place. Ads beyond the top 3 simply sit out that cycle.
 *
 * Returns { top, bottom, floating } — each either an ad object or
 * null (null = show the default TaskNOVA house banner there).
 */
export function pickBannerTriplet(activeBanners, cycleIndex = 0, now = Date.now()) {
  const ranked = activeBanners
    .map((ad) => ({ ad, status: computeDeliveryStatus(ad, now) }))
    .sort((a, b) => b.status.score - a.status.score)
    .slice(0, BANNER_PLACEMENTS.length)
    .map((r) => r.ad);

  const result = { top: null, bottom: null, floating: null };
  ranked.forEach((ad, i) => {
    const slot = BANNER_PLACEMENTS[(i + cycleIndex) % BANNER_PLACEMENTS.length];
    result[slot] = ad;
  });
  return result;
}

/**
 * Per-page-context view dedup, matching the spec's refresh rule
 * exactly: same visitor + same page + refresh = no extra view;
 * same visitor + a different page (or a genuinely new exposure
 * later) = counts again. sessionStorage is scoped to the tab and
 * survives a refresh, so keying on pathname+adId is enough — a
 * full close-and-reopen of the tab clears it naturally, which is
 * fine (that's a new session, a legitimate new exposure anyway).
 *
 * Returns true the first time an (adId, pathname) pair is seen in
 * this tab; false on every repeat — call this right before
 * incrementing currentViews, and only increment when it's true.
 */
export function claimImpressionSlot(adId, pathname = window.location.pathname) {
  const key = `tn-adview:${pathname}:${adId}`;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    // sessionStorage unavailable (private mode, etc.) — fail open
    // rather than silently under-counting every view.
    return true;
  }
}

/**
 * The advertiser must never generate their own paid views — this
 * is the one rule every renderer (banner or feed) must apply
 * before calling claimImpressionSlot at all.
 */
export function isOwnAd(ad, currentUid) {
  return !!currentUid && ad.advertiserUid === currentUid;
}
