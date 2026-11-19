/**
 * Session cookie name shared by the server-only session module and the
 * request proxy. Kept in its own module so the proxy does not import the
 * database client.
 */
export const SESSION_COOKIE = "edubridge_session";
