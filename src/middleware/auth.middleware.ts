import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/token.service.ts";
import { User } from "../models/User.ts";
import { apiError } from "../types/types.ts";

export interface AuthenticatedUser {
	_id: import("mongoose").Types.ObjectId;
	fullName: string;
	phoneNumber: string;
	[key: string]: unknown;
}

export type RequestWithAuth = Request & { user?: AuthenticatedUser };

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
