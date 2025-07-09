import { v4 as uuidv4 } from 'uuid';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';

import { ENG102PROMPT } from "./prompts/Eng102";
import { ARAB101PROMPT } from "./prompts/Arab101";

const region = 'us-east-1';

const client = new DynamoDBClient({ region });
const dynamo = DynamoDBDocumentClient.from(client);
const bedrockClient = new BedrockRuntimeClient({ region });
const bedrockAgentClient = new BedrockAgentRuntimeClient({ region });

const modelId = 'anthropic.claude-3-5-sonnet-20240620-v1:0'; // ✅ نموذج صالح ومفعل

export async function handler(event: any) {
  console.log("📩 generateExamFromQueue triggered", JSON.stringify(event));

  const tableName = process.env.TABLE_NAME!;
  const knowledgeBaseId = process.env.KNOWLEDGE_BASE_ID!;

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

  const data = JSON.parse(bodyStr);
  console.log("📦 Received exam creation request:", data);

  const examID = data.examID || uuidv4();
  let prompt = '';

  try {
    if (data.subject === 'ARAB101') {
      prompt = ARAB101PROMPT;
      console.log("🧠 Using ARAB101 static prompt.");
    } else {
      console.log("📚 Retrieving knowledge base content...");

      const retrieveCommand = new RetrieveCommand({
        knowledgeBaseId,
        retrievalConfiguration: {
          vectorSearchConfiguration: {
            numberOfResults: 5, // أقل = أسرع
          },
        },
        retrievalQuery: {
          text: `${data.class} ${data.subject} questions`,
        },
      });

      let relevant_info = '';
      if (!data.customize) {
        const results = await bedrockAgentClient.send(retrieveCommand);
        relevant_info = results.retrievalResults
          .map((e: any) => e.content.text)
          .join('\n');
        console.log("📚 Retrieved info:", relevant_info.slice(0, 200)); // طباعة أول 200 حرف
      }

      prompt = ENG102PROMPT + `\nRefer to the following relevant information from past exams:\n` + relevant_info;
    }

    console.log("🧠 Sending prompt to Bedrock...");
    const command = new ConverseCommand({
      modelId,
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 4096, temperature: 0.5, topP: 0.9 },
    });

    const response = await bedrockClient.send(command);
    const content = response.output.message.content;

    if (!content || !content[0].text) {
      throw new Error("❌ Invalid response from Bedrock – missing content");
    }

    const fullText = content[0].text;
    console.log("🧾 Bedrock raw output:", fullText.slice(0, 300)); // أول 300 حرف

    const jsonStart = fullText.indexOf('{');
    const jsonEnd = fullText.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new Error("❌ Failed to extract JSON from Bedrock output");
    }

    const cleanedJson = fullText.slice(jsonStart, jsonEnd + 1).trim();
    const parsedContent = JSON.parse(cleanedJson); // ✅ تصحيح رئيسي: تخزين كـ Object

    console.log("✅ Parsed exam content:", parsedContent);

    console.log("💾 Saving to DynamoDB...");
    await dynamo.send(new PutCommand({
      TableName: tableName,
      Item: {
        examID,
        examState: 'building',
        examClass: data.class,
        examSubject: data.subject,
        examSemester: data.semester,
        examDuration: data.duration,
        examMark: data.total_mark,
        examContent: parsedContent, // ✅ يتم تخزينه كمجال كائن Map وليس نص
        createdBy: data.created_by,
        creationDate: data.creation_date,
        contributors: data.contributors,
        numOfRegenerations: 0,
      }
    }));

    console.log("✅ Exam saved successfully:", examID);
  } catch (error) {
    console.error("❌ Error during exam creation:", error);
  }
}
