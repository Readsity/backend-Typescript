import { Router } from "express";
import userRoutes from "./userRoutes";
import adminRoutes from "./adminRoutes";

const router = Router();

router.use("/users", userRoutes);
router.use("/admins", adminRoutes);

export default router;
