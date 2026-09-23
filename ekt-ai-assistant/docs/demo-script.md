# Frontend demonstration

## Prepare

1. Install dependencies as described in README.
2. Copy `apps/web/.env.example` to `.env.local` and set `NEXT_PUBLIC_DEMO_MODE=true`.
3. Start `pnpm dev` from `apps/web`; open http://127.0.0.1:3000.
4. Click **AI консультант**. Point out the persistent Demo badge and sample-data statement. Demo is an offline fixture presentation, not a live catalog/agent demonstration.

The scenario selector chooses the next fixture response. Every quick suggestion still submits a real UI message through the client boundary; demo mode deliberately substitutes the fixture adapter. Text is never interpreted by a frontend AI or keyword matcher. Select each scenario explicitly before sending its prompt.

## Flow A — product, stock, analog, confirmation

1. Select `product`. Send “Маған Legrand 160A үш фазалы автомат керек”. Show the product card, sample price and properties. Its missing image is a neutral placeholder. No certificates or URLs are fabricated.
2. Select `stock`. Send “Алматыда бар ма?”. Open **Толық ақпарат**. Show individual backend-shaped warehouse values and **Барлық қойманы көрсету**. The stale freshness sample is explicitly part of Demo.
3. Select `analog`. Send “Аналог көрсет”. Show recommendation reasons and the 18 kA → 25 kA difference. No frontend ranking occurs.
4. Select `cart`. Send “2 дана керек”. Click **Қосуды растау · 2**. Verify quantity 2, unit price and total. Cancel first: no request is submitted.
5. Reopen confirmation and click **Иә, қосу**. Show the simulated success and “real cart unchanged” notice. This fixture supplies no cart URL. Live mode renders a direct link only when the backend returns one.

## Flow B — specification

1. Select `estimate`.
2. Attach a small Excel/PDF file. Demo explicitly says the file was not read; bytes are not uploaded or parsed.
3. Send the attachment. Show the prewritten found/analog/not-found rows, missing-price indication and supplied partial total.
4. Click **Барлық табылған тауарды корзинаға қосу**. Inspect the modal list: only `found` rows are included; analogs need separate approval. Cancel or explicitly confirm the sample.
5. Explain that live bulk cart stays disabled until the team supplies an agreed contract.

## Other review scenarios

- `compare`: side-by-side values without inferred technical fields.
- `warning`: conflicting current values stay visible, with source details.
- `missing`: missing price and stock remain unknown.
- `error`: an honest failure state, with no replacement product cards. The draft remains available to resend.
- Toggle ҚАЗ/РУС and test a narrow phone viewport. Escape dismisses the top confirmation first. Close/reopen the panel to show in-memory chat persistence.

## Live rehearsal with teammates

Set `NEXT_PUBLIC_DEMO_MODE=false`, configure the application backend origin, and restart. Keep `NEXT_PUBLIC_UI_EXTENSIONS=false` until the local adapter fields have been approved. Repeat Flow A against the real agent; verify that no cart mutation occurs before explicit confirmation and that the returned cart URL opens the actual cart. Repeat upload with the agreed backend envelope. Never describe a mocked test or fixture as live EKT data.
