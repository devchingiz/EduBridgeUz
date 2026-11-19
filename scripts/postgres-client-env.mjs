const LIBPQ_PARAMETERS = new Map([
  ["application_name", "PGAPPNAME"],
  ["channel_binding", "PGCHANNELBINDING"],
  ["connect_timeout", "PGCONNECT_TIMEOUT"],
  ["gssencmode", "PGGSSENCMODE"],
  ["options", "PGOPTIONS"],
  ["sslmode", "PGSSLMODE"],
  ["sslcert", "PGSSLCERT"],
  ["sslkey", "PGSSLKEY"],
  ["sslrootcert", "PGSSLROOTCERT"],
  ["target_session_attrs", "PGTARGETSESSIONATTRS"],
]);

export function postgresClientEnvironment(
  connectionString,
  base = process.env,
) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("Database connection string is invalid.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Database connection string must use PostgreSQL.");
  }

  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database || !url.hostname) {
    throw new Error(
      "Database connection string must include a host and database.",
    );
  }

  const env = {};
  for (const name of [
    "PATH",
    "Path",
    "SystemRoot",
    "WINDIR",
    "TEMP",
    "TMP",
    "HOME",
    "USERPROFILE",
  ]) {
    if (base[name]) env[name] = base[name];
  }
  env.PGHOST = url.hostname.replace(/^\[|\]$/g, "");
  env.PGPORT = url.port || "5432";
  env.PGDATABASE = database;
  if (url.username) env.PGUSER = decodeURIComponent(url.username);
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);

  for (const [parameter, variable] of LIBPQ_PARAMETERS) {
    const value = url.searchParams.get(parameter);
    if (value) env[variable] = value;
  }
  return env;
}
