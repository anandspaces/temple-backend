/**
 * User routes (mount at /users). All require Authorization: Bearer <accessToken>.
 * - GET    /users/me  – current user profile
 * - PATCH  /users/me  – partial update
 * - DELETE /users/me  – delete account
 */
import express = require("express");
import { requireAuth } from "../middleware/auth.middleware.ts";
import { validateBody } from "../middleware/validation.middleware.ts";
import { updateUserSchema } from "../schemas/auth.schemas.ts";
import { getMe, updateMe, deleteMe } from "../controllers/user.controller.ts";

export const userRoutes = express.Router();

userRoutes.use(requireAuth);

userRoutes.get("/me", getMe);
userRoutes.patch("/me", validateBody(updateUserSchema), updateMe);
userRoutes.delete("/me", deleteMe);
