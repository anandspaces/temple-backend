/**
 * OpenAPI 3 document for Temple Backend API. Used by GET /api-docs/openapi.json and Swagger UI at GET /docs.
 * Schemas are derived from Zod (auth.schemas.ts) via zod-openapi.
 */
import { createDocument } from "zod-openapi";
import {
	completeOnboardingSchema,
	loginSchema,
	sendOtpSchema,
	updateUserSchema,
	verifyOtpSchema,
} from "./schemas/auth.schemas.ts";

export const openApiDocument = createDocument({
	openapi: "3.0.3",
	info: {
		title: "Temple Backend API",
		version: "1.0.0",
	},
	servers: [{ url: "/" }],
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
				description:
					"JWT access token from POST /auth/verify-otp or complete-onboarding",
			},
		},
	},
	paths: {
		"/": {
			get: {
				summary: "Health check",
				responses: {
					"200": {
						description: "Server running",
						content: {
							"text/plain": {
								schema: {
									type: "string" as const,
									example: "Temple Backend running with Bun😊",
								},
							},
						},
					},
				},
			},
		},
		"/auth/send-otp": {
			post: {
				summary: "Send OTP to phone",
				requestBody: {
					content: {
						"application/json": { schema: sendOtpSchema },
					},
				},
				responses: {
					"200": {
						description: "OTP sent",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean" },
										data: { type: "object" },
									},
								},
							},
						},
					},
					"400": { description: "Validation error" },
				},
			},
		},
		"/auth/verify-otp": {
			post: {
				summary: "Verify OTP; returns accessToken, userId, onboarding",
				requestBody: {
					content: {
						"application/json": { schema: verifyOtpSchema },
					},
				},
				responses: {
					"200": {
						description: "Token and user state",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean" },
										data: {
											type: "object",
											properties: {
												accessToken: { type: "string" },
												expiresIn: { type: "number" },
												userId: { type: "string" },
												onboarding: { type: "boolean" },
												user: {
													type: "object",
													description: "Present when onboarding true",
												},
											},
										},
									},
								},
							},
						},
					},
					"400": { description: "Invalid or expired OTP" },
				},
			},
		},
		"/auth/register/verify-otp": {
			post: {
				summary: "Alias for verify-otp",
				requestBody: {
					content: {
						"application/json": { schema: verifyOtpSchema },
					},
				},
				responses: {
					"200": { description: "Same as POST /auth/verify-otp" },
					"400": { description: "Invalid or expired OTP" },
				},
			},
		},
		"/auth/complete-onboarding": {
			post: {
				summary: "Complete profile (Bearer required)",
				security: [{ bearerAuth: [] }],
				requestBody: {
					content: {
						"multipart/form-data": {
							schema: completeOnboardingSchema,
						},
					},
				},
				responses: {
					"200": {
						description:
							"Onboarding complete; returns new accessToken and user",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean" },
										data: {
											type: "object",
											properties: {
												accessToken: { type: "string" },
												expiresIn: { type: "number" },
												user: { type: "object" },
											},
										},
									},
								},
							},
						},
					},
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
					"403": { description: "Verification expired" },
				},
			},
		},
		"/auth/login": {
			post: {
				summary: "Deprecated; use send-otp then verify-otp",
				deprecated: true,
				requestBody: {
					content: {
						"application/json": { schema: loginSchema },
					},
				},
				responses: {
					"400": { description: "Deprecated; use verify-otp" },
				},
			},
		},
		"/auth/register": {
			post: {
				summary: "Deprecated; use send-otp, verify-otp, complete-onboarding",
				deprecated: true,
				requestBody: {
					content: {
						"multipart/form-data": {
							schema: completeOnboardingSchema,
							example: "Full registration form",
						},
					},
				},
				responses: {
					"400": { description: "Deprecated or validation error" },
				},
			},
		},
		"/users/me": {
			get: {
				summary: "Current user profile",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": {
						description: "User profile",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean" },
										data: { type: "object" },
									},
								},
							},
						},
					},
					"401": { description: "Unauthorized" },
				},
			},
			patch: {
				summary: "Update profile (partial)",
				security: [{ bearerAuth: [] }],
				requestBody: {
					content: {
						"application/json": { schema: updateUserSchema },
					},
				},
				responses: {
					"200": {
						description: "Updated profile",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										success: { type: "boolean" },
										data: { type: "object" },
									},
								},
							},
						},
					},
					"400": { description: "Validation error" },
					"401": { description: "Unauthorized" },
				},
			},
			delete: {
				summary: "Delete account",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "Account deleted" },
					"401": { description: "Unauthorized" },
				},
			},
		},
	},
});
