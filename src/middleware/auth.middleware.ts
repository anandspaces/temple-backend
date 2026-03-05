import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import logger from "../config/logger.ts";
import { PendingOnboarding } from "../models/PendingOnboarding.ts";
import { User } from "../models/User.ts";
import { verifyTokenWithSession } from "../services/token.service.ts";
import { apiError } from "../types/types.ts";

export interface AuthenticatedUser {
	_id: import("mongoose").Types.ObjectId;
	fullName: string;
	phoneNumber: string;
	[key: string]: unknown;
}

export type RequestWithAuth = Request & { user?: AuthenticatedUser };

export type RequestWithOnboarding = Request & {
	onboardingPending?: InstanceType<typeof PendingOnboarding>;
	onboardingUser?: InstanceType<typeof User>;
	/** From JWT payload; set by requireAuthForOnboarding */
	phoneNumber?: string;
	countryCode?: string;
};

/**
 * Verifies Authorization: Bearer <accessToken>, loads user, and attaches to req.user.
 * Responds 401 if token is missing, invalid, or user not found.
 */
export async function requireAuth(
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> {
	const authHeader = req.headers.authorization;
	const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
	if (!token) {
		res.status(401).json(apiError("Unauthorized"));
		return;
	}
	const payload = await verifyTokenWithSession(token);
	if (!payload) {
		res.status(401).json(apiError("Unauthorized"));
		return;
	}
	// Mongoose model union (mongoose.models.User ?? model()) breaks findById/findOne typing; cast to satisfy.
	const user = await (
		User as {
			findOne: (q: { _id: string }) => {
				select: (s: string) => { lean: () => Promise<unknown> };
			};
		}
	)
		.findOne({ _id: payload.userId })
		.select("_id fullName phoneNumber")
		.lean();
	if (!user) {
		res.status(401).json(apiError("Unauthorized"));
		return;
	}
	(req as RequestWithAuth).user = user as AuthenticatedUser;
	next();
}

/**
 * For POST /auth/complete-onboarding. Verifies Bearer token and resolves to
 * PendingOnboarding or User (not yet onboarded). Attaches onboardingPending or
 * onboardingUser to req. Responds 401 if token missing/invalid or if token valid
 * but no User/PendingOnboarding found (e.g. session expired), 403 if pending
 * expired, 400 if user already onboarded.
 */
export async function requireAuthForOnboarding(
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> {
	const authHeader = req.headers.authorization;
	const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
	if (!token) {
		logger.warn({ path: req.path }, "complete-onboarding auth: no token");
		res.status(401).json(apiError("Unauthorized"));
		return;
	}
	const payload = await verifyTokenWithSession(token);
	if (!payload) {
		logger.warn(
			{ path: req.path },
			"complete-onboarding auth: invalid or expired token",
		);
		res.status(401).json(apiError("Unauthorized"));
		return;
	}
	const reqOnboarding = req as RequestWithOnboarding;
	reqOnboarding.phoneNumber = payload.phoneNumber;
	reqOnboarding.countryCode = payload.countryCode ?? "";
	const userId = payload.userId;
	let objectId: mongoose.Types.ObjectId;
	try {
		objectId = new mongoose.Types.ObjectId(userId);
	} catch {
		logger.warn(
			{ path: req.path, userId },
			"complete-onboarding auth: invalid userId in token",
		);
		res.status(401).json(apiError("Unauthorized"));
		return;
	}

	const user = await User.findById(objectId);
	if (user) {
		if (user.onboardingComplete) {
			logger.warn(
				{ path: req.path, userId },
				"complete-onboarding auth: already onboarded",
			);
			res.status(400).json(apiError("Already onboarded"));
			return;
		}
		reqOnboarding.onboardingUser = user;
		next();
		return;
	}

	const pending = await PendingOnboarding.findById(objectId);
	if (pending) {
		if (pending.expiresAt && new Date() > pending.expiresAt) {
			await PendingOnboarding.findByIdAndDelete(objectId);
			logger.warn(
				{ path: req.path, userId },
				"complete-onboarding auth: pending expired",
			);
			res
				.status(403)
				.json(apiError("Verification expired. Please verify OTP again."));
			return;
		}
		reqOnboarding.onboardingPending = pending;
		next();
		return;
	}

	// Valid token but no User or PendingOnboarding (e.g. expired pending deleted, or stale token)
	logger.warn(
		{ path: req.path, userId },
		"complete-onboarding auth: no user or pending for token",
	);
	res
		.status(401)
		.json(apiError("Session invalid or expired. Please verify OTP again."));
}
