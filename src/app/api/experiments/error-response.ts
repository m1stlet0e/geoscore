import { NextResponse } from "next/server";
import { ExperimentServiceError } from "@/server/experiments/service";

const statusByCode = {
  NOT_FOUND: 404,
  INVALID_INPUT: 400,
  CONFLICT: 409,
  PAYMENT_REQUIRED: 402,
} as const;

export function experimentErrorResponse(error: unknown, fallback: string) {
  if (error instanceof ExperimentServiceError) {
    return NextResponse.json(
      { message: error.message },
      { status: statusByCode[error.code] },
    );
  }
  return NextResponse.json({ message: fallback }, { status: 500 });
}
