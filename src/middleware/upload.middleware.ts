import multer from "multer";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

export const registerUpload = upload.fields([
  { name: "aadhaarFile", maxCount: 1 },
  { name: "profileAvatar", maxCount: 1 },
]);
