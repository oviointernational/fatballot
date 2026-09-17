export interface Office {
  id: string;
  title: string;
  order: number;
  description: string;
  icon: string; // Lucide icon identifier
}

export interface CandidateProfile {
  id: string;
  officeId: string;
  name: string;
  raNumber: string;
  avatar: string;
  tagline: string;
  vision: string;
  antecedent: string[];
  currentOffices: string[];
  achievements: string[];
  contactEmail: string;
}

export interface Voter {
  id: string;
  raNumber: string; // e.g. "1001", "2001", "3001"
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  role: 'voter' | 'contestant' | 'committee' | 'superadmin';
  isAccredited: boolean;
  isScreened?: boolean;
  assignedOfficeId?: string;
  isAgent?: boolean;
  agentOfficeId?: string;
  agentCandidateId?: string;
  department?: string;
  phone?: string;
  avatar?: string;
  registeredAt: string;
}

export interface ScreeningCriteria {
  id: string;
  officeId: string;
  title: string;
  criteria: string[];
}

export interface CandidateScreening {
  candidateId: string;
  officeId: string;
  results: { criterion: string; passed: boolean }[];
  passedCount: number;
  totalCount: number;
  percentage: number;
  isScreened: boolean;
  screenedAt: string;
}

export interface ElectionAgent {
  id: string;
  voterId: string;
  voterRaNumber: string;
  voterName: string;
  officeId: string;
  candidateId: string;
  candidateName: string;
  assignedAt: string;
}

export interface Observer {
  id: string;
  name: string;
  rank: string;
  office?: string;
  phone: string;
  token: string;
  createdAt: string;
  lastActiveDeviceId?: string;
}

export interface RolePermissions {
  canRegisterUsers: string[];
  canAccreditUsers: string[];
  canCreateOffices: string[];
  canAssignOffices: string[];
  canCreateScreeningCriteria: string[];
  canAssignAgents: string[];
  canCreateObservers: string[];
}

export interface TimelineItem {
  id: string;
  order: number;
  title: string;
  description: string;
  date: string;
  status: 'completed' | 'active' | 'upcoming';
  icon: string;
}

export interface YCECMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  avatar: string;
  tenure: string;
}

export interface SiteSettings {
  siteName: string;
  aboutTitle: string;
  aboutContent: string;
  aboutImageUrl: string;
  electionStartTime: string;
  electionEndTime: string;
  contestantsCanViewVoters: boolean;
  publicAuditLog: boolean;
  permissions: RolePermissions;
}

export interface CastVote {
  id: string;
  voterRaNumber: string;
  officeId: string;
  choice: 'candidate' | 'for' | 'against';
  candidateId?: string; // empty if against
  timestamp: string;
  ipAddress?: string;
}

// Initial default settings
export const initialSettings: SiteSettings = {
  siteName: "FatBallot",
  aboutTitle: "Official 2026 Youth & Community Executive Elections",
  aboutContent: `Welcome to the official digital voting platform for the 2026 General Elections. FatBallot is engineered to guarantee sovereign transparency, immutable election integrity, and seamless accessibility for all accredited voters. Every vote cast, accreditation processed, and ballot modification is cryptographically signed and permanently logged in our zero-tampering audit ledger. Please ensure your accreditation is active before proceeding to the ballot chamber.`,
  aboutImageUrl: "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=1200&q=80",
  electionStartTime: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // started 1 hour ago
  electionEndTime: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(), // ends in 72 hours
  contestantsCanViewVoters: true,
  publicAuditLog: false,
  permissions: {
    canRegisterUsers: ['superadmin', 'committee'],
    canAccreditUsers: ['superadmin', 'committee'],
    canCreateOffices: ['superadmin', 'committee'],
    canAssignOffices: ['superadmin', 'committee'],
    canCreateScreeningCriteria: ['superadmin', 'committee'],
    canAssignAgents: ['superadmin', 'committee'],
    canCreateObservers: ['superadmin']
  }
};

// Initial offices
export const initialOffices: Office[] = [
  {
    id: "off-pres",
    title: "Executive President",
    order: 1,
    description: "Chief Executive Officer presiding over executive meetings and steering council mandates.",
    icon: "Crown"
  },
  {
    id: "off-vp",
    title: "Vice President",
    order: 2,
    description: "Principal assistant to the President, supervising committees and policy execution.",
    icon: "Shield"
  },
  {
    id: "off-sec",
    title: "General Secretary",
    order: 3,
    description: "Custodian of council secretariat, minutes, correspondence, and institutional records.",
    icon: "FileText"
  },
  {
    id: "off-tres",
    title: "Treasurer & Financial Secretary",
    order: 4,
    description: "Manager of budgetary allocations, audits, funds custody, and financial disclosures.",
    icon: "Coins"
  },
  {
    id: "off-soc",
    title: "Director of Socials & Welfare",
    order: 5,
    description: "Overseeing student wellbeing, community engagements, cultural forums, and welfare.",
    icon: "Sparkles"
  },
  {
    id: "off-pro",
    title: "Public Relations Officer (PRO)",
    order: 6,
    description: "Primary spokesperson managing institutional communications and public bulletins.",
    icon: "Megaphone"
  }
];

// Initial Candidates
// PRODUCTION: no demo contestants ship with the app. Contestants are created
// by assigning registered voters to offices via the Admin portal.
export const initialCandidates: CandidateProfile[] = [];

// Initial Voters
// PRODUCTION: the store ships with ONLY the Superadmin account. Every other
// voter (committee, contestants, electorate) is enrolled through the Admin
// portal. The Superadmin email can be overridden with the SUPERADMIN_EMAIL
// environment variable (see server/database.ts ensureSuperadmin) so the
// passwordless sign-in link reaches a real inbox.
export const initialVoters: Voter[] = [
  {
    id: "vot-superadmin",
    raNumber: "1001",
    email: "superadmin@fatballot.org",
    firstName: "Electoral",
    middleName: "Chief",
    lastName: "SuperAdmin",
    role: "superadmin",
    isAccredited: true,
    department: "Electoral Commission Directorate",
    phone: "+234 801 000 1001",
    registeredAt: "2026-08-01T08:00:00.000Z"
  }
];

// Initial Timeline
export const initialTimeline: TimelineItem[] = [
  {
    id: "time-1",
    order: 1,
    title: "Voter Registration & Database Publication",
    description: "Publishing of eligible electorate voter lists, RA assignments, and institutional directory cross-matching.",
    date: "Aug 01 - Aug 20, 2026",
    status: "completed",
    icon: "UserCheck"
  },
  {
    id: "time-2",
    order: 2,
    title: "Nomination & Candidate Screening",
    description: "Submission of candidacy nomination forms, vetting of constitutional eligibility, and publication of contestant profiles.",
    date: "Aug 21 - Aug 28, 2026",
    status: "completed",
    icon: "FileCheck"
  },
  {
    id: "time-3",
    order: 3,
    title: "Presidential & Executive Manifesto Debate",
    description: "Broadcasted public debate sessions and manifesto presentations streamed live across constituent forums.",
    date: "Sep 01 - Sep 05, 2026",
    status: "completed",
    icon: "Radio"
  },
  {
    id: "time-4",
    order: 4,
    title: "Voter Accreditation & Security Verification",
    description: "Issuance of secure biometric/digital RA authentication tokens and single-device credential validation.",
    date: "Sep 06 - Sep 11, 2026",
    status: "active",
    icon: "BadgeCheck"
  },
  {
    id: "time-5",
    order: 5,
    title: "FatBallot Live Election & E-Ballot Portal",
    description: "Electronic ballot portal opens for accredited voters. Real-time encrypted vote casting with instant change capability.",
    date: "Sep 12 - Sep 15, 2026",
    status: "active",
    icon: "Vote"
  },
  {
    id: "time-6",
    order: 6,
    title: "Official Collation, Audit & Declaration of Results",
    description: "Cryptographic validation of SHA-256 audit ledger, official return certifications, and swearing-in ceremony.",
    date: "Sep 16, 2026",
    status: "upcoming",
    icon: "Award"
  }
];

// Initial YCEC Members
export const initialYCEC: YCECMember[] = [
  {
    id: "ycec-1",
    name: "Engr. Nnamdi Paul Azikiwe",
    role: "Chief Electoral Commissioner & Chairman",
    email: "chairman.ycec@fatballot.org",
    phone: "+234 803 111 2221",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
    tenure: "2025 - 2027"
  },
  {
    id: "ycec-2",
    name: "Prof. Aisha Mohammed Danjuma",
    role: "Secretary to the Electoral Commission",
    email: "secretary.ycec@fatballot.org",
    phone: "+234 803 111 2222",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
    tenure: "2025 - 2027"
  },
  {
    id: "ycec-3",
    name: "Barr. Femi Kayode Alabi",
    role: "Chief Legal & Constitutional Advisory Counsel",
    email: "legal.ycec@fatballot.org",
    phone: "+234 803 111 2223",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    tenure: "2025 - 2027"
  },
  {
    id: "ycec-4",
    name: "Dr. Maryam Chinedu Sanni",
    role: "Head of Digital Cryptography & Audit Ledger",
    email: "security.ycec@fatballot.org",
    phone: "+234 803 111 2224",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    tenure: "2025 - 2027"
  },
  {
    id: "ycec-5",
    name: "Mr. Victor Damilola Adeleke",
    role: "Director of Logistics, Accreditation & Collation",
    email: "logistics.ycec@fatballot.org",
    phone: "+234 803 111 2225",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80",
    tenure: "2025 - 2027"
  }
];

// Initial seed votes
// PRODUCTION: the ballot box starts empty. Any seed votes would be fake
// election data, so none ship with the app.
export const initialVotes: CastVote[] = [];

// Initial screening criteria for contested offices
export const initialScreeningCriteria: ScreeningCriteria[] = [
  {
    id: "crit-pres",
    officeId: "off-pres",
    title: "Executive Presidential Clearance Benchmark",
    criteria: [
      "Valid constituent matriculation and good financial standing",
      "Cumulative GPA above minimum threshold (3.0+)",
      "Zero disciplinary indictment or examination malpractice records",
      "Public asset and constitutional pledge disclosure",
      "Certified leadership track record and public debate participation",
      "Endorsement signatures from at least 25 accredited electorate members"
    ]
  },
  {
    id: "crit-vp",
    officeId: "off-vp",
    title: "Vice Presidential Vetting Standards",
    criteria: [
      "Good academic and administrative standing",
      "Demonstrated committee coordination experience",
      "Pledge of executive alignment and non-partisanship",
      "Endorsement signatures from at least 15 registered constituents"
    ]
  },
  {
    id: "crit-sec",
    officeId: "off-sec",
    title: "General Secretariat Procedural Competence",
    criteria: [
      "Documentation, archival, and typing proficiency",
      "No unresolved disciplinary disputes",
      "Endorsement by at least 10 registered voters"
    ]
  }
];

// Initial Agents
// PRODUCTION: no demo agents. Agents are commissioned per candidate via Admin.
export const initialAgents: ElectionAgent[] = [];

// Initial Observers
// PRODUCTION: no demo observers. Observer passes are issued via Admin.
export const initialObservers: Observer[] = [];
