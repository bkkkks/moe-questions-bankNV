import { Function, StackContext, use } from "sst/constructs";
import { DBStack } from "./DBStack";
import { BedrockKbLambdaStack } from "./bedrockstack";

export function FunctionsStack({ stack }: StackContext) {
  const { exams_table } = use(DBStack);
  const { bedrockKb } = use(BedrockKbLambdaStack);
  
  const createExamFunction = new Function(stack, "CreateExamFunction", {
    handler: "packages/functions/src/createNewExam.createExam",
    timeout: 180,
    memorySize: 512,
    // url: {
    //   cors: {
    //     allowMethods: ["POST"],
    //     allowOrigins: ["*"],
    //   },
      
    // },
    permissions: ["dynamodb", "bedrock", exams_table],
    environment: {
      TABLE_NAME: exams_table.tableName,
      KNOWLEDGE_BASE_ID: "WCTC0NYEAV",          //bedrockKb.knowledgeBaseId,
    },
  });
    //BY MohamedAli no permission on FunctionURL
    //stack.addOutputs({
       // CreateExamFunctionURL: createExamFunction.url,
    // })
    
    return { createExamFunction };
}
