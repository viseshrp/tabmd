export type ExtensionErrorOperation = 'runtime_context' | 'storage' | 'tab_query';

export function logExtensionError(
  message: string,
  error: unknown,
  operation: ExtensionErrorOperation | { operation: ExtensionErrorOperation }
): void {
  const resolvedOperation = typeof operation === 'string' ? operation : operation.operation;
  console.error(`[tabmd:${resolvedOperation}] ${message}`, error);
}

export function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp));
}

