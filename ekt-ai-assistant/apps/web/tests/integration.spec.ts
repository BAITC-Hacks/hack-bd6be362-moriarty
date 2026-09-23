import { test, expect, type Page } from "@playwright/test";

const product = {
  id: 515291,
  name: "Legrand DRX250 MT",
  article: "200300285_",
  price: 64920,
  quantity: 23,
  properties: { Current: "160A", Voltage: "400V" },
  stores: [
    { id: 1, name: "Алматы", quantity: 5 },
    { id: 2, name: "Empty warehouse", quantity: 0 },
  ],
  certificates: [
    {
      name: "Certificate from backend",
      url: "https://example.org/certificate.pdf",
    },
    { name: "Unsafe certificate", url: "javascript:alert(1)" },
  ],
  productUrl: "https://example.org/products/515291",
};
async function open(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "AI консультант", exact: true })
    .click();
}
async function send(page: Page, text = "027228 бар ма?") {
  await page
    .getByRole("textbox", { name: "Хабарлама", exact: true })
    .fill(text);
  await page.getByRole("button", { name: "Жіберу", exact: true }).click();
}

test("real chat envelope, exact stock, trusted links, and feedback ID", async ({
  page,
}) => {
  const requests: unknown[] = [];
  const feedback: unknown[] = [];
  await page.route("**/api/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        message: "Backend answer <script>alert(1)</script>",
        messageId: "server-message-1",
        products: [product],
      },
    });
  });
  await page.route("**/api/feedback", async (route) => {
    feedback.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await open(page);
  await send(page);
  await expect(
    page.getByText("Backend answer <script>alert(1)</script>", { exact: true }),
  ).toBeVisible();
  expect(requests[0]).toMatchObject({
    message: "027228 бар ма?",
    attachmentIds: [],
  });
  expect(Object.keys(requests[0] as object).sort()).toEqual([
    "attachmentIds",
    "message",
    "sessionId",
  ]);
  await page.getByText("Толық ақпарат", { exact: true }).click();
  await expect(page.getByText("Алматы", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Empty warehouse", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "Барлық қойманы көрсету" }).click();
  await expect(
    page.getByText("Empty warehouse", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Certificate from backend" }),
  ).toHaveAttribute("href", "https://example.org/certificate.pdf");
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.locator(".freshness")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Пайдалы жауап", exact: true })
    .click();
  await expect(page.getByText("Рахмет!", { exact: true })).toBeVisible();
  expect(feedback).toEqual([{ messageId: "server-message-1", rating: "up" }]);
});

test("cart cancel never submits; confirmation sends exactly once and uses returned cart link", async ({
  page,
}) => {
  const requests: { message: string; sessionId: string }[] = [];
  await page.route("**/api/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1)
      await route.fulfill({
        json: { message: "Product", products: [product] },
      });
    else {
      await new Promise((r) => setTimeout(r, 250));
      await route.fulfill({
        json: {
          message: "Confirmed by backend",
          cart: { success: true, cartUrl: "https://example.org/cart/actual" },
        },
      });
    }
  });
  await open(page);
  await send(page);
  const card = page.locator(".product-card");
  await card.getByRole("spinbutton").fill("2");
  await card.getByRole("button", { name: "Корзинаға қосу" }).click();
  const modal = page.getByRole("dialog", { name: "Корзинаға қосасыз ба?" });
  await expect(modal).toBeVisible();
  expect(requests).toHaveLength(1);
  await modal.getByRole("button", { name: "Бас тарту" }).click();
  expect(requests).toHaveLength(1);
  await card.getByRole("button", { name: "Корзинаға қосу" }).click();
  await modal
    .getByRole("button", { name: "Иә, қосу", exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect(
    page.getByRole("link", { name: "Корзинаға өту" }),
  ).toHaveAttribute("href", "https://example.org/cart/actual");
  expect(requests).toHaveLength(2);
  expect(requests[1].message).toContain("2 дана");
  expect(requests[1].sessionId).toBe(requests[0].sessionId);
});

test("backend pending action retains requested quantity; Escape cancels", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/chat", async (route) => {
    calls++;
    await route.fulfill({
      json: {
        message: "Stock authority stays on backend",
        products: [product],
        pendingAction: {
          type: "ADD_TO_CART",
          productId: product.id,
          quantity: 100,
        },
      },
    });
  });
  await open(page);
  await send(page);
  await page.getByRole("button", { name: "Қосуды растау · 100" }).click();
  await expect(page.getByText("Саны: 100", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Корзинаға қосасыз ба?" }),
  ).not.toBeVisible();
  expect(calls).toBe(1);
  await expect(
    page.getByRole("dialog", { name: "EKT AI консультант", exact: true }),
  ).toBeVisible();
});

test("upload uses backend attachment ID; failed extraction cannot be sent", async ({
  page,
}) => {
  const requests: { attachmentIds: string[] }[] = [];
  let fail = false;
  await page.route("**/api/files", (route) =>
    route.fulfill({
      json: fail
        ? { status: "failed", message: "Extraction failed" }
        : { status: "processed", attachmentId: "backend-file-42" },
    }),
  );
  await page.route("**/api/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { message: "Attachment received" } });
  });
  await open(page);
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "spec.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("test fixture; no parsing performed here"),
    });
  await expect(page.locator(".attachment.processed")).toBeVisible();
  await page.getByRole("button", { name: "Жіберу", exact: true }).click();
  await expect(
    page.getByText("Attachment received", { exact: true }),
  ).toBeVisible();
  expect(requests[0].attachmentIds).toEqual(["backend-file-42"]);
  fail = true;
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "bad.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("broken fixture"),
    });
  await expect(page.locator(".attachment.failed")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Жіберу", exact: true }),
  ).toBeDisabled();
  expect(requests).toHaveLength(1);
});

test("unavailable and malformed backend never fall back to demo; draft preserved", async ({
  page,
}) => {
  let invalid = false;
  await page.route("**/api/chat", (route) =>
    route.fulfill(
      invalid
        ? { json: { message: "Bad data", products: [{ price: "fake" }] } }
        : { status: 503, json: { message: "Catalog temporarily unavailable" } },
    ),
  );
  await open(page);
  await send(page, "Keep my draft");
  await expect(page.locator(".chat-error")).toContainText(
    "Catalog temporarily unavailable",
  );
  await expect(
    page.getByRole("textbox", { name: "Хабарлама", exact: true }),
  ).toHaveValue("Keep my draft");
  await expect(page.locator(".product-card")).toHaveCount(0);
  invalid = true;
  await page.getByRole("button", { name: "Жіберу", exact: true }).click();
  await expect(page.locator(".chat-error")).toContainText(
    "does not match ChatResponse",
  );
  await expect(page.locator(".product-card")).toHaveCount(0);
});

test("missing price, stock, message ID and cart URL stay absent", async ({
  page,
}) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      json: {
        message: "Incomplete",
        products: [{ id: 1, name: "Unknown", article: null, price: null }],
        cart: { success: true },
      },
    }),
  );
  await open(page);
  await send(page);
  await expect(
    page.getByText("Баға көрсетілмеген", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Корзинаға өту" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Пайдалы жауап", exact: true }),
  ).toBeDisabled();
  await page.getByRole("spinbutton").fill("0");
  await expect(
    page.getByRole("button", { name: "Корзинаға қосу" }),
  ).toBeDisabled();
});

test("structured explanations, data warnings, estimate and comparison render without bulk mutation", async ({
  page,
}) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      json: {
        message: "Structured",
        analogs: [
          {
            product,
            reasons: ["Backend reason"],
            differences: ["Backend difference"],
          },
        ],
        warnings: [{ field: "current", message: "Backend conflict" }],
        estimate: {
          rows: [
            {
              requestText: "Unknown price row",
              status: "found",
              product,
              quantity: 2,
              unitPrice: null,
              subtotal: null,
            },
          ],
          total: null,
        },
        comparison: [
          product,
          { ...product, id: 2, properties: { Current: "250A" } },
        ],
        freshness: { cacheAgeSeconds: 300, stale: true },
      },
    }),
  );
  await open(page);
  await send(page);
  await expect(page.getByText("Backend reason", { exact: true })).toBeVisible();
  await expect(
    page.getByText("⚠ Backend difference", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Backend conflict", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".freshness.stale")).toBeVisible();
  await expect(page.getByText("Баға жоқ", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Барлық табылған тауарды корзинаға қосу",
    }),
  ).toBeDisabled();
  await expect(page.getByText("250A", { exact: true })).toBeVisible();
});

test("demo is visibly separate, upload does not claim parsing, bulk requires confirmation", async ({
  page,
}) => {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) calls.push(request.url());
  });
  await page.goto("http://127.0.0.1:3101");
  await page
    .getByRole("button", { name: "AI консультант", exact: true })
    .click();
  await expect(page.locator(".demo-toolbar")).toContainText("Нақты EKT емес");
  await page.locator("#demo-scenario").selectOption("estimate");
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "demo.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("not parsed"),
    });
  await expect(page.locator(".attachment.processed")).toContainText(
    "файл оқылмады",
  );
  await page.getByRole("button", { name: "Жіберу", exact: true }).click();
  await page
    .getByRole("button", { name: "Барлық табылған тауарды корзинаға қосу" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Корзинаға қосасыз ба?" }),
  ).toBeVisible();
  await expect(page.locator(".cart-success")).toHaveCount(0);
  await page.getByRole("button", { name: "Иә, барлығын қосу" }).click();
  await expect(page.locator(".cart-success")).toContainText(
    "Нақты корзина өзгермеді",
  );
  expect(calls).toEqual([]);
});

test("desktop and narrow mobile: chat, focus, language, tables and modal fit", async ({
  page,
}) => {
  await page.goto("/");
  await page.screenshot({
    path: "../../screenshots/desktop-home.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "AI консультант", exact: true })
    .click();
  await page.screenshot({ path: "../../screenshots/desktop-chat.png" });
  await page.getByRole("button", { name: "РУС", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Сообщение", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ҚАЗ", exact: true }).click();
  await page.setViewportSize({ width: 375, height: 740 });
  await expect(
    page.getByRole("button", { name: "Жіберу", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "../../screenshots/mobile-chat.png" });
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      json: {
        message: "Mobile",
        products: [product],
        comparison: [product, product],
      },
    }),
  );
  await send(page);
  await page.getByRole("button", { name: "Корзинаға қосу" }).click();
  const modal = page.getByRole("dialog", { name: "Корзинаға қосасыз ба?" });
  await expect(modal).toBeInViewport();
  await expect(modal.getByRole("button", { name: "Бас тарту" })).toBeFocused();
  await page.screenshot({ path: "../../screenshots/mobile-confirmation.png" });
  await page.keyboard.press("Escape");
  expect(
    await page
      .locator(".chat-panel")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  expect(
    await page
      .locator(".table-scroll")
      .evaluate((e) => e.scrollWidth > e.clientWidth),
  ).toBe(true);
});
