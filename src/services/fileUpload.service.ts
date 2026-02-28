import fs from "fs";
import path from "path";
import logger from "../config/logger.ts";

export interface UploadResult {
	url: string;
}

/** Safe slug from original name: alphanumeric, dash, one dot for extension. */
function safeSlug(originalname: string): { name: string; ext: string } {
	const base = (originalname || "file").trim();
	const lastDot = base.lastIndexOf(".");
	const ext =
		lastDot > 0 ? base.slice(lastDot + 1).replace(/\W/g, "") || "" : "";
	const namePart = lastDot > 0 ? base.slice(0, lastDot) : base;
	const name = namePart
		.replace(/\s+/g, "-")
		.replace(/[^a-zA-Z0-9.-]/g, "")
		.slice(0, 32);
	return { name: name || "file", ext };
}

export async function storeFile(
	file: Express.Multer.File,
): Promise<UploadResult> {
	const { name, ext } = safeSlug(file.originalname || "file");
	const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	const filename = ext ? `${unique}-${name}.${ext}` : `${unique}-${name}`;
	const fullPath = path.join("uploads", filename);
	fs.writeFileSync(fullPath, file.buffer);
	const url = `uploads/${filename}`;
	logger.info({ url, originalname: file.originalname }, "File stored");
	return { url };
}

let placeholderId = 0;

export async function storeFilePlaceholder(
	_file?: unknown,
	_metadata?: Record<string, unknown>,
): Promise<UploadResult> {
	placeholderId += 1;
	const url = `uploads/placeholder-${placeholderId}`;
	logger.info({ url }, "File placeholder stored");
	return { url };
}
