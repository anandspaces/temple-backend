import z from "zod";
import { MEDICAL_CONDITIONS } from "../types/types.ts";

const phoneSchema = z.string().min(10).max(15);

/** Required where phoneNumber is required (send-otp, verify-otp, onboarding). */
const countryCodeSchema = z.string().min(1).max(5);

export const sendOtpSchema = z.object({
	phoneNumber: phoneSchema,
	countryCode: countryCodeSchema,
});

export const verifyOtpSchema = z.object({
	phoneNumber: phoneSchema,
	otp: z.string().length(6),
	countryCode: countryCodeSchema,
});

export const emergencyContactSchema = z.object({
	name: z.string().default(""),
	phone: z.union([z.literal(""), z.string().min(10).max(15)]).default(""),
	countryCode: z.union([z.literal(""), z.string().min(1).max(5)]).default(""),
});

const medicalConditionSchema = z.union([
	z.enum(MEDICAL_CONDITIONS),
	z.string().min(1),
]);

export const registerSchema = z.object({
	language: z.string().min(1),
	fullName: z.string().min(1),
	age: z.coerce.number().int().min(1).max(150),
	gender: z.string().min(1),
	phoneNumber: phoneSchema,
	countryCode: countryCodeSchema,
	/** Optional: emergency contact is optional, so emergency country code is optional. */
	emergencyCountryCode: z
		.union([z.literal(""), z.string().min(1).max(5)])
		.optional()
		.default(""),
	residentialAddress: z.string().min(1),
	medicalConditions: z.array(medicalConditionSchema),
	emergencyContact: emergencyContactSchema,
	email: z.union([z.email(), z.literal("")]).optional(),
});

/** Partial update for PATCH /users/me; phoneNumber omitted (identity cannot change here). */
export const updateUserSchema = registerSchema
	.omit({ phoneNumber: true })
	.partial();

/** Complete onboarding: profile only; identity (phoneNumber, countryCode) comes from Bearer token. */
export const completeOnboardingSchema = registerSchema.omit({
	phoneNumber: true,
	countryCode: true,
});

export type SendOtpBody = z.output<typeof sendOtpSchema>;
export type VerifyOtpBody = z.output<typeof verifyOtpSchema>;
export type RegisterBody = z.output<typeof registerSchema>;
export type CompleteOnboardingBody = z.output<typeof completeOnboardingSchema>;
export type UpdateUserBody = z.output<typeof updateUserSchema>;
