/**
 * Adversarial Security Rules Specification Tests (Dirty Dozen)
 * Documents expected PERMISSION_DENIED assertions against firestore.rules.
 */
export const DIRTY_DOZEN_CASES = [
  { id: 1, path: '/products/prod-1', op: 'create', expected: 'PERMISSION_DENIED', reason: 'Non-admin cannot create catalog products' },
  { id: 2, path: '/orders', op: 'list', expected: 'PERMISSION_DENIED', reason: 'Unauthenticated or cross-user list on orders PII blocked' },
  { id: 3, path: '/users/userB/wardrobe/item1', op: 'get', expected: 'PERMISSION_DENIED', reason: 'Cross-user private wardrobe read blocked' },
  { id: 4, path: '/users/userA', op: 'create', payload: { role: 'admin' }, expected: 'PERMISSION_DENIED', reason: 'Self-assigned admin role blocked' },
  { id: 5, path: '/users/userA', op: 'update', payload: { plan: 'premium' }, expected: 'PERMISSION_DENIED', reason: 'Self-assigned premium plan blocked' },
  { id: 6, path: '/orders/IMM-TEST01', op: 'create', payload: { status: 'Delivered' }, expected: 'PERMISSION_DENIED', reason: 'Initial order status must be Pending WhatsApp Confirmation' },
  { id: 7, path: '/users/userA/wardrobe/item1', op: 'create', payload: { isVerified: true }, expected: 'PERMISSION_DENIED', reason: 'Shadow fields blocked by hasOnly' },
  { id: 8, path: '/products/' + 'a'.repeat(200), op: 'get', expected: 'PERMISSION_DENIED', reason: 'ID poisoning blocked by isValidId' },
  { id: 9, path: '/inquiries/inq-1', op: 'create', payload: { message: 'x'.repeat(3000) }, expected: 'PERMISSION_DENIED', reason: 'Oversized payload blocked' },
  { id: 10, path: '/users/userA/schedules/s1', op: 'create', payload: { createdAt: '2020-01-01T00:00:00Z' }, expected: 'PERMISSION_DENIED', reason: 'Client-forged timestamp blocked' },
  { id: 11, path: '/orders/IMM-TEST01', op: 'update', payload: { totalPkr: 1 }, expected: 'PERMISSION_DENIED', reason: 'Non-admin order update blocked' },
  { id: 12, path: '/inquiries/inq-1', op: 'get', expected: 'PERMISSION_DENIED', reason: 'Non-admin inquiry read blocked' },
];
