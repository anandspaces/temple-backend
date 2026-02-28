import pino from "pino";
import { env } from "./env.ts";

const isProduction = process.env.NODE_ENV === "production";
const logLevel = (env.LOG_LEVEL ?? (isProduction ? "info" : "debug")) as pino.Level;

const logger = pino({
  level: logLevel,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});

export function child(bindings: pino.Bindings): pino.Logger {
  return logger.child(bindings);
}

export default logger;
