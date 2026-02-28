import * as jose from "jose";
import { env } from "../config/env.ts";

/** Parse expiry string (e.g. "7d", "24h") to seconds. */
function expiryToSeconds(expiry: string): number {
	const match = expiry.match(/^(\d+)(d|h|m|s)$/);
	if (!match) return 7 * 24 * 3600; // default 7 days
	const n = Number(match[1]);
	const unit = match[2];
	if (unit === "d") return n * 24 * 3600;
	if (unit === "h") return n * 3600;
	if (unit === "m") return n * 60;
	return n;
}

export interface SignTokenPayload {
	userId: string;
	phoneNumber?: string;
}

export interface SignTokenResult {
	accessToken: string;
	expiresIn: number;
}

export async function signToken(
	payload: SignTokenPayload,
): Promise<SignTokenResult> {
	const secret = env.JWT_SECRET;
	if (!secret || secret.length < 16) {
		throw new Error("JWT_SECRET must be set and at least 16 characters");
	}
	const expiresInSeconds = expiryToSeconds(env.JWT_EXPIRES_IN);
	const secretKey = new TextEncoder().encode(secret);
	const accessToken = await new jose.SignJWT({
		phone: payload.phoneNumber,
	})
		.setSubject(payload.userId)
		.setIssuedAt()
		.setExpirationTime(expiresInSeconds)
		.setProtectedHeader({ alg: "HS256" })
		.sign(secretKey);

	return {
		accessToken,
		expiresIn: expiresInSeconds,
	};
}

export interface VerifyTokenResult {
	userId: string;
}

export async function verifyToken(
	token: string,
): Promise<VerifyTokenResult | null> {
	const secret = env.JWT_SECRET;
	if (!secret) return null;
	try {
		const secretKey = new TextEncoder().encode(secret);
		const { payload } = await jose.jwtVerify(token, secretKey);
		const sub = payload.sub;
		if (typeof sub !== "string" || !sub) return null;
		return { userId: sub };
	} catch {
		return null;
	}
}
