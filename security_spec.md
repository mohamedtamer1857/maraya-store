# Security Specification (MARAYA Firestore Rules)

## 1. Data Invariants
- All user data (`/users/{userId}/private/*`, `/users/{userId}/wishlist/*`, `/users/{userId}/chatSessions/*`, and `/users/{userId}/chatSessions/{sessionId}/messages/*`) is strictly owner-isolated to `request.auth.uid == userId` with `request.auth.token.email_verified == true` for writes.
- Every document enforces `data.uid == request.auth.uid` on write and verifies immutable `uid` and `createdAt` on update.
- All timestamps (`createdAt`, `updatedAt`) must equal `request.time`.
- All path variables (`userId`, `docId`, `productId`, `sessionId`, `messageId`) must match `^[a-zA-Z0-9_\-]+$` and length `<= 128`.
- `ChatMessage.sources` is bounded to `<= 8` items, with element type validation.

## 2. Adversarial "Dirty Dozen" Payloads (All Must Fail with PERMISSION_DENIED)
1. Unauthenticated read/write to `/users/{uid}/private/info`.
2. Cross-user `get` or `list` on `/users/otherUid/wishlist`.
3. Identity spoofing: writing `/users/{myUid}/wishlist/item1` with `uid: "otherUid"`.
4. Shadow field injection: adding `isAdmin: true` on `create` or `update`.
5. Unverified email write (`email_verified: false`).
6. Oversized string DoS (`savedAddress` > 300 chars or `text` > 12000 chars).
7. Poisoned path variable ID (`../../etc/passwd` or 500-char ID).
8. Forged client `createdAt` timestamp != `request.time`.
9. Mutating immutable `uid` or `createdAt` during `update`.
10. Unbounded array injection (`sources.size() == 20`).
11. Non-string array element injection (`sources: [123]`).
12. Orphaned message creation under a non-existent parent `chatSessions/{sessionId}` document.
