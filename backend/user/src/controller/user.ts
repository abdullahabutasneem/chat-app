import { publishToQueue } from "../config/rabbitmq.js";
import TryCatch from "../config/TryCatch.js";
import { redisClient } from "../index.js";
import { Request, Response } from "express";
import { User } from "../model/User.js";
import { generateToken } from "../config/generateToken.js";

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


export const verifyUser = TryCatch(async (req: Request, res: Response) => {
    const {email, otp: enteredOtp} = req.body;

    if (!email || !enteredOtp) {
        res.status(400).json({
            message: "Email and OTP are required",
        })
    }

    const otpKey = `otp:${email}`;
    const storedOtp = await redisClient.get(otpKey);
    if (!storedOtp || storedOtp !== enteredOtp) {
        res.status(400).json({
            message: "Invalid or expired OTP",
        });
        return;
    }

    await redisClient.del(otpKey);

    let user = await User.findOne({email});

    if(!user) {
        const name = email.slice(0, 8);
        user = await User.create({ name, email });
    }

    const token = generateToken(user);

    res.json({
        message: "User verified successfully",
        user,
        token,
    });
});