import mongoose, { model, Schema } from "mongoose";

const sessionSchema = new Schema(
	{
		userId: { type: String, required: true, index: true },
		tokenId: { type: String, required: true, unique: true },
		expiresAt: { type: Date, required: true },
	},
	{ timestamps: true },
);

// TTL index: MongoDB removes documents when expiresAt has passed
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SessionModel = model("Session", sessionSchema);
export const Session =
	(mongoose.models.Session as typeof SessionModel) ?? SessionModel;
