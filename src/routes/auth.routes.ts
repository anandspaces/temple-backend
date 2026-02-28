/**
 * Auth routes (mount at /auth).
 * - POST /send-otp            – send OTP to phone (no token).
 * - POST /verify-otp          – verify OTP; returns userId + onboarding: false or accessToken + user (if onboarded).
 * - POST /register/verify-otp – alias for verify-otp.
 * - POST /complete-onboarding  – complete profile for userId from verify-otp; returns accessToken, user.
 * - POST /register            – deprecated; returns 400 (use send-otp → verify-otp → complete-onboarding).
 * - POST /login               – sign-in with phone + OTP (onboarded users only); returns accessToken, user.
 */
import express = require("express");

import {
	completeOnboarding,
	login,
	register,
	sendOtp,
	verifyOtp,
} from "../controllers/auth.controller.ts";
import { registerUpload } from "../middleware/upload.middleware.ts";
import {
	validateCompleteOnboardingForm,
	validateRegisterForm,
} from "../middleware/validateRegisterForm.middleware.ts";
import { validateBody } from "../middleware/validation.middleware.ts";
import {
	loginSchema,
	sendOtpSchema,
	verifyOtpSchema,
} from "../schemas/auth.schemas.ts";

export const authRoutes = express.Router();

authRoutes.post("/send-otp", validateBody(sendOtpSchema), sendOtp);
authRoutes.post("/verify-otp", validateBody(verifyOtpSchema), verifyOtp);
authRoutes.post(
	"/register/verify-otp",
	validateBody(verifyOtpSchema),
	verifyOtp,
);
authRoutes.post(
	"/complete-onboarding",
	registerUpload,
	validateCompleteOnboardingForm,
	completeOnboarding,
);
authRoutes.post("/register", registerUpload, validateRegisterForm, register);
authRoutes.post("/login", validateBody(loginSchema), login);
