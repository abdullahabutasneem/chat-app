import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { createClient } from "redis";

dotenv.config();
connectDB();

export const redisClient = createClient({
    url: process.env.REDIS_URL || "",
});

redisClient.connect().then(() => {
    console.log("Connected to Redis");
}).catch(err => {
    console.log("Failed to connect to Redis", err);
})

const app = express();

const PORT = process.env.PORT || 5000;

app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
});
