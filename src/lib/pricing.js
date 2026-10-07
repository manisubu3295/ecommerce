// Shared, side-effect-free order math used by both the client (for display)
// and the server (as the source of truth). Keeping this in one place means
// the number a customer sees in the cart is guaranteed to match what the
// server charges and stores.

/**
 * @param {{items: {price:number, qty:number}[], taxRatePercent?: number, shippingFee?: number, freeShippingThreshold?: number|null, discountAmount?: number}} input
 */
export function calculateOrderTotals({ items, taxRatePercent = 0, shippingFee = 0, freeShippingThreshold = null, discountAmount = 0 }) {
  // A unit's price includes any ready-to-wear add-ons (fall & pico, stitching…).
  const subtotal = (items || []).reduce((sum, item) => sum + (Number(item.price || 0) + Number(item.addonsTotal || 0)) * Number(item.qty || 0), 0);
  // Free-shipping eligibility is based on the pre-discount subtotal — a
  // coupon shouldn't unexpectedly strip away shipping you'd already earned.
  const qualifiesForFreeShipping = freeShippingThreshold != null && subtotal >= Number(freeShippingThreshold);
  const shipping = qualifiesForFreeShipping ? 0 : Number(shippingFee) || 0;
  // Never let a discount exceed the subtotal (no negative pre-tax total).
  const discount = Math.min(Number(discountAmount) || 0, subtotal);
  const taxableSubtotal = subtotal - discount;
  const tax = Math.round(taxableSubtotal * (Number(taxRatePercent) || 0)) / 100;
  const total = Math.round((taxableSubtotal + shipping + tax) * 100) / 100;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    shipping: Math.round(shipping * 100) / 100,
    tax,
    total,
  };
}
