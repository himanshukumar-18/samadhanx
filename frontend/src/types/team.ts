export interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  role: string;
  university?: string;
  skills: string[];
}

export interface Team {
  id: string;
  name: string;
  problemId: string;
  problemTitle: string;
  membersCount: number;
  maxMembers: number;
  stage: 'FORMATION' | 'IDEATION' | 'PROTOTYPE' | 'PILOT' | 'SCALING';
  lead: {
    id: string;
    name: string;
    avatar: string;
    university: string;
  };
  openRoles: string[];
  mentorsCount: number;
}

export interface CandidateMatch {
  userId: string;
  name: string;
  avatar: string;
  role: string;
  matchScore: number;
  matchingSkills: string[];
  university: string;
}

export interface SolutionTeam {
  id: string;
  name: string;
  problemId: string;
  problemTitle: string;
  universityName: string;
  facultyMentorName?: string;
  members: TeamMember[];
  stage: 'Ideation' | 'Hardware Prototype' | 'Software Beta' | 'Field Pilot' | 'Deployed';
  prototypeUrl?: string;
  githubUrl?: string;
  summary: string;
  createdAt: string;
}
