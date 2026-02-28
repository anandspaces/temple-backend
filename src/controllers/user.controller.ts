import type { Response } from "express";
import logger from "../config/logger.ts";
import type { RequestWithAuth } from "../middleware/auth.middleware.ts";
import { User } from "../models/User.ts";
import type { UpdateUserBody } from "../schemas/auth.schemas.ts";
import { apiError, apiSuccess } from "../types/types.ts";

type ReqWithUpdateBody = RequestWithAuth & { validatedBody?: UpdateUserBody };

// Mongoose model union (mongoose.models.User ?? model()) breaks filter typing; use cast for find* calls.
const UserModel = User as {
	findOne: (q: { _id: unknown }) => ReturnType<typeof User.findOne>;
	findOneAndUpdate: (
		q: { _id: unknown },
		u: UpdateUserBody,
		o: { new: true },
	) => ReturnType<typeof User.findOneAndUpdate>;
	findOneAndDelete: (q: {
		_id: unknown;
	}) => ReturnType<typeof User.findOneAndDelete>;
};

export async function getMe(req: RequestWithAuth, res: Response) {
	const userId = req.user!._id;
	const user = await UserModel.findOne({ _id: userId }).lean();
	if (!user) {
		logger.warn({ userId }, "getMe: user not found");
		return res.status(404).json(apiError("User not found"));
	}
	logger.info({ userId }, "getMe success");
	return res.status(200).json(apiSuccess(user));
}

export async function updateMe(req: ReqWithUpdateBody, res: Response) {
	const userId = req.user!._id;
	const updates = req.validatedBody!;
	const updated = await UserModel.findOneAndUpdate({ _id: userId }, updates, {
		new: true,
	}).lean();
	if (!updated) {
		logger.warn({ userId }, "updateMe: user not found");
		return res.status(404).json(apiError("User not found"));
	}
	logger.info({ userId }, "updateMe success");
	return res.status(200).json(apiSuccess(updated));
}

export async function deleteMe(req: RequestWithAuth, res: Response) {
	const userId = req.user!._id;
	const deleted = await UserModel.findOneAndDelete({ _id: userId });
	if (!deleted) {
		logger.warn({ userId }, "deleteMe: user not found");
		return res.status(404).json(apiError("User not found"));
	}
	logger.info({ userId }, "deleteMe success");
	return res.status(200).json(apiSuccess({ message: "Account deleted" }));
}
