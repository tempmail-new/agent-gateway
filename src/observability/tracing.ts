import { SpanStatusCode, trace } from "@opentelemetry/api";

export type TraceAttributeValue = boolean | number | string;

export interface TraceHandle {
  requestId: string;
  traceId: string;
}

export interface TraceOperationContext {
  handle: TraceHandle;
  recordEvent(name: string, attributes: Record<string, TraceAttributeValue>): void;
  setAttributes(attributes: Record<string, TraceAttributeValue | undefined>): void;
}

export async function withGatewayTrace<T>(
  serviceName: string,
  spanName: string,
  attributes: Record<string, TraceAttributeValue>,
  fallbackTrace: TraceHandle,
  operation: (traceContext: TraceOperationContext) => Promise<T>,
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

      return await operation({
        handle: traceHandle,
        recordEvent(name, eventAttributes) {
          span.addEvent(name, eventAttributes);
        },
        setAttributes(dynamicAttributes) {
          for (const [key, value] of Object.entries(dynamicAttributes)) {
            if (value !== undefined) {
              span.setAttribute(key, value);
            }
          }
        },
      });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
