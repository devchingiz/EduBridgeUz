/**
 * RESEARCH SCRIPT — QS 2027 university dataset
 *
 * Produces `data/qs-2027-universities.json` (or a numbered batch file) from PUBLIC, documented sources:
 *
 *  1. QS TopUniversities public Algolia search index `live_tu_universities`
 *     (the same index the public University Search page uses). Supplies the
 *     official QS institution name, campus country/city, QS World University
 *     Rankings 2027 position (`wur_rank`, including "=" ties), public/private
 *     status, scholarship availability, an indicative international tuition,
 *     a logo, a profile description and a canonical QS profile source URL.
 *  2. Wikidata entity search -> P856 (official website) for each university.
 *     Only confident label matches with academic context are accepted;
 *     otherwise the website is left unavailable rather than guessed.
 *  3. QS public Algolia index `live_tu_programs`, filtered by the QS university
 *     node id, for real programme names, degree levels, durations, indicative
 *     fees and canonical programme source URLs.
 *
 * Results are CACHED in a JSON file. The application never calls these APIs at
 * request time. Re-run this script explicitly to refresh the research.
 *
 * Usage:  node scripts/research-qs-universities.mjs [--batch=2] [--no-enrich]
 *
 * `--batch=N` writes `data/qs-2027-universities-batch-N.json` and excludes every
 * institution already present in earlier batch datasets by QS nid, slug, legacy
 * slug and normalized name. The shared website/programme caches are reused.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BATCH_ARG = process.argv.find((arg) => arg.startsWith("--batch="));
const BATCH = BATCH_ARG ? Number(BATCH_ARG.slice("--batch=".length)) : 1;
if (!Number.isInteger(BATCH) || BATCH < 1) {
  throw new Error(`Invalid --batch value: ${BATCH_ARG ?? BATCH}`);
}
const DATA_FILE =
  BATCH === 1
    ? "qs-2027-universities.json"
    : `qs-2027-universities-batch-${BATCH}.json`;
const OUT = path.join(ROOT, "data", DATA_FILE);
const CACHE_DIR = path.join(ROOT, "data", ".cache", "qs-2027");
const WEBSITE_CACHE = path.join(CACHE_DIR, "websites.json");
const PROGRAM_CACHE = path.join(CACHE_DIR, "programs.json");
const NO_ENRICH = process.argv.includes("--no-enrich");
const CONCURRENCY = 6;

const ALGOLIA_APP = "B9VSLB5GUV";
// Search-only key published by TopUniversities for its own public site search.
const ALGOLIA_KEY = "c5a76d12563aa226198ec3dc8c27fefb";
const ALGOLIA_BASE = `https://${ALGOLIA_APP}-dsn.algolia.net/1/indexes`;
const QS_ORIGIN = "https://www.topuniversities.com";
const INDEX_UNI = "live_tu_universities";
const INDEX_PROG = "live_tu_programs";
const RANKING_EDITION = "QS World University Rankings 2027";
const RANKING_PUBLISHED = "2026-06-18";
const RETRIEVED_AT = new Date().toISOString().slice(0, 10);
const TARGET = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readCache(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function writeCache(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function hasCached(cache, key) {
  return Object.prototype.hasOwnProperty.call(cache, String(key));
}

function legacySlug(slug) {
  return String(slug || "").replace(/^the-/, "");
}

function previousDatasetPaths() {
  const paths = [];
  for (let batch = 1; batch < BATCH; batch += 1) {
    paths.push(
      path.join(
        ROOT,
        "data",
        batch === 1
          ? "qs-2027-universities.json"
          : `qs-2027-universities-batch-${batch}.json`,
      ),
    );
  }
  return paths;
}

function loadExclusions() {
  const exclusions = {
    nids: new Set(),
    slugs: new Set(),
    names: new Set(),
    count: 0,
  };
  for (const file of previousDatasetPaths()) {
    if (!fs.existsSync(file)) {
      throw new Error(
        `Batch ${BATCH} requires ${path.basename(file)} so earlier universities are not duplicated.`,
      );
    }
    const previous = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const university of previous.universities ?? []) {
      exclusions.nids.add(String(university.qsNid));
      exclusions.slugs.add(String(university.slug || ""));
      exclusions.slugs.add(legacySlug(university.slug));
      exclusions.names.add(normaliseName(university.name));
      exclusions.count += 1;
    }
  }
  return exclusions;
}

function isExcluded(university, exclusions) {
  if (!exclusions) return false;
  return (
    exclusions.nids.has(String(university.qsNid)) ||
    exclusions.slugs.has(String(university.slug || "")) ||
    exclusions.slugs.has(legacySlug(university.slug)) ||
    exclusions.names.has(normaliseName(university.name))
  );
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function runner() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runner()),
  );
  return results;
}

async function algolia(index, body, attempt = 0) {
  const res = await fetch(`${ALGOLIA_BASE}/${index}/query`, {
    method: "POST",
    headers: {
      "X-Algolia-Application-Id": ALGOLIA_APP,
      "X-Algolia-API-Key": ALGOLIA_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (attempt < 4) {
      await sleep(500 * (attempt + 1));
      return algolia(index, body, attempt + 1);
    }
    throw new Error(`Algolia ${index} returned ${res.status}`);
  }
  return res.json();
}

async function fetchJson(url, attempt = 0) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "EduBridgeResearch/1.0 (educational research; contact: admin@edubridge.local)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      if (attempt < 5) {
        await sleep(600 * (attempt + 1));
        return fetchJson(url, attempt + 1);
      }
      return null;
    }
    try {
      return await res.json();
    } catch {
      return null;
    }
  } catch {
    if (attempt < 5) {
      await sleep(600 * (attempt + 1));
      return fetchJson(url, attempt + 1);
    }
    return null;
  }
}

async function fetchJsonRequired(url) {
  const value = await fetchJson(url);
  if (value === null) throw new Error(`Research request failed: ${url}`);
  return value;
}

function parseRank(raw) {
  if (!raw || typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value === "-") return null;
  const match = value.match(/^=?(\d+)/);
  if (!match) return null;
  return {
    display: value,
    position: Number(match[1]),
    tied: value.startsWith("="),
    range: /-|\+/.test(value),
  };
}

function normaliseName(name) {
  return String(name || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function first(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const ALIASES = {
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  "united kingdom": "GB",
  uk: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  canada: "CA",
  germany: "DE",
  france: "FR",
  netherlands: "NL",
  switzerland: "CH",
  sweden: "SE",
  finland: "FI",
  norway: "NO",
  denmark: "DK",
  italy: "IT",
  spain: "ES",
  australia: "AU",
  "new zealand": "NZ",
  japan: "JP",
  "south korea": "KR",
  "korea, republic of": "KR",
  "republic of korea": "KR",
  china: "CN",
  "hong kong sar china": "HK",
  "hong kong": "HK",
  singapore: "SG",
  malaysia: "MY",
  taiwan: "TW",
  "saudi arabia": "SA",
  "united arab emirates": "AE",
  uae: "AE",
  qatar: "QA",
  turkey: "TR",
  türkiye: "TR",
  kazakhstan: "KZ",
  india: "IN",
  brazil: "BR",
  chile: "CL",
  "south africa": "ZA",
};

const CONTINENTS = {
  US: "North America",
  CA: "North America",
  GB: "Europe",
  DE: "Europe",
  FR: "Europe",
  NL: "Europe",
  CH: "Europe",
  SE: "Europe",
  FI: "Europe",
  NO: "Europe",
  DK: "Europe",
  IT: "Europe",
  ES: "Europe",
  AU: "Oceania",
  NZ: "Oceania",
  JP: "Asia",
  KR: "Asia",
  CN: "Asia",
  HK: "Asia",
  SG: "Asia",
  MY: "Asia",
  TW: "Asia",
  SA: "Asia",
  AE: "Asia",
  QA: "Asia",
  TR: "Asia",
  KZ: "Asia",
  IN: "Asia",
  BR: "South America",
  CL: "South America",
  ZA: "Africa",
};

const REQUIRED_CODES = [
  "US",
  "GB",
  "CA",
  "DE",
  "FR",
  "NL",
  "CH",
  "SE",
  "FI",
  "NO",
  "DK",
  "IT",
  "ES",
  "AU",
  "NZ",
  "JP",
  "KR",
  "CN",
  "HK",
  "SG",
  "MY",
  "TW",
  "SA",
  "AE",
  "QA",
  "TR",
  "KZ",
  "IN",
  "BR",
  "CL",
  "ZA",
];

function toCountryCode(country) {
  const key = String(country || "")
    .trim()
    .toLowerCase();
  return ALIASES[key] ?? null;
}

function continentFor(code, country) {
  if (CONTINENTS[code]) return CONTINENTS[code];
  const key = String(country || "").toLowerCase();
  if (/america|canada|mexico/.test(key)) return "North America";
  if (/brazil|chile|argentina|colombia|peru|uruguay/.test(key))
    return "South America";
  if (/australia|new zealand/.test(key)) return "Oceania";
  if (/africa|egypt|morocco|kenya|nigeria|tunisia/.test(key)) return "Africa";
  if (
    /china|japan|korea|india|singapore|malaysia|taiwan|hong kong|asia|uae|qatar|saudi|turkey|kazakhstan|israel|indonesia|thailand|vietnam|philippines/.test(
      key,
    )
  )
    return "Asia";
  return "Europe";
}

function slugify(name) {
  return String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function subjectTags(programs) {
  const text = programs
    .map((p) => String(p.name || "").toLowerCase())
    .join(" ");
  const rules = [
    ["Computer Science", /\b(computer science|computing|computer studies)\b/],
    [
      "Artificial Intelligence",
      /\b(artificial intelligence|machine learning)\b/,
    ],
    ["Cybersecurity", /\b(cyber ?security|information security)\b/],
    ["Software Engineering", /\b(software engineering)\b/],
    ["Data Science", /\b(data science|big data|analytics)\b/],
    ["Information Technology", /\b(information technology|\bit\b)\b/],
    ["Engineering", /\b(engineer|engineering)\b/],
    ["Business", /\b(business|management|mba|accounting|finance|marketing)\b/],
    ["Medicine", /\b(medicine|medical|m\.?d\.?\b|clinical)\b/],
    ["Law", /\b(law|legal|ll\.?b|ll\.?m)\b/],
    ["Education", /\b(education|teaching)\b/],
    [
      "Arts & Humanities",
      /\b(art|history|philosophy|literature|humanities|music)\b/,
    ],
    [
      "Natural Sciences",
      /\b(physics|chemistry|biology|mathematics|statistics)\b/,
    ],
    [
      "Social Sciences",
      /\b(economics|sociology|psychology|political|social)\b/,
    ],
  ];
  return rules.filter(([, re]) => re.test(text)).map(([label]) => label);
}

async function fetchUniversities(exclusions) {
  const all = [];
  const uniAttrs = [
    "title",
    "wur_rank",
    "campus_country",
    "campus_locality",
    "content_path",
    "nid",
    "university_attributes",
    "profile_logo",
    "small_profile_logo",
    "overview",
    "uni_prog_count",
  ];
  for (let page = 0; page < 20; page += 1) {
    const data = await algolia(INDEX_UNI, {
      query: "",
      hitsPerPage: 1000,
      page,
      attributesToRetrieve: uniAttrs,
    });
    all.push(...(data.hits ?? []));
    if (!data.hits?.length || page + 1 >= (data.nbPages ?? 1)) break;
  }

  const rankedAll = all
    .map((hit) => {
      const rank = parseRank(hit.wur_rank);
      const country = first(hit.campus_country);
      const code = toCountryCode(country);
      const attributes = (() => {
        try {
          return JSON.parse(hit.university_attributes || "{}");
        } catch {
          return {};
        }
      })();
      if (!rank || !code) return null;
      return {
        qsNid: hit.nid,
        name: hit.title,
        slug: slugify(hit.title),
        country,
        countryCode: code,
        city: first(hit.campus_locality) ?? null,
        continent: continentFor(code, country),
        qsSourceUrl: `${QS_ORIGIN}${hit.content_path}`,
        qsProfilePath: hit.content_path,
        logoUrl: hit.profile_logo ? `${QS_ORIGIN}${hit.profile_logo}` : null,
        description:
          typeof hit.overview === "string" ? hit.overview.trim() : null,
        institutionType: attributes.Status || null,
        scholarshipAvailable:
          typeof attributes.Scholarships === "string"
            ? /^yes$/i.test(attributes.Scholarships.trim())
            : null,
        internationalTuitionIndicative:
          attributes["Tuition Fee (International)"] || null,
        qsProgrammeCount: hit.uni_prog_count ?? null,
        rank,
      };
    })
    .filter(Boolean);

  const ranked = rankedAll.filter(
    (university) => !isExcluded(university, exclusions),
  );
  ranked.sort(
    (a, b) => a.rank.position - b.rank.position || a.name.localeCompare(b.name),
  );

  // Guarantee representation from every requested country by reserving the
  // highest-ranked eligible institution from each, then filling by global rank.
  const selected = [];
  const used = new Set();
  const usedSlugs = new Set();
  const usedNames = new Set();
  const canSelect = (university) =>
    !used.has(university.qsNid) &&
    !usedSlugs.has(university.slug) &&
    !usedNames.has(normaliseName(university.name));
  const add = (university) => {
    selected.push(university);
    used.add(university.qsNid);
    usedSlugs.add(university.slug);
    usedNames.add(normaliseName(university.name));
  };
  for (const code of REQUIRED_CODES) {
    const candidate = ranked.find(
      (u) => u.countryCode === code && canSelect(u),
    );
    if (candidate) add(candidate);
  }
  for (const university of ranked) {
    if (selected.length >= TARGET) break;
    if (!canSelect(university)) continue;
    add(university);
  }
  selected.sort(
    (a, b) => a.rank.position - b.rank.position || a.name.localeCompare(b.name),
  );
  return {
    allCount: all.length,
    rankedCount: rankedAll.length,
    eligibleCount: ranked.length,
    excludedCount: rankedAll.length - ranked.length,
    selected,
  };
}

async function searchWikidataEntity(university) {
  const clean = normaliseName(university.name);
  const searchUrl =
    "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=" +
    encodeURIComponent(university.name) +
    "&language=en&format=json&limit=5";
  const search = await fetchJsonRequired(searchUrl);
  const accepted = (search.search ?? []).find((candidate) => {
    const label = normaliseName(candidate.label);
    const description = String(candidate.description ?? "");
    if (!label || !clean) return false;
    const nameMatches =
      label === clean || label.includes(clean) || clean.includes(label);
    const academicContext =
      /university|college|institute|school|academy|polytechnic|higher education/i.test(
        description,
      );
    return nameMatches && academicContext;
  });
  if (!accepted?.id) return null;
  return {
    qid: accepted.id,
    title: String(accepted.label),
  };
}

async function fetchWikidataWebsites(qids) {
  const unique = [...new Set(qids.filter(Boolean))];
  const result = new Map();
  for (let index = 0; index < unique.length; index += 50) {
    const chunk = unique.slice(index, index + 50);
    const entity = await fetchJsonRequired(
      "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=" +
        chunk.join("|") +
        "&props=claims&format=json",
    );
    for (const qid of chunk) {
      const claims = entity.entities?.[qid]?.claims ?? {};
      const website = (claims.P856 ?? [])
        .map((claim) => claim?.mainsnak?.datavalue?.value)
        .find(
          (value) => typeof value === "string" && /^https?:\/\//.test(value),
        );
      result.set(qid, typeof website === "string" ? website : null);
    }
  }
  return result;
}

async function enrichWebsitesBatch(universities, cache) {
  const results = new Array(universities.length);

  for (let start = 0; start < universities.length; start += 50) {
    const pending = universities
      .map((university, index) => ({ university, index }))
      .slice(start, start + 50)
      .filter(({ university }) => !hasCached(cache, university.qsNid));

    try {
      const matches = await mapWithConcurrency(
        pending,
        CONCURRENCY,
        async ({ university }) => searchWikidataEntity(university),
      );

      const websiteByQid = await fetchWikidataWebsites(
        matches.map((match) => match?.qid).filter(Boolean),
      );

      pending.forEach(({ university, index }, position) => {
        const match = matches[position];
        const website = match ? websiteByQid.get(match.qid) : null;
        cache[university.qsNid] =
          match && website
            ? {
                officialWebsiteUrl: website,
                officialWebsiteSourceUrl:
                  "https://www.wikidata.org/wiki/" + match.qid + "#P856",
                wikipediaUrl:
                  "https://en.wikipedia.org/wiki/" +
                  encodeURIComponent(match.title.replace(/ /g, "_")),
                wikidataId: match.qid,
              }
            : null;
        results[index] = cache[university.qsNid];
      });
    } catch (_error) {
      console.log(
        `  website chunk ${start + 1} failed; will retry on next run`,
      );
    }

    for (
      let index = start;
      index < start + 50 && index < universities.length;
      index += 1
    ) {
      const university = universities[index];
      if (hasCached(cache, university.qsNid)) {
        results[index] = cache[university.qsNid];
      }
    }

    writeCache(WEBSITE_CACHE, cache);
    console.log(
      `  website resolution ${Math.min(start + 50, universities.length)}/${universities.length}`,
    );
  }

  return results;
}

async function fetchPrograms(university, limit = 12) {
  const data = await algolia(INDEX_PROG, {
    query: "",
    hitsPerPage: limit,
    filters: `uni_nid_field=${university.qsNid}`,
    attributesToRetrieve: [
      "title",
      "program_attributes",
      "content_path",
      "nid",
      "campus_country",
      "campus_locality",
      "uni_name",
    ],
  });
  return (data.hits ?? []).map((hit) => {
    let attributes = {};
    try {
      attributes = JSON.parse(hit.program_attributes || "{}");
    } catch {
      /* noop */
    }
    const feeKey = Object.keys(attributes).find((key) =>
      key.startsWith("Fees("),
    );
    return {
      name: hit.title,
      degree: attributes.Degree || null,
      studyLevel: attributes["Study Level"] || null,
      duration: attributes.Duration || null,
      studyMode: attributes["Study Mode"] || null,
      fee: feeKey ? `${attributes[feeKey]} ${feeKey.slice(5, -1)}` : null,
      scholarships: attributes.Scholarships || null,
      sourceUrl: `${QS_ORIGIN}${hit.content_path}`,
    };
  });
}

async function main() {
  const exclusions = BATCH === 1 ? null : loadExclusions();
  if (exclusions) {
    console.log(
      `Batch ${BATCH}: excluding ${exclusions.count} records from earlier datasets.`,
    );
  }
  console.log("Fetching QS 2027 university index…");
  const { allCount, rankedCount, eligibleCount, excludedCount, selected } =
    await fetchUniversities(exclusions);
  console.log(
    `  ${allCount} indexed, ${rankedCount} ranked, ${excludedCount} excluded, ${eligibleCount} eligible, selected ${selected.length}`,
  );

  const websiteCache = readCache(WEBSITE_CACHE);
  const programCache = readCache(PROGRAM_CACHE);

  let enrichments = [];
  if (!NO_ENRICH) {
    console.log("Resolving official websites (Wikidata entity search + P856)…");
    enrichments = await enrichWebsitesBatch(selected, websiteCache);
    writeCache(WEBSITE_CACHE, websiteCache);
  }

  console.log("Fetching QS programme samples…");
  let programsDone = 0;
  const programLists = await mapWithConcurrency(
    selected,
    CONCURRENCY,
    async (university) => {
      if (hasCached(programCache, university.qsNid)) {
        return programCache[university.qsNid];
      }
      let programs = [];
      try {
        programs = await fetchPrograms(university, 10);
      } catch {
        programs = [];
      }
      programCache[university.qsNid] = programs;
      programsDone += 1;
      if (programsDone % 50 === 0) {
        console.log(`  programme fetch ${programsDone}/${selected.length}`);
      }
      return programs;
    },
  );
  writeCache(PROGRAM_CACHE, programCache);

  const universities = selected.map((university, index) => {
    const { rank, ...rest } = university;
    const programs = programLists[index];
    return {
      ...rest,
      rankDisplay: rank.display,
      rankPosition: rank.position,
      rankTied: rank.tied,
      rankIsRange: rank.range,
      rankingOrganization: "QS",
      rankingEdition: RANKING_EDITION,
      ...((NO_ENRICH ? null : enrichments[index]) ?? {}),
      programs,
      subjectTags: subjectTags(programs),
      verification: {
        status: "Partially verified",
        verifiedAt: RETRIEVED_AT,
        sourceOrganization: "QS TopUniversities (public search index)",
        sourceUrl: university.qsSourceUrl,
        notes:
          "Name, country, city, type, scholarship flag, indicative international tuition, logo and description come from the QS institution profile index. Rank is the QS World University Rankings 2027 position as published on 2026-06-18; '=' denotes a preserved tie. QS is the publisher, not the institution, so these facts are partially verified. Indicative tuition is not an official university fee sheet.",
      },
    };
  });

  const coverage = Object.fromEntries(
    REQUIRED_CODES.map((code) => [
      code,
      universities.filter((university) => university.countryCode === code)
        .length,
    ]),
  );
  const enrichmentStats = {
    withOfficialWebsite: universities.filter(
      (university) => university.officialWebsiteUrl,
    ).length,
    withoutOfficialWebsite: universities.filter(
      (university) => !university.officialWebsiteUrl,
    ).length,
    withPrograms: universities.filter(
      (university) => university.programs.length,
    ).length,
    withoutPrograms: universities.filter(
      (university) => !university.programs.length,
    ).length,
  };
  const dataset = {
    meta: {
      title:
        BATCH === 1
          ? "EduBridge global university dataset — QS World University Rankings 2027"
          : `EduBridge global university dataset — QS World University Rankings 2027 (batch ${BATCH})`,
      batch: BATCH,
      rankingEdition: RANKING_EDITION,
      rankingPublished: RANKING_PUBLISHED,
      retrievedAt: RETRIEVED_AT,
      recordCount: universities.length,
      excludedPriorRecords: exclusions?.count ?? 0,
      primarySourceUrl: `${QS_ORIGIN}/world-university-rankings`,
      sources: [
        `${QS_ORIGIN}/universities (QS public university search index)`,
        "Wikidata entity search + P856 for official websites",
        `${QS_ORIGIN}/programs (QS public programme search index)`,
      ],
      enrichmentEnabled: !NO_ENRICH,
      coverage,
      enrichmentStats,
      notes:
        "Only facts returned by these sources are stored. Fields not present in the sources (IELTS/TOEFL/SAT minima, application deadlines, founded year, contact details, individual scholarship awards) are deliberately absent and must be marked unavailable by the importer." +
        (exclusions
          ? ` Batch ${BATCH} excludes ${exclusions.count} earlier records by QS nid, slug, legacy slug and normalized name.`
          : ""),
    },
    universities,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(dataset, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUT}`);
  console.log("Country coverage:", JSON.stringify(coverage));
  console.log("Enrichment:", JSON.stringify(enrichmentStats));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
