import { Server, Socket } from "socket.io";
import http from "http";
import express from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

declare module "socket.io" {
    interface Socket {
        userId?: string;
    }
}

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

io.use((socket: Socket, next) => {
    try {
        const token =
            socket.handshake.auth?.token ||
            (typeof socket.handshake.headers.authorization === "string" &&
                socket.handshake.headers.authorization.startsWith("Bearer ")
                ? socket.handshake.headers.authorization.split(" ")[1]
                : undefined);

        if (!token) {
            return next(new Error("Unauthorized: no token"));
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET as string
        ) as JwtPayload;

        const userId = decoded?.user?._id;
        if (!userId) {
            return next(new Error("Unauthorized: invalid token payload"));
        }

        socket.userId = userId;
        next();
    } catch (err) {
        next(new Error("Unauthorized: invalid token"));
    }
});

const userSocketMap: Record<string, string> = {};

io.on("connection", (socket: Socket) => {
    console.log("User connected", socket.id, "userId:", socket.userId);
    socket.on("disconnect", () => {
        console.log("User disconnected", socket.id);
    });

    socket.on("connection_error", (error) => {
        console.log("Socket Connection error", error);
    });
});

export { app, server, io };