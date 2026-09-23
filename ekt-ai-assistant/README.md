# HACKALEM AI — frontend handoff

Person #3 scope only: Next.js App Router, TypeScript, Tailwind, frontend components, API client and explicit demo fixtures. The supplied workspace was empty. No teammate-owned backend, agent or shared files were created or modified.

## Run

Use Node.js 22+ and pnpm 11.19.0. From this folder:

```sh
cd apps/web
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

On PowerShell, use `Copy-Item .env.example .env.local` instead of `cp` if preferred. Open http://127.0.0.1:3000 and click **AI консультант**. The development server binds to loopback by default.

```sh
pnpm typecheck
pnpm build
pnpm start
pnpm exec playwright install chromium
pnpm test
```

Tests start isolated live-adapter and demo servers on ports 3100/3101 and intercept application backend requests in the browser. These tests do not test or implement a real backend. Screenshots are saved to `screenshots/` at the project root. To use a physical phone on a trusted local network, start `pnpm exec next dev --hostname 0.0.0.0` and use your computer's LAN address.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | empty | Application backend origin; empty calls same-origin `/api/*`. Example: `http://localhost:8000`. No EKT host or credentials. |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | `true` enables visibly labeled, deterministic UI fixtures. It never activates automatically after a live failure. |
| `NEXT_PUBLIC_UI_EXTENSIONS` | `false` | Enable only after teammates approve the optional response fields in `docs/frontend-integration.md`. |

No secrets are required. `NEXT_PUBLIC_*` values are bundled into browser code; restart development or rebuild production after changing them. Internal test variable `NEXT_DIST_DIR` isolates build output and is not an integration setting.

## Components implemented

- ChatLauncher, ChatPanel, ChatHeader, MessageList, MessageBubble, MessageComposer, QuickSuggestions.
- ProductCard, ProductDetails, StockList, CertificateList, AnalogCard, DataWarning, DataFreshnessBadge.
- FileUploader, FileAttachmentPreview, ConfirmationModal, CartSuccess.
- SpecEstimateView, ProductCompareView, MessageFeedback.

The chat supports Kazakh and Russian UI, native modal keyboard focus and Escape behavior, warehouse expansion, attachment states, loading/errors, and mobile full-screen layout. The surrounding demonstration landing page is Kazakh. AI/backend messages are rendered as text and retain the language returned by the backend.

## Integration and scope

The client calls only `POST /api/chat`, `POST /api/files`, and `POST /api/feedback` on the application backend. There are no API routes, EKT credentials, product search algorithms, ranking, file parsing, OCR, AI calls, databases, or cart implementations in this deliverable.

`src/types/contract.ts` is an unchanged local fallback of the supplied contract. When merging into the team repository, point the `@contract` path in `apps/web/tsconfig.json` to the actual `packages/shared/types.ts` (for this layout: `../../packages/shared/types.ts`) and resolve any differences against the actual shared contract. Do not copy the fallback over teammates' types.

See [frontend integration and teammate TODOs](docs/frontend-integration.md), [demo instructions](docs/demo-script.md), and [created-file inventory](docs/files-created.md).

## Known limitations

- There is no backend in this workspace. Default/live requests return honest unavailable states until the application backend is configured or routed on the same origin. No end-to-end live EKT integration has been claimed.
- The supplied shared contract lacks server message IDs, structured analog explanations, estimates, comparisons, and freshness. Those optional UI adapters are off in live mode by default. Feedback buttons remain disabled without a server-provided message ID; browser-generated IDs are never substituted.
- Upload response shape is proposed, not agreed. Only `{ attachmentId, status: "processed" }` is accepted as successful processing. Async jobs/polling and other backend envelopes require an agreed adapter. There is no frontend parsing. UI limits are 20 MiB per file and five attachments per draft; backend security and limits remain authoritative.
- Single-cart confirmation sends explicit text through the unchanged chat envelope. Person #2 must enforce confirmation, correct action binding, quantity/stock rules and duplicate protection server-side. Free-text chat can also express confirmation; frontend UI cannot replace agent-side enforcement.
- Bulk cart is disabled in live mode because no bulk contract exists. Its confirmation interaction is demonstrable only in explicit demo mode. Only rows marked `found` are included; analogs require separate confirmation.
- A failed confirmation response can mean an unknown result. The UI asks the user to check their cart before repeating; it never retries mutations automatically. There is no idempotency protocol in the supplied contract.
- Demo uses manually selected scenarios. It does not interpret chat intent, parse files, or mutate a real cart. Its success fixture deliberately has no cart URL.
- Chat history and selected language live in React memory. Only a random session ID is held in sessionStorage. Reloading clears the visible transcript. Authentication/history and manager escalation are outside this frontend delivery.
- “Онлайн” means a chat response was received in this UI session, not a continuous health check. Missing freshness stays hidden; supplied cache age is displayed without inventing an update time.
- Automated browser coverage is Chromium with desktop/mobile viewport tests. A physical iOS/Android keyboard and cross-browser review remain recommended before deployment.

Framework setup follows the official [Next.js App Router installation guide](https://nextjs.org/docs/app/getting-started/installation) and [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
