import { getCurrentUser } from "./getToken.ts";
import { getUserToken } from "./getToken.ts";

export default async function invokeApig({
  method = "GET",
  body,
  path,
  isFunction = false, 
}: {
  method?: string;
  body: any;
  path: string;
  isFunction?: boolean;
}) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error("User is not authenticated");
  }

  const token = await getUserToken(currentUser);

  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error response body:", errorText);

      let parsedError;
      try {
        parsedError = JSON.parse(errorText);
      } catch (e) {
        throw new Error(`API returned invalid response: ${errorText}`);
      }

      throw new Error(
        parsedError.details || parsedError.error || "API call failed"
      );
    }

    return response;
  } catch (error) {
    throw new Error(
      `Failed to parse response as JSON: ${(error as Error).message}`
    );
  }
}
