import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({});

export async function main(event: any) {
  const id = uuidv4();
  const body = JSON.parse(event.body || "{}");

  const item = {
    id: { S: id },
    status: { S: "pending" },
    request: { S: JSON.stringify(body) },
    response: { S: "" },
  };

  await client.send(new PutItemCommand({
    TableName: process.env.TABLE_NAME,
    Item: item,
  }));

  return {
    statusCode: 202,
    body: JSON.stringify({ examId: id }),
  };
}
