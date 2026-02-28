import type { OtpProvider } from "./otp.service.ts";
import logger from "../config/logger.ts";

/**
 * Placeholder for MSG91 SMS provider.
 * For now only logs; replace the implementation with real MSG91 API calls when ready.
 * See: https://docs.msg91.com/
 */
export function getMsg91Provider(): OtpProvider {
  return {
    async send(phoneNumber: string, otp: string) {
      logger.info(
        { phone: phoneNumber.slice(-4), otp: "***" },
        "MSG91 placeholder: OTP not sent (replace with real API)"
      );
      // TODO: call MSG91 API, e.g.:
      // await fetch(MSG91_URL, { method: "POST", body: JSON.stringify({ ... }) });
    },
  };
}
