import { StackContext, Api, use } from "sst/constructs";
import { DBStack } from "./DBStack";
import { BedrockKbLambdaStack } from "./bedrockstack";
import { Queue, Function as SSTFunction } from "sst/constructs";

export function FunctionsStack({ stack }: StackContext) {
  const { exams_table } = use(DBStack);
  const { bedrockKb } = use(BedrockKbLambdaStack);

  // 1️⃣ أنشئ API Gateway و اربطها باللامبدا
  const api = new Api(stack, "ExamApi", {
    cors: {
      allowMethods: ["POST"],
      allowOrigins: ["*"],
    },
    routes: {
      "POST /createExam": "packages/functions/src/createNewExam.createExam",
    },
  });

  
  const createExamFunction = api.getFunction("POST /createExam");

  /
  createExamFunction?.bind([exams_table]);
  createExamFunction?.addEnvironment("TABLE_NAME", exams_table.tableName);
  createExamFunction?.addEnvironment("KNOWLEDGE_BASE_ID", bedrockKb.knowledgeBaseId);

  

// 1. أنشئ SQS Queue مع consumer Lambda
const examQueue = new Queue(stack, "ExamQueue", {
  consumer: "packages/functions/src/consumer.handler", 
});

// 2. Lambda ترسل رسالة إلى SQS
const producer = new SSTFunction(stack, "ProducerLambda", {
  handler: "packages/functions/src/producer.handler", 
  environment: {
    QUEUE_URL: examQueue.queue.queueUrl,
  },
  permissions: [examQueue], 
});


  // 4️⃣ أطبع الـ endpoint كـ output
  stack.addOutputs({
    ApiEndpoint: api.url,                      
    CreateExamEndpoint: api.url + "/createExam" 
  });

  return {
    api,
    createExamFunction,
  };
}
