# Security Specification: Resolvela

## 1. Data Invariants
- A **Job** must have a `clientId` that matches the authenticated user's UID (unless created by Admin).
- A **Bid** must have a `professionalId` matching the creator's UID.
- **Messages** can only be read or deleted by the `senderId` or `recipientId`.
- **Appointments** must involve the current user (either as `clientId` or `professionalId`).
- **Reviews** must be related to a completed job/appointment and involves the `reviewerId` (who must be the owner).
- **Admin** access is restricted to verified emails or users with `isAdmin: true` in their profile.

## 2. The "Dirty Dozen" Payloads (Deny-List)
1. **Identity Spoofing**: Create a job with `clientId: "victim_id"` as a different user.
2. **Admin Escalation**: Update own user profile setting `isAdmin: true`.
3. **Ghost Post**: Create a job with a 1MB description to bloat storage.
4. **ID Poisoning**: Delete a job using a path like `jobs/../../../system_config`.
5. **Relational Bypass**: Create a bid for a non-existent `jobId`.
6. **State Jumping**: Update a job status from 'Open' to 'Completed' without an appointment.
7. **Cross-Pollination**: Post a review for a job you weren't part of.
8. **Shadow Field Injection**: Update a job and include a `hidden_flag: true` field.
9. **Unverified Action**: Post a job without a verified email (if enforced).
10. **Immutable Field Attack**: Change `createdAt` on an existing job.
11. **PII Leak**: Read the `private/info` of another user.
12. **Recursive Cost Attack**: List queries that don't enforce `resource.data.ownerId == auth.uid`.

## 3. Test Runner (Draft)
A comprehensive test suite would verify that these payloads return `PERMISSION_DENIED`.
