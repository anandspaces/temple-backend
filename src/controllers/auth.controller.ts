import type { Request, Response } from "express";
import {
	generateAndStore,
	verify,
	markPhoneVerifiedForRegistration,
} from "../services/otp.service.ts";
import { signToken } from "../services/token.service.ts";
import { User } from "../models/User.ts";
import { storeFile } from "../services/fileUpload.service.ts";
import type { RegisterBody } from "../schemas/auth.schemas.ts";
import { apiSuccess, apiError } from "../types/types.ts";
import logger from "../config/logger.ts";

function maskPhone(phone: string): string {
	if (phone.length <= 4) return "****";
	return "*".repeat(phone.length - 4) + phone.slice(-4);
}

type ReqWithValidated = Request & {
	validatedBody?: { phoneNumber: string; otp?: string };
};

type ReqWithRegister = Request & {
	validatedBody?: RegisterBody;
	files?: {
		aadhaarFile?: Express.Multer.File[];
		profileAvatar?: Express.Multer.File[];
	};
};

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
	const { phoneNumber } = req.validatedBody!;
	await generateAndStore(phoneNumber);
	logger.info({ phone: maskPhone(phoneNumber) }, "OTP sent");
	return res.status(200).json(apiSuccess({ message: "OTP sent" }));
}

/** Registration only: confirms phone so user can complete profile. Does NOT issue access token. */
export async function verifyOtp(req: ReqWithValidated, res: Response) {
	const { phoneNumber, otp } = req.validatedBody!;
	const valid = verify(phoneNumber!, otp!);
	if (!valid) {
		logger.warn(
			{ phone: maskPhone(phoneNumber!) },
			"Verify OTP failed: invalid or expired",
		);
		return res.status(400).json(apiError("Invalid or expired OTP"));
	}
	markPhoneVerifiedForRegistration(phoneNumber);
	const userDoc = await User.findOne().where("phoneNumber", phoneNumber!);
	if (userDoc) {
		userDoc.isPhoneVerified = true;
		await userDoc.save();
	}
	logger.info(
		{ phone: maskPhone(phoneNumber) },
		"Phone verified for registration",
	);
	return res.status(200).json(
		apiSuccess({
			uid: userDoc?._id ?? null,
			isVerified: true,
		}),
	);
}

export async function login(req: ReqWithValidated, res: Response) {
	const { phoneNumber, otp } = req.validatedBody!;
	const valid = verify(phoneNumber!, otp!);
	if (!valid) {
		logger.warn(
			{ phone: maskPhone(phoneNumber!) },
			"Login failed: invalid or expired OTP",
		);
		return res.status(401).json(apiError("Invalid or expired OTP"));
	}
	const user = await User.findOne()
		.where("phoneNumber", phoneNumber!)
		.select("_id fullName phoneNumber")
		.lean();
	if (!user) {
		logger.warn(
			{ phone: maskPhone(phoneNumber!) },
			"Login failed: user not found",
		);
		return res
			.status(404)
			.json(apiError("User not found. Please register first."));
	}
	try {
		const { accessToken, expiresIn } = await signToken({
			userId: String(user._id),
			phoneNumber: user.phoneNumber,
		});
		logger.info(
			{ userId: user._id, phone: maskPhone(phoneNumber!) },
			"Login success",
		);
		return res.status(200).json(
			apiSuccess({
				accessToken,
				expiresIn,
				user: {
					id: user._id,
					fullName: user.fullName,
					phoneNumber: user.phoneNumber,
				},
			}),
		);
	} catch (err) {
		logger.error({ err }, "Login: token signing failed");
		return res.status(500).json(apiError("Authentication configuration error"));
	}
}

export async function register(req: ReqWithRegister, res: Response) {
	const body = req.validatedBody!;
	const files = req.files ?? {};

	const existing = await User.findOne().where("phoneNumber", body.phoneNumber);

	if (existing?.isPhoneVerified) {
		const { aadhaarIdFileUrl, profileAvatarUrl } = await getFileUrls(files);
		const email = (body.email ?? "").trim() || "";
		existing.set({
			...body,
			email: email || existing.email,
			aadhaarIdFileUrl: aadhaarIdFileUrl || existing.aadhaarIdFileUrl,
			profileAvatarUrl: profileAvatarUrl || existing.profileAvatarUrl,
		});
		await existing.save();
		logger.info(
			{ userId: existing._id, phone: maskPhone(body.phoneNumber) },
			"Register success (update)",
		);
		return res.status(200).json(
			apiSuccess({
				uid: existing._id,
				isVerified: true,
				fullName: existing.fullName,
				phoneNumber: existing.phoneNumber,
				email: existing.email,
				language: existing.language,
				profileAvatarUrl: existing.profileAvatarUrl,
			}),
		);
	}

	if (existing && !existing.isPhoneVerified) {
		await generateAndStore(body.phoneNumber);
		logger.info(
			{ phone: maskPhone(body.phoneNumber) },
			"Register: OTP sent, awaiting verification",
		);
		return res.status(200).json(
			apiSuccess({
				uid: existing._id,
				isVerified: false,
				message: "OTP sent to your phone",
				requireVerification: true,
			}),
		);
	}

	const { aadhaarIdFileUrl, profileAvatarUrl } = await getFileUrls(files);
	const email = (body.email ?? "").trim() || "";

	const user = await User.create({
		...body,
		email,
		aadhaarIdFileUrl,
		profileAvatarUrl,
		isPhoneVerified: false,
	});

	if (!user) {
		logger.error(
			{ phone: maskPhone(body.phoneNumber) },
			"Register failed: user create returned null",
		);
		return res.status(500).json(apiError("Failed to create user"));
	}

	await generateAndStore(body.phoneNumber);
	logger.info(
		{ userId: user._id, phone: maskPhone(body.phoneNumber) },
		"Register: OTP sent, awaiting verification",
	);
	return res.status(200).json(
		apiSuccess({
			uid: user._id,
			isVerified: false,
			message: "OTP sent to your phone",
			requireVerification: true,
		}),
	);
}
