import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import chatRoute from "./routes/chat.js";
import { app, server } from "./config/socket.js";

dotenv.config();

connectDB();

const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());


app.use("/api/v1", chatRoute);

server.listen(PORT, () => {
    console.log(`Chat service is running on port ${PORT}`);
});

