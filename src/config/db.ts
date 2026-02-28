import mongoose from "mongoose";
import { env } from "./env.ts";
import logger from "./logger.ts";

export async function connectDb(): Promise<void> {
	await mongoose.connect(env.MONGO_URI);
	logger.info("MongoDB connected");
}

export function disconnectDb(): Promise<void> {
	return mongoose.disconnect();
}
