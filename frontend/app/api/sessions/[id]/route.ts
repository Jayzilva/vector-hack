const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const backendRes = await fetch(`${BACKEND_URL}/api/sessions/${id}`);

  if (!backendRes.ok) {
    return new Response(backendRes.statusText, { status: backendRes.status });
  }

  const data = await backendRes.json();
  return Response.json(data);
}
