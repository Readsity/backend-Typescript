import { Router } from "express";
import UserController from "../controllers/userController";
import Authentication from "../middlewares/auth";
import validator from "../middlewares/validator";

import {
  validateSignup, validateLogin, validateProfile, validateEmail, validateAccount
} from "../validations/user";

const router = Router();
const { verifyToken } = Authentication;
const {
  createUser, loginUser, resendOtp, verifyAccount,
  getAllUsers, reset, recover
} = UserController;

router.post("/login", validator(validateLogin), loginUser);
router.post("/register", validator(validateSignup), createUser);
router.post("/otp/resend", validator(validateEmail), resendOtp);

router.get("/", verifyToken, getAllUsers);

router.patch("/update", verifyToken, validator(validateProfile));
router.patch("/verify", validator(validateAccount), verifyAccount);
router.patch("/recover-account", validator(validateEmail), recover);
router.patch("/reset-password", validator(validateAccount), reset);

export default router;
