export class ErrorWithData extends Error {
  constructor(message: string, data: any) {
    super(`${message} ${JSON.stringify(data)}`);

    this.data = data;
  }

  readonly data: any;
}

export function assertValue<T>(
  value: T | undefined | null,
  message?: string,
): T {
  if (value === undefined) {
    throw new Error(message || "Unexpected undefined value");
  }
  if (value === null) {
    throw new Error(message || "Unexpected null value");
  }

  return value;
}
