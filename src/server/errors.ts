/** Thrown when the current user's role does not allow the action. */
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Thrown when a record does not exist *for the current organization*.
 * Records of other organizations are reported exactly like missing ones,
 * so their existence is never revealed.
 */
export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found`);
    this.name = "NotFoundError";
  }
}

/** Business rule violations (e.g. removing the last owner). `code` is mapped to UI copy. */
export class DomainError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "DomainError";
  }
}
