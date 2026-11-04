export class WebGLUnavailableError extends Error {
  constructor(cause: unknown) {
    super('WebGL 2 is unavailable', { cause });
    this.name = 'WebGLUnavailableError';
  }
}

export function classifyRendererError(
  error: unknown,
  getContext: () => WebGL2RenderingContext | null,
): unknown {
  // Only a failed renderer initialization probes support. Model/context-loss errors stay generic.
  try {
    if (getContext() === null) return new WebGLUnavailableError(error);
  } catch {
    // A failed capability check does not prove WebGL is unsupported; retain the original error.
  }
  return error;
}

export function viewerErrorKind(error: unknown): 'unsupported' | 'error' {
  return error instanceof WebGLUnavailableError ? 'unsupported' : 'error';
}
