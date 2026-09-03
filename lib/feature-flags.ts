export type FeatureState = "enabled" | "disabled";

/**
 * Product-level feature switches.
 *
 * To re-enable M.Ads later, change only:
 *   mAds: "disabled"
 * to:
 *   mAds: "enabled"
 */
export const featureFlags = {
  mAds: "disabled" as FeatureState,
};

export const isFeatureEnabled = (feature: keyof typeof featureFlags) =>
  featureFlags[feature] === "enabled";
