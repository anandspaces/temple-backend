import type { Request, Response, NextFunction } from "express";
import logger from "../config/logger.ts";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
	const start = Date.now();
	res.on("finish", () => {
		const durationMs = Date.now() - start;
		logger.info({
			method: req.method,
			path: req.path,
			statusCode: res.statusCode,
			durationMs,
		});
	});
	next();
}
