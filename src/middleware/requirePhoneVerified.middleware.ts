import type { Request, Response, NextFunction } from "express";
import { isPhoneVerifiedForRegistration } from "../services/otp.service.ts";
import logger from "../config/logger.ts";

function maskPhone(phone: string): string {
  if (phone.length <= 4) return "****";
  return "*".repeat(phone.length - 4) + phone.slice(-4);
}

export function requirePhoneVerified(req: Request, res: Response, next: NextFunction) {
  const body = (req as Request & { validatedBody?: { phoneNumber?: string } }).validatedBody ?? req.body;
  const phoneNumber = body?.phoneNumber;
  if (!phoneNumber) {
    logger.warn({ path: req.path }, "Phone number required");
    return res.status(400).json({ success: false, error: "Phone number required" });
  }
  if (!isPhoneVerifiedForRegistration(phoneNumber)) {
    logger.warn({ path: req.path, phone: maskPhone(phoneNumber) }, "Phone not verified for registration");
    return res.status(401).json({ success: false, error: "Phone number not verified. Complete OTP verification first." });
  }
  next();
}
