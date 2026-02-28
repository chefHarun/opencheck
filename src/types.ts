export interface Dependency {
    name: string;
    currentVersion: string;
    latestVersion: string;
    isOutdated: boolean;
    daysSinceUpdate: number;
    weeklyDownloads: number;
    isDeprecated: boolean;
    vulnerabilities: Vulnerability[];
    githubStars?: number;
    status: "critical" | "warning" | "ok";
  }
  
  export interface Vulnerability {
    id: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    summary: string;
    url: string;
  }
  
  export interface CheckResult {
    totalPackages: number;
    critical: Dependency[];
    warnings: Dependency[];
    ok: Dependency[];
    checkedAt: Date;
  }