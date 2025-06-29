import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({});
const QUEUE_URL = process.env.QUEUE_URL!;

export async function handler(event: any) {
  const body = JSON.parse(event.body);

  const command = new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify(event.body),
  });

  await sqs.send(command);

  return {
    statusCode: 202,
    body: JSON.stringify({ message: "Exam creation request queued." }),
  };
}
