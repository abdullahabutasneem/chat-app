import { publishToQueue } from "../config/rabbitmq.js";
import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import { Request, Response } from "express";

export const loginUser = TryCatch(async (req: Request, res: Response) => {
    const {email} = req.body;

    const ratelimitKey = `otp:ratelimit:${email}`;
    const rateLimit = await redisClient.get(ratelimitKey);
    if (rateLimit) {
        res.status(429).json({
            message: "Too many requests, please try again later",
        })
        return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = `otp:${email}`;
    await redisClient.set(otpKey, otp, {
        EX: 60 * 5,
    });

    await redisClient.set(ratelimitKey, "1", {
        EX: 60,
    })

    const message = {
        to: email,
        subject: "Your OTP code",
        body: `Your OTP is ${otp}. It is valid for 5 minutes.`,
    };

    await publishToQueue("send-otp", message);

    res.status(200).json({
        message: "OTP sent to your email",
    });
})

