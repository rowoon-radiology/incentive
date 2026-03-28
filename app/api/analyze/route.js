import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an OCR assistant that extracts radiology reading counts from Korean EMR/OCS screenshots.
Your task: find the reading counts specifically for the doctor named "이로운" (Lee Rowoon / 이로운).
If there are multiple doctors listed, ONLY extract counts for 이로운. Ignore other doctors' data.

Extract the number of readings for these modalities: CR, CT, MR, BMD.
CR may also appear as "X-ray", "일반촬영", "단순촬영", "Plain", "Radiograph", "XR", "CR" etc.
CT may also appear as "전산화단층촬영", "씨티" etc.
MR may also appear as "MRI", "자기공명영상", "엠알" etc.
BMD should be extracted from the "OT" category/column in the EMR screen. Look for "OT" label and use that number as BMD count.

Also extract the date range / period shown on the screen. Look for fields like "기간", "조회기간", "날짜", date pickers, or any date range indicators.

Respond ONLY with a JSON object in this exact format, no markdown, no backticks:
{"CR": number_or_null, "CT": number_or_null, "MR": number_or_null, "BMD": number_or_null, "period_start": "YYYY-MM-DD_or_null", "period_end": "YYYY-MM-DD_or_null", "period_days": number_of_days_or_null, "note": "brief note about what you found"}

If you can determine the number of days in the period, include it in period_days.
If you cannot find a count for a modality, use null.
If you cannot find 이로운's data specifically, set all to null and explain in note.`;

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    const { image } = await request.json();
    if (!image) {
      return NextResponse.json({ error: "이미지 데이터가 없습니다." }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: "image/png", data: image },
              },
              {
                type: "text",
                text: "이 EMR/OCS 화면에서 '이로운' 교수의 판독 건수를 추출해주세요. CR, CT, MR, BMD 각각의 건수와 조회 기간을 찾아주세요.",
              },
            ],
          },
        ],
      }),
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text();
      return NextResponse.json(
        { error: `Anthropic API 오류 (${res.status}): ${errBody.slice(0, 300)}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    const text = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    return NextResponse.json(parsed);
  } catch (err) {
    if (err.name === "AbortError") {
      return NextResponse.json(
        { error: "30초 타임아웃 — 이미지가 너무 크거나 서버가 응답하지 않습니다." },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
