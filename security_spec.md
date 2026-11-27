# Firestore Security Specification — Macro Vision Academy Burhanpur

## 1. Data Invariants

1. **Identity Binding**: Every `/userProfiles/{userId}` document must have `uid == userId == request.auth.uid`, and every `/userNotes/{noteId}` document must have `ownerId == request.auth.uid` on creation.
2. **Email Verification Enforcement**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Anti-Self-Elevation**: Non-admin users creating a `/userProfiles/{userId}` document may only initialize `role: "PORTAL_USER"` (never `"ADMIN"` or `"TEACHER"`), and `role` cannot be modified by non-admins on update.
4. **PII Isolation**: `/userProfiles/{userId}` stores personal `email` and is readable/listable ONLY by the owning user (`request.auth.uid == userId`) or a verified administrator (`isAdmin()`). Blanket `list` on `/userProfiles` is denied for non-admins.
5. **Immutable Ownership & Creation Timestamps**: `uid`, `ownerId`, and `createdAt` can never change after document creation. `createdAt` and `updatedAt` must equal `request.time`.
6. **Strict Schema & Bounds**: Every create validates exact required and allowed keys (`hasAll` + `hasOnly`). Every update validates `isValid[Entity](incoming())` and restricts changed keys via `affectedKeys().hasOnly(...)`. Every string and document ID has strict length and character pattern bounds.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)

1. **Unauthenticated Profile Read**: Read `/userProfiles/user_123` with `request.auth == null`.
2. **Cross-User PII Read**: Read `/userProfiles/victim_uid` while signed in as `attacker_uid`.
3. **Blanket User List Scraping**: Query `list` on `/userProfiles` as a non-admin user.
4. **Role Self-Escalation on Create**: Create `/userProfiles/attacker_uid` with `role: "ADMIN"` as non-admin.
5. **Role Escalation on Update**: Update `/userProfiles/attacker_uid` changing `role` from `"PORTAL_USER"` to `"ADMIN"`.
6. **Shadow Ghost Field Injection**: Create `/userNotes/note_1` containing all required fields plus `isAdminOverride: true`.
7. **Unverified Email Spoofing**: Write `/userNotes/note_1` with `email: "yashrajmanawat0602@gmail.com"` and `email_verified: false`.
8. **Foreign Owner Spoofing**: Create `/userNotes/note_1` with `ownerId: "victim_uid"` while signed in as `attacker_uid`.
9. **Owner Reassignment on Update**: Update `/userNotes/note_1` attempting to mutate `ownerId` or `createdAt`.
10. **Oversized Document ID Poisoning**: Create `/userNotes/<150-char-invalid-id>` failing `isValidId()`.
11. **Oversized Content Payload**: Create `/userNotes/note_1` with `content.size() == 5000` (exceeding `2000` max).
12. **Client Timestamp Forgery**: Create `/userNotes/note_1` with a backdated `createdAt` (`!= request.time`) or `updatedAt != request.time`.
