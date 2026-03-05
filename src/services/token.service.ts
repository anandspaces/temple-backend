import { randomUUID } from "crypto";
import * as jose from "jose";
import { env } from "../config/env.ts";
import logger from "../config/logger.ts";
import { Session } from "../models/Session.ts";

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
	countryCode?: string;
}

export interface SignTokenResult {
	accessToken: string;
	expiresIn: number;
	jti: string;
}

export async function signToken(
	payload: SignTokenPayload,
): Promise<SignTokenResult> {
	const secret = env.JWT_SECRET;
	if (!secret || secret.length < 16) {
		throw new Error("JWT_SECRET must be set and at least 16 characters");
	}
	const expiresInSeconds = expiryToSeconds(env.JWT_EXPIRES_IN);
	const jti = randomUUID();
	const secretKey = new TextEncoder().encode(secret);
	const accessToken = await new jose.SignJWT({
		phone: payload.phoneNumber,
		countryCode: payload.countryCode ?? "",
	})
		.setSubject(payload.userId)
		.setJti(jti)
		.setIssuedAt()
		.setExpirationTime(env.JWT_EXPIRES_IN)
		.setProtectedHeader({ alg: "HS256" })
		.sign(secretKey);

	return {
		accessToken,
		expiresIn: expiresInSeconds,
		jti,
	};
}

export interface VerifyTokenResult {
	userId: string;
	jti?: string;
	exp?: number;
	iat?: number;
	phoneNumber?: string;
	countryCode?: string;
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
		const jti = typeof payload.jti === "string" ? payload.jti : undefined;
		const exp = typeof payload.exp === "number" ? payload.exp : undefined;
		const iat = typeof payload.iat === "number" ? payload.iat : undefined;
		const phoneNumber = typeof payload.phone === "string" ? payload.phone : undefined;
		const countryCode = typeof payload.countryCode === "string" ? payload.countryCode : undefined;
		return { userId: sub, jti, exp, iat, phoneNumber, countryCode };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logger.warn({ err: message }, "verifyToken: JWT verification failed");
		return null;
	}
}

/**
 * Create or replace session for userId. Deletes any existing session for this userId, then inserts one with the given jti and expiry.
 */
export async function createSession(
	userId: string,
	jti: string,
	expiresInSeconds: number,
): Promise<void> {
	await Session.deleteMany({ userId });
	await Session.create({
		userId,
		tokenId: jti,
		expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
	});
}

/**
 * Verify JWT and ensure a matching session exists and is not expired. Returns null if token is invalid or session missing/expired.
 */
export async function verifyTokenWithSession(
	token: string,
): Promise<VerifyTokenResult | null> {
	const payload = await verifyToken(token);
	if (!payload) {
		logger.warn("verifyTokenWithSession: JWT invalid or expired");
		return null;
	}
	if (!payload.jti) {
		logger.warn("verifyTokenWithSession: token has no jti (old token?)");
		return null;
	}
	let session = await Session.findOne({
		tokenId: payload.jti,
		expiresAt: { $gt: new Date() },
	}).lean();
	if (!session) {
		const now = Math.floor(Date.now() / 1000);
		const exp = payload.exp ?? 0;
		const iat = payload.iat ?? 0;
		const notExpired = exp > now;
		const issuedRecently = now - iat <= 120;
		if (notExpired && issuedRecently) {
			await Session.create({
				userId: payload.userId,
				tokenId: payload.jti,
				expiresAt: new Date(exp * 1000),
			});
			session = await Session.findOne({
				tokenId: payload.jti,
				expiresAt: { $gt: new Date() },
			}).lean();
		}
		if (!session) {
			logger.warn(
				{ jti: payload.jti },
				"verifyTokenWithSession: no session or session expired",
			);
			return null;
		}
	}
	return {
		userId: payload.userId,
		jti: payload.jti,
		exp: payload.exp,
		iat: payload.iat,
		phoneNumber: payload.phoneNumber,
		countryCode: payload.countryCode,
	};
}
