/**
 * Server log file: logs/server.log (cleared on each server restart).
 * Paste this file when sharing debug output.
 */
import fs from "fs";
import pino from "pino";
import { env } from "./env.ts";

export const logFilePath = "logs/server.log";

fs.mkdirSync("logs", { recursive: true });
fs.writeFileSync(logFilePath, "", "utf8");

const fileStream = fs.createWriteStream(logFilePath, { flags: "a" });

const isProduction = process.env.NODE_ENV === "production";
const logLevel = (env.LOG_LEVEL ??
	(isProduction ? "info" : "debug")) as pino.Level;

const logger = pino(
	{ level: logLevel },
	pino.multistream([{ stream: process.stdout }, { stream: fileStream }]),
);

export function child(bindings: pino.Bindings): pino.Logger {
	return logger.child(bindings);
}

export default logger;
