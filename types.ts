
export enum Priority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface Task {
  title: string;
  priority: Priority;
  timeEstimation: string;
  category: string;
}

export interface ChaosAnalysis {
  entropyScore: number;
  summary: string;
  tasks: Task[];
  topInsights: string[];
  suggestedFocus: string;
  categories: { name: string; weight: number }[];
}

export interface ChaosEntry {
  id: string;
  timestamp: number;
  content: string;
  analysis?: ChaosAnalysis;
  status: 'pending' | 'processing' | 'completed' | 'error';
}

export interface Bookmark {
  id: string;
  path: string;
  driveName: string;
  comment: string;
  timestamp: number;
  tags: string[];
  nodeName: string;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  path: string;
}

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  children: (FolderNode | FileMetadata)[];
  isProject?: boolean;
  projectType?: string;
  duplicateProbability?: number;
  entropy?: number;
  rescuePlan?: string;
}

export interface CompareResult {
  matchScore: number;
  diffSummary: string;
  uniqueToA: string[];
  uniqueToB: string[];
  recommendation: string;
}
