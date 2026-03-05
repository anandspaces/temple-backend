/**
 * Test script for all backend APIs. Run with: bun run scripts/test-api.ts
 * Requires server and MongoDB running. Set BASE_URL and TEST_OTP in env if needed.
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3005";
const TEST_OTP = process.env.TEST_OTP ?? "123456";
const PHONE = "123456789012";
const COUNTRY_CODE = "+91";

let token: string | null = null;
let failures = 0;

function fail(label: string, message: string): void {
	console.log(`[FAIL] ${label}: ${message}`);
	failures++;
}

function pass(label: string): void {
	console.log(`[PASS] ${label}`);
}

async function run(): Promise<void> {
	console.log(`Testing APIs at ${BASE_URL} (TEST_OTP=${TEST_OTP})\n`);

	// 1. GET /
	{
		const label = "GET /";
		try {
			const res = await fetch(BASE_URL);
			const text = await res.text();
			if (res.status !== 200) {
				fail(label, `expected 200 got ${res.status}`);
			} else if (!text.includes("Temple")) {
				fail(label, "body does not contain 'Temple'");
			} else {
				pass(label);
			}
		} catch (e) {
			fail(label, String(e));
		}
	}

	// 2. POST /auth/send-otp
	{
		const label = "POST /auth/send-otp";
		try {
			const res = await fetch(`${BASE_URL}/auth/send-otp`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					phoneNumber: PHONE,
					countryCode: COUNTRY_CODE,
				}),
			});
			const data = (await res.json()) as { success?: boolean };
			if (res.status !== 200 || !data.success) {
				fail(label, `expected 200 and success: true, got ${res.status}`);
			} else {
				pass(label);
			}
		} catch (e) {
			fail(label, String(e));
		}
	}

	// 3. POST /auth/verify-otp
	{
		const label = "POST /auth/verify-otp";
		try {
			const res = await fetch(`${BASE_URL}/auth/verify-otp`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					phoneNumber: PHONE,
					countryCode: COUNTRY_CODE,
					otp: TEST_OTP,
				}),
			});
			const data = (await res.json()) as {
				success?: boolean;
				data?: { accessToken?: string; userId?: string };
			};
			if (res.status !== 200 || !data.success || !data.data?.accessToken) {
				fail(label, `expected 200 and accessToken, got ${res.status}`);
			} else {
				token = data.data.accessToken;
				pass(label);
			}
		} catch (e) {
			fail(label, String(e));
		}
	}

	if (!token) {
		console.log("\nStopping: no token from verify-otp.");
		process.exit(1);
	}

	// 4. POST /auth/complete-onboarding
	// Brief delay so session from verify-otp is committed before we use the token
	await new Promise((r) => setTimeout(r, 100));
	{
		const label = "POST /auth/complete-onboarding";
		try {
			const form = new FormData();
			form.set("language", "english");
			form.set("fullName", "Test User");
			form.set("age", "24");
			form.set("gender", "male");
			form.set("residentialAddress", "Test Address");
			form.set("medicalConditions", "Diabetes");
			form.set("emergencyContactName", "Emergency");
			form.set("emergencyContactPhone", "1234567890");
			form.set("emergencyCountryCode", COUNTRY_CODE);

			const headers = new Headers();
			headers.set("Authorization", `Bearer ${token}`);
			const req = new Request(`${BASE_URL}/auth/complete-onboarding`, {
				method: "POST",
				headers,
				body: form,
			});
			const res = await fetch(req);
			const data = (await res.json()) as {
				success?: boolean;
				error?: string;
				data?: { accessToken?: string; user?: unknown };
			};
			if (res.status !== 200 || !data.success || !data.data?.accessToken) {
				const msg = data.error ? ` ${data.error}` : "";
				fail(label, `expected 200 and accessToken, got ${res.status}${msg}`);
			} else {
				token = data.data.accessToken;
				pass(label);
			}
		} catch (e) {
			fail(label, String(e));
		}
	}

	if (!token) {
		console.log("\nStopping: no token after complete-onboarding.");
		process.exit(1);
	}

	// 5. POST /auth/login (expect 400)
	{
		const label = "POST /auth/login (expect 400)";
		try {
			const res = await fetch(`${BASE_URL}/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ phoneNumber: PHONE, otp: TEST_OTP }),
			});
			const data = (await res.json()) as { error?: string };
			if (res.status !== 400) {
				fail(label, `expected 400 got ${res.status}`);
			} else if (!data.error?.includes("verify-otp")) {
				fail(label, "expected error message about verify-otp");
			} else {
				pass(label);
			}
		} catch (e) {
			fail(label, String(e));
		}
	}

	// 6. POST /auth/register (expect 400)
	{
		const label = "POST /auth/register (expect 400)";
		try {
			const res = await fetch(`${BASE_URL}/auth/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});
			if (res.status !== 400) {
				fail(label, `expected 400 got ${res.status}`);
			} else {
				pass(label);
			}
		} catch (e) {
			fail(label, String(e));
		}
	}

	// 7. GET /users/me
	{
		const label = "GET /users/me";
		try {
			const res = await fetch(`${BASE_URL}/users/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = (await res.json()) as { success?: boolean; data?: unknown };
			if (res.status !== 200 || !data.success) {
				fail(label, `expected 200 and success, got ${res.status}`);
			} else {
				pass(label);
			}
		} catch (e) {
			fail(label, String(e));
		}
	}

	// 8. PATCH /users/me
	{
		const label = "PATCH /users/me";
		try {
			const res = await fetch(`${BASE_URL}/users/me`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ fullName: "Updated Test User" }),
			});
			const data = (await res.json()) as { success?: boolean };
			if (res.status !== 200 || !data.success) {
				fail(label, `expected 200 and success, got ${res.status}`);
			} else {
				pass(label);
			}
		} catch (e) {
			fail(label, String(e));
		}
	}

	// 9. DELETE /users/me
	{
		const label = "DELETE /users/me";
		try {
			const res = await fetch(`${BASE_URL}/users/me`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = (await res.json()) as { success?: boolean };
			if (res.status !== 200 || !data.success) {
				fail(label, `expected 200 and success, got ${res.status}`);
			} else {
				pass(label);
			}
		} catch (e) {
			fail(label, String(e));
		}
	}

	console.log("");
	if (failures > 0) {
		console.log(`${failures} failure(s).`);
		process.exit(1);
	}
	console.log("All tests passed.");
}

run();
