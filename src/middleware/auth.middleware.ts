import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { PendingOnboarding } from "../models/PendingOnboarding.ts";
import { User } from "../models/User.ts";
import { verifyToken } from "../services/token.service.ts";
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
	const payload = await verifyToken(token);
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
 * onboardingUser to req. Responds 401 if token missing/invalid, 403 if pending
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
		res.status(401).json(apiError("Unauthorized"));
		return;
	}
	const payload = await verifyToken(token);
	if (!payload) {
		res.status(401).json(apiError("Unauthorized"));
		return;
	}
	const userId = payload.userId;
	let objectId: mongoose.Types.ObjectId;
	try {
		objectId = new mongoose.Types.ObjectId(userId);
	} catch {
		res.status(401).json(apiError("Unauthorized"));
		return;
	}

	const user = await User.findById(objectId);
	if (user) {
		if (user.onboardingComplete) {
			res.status(400).json(apiError("Already onboarded"));
			return;
		}
		(req as RequestWithOnboarding).onboardingUser = user;
		next();
		return;
	}

	const pending = await PendingOnboarding.findById(objectId);
	if (pending) {
		if (pending.expiresAt && new Date() > pending.expiresAt) {
			await PendingOnboarding.findByIdAndDelete(objectId);
			res.status(403).json(apiError("Verification expired. Please verify OTP again."));
			return;
		}
		(req as RequestWithOnboarding).onboardingPending = pending;
		next();
		return;
	}

	res.status(401).json(apiError("Unauthorized"));
}
