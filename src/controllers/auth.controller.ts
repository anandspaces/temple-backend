import type { Request, Response } from "express";
import mongoose from "mongoose";
import logger from "../config/logger.ts";
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
import { signToken } from "../services/token.service.ts";
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

type ReqWithCompleteOnboarding = Request & {
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
 * Verify OTP: decides register vs login.
 * - New phone: create/update PendingOnboarding, return userId (pending id), onboarding: false.
 * - Existing user not onboarded: return userId, onboarding: false (resume).
 * - User onboarded: login and return accessToken, user, onboarding: true.
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
		return res.status(200).json(
			apiSuccess({
				userId: String(pending._id),
				onboarding: false,
			}),
		);
	}

	userDoc.isPhoneVerified = true;
	await userDoc.save();

	if (userDoc.onboardingComplete) {
		try {
			const { accessToken, expiresIn } = await signToken({
				userId: String(userDoc._id),
				phoneNumber: userDoc.phoneNumber,
			});
			logger.info(
				{ userId: userDoc._id, phone: maskPhone(phoneNumber) },
				"Verify OTP: login success",
			);
			return res.status(200).json(
				apiSuccess({
					accessToken,
					expiresIn,
					user: userResponse(userDoc),
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
	return res.status(200).json(
		apiSuccess({
			userId: String(userDoc._id),
			onboarding: false,
		}),
	);
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
 * Complete onboarding: for users who got onboarding: false from verify-otp.
 * Accepts userId (same field for new = PendingOnboarding id, or resume = User id) + full profile. Returns access token on success.
 */
export async function completeOnboarding(
	req: ReqWithCompleteOnboarding,
	res: Response,
) {
	const body = req.validatedBody;
	if (!body) return res.status(400).json(apiError("Missing request body"));
	if (!body.userId) {
		return res.status(400).json(apiError("userId required"));
	}
	const files = req.files ?? {};
	const userIdParam = new mongoose.Types.ObjectId(body.userId);

	const pending = await PendingOnboarding.findById(userIdParam);
	if (pending) {
		if (pending.expiresAt && new Date() > pending.expiresAt) {
			await PendingOnboarding.findByIdAndDelete(userIdParam);
			return res
				.status(403)
				.json(apiError("Verification expired. Please verify OTP again."));
		}
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
		await PendingOnboarding.findByIdAndDelete(userIdParam);

		logger.info(
			{ userId: user._id, phone: maskPhone(body.phoneNumber) },
			"Complete onboarding success (new user)",
		);
		try {
			const { accessToken, expiresIn } = await signToken({
				userId: String(user._id),
				phoneNumber: user.phoneNumber,
			});
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

	const user = await User.findById(userIdParam);
	if (!user) {
		return res.status(404).json(apiError("User not found"));
	}
	if (!user.isPhoneVerified) {
		return res
			.status(403)
			.json(
				apiError("Phone not verified. Use send-otp then verify-otp first."),
			);
	}
	if (user.onboardingComplete) {
		try {
			const { accessToken, expiresIn } = await signToken({
				userId: String(user._id),
				phoneNumber: user.phoneNumber,
			});
			return res
				.status(200)
				.json(apiSuccess({ accessToken, expiresIn, user: userResponse(user) }));
		} catch {
			return res
				.status(500)
				.json(apiError("Authentication configuration error"));
		}
	}
	if (user.phoneNumber !== body.phoneNumber) {
		return res
			.status(403)
			.json(apiError("Phone number does not match the verified user"));
	}

	const { aadhaarIdFileUrl, profileAvatarUrl } = await getFileUrls(files);
	const email = (body.email ?? "").trim() || "";
	user.set({
		...body,
		email: email || user.email,
		aadhaarIdFileUrl: aadhaarIdFileUrl || user.aadhaarIdFileUrl,
		profileAvatarUrl: profileAvatarUrl || user.profileAvatarUrl,
		onboardingComplete: true,
	});
	await user.save();

	logger.info(
		{ userId: user._id, phone: maskPhone(body.phoneNumber) },
		"Complete onboarding success (resume)",
	);
	try {
		const { accessToken, expiresIn } = await signToken({
			userId: String(user._id),
			phoneNumber: user.phoneNumber,
		});
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
		return res.status(500).json(apiError("Authentication configuration error"));
	}
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
				"Use send-otp, then verify-otp. If onboarding is required, call complete-onboarding with the returned userId and your profile.",
			),
		);
}
