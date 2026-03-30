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

export type AdHocEventType =
  | 'safety-observation'
  | 'procedure-refresher'
  | 'tooling-equipment'
  | 'regulatory-briefing'
  | 'ojt-mentorship'
  | 'general'

export type AdHocStatus =
  | 'pending_tech_ack'
  | 'pending_witness_ack'
  | 'complete'
  | 'archived'

export interface MxlmsAdHocCompletion {
  id: number
  technician_id: number
  name: string
  category: string | null
  completed_date: string | null
  document_path: string | null
  notes: string | null
  created_at: string
  // event classification
  event_type: AdHocEventType
  description: string | null
  corrective_action: string | null
  severity: 'low' | 'medium' | 'high' | null
  requires_acknowledgment: boolean
  drive_url: string | null
  status: AdHocStatus
  // manager signature (captured at creation)
  initiated_by_user_id: string | null
  initiated_by_name: string | null
  initiated_by_email: string | null
  manager_signed_at: string | null
  manager_signature_hash: string | null
  // tech signature (captured when tech acknowledges)
  acknowledged_at: string | null        // tech_signed_at
  tech_signed_by_name: string | null
  tech_signed_by_email: string | null
  tech_signature_hash: string | null
  // witness / second manager
  witness_user_id: string | null
  witness_name: string | null
  witness_email: string | null
  witness_signed_at: string | null
  witness_signature_hash: string | null
}

export interface MxlmsAdHocInsert {
  technician_id: number
  name: string
  category?: string | null
  completed_date: string
  notes?: string | null
  event_type: AdHocEventType
  description?: string | null
  corrective_action?: string | null
  severity?: 'low' | 'medium' | 'high' | null
  requires_acknowledgment: boolean
  status: AdHocStatus
  // manager signature
  initiated_by_user_id?: string | null
  initiated_by_name?: string | null
  initiated_by_email?: string | null
  manager_signed_at?: string | null
  manager_signature_hash?: string | null
  // witness designation
  witness_user_id?: string | null
  witness_name?: string | null
  witness_email?: string | null
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
  drive_url: string | null
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

export interface MxlmsPendingTrainingItem {
  id: number
  name: string
  category: string
  subcategory: string | null
  training_authority: string
  priority: string
  type: string
  recurrence_interval: number
  regulatory_basis: string | null
  applies_to_roles: string | null
  estimated_hours: number | null
  description: string | null
  objectives: string | null
  passing_criteria: string | null
  owner: string | null
  revision_date: string | null
  revision_number: string | null
  tags: string | null
  links_json: string | null
  status: string
  proposed_by_user_id: string | null
  proposed_by_name: string | null
  proposed_at: string
  review_notes: string | null
  reviewed_at: string | null
}

export interface MxlmsPendingTrainingInsert {
  name: string
  category: string
  subcategory?: string | null
  training_authority?: string
  priority?: string
  type?: string
  recurrence_interval?: number
  regulatory_basis?: string | null
  applies_to_roles?: string | null
  estimated_hours?: number | null
  description?: string | null
  objectives?: string | null
  passing_criteria?: string | null
  owner?: string | null
  revision_date?: string | null
  revision_number?: string | null
  tags?: string | null
  links_json?: string | null
  proposed_by_user_id?: string
  proposed_by_name?: string
}

export interface MxlmsPendingInsert {
  technician_id: number
  storage_path: string
  storage_url: string
  file_name: string
  status?: string
  matched_training_item_id?: number | null
}
