import { test, expect } from "@playwright/test";
import { loginAs, parseCookies, seedSession } from "./helpers";
import { API_URL } from "./scenario";

test("login page shows Google sign-in button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("以 Google 帳號繼續")).toBeVisible();
  await expect(page.getByText("Zumeet")).toBeVisible();
});

test("onboarding: new user selects role and agrees to ToS", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByText("歡迎加入 Zumeet")).toBeVisible();

  await page.getByRole("button", { name: "租客" }).click();
  await page.getByRole("checkbox").click();
  await expect(
    page.getByRole("button", { name: "完成設定，開始使用" })
  ).toBeEnabled();
});

test("tenant dashboard loads after seeded session", async ({
  page,
  request,
}) => {
  const res = await request.post(`${API_URL}/test/auth/seed`, {
    data: { email: "e2e-tenant@example.com", role: "tenant" },
  });
  expect(res.ok()).toBeTruthy();

  const url = new URL(process.env.BASE_URL || "http://localhost:3000");
  const cookies = parseCookies(res.headers()["set-cookie"] ?? "", url.hostname);
  await loginAs(page, cookies);

  await page.goto("/dashboard/tenant");
  await expect(page.getByText("我的找房需求卡")).toBeVisible();
});

test("seedSession helper authenticates browser and allows dashboard access", async ({
  page,
  request,
}) => {
  await seedSession(request, page, "e2e-seed-helper@example.com", "tenant");
  await page.goto("/dashboard/tenant");
  await expect(page.getByText("我的找房需求卡")).toBeVisible();
});
