const PORT = process.env.PORT as string;
const MONGO_URI = process.env.MONGO_URI as string;
const OTP_EXPIRY_MINUTES = process.env.OTP_EXPIRY_MINUTES as string;
const LOG_LEVEL = process.env.LOG_LEVEL as string;
const TEST_OTP = process.env.TEST_OTP as string | undefined;
const JWT_SECRET = process.env.JWT_SECRET as string | undefined;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN as string | undefined;
const API_BASE_URL = process.env.API_BASE_URL as string | undefined;

export const env = {
	PORT: Number(PORT),
	MONGO_URI,
	OTP_EXPIRY_MINUTES: Number(OTP_EXPIRY_MINUTES),
	LOG_LEVEL: LOG_LEVEL || undefined,
	/** When set (e.g. "123456"), this OTP is used for all send-otp/register flows for testing. */
	TEST_OTP: TEST_OTP && TEST_OTP.length >= 6 ? TEST_OTP : undefined,
	JWT_SECRET: JWT_SECRET || undefined,
	/** Access token and session lifetime (e.g. "30d", "7d", "24h"). Default "30d". */
	JWT_EXPIRES_IN: JWT_EXPIRES_IN || "30d",
	/** Backend base URL for absolute file URLs (e.g. https://api.example.com). When set, profileAvatarUrl and aadhaarIdFileUrl in responses are prefixed with this. */
	API_BASE_URL: API_BASE_URL?.replace(/\/$/, "") || "",
} as const;
