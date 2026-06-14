/**
 * Scenario builders for E2E tests.
 *
 * Each builder creates a fully wired-up state via the API (no UI interaction).
 * Tests should use these instead of duplicating setup code inline.
 *
 * Usage:
 *   const s = new Scenario(request);
 *   const { profileId, cookies: tenantCookies } = await s.createTenantWithProfile();
 *   const { listingId, cookies: landlordCookies } = await s.createLandlordWithListing();
 *   await loginAs(page, tenantCookies);
 */

import { type APIRequestContext } from "@playwright/test";

export const API_URL = process.env.API_URL || "http://localhost:8080";

// 1×1 white JPEG — reused across all tests that need to activate a listing.
export const TEST_PHOTO_BUFFER = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEA/8QAHRAAAgIDAQEBAAAAAAAAAAAAAQIDBAUREiH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AqnFGqa2r6hqUOnatLY2kPlxQQoqRxr7AAooA/9k=",
  "base64"
);

export interface SeedCookies {
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Lax" | "Strict" | "None";
}

export interface TenantResult {
  userId: string;
  email: string;
  profileId: string;
  cookies: SeedCookies[];
}

export interface LandlordResult {
  userId: string;
  email: string;
  listingId: string;
  cookies: SeedCookies[];
}

export interface MatchResult {
  tenant: TenantResult;
  landlord: LandlordResult;
  contactInfo: string;
}

async function seedUser(
  request: APIRequestContext,
  email: string,
  role: "tenant" | "landlord"
): Promise<{ userId: string; email: string; cookies: SeedCookies[] }> {
  const res = await request.post(`${API_URL}/test/auth/seed`, {
    data: { email, role },
  });
  if (!res.ok()) throw new Error(`seed user failed (${email}): ${await res.text()}`);

  const body = await res.json();
  const rawCookies = res.headers()["set-cookie"] ?? "";
  const baseURL = new URL(process.env.BASE_URL || "http://localhost:3000");

  const cookies: SeedCookies[] = rawCookies
    .split(/,(?=[^ ].*?=)/)
    .filter(Boolean)
    .map((raw) => {
      const parts = raw.split(";").map((p) => p.trim());
      const [name, value] = parts[0].split("=");
      return {
        name: name.trim(),
        value: value ?? "",
        domain: baseURL.hostname,
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      };
    });

  return { userId: body.user_id, email, cookies };
}

const DEFAULT_TENANT_PROFILE = {
  name: "E2E 找房需求",
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
  contact_info: "Line: e2e-tenant",
};

const DEFAULT_LISTING = {
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
  contact_info: "Line: e2e-landlord",
  compliance_confirmed: true,
};

export class Scenario {
  constructor(private readonly request: APIRequestContext) {}

  /**
   * Creates a tenant user + one active tenant profile.
   * Returns the user's JWT cookies so the caller can log in as this tenant.
   */
  async createTenantWithProfile(opts?: {
    email?: string;
    profile?: Partial<typeof DEFAULT_TENANT_PROFILE>;
  }): Promise<TenantResult> {
    const email = opts?.email ?? `e2e-tenant-${Date.now()}@example.com`;
    const { userId, cookies } = await seedUser(this.request, email, "tenant");

    const res = await this.request.post(`${API_URL}/api/v1/tenant-profiles`, {
      data: { ...DEFAULT_TENANT_PROFILE, ...opts?.profile },
    });
    if (!res.ok()) throw new Error(`create tenant profile failed: ${await res.text()}`);

    const profileId = (await res.json()).id as string;
    return { userId, email, profileId, cookies };
  }

  /**
   * Creates a landlord user + one active listing (with photo, status=active).
   * Returns the user's JWT cookies so the caller can log in as this landlord.
   */
  async createLandlordWithListing(opts?: {
    email?: string;
    listing?: Partial<typeof DEFAULT_LISTING>;
  }): Promise<LandlordResult> {
    const email = opts?.email ?? `e2e-landlord-${Date.now()}@example.com`;
    const { userId, cookies } = await seedUser(this.request, email, "landlord");

    const createRes = await this.request.post(`${API_URL}/api/v1/listings`, {
      data: { ...DEFAULT_LISTING, ...opts?.listing },
    });
    if (!createRes.ok()) throw new Error(`create listing failed: ${await createRes.text()}`);
    const listingId = (await createRes.json()).id as string;

    // A listing needs at least one photo before it can be activated.
    const photoRes = await this.request.post(
      `${API_URL}/api/v1/listings/${listingId}/photos`,
      {
        multipart: {
          photo: {
            name: "test.jpg",
            mimeType: "image/jpeg",
            buffer: TEST_PHOTO_BUFFER,
          },
        },
      }
    );
    if (!photoRes.ok()) throw new Error(`upload listing photo failed: ${await photoRes.text()}`);

    const activateRes = await this.request.patch(
      `${API_URL}/api/v1/listings/${listingId}/status`,
      { data: { status: "active" } }
    );
    if (!activateRes.ok()) throw new Error(`activate listing failed: ${await activateRes.text()}`);

    return { userId, email, listingId, cookies };
  }

  /**
   * Creates a tenant with profile that has expressed interest in a listing.
   * The listing must already exist (pass the landlord result from createLandlordWithListing).
   */
  async createTenantInterestedInListing(
    landlord: LandlordResult,
    opts?: { email?: string }
  ): Promise<TenantResult & { status: "pending" | "matched" }> {
    const tenant = await this.createTenantWithProfile({ email: opts?.email });

    const res = await this.request.post(
      `${API_URL}/api/v1/tenant-profiles/${tenant.profileId}/listings/${landlord.listingId}/interest`
    );
    if (!res.ok()) throw new Error(`express tenant interest failed: ${await res.text()}`);
    const { status } = await res.json();

    return { ...tenant, status };
  }

  /**
   * Creates a full mutual match: tenant + landlord both express interest.
   * Returns both sides' cookies and the revealed contact info.
   */
  async createMatchedTenantAndLandlord(opts?: {
    tenantEmail?: string;
    landlordEmail?: string;
  }): Promise<MatchResult> {
    const landlord = await this.createLandlordWithListing({
      email: opts?.landlordEmail,
    });
    const tenant = await this.createTenantWithProfile({
      email: opts?.tenantEmail,
    });

    // At this point request has TENANT cookies (last seedUser was for tenant).
    const tRes = await this.request.post(
      `${API_URL}/api/v1/tenant-profiles/${tenant.profileId}/listings/${landlord.listingId}/interest`
    );
    if (!tRes.ok()) throw new Error(`tenant interest failed: ${await tRes.text()}`);

    // Playwright's request fixture has its own cookie jar separate from the
    // browser page context. Re-seeding as landlord updates the request cookie
    // jar so the next API call is authenticated as the landlord.
    await this.request.post(`${API_URL}/test/auth/seed`, {
      data: { email: landlord.email, role: "landlord" },
    });

    const lRes = await this.request.post(
      `${API_URL}/api/v1/listings/${landlord.listingId}/tenant-profiles/${tenant.profileId}/interest`
    );
    if (!lRes.ok()) throw new Error(`landlord interest failed: ${await lRes.text()}`);
    const lBody = await lRes.json();

    return {
      tenant,
      landlord,
      contactInfo: lBody.contact_info as string,
    };
  }

  /**
   * Creates a reported listing scenario:
   * tenant reports the landlord's listing.
   */
  async createReportedListing(opts?: {
    tenantEmail?: string;
    landlordEmail?: string;
    reason?: string;
  }): Promise<{ tenant: TenantResult; landlord: LandlordResult }> {
    const landlord = await this.createLandlordWithListing({
      email: opts?.landlordEmail,
    });
    const tenant = await this.createTenantWithProfile({
      email: opts?.tenantEmail,
    });

    const res = await this.request.post(`${API_URL}/api/v1/reports`, {
      data: {
        target_type: "listing",
        target_id: landlord.listingId,
        reason: opts?.reason ?? "虛假資訊",
      },
    });
    if (!res.ok()) throw new Error(`create report failed: ${await res.text()}`);

    return { tenant, landlord };
  }
}
