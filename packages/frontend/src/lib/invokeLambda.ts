import { AwsClient } from "aws4fetch";

import { getCurrentUser } from "./getToken.ts";
import { getUserToken } from "./getToken.ts";
import getAwsCredentials from "./getIAMCred.ts";

export default async function invokeLambda({
  method = "GET",
  body,
  url,
}: {
  method?: string;
  body: any;
  url: string;
}) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error("User is not authenticated");
  }

  const userToken = await getUserToken(currentUser); // User token from the Cognito user pool

  // Retrieve IAM credentials based on the Cognito token
  //@ts-ignore
  const credentials = await getAwsCredentials(userToken);

  //@ts-ignore
  const { accessKeyId, secretAccessKey, sessionToken } = credentials;


  if (!accessKeyId || !secretAccessKey || !sessionToken) {
    throw new Error("AWS credentials are not available.");
  }

  //   const signedFetch = createSignedFetcher({
  //     service: "lambda", // depends on what you want to access
  //     region: import.meta.env.VITE_REGION,
  //     credentials: {
  //       accessKeyId: accessKeyId,
  //       secretAccessKey: secretAccessKey,
  //       sessionToken: sessionToken,
  //     },
  //   });

  const aws = new AwsClient({
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
      sessionToken: sessionToken,
    service: "lambda"
  });

  body = body ? JSON.stringify(body) : body;

try {
  const response = await aws.fetch(url, {
    method: method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body,
  });

  return {
    ok: response.ok,
    status: response.status,
    json: async () => {
      try {
        return await response.json();
      } catch {
        return null;
      }
    },
    text: async () => await response.text(),
  };
} catch (error) {
  console.error("invokeLambda fetch error:", error);
  return {
    ok: false,
    status: 500,
    json: async () => null,
    text: async () => (error as Error).message,
  };
}
}
