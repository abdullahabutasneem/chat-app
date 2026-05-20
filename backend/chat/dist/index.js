import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import chatRoute from "./routes/chat.js";
dotenv.config();
connectDB();
const PORT = process.env.PORT;
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/v1", chatRoute);
app.listen(PORT, () => {
    console.log(`Chat service is running on port ${PORT}`);
});
