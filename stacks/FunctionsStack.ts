import { StackContext, Queue, Function as SSTFunction, use, Api } from "sst/constructs";
import { DBStack } from "./DBStack";
import { BedrockKbLambdaStack } from "./bedrockstack";

export function FunctionsStack({ stack }: StackContext) {
  // ✅ استخدام DynamoDB و Bedrock من Stacks ثانية
  const { exams_table } = use(DBStack);
  const bedrockKb = use(BedrockKbLambdaStack);

  // ✅ إنشاء SQS Queue تربط مباشرة بـ Lambda createNewExam
  const examQueue = new Queue(stack, "ExamQueue", {
    consumer: {
      function: {
        handler: "packages/functions/src/createNewExam.createExam", // Lambda الحالية
        environment: {
          TABLE_NAME: exams_table.tableName,
          KNOWLEDGE_BASE_ID: bedrockKb.knowledgeBaseId,
        },
        permissions: [exams_table],
      },
    },
  });

  
  // ✅ Lambda جديدة ترسل الطلب إلى SQS (Producer)
  const producer = new SSTFunction(stack, "ExamProducer", {
    handler: "packages/functions/src/producer.handler",
    environment: {
      QUEUE_URL: examQueue.queueUrl,
    },
    permissions: [examQueue],
  });

  // ✅ تعريف API فقط إذا تبغى تربط producer بمسار HTTP
  const api = new Api(stack, "ExamApi", {
    cors: true,
    routes: {
      "POST /generateExam": producer,
    },
  });

  stack.addOutputs({
    ApiEndpoint: api.url,
    GenerateExamEndpoint: api.url + "/generateExam",
  });

  return {
    api,
    producer,
    examQueue,
  };
}
