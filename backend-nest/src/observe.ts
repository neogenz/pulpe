import { randomUUID } from 'node:crypto';
import { createObserveModule, type ObserveOptions } from '@nestjs/observe';

export const observePrivacyOptions = {
  forwardLogs: false,
  http: {
    capture: false,
    // Nest's route template remains the operation ID; raw URLs can contain arbitrary input.
    queryParamsObfuscateRegex: /.+/g,
  },
  redaction: {
    // shortcut: free-form prose is not classified; extend these patterns for new sensitive error formats.
    patterns: [
      /[\w.+%-]+(?:@|%40)[\w.-]+\.[a-z]{2,}/gi,
      /\b[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\b/gi,
      /(?<=[?&][\w.%[\]-]+=)[^\s&#]+/g,
      /(?<=A tag named ')[\s\S]*(?=' already exists)/g,
      /(?<=\b(?:ID|named|format)\s+')[^']*(?=')/gi,
      /(?<=Key \([^)]*\)=\()[^)]*(?=\))/gi,
      /(?<=\b(?:[\w_]*amount|[\w_]*balance|income|expense|savings|email|name|description|label|title|search|pin|client_key|recovery_key)["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}]+)/gi,
      /(?<=Cannot (?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) )\S+/g,
    ],
  },
  // SDK 0.3.16 cannot sanitize outgoing paths/unknown query keys; provider spans still measure those calls.
  outgoing: { http: false },
} satisfies Partial<ObserveOptions>;

export const { ObserveModule, ObserveInstrument } = createObserveModule({
  // Source snippets can reintroduce values removed from error messages; stacks keep file/line information.
  sourceContext: false,
  // A caller-controlled x-request-id can itself contain personal data.
  traceIdGenerator: () => randomUUID(),
});
