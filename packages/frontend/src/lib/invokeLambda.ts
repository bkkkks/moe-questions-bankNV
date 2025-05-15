import { AwsClient } from "aws4fetch";
import config from "./config";
import { getCurrentUser, getUserToken } from "./getToken.ts";
import getAwsCredentials from "./getIAMCred.ts";

export default async function invokeLambda({
  method = "GET",
  body,
  path,
}: {
  method?: string;
  body: any;
  path: string;
}) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error("User is not authenticated");
  }

  const userToken = await getUserToken(currentUser);
  const credentials = await getAwsCredentials(userToken);

  const { accessKeyId, secretAccessKey, sessionToken } = credentials;

  if (!accessKeyId || !secretAccessKey || !sessionToken) {
    throw new Error("AWS credentials are not available.");
  }

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    sessionToken,
    service: "execute-api",
  });

  const url = `${config.apiGateway.URL}${path}`; // ← صح الآن
  const jsonBody = body ? JSON.stringify(body) : undefined;

  try {
    const response = await aws.fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: jsonBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error response body:", errorText);
      throw new Error(`API call failed: ${errorText}`);
    }

    return response;
  } catch (error) {
    throw new Error(
      `Failed to call API: ${(error as Error).message}`
    );
  }
}
