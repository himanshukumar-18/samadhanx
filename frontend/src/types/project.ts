export type ProjectStage = 'RESEARCH' | 'DESIGN' | 'BUILD' | 'TEST' | 'PILOT' | 'DEPLOYED';

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  assigneeName?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
}

export interface RoadmapMilestone {
  id: string;
  title: string;
  dueDate: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING';
  description: string;
}

export interface ImpactMetric {
  label: string;
  value: string | number;
  unit?: string;
  changePercent?: string;
}

export interface Project {
  id: string;
  teamId: string;
  problemId: string;
  title: string;
  problemTitle: string;
  stage: ProjectStage;
  tasks: KanbanTask[];
  milestones: RoadmapMilestone[];
  impactMetrics: ImpactMetric[];
  deliverablesCount: number;
  lastActivity: string;
  aiMentorSuggestion?: string;
  industryFeedback?: string;
}
