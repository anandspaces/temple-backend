import type { Request, Response } from "express";
import logger from "../config/logger.ts";
import type { RequestWithOnboarding } from "../middleware/auth.middleware.ts";
import { PendingOnboarding } from "../models/PendingOnboarding.ts";
import { User } from "../models/User.ts";
import type {
	CompleteOnboardingBody,
	RegisterBody,
} from "../schemas/auth.schemas.ts";
import { storeFile } from "../services/fileUpload.service.ts";
import {
	generateAndStore,
	markPhoneVerifiedForRegistration,
	verify,
} from "../services/otp.service.ts";
import { createSession, signToken } from "../services/token.service.ts";
import { toAbsoluteUrl } from "../services/url.service.ts";
import { apiError, apiSuccess } from "../types/types.ts";

function maskPhone(phone: string): string {
	if (phone.length <= 4) return "****";
	return "*".repeat(phone.length - 4) + phone.slice(-4);
}

type ReqWithValidated = Request & {
	validatedBody?: { phoneNumber: string; otp?: string; countryCode: string };
};

type ReqWithRegister = Request & {
	validatedBody?: RegisterBody;
	files?: {
		aadhaarFile?: Express.Multer.File[];
		profileAvatar?: Express.Multer.File[];
	};
};

type ReqWithCompleteOnboarding = RequestWithOnboarding & {
	validatedBody?: CompleteOnboardingBody;
	files?: {
		aadhaarFile?: Express.Multer.File[];
		profileAvatar?: Express.Multer.File[];
	};
};

const PENDING_TTL_MS = 15 * 60 * 1000;

async function getFileUrls(
	files: ReqWithRegister["files"],
): Promise<{ aadhaarIdFileUrl: string; profileAvatarUrl: string }> {
	let aadhaarIdFileUrl = "";
	let profileAvatarUrl = "";
	const aadhaarFile = files?.aadhaarFile?.[0];
	if (aadhaarFile) {
		const { url } = await storeFile(aadhaarFile);
		aadhaarIdFileUrl = url;
	}
	const profileAvatar = files?.profileAvatar?.[0];
	if (profileAvatar) {
		const { url } = await storeFile(profileAvatar);
		profileAvatarUrl = url;
	}
	return { aadhaarIdFileUrl, profileAvatarUrl };
}

export async function sendOtp(req: ReqWithValidated, res: Response) {
	const body = req.validatedBody;
	if (!body) return res.status(400).json(apiError("Missing request body"));
	const { phoneNumber } = body;
	await generateAndStore(phoneNumber);
	logger.info({ phone: maskPhone(phoneNumber) }, "OTP sent");
	return res.status(200).json(apiSuccess({ message: "OTP sent" }));
}

/**
 * Verify OTP: login on verification. Response format is fixed (same as onboarding: false) for consistency:
 * { accessToken, expiresIn, userId, onboarding, user } — user is null when onboarding false, profile object when true.
 */
export async function verifyOtp(req: ReqWithValidated, res: Response) {
	const body = req.validatedBody;
	if (!body?.phoneNumber || !body?.otp)
		return res.status(400).json(apiError("Missing phoneNumber or otp"));
	const { phoneNumber, otp } = body;
	const valid = verify(phoneNumber, otp);
	if (!valid) {
		logger.warn(
			{ phone: maskPhone(phoneNumber) },
			"Verify OTP failed: invalid or expired",
		);
		return res.status(400).json(apiError("Invalid or expired OTP"));
	}
	markPhoneVerifiedForRegistration(phoneNumber);

	const userDoc = await User.findOne().where("phoneNumber", phoneNumber);

	if (!userDoc) {
		const expiresAt = new Date(Date.now() + PENDING_TTL_MS);
		let pending = await PendingOnboarding.findOne().where(
			"phoneNumber",
			phoneNumber,
		);
		if (pending) {
			pending.expiresAt = expiresAt;
			await pending.save();
		} else {
			pending = await PendingOnboarding.create({
				phoneNumber,
				verifiedAt: new Date(),
				expiresAt,
			});
		}
		logger.info(
			{ userId: pending._id, phone: maskPhone(phoneNumber) },
			"Verify OTP: pending onboarding created/updated",
		);
		try {
			const userId = String(pending._id);
			const { accessToken, expiresIn, jti } = await signToken({
				userId,
				phoneNumber,
			});
			await createSession(userId, jti, expiresIn);
			return res.status(200).json(
				apiSuccess({
					accessToken,
					expiresIn,
					userId,
					onboarding: false,
				}),
			);
		} catch (err) {
			logger.error({ err }, "Verify OTP: token signing failed");
			return res
				.status(500)
				.json(apiError("Authentication configuration error"));
		}
	}

	userDoc.isPhoneVerified = true;
	await userDoc.save();

	if (userDoc.onboardingComplete) {
		try {
			const userId = String(userDoc._id);
			const { accessToken, expiresIn, jti } = await signToken({
				userId,
				phoneNumber: userDoc.phoneNumber,
			});
			await createSession(userId, jti, expiresIn);
			logger.info(
				{ userId: userDoc._id, phone: maskPhone(phoneNumber) },
				"Verify OTP: login success",
			);
			return res.status(200).json(
				apiSuccess({
					accessToken,
					expiresIn,
					userId,
					onboarding: true,
				}),
			);
		} catch (err) {
			logger.error({ err }, "Verify OTP: token signing failed");
			return res
				.status(500)
				.json(apiError("Authentication configuration error"));
		}
	}

	logger.info(
		{ userId: userDoc._id, phone: maskPhone(phoneNumber) },
		"Verify OTP: existing user, onboarding required",
	);
	try {
		const userId = String(userDoc._id);
		const { accessToken, expiresIn, jti } = await signToken({
			userId,
			phoneNumber: userDoc.phoneNumber,
		});
		await createSession(userId, jti, expiresIn);
		return res.status(200).json(
			apiSuccess({
				accessToken,
				expiresIn,
				userId,
				onboarding: false,
			}),
		);
	} catch (err) {
		logger.error({ err }, "Verify OTP: token signing failed");
		return res.status(500).json(apiError("Authentication configuration error"));
	}
}

/**
 * Deprecated: use send-otp → verify-otp instead (verify-otp returns accessToken for onboarded users).
 * Returns 400 directing client to the new flow.
 */
export async function login(_req: ReqWithValidated, res: Response) {
	return res
		.status(400)
		.json(
			apiError(
				"Use send-otp, then verify-otp. For onboarded users, verify-otp returns accessToken and user.",
			),
		);
}

/**
 * Complete onboarding: identity from Bearer token (set by requireAuthForOnboarding).
 * Body is profile only (no userId). Returns accessToken and user on success.
 */
export async function completeOnboarding(
	req: ReqWithCompleteOnboarding,
	res: Response,
) {
	const body = req.validatedBody;
	if (!body) return res.status(400).json(apiError("Missing request body"));
	const files = req.files ?? {};
	const pending = req.onboardingPending;
	const existingUser = req.onboardingUser;

	if (pending) {
		if (pending.phoneNumber !== body.phoneNumber) {
			return res
				.status(403)
				.json(apiError("Phone number does not match the verified phone"));
		}

		const { aadhaarIdFileUrl, profileAvatarUrl } = await getFileUrls(files);
		const email = (body.email ?? "").trim() || "";
		const user = await User.create({
			...body,
			email: email || "",
			aadhaarIdFileUrl,
			profileAvatarUrl,
			isPhoneVerified: true,
			onboardingComplete: true,
		});
		await PendingOnboarding.findByIdAndDelete(pending._id);

		logger.info(
			{ userId: user._id, phone: maskPhone(body.phoneNumber) },
			"Complete onboarding success (new user)",
		);
		try {
			const userId = String(user._id);
			const { accessToken, expiresIn, jti } = await signToken({
				userId,
				phoneNumber: user.phoneNumber,
			});
			await createSession(userId, jti, expiresIn);
			return res.status(200).json(
				apiSuccess({
					accessToken,
					expiresIn,
					user: userResponse(user),
					onboarding: true,
				}),
			);
		} catch (err) {
			logger.error({ err }, "Complete onboarding: token signing failed");
			return res
				.status(500)
				.json(apiError("Authentication configuration error"));
		}
	}

	if (existingUser) {
		if (existingUser.phoneNumber !== body.phoneNumber) {
			return res
				.status(403)
				.json(apiError("Phone number does not match the verified user"));
		}

		const { aadhaarIdFileUrl, profileAvatarUrl } = await getFileUrls(files);
		const email = (body.email ?? "").trim() || "";
		existingUser.set({
			...body,
			email: email || existingUser.email,
			aadhaarIdFileUrl: aadhaarIdFileUrl || existingUser.aadhaarIdFileUrl,
			profileAvatarUrl: profileAvatarUrl || existingUser.profileAvatarUrl,
			onboardingComplete: true,
		});
		await existingUser.save();

		logger.info(
			{ userId: existingUser._id, phone: maskPhone(body.phoneNumber) },
			"Complete onboarding success (resume)",
		);
		try {
			const userId = String(existingUser._id);
			const { accessToken, expiresIn, jti } = await signToken({
				userId,
				phoneNumber: existingUser.phoneNumber,
			});
			await createSession(userId, jti, expiresIn);
			return res.status(200).json(
				apiSuccess({
					accessToken,
					expiresIn,
					user: userResponse(existingUser),
					onboarding: true,
				}),
			);
		} catch (err) {
			logger.error({ err }, "Complete onboarding: token signing failed");
			return res
				.status(500)
				.json(apiError("Authentication configuration error"));
		}
	}

	return res.status(401).json(apiError("Unauthorized"));
}

function userResponse(
	user:
		| InstanceType<typeof User>
		| {
				_id: unknown;
				fullName: string;
				phoneNumber: string;
				email?: string;
				language?: string;
				profileAvatarUrl?: string;
		  },
) {
	return {
		id: user._id,
		fullName: user.fullName,
		phoneNumber: user.phoneNumber,
		email: user.email ?? "",
		language: user.language ?? "",
		profileAvatarUrl: toAbsoluteUrl(user.profileAvatarUrl ?? ""),
	};
}

/**
 * Deprecated: use send-otp → verify-otp → complete-onboarding instead.
 * Returns 400 directing client to the new flow.
 */
export async function register(_req: ReqWithRegister, res: Response) {
	return res
		.status(400)
		.json(
			apiError(
				"Use send-otp, then verify-otp. If onboarding is required, call complete-onboarding with the returned token and your profile.",
			),
		);
}
