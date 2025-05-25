import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { APIGatewayProxyEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new BedrockRuntimeClient({ region: "us-east-1" });
const modelId = "anthropic.claude-instant-v1";
const dbClient = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(dbClient);

export async function regenerate(event: APIGatewayProxyEvent) {
  const tableName = process.env.TABLE_NAME;

  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing request body" }),
    };
  }

  const data = JSON.parse(event.body);
  const exam = data.examContent;
  const examID = data.examID;
  const contributors = data.contributors;
  const description = data.description;

  try {
    const prompt = `
      As a school exam generator, you will be given an exam that you will have to change based on the
      user's description. Change only what the user asked for. Return only the newly modified exam.

      Description of requested changes: ${description}

      Original exam:
      ${exam}

      The response must be a valid JSON object ONLY (no explanation or intro).
    `;

    const conversation = [
      {
        role: "user",
        content: [{ text: prompt }],
      },
    ];

    const command = new ConverseCommand({
      modelId,
      messages: conversation,
      inferenceConfig: { maxTokens: 1200, temperature: 0.5, topP: 0.9 },
    });

    const response = await client.send(command);
    const responseText = response.output.message.content[0].text;

    // ✅ Parse response to make sure it's valid JSON
    let parsedExam;
    try {
      parsedExam = JSON.parse(responseText);
    } catch (err) {
      console.error("❌ Failed to parse model response as JSON:", responseText);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid JSON returned from model",
          raw: responseText,
        }),
      };
    }

    await dynamo.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { examID },
        UpdateExpression: "SET examContent = :examContent, contributors = :contributors",
        ExpressionAttributeValues: {
          ":examContent": JSON.stringify(parsedExam), // ← store clean JSON
          ":contributors": contributors,
        },
      })
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newExamContent: parsedExam }),
    };
  } catch (error) {
    console.error("Error during regeneration:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to regenerate exam", details: error.message }),
    };
  }
}
