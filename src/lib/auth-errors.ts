/** Maps auth error codes to user-facing copy (Rioplatense Spanish). */
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "El email o la contraseña no son correctos.",
  USER_ALREADY_EXISTS: "Ya existe una cuenta con ese email. Probá ingresar.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con ese email. Probá ingresar.",
  PASSWORD_TOO_SHORT: "La contraseña tiene que tener al menos 10 caracteres.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  INVALID_EMAIL: "Revisá el email: no parece válido.",
  INVALID_CODE: "El código no es correcto. Revisá tu app de autenticación.",
  INVALID_TWO_FACTOR_COOKIE: "La verificación venció. Volvé a ingresar.",
  INVALID_BACKUP_CODE: "Ese código de respaldo no es válido.",
};

const RATE_LIMITED = "Hiciste demasiados intentos. Esperá un minuto y probá de nuevo.";
const FALLBACK = "Algo salió mal. Probá de nuevo en unos segundos.";

export function authErrorMessage(error: { code?: string; status?: number } | null | undefined) {
  if (!error) return FALLBACK;
  if (error.status === 429) return RATE_LIMITED;
  return (error.code && MESSAGES[error.code]) || FALLBACK;
}
