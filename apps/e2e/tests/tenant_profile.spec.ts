import { expect, test } from "@playwright/test";
import { seedSession } from "./helpers";

const API_URL = process.env.API_URL || "http://localhost:8080";

test.describe("tenant profile creation via UI", () => {
  test("tenant can create a new profile and see it in the list", async ({
    page,
    request,
  }) => {
    // 1. Seed a tenant session
    await seedSession(request, page, "playwright-tenant@test.com", "tenant");

    // 2. Navigate to tenant dashboard
    await page.goto("/dashboard/tenant");

    // 3. Confirm we're on the profiles tab
    await expect(page.getByText("我的找房需求卡")).toBeVisible();

    // 4. Click "新增需求卡"
    await page.getByRole("button", { name: "+ 新增需求卡" }).click();

    // 5. Modal should appear (heading in modal)
    await expect(page.getByRole("heading", { name: "新增需求卡" })).toBeVisible();

    // 6. Fill in the form
    // Name
    await page.getByLabel("需求名稱（如：台北套房）").fill("測試需求卡");

    // Budget
    await page.getByLabel("最低預算（元）").fill("10000");
    await page.getByLabel("最高預算（元）").fill("25000");

    // Location: click 台北・大安
    await page.getByRole("button", { name: "台北・大安" }).click();

    // Room type: 套房
    await page.getByRole("button", { name: "套房" }).click();

    // Available from: future date
    await page.getByLabel("最快入住日").fill("2026-09-01");

    // Min lease months
    await page.getByLabel("最短租期（月）").fill("6");

    // Contact info (required)
    await page.getByLabel("聯絡方式（媒合成功後才對房東顯示）").fill("Line: playwright-test");

    // 7. Submit
    await page.getByRole("button", { name: "儲存需求卡" }).click();

    // 8. Modal should close and profile should appear in the list
    await expect(page.getByText("測試需求卡")).toBeVisible();
    await expect(page.getByText("$10,000–$25,000")).toBeVisible();
  });

  test("tenant profile list shows profile after API creation", async ({
    page,
    request,
  }) => {
    // Seed session
    await seedSession(request, page, "playwright-tenant-api@test.com", "tenant");

    // Create profile via API directly (available_from must be RFC3339)
    const profileRes = await request.post(`${API_URL}/api/v1/tenant-profiles`, {
      data: {
        name: "API直建需求卡",
        budget_min: 12000,
        budget_max: 20000,
        locations: ["taipei-daan"],
        preferred_room_types: ["suite"],
        available_from: "2026-09-01T00:00:00Z",
        min_lease_months: 6,
        has_pets: false,
        needs_subsidy: false,
        needs_tax_receipt: false,
        needs_household_registration: false,
        needs_cooking: false,
        needs_parking: false,
        smoking: false,
        contact_info: "Line: api-test",
      },
    });
    expect(profileRes.ok()).toBeTruthy();
    const profileBody = await profileRes.json();
    expect(profileBody.id).toBeTruthy();

    // Navigate to dashboard
    await page.goto("/dashboard/tenant");

    // Profile should appear in the list
    await expect(page.getByText("我的找房需求卡")).toBeVisible();
    await expect(page.getByText("API直建需求卡")).toBeVisible();
    await expect(page.getByText("啟用中")).toBeVisible();
  });
});
