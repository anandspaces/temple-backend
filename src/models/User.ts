import mongoose, { model, Schema } from "mongoose";

const emergencyContactSchema = new Schema(
	{
		name: { type: String, required: true },
		phone: { type: String, required: true },
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
		email: { type: String, trim: true, sparse: true, default: "" },
		residentialAddress: { type: String, required: true },
		aadhaarIdFileUrl: { type: String, default: "" },
		profileAvatarUrl: { type: String, default: "" },
		medicalConditions: { type: [String], default: [] },
		emergencyContact: { type: emergencyContactSchema, required: true },
		isPhoneVerified: { type: Boolean, default: false },
	},
	{ timestamps: true },
);

export const User = mongoose.models.User ?? model("User", userSchema);
