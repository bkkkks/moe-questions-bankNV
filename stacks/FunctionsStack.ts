import { StackContext, Api, use } from "sst/constructs";
import { DBStack } from "./DBStack";
import { BedrockKbLambdaStack } from "./bedrockstack";

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

  // 2️⃣ احصل على اللامبدا بعد ما ترتبط بالراوت
  const createExamFunction = api.getFunction("POST /createExam");

  // 3️⃣ اربط التصاريح و المتغيرات البيئية باللامبدا
  createExamFunction?.bind([exams_table]);
  createExamFunction?.addEnvironment("TABLE_NAME", exams_table.tableName);
  createExamFunction?.addEnvironment("KNOWLEDGE_BASE_ID", bedrockKb.knowledgeBaseId);

  // 4️⃣ أطبع الـ endpoint كـ output
  stack.addOutputs({
    ApiEndpoint: api.url,                      // 👈 هذا هو الي تحطه بـ .env
    CreateExamEndpoint: api.url + "/createExam" // 👈 هذا الي تستخدمه بالفرونت
  });

  return {
    api,
    createExamFunction,
  };
}
