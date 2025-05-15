import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});

export async function main(event: any) {
  const examId = event.pathParameters?.id;

  if (!examId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing exam ID" }),
    };
  }

  const command = new GetItemCommand({
    TableName: process.env.TABLE_NAME,
    Key: {
      id: { S: examId },
    },
  });

  const response = await client.send(command);
  const item = response.Item;

  if (!item) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Exam not found" }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      id: item.id.S,
      status: item.status.S,
      response: item.response.S,
    }),
  };
}
