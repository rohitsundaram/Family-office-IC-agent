import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

let _client: OpenAI | null = null;

function client() {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  _client = new OpenAI({ apiKey });
  return _client;
}

export async function generateStructured<TSchema extends z.ZodTypeAny>(params: {
  model: string;
  schema: TSchema;
  schemaName: string;
  system: string;
  user: string;
}) {
  const c = client();
  const res = await c.responses.parse({
    model: params.model,
    input: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    response_format: zodTextFormat(params.schema, params.schemaName),
  });
  return res.output_parsed as z.infer<TSchema>;
}

export async function generateText(params: { model: string; system: string; user: string }) {
  const c = client();
  const res = await c.responses.create({
    model: params.model,
    input: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
  });
  const text = res.output_text ?? "";
  return text;
}
