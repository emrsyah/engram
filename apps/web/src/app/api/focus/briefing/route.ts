import { NextResponse } from "next/server";
import { z } from "zod";

const TaskSchema = z.object({
	id: z.string(),
	title: z.string(),
	priority: z.number().optional(),
	dueAt: z.string().optional(),
	done: z.boolean().optional(),
});

const BriefingRequestSchema = z.object({
	date: z.string(),
	topTasks: z.array(TaskSchema),
	backlogTasks: z.array(TaskSchema),
	overdueTasks: z.array(TaskSchema),
	dueTodayTasks: z.array(TaskSchema),
	noteExcerpt: z.string().max(2000).optional(),
});

const BriefingSchema = z.object({
	headline: z.string(),
	summary: z.string(),
	topThreeRationale: z.array(z.string()),
	risks: z.array(z.string()),
	suggestedAdjustments: z.array(
		z.object({
			taskId: z.string(),
			reason: z.string(),
			target: z.enum(["top", "backlog"]),
		}),
	),
});

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(request: Request) {
	const parsed = BriefingRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid briefing request." }, { status: 400 });
	}

	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		return NextResponse.json(
			{ error: "OPENROUTER_API_KEY is not configured." },
			{ status: 500 },
		);
	}

	const payload = parsed.data;
	const prompt = [
		"You write concise daily focus briefings for a personal task workspace.",
		"Return only JSON with headline, summary, topThreeRationale, risks, and suggestedAdjustments.",
		"Do not invent task IDs. Keep the summary practical and under 90 words.",
		"Use suggestedAdjustments only when a task should move into top or backlog.",
		"",
		JSON.stringify(payload),
	].join("\n");

	try {
		const response = await fetch(OPENROUTER_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3031",
				"X-Title": "Engram Focus",
			},
			body: JSON.stringify({
				model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini",
				messages: [
					{
						role: "system",
						content:
							"You are a terse planning assistant. Output valid JSON only. Never include markdown.",
					},
					{ role: "user", content: prompt },
				],
				temperature: 0.3,
				response_format: { type: "json_object" },
			}),
		});

		if (!response.ok) {
			const detail = await response.text();
			return NextResponse.json(
				{ error: "Briefing generation failed.", detail: detail.slice(0, 500) },
				{ status: response.status },
			);
		}

		const data = (await response.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
		};
		const content = data.choices?.[0]?.message?.content;
		if (!content) {
			return NextResponse.json({ error: "OpenRouter returned no briefing." }, { status: 502 });
		}

		const json = BriefingSchema.safeParse(JSON.parse(content));
		if (!json.success) {
			return NextResponse.json({ error: "OpenRouter returned invalid briefing JSON." }, { status: 502 });
		}

		return NextResponse.json({
			...json.data,
			date: payload.date,
			generatedAt: new Date().toISOString(),
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Briefing generation failed." },
			{ status: 500 },
		);
	}
}
