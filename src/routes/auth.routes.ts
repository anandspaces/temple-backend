/**
 * Auth routes (mount at /auth).
 * - POST /send-otp            – send OTP to phone (no token).
 * - POST /verify-otp          – verify OTP; always returns accessToken, expiresIn, userId, onboarding; user when onboarded.
 * - POST /complete-onboarding – Bearer token required; profile body only; returns accessToken, user.
 */
import express = require("express");

import {
	completeOnboarding,
	sendOtp,
	verifyOtp,
} from "../controllers/auth.controller.ts";
import { requireAuthForOnboarding } from "../middleware/auth.middleware.ts";
import { registerUpload } from "../middleware/upload.middleware.ts";
import { validateCompleteOnboardingForm } from "../middleware/validateRegisterForm.middleware.ts";
import { validateBody } from "../middleware/validation.middleware.ts";
import { sendOtpSchema, verifyOtpSchema } from "../schemas/auth.schemas.ts";

export const authRoutes = express.Router();

authRoutes.post("/send-otp", validateBody(sendOtpSchema), sendOtp);
authRoutes.post("/verify-otp", validateBody(verifyOtpSchema), verifyOtp);
authRoutes.post(
	"/complete-onboarding",
	requireAuthForOnboarding,
	registerUpload,
	validateCompleteOnboardingForm,
	completeOnboarding,
);
