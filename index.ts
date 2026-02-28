import { connectDb } from "./src/config/db.ts";
import { env } from "./src/config/env.ts";
import logger from "./src/config/logger.ts";
import { authRoutes } from "./src/routes/auth.routes.ts";
import { userRoutes } from "./src/routes/user.routes.ts";
import { requestLogger } from "./src/middleware/requestLogger.middleware.ts";

async function main() {
	try {
		await connectDb();
	} catch (err) {
		logger.error({ err }, "MongoDB connection failed");
		process.exit(1);
	}
	const app = createApp();
	app.listen(env.PORT, () => {
		logger.info({ port: env.PORT }, "Server running");
	});
}

main().catch((err) => {
	logger.error({ err }, "Uncaught error");
	process.exit(1);
});
import express = require("express");
import multer from "multer";

export function createApp() {
	const app = express();
	app.use(express.json());
	app.use(requestLogger);

	app.get("/", (_req, res) => {
		res.send("Temple Backend running with Bun");
	});
	app.get("/health", (_req, res) => {
		res.json({ status: "ok" });
	});

	app.use("/auth", authRoutes);
	app.use("/users", userRoutes);

	app.use((req, res) => {
		logger.info({ path: req.path }, "Not found");
		res.status(404).json({ success: false, error: "Not found" });
	});

	app.use(
		(
			err: Error,
			_req: express.Request,
			res: express.Response,
			_next: express.NextFunction,
		) => {
			if (err instanceof multer.MulterError) {
				const message =
					err.code === "LIMIT_FILE_SIZE"
						? "File too large (max 10 MB)"
						: err.message;
				logger.warn({ code: err.code, message }, "Multer error");
				return res.status(400).json({ success: false, error: message });
			}
			logger.error({ err: err.message, stack: err.stack }, "Unhandled error");
			res.status(500).json({ success: false, error: "Internal server error" });
		},
	);

	return app;
}
