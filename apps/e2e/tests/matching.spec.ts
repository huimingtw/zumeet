import { test, expect } from "@playwright/test";

const API_URL = process.env.API_URL || "http://localhost:8080";

async function apiCookies(request: Parameters<typeof test>[1]["request"], email: string, role: "tenant" | "landlord") {
  const res = await request.post(`${API_URL}/test/auth/seed`, {
    data: { email, role },
  });
  if (!res.ok()) throw new Error(`seed failed: ${await res.text()}`);
  return res;
}

// Helper: set a single httpOnly cookie in the browser context
async function setCookiesFromSeedResponse(
  page: Parameters<typeof test>[1]["page"],
  res: Awaited<ReturnType<typeof apiCookies>>
) {
  const header = res.headers()["set-cookie"] ?? "";
  if (!header) return;
  // Only pick the access token cookie
  const cookies = header
    .split(/,(?=[^ ].*?=)/)
    .map((raw) => {
      const parts = raw.split(";").map((p) => p.trim());
      const [name, value] = parts[0].split("=");
      return {
        name: name.trim(),
        value: value ?? "",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      };
    });
  await page.context().addCookies(cookies);
}

test.describe("match flow: tenant browses and interests landlord listing", () => {
  test("tenant can browse matching listings and express interest", async ({
    page,
    request,
  }) => {
    // Seed landlord + listing via API
    const llRes = await apiCookies(request, "e2e-ll-browse@example.com", "landlord");
    await setCookiesFromSeedResponse(page, llRes);

    const listingRes = await request.post(`${API_URL}/api/v1/listings`, {
      data: {
        location_id: "taipei-daan",
        rent: 18000,
        room_type: "suite",
        area_ping: 10,
        available_from: "2025-08-01",
        min_lease_months: 6,
        allow_pets: true,
        allow_subsidy: false,
        allow_tax_receipt: false,
        allow_household_registration: false,
        allow_cooking: false,
        has_parking: false,
        allow_smoking: false,
        contact_info: "Line: landlord-e2e",
        compliance_confirmed: true,
      },
    });
    expect(listingRes.ok()).toBeTruthy();
    const listingBody = await listingRes.json();
    const listingId = listingBody.id;

    // Upload a photo and activate
    const photoRes = await request.post(
      `${API_URL}/api/v1/listings/${listingId}/photos`,
      {
        multipart: {
          photo: {
            name: "test.jpg",
            mimeType: "image/jpeg",
            // 1×1 white JPEG
            buffer: Buffer.from(
              "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEA/8QAHRAAAgIDAQEBAAAAAAAAAAAAAQIDBAUREiH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AqnFGqa2r6hqUOnatLY2kPlxQQoqRxr7AAooA/9k=",
              "base64"
            ),
          },
        },
      }
    );
    expect(photoRes.ok()).toBeTruthy();

    await request.patch(`${API_URL}/api/v1/listings/${listingId}/status`, {
      data: { status: "active" },
    });

    // Now seed tenant session
    const tRes = await apiCookies(request, "e2e-t-browse@example.com", "tenant");
    // Clear landlord cookies and set tenant cookies
    await page.context().clearCookies();
    await setCookiesFromSeedResponse(page, tRes);

    // Create tenant profile via API
    const profileRes = await request.post(`${API_URL}/api/v1/tenant-profiles`, {
      data: {
        name: "找房需求",
        budget_min: 10000,
        budget_max: 25000,
        locations: ["taipei-daan"],
        preferred_room_types: ["suite"],
        available_from: "2025-08-01",
        min_lease_months: 6,
        has_pets: false,
        needs_subsidy: false,
        needs_tax_receipt: false,
        needs_household_registration: false,
        needs_cooking: false,
        needs_parking: false,
        smoking: false,
        contact_info: "Line: tenant-e2e",
      },
    });
    expect(profileRes.ok()).toBeTruthy();
    const profileBody = await profileRes.json();
    const profileId = profileBody.id;

    // Browse listings
    await page.goto("/dashboard/tenant");
    await page.getByRole("button", { name: "找房源" }).click();
    await expect(page.getByText("$18,000")).toBeVisible();

    // Express interest via API and check the response
    const interestRes = await request.post(
      `${API_URL}/api/v1/tenant-profiles/${profileId}/listings/${listingId}/interest`
    );
    expect(interestRes.ok()).toBeTruthy();
    const interestBody = await interestRes.json();
    expect(interestBody.status).toBe("pending");
  });
});

test.describe("mutual match: contact info revealed after both express interest", () => {
  test("contact info visible after mutual match", async ({ page, request }) => {
    // Seed landlord + listing
    const llRes = await apiCookies(request, "e2e-ll-match@example.com", "landlord");
    await page.context().clearCookies();
    await setCookiesFromSeedResponse(page, llRes);

    const listingRes = await request.post(`${API_URL}/api/v1/listings`, {
      data: {
        location_id: "taipei-daan",
        rent: 20000,
        room_type: "suite",
        area_ping: 12,
        available_from: "2025-08-01",
        min_lease_months: 6,
        allow_pets: false,
        allow_subsidy: false,
        allow_tax_receipt: false,
        allow_household_registration: false,
        allow_cooking: false,
        has_parking: false,
        allow_smoking: false,
        contact_info: "Line: mutual-landlord",
        compliance_confirmed: true,
      },
    });
    const listingId = (await listingRes.json()).id;

    const photoRes = await request.post(
      `${API_URL}/api/v1/listings/${listingId}/photos`,
      {
        multipart: {
          photo: {
            name: "test.jpg",
            mimeType: "image/jpeg",
            buffer: Buffer.from(
              "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEA/8QAHRAAAgIDAQEBAAAAAAAAAAAAAQIDBAUREiH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AqnFGqa2r6hqUOnatLY2kPlxQQoqRxr7AAooA/9k=",
              "base64"
            ),
          },
        },
      }
    );
    expect(photoRes.ok()).toBeTruthy();
    await request.patch(`${API_URL}/api/v1/listings/${listingId}/status`, {
      data: { status: "active" },
    });

    // Seed tenant
    const tRes = await apiCookies(request, "e2e-t-match@example.com", "tenant");
    await page.context().clearCookies();
    await setCookiesFromSeedResponse(page, tRes);

    const profileRes = await request.post(`${API_URL}/api/v1/tenant-profiles`, {
      data: {
        name: "媒合測試",
        budget_min: 15000,
        budget_max: 25000,
        locations: ["taipei-daan"],
        preferred_room_types: ["suite"],
        available_from: "2025-08-01",
        min_lease_months: 6,
        has_pets: false,
        needs_subsidy: false,
        needs_tax_receipt: false,
        needs_household_registration: false,
        needs_cooking: false,
        needs_parking: false,
        smoking: false,
        contact_info: "Line: mutual-tenant",
      },
    });
    const profileId = (await profileRes.json()).id;

    // Tenant expresses interest
    const tInterest = await request.post(
      `${API_URL}/api/v1/tenant-profiles/${profileId}/listings/${listingId}/interest`
    );
    expect((await tInterest.json()).status).toBe("pending");

    // Landlord expresses interest (switch session)
    await page.context().clearCookies();
    await setCookiesFromSeedResponse(page, llRes);

    const lInterest = await request.post(
      `${API_URL}/api/v1/listings/${listingId}/tenant-profiles/${profileId}/interest`
    );
    const lInterestBody = await lInterest.json();
    expect(lInterestBody.status).toBe("matched");
    // Landlord immediately sees tenant's contact
    expect(lInterestBody.contact_info).toBe("Line: mutual-tenant");

    // Tenant checks mutual matches — should see landlord's contact
    await page.context().clearCookies();
    await setCookiesFromSeedResponse(page, tRes);

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
    // Seed landlord + listing
    const llRes = await apiCookies(request, "e2e-ll-block@example.com", "landlord");
    await page.context().clearCookies();
    await setCookiesFromSeedResponse(page, llRes);

    const listingRes = await request.post(`${API_URL}/api/v1/listings`, {
      data: {
        location_id: "taipei-daan",
        rent: 20000,
        room_type: "suite",
        area_ping: 10,
        available_from: "2025-08-01",
        min_lease_months: 6,
        allow_pets: false,
        allow_subsidy: false,
        allow_tax_receipt: false,
        allow_household_registration: false,
        allow_cooking: false,
        has_parking: false,
        allow_smoking: false,
        contact_info: "Line: blocked-landlord",
        compliance_confirmed: true,
      },
    });
    const listingId = (await listingRes.json()).id;
    const photoRes = await request.post(
      `${API_URL}/api/v1/listings/${listingId}/photos`,
      {
        multipart: {
          photo: {
            name: "test.jpg",
            mimeType: "image/jpeg",
            buffer: Buffer.from(
              "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEA/8QAHRAAAgIDAQEBAAAAAAAAAAAAAQIDBAUREiH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AqnFGqa2r6hqUOnatLY2kPlxQQoqRxr7AAooA/9k=",
              "base64"
            ),
          },
        },
      }
    );
    expect(photoRes.ok()).toBeTruthy();
    await request.patch(`${API_URL}/api/v1/listings/${listingId}/status`, {
      data: { status: "active" },
    });

    // Seed tenant
    const tRes = await apiCookies(request, "e2e-t-block@example.com", "tenant");
    await page.context().clearCookies();
    await setCookiesFromSeedResponse(page, tRes);

    const profileRes = await request.post(`${API_URL}/api/v1/tenant-profiles`, {
      data: {
        name: "封鎖測試",
        budget_min: 15000,
        budget_max: 25000,
        locations: ["taipei-daan"],
        preferred_room_types: ["suite"],
        available_from: "2025-08-01",
        min_lease_months: 6,
        has_pets: false,
        needs_subsidy: false,
        needs_tax_receipt: false,
        needs_household_registration: false,
        needs_cooking: false,
        needs_parking: false,
        smoking: false,
        contact_info: "Line: block-tenant",
      },
    });
    const profileId = (await profileRes.json()).id;

    // Verify listing appears in browse before block
    const beforeBlock = await request.get(
      `${API_URL}/api/v1/tenant-profiles/${profileId}/listings?limit=50`
    );
    const beforeBody = await beforeBlock.json();
    expect(beforeBody.items.some((l: { id: string }) => l.id === listingId)).toBeTruthy();

    // Block the landlord
    const llBody = await (
      await request.get(`${API_URL}/api/v1/listings/${listingId}`)
    ).json();

    // Get landlord ID from listing — need to get it from the landlord session's profile
    await page.context().clearCookies();
    await setCookiesFromSeedResponse(page, llRes);
    const meRes = await request.get(`${API_URL}/api/v1/profile/me`);
    const landlordId = (await meRes.json()).id;

    await page.context().clearCookies();
    await setCookiesFromSeedResponse(page, tRes);
    const blockRes = await request.post(`${API_URL}/api/v1/blocks/${landlordId}`);
    expect(blockRes.ok()).toBeTruthy();

    // Verify listing no longer appears
    const afterBlock = await request.get(
      `${API_URL}/api/v1/tenant-profiles/${profileId}/listings?limit=50`
    );
    const afterBody = await afterBlock.json();
    expect(afterBody.items.some((l: { id: string }) => l.id === listingId)).toBeFalsy();

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
    const tRes = await request.post(`${API_URL}/test/auth/seed`, {
      data: { email: "e2e-delete@example.com", role: "tenant" },
    });
    expect(tRes.ok()).toBeTruthy();

    // Create profile
    const profileRes = await request.post(`${API_URL}/api/v1/tenant-profiles`, {
      data: {
        name: "刪帳測試",
        budget_min: 10000,
        budget_max: 20000,
        locations: ["taipei-daan"],
        preferred_room_types: ["suite"],
        available_from: "2025-08-01",
        min_lease_months: 6,
        has_pets: false,
        needs_subsidy: false,
        needs_tax_receipt: false,
        needs_household_registration: false,
        needs_cooking: false,
        needs_parking: false,
        smoking: false,
        contact_info: "Line: delete-test",
      },
    });
    expect(profileRes.ok()).toBeTruthy();
    const profileId = (await profileRes.json()).id;

    // Delete account
    const delRes = await request.delete(`${API_URL}/api/v1/account`);
    expect(delRes.ok()).toBeTruthy();

    // /profile/me should now return 401
    const meRes = await request.get(`${API_URL}/api/v1/profile/me`);
    expect(meRes.status()).toBe(401);

    // Profile should not be accessible
    const profileCheck = await request.get(
      `${API_URL}/api/v1/tenant-profiles/${profileId}`
    );
    expect(profileCheck.status()).toBe(401);
  });
});
