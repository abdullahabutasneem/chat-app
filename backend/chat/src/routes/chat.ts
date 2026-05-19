import express, { Router } from "express";
import isAuth from "../middleware/isAuth.js";
import { createNewChat, getAllChats } from "../controller/chat.js";


const router = express.Router();
router.post("/chat/new", isAuth, createNewChat);
router.get("/chat/all", isAuth, getAllChats);

export default router;