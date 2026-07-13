const containsChinese = (value: string) => /[\u3400-\u9fff]/u.test(value);

export class ClientApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly uncertain = false,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

function safeMessage(value: unknown, fallback: string) {
  return typeof value === "string" && containsChinese(value) ? value : fallback;
}

function isUncertainHttpStatus(status: number) {
  return status >= 500 || status === 408 || status === 425 || status === 429;
}

export async function readApiResponse<T>(response: Response, fallback: string): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ClientApiError(fallback, response.status, true);
  }
  if (!response.ok) {
    const message = body && typeof body === "object" && "message" in body
      ? (body as { message?: unknown }).message
      : undefined;
    throw new ClientApiError(
      safeMessage(message, fallback),
      response.status,
      isUncertainHttpStatus(response.status),
    );
  }
  return body as T;
}

export function clientErrorMessage(cause: unknown, fallback: string) {
  if (cause instanceof ClientApiError) return cause.message;
  if (cause instanceof Error && containsChinese(cause.message)) return cause.message;
  return fallback;
}
