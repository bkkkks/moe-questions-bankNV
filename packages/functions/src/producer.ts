import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.QUEUE_URL!;

export async function handler(event: any) {
  try {
    const body = JSON.parse(event.body);

    // تأكد إن فيه examID
    if (!body.examID) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing examID in request" }),
      };
    }

    const command = new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(body),
    });

    await sqs.send(command);

    return {
      statusCode: 202,
      body: JSON.stringify({ message: "Exam creation request queued.", examID: body.examID }),
    };
  } catch (err) {
    console.error("Error in producer:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send message to queue" }),
    };
  }
}
