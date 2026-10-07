// Store-policy numbers shared by the policy pages, FAQ, trust bar and the
// admin's settings check — so what the shop promises is stated in one place.
export const POLICY_DEFAULTS = {
  returnDays: 30,
  dispatchDays: '1–2',
  grievanceName: '',
};

export function policySettings(settings = {}) {
  const saved = settings.policies || {};
  const returnDays = Number.isInteger(saved.returnDays) ? saved.returnDays : POLICY_DEFAULTS.returnDays;
  return {
    returnDays,
    dispatchDays: saved.dispatchDays || POLICY_DEFAULTS.dispatchDays,
    grievanceName: saved.grievanceName || '',
  };
}

// Server-side check for the Policies section of Store settings.
export function validatePolicySettings(input = {}) {
  const returnDays = Number(input.returnDays);
  const policies = {
    returnDays: Number.isInteger(returnDays) ? returnDays : POLICY_DEFAULTS.returnDays,
    dispatchDays: String(input.dispatchDays ?? '').trim().slice(0, 20) || POLICY_DEFAULTS.dispatchDays,
    grievanceName: String(input.grievanceName ?? '').trim().slice(0, 80),
  };
  const errors = {};
  if (!Number.isInteger(returnDays) || returnDays < 0 || returnDays > 90) errors.returnDays = 'Enter a whole number of days from 0 to 90 (0 means no returns).';
  return { policies, errors };
}

// "Free shipping over ₹2,999", "Free shipping", or "₹99 shipping".
export function shippingPromise(pricing = {}, formatCurrency) {
  // Whole-rupee amounts read better without ".00" in a headline.
  const money = (value) => formatCurrency(value).replace(/\.00$/, '');
  const fee = Number(pricing.shippingFee) || 0;
  if (!fee) return 'Free shipping';
  if (pricing.freeShippingThreshold) return `Free shipping over ${money(pricing.freeShippingThreshold)}`;
  return `${money(fee)} shipping`;
}
