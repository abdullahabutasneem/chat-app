import express from "express";
import { loginUser } from "../controller/user.js";
const router = express.Router();
router.post("/login", loginUser);
export default router;
