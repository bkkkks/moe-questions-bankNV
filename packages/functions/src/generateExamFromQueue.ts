import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { ENG102PROMPT } from "./prompts/Eng102";
import { ARAB101PROMPT } from "./prompts/Arab101";

const client = new DynamoDBClient({
  region: "us-east-1",
  maxAttempts: 5,
});
const dynamo = DynamoDBDocumentClient.from(client);
const bedrockClient = new BedrockRuntimeClient({ region: "us-east-1" });
const modelId = "anthropic.claude-3-5-sonnet-20240620-v1:0";

// ✅ Entry point triggered by SQS
export async function handler(event: any) {
  console.log("📩 generateExamFromQueue triggered", JSON.stringify(event));

  const tableName = process.env.TABLE_NAME;
  const knowledgeBaseId = process.env.KNOWLEDGE_BASE_ID;

  if (!event.Records || event.Records.length === 0) {
    console.log("❌ No records in SQS event");
    return;
  }

  const record = event.Records[0];
  const bodyStr = record.body;

  if (!bodyStr) {
    console.log("❌ SQS message body is empty");
    return;
  }

  const eventLike = { body: bodyStr };
  return await createExam(eventLike, tableName, knowledgeBaseId);
}

// ✅ createExam logic - copied exactly as-is from createNewExam.ts
async function createExam(event: any, tableName: string, knowledgeBaseId: string) {
  console.log("📩 createExam triggered", JSON.stringify(event));
  if (!client || !dynamo) {
    console.log("Error with DynamoDB client");
  }

  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Request body is missing" }),
    };
  }

  let data = JSON.parse(event.body);
  console.log(data);

  let body;
  let statusCode = 200;

  let prompt = "";

  if (data.examID) {
    try {
      const result = await dynamo.send(
        new GetCommand({
          TableName: tableName,
          Key: { examID: data.examID },
        })
      );

      if (!result.Item) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Exam not found" }),
        };
      }

      let existingExam = JSON.parse(result.Item.examContent);

      if (data.feedback) {
        prompt = `
        Update the following exam based on the feedback provided.
        Ensure that all related information is recalculated to maintain consistency.
        Feedback: ${JSON.stringify(data.feedback, null, 2)}

        Current Exam Content:
        ${JSON.stringify(existingExam, null, 2)}

        The type of your response must be a JSON object containing the updated exam only. Ensure all changes are reflected accurately
        `;
      } else {
        prompt = `
        Regenerate the following exam to improve its structure, variety, and balance.
        Maintain the original structure and question count unless specified otherwise.

        Current Exam Content:
        ${JSON.stringify(existingExam, null, 2)}

        The type of your response must be a JSON object containing the updated exam only.
        `;
      }

      const command = new ConverseCommand({
        modelId,
        //@ts-ignore
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 4096, temperature: 0.5, topP: 0.9 },
      });

      const response = await bedrockClient.send(command);

      const fullText = response.output.message.content[0].text;
      const jsonStart = fullText.indexOf("{");
      const jsonEnd = fullText.lastIndexOf("}");

      if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
        throw new Error("❌ Failed to extract JSON: Missing or invalid braces");
      }

      const cleanedJson = fullText.slice(jsonStart, jsonEnd + 1).trim();

      let parsed;
      try {
        parsed = JSON.parse(cleanedJson);
      } catch (err) {
        console.error("❌ Invalid JSON returned from model:", cleanedJson);
        throw new Error("Returned content is not valid JSON");
      }

      await dynamo.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { examID: data.examID },
          UpdateExpression:
            "SET examContent = :examContent, numOfRegenerations = if_not_exists(numOfRegenerations, :zero) + :incr, contributors = :contributors",
          ExpressionAttributeValues: {
            ":examContent": cleanedJson,
            ":incr": 1,
            ":zero": 0,
            ":contributors": data.contributors,
          },
        })
      );

      body = { message: "Exam successfully regenerated", newExamContent: cleanedJson };
    } catch (error) {
      console.error("Error regenerating exam:", error);
      statusCode = 500;
      body = { error: "Failed to regenerate exam", details: error.message };
    }
  } else {
    try {
      if (data.subject === "ARAB101") {
        prompt = ARAB101PROMPT;
      } else {
        const bedrockAgentClient = new BedrockAgentRuntimeClient({ region: "us-east-1" });

        let retrieveCommand = new RetrieveCommand({
          knowledgeBaseId: knowledgeBaseId ?? "WCTC0NYEAV",
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              numberOfResults: 10,
            },
          },
          retrievalQuery: {
            text: `${data.class} ${data.subject} questions`,
          },
        });

        if (!data.customize) {
          const relevant_info = (
            await bedrockAgentClient.send(retrieveCommand)
          ).retrievalResults
            ?.map((e) => e.content?.text)
            .join("\n")
            .toString();

          prompt = ENG102PROMPT +
            " Refer to the following relevant information from past exams:" +
            relevant_info;
        }
      }

      const command = new ConverseCommand({
        modelId,
        //@ts-ignore
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 4096, temperature: 0.5, topP: 0.9 },
      });

      let cleanedJson = "";
      try {
        const response = await bedrockClient.send(command);
        const content = response?.output?.message?.content;

        if (!content || !content[0]?.text) {
          throw new Error("Invalid response from Bedrock model – missing content");
        }

        cleanedJson = content[0].text;
      } catch (error) {
        console.error("Bedrock model error:", error);
        statusCode = 500;
        body = { error: "Failed to generate exam content", details: error.message || "Unknown error" };
        return {
          statusCode,
          headers: {
            "Content-Type": "application/json",
            "X-Content-Type-Options": "nosniff",
          },
          body: JSON.stringify(body),
        };
      }

      const uuid = uuidv4();
      await dynamo.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            examID: uuid,
            examState: "building",
            examClass: data.class,
            examSubject: data.subject,
            examSemester: data.semester,
            examDuration: data.duration,
            examMark: data.total_mark,
            examContent: cleanedJson,
            createdBy: data.created_by,
            creationDate: data.creation_date,
            contributors: data.contributors,
            numOfRegenerations: 0,
          },
        })
      );

      body = { examID: uuid, message: "Exam successfully created" };
    } catch (error) {
      console.error("Error creating exam:", error);
      statusCode = 500;
      body = { error: "Failed to create exam", details: error.message };
    }
  }

  if (!body) {
    statusCode = 500;
    body = { error: "Unexpected server error. No response body." };
  }

  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
    body: JSON.stringify(body),
  };
}

