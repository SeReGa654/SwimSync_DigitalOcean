import { AsyncLocalStorage } from 'node:async_hooks';

type RequestContextStore = {
  requestId?: string;
};

const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(store: RequestContextStore, callback: () => T): T {
  return requestContext.run(store, callback);
}

export function getRequestIdFromContext(): string | undefined {
  return requestContext.getStore()?.requestId;
}
