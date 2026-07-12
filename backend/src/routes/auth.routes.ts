import { Router } from "express";
import {
  forgotPassword,
  login,
  register,
  resetPassword,
  resendVerification,
  verifyEmail,
} from "../controllers/auth.controller";

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.post("/resend-verification", resendVerification);
router.get("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
