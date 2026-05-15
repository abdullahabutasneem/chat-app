import amqp from "amqplib";
let channel;
export const connectRabbitMQ = async () => {
    try {
        const connection = await amqp.connect({
            protocol: "amqp",
            hostname: process.env.RABBITMQ_HOST || "",
            port: 5672,
            username: process.env.RABBITMQ_USERNAME || "",
            password: process.env.RABBITMQ_PASSWORD || "",
        });
        channel = await connection.createChannel();
        console.log("✅ Connected to RabbitMQ");
        return channel;
    }
    catch (error) {
        console.log("Failed to connect to RabbitMQ", error);
    }
};
