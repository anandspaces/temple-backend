import logger from "../config/logger.ts";

/** Placeholder: returns a stored reference URL. Replace with S3/GCP later. */
let placeholderId = 0;

export interface UploadResult {
  url: string;
}

export async function storeFile(
  file: Express.Multer.File
): Promise<UploadResult> {
  placeholderId += 1;
  const slug = (file.originalname || "file").replace(/\s+/g, "-").slice(0, 32);
  const url = `uploads/placeholder-${placeholderId}-${slug}`;
  logger.info({ url, originalname: file.originalname }, "File stored (placeholder)");
  return { url };
}

export async function storeFilePlaceholder(
  _file?: unknown,
  _metadata?: Record<string, unknown>
): Promise<UploadResult> {
  placeholderId += 1;
  const url = `uploads/placeholder-${placeholderId}`;
  logger.info({ url }, "File placeholder stored");
  return { url };
}
