import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// إنشاء عميل SQS
const client = new SQSClient({});

export async function handler(event: any) {
  console.log("🚀 Received event:", event);

  // قراءة بيانات الامتحان من body
  const body = JSON.parse(event.body || "{}");

  if (!process.env.QUEUE_URL) {
    console.error("❌ QUEUE_URL not defined");
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Server error: Missing QUEUE_URL" }),
    };
  }

  // إرسال الرسالة إلى SQS
  await client.send(
    new SendMessageCommand({
      QueueUrl: process.env.QUEUE_URL,
      MessageBody: JSON.stringify(body),
    })
  );

  console.log("✅ Message sent to SQS");

  // رد فوري للواجهة الأمامية
  return {
    statusCode: 202,
    body: JSON.stringify({ message: "Exam generation started" }),
  };
}
