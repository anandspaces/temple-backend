import type { Request, Response, NextFunction } from "express";
import { registerSchema } from "../schemas/auth.schemas.ts";
import type { RegisterBody } from "../schemas/auth.schemas.ts";
import logger from "../config/logger.ts";

function stringOrEmpty(value: unknown): string {
	if (value == null) return "";
	return typeof value === "string" ? value : String(value);
}

export function validateRegisterForm(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const body = req.body as Record<string, unknown>;
	const emergencyContact = {
		name: stringOrEmpty(body.emergencyContactName),
		phone: stringOrEmpty(body.emergencyContactPhone),
	};
	const medicalConditionsRaw = stringOrEmpty(body.medicalConditions);
	const medicalConditions = medicalConditionsRaw
		? medicalConditionsRaw
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean)
		: [];
	const formData = {
		...body,
		emergencyContact,
		medicalConditions,
	};

	const result = registerSchema.safeParse(formData);
	if (!result.success) {
		const err = result.error;
		const message =
			err.issues?.map((e) => e.message ?? "invalid").join("; ") ??
			err.message ??
			"Validation failed";
		logger.warn({ path: req.path, message }, "Register form validation failed");
		return res.status(400).json({ success: false, error: message });
	}
	(req as Request & { validatedBody: RegisterBody }).validatedBody =
		result.data;
	next();
}
