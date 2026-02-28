import { Vulnerability } from "./types";

export async function getVulnerabilities(
  name: string,
  version: string
): Promise<Vulnerability[]> {
  try {
    const res = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version,
        package: { name, ecosystem: "npm" },
      }),
    });

    if (!res.ok) return [];
    const data = await res.json() as any;
    return (data.vulns ?? []).map((v: any) => ({
      id: v.id,
      severity: parseSeverity(v),
      summary: v.summary ?? "No description",
      url: `https://osv.dev/vulnerability/${v.id}`,
    }));
  } catch {
    return [];
  }
}

function parseSeverity(vuln: any): Vulnerability["severity"] {
  const cvss =
    vuln.severity?.[0]?.score ??
    vuln.database_specific?.cvss?.score ??
    0;

  if (cvss >= 9) return "CRITICAL";
  if (cvss >= 7) return "HIGH";
  if (cvss >= 4) return "MEDIUM";
  return "LOW";
}