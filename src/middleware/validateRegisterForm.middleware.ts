import type { NextFunction, Request, Response } from "express";
import logger from "../config/logger.ts";
import type {
	CompleteOnboardingBody,
	RegisterBody,
} from "../schemas/auth.schemas.ts";
import {
	completeOnboardingSchema,
	registerSchema,
} from "../schemas/auth.schemas.ts";

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
		countryCode: stringOrEmpty(body.emergencyCountryCode),
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

/** Profile-only form for POST /auth/complete-onboarding. Identity comes from Bearer token. */
export function validateCompleteOnboardingForm(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const body = req.body as Record<string, unknown>;
	const emergencyContact = {
		name: stringOrEmpty(body.emergencyContactName),
		phone: stringOrEmpty(body.emergencyContactPhone),
		countryCode: stringOrEmpty(body.emergencyCountryCode),
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

	const result = completeOnboardingSchema.safeParse(formData);
	if (!result.success) {
		const err = result.error;
		const message =
			err.issues?.map((e) => e.message ?? "invalid").join("; ") ??
			err.message ??
			"Validation failed";
		logger.warn(
			{ path: req.path, message },
			"Complete onboarding form validation failed",
		);
		return res.status(400).json({ success: false, error: message });
	}
	(req as Request & { validatedBody: CompleteOnboardingBody }).validatedBody =
		result.data;
	next();
}
