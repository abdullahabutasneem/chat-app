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
export const publishToQueue = async (queueName, message) => {
    if (!channel) {
        console.log("RabbitMQ channel not found");
        return;
    }
    await channel.assertQueue(queueName, { durable: true });
    channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
        persistent: true,
    });
    console.log(`📤 Message published to ${queueName}`);
};
