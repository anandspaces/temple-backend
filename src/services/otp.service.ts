import { env } from "../config/env.ts";
import logger from "../config/logger.ts";

export interface OtpProvider {
  send(phoneNumber: string, otp: string): Promise<void>;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return "*".repeat(phone.length - 4) + phone.slice(-4);
}

/** In-memory store: phone -> { otp, expiresAt } */
const otpStore = new Map<
  string,
  { otp: string; expiresAt: number }
>();

/** In-memory store: phone verified for registration (short TTL) */
const phoneVerifiedStore = new Map<string, number>();

const TTL_MS = env.OTP_EXPIRY_MINUTES * 60 * 1000;
const VERIFIED_TTL_MS = 10 * 60 * 1000; // 10 min for "phone verified" for registration

function generateDummyOtp(): string {
  if (env.TEST_OTP) return env.TEST_OTP;
  return Math.floor(100_000 + Math.random() * 900_000).toString();
}

/** Placeholder: no real SMS. Replace with getMsg91Provider() for production. */
const dummyProvider: OtpProvider = {
  async send(phoneNumber: string, otp: string) {
    logger.info({ phone: maskPhone(phoneNumber), otp }, "OTP sent (dev dummy)");
  },
};

let currentProvider: OtpProvider = dummyProvider;

export function setOtpProvider(provider: OtpProvider): void {
  currentProvider = provider;
}

export async function generateAndStore(phoneNumber: string): Promise<string> {
  const otp = generateDummyOtp();
  const expiresAt = Date.now() + TTL_MS;
  otpStore.set(phoneNumber, { otp, expiresAt });
  await currentProvider.send(phoneNumber, otp);
  return otp;
}

export function verify(phoneNumber: string, otp: string): boolean {
  const entry = otpStore.get(phoneNumber);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phoneNumber);
    return false;
  }
  if (entry.otp !== otp) return false;
  otpStore.delete(phoneNumber);
  return true;
}

export function markPhoneVerifiedForRegistration(phoneNumber: string): void {
  phoneVerifiedStore.set(phoneNumber, Date.now() + VERIFIED_TTL_MS);
}

export function isPhoneVerifiedForRegistration(phoneNumber: string): boolean {
  const expiresAt = phoneVerifiedStore.get(phoneNumber);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    phoneVerifiedStore.delete(phoneNumber);
    return false;
  }
  return true;
}
