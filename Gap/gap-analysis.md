# PalletTrack Pro Gap Analysis

This document tracks known gaps separately from requested business customizations. Priorities can be adjusted after real-device testing and stakeholder feedback.

## P0: Before Production Release

- Hide demo accounts and passwords unless an explicit testing environment flag is enabled.
- Verify every API route enforces the same role permissions as its corresponding page.
- Restrict notification updates to the notification owner or an authorized administrator.
- Restrict command-center and label-print update APIs to approved roles.
- Replace instance-memory login throttling with a shared production rate limiter.
- Revalidate user activation and role changes during active sessions.
- Disable or strongly isolate database reset and demo seed functions in production.
- Validate the Vercel-to-Hostinger MySQL connection, TLS settings, connection limits, and pooling strategy.
- Add a deployment migration step so production schema migrations are applied safely.
- Rotate any credential that may previously have been exposed.

## Mobile And Tablet UX

- Complete physical-device QA on Android phones, iPhones, iPads, Android tablets, laptops, and desktop browsers.
- Test at 320px, 375px, 390px, 768px, 820px, 1024px, and landscape orientations.
- Consider role-specific bottom navigation for scanning and other frequent operational tasks.
- Replace remaining wide operational tables with mobile card views where horizontal scrolling slows field work.
- Convert long scanner workflows into short, progressive steps with clearer completion states.
- Add sticky mobile action areas for long forms and lifecycle confirmations.
- Add skeleton loading states and clearer empty, error, retry, and connection states.
- Validate camera permission recovery, torch behavior, low-light scanning, and manual-code fallback on real devices.
- Add vibration or sound confirmation after successful scans where supported and permitted.
- Review all text, labels, and terminology with actual warehouse and logistics users.

## PWA And Offline Capability

- Verify Android native installation from the deployed HTTPS Vercel URL.
- Verify iPhone and iPad installation through Safari's Share > Add to Home Screen flow.
- Test service-worker upgrades after every deployment and confirm old versions update cleanly.
- Add an in-app installation option under Settings or the user menu after the reminder is dismissed.
- Add online/offline status indicators.
- Add offline scanning with a local queue and conflict-safe synchronization.
- Define which data may be stored offline and how sensitive cached data is cleared on sign-out.
- Add web push subscription storage, permission UX, and server-side notification delivery.
- Add notification preference controls by user and notification type.
- Add PWA install and update automated checks where feasible.

## Pallet Lifecycle And Data Integrity

- Create damage records whenever a pallet is marked damaged and resolve them after repair.
- Correct trip counting so repair completion does not count as a completed delivery cycle.
- Clear or update return due dates and stale locations at the correct lifecycle transitions.
- Prevent concurrent scans from applying duplicate or out-of-order transitions.
- Make pallet overrides, movements, notifications, and audit entries atomic database transactions.
- Correct admin overrides so movement actions accurately describe the selected status change.
- Add relational integrity for truck and assigned driver records.
- Define structured schemas for movement metadata instead of relying on unrestricted JSON.
- Define retention rules for personal information such as driver and receiver contact details.

## Validation And API Quality

- Add shared Zod schemas for every API mutation and query.
- Enforce string lengths, required fields, enum values, numeric limits, and payload size limits.
- Standardize API success and error response formats.
- Add idempotency protection for scan and lifecycle mutation requests.
- Add pagination, filtering, and limits for pallet, audit, notification, and report endpoints.
- Add request tracing and production-safe structured logging.

## Reports And Notifications

- Correct driver delivery reporting so dispatches and completed deliveries are not treated as the same metric.
- Correct return-performance reports after lifecycle due-date handling is fixed.
- Add scheduled jobs for overdue returns, dwell-time alerts, delayed deliveries, and low inventory.
- Add report pagination and server-generated exports for large datasets.
- Add configurable report date ranges, saved filters, and role-specific report access.
- Add email or push delivery for critical alerts where required.

## Testing And Quality Assurance

- Add unit tests for pallet state transitions and role permissions.
- Add API integration tests against an isolated test database.
- Add authentication and authorization regression tests.
- Add end-to-end tests for registration, loading, dispatch, delivery, return, damage, repair, and retirement.
- Add responsive visual tests for key mobile and tablet breakpoints.
- Add accessibility tests for keyboard navigation, focus management, contrast, labels, and screen readers.
- Add PWA manifest, service-worker, installation, and offline fallback tests.
- Add continuous integration to run lint, tests, type checks, and production builds for every pull request.

## Performance And Scalability

- Paginate large lists and avoid loading complete tables into browser memory.
- Profile report queries and add database indexes based on real production usage.
- Review Prisma connection behavior under Vercel serverless concurrency.
- Add monitoring for slow queries, API latency, errors, and failed lifecycle actions.
- Reduce large client bundles and lazy-load scanner and QR-specific dependencies when practical.
- Add image and attachment storage strategy before implementing damage photos or signatures.

## Accessibility And Usability

- Complete a WCAG-focused audit after business customization stabilizes.
- Ensure all interactive controls have visible focus states and accessible names.
- Confirm color is never the only indicator of pallet status or errors.
- Verify modal focus trapping and focus restoration.
- Add confirmation and undo patterns where operations are reversible.
- Review date, time, number, currency, and language localization requirements.

## Architecture And Maintenance

- Migrate deprecated `middleware.ts` to the Next.js 16 proxy convention.
- Move Prisma configuration from deprecated `package.json#prisma` to `prisma.config.ts` before Prisma 7.
- Consolidate or remove the unused legacy pallet list component.
- Consider moving the shared admin shell into the admin layout to avoid repeated page composition.
- Add a tracked environment-variable template without secret values.
- Document local development, migration, seeding, Vercel deployment, and rollback procedures.
- Add release environment separation for development, testing, staging, and production.

## Future Product Capabilities

- Damage photo capture and secure upload storage.
- Receiver signatures and proof of delivery.
- Barcode support in addition to QR codes if required by partners.
- Bulk scan and batch lifecycle operations.
- Customer or supplier portal with restricted pallet visibility.
- Geolocation or map integration where legally and operationally appropriate.
- Configurable pallet types, lifecycle policies, sites, warehouses, and organizations.
- Data import/export and integration APIs for ERP or warehouse systems.

## Real-Device Test Checklist

- Install, launch, close, and reopen the PWA.
- Confirm standalone display, icon quality, splash behavior, and theme colors.
- Sign in with each operational role and verify only permitted navigation is shown.
- Open and close the navigation drawer in portrait and landscape.
- Test all forms with the virtual keyboard open.
- Test tables, cards, filters, dialogs, and long text without clipping.
- Scan valid, invalid, damaged, and low-quality QR labels.
- Deny and then re-enable camera permission.
- Switch between Wi-Fi and mobile data during an operation.
- Test offline fallback and reconnection behavior.
- Verify printing and label previews from supported devices.
- Verify sign-out and confirm no sensitive operational data remains visible.
