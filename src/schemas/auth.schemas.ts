import z from "zod";
import { MEDICAL_CONDITIONS } from "../types/types.ts";

const phoneSchema = z.string().min(10).max(15);

export const sendOtpSchema = z.object({
	phoneNumber: phoneSchema,
});

export const verifyOtpSchema = z.object({
	phoneNumber: phoneSchema,
	otp: z.string().length(6),
});

export const loginSchema = z.object({
	phoneNumber: phoneSchema,
	otp: z.string().length(6),
});

export const emergencyContactSchema = z.object({
	name: z.string().default(""),
	phone: z.union([z.literal(""), z.string().min(10).max(15)]).default(""),
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
	residentialAddress: z.string().min(1),
	medicalConditions: z.array(medicalConditionSchema),
	emergencyContact: emergencyContactSchema,
	email: z.union([z.email(), z.literal("")]).optional(),
});

/** Partial update for PATCH /users/me; phoneNumber omitted (identity cannot change here). */
export const updateUserSchema = registerSchema
	.omit({ phoneNumber: true })
	.partial();

/** MongoDB ObjectId hex string (24 chars). */
const mongoIdSchema = z
	.string()
	.length(24)
	.regex(/^[a-f0-9]+$/i);

/** Complete onboarding: same as register + userId (from verify-otp; may be PendingOnboarding id or User id). */
export const completeOnboardingSchema = registerSchema.extend({
	userId: mongoIdSchema,
});

export type SendOtpBody = z.output<typeof sendOtpSchema>;
export type VerifyOtpBody = z.output<typeof verifyOtpSchema>;
export type LoginBody = z.output<typeof loginSchema>;
export type RegisterBody = z.output<typeof registerSchema>;
export type CompleteOnboardingBody = z.output<typeof completeOnboardingSchema>;
export type UpdateUserBody = z.output<typeof updateUserSchema>;
