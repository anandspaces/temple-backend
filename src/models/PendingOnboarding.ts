import mongoose, { model, Schema } from "mongoose";

const PENDING_TTL_MINUTES = 15;

const pendingOnboardingSchema = new Schema(
	{
		phoneNumber: { type: String, required: true, unique: true, trim: true },
		verifiedAt: { type: Date, default: () => new Date() },
		expiresAt: {
			type: Date,
			default: () => new Date(Date.now() + PENDING_TTL_MINUTES * 60 * 1000),
		},
	},
	{ timestamps: true },
);

const PendingOnboardingModel = model(
	"PendingOnboarding",
	pendingOnboardingSchema,
);
export const PendingOnboarding = (mongoose.models.PendingOnboarding ??
	PendingOnboardingModel) as typeof PendingOnboardingModel;
