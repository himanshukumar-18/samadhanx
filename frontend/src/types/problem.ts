export type ProblemStatus =
  | 'reported'
  | 'under_review'
  | 'verified'
  | 'discussion'
  | 'team_forming'
  | 'in_progress'
  | 'prototype'
  | 'pilot'
  | 'solved';

export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

export type ProblemCategory =
  | 'Water & Sanitation'
  | 'Clean Energy & Solar'
  | 'Waste Management'
  | 'Agriculture & Rural Tech'
  | 'Healthcare & Medical Devices'
  | 'Education & Skill Development'
  | 'Smart Infrastructure & Roads'
  | 'Disaster Management & Safety';

export interface ProblemAuthor {
  id: string;
  name: string;
  avatar: string;
  role: string;
  affiliation?: string;
  location: string;
  verified?: boolean;
}

export interface AIInsight {
  similarityCount: number;
  similarProblemIds: string[];
  requiredSkills: string[];
  matchedPeopleCount: number;
  confidenceScore: number;
  summary: string;
}

export interface Comment {
  id: string;
  author: ProblemAuthor;
  content: string;
  createdAt: string;
  likesCount: number;
  isLiked?: boolean;
  replies?: Comment[];
}

export interface Problem {
  id: string;
  title: string;
  description: string;
  category: ProblemCategory;
  impactLevel: ImpactLevel;
  status: ProblemStatus;
  location: string;
  district: string;
  state: string;
  author: ProblemAuthor;
  createdAt: string;
  images?: string[];
  tags: string[];
  
  // Social metrics
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  isLiked?: boolean;
  isSaved?: boolean;

  // Collaboration metrics
  activeTeamsCount: number;
  interestedUniversitiesCount: number;
  industrySponsorsCount: number;
  
  // AI metadata
  aiInsight?: AIInsight;

  // Comments preview
  comments?: Comment[];
}
