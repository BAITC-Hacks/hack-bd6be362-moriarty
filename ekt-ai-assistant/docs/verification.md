# Verification record

Verified locally on 2026-09-23 using Node.js, pnpm 11.19.0, Next.js 16.3.5 and Chromium 153 via Playwright 1.63.0.

- Production `pnpm build`: passed after final functional changes; static landing route and client assistant compiled with TypeScript checking.
- `pnpm test`: **9 passed**, 22.4 seconds in the final run.
- Desktop screenshots reviewed at 1440 × 1000; mobile screenshots reviewed at 375 × 740.
- Browser tests use mocked application-backend responses. Demo tests make no `/api/*` calls. These results do not establish real backend or EKT connectivity.

## Covered behavior

1. Exact agreed chat request envelope; safe rendering of script-like response text; warehouse values; certificate URL filtering; server message ID feedback.
2. Cart cancellation sends no request; double confirmation submits once; returned cart URL preserved.
3. Backend pending quantity remains unchanged; Escape cancels only the confirmation and retains the chat.
4. Processed uploads forward the returned attachment ID; extraction failure blocks sending.
5. HTTP and malformed-response failures remain errors without demo fallback; draft retained.
6. Missing price, stock, message ID and cart URL remain absent/unknown; quantity zero is blocked.
7. Structured analog differences, warnings, stale freshness, estimate missing prices and comparison; live bulk action disabled.
8. Explicit demo fixture selection, no claim of file parsing, and bulk confirmation before simulated success.
9. Desktop/mobile viewport fit, language switching, initial confirmation focus and horizontally scrollable comparison tables.

The checks uncovered and fixed two UI defects: nested Escape cancellation propagation, and a grid minimum-width constraint preventing mobile table scrolling. Physical device keyboard behavior and production backend integration remain unverified.

Screenshots contain either the empty UI or controlled test data; they are not evidence of live EKT inventory.
