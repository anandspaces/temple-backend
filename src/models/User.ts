import mongoose, { model, Schema } from "mongoose";

const emergencyContactSchema = new Schema(
	{
		name: { type: String, default: "" },
		phone: { type: String, default: "" },
		countryCode: { type: String, default: "" },
	},
	{ _id: false },
);

const userSchema = new Schema(
	{
		language: { type: String, required: true },
		fullName: { type: String, required: true },
		age: { type: Number, required: true },
		gender: { type: String, required: true },
		phoneNumber: { type: String, required: true, unique: true, trim: true },
		countryCode: { type: String, trim: true, default: "" },
		email: { type: String, trim: true, sparse: true, default: "" },
		residentialAddress: { type: String, required: true },
		aadhaarIdFileUrl: { type: String, default: "" },
		profileAvatarUrl: { type: String, default: "" },
		medicalConditions: { type: [String], default: [] },
		emergencyContact: {
			type: emergencyContactSchema,
			default: () => ({ name: "", phone: "", countryCode: "" }),
		},
		isPhoneVerified: { type: Boolean, default: false },
		onboardingComplete: { type: Boolean, default: false },
	},
	{ timestamps: true },
);

const UserModel = model("User", userSchema);
export const User = (mongoose.models.User ?? UserModel) as typeof UserModel;
