import { getAdminSummary } from "@/server/beta/admin-summary";
import { isReadingServiceError } from "@/server/reading/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json(await getAdminSummary());
  } catch (error) {
    if (isReadingServiceError(error)) {
      return Response.json(
        {
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.status },
      );
    }

    return Response.json(
      {
        error: {
          code: "generation_failed",
          message: "管理后台统计查询失败，请稍后再试。",
        },
      },
      { status: 500 },
    );
  }
}
