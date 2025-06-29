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

export async function handler(event: any) {
  console.log("📩 createNewExam triggered", JSON.stringify(event));

  const records = event?.Records;

  // ✅ direct call (e.g. Postman)
  if (!records) {
    const data = JSON.parse(event.body);
    await processExam(data);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Processed directly" }),
    };
  }

  // ✅ from SQS
  for (const record of records) {
    const data = JSON.parse(record.body);
    await processExam(data);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "SQS exams processed" }),
  };
}

async function processExam(data: any) {
  const tableName = process.env.TABLE_NAME;
  const knowledgeBaseId = process.env.KNOWLEDGE_BASE_ID;

  let prompt = "";

  if (data.examID) {
    // ----- Regenerate exam -----
    const result = await dynamo.send(new GetCommand({
      TableName: tableName,
      Key: { examID: data.examID },
    }));

    if (!result.Item) throw new Error("Exam not found");

    const existingExam = JSON.parse(result.Item.examContent);

    if (data.feedback) {
      prompt = `
        Update the following exam based on the feedback provided.
        Feedback: ${JSON.stringify(data.feedback, null , 2)}
        Current Exam Content:
        ${JSON.stringify(existingExam, null, 2)}
        The type of your response must be a JSON object containing the updated exam only.
      `;
    } else {
      prompt = `
        Regenerate the following exam to improve structure and balance.
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
    const jsonStart = fullText.indexOf('{');
    const jsonEnd = fullText.lastIndexOf('}');
    const cleanedJson = fullText.slice(jsonStart, jsonEnd + 1).trim();
    const parsed = JSON.parse(cleanedJson);

    await dynamo.send(new UpdateCommand({
      TableName: tableName,
      Key: { examID: data.examID },
      UpdateExpression: `
        SET examContent = :examContent,
            numOfRegenerations = if_not_exists(numOfRegenerations, :zero) + :incr,
            contributors = :contributors
      `,
      ExpressionAttributeValues: {
        ":examContent": cleanedJson,
        ":incr": 1,
        ":zero": 0,
        ":contributors": data.contributors,
      },
    }));

  } else {
    // ----- Create new exam -----
    if (data.subject === "ARAB101") {
      prompt = ARAB101PROMPT;
    } else {
      const bedrockAgentClient = new BedrockAgentRuntimeClient({ region: "us-east-1" });
      const retrieveCommand = new RetrieveCommand({
        knowledgeBaseId: knowledgeBaseId ?? "WCTC0NYEAV",
        retrievalConfiguration: { vectorSearchConfiguration: { numberOfResults: 10 } },
        retrievalQuery: { text: `${data.class} ${data.subject} questions` },
      });

      if (!data.customize) {
        const relevant_info = (
          await bedrockAgentClient.send(retrieveCommand)
        ).retrievalResults?.map((e) => e.content?.text).join("\n").toString();

        prompt = ENG102PROMPT + " Refer to the following relevant information from past exams:\n" + relevant_info;
      }
    }

    const command = new ConverseCommand({
      modelId,
      //@ts-ignore
      messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 4096, temperature: 0.5, topP: 0.9 },
    });

    const response = await bedrockClient.send(command);
    const content = response?.output?.message?.content;
    const cleanedJson = content[0].text;

    const uuid = uuidv4();
    await dynamo.send(new PutCommand({
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
    }));
  }
}
