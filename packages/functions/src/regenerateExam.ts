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
  const tableName = "bank-moe-questions-bank-Exams"

  let data;

  //Handle empty body
  if (!event.body) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: true }),
    };
  }

  data = JSON.parse(event.body);
  console.log(event.body);

  
  const examID = data.examID;
  const exam = data.examContent;
  const contributors = data.contributors;
  const feedback = data.feedback;
  



  try {
    const prompt = `
    📚 As a school exam generator AI, your job is to update specific parts of an exam based on user feedback.
    
    ✏️ Modify only the parts related to the feedback. Do NOT change anything else.
    
    ---
    
    📌 Feedback (from user):
    ${JSON.stringify(feedback, null, 2)}
    
    ---
    
    📝 Original Exam:
    ${JSON.stringify(exam, null, 2)}
    
    ---
    
    ⚠️ Important:
    - Return the full updated exam as a valid JSON OBJECT.
    - Do not add explanations. Just return the JSON object directly.
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

    // Extract and print the response text.
    const responseText = response.output.message.content[0].text;
    console.log("🤖 Claude Response:", responseText);
    


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
          ":examContent": JSON.stringify(parsedExam),
          ":contributors": contributors,
        },
      })
    );


    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        newExamContent: responseText,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error generating question: " + error.message,
      }),
    };
  }
}
