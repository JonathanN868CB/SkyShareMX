// Types for the mxlms Postgres schema
// These are read-only from the web client; all writes happen through MX-LMS desktop app
// except: pending_completions (INSERT) and technician_journal (INSERT)

export interface MxlmsTechnician {
  id: number
  name: string
  role: string | null
  hire_date: string | null
  status: string
  email: string | null
  location: string | null
  role_type: string | null
  employment_status: string
  tech_code: string | null
  created_at: string
}

export interface MxlmsTrainingItem {
  id: number
  name: string
  category: string | null
  type: string
  recurrence_interval: number | null
  status: string
  description: string | null
  owner: string | null
  revision_date: string | null
  material_url: string | null
}

export interface MxlmsTrainingItemLink {
  id: number
  training_item_id: number
  label: string
  url: string
}

export interface MxlmsTechnicianTraining {
  id: number
  technician_id: number
  training_item_id: number
  status: string
  due_date: string | null
  completed_date: string | null
  document_path: string | null
  form_url: string | null
  created_at: string
  // joined
  training_item?: MxlmsTrainingItem
}

export interface MxlmsTrainingCompletion {
  id: number
  technician_id: number
  training_item_id: number
  completed_date: string | null
  document_path: string | null
  notes: string | null
  drive_url: string | null
  review_status: string | null
  quality_rating: number | null
  superseded: boolean
  created_at: string
  // joined
  training_item?: MxlmsTrainingItem
}

export interface MxlmsAdHocCompletion {
  id: number
  technician_id: number
  name: string
  category: string | null
  completed_date: string | null
  document_path: string | null
  notes: string | null
  created_at: string
}

export interface MxlmsPendingCompletion {
  id: number
  technician_id: number
  storage_path: string | null
  storage_url: string | null
  file_name: string | null
  detected_at: string
  status: string
  matched_training_item_id: number | null
  quality_rating: number | null
  review_notes: string | null
  reviewed_at: string | null
}

export interface MxlmsSession {
  id: number
  technician_id: number
  session_number: number | null
  session_year: number | null
  status: string
  conducted_date: string | null
  scheduled_date: string | null
  notes: string | null
  wins: string | null
  concerns: string | null
  behavioral_observations: string | null
  technician_voice: string | null
  supervisor_notes: string | null
  session_notes: string | null
  manager_recommendations: string | null
  next_quarter_focus: string | null
  end_summary: string | null
  employee_acknowledged_at: string | null
  created_at: string
}

export interface MxlmsGoal {
  id: number
  technician_id: number
  title: string
  why_it_matters: string | null
  target_timing: string | null
  success_criteria: string | null
  status: string
  closed_date: string | null
  close_note: string | null
  origin_session_id: number | null
  created_at: string
}

export interface MxlmsActionItem {
  id: number
  technician_id: number
  session_id: number | null
  description: string
  owner: string
  due_date: string | null
  status: string
  date_closed: string | null
  close_note: string | null
  related_topic: string | null
  created_at: string
}

export interface MxlmsCareerInterests {
  id: number
  technician_id: number
  specialty_interests: string | null
  leadership_interests: string | null
  role_progression: string | null
  updated_at: string
}

export interface MxlmsJournalEntry {
  id: number
  technician_id: number
  author_user_id: string
  entry_date: string
  entry_type: string
  content: string
  visible_to_manager: boolean
  session_id: number | null
  created_at: string
}

export interface MxlmsJournalInsert {
  technician_id: number
  author_user_id: string
  entry_date: string
  entry_type?: string
  content: string
  visible_to_manager?: boolean
}

export interface MxlmsPendingInsert {
  technician_id: number
  storage_path: string
  storage_url: string
  file_name: string
  status?: string
}
