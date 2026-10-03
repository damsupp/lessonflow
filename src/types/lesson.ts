export type PedagogicalModelId =
  | '5e_inquiry'
  | 'gradual_release'
  | 'workshop_seminar'
  | 'lab_investigation';

export const STANDARD_SUBJECTS = [
  'Science: Biology & Life Sciences',
  'Science: Chemistry & Physical Sciences',
  'Science: Earth & Environmental Science',
  'Science: Physics & Engineering',
  'Mathematics: Algebra & Functions',
  'Mathematics: Geometry & Measurement',
  'Mathematics: Statistics & Probability',
  'Mathematics: Elementary & Middle Math',
  'English Language Arts & Literature',
  'Social Studies: World History',
  'Social Studies: US History & Civics',
  'Social Studies: Geography & Global Cultures',
  'World Languages & Linguistics',
  'Computer Science & Information Tech',
  'Visual Arts & Digital Design',
  'Performing Arts: Music & Theater',
  'Health & Physical Education',
  'Special Education & Life Skills',
  'Interdisciplinary / Custom Subject',
] as const;

export type StandardSubject = (typeof STANDARD_SUBJECTS)[number];

export interface LessonSection {
  id: string;
  index: number;
  phaseName: string;
  minutes: number;
  weight: number;
  learningObjective: string;
  instructionalActivities: string;
  formativeCheck: string;
}

export interface LessonPlan {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  date: string;
  totalMinutes: number;
  modelId: PedagogicalModelId;
  standardCode: string;
  essentialQuestion: string;
  materials: string;
  sections: LessonSection[];
  updatedAt: string;
}

export interface CloudBackupSnapshot {
  id: string;
  planId: string;
  planTitle: string;
  totalMinutes: number;
  sectionCount: number;
  checksum: string;
  encryptionMode: 'AES-256-GCM' | 'SHA-256-Verified';
  syncedAt: string;
  status: 'synced' | 'queued-offline';
  payload: LessonPlan;
}
