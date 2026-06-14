import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";
import { API_URL, Scenario } from "./scenario";

test.describe("match flow: tenant browses and interests landlord listing", () => {
  test("tenant can browse matching listings and express interest", async ({
    page,
    request,
  }) => {
    const s = new Scenario(request);
    const landlord = await s.createLandlordWithListing({
      email: "e2e-ll-browse@example.com",
      listing: { rent: 18000 },
    });
    const tenant = await s.createTenantWithProfile({
      email: "e2e-t-browse@example.com",
    });

    await loginAs(page, tenant.cookies);
    await page.goto("/dashboard/tenant");
    await page.getByRole("button", { name: "找房源" }).click();
    await expect(page.getByText("$18,000")).toBeVisible();

    const interestRes = await request.post(
      `${API_URL}/api/v1/tenant-profiles/${tenant.profileId}/listings/${landlord.listingId}/interest`
    );
    expect(interestRes.ok()).toBeTruthy();
    expect((await interestRes.json()).status).toBe("pending");
  });
});

test.describe("mutual match: contact info revealed after both express interest", () => {
  test("contact info visible after mutual match", async ({ page, request }) => {
    const s = new Scenario(request);

    // Landlord side: seed + listing
    const landlord = await s.createLandlordWithListing({
      email: "e2e-ll-match@example.com",
      listing: { contact_info: "Line: mutual-landlord" },
    });

    // Tenant side: seed + profile + express interest
    const tenant = await s.createTenantWithProfile({
      email: "e2e-t-match@example.com",
      profile: { contact_info: "Line: mutual-tenant" },
    });
    await loginAs(page, tenant.cookies);

    const tInterest = await request.post(
      `${API_URL}/api/v1/tenant-profiles/${tenant.profileId}/listings/${landlord.listingId}/interest`
    );
    expect((await tInterest.json()).status).toBe("pending");

    // Playwright's request fixture has its own cookie jar (separate from page context).
    // Re-seed as landlord so the next request.post call is authenticated as landlord.
    await request.post(`${API_URL}/test/auth/seed`, {
      data: { email: landlord.email, role: "landlord" },
    });
    await loginAs(page, landlord.cookies);
    const lInterest = await request.post(
      `${API_URL}/api/v1/listings/${landlord.listingId}/tenant-profiles/${tenant.profileId}/interest`
    );
    const lBody = await lInterest.json();
    expect(lBody.status).toBe("matched");
    expect(lBody.contact_info).toBe("Line: mutual-tenant");

    // Tenant sees landlord contact on the matches page
    await loginAs(page, tenant.cookies);
    await page.goto("/dashboard/tenant");
    await page.getByRole("button", { name: "已媒合" }).click();
    await expect(page.getByText("Line: mutual-landlord")).toBeVisible();
    await expect(page.getByText("自填資料，平台不保證真實性")).toBeVisible();
  });
});

test.describe("block: blocked user disappears from all lists", () => {
  test("after blocking landlord, their listing disappears from browse", async ({
    page,
    request,
  }) => {
    const s = new Scenario(request);
    const landlord = await s.createLandlordWithListing({
      email: "e2e-ll-block@example.com",
      listing: { contact_info: "Line: blocked-landlord" },
    });
    const tenant = await s.createTenantWithProfile({
      email: "e2e-t-block@example.com",
    });

    await loginAs(page, tenant.cookies);

    // Verify listing appears before block
    const beforeBlock = await request.get(
      `${API_URL}/api/v1/tenant-profiles/${tenant.profileId}/listings?limit=50`
    );
    const beforeBody = await beforeBlock.json();
    expect(
      beforeBody.items.some((l: { id: string }) => l.id === landlord.listingId)
    ).toBeTruthy();

    // Re-seed as landlord so request.get is authenticated as landlord.
    await request.post(`${API_URL}/test/auth/seed`, {
      data: { email: landlord.email, role: "landlord" },
    });
    await loginAs(page, landlord.cookies);
    const meRes = await request.get(`${API_URL}/api/v1/profile/me`);
    const landlordId = (await meRes.json()).id as string;

    // Re-seed as tenant so request is authenticated as tenant again.
    await request.post(`${API_URL}/test/auth/seed`, {
      data: { email: tenant.email, role: "tenant" },
    });
    await loginAs(page, tenant.cookies);
    const blockRes = await request.post(`${API_URL}/api/v1/blocks/${landlordId}`);
    expect(blockRes.ok()).toBeTruthy();

    // Verify listing no longer appears via API
    const afterBlock = await request.get(
      `${API_URL}/api/v1/tenant-profiles/${tenant.profileId}/listings?limit=50`
    );
    const afterBody = await afterBlock.json();
    expect(
      afterBody.items.some((l: { id: string }) => l.id === landlord.listingId)
    ).toBeFalsy();

    // Verify on UI
    await page.goto("/dashboard/tenant");
    await page.getByRole("button", { name: "找房源" }).click();
    await expect(page.getByText("Line: blocked-landlord")).not.toBeVisible();
  });
});

test.describe("account deletion: data disappears after delete", () => {
  test("after account deletion, API returns 401 and data is gone", async ({
    request,
  }) => {
    const s = new Scenario(request);
    const tenant = await s.createTenantWithProfile({
      email: "e2e-delete@example.com",
      profile: { name: "刪帳測試", contact_info: "Line: delete-test" },
    });

    const delRes = await request.delete(`${API_URL}/api/v1/account`);
    expect(delRes.ok()).toBeTruthy();

    const meRes = await request.get(`${API_URL}/api/v1/profile/me`);
    expect(meRes.status()).toBe(401);

    const profileCheck = await request.get(
      `${API_URL}/api/v1/tenant-profiles/${tenant.profileId}`
    );
    expect(profileCheck.status()).toBe(401);
  });
});
