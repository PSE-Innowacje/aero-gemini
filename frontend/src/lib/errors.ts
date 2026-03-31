type ErrorLike = {
  message?: unknown;
  detail?: unknown;
};

export const getErrorMessage = (error: unknown, fallback = 'Wystąpił błąd.'): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const maybeError = error as ErrorLike;
    if (typeof maybeError.message === 'string' && maybeError.message.trim()) {
      return maybeError.message;
    }
    if (typeof maybeError.detail === 'string' && maybeError.detail.trim()) {
      return maybeError.detail;
    }
  }

  return fallback;
};
