import { test, expect } from "@playwright/test";

test("login page shows Google sign-in button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("以 Google 帳號繼續")).toBeVisible();
  await expect(page.getByText("Zumeet")).toBeVisible();
});

test("onboarding: new user selects role and agrees to ToS", async ({
  page,
  request,
}) => {
  // Navigate directly to onboarding (simulates post-OAuth redirect)
  const API_URL = process.env.API_URL || "http://localhost:8080";

  // Seed a pre-onboarding state by going to the onboarding page directly
  await page.goto("/onboarding");
  await expect(page.getByText("歡迎加入 Zumeet")).toBeVisible();

  // Select role
  await page.getByRole("button", { name: "租客" }).click();

  // Agree to ToS
  await page.getByRole("checkbox").click();

  // Submit button should be enabled
  await expect(page.getByRole("button", { name: "完成設定，開始使用" })).toBeEnabled();
});

test("tenant dashboard loads after seeded session", async ({
  page,
  request,
}) => {
  const API_URL = process.env.API_URL || "http://localhost:8080";

  // Seed a session via test endpoint
  const res = await request.post(`${API_URL}/test/auth/seed`, {
    data: { email: "e2e-tenant@example.com", role: "tenant" },
  });
  expect(res.ok()).toBeTruthy();

  // Set cookies in browser
  const setCookieHeader = res.headers()["set-cookie"] ?? "";
  if (setCookieHeader) {
    const cookieParts = setCookieHeader.split(";").map((p) => p.trim());
    const [name, value] = cookieParts[0].split("=");
    await page.context().addCookies([
      {
        name: name.trim(),
        value: value ?? "",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  }

  await page.goto("/dashboard/tenant");
  await expect(page.getByText("我的找房需求卡")).toBeVisible();
});
