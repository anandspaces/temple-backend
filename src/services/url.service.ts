import { env } from "../config/env.ts";

/**
 * Returns absolute URL when API_BASE_URL is set; otherwise returns relative path unchanged.
 * Used so profileAvatarUrl and aadhaarIdFileUrl in API responses are reachable from the frontend.
 */
export function toAbsoluteUrl(relativeUrl: string): string {
	if (!relativeUrl) return "";
	const base = env.API_BASE_URL;
	if (!base) return relativeUrl;
	const path = relativeUrl.startsWith("/") ? relativeUrl.slice(1) : relativeUrl;
	return `${base}/${path}`;
}
