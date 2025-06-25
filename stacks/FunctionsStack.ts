import { StackContext, Api, use, Queue } from "sst/constructs";
import { DBStack } from "./DBStack";
import { BedrockKbLambdaStack } from "./bedrockstack";

export function FunctionsStack({ stack }: StackContext) {
  const { exams_table } = use(DBStack);
  const bedrockKb = use(BedrockKbLambdaStack);

  // 1️⃣: أنشئ SQS Queue واربطها بـ consumer Lambda
  const examQueue = new Queue(stack, "ExamQueue", {
    consumer: {
      function: {
        handler: "packages/functions/src/consumer.handler",
        environment: {
          TABLE_NAME: exams_table.tableName,
          KNOWLEDGE_BASE_ID: bedrockKb.knowledgeBaseId,
        },
        permissions: [exams_table],
      },
    },
  });

  // 2️⃣: أنشئ REST API
  const api = new Api(stack, "ExamApi", {
    cors: true,
    routes: {
      "POST /createNewExam": "packages/functions/src/createNewExam.createExam",
    },
  });

  // 3️⃣: خذ Lambda الحالية واربطها بالـ Queue
  const createExamFunction = api.getFunction("POST", "/createNewExam");

  createExamFunction?.bind([exams_table]);
  createExamFunction?.addEnvironment("TABLE_NAME", exams_table.tableName);
  createExamFunction?.addEnvironment("QUEUE_URL", examQueue.queue.queueUrl);
  createExamFunction?.attachPermissions([examQueue]);

  // 4️⃣: Export API URLs
  stack.addOutputs({
    ApiEndpoint: api.url,
    CreateExamEndpoint: api.url + "/createNewExam",
  });

  return {
    api,
    createExamFunction,
  };
}
