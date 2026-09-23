# Frontend integration boundary

The application backend and AI agent are owned by Persons #1 and #2. This document describes existing UI behavior and unresolved agreements. It does not define a replacement backend protocol.

## Agreed chat envelope

`POST /api/chat`, JSON:

```json
{ "sessionId": "random-browser-session-id", "message": "027228 бар ма?", "attachmentIds": [] }
```

Return the exact shared `ChatResponse` from the brief. The adapter validates its structure. Optional values are not fabricated. Returned error JSON may contain `message`; that text is shown safely as text. Non-JSON and failed HTTP responses produce an error, never a demo fallback. Requests time out after 30 seconds.

### Explicit confirmation

Clicking a product cart button only opens a modal. Cancelling or pressing Escape sends nothing. Confirming sends a normal chat message in the same session, for example:

```json
{
  "sessionId": "same-session",
  "message": "Иә, қосу / Да, добавить в корзину: Legrand DRX250 MT (productId: 515291), 2 дана / шт..",
  "attachmentIds": []
}
```

There is no added `confirmed`, `actionId`, or invented endpoint. This message wording is an integration point for Person #2 to test with their agent. The frontend does not infer whether a backend mutation actually happened. It renders cart success only from `cart.success === true` and links only the backend-provided safe `cartUrl`. UI double-clicks are guarded while a send is pending. Backend replay/idempotency remains unresolved by the shared contract.

A received `pendingAction` offers a confirmation button with exactly the requested quantity. If its product is not included in the response, the modal shows the product ID and unknown price. Invalid quantities cannot be confirmed. Frontend does not clamp to stock or sum warehouse values.

## Upload boundary: agreement required

`POST /api/files` with multipart field `file`. Proposed success envelope consumed by the local adapter:

```json
{ "attachmentId": "backend-issued-id", "status": "processed" }
```

Only after this response may the attachment ID enter a chat request. A failure, unknown envelope or `processing` status does not become “processed.” Failed attachments must be removed/reselected. Removing an in-flight upload aborts the local request; no unagreed delete endpoint is called. Backend must clean up abandoned uploads. No MIME/extension check in the browser is a security boundary.

## Feedback boundary

`POST /api/feedback` with `{ "messageId": "server-issued-id", "rating": "up" }` or `"down"`. Accept a successful JSON response or HTTP 204. Repeated submissions are disabled after success, and failures show a non-blocking retry state. Shared `ChatResponse` has no message ID, so live feedback is unavailable until the following extension is agreed and enabled.

## Optional structured adapter fields — opt-in only

These types live solely in `apps/web/src/types/ui.ts`, not in `packages/shared`. Live responses use them only with `NEXT_PUBLIC_UI_EXTENSIONS=true`. Absent values are hidden. Malformed enabled extensions produce an error instead of silently displaying partial fabricated data.

```ts
type ResponseView = ChatResponse & {
  messageId?: string;
  analogs?: { product: Product; reasons: string[]; differences: string[] }[];
  estimate?: {
    rows: {
      requestText: string;
      product?: Product;
      status: 'found' | 'not_found' | 'analog';
      quantity: number;
      unitPrice?: number | null;
      subtotal?: number | null;
    }[];
    total?: number | null;
  };
  comparison?: Product[];
  freshness?: { updatedAt?: string; cacheAgeSeconds?: number; stale?: boolean };
};
```

`updatedAt` must be an ISO timestamp with timezone. Estimate totals/subtotals are displayed exactly as supplied. Missing prices are not treated as zero. Only the confirmation modal computes price × quantity from known values for the review display; it is not a checkout quote. Comparison shows only supplied brand, property keys, price and stock, without parsing technical values from names. All product data-quality warnings remain visible, including nested results.

## Person #1 TODOs

- Provide the application backend routes, allowed frontend origins/CORS, and application authentication as needed. Empty API base assumes deployment routing supplies same-origin `/api/*`; Next.js implements none here.
- Own EKT authentication, product detail and search APIs, pagination, normalized stock, cache, data quality and authoritative purchase terms.
- Agree the `/api/files` upload response, processing lifecycle, file security/limits, ownership and abandoned-file cleanup.
- Provide correct numeric prices/stock, source URLs, certificates and warnings. Resolve sample aggregate/store inconsistencies server-side; UI does not reconcile them.
- Supply actual cart provider behavior and successful cart URL. Enforce stock and requested quantities. Agree replay protection and a bulk-cart contract before enabling bulk UI in live mode.
- Provide feedback persistence and stable backend message IDs; agree freshness metadata if desired.

## Person #2 TODOs

- Own LLM, system prompt, intent recognition, session reasoning and response text; no frontend keyword routing exists.
- Test plain-text explicit confirmation in the existing chat envelope, binding it to the correct product, quantity, session and pending action. Never mutate without explicit confirmation, including free-text flows.
- Return explainable structured analog reasons and differences, and structured comparison/estimate outputs after a team agreement on the local adapter fields.
- Use uploaded attachment IDs to access backend extraction; return actual errors and missing-data statements.
- Coordinate ambiguity/cancellation/stale pending action handling and ensure a later message cannot accidentally execute an old action.

Do not enable optional live extensions or bulk cart merely to make a demonstration look complete.
