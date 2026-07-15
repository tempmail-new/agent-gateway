import { SpanStatusCode, trace } from "@opentelemetry/api";

export interface TraceHandle {
  requestId: string;
  traceId: string;
}

export async function withGatewayTrace<T>(
  serviceName: string,
  spanName: string,
  attributes: Record<string, boolean | number | string>,
  fallbackTrace: TraceHandle,
  operation: (traceHandle: TraceHandle) => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer(serviceName);

  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }

      const spanContext = span.spanContext();
      const traceHandle = spanContext.traceId
        ? { requestId: fallbackTrace.requestId, traceId: spanContext.traceId }
        : fallbackTrace;

      return await operation(traceHandle);
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
