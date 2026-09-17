/**
 * Phase 18 — Skill taxonomy.
 *
 * This is the ONLY new vocabulary introduced by resume intelligence. It maps
 * skills appearing in a student's resume or a supplied job description onto the
 * curriculum that already exists in Placement OS (the 7 subjects seeded in
 * `src/db/reference-data.ts`): APT, DSA, DBMS, OS, CN, OOP, SQL.
 *
 * It contains no companies, no roles, no hiring requirements, and no claim
 * about any student. A skill mapped to a `null` domain is simply outside the
 * 7-subject curriculum, so Placement OS honestly reports its preparation state
 * as "not assessed" rather than guessing.
 */

export type SubjectCode = "APT" | "DSA" | "DBMS" | "OS" | "CN" | "OOP" | "SQL";

export type SkillCategory =
  | "language"
  | "framework"
  | "database"
  | "cloud"
  | "tool"
  | "concept"
  | "soft"
  | "domain";

export interface CanonicalSkill {
  /** Canonical display name, e.g. "PostgreSQL". */
  canonical: string;
  category: SkillCategory;
  /** Placement OS curriculum domain, or null when outside the curriculum. */
  domain: SubjectCode | null;
  /** Why this domain alignment was chosen (shown in explanations). */
  rationale: string;
  /** Alternate spellings found in resumes and job descriptions. */
  aliases: string[];
}

/**
 * Curriculum-aligned skill dictionary.
 *
 * Domain mapping policy (documented so the UI can explain itself):
 *  - Query languages and SQL-specific constructs  -> SQL
 *  - Data modelling / storage / consistency       -> DBMS
 *  - Algorithms and data structures               -> DSA
 *  - Process, memory, and container runtimes      -> OS
 *  - Protocols, APIs, networking, cloud plumbing  -> CN
 *  - Object modelling and design principles       -> OOP
 *  - Quantitative / analytical reasoning          -> APT
 *  - Languages, frameworks, and libraries         -> null (not curriculum-assessed)
 */
export const SKILL_DICTIONARY: CanonicalSkill[] = [
  // ------------------------------------------------------------------ languages
  { canonical: "Python", category: "language", domain: null, rationale: "A general-purpose language that is not itself a curriculum subject.", aliases: ["python3", "py"] },
  { canonical: "Java", category: "language", domain: null, rationale: "A general-purpose language that is not itself a curriculum subject.", aliases: [] },
  { canonical: "JavaScript", category: "language", domain: null, rationale: "A general-purpose language that is not itself a curriculum subject.", aliases: ["js", "es6", "ecmascript"] },
  { canonical: "TypeScript", category: "language", domain: null, rationale: "A general-purpose language that is not itself a curriculum subject.", aliases: ["ts"] },
  { canonical: "C", category: "language", domain: null, rationale: "A general-purpose language that is not itself a curriculum subject.", aliases: ["c language"] },
  { canonical: "C++", category: "language", domain: null, rationale: "A general-purpose language that is not itself a curriculum subject.", aliases: ["cpp", "cplusplus"] },
  { canonical: "C#", category: "language", domain: null, rationale: "A general-purpose language that is not itself a curriculum subject.", aliases: ["csharp", "c sharp"] },
  { canonical: "Go", category: "language", domain: null, rationale: "A general-purpose language that is not itself a curriculum subject.", aliases: ["golang"] },
  { canonical: "Rust", category: "language", domain: null, rationale: "A general-purpose language that is not itself a curriculum subject.", aliases: [] },
  { canonical: "Kotlin", category: "language", domain: null, rationale: "A general-purpose language that is not itself a curriculum subject.", aliases: [] },
  { canonical: "PHP", category: "language", domain: null, rationale: "A general-purpose language that is not itself a curriculum subject.", aliases: [] },
  { canonical: "Ruby", category: "language", domain: null, rationale: "A general-purpose language that is not itself a curriculum subject.", aliases: [] },
  { canonical: "Scala", category: "language", domain: null, rationale: "A general-purpose language that is not itself a curriculum subject.", aliases: [] },
  { canonical: "R", category: "language", domain: null, rationale: "A statistical language that is not itself a curriculum subject.", aliases: ["r language"] },
  { canonical: "MATLAB", category: "language", domain: null, rationale: "A numerical computing environment outside the curriculum.", aliases: [] },

  // ------------------------------------------------------------------ frontend
  { canonical: "React", category: "framework", domain: null, rationale: "A UI library; Placement OS does not assess framework-specific knowledge.", aliases: ["reactjs", "react.js"] },
  { canonical: "Next.js", category: "framework", domain: null, rationale: "A UI framework; Placement OS does not assess framework-specific knowledge.", aliases: ["nextjs", "next js"] },
  { canonical: "Vue", category: "framework", domain: null, rationale: "A UI framework; Placement OS does not assess framework-specific knowledge.", aliases: ["vuejs", "vue.js"] },
  { canonical: "Angular", category: "framework", domain: null, rationale: "A UI framework; Placement OS does not assess framework-specific knowledge.", aliases: ["angularjs"] },
  { canonical: "Svelte", category: "framework", domain: null, rationale: "A UI framework; Placement OS does not assess framework-specific knowledge.", aliases: [] },
  { canonical: "Tailwind CSS", category: "framework", domain: null, rationale: "A styling utility library outside the curriculum.", aliases: ["tailwind", "tailwindcss"] },
  { canonical: "HTML", category: "framework", domain: null, rationale: "A markup language outside the assessed curriculum.", aliases: ["html5"] },
  { canonical: "CSS", category: "framework", domain: null, rationale: "A styling language outside the assessed curriculum.", aliases: ["css3", "scss", "sass", "less"] },
  { canonical: "Redux", category: "framework", domain: null, rationale: "A state-management library outside the curriculum.", aliases: [] },

  // ------------------------------------------------------------------ backend
  { canonical: "Node.js", category: "framework", domain: null, rationale: "A server runtime; Placement OS does not assess framework-specific knowledge.", aliases: ["nodejs", "node js", "node"] },
  { canonical: "Express", category: "framework", domain: null, rationale: "A web framework outside the assessed curriculum.", aliases: ["expressjs", "express.js"] },
  { canonical: "Django", category: "framework", domain: null, rationale: "A web framework outside the assessed curriculum.", aliases: [] },
  { canonical: "Flask", category: "framework", domain: null, rationale: "A web framework outside the assessed curriculum.", aliases: [] },
  { canonical: "FastAPI", category: "framework", domain: null, rationale: "A web framework outside the assessed curriculum.", aliases: ["fast api"] },
  { canonical: "Spring Boot", category: "framework", domain: null, rationale: "A JVM application framework outside the assessed curriculum.", aliases: ["spring", "springboot"] },
  { canonical: ".NET", category: "framework", domain: null, rationale: "An application platform outside the assessed curriculum.", aliases: ["dotnet", "asp.net", "aspnet"] },
  { canonical: "REST APIs", category: "framework", domain: "CN", rationale: "HTTP API design is assessed under Computer Networks (protocols and request/response semantics).", aliases: ["rest", "rest api", "restful", "restful api", "rest apis", "web api", "api design"] },
  { canonical: "GraphQL", category: "framework", domain: "CN", rationale: "An HTTP-based query protocol, assessed under Computer Networks.", aliases: [] },
  { canonical: "gRPC", category: "framework", domain: "CN", rationale: "A networked RPC protocol, assessed under Computer Networks.", aliases: [] },
  { canonical: "WebSockets", category: "framework", domain: "CN", rationale: "A persistent network transport, assessed under Computer Networks.", aliases: ["websocket", "socket.io"] },
  { canonical: "ORMs", category: "framework", domain: "DBMS", rationale: "Object-relational mapping sits on top of data modelling, assessed under DBMS.", aliases: ["orm", "hibernate", "sequelize", "prisma", "mongoose"] },

  // ------------------------------------------------------------------ databases
  { canonical: "SQL", category: "database", domain: "SQL", rationale: "SQL querying is a first-class Placement OS subject.", aliases: ["structured query language", "sql queries", "sql query", "joins", "sql joins", "subqueries", "window functions", "cte", "stored procedures"] },
  { canonical: "PostgreSQL", category: "database", domain: "SQL", rationale: "A relational database queried through SQL, the Placement OS SQL subject.", aliases: ["postgres", "psql", "pg"] },
  { canonical: "MySQL", category: "database", domain: "SQL", rationale: "A relational database queried through SQL, the Placement OS SQL subject.", aliases: ["mariadb"] },
  { canonical: "SQLite", category: "database", domain: "SQL", rationale: "A relational database queried through SQL, the Placement OS SQL subject.", aliases: [] },
  { canonical: "Oracle DB", category: "database", domain: "SQL", rationale: "A relational database queried through SQL, the Placement OS SQL subject.", aliases: ["pl/sql", "plsql", "t-sql", "tsql", "oracle"] },
  { canonical: "MongoDB", category: "database", domain: "DBMS", rationale: "A non-relational datastore; storage modelling is assessed under DBMS.", aliases: ["mongo", "nosql"] },
  { canonical: "Redis", category: "database", domain: "DBMS", rationale: "An in-memory datastore; caching and storage concepts are assessed under DBMS.", aliases: [] },
  { canonical: "Data Modelling", category: "concept", domain: "DBMS", rationale: "Schema and entity modelling are assessed under DBMS.", aliases: ["data modeling", "schema design", "database design", "er model", "erd", "entity relationship"] },
  { canonical: "Normalization", category: "concept", domain: "DBMS", rationale: "Normalization is a DBMS syllabus topic.", aliases: ["normalisation", "normal forms", "3nf", "bcnf"] },
  { canonical: "Transactions", category: "concept", domain: "DBMS", rationale: "Transactions and ACID properties are DBMS syllabus topics.", aliases: ["acid", "acid properties", "transaction management"] },
  { canonical: "Indexing", category: "concept", domain: "DBMS", rationale: "Indexing is a DBMS syllabus topic.", aliases: ["database indexes", "indexes", "b-tree index", "b+ tree"] },
  { canonical: "Concurrency Control", category: "concept", domain: "DBMS", rationale: "Concurrency control is a DBMS syllabus topic.", aliases: ["locking", "isolation levels"] },
  { canonical: "Database Replication", category: "concept", domain: "DBMS", rationale: "Replication and sharding are storage-distribution topics assessed under DBMS.", aliases: ["replication", "sharding", "partitioning", "replicas"] },
  { canonical: "Query Optimization", category: "concept", domain: "DBMS", rationale: "Query planning and optimization are assessed under DBMS.", aliases: ["query optimization", "query optimization", "query tuning", "execution plans", "explain plan", "query performance"] },

  // ------------------------------------------------------------------ data structures & algorithms
  { canonical: "Data Structures", category: "concept", domain: "DSA", rationale: "Data structures are a core DSA syllabus area.", aliases: ["data structure", "dsa", "data structures and algorithms"] },
  { canonical: "Algorithms", category: "concept", domain: "DSA", rationale: "Algorithmic problem solving is the DSA syllabus core.", aliases: ["algorithm", "algorithmic", "problem solving with algorithms"] },
  { canonical: "Arrays", category: "concept", domain: "DSA", rationale: "Arrays are a DSA syllabus topic.", aliases: ["array", "array manipulation"] },
  { canonical: "Linked Lists", category: "concept", domain: "DSA", rationale: "Linked lists are a DSA syllabus topic.", aliases: ["linked list", "singly linked list", "doubly linked list"] },
  { canonical: "Stacks", category: "concept", domain: "DSA", rationale: "Stacks are a DSA syllabus topic.", aliases: ["stack"] },
  { canonical: "Queues", category: "concept", domain: "DSA", rationale: "Queues are a DSA syllabus topic.", aliases: ["queue", "priority queue", "deque"] },
  { canonical: "Trees", category: "concept", domain: "DSA", rationale: "Trees are a DSA syllabus topic.", aliases: ["tree", "binary tree", "binary search tree", "bst", "trie", "heap", "heaps", "avl tree", "segment tree"] },
  { canonical: "Graphs", category: "concept", domain: "DSA", rationale: "Graphs are a DSA syllabus topic.", aliases: ["graph", "graph algorithms", "bfs", "dfs", "dijkstra", "topological sort", "shortest path"] },
  { canonical: "Dynamic Programming", category: "concept", domain: "DSA", rationale: "Dynamic programming is a DSA syllabus topic.", aliases: ["dp", "memoization"] },
  { canonical: "Recursion", category: "concept", domain: "DSA", rationale: "Recursion is a DSA syllabus topic.", aliases: ["recursive", "backtracking"] },
  { canonical: "Sorting", category: "concept", domain: "DSA", rationale: "Sorting is a DSA syllabus topic.", aliases: ["sort", "merge sort", "quick sort", "quicksort", "heapsort"] },
  { canonical: "Searching", category: "concept", domain: "DSA", rationale: "Searching is a DSA syllabus topic.", aliases: ["binary search", "search algorithms", "linear search"] },
  { canonical: "Hashing", category: "concept", domain: "DSA", rationale: "Hashing is a DSA syllabus topic.", aliases: ["hash table", "hash map", "hashmap", "hash set", "hashing techniques"] },
  { canonical: "Complexity Analysis", category: "concept", domain: "DSA", rationale: "Time and space complexity analysis is assessed under DSA.", aliases: ["time complexity", "space complexity", "big o", "big-o", "asymptotic analysis"] },
  { canonical: "String Manipulation", category: "concept", domain: "DSA", rationale: "String algorithms are a DSA syllabus topic.", aliases: ["strings", "string algorithms", "string processing"] },

  // ------------------------------------------------------------------ operating systems
  { canonical: "Operating Systems", category: "concept", domain: "OS", rationale: "Operating systems is a first-class Placement OS subject.", aliases: ["operating system", "os internals", "kernel internals"] },
  { canonical: "Process Management", category: "concept", domain: "OS", rationale: "Processes are an OS syllabus topic.", aliases: ["processes", "process scheduling", "context switching", "scheduling algorithms"] },
  { canonical: "Multithreading", category: "concept", domain: "OS", rationale: "Threads and synchronization are OS syllabus topics.", aliases: ["threads", "multithreaded", "multi-threading", "threading", "mutex", "semaphore", "process synchronization"] },
  { canonical: "Deadlocks", category: "concept", domain: "OS", rationale: "Deadlocks are an OS syllabus topic.", aliases: ["deadlock", "deadlock prevention"] },
  { canonical: "Memory Management", category: "concept", domain: "OS", rationale: "Memory management is an OS syllabus topic.", aliases: ["virtual memory", "paging", "segmentation", "memory allocation", "garbage collection"] },
  { canonical: "File Systems", category: "concept", domain: "OS", rationale: "File systems are an OS syllabus topic.", aliases: ["file system", "filesystem", "inode"] },
  { canonical: "Linux", category: "tool", domain: "OS", rationale: "Linux process, memory, and file semantics are assessed under Operating Systems.", aliases: ["unix", "ubuntu", "unix/linux", "bash scripting", "shell scripting", "shell", "bash"] },
  { canonical: "Docker", category: "cloud", domain: "OS", rationale: "Container isolation builds on process and filesystem concepts assessed under Operating Systems.", aliases: ["containers", "containerization", "containerisation", "dockerfile", "docker compose", "docker-compose"] },
  { canonical: "Kubernetes", category: "cloud", domain: "OS", rationale: "Orchestration of process isolation and scheduling is assessed under Operating Systems.", aliases: ["k8s", "kubectl", "helm"] },
  { canonical: "CI/CD", category: "tool", domain: "OS", rationale: "Build and release pipelines execute in the process/OS domain (Linux runtimes).", aliases: ["ci cd", "continuous integration", "continuous delivery", "continuous deployment", "jenkins", "github actions", "gitlab ci", "pipeline automation"] },
  { canonical: "Infrastructure as Code", category: "cloud", domain: null, rationale: "Infrastructure-as-code tooling is outside the 7-subject curriculum.", aliases: ["terraform", "ansible", "cloudformation", "iac"] },

  // ------------------------------------------------------------------ computer networks
  { canonical: "Computer Networks", category: "concept", domain: "CN", rationale: "Computer networks is a first-class Placement OS subject.", aliases: ["networking", "network fundamentals", "computer networking"] },
  { canonical: "HTTP/HTTPS", category: "concept", domain: "CN", rationale: "HTTP and HTTPS are CN syllabus topics.", aliases: ["http", "https", "http/2", "rest over http", "request response"] },
  { canonical: "TCP/IP", category: "concept", domain: "CN", rationale: "TCP/IP is a CN syllabus topic.", aliases: ["tcp", "udp", "ip addressing", "sockets", "socket programming"] },
  { canonical: "DNS", category: "concept", domain: "CN", rationale: "DNS is a CN syllabus topic.", aliases: ["domain name system"] },
  { canonical: "Load Balancing", category: "concept", domain: "CN", rationale: "Traffic distribution and routing are assessed under Computer Networks.", aliases: ["load balancer", "load balancers", "reverse proxy", "nginx", "haproxy"] },
  { canonical: "OSI Model", category: "concept", domain: "CN", rationale: "The OSI model is a CN syllabus topic.", aliases: ["osi", "osi layers", "network layers"] },
  { canonical: "Subnetting", category: "concept", domain: "CN", rationale: "Subnetting is a CN syllabus topic.", aliases: ["subnet", "cidr"] },
  { canonical: "Network Security", category: "concept", domain: "CN", rationale: "Network security and TLS are CN syllabus topics.", aliases: ["tls", "ssl", "https security", "firewalls", "encryption", "oauth", "jwt"] },
  { canonical: "Microservices", category: "concept", domain: "CN", rationale: "Service-to-service communication is a networking concern assessed under Computer Networks.", aliases: ["microservice", "service mesh"] },
  { canonical: "Message Queues", category: "concept", domain: "CN", rationale: "Asynchronous transport between services is assessed under Computer Networks.", aliases: ["kafka", "rabbitmq", "pub/sub", "message broker", "event streaming"] },
  // Cloud providers are kept as separate canonicals: a job description asking
  // for Azure must never be reported as matched by an AWS line on a resume.
  { canonical: "AWS", category: "cloud", domain: "CN", rationale: "Cloud infrastructure depends on networking and distributed connectivity assessed under Computer Networks.", aliases: ["aws", "amazon web services", "ec2", "s3", "lambda", "cloudformation"] },
  { canonical: "Azure", category: "cloud", domain: "CN", rationale: "Cloud infrastructure depends on networking and distributed connectivity assessed under Computer Networks.", aliases: ["azure", "microsoft azure"] },
  { canonical: "Google Cloud", category: "cloud", domain: "CN", rationale: "Cloud infrastructure depends on networking and distributed connectivity assessed under Computer Networks.", aliases: ["gcp", "google cloud", "google cloud platform", "bigquery"] },
  { canonical: "Cloud Platforms", category: "cloud", domain: "CN", rationale: "Generic cloud infrastructure knowledge is a networking concern assessed under Computer Networks.", aliases: ["cloud computing", "cloud infrastructure", "cloud platforms", "iaas", "paas", "serverless"] },

  // ------------------------------------------------------------------ OOP
  { canonical: "Object-Oriented Programming", category: "concept", domain: "OOP", rationale: "OOP is a first-class Placement OS subject.", aliases: ["oop", "object oriented", "object-oriented", "object oriented programming", "oops"] },
  { canonical: "Inheritance & Polymorphism", category: "concept", domain: "OOP", rationale: "Inheritance and polymorphism are OOP syllabus topics.", aliases: ["inheritance", "polymorphism", "encapsulation", "abstraction", "classes and objects", "interfaces"] },
  { canonical: "Design Patterns", category: "concept", domain: "OOP", rationale: "Design patterns are an OOP syllabus topic.", aliases: ["design pattern", "singleton", "factory pattern", "observer pattern", "mvc", "solid principles", "solid"] },
  { canonical: "System Design", category: "concept", domain: null, rationale: "System design is a distinct interview discipline that Placement OS does not assess as a curriculum subject.", aliases: ["system design", "hld", "high level design", "distributed systems", "scalability", "low level design", "lld", "architecture design"] },

  // ------------------------------------------------------------------ data / tools
  { canonical: "Git", category: "tool", domain: null, rationale: "Version control is a tool, not one of the 7 assessed subjects.", aliases: ["github", "gitlab", "bitbucket", "version control", "git flow"] },
  { canonical: "Data Analysis", category: "concept", domain: "APT", rationale: "Statistical and analytical reasoning is assessed under Aptitude.", aliases: ["data analytics", "statistical analysis", "statistics", "excel", "pandas", "numpy", "data visualization", "power bi", "tableau", "matplotlib"] },
  { canonical: "Machine Learning", category: "domain", domain: null, rationale: "Machine learning is outside the 7-subject curriculum.", aliases: ["ml", "deep learning", "tensorflow", "pytorch", "scikit-learn", "sklearn", "nlp", "computer vision", "artificial intelligence", "ai"] },
  { canonical: "Testing & QA", category: "concept", domain: null, rationale: "Automated testing is outside the 7-subject curriculum.", aliases: ["unit testing", "automated testing", "test automation", "selenium", "cypress", "jest", "pytest", "junit", "qa", "test cases"] },
  { canonical: "Agile Collaboration", category: "soft", domain: null, rationale: "Process collaboration is a workplace practice, not an assessed subject.", aliases: ["agile", "scrum", "kanban", "jira", "sprint planning"] },
  { canonical: "Technical Communication", category: "soft", domain: "APT", rationale: "Verbal reasoning and communication are assessed under Aptitude.", aliases: ["communication skills", "communication", "presentation skills", "technical writing", "documentation", "collaboration", "teamwork", "leadership", "mentoring"] },
  { canonical: "Analytical Reasoning", category: "soft", domain: "APT", rationale: "Logical and quantitative reasoning are assessed under Aptitude.", aliases: ["logical reasoning", "analytical skills", "quantitative aptitude", "critical thinking", "quantitative reasoning"] },
];

// ============================================================================
// Alias index
// ============================================================================

interface AliasEntry {
  alias: string;
  normalizedAlias: string;
  skill: CanonicalSkill;
}

function normalizeForKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_ENTRIES: AliasEntry[] = (() => {
  const entries: AliasEntry[] = [];
  for (const skill of SKILL_DICTIONARY) {
    const allAliases = new Set<string>([skill.canonical, ...skill.aliases]);
    for (const alias of allAliases) {
      entries.push({ alias, normalizedAlias: normalizeForKey(alias), skill });
    }
  }
  // Longest alias first so "rest apis" wins over "rest".
  entries.sort((a, b) => b.normalizedAlias.length - a.normalizedAlias.length);
  return entries;
})();

export const KNOWN_SKILL_ALIASES: ReadonlySet<string> = new Set(
  ALIAS_ENTRIES.map((e) => e.normalizedAlias)
);

/** Canonical lookup by normalized alias, e.g. "postgres" -> "PostgreSQL". */
const CANONICAL_BY_ALIAS = new Map<string, CanonicalSkill>();
for (const entry of ALIAS_ENTRIES) {
  if (!CANONICAL_BY_ALIAS.has(entry.normalizedAlias)) {
    CANONICAL_BY_ALIAS.set(entry.normalizedAlias, entry.skill);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Single pre-compiled matcher. Boundaries are custom because aliases such as
 * "c++", "c#", ".net" and "node.js" end in non-word characters.
 */
const SKILL_MATCHER: RegExp = (() => {
  const pattern = ALIAS_ENTRIES.map((e) => escapeRegExp(e.alias.replace(/\s+/g, "\\s+"))).join("|");
  return new RegExp(`(?<![a-z0-9#+.])(?:${pattern})(?![a-z0-9+#])`, "gi");
})();

export interface SkillHit {
  /** Term exactly as it appeared in the source text. */
  term: string;
  canonical: string;
  category: SkillCategory;
  domain: SubjectCode | null;
  rationale: string;
  /** Verbatim line containing the match. */
  evidence: string;
  count: number;
}

/**
 * Extract canonical skills from arbitrary text. Matching is literal (no
 * stemming or guessing): a skill is only reported when its term is actually
 * present in the text.
 */
export function extractSkills(text: string): SkillHit[] {
  if (!text || !text.trim()) return [];

  const lines = text.split("\n");
  const lineIndexOf = (index: number): string => {
    let offset = 0;
    for (const line of lines) {
      const end = offset + line.length;
      if (index <= end) return line.trim();
      offset = end + 1;
    }
    return lines[lines.length - 1]?.trim() ?? "";
  };

  const hits = new Map<string, SkillHit>();
  SKILL_MATCHER.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SKILL_MATCHER.exec(text)) !== null) {
    const matched = match[0];
    const entry = CANONICAL_BY_ALIAS.get(normalizeForKey(matched));
    const skill = entry ?? SKILL_DICTIONARY.find((s) => s.canonical === matched);
    if (!skill) continue;

    const existing = hits.get(skill.canonical);
    if (existing) {
      existing.count += 1;
    } else {
      hits.set(skill.canonical, {
        term: matched,
        canonical: skill.canonical,
        category: skill.category,
        domain: skill.domain,
        rationale: skill.rationale,
        evidence: lineIndexOf(match.index),
        count: 1,
      });
    }
    if (match.index === SKILL_MATCHER.lastIndex) SKILL_MATCHER.lastIndex++;
  }

  return Array.from(hits.values()).sort((a, b) => a.canonical.localeCompare(b.canonical));
}

/** Canonical names of every skill literally present in the text. */
export function detectCanonicalSkills(text: string): string[] {
  return extractSkills(text).map((hit) => hit.canonical);
}

/** Resolve a single token/phrase to a canonical skill, or null. */
export function canonicalizeSkill(term: string): CanonicalSkill | null {
  const normalized = normalizeForKey(term);
  return CANONICAL_BY_ALIAS.get(normalized) ?? null;
}

export function getSkill(canonical: string): CanonicalSkill | null {
  const normalized = normalizeForKey(canonical);
  return CANONICAL_BY_ALIAS.get(normalized) ?? null;
}

/**
 * True when a token is part of the known technology vocabulary. Used by the
 * suggestion guard to detect newly introduced technologies.
 */
export function isKnownSkillTerm(token: string): boolean {
  return KNOWN_SKILL_ALIASES.has(normalizeForKey(token));
}

/** Domain for a canonical skill name, when the taxonomy knows it. */
export function domainForSkill(canonical: string): SubjectCode | null {
  return getSkill(canonical)?.domain ?? null;
}

export const SUBJECT_CODE_LABELS: Record<SubjectCode, string> = {
  APT: "Aptitude",
  DSA: "Data Structures & Algorithms",
  DBMS: "Database Management Systems",
  OS: "Operating Systems",
  CN: "Computer Networks",
  OOP: "Object Oriented Programming",
  SQL: "SQL",
};

/** Terminology that reliably signals role scope in a job description. */
export const ROLE_TERMINOLOGY: string[] = [
  "system design",
  "distributed systems",
  "microservices",
  "scalability",
  "low latency",
  "high availability",
  "code review",
  "unit testing",
  "test automation",
  "debugging",
  "performance optimization",
  "cross-functional",
  "stakeholder",
  "production",
  "deployment",
  "monitoring",
  "observability",
  "agile",
  "mentoring",
  "ownership",
  "on-call",
  "data structures",
  "algorithms",
  "problem solving",
  "rest api",
  "api design",
  "cloud",
  "containerization",
  "continuous integration",
  "version control",
  "sql queries",
  "data modeling",
];
