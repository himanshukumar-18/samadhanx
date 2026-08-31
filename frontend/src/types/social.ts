export interface SuggestedPerson {
  id: string;
  name: string;
  avatar: string;
  role: string;
  affiliation: string;
  matchScore: number;
  matchingSkills: string[];
  isFollowing?: boolean;
}

export interface TrendingChallenge {
  id: string;
  title: string;
  category: string;
  district: string;
  teamsCount: number;
  impact: string;
}

export type FeedTab = 'FOR_YOU' | 'TRENDING' | 'NEARBY' | 'RESOLVED' | 'MY_SECTOR' | 'ALL';
