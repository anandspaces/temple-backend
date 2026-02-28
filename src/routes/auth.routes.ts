/**
 * Auth routes (mount at /auth).
 * - POST /register      – multipart form: start or complete registration; sends OTP if phone not verified.
 * - POST /send-otp      – send OTP to phone (no token).
 * - POST /verify-otp    – registration only: confirm phone, set isPhoneVerified (no token).
 * - POST /register/verify-otp – alias for verify-otp (registration flow).
 * - POST /login         – sign-in with phone + OTP; returns accessToken, expiresIn, user.
 */
import express = require("express");
import { validateBody } from "../middleware/validation.middleware.ts";
import { registerUpload } from "../middleware/upload.middleware.ts";
import { validateRegisterForm } from "../middleware/validateRegisterForm.middleware.ts";
import { sendOtpSchema, verifyOtpSchema, loginSchema } from "../schemas/auth.schemas.ts";
import { sendOtp, verifyOtp, login, register } from "../controllers/auth.controller.ts";

export const authRoutes = express.Router();

authRoutes.post("/register", registerUpload, validateRegisterForm, register);
authRoutes.post("/send-otp", validateBody(sendOtpSchema), sendOtp);
authRoutes.post("/verify-otp", validateBody(verifyOtpSchema), verifyOtp);
authRoutes.post("/register/verify-otp", validateBody(verifyOtpSchema), verifyOtp);
authRoutes.post("/login", validateBody(loginSchema), login);
