import { ConstraintViolation } from "./types";

export class ErrorWithData extends Error {
  constructor(message: string, data: any) {
    super(`${message} ${JSON.stringify(data)}`);

    this.data = data;
  }

  readonly data: any;
}

/**
 * Indicates that one or more constraint violations have occurred when attempting to modify the data in a table.
 *
 * @export
 * @class ConstraintViolationsError
 * @typedef {ConstraintViolationsError}
 * @extends {Error}
 */
export class ConstraintViolationsError extends Error {
  /**
   * Creates an instance of ConstraintViolationsError.
   *
   * @constructor
   * @param {ConstraintViolation[]} violations The list of violations that occurred.
   */
  constructor(violations: ConstraintViolation[]) {
    super(
      `There are constraint violations:\n${violations.map((v) => v.description).join("\n")}`,
    );

    this.violations = violations;
  }

  /**
   * The list of violations that occurred.
   *
   * @readonly
   * @type {ConstraintViolation[]}
   */
  readonly violations: ConstraintViolation[];

  readonly name: string = "ConstraintViolationsError";
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
