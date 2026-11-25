type HistoryLocation = {
  href: string;
};

type HistoryApi = {
  state: unknown;
  replaceState(state: unknown, unused: string, url: string): void;
};

/**
 * Removes a high-entropy token from the final path segment after the Server
 * Component has extracted it into a hidden POST field. Used for guardian
 * consent links, where the token is part of the path rather than a query
 * parameter. The replacement path is supplied by the caller and never derived
 * from the token itself.
 */
export function removePathTokenFromHistory(
  location: HistoryLocation,
  history: HistoryApi,
  cleanPath: string,
): boolean {
  let url: URL;
  try {
    url = new URL(location.href);
  } catch {
    return false;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const last = segments.at(-1);
  if (!last || !/^[A-Za-z0-9_-]{32,128}$/.test(last)) return false;

  url.pathname = cleanPath;
  try {
    history.replaceState(
      history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes the raw verification token from the visible URL and current history
 * entry after the Server Component has already extracted it into the hidden
 * POST field. Other query parameters, the fragment, and history state are
 * preserved. The token value is never interpolated into the replacement URL.
 */
export function removeVerificationTokenFromHistory(
  location: HistoryLocation,
  history: HistoryApi,
): boolean {
  let url: URL;
  try {
    url = new URL(location.href);
  } catch {
    return false;
  }

  if (!url.searchParams.has("token")) return false;

  url.searchParams.delete("token");
  const cleanUrl = `${url.pathname}${url.search}${url.hash}`;

  try {
    history.replaceState(history.state, "", cleanUrl);
    return true;
  } catch {
    return false;
  }
}
