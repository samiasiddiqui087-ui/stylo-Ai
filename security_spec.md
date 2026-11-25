# IMMERSO Security Specification (Phase 0)

## Data Invariants
1. Products, Inspirations, and SiteConfig are publicly readable for storefront browsing, and strictly writable only by verified admins (`isAdmin()`).
2. Private user collections (`/users/{userId}` and subcollections `wardrobe`, `savedOutfits`, `schedules`, `wishlist`, `cart`, `chatSessions`, `tryOnHistory`) are accessible only when `request.auth.uid == userId` (with `email_verified == true` for authenticated writes) or `isAdmin()`.
3. Users cannot self-assign `role: 'admin'` or `plan: 'premium'` on profile create/update.
4. Customer orders (`/orders/{orderId}`) contain PII (name, phone, address). On create, status MUST be `'Pending WhatsApp Confirmation'`, timestamps MUST equal `request.time`, and `userId` (if authenticated) MUST equal `request.auth.uid`. Reads and list queries on `/orders` are restricted strictly to `resource.data.userId == request.auth.uid` or `isAdmin()`.
5. Public order tracking uses `/orderTracking/{orderId}` (zero PII: only orderId, phoneLast4, city, itemCount, itemSummary, totalPkr, status, timestamps) with single-document `get` only (`allow list: if false`).
6. Customer support inquiries (`/inquiries/{inquiryId}`) allow `create` with strict validation and `status == 'New'`, while `read`/`update`/`delete` are restricted strictly to `isAdmin()`.

## Dirty Dozen Payloads (Must All Return PERMISSION_DENIED)
1. Unauthenticated write to `/products/prod-1` (Admin privilege escalation).
2. Unauthenticated `list` query on `/orders` (PII scraping).
3. Authenticated user A reading `/users/userB/wardrobe/item1` (Cross-tenant privacy breach).
4. User creating `/users/userA` with `role: 'admin'` (Self-assigned admin role).
5. User updating `/users/userA` with `plan: 'premium'` (Self-assigned paid tier).
6. Guest creating `/orders/IMM-123456` with `status: 'Delivered'` (Order state shortcutting).
7. User adding shadow ghost field `isVerified: true` to `/users/userA/wardrobe/item1` (Shadow field injection).
8. Document ID exceeding 128 characters or containing invalid chars like `../` (ID poisoning).
9. String field exceeding max size (1MB payload in `customerName`) (Denial of Wallet).
10. Backdated `createdAt` timestamp not equal to `request.time` (Temporal tampering).
11. User updating an existing `/orders/IMM-123456` to change `totalPkr` or `status` (Order tampering).
12. Unauthenticated user reading `/inquiries/inq-1` (Support inquiry PII leak).
