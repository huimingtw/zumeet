import { type Page, type APIRequestContext } from "@playwright/test";

const API_URL = process.env.API_URL || "http://localhost:8080";

export async function seedSession(
  request: APIRequestContext,
  page: Page,
  email: string,
  role: "tenant" | "landlord"
): Promise<void> {
  const res = await request.post(`${API_URL}/test/auth/seed`, {
    data: { email, role },
  });
  if (!res.ok()) throw new Error(`seed session failed: ${await res.text()}`);

  // Copy cookies from the API response into the browser context
  const cookies = res.headers()["set-cookie"];
  if (!cookies) return;

  const url = new URL(process.env.BASE_URL || "http://localhost:3000");
  const parsedCookies = cookies
    .split(/,(?=[^ ].*?=)/)
    .map((raw) => {
      const parts = raw.split(";").map((p) => p.trim());
      const [name, value] = parts[0].split("=");
      return {
        name: name.trim(),
        value: value ?? "",
        domain: url.hostname,
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      };
    });

  await page.context().addCookies(parsedCookies);
}

export async function seedTenantProfile(
  request: APIRequestContext,
  data?: Partial<Record<string, unknown>>
): Promise<string> {
  const res = await request.post(`${API_URL}/api/v1/tenant-profiles`, {
    data: {
      name: "測試需求卡",
      budget_min: 10000,
      budget_max: 30000,
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
      contact_info: "Line: test-tenant",
      ...data,
    },
  });
  if (!res.ok()) throw new Error(`seed tenant profile failed: ${await res.text()}`);
  const body = await res.json();
  return body.id;
}

export async function seedListing(
  request: APIRequestContext,
  data?: Partial<Record<string, unknown>>
): Promise<string> {
  // Create listing
  const res = await request.post(`${API_URL}/api/v1/listings`, {
    data: {
      location_id: "taipei-daan",
      rent: 20000,
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
      contact_info: "Line: test-landlord",
      compliance_confirmed: true,
      ...data,
    },
  });
  if (!res.ok()) throw new Error(`seed listing failed: ${await res.text()}`);
  const body = await res.json();
  return body.id;
}
