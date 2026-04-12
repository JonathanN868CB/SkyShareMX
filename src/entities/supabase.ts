export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          company: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          reason: string | null
          status: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          reason?: string | null
          status?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          reason?: string | null
          status?: string
        }
        Relationships: []
      }
      aircraft: {
        Row: {
          client_id: string | null
          created_at: string
          engine_manufacturer: string | null
          engine_model: string | null
          has_apu: boolean
          has_prop: boolean
          id: string
          is_twin: boolean
          make: string
          model_family: string
          model_full: string
          serial_number: string
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          engine_manufacturer?: string | null
          engine_model?: string | null
          has_apu?: boolean
          has_prop?: boolean
          id?: string
          is_twin?: boolean
          make: string
          model_family: string
          model_full: string
          serial_number: string
          status?: string
          updated_at?: string
          year: number
        }
        Update: {
          client_id?: string | null
          created_at?: string
          engine_manufacturer?: string | null
          engine_model?: string | null
          has_apu?: boolean
          has_prop?: boolean
          id?: string
          is_twin?: boolean
          make?: string
          model_family?: string
          model_full?: string
          serial_number?: string
          status?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      aircraft_details: {
        Row: {
          aircraft_id: string | null
          apu: Json | null
          avionics: Json
          cmms: Json
          documentation: Json
          hobbs_differential: number | null
          identity: Json
          nav_subscriptions: Json
          notes: string
          powerplant: Json
          programs: Json
          tail_number: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aircraft_id?: string | null
          apu?: Json | null
          avionics?: Json
          cmms?: Json
          documentation?: Json
          hobbs_differential?: number | null
          identity?: Json
          nav_subscriptions?: Json
          notes?: string
          powerplant?: Json
          programs?: Json
          tail_number: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aircraft_id?: string | null
          apu?: Json | null
          avionics?: Json
          cmms?: Json
          documentation?: Json
          hobbs_differential?: number | null
          identity?: Json
          nav_subscriptions?: Json
          notes?: string
          powerplant?: Json
          programs?: Json
          tail_number?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_details_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aircraft_details_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      aircraft_photo_ratings: {
        Row: {
          profile_id: string
          rated_at: string
          rating: number
          tail_number: string
        }
        Insert: {
          profile_id: string
          rated_at?: string
          rating: number
          tail_number: string
        }
        Update: {
          profile_id?: string
          rated_at?: string
          rating?: number
          tail_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_photo_ratings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aircraft_photos: {
        Row: {
          photo_url: string
          photographer_name: string
          storage_path: string
          tail_number: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          photo_url: string
          photographer_name: string
          storage_path: string
          tail_number: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          photo_url?: string
          photographer_name?: string
          storage_path?: string
          tail_number?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      aircraft_registrations: {
        Row: {
          aircraft_id: string
          created_at: string
          id: string
          is_current: boolean
          registration: string
          source_note: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          aircraft_id: string
          created_at?: string
          id?: string
          is_current?: boolean
          registration: string
          source_note?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          aircraft_id?: string
          created_at?: string
          id?: string
          is_current?: boolean
          registration?: string
          source_note?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aircraft_registrations_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_approval_item_decisions: {
        Row: {
          approval_request_id: string
          decided_at: string
          decision: Database["public"]["Enums"]["bb_item_approval_status"]
          id: string
          wo_item_id: string
        }
        Insert: {
          approval_request_id: string
          decided_at?: string
          decision: Database["public"]["Enums"]["bb_item_approval_status"]
          id?: string
          wo_item_id: string
        }
        Update: {
          approval_request_id?: string
          decided_at?: string
          decision?: Database["public"]["Enums"]["bb_item_approval_status"]
          id?: string
          wo_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_approval_item_decisions_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "bb_approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_approval_item_decisions_wo_item_id_fkey"
            columns: ["wo_item_id"]
            isOneToOne: false
            referencedRelation: "bb_work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_approval_requests: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          kind: Database["public"]["Enums"]["bb_approval_kind"]
          recipient_email: string
          recipient_name: string
          sent_at: string
          sent_by: string | null
          snapshot_payload: Json
          snapshot_total: number
          status: string
          submitted_at: string | null
          token: string
          unsigned_pdf_path: string | null
          updated_at: string
          user_id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["bb_approval_kind"]
          recipient_email: string
          recipient_name: string
          sent_at?: string
          sent_by?: string | null
          snapshot_payload?: Json
          snapshot_total?: number
          status?: string
          submitted_at?: string | null
          token?: string
          unsigned_pdf_path?: string | null
          updated_at?: string
          user_id: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["bb_approval_kind"]
          recipient_email?: string
          recipient_name?: string
          sent_at?: string
          sent_by?: string | null
          snapshot_payload?: Json
          snapshot_total?: number
          status?: string
          submitted_at?: string | null
          token?: string
          unsigned_pdf_path?: string | null
          updated_at?: string
          user_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_approval_requests_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_approval_requests_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "bb_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_approval_submissions: {
        Row: {
          approval_request_id: string
          id: string
          signature_hash: string
          signature_image_path: string
          signed_pdf_path: string | null
          signer_email: string
          signer_name: string
          signer_title: string | null
          submitted_at: string
          submitter_ip: string | null
          user_agent: string | null
        }
        Insert: {
          approval_request_id: string
          id?: string
          signature_hash: string
          signature_image_path: string
          signed_pdf_path?: string | null
          signer_email: string
          signer_name: string
          signer_title?: string | null
          submitted_at?: string
          submitter_ip?: string | null
          user_agent?: string | null
        }
        Update: {
          approval_request_id?: string
          id?: string
          signature_hash?: string
          signature_image_path?: string
          signed_pdf_path?: string | null
          signer_email?: string
          signer_name?: string
          signer_title?: string | null
          submitted_at?: string
          submitter_ip?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_approval_submissions_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: true
            referencedRelation: "bb_approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_calibration_records: {
        Row: {
          calibrated_at: string
          calibrated_by: string | null
          calibrated_by_name: string
          certificate_number: string | null
          created_at: string
          id: string
          next_due: string
          notes: string | null
          tool_id: string
        }
        Insert: {
          calibrated_at: string
          calibrated_by?: string | null
          calibrated_by_name?: string
          certificate_number?: string | null
          created_at?: string
          id?: string
          next_due: string
          notes?: string | null
          tool_id: string
        }
        Update: {
          calibrated_at?: string
          calibrated_by?: string | null
          calibrated_by_name?: string
          certificate_number?: string | null
          created_at?: string
          id?: string
          next_due?: string
          notes?: string | null
          tool_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_calibration_records_calibrated_by_fkey"
            columns: ["calibrated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_calibration_records_tool_id_fkey"
            columns: ["tool_id"]
            isOneToOne: false
            referencedRelation: "bb_tools"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_inventory_parts: {
        Row: {
          catalog_id: string | null
          condition: Database["public"]["Enums"]["bb_part_condition"]
          created_at: string
          description: string
          id: string
          is_consumable: boolean
          location_bin: string | null
          manufacturer: string | null
          notes: string | null
          part_number: string
          qty_on_hand: number
          qty_reserved: number
          reorder_point: number
          unit_cost: number
          uom: string
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          catalog_id?: string | null
          condition?: Database["public"]["Enums"]["bb_part_condition"]
          created_at?: string
          description?: string
          id?: string
          is_consumable?: boolean
          location_bin?: string | null
          manufacturer?: string | null
          notes?: string | null
          part_number: string
          qty_on_hand?: number
          qty_reserved?: number
          reorder_point?: number
          unit_cost?: number
          uom?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          catalog_id?: string | null
          condition?: Database["public"]["Enums"]["bb_part_condition"]
          created_at?: string
          description?: string
          id?: string
          is_consumable?: boolean
          location_bin?: string | null
          manufacturer?: string | null
          notes?: string | null
          part_number?: string
          qty_on_hand?: number
          qty_reserved?: number
          reorder_point?: number
          unit_cost?: number
          uom?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_inventory_parts_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "parts_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_invoice_lines: {
        Row: {
          created_at: string
          description: string
          extended: number | null
          id: string
          invoice_id: string
          line_number: number
          qty: number
          taxable: boolean
          type: Database["public"]["Enums"]["bb_invoice_line_type"]
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string
          extended?: number | null
          id?: string
          invoice_id: string
          line_number: number
          qty?: number
          taxable?: boolean
          type?: Database["public"]["Enums"]["bb_invoice_line_type"]
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          extended?: number | null
          id?: string
          invoice_id?: string
          line_number?: number
          qty?: number
          taxable?: boolean
          type?: Database["public"]["Enums"]["bb_invoice_line_type"]
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bb_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "bb_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_invoices: {
        Row: {
          aircraft_id: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          due_date: string | null
          grand_total: number
          guest_registration: string | null
          id: string
          invoice_number: string
          issued_date: string
          notes: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["bb_invoice_status"]
          subtotal_labor: number
          subtotal_misc: number
          subtotal_parts: number
          tax_amount: number
          tax_rate: number
          updated_at: string
          wo_number: string | null
          work_order_id: string | null
        }
        Insert: {
          aircraft_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          due_date?: string | null
          grand_total?: number
          guest_registration?: string | null
          id?: string
          invoice_number: string
          issued_date?: string
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["bb_invoice_status"]
          subtotal_labor?: number
          subtotal_misc?: number
          subtotal_parts?: number
          tax_amount?: number
          tax_rate?: number
          updated_at?: string
          wo_number?: string | null
          work_order_id?: string | null
        }
        Update: {
          aircraft_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          due_date?: string | null
          grand_total?: number
          guest_registration?: string | null
          id?: string
          invoice_number?: string
          issued_date?: string
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["bb_invoice_status"]
          subtotal_labor?: number
          subtotal_misc?: number
          subtotal_parts?: number
          tax_amount?: number
          tax_rate?: number
          updated_at?: string
          wo_number?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_invoices_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_invoices_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "bb_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_library_corrective_actions: {
        Row: {
          aircraft_model: string
          corrective_action_text: string
          created_at: string | null
          created_by_name: string | null
          id: string
          ref_code: string
        }
        Insert: {
          aircraft_model: string
          corrective_action_text: string
          created_at?: string | null
          created_by_name?: string | null
          id?: string
          ref_code: string
        }
        Update: {
          aircraft_model?: string
          corrective_action_text?: string
          created_at?: string | null
          created_by_name?: string | null
          id?: string
          ref_code?: string
        }
        Relationships: []
      }
      bb_library_flat_rates: {
        Row: {
          aircraft_model: string
          created_at: string | null
          created_by_name: string | null
          description: string | null
          hours: number
          id: string
          labor_rate: number
          ref_code: string
        }
        Insert: {
          aircraft_model: string
          created_at?: string | null
          created_by_name?: string | null
          description?: string | null
          hours: number
          id?: string
          labor_rate?: number
          ref_code: string
        }
        Update: {
          aircraft_model?: string
          created_at?: string | null
          created_by_name?: string | null
          description?: string | null
          hours?: number
          id?: string
          labor_rate?: number
          ref_code?: string
        }
        Relationships: []
      }
      bb_logbook_entries: {
        Row: {
          aircraft_id: string | null
          certificate_number: string
          certificate_type: Database["public"]["Enums"]["bb_cert_type"]
          created_at: string
          entry_date: string
          entry_number: string
          guest_registration: string | null
          guest_serial: string | null
          hobbs: number | null
          hobbs_new: number | null
          id: string
          inspector_cert: string | null
          inspector_id: string | null
          inspector_name: string | null
          is_ria: boolean
          landings: number | null
          landings_new: number | null
          logbook_section: Database["public"]["Enums"]["bb_logbook_section"]
          mechanic_id: string | null
          mechanic_name: string
          return_to_service: string
          section_title: string
          signed_at: string | null
          status: Database["public"]["Enums"]["bb_logbook_entry_status"]
          total_aircraft_time: number | null
          total_aircraft_time_new: number | null
          updated_at: string
          wo_number: string | null
          work_order_id: string | null
        }
        Insert: {
          aircraft_id?: string | null
          certificate_number?: string
          certificate_type?: Database["public"]["Enums"]["bb_cert_type"]
          created_at?: string
          entry_date?: string
          entry_number: string
          guest_registration?: string | null
          guest_serial?: string | null
          hobbs?: number | null
          hobbs_new?: number | null
          id?: string
          inspector_cert?: string | null
          inspector_id?: string | null
          inspector_name?: string | null
          is_ria?: boolean
          landings?: number | null
          landings_new?: number | null
          logbook_section?: Database["public"]["Enums"]["bb_logbook_section"]
          mechanic_id?: string | null
          mechanic_name?: string
          return_to_service?: string
          section_title?: string
          signed_at?: string | null
          status?: Database["public"]["Enums"]["bb_logbook_entry_status"]
          total_aircraft_time?: number | null
          total_aircraft_time_new?: number | null
          updated_at?: string
          wo_number?: string | null
          work_order_id?: string | null
        }
        Update: {
          aircraft_id?: string | null
          certificate_number?: string
          certificate_type?: Database["public"]["Enums"]["bb_cert_type"]
          created_at?: string
          entry_date?: string
          entry_number?: string
          guest_registration?: string | null
          guest_serial?: string | null
          hobbs?: number | null
          hobbs_new?: number | null
          id?: string
          inspector_cert?: string | null
          inspector_id?: string | null
          inspector_name?: string | null
          is_ria?: boolean
          landings?: number | null
          landings_new?: number | null
          logbook_section?: Database["public"]["Enums"]["bb_logbook_section"]
          mechanic_id?: string | null
          mechanic_name?: string
          return_to_service?: string
          section_title?: string
          signed_at?: string | null
          status?: Database["public"]["Enums"]["bb_logbook_entry_status"]
          total_aircraft_time?: number | null
          total_aircraft_time_new?: number | null
          updated_at?: string
          wo_number?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_logbook_entries_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_logbook_entries_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_logbook_entries_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_logbook_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "bb_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_logbook_entry_lines: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          line_number: number
          ref_code: string
          signatory_id: string | null
          text: string
          wo_item_id: string | null
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          line_number: number
          ref_code?: string
          signatory_id?: string | null
          text?: string
          wo_item_id?: string | null
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          line_number?: number
          ref_code?: string
          signatory_id?: string | null
          text?: string
          wo_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_logbook_entry_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "bb_logbook_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_logbook_entry_lines_signatory_id_fkey"
            columns: ["signatory_id"]
            isOneToOne: false
            referencedRelation: "bb_logbook_entry_signatories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_logbook_entry_lines_wo_item_id_fkey"
            columns: ["wo_item_id"]
            isOneToOne: false
            referencedRelation: "bb_work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_logbook_entry_signatories: {
        Row: {
          cert_number: string | null
          cert_type: Database["public"]["Enums"]["bb_cert_type"] | null
          created_at: string
          entry_id: string
          id: string
          mechanic_name: string
          profile_id: string | null
          sort_order: number
        }
        Insert: {
          cert_number?: string | null
          cert_type?: Database["public"]["Enums"]["bb_cert_type"] | null
          created_at?: string
          entry_id: string
          id?: string
          mechanic_name: string
          profile_id?: string | null
          sort_order?: number
        }
        Update: {
          cert_number?: string | null
          cert_type?: Database["public"]["Enums"]["bb_cert_type"] | null
          created_at?: string
          entry_id?: string
          id?: string
          mechanic_name?: string
          profile_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bb_logbook_entry_signatories_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "bb_logbook_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_logbook_entry_signatories_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_mechanic_certs: {
        Row: {
          cert_number: string
          cert_type: Database["public"]["Enums"]["bb_cert_type"]
          created_at: string
          id: string
          is_primary: boolean
          issued_date: string | null
          notes: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          cert_number: string
          cert_type: Database["public"]["Enums"]["bb_cert_type"]
          created_at?: string
          id?: string
          is_primary?: boolean
          issued_date?: string | null
          notes?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          cert_number?: string
          cert_type?: Database["public"]["Enums"]["bb_cert_type"]
          created_at?: string
          id?: string
          is_primary?: boolean
          issued_date?: string | null
          notes?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_mechanic_certs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_part_transactions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          part_id: string
          performed_by: string | null
          performed_name: string
          po_ref: string | null
          qty: number
          transaction_date: string
          type: Database["public"]["Enums"]["bb_part_transaction_type"]
          unit_cost: number | null
          wo_ref: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          part_id: string
          performed_by?: string | null
          performed_name?: string
          po_ref?: string | null
          qty: number
          transaction_date?: string
          type: Database["public"]["Enums"]["bb_part_transaction_type"]
          unit_cost?: number | null
          wo_ref?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          part_id?: string
          performed_by?: string | null
          performed_name?: string
          po_ref?: string | null
          qty?: number
          transaction_date?: string
          type?: Database["public"]["Enums"]["bb_part_transaction_type"]
          unit_cost?: number | null
          wo_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_part_transactions_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "bb_inventory_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_part_transactions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_parts_suppliers: {
        Row: {
          account_number: string | null
          active: boolean
          approval_date: string | null
          approval_status: string
          certificate_number: string | null
          certificate_type: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          last_audit_date: string | null
          name: string
          notes: string | null
          phone: string | null
          traceability_verified: boolean
          updated_at: string
          vendor_type: string
          website: string | null
        }
        Insert: {
          account_number?: string | null
          active?: boolean
          approval_date?: string | null
          approval_status?: string
          certificate_number?: string | null
          certificate_type?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_audit_date?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          traceability_verified?: boolean
          updated_at?: string
          vendor_type?: string
          website?: string | null
        }
        Update: {
          account_number?: string | null
          active?: boolean
          approval_date?: string | null
          approval_status?: string
          certificate_number?: string | null
          certificate_type?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_audit_date?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          traceability_verified?: boolean
          updated_at?: string
          vendor_type?: string
          website?: string | null
        }
        Relationships: []
      }
      bb_po_activity: {
        Row: {
          author_id: string | null
          author_name: string
          created_at: string
          id: string
          message: string
          purchase_order_id: string
          type: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          created_at?: string
          id?: string
          message: string
          purchase_order_id: string
          type?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          created_at?: string
          id?: string
          message?: string
          purchase_order_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_po_activity_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_po_activity_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "bb_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_po_invoices: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_date: string | null
          invoice_number: string
          match_status: string
          notes: string | null
          purchase_order_id: string
          received_at: string
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_number: string
          match_status?: string
          notes?: string | null
          purchase_order_id: string
          received_at?: string
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string
          match_status?: string
          notes?: string | null
          purchase_order_id?: string
          received_at?: string
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_po_invoices_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "bb_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_po_invoices_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_purchase_order_lines: {
        Row: {
          catalog_id: string | null
          created_at: string
          description: string
          id: string
          line_expected_delivery: string | null
          line_notes: string | null
          line_number: number
          line_status: Database["public"]["Enums"]["bb_po_line_status"]
          part_number: string
          parts_request_line_id: string | null
          purchase_order_id: string
          qty_ordered: number
          qty_received: number
          unit_cost: number
          updated_at: string
          vendor_part_number: string | null
          wo_ref: string | null
        }
        Insert: {
          catalog_id?: string | null
          created_at?: string
          description?: string
          id?: string
          line_expected_delivery?: string | null
          line_notes?: string | null
          line_number: number
          line_status?: Database["public"]["Enums"]["bb_po_line_status"]
          part_number: string
          parts_request_line_id?: string | null
          purchase_order_id: string
          qty_ordered?: number
          qty_received?: number
          unit_cost?: number
          updated_at?: string
          vendor_part_number?: string | null
          wo_ref?: string | null
        }
        Update: {
          catalog_id?: string | null
          created_at?: string
          description?: string
          id?: string
          line_expected_delivery?: string | null
          line_notes?: string | null
          line_number?: number
          line_status?: Database["public"]["Enums"]["bb_po_line_status"]
          part_number?: string
          parts_request_line_id?: string | null
          purchase_order_id?: string
          qty_ordered?: number
          qty_received?: number
          unit_cost?: number
          updated_at?: string
          vendor_part_number?: string | null
          wo_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_purchase_order_lines_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "parts_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_purchase_order_lines_parts_request_line_id_fkey"
            columns: ["parts_request_line_id"]
            isOneToOne: false
            referencedRelation: "parts_request_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "bb_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_purchase_orders: {
        Row: {
          archived_at: string | null
          carrier: string | null
          created_at: string
          created_by: string | null
          expected_delivery: string | null
          id: string
          notes: string | null
          po_number: string
          received_at: string | null
          status: Database["public"]["Enums"]["bb_po_status"]
          tracking_number: string | null
          tracking_status: string | null
          tracking_updated_at: string | null
          updated_at: string
          vendor_contact: string | null
          vendor_id: string | null
          vendor_name: string
        }
        Insert: {
          archived_at?: string | null
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          po_number: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["bb_po_status"]
          tracking_number?: string | null
          tracking_status?: string | null
          tracking_updated_at?: string | null
          updated_at?: string
          vendor_contact?: string | null
          vendor_id?: string | null
          vendor_name: string
        }
        Update: {
          archived_at?: string | null
          carrier?: string | null
          created_at?: string
          created_by?: string | null
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          po_number?: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["bb_po_status"]
          tracking_number?: string | null
          tracking_status?: string | null
          tracking_updated_at?: string | null
          updated_at?: string
          vendor_contact?: string | null
          vendor_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_receiving_records: {
        Row: {
          batch_lot: string | null
          catalog_id: string | null
          certificate_type: string
          certifying_agency: string | null
          condition: Database["public"]["Enums"]["bb_part_condition"]
          created_at: string
          id: string
          inspection_status: string
          location_bin: string | null
          notes: string | null
          part_number: string
          po_line_id: string
          purchase_order_id: string | null
          qty_received: number
          received_at: string
          received_by: string | null
          received_by_name: string
          serial_number: string | null
          tag_date: string | null
          tag_number: string | null
        }
        Insert: {
          batch_lot?: string | null
          catalog_id?: string | null
          certificate_type?: string
          certifying_agency?: string | null
          condition?: Database["public"]["Enums"]["bb_part_condition"]
          created_at?: string
          id?: string
          inspection_status?: string
          location_bin?: string | null
          notes?: string | null
          part_number: string
          po_line_id: string
          purchase_order_id?: string | null
          qty_received?: number
          received_at?: string
          received_by?: string | null
          received_by_name?: string
          serial_number?: string | null
          tag_date?: string | null
          tag_number?: string | null
        }
        Update: {
          batch_lot?: string | null
          catalog_id?: string | null
          certificate_type?: string
          certifying_agency?: string | null
          condition?: Database["public"]["Enums"]["bb_part_condition"]
          created_at?: string
          id?: string
          inspection_status?: string
          location_bin?: string | null
          notes?: string | null
          part_number?: string
          po_line_id?: string
          purchase_order_id?: string | null
          qty_received?: number
          received_at?: string
          received_by?: string | null
          received_by_name?: string
          serial_number?: string | null
          tag_date?: string | null
          tag_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_receiving_records_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "parts_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_receiving_records_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "bb_purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_receiving_records_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "bb_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_receiving_records_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bb_sop_related: {
        Row: {
          related_sop_id: string
          sop_id: string
        }
        Insert: {
          related_sop_id: string
          sop_id: string
        }
        Update: {
          related_sop_id?: string
          sop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_sop_related_related_sop_id_fkey"
            columns: ["related_sop_id"]
            isOneToOne: false
            referencedRelation: "bb_sops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_sop_related_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "bb_sops"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_sop_steps: {
        Row: {
          created_at: string
          id: string
          instruction: string
          note: string | null
          sop_id: string
          step_number: number
          warning: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instruction?: string
          note?: string | null
          sop_id: string
          step_number: number
          warning?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instruction?: string
          note?: string | null
          sop_id?: string
          step_number?: number
          warning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_sop_steps_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "bb_sops"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_sops: {
        Row: {
          approved_by: string | null
          author: string | null
          category: Database["public"]["Enums"]["bb_sop_category"]
          created_at: string
          description: string
          effective_date: string | null
          id: string
          review_date: string | null
          revision: string
          sop_number: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          author?: string | null
          category: Database["public"]["Enums"]["bb_sop_category"]
          created_at?: string
          description?: string
          effective_date?: string | null
          id?: string
          review_date?: string | null
          revision?: string
          sop_number: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          author?: string | null
          category?: Database["public"]["Enums"]["bb_sop_category"]
          created_at?: string
          description?: string
          effective_date?: string | null
          id?: string
          review_date?: string | null
          revision?: string
          sop_number?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bb_tools: {
        Row: {
          calibration_interval_days: number
          calibration_vendor: string | null
          created_at: string
          description: string
          id: string
          last_calibrated_at: string | null
          location: string | null
          manufacturer: string | null
          next_calibration_due: string | null
          notes: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["bb_tool_status"]
          tool_number: string
          updated_at: string
        }
        Insert: {
          calibration_interval_days?: number
          calibration_vendor?: string | null
          created_at?: string
          description: string
          id?: string
          last_calibrated_at?: string | null
          location?: string | null
          manufacturer?: string | null
          next_calibration_due?: string | null
          notes?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["bb_tool_status"]
          tool_number: string
          updated_at?: string
        }
        Update: {
          calibration_interval_days?: number
          calibration_vendor?: string | null
          created_at?: string
          description?: string
          id?: string
          last_calibrated_at?: string | null
          location?: string | null
          manufacturer?: string | null
          next_calibration_due?: string | null
          notes?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["bb_tool_status"]
          tool_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      bb_training_records: {
        Row: {
          certificate_number: string | null
          created_at: string
          expiry_date: string | null
          id: string
          issued_date: string
          issuer: string
          mechanic_id: string
          notes: string | null
          status: Database["public"]["Enums"]["bb_training_status"]
          training_type: string
          updated_at: string
        }
        Insert: {
          certificate_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issued_date: string
          issuer?: string
          mechanic_id: string
          notes?: string | null
          status?: Database["public"]["Enums"]["bb_training_status"]
          training_type: string
          updated_at?: string
        }
        Update: {
          certificate_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          issued_date?: string
          issuer?: string
          mechanic_id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["bb_training_status"]
          training_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_training_records_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_wo_item_attachments: {
        Row: {
          file_name: string
          file_size_bytes: number | null
          id: string
          kind: string
          mime_type: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
          wo_item_id: string
          work_order_id: string
        }
        Insert: {
          file_name: string
          file_size_bytes?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
          wo_item_id: string
          work_order_id: string
        }
        Update: {
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
          wo_item_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_wo_item_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_wo_item_attachments_wo_item_id_fkey"
            columns: ["wo_item_id"]
            isOneToOne: false
            referencedRelation: "bb_work_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_wo_item_attachments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "bb_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_wo_item_sops: {
        Row: {
          id: string
          item_id: string
          linked_at: string
          linked_by: string | null
          notes: string | null
          sop_id: string
        }
        Insert: {
          id?: string
          item_id: string
          linked_at?: string
          linked_by?: string | null
          notes?: string | null
          sop_id: string
        }
        Update: {
          id?: string
          item_id?: string
          linked_at?: string
          linked_by?: string | null
          notes?: string | null
          sop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_wo_item_sops_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "bb_work_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_wo_item_sops_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_wo_item_sops_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "bb_sops"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_work_order_audit_trail: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          detail: string | null
          entry_type: string
          field_name: string | null
          id: string
          item_id: string | null
          item_number: number | null
          new_value: string | null
          old_value: string | null
          summary: string
          work_order_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: string | null
          entry_type: string
          field_name?: string | null
          id?: string
          item_id?: string | null
          item_number?: number | null
          new_value?: string | null
          old_value?: string | null
          summary: string
          work_order_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          detail?: string | null
          entry_type?: string
          field_name?: string | null
          id?: string
          item_id?: string | null
          item_number?: number | null
          new_value?: string | null
          old_value?: string | null
          summary?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_work_order_audit_trail_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_order_audit_trail_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "bb_work_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_order_audit_trail_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "bb_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_work_order_item_labor: {
        Row: {
          billable: boolean
          clocked_at: string
          created_at: string
          description: string | null
          hours: number
          id: string
          item_id: string
          mechanic_id: string | null
          mechanic_name: string
          work_order_id: string
        }
        Insert: {
          billable?: boolean
          clocked_at?: string
          created_at?: string
          description?: string | null
          hours: number
          id?: string
          item_id: string
          mechanic_id?: string | null
          mechanic_name: string
          work_order_id: string
        }
        Update: {
          billable?: boolean
          clocked_at?: string
          created_at?: string
          description?: string | null
          hours?: number
          id?: string
          item_id?: string
          mechanic_id?: string | null
          mechanic_name?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_work_order_item_labor_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "bb_work_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_order_item_labor_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_order_item_labor_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "bb_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_work_order_item_parts: {
        Row: {
          catalog_id: string | null
          condition: string | null
          created_at: string
          description: string
          id: string
          inventory_part_id: string | null
          item_id: string
          part_number: string
          qty: number
          serial_number: string | null
          unit_price: number
        }
        Insert: {
          catalog_id?: string | null
          condition?: string | null
          created_at?: string
          description?: string
          id?: string
          inventory_part_id?: string | null
          item_id: string
          part_number: string
          qty?: number
          serial_number?: string | null
          unit_price?: number
        }
        Update: {
          catalog_id?: string | null
          condition?: string | null
          created_at?: string
          description?: string
          id?: string
          inventory_part_id?: string | null
          item_id?: string
          part_number?: string
          qty?: number
          serial_number?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bb_work_order_item_parts_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "parts_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_order_item_parts_inventory_part_id_fkey"
            columns: ["inventory_part_id"]
            isOneToOne: false
            referencedRelation: "bb_inventory_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_order_item_parts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "bb_work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_work_order_items: {
        Row: {
          category: string
          corrective_action: string
          created_at: string
          customer_approval_status: Database["public"]["Enums"]["bb_item_approval_status"]
          customer_decision_at: string | null
          discrepancy: string
          discrepancy_type: string | null
          estimated_hours: number
          id: string
          item_number: number
          item_status: Database["public"]["Enums"]["bb_wo_item_status"]
          labor_rate: number
          logbook_section: Database["public"]["Enums"]["bb_logbook_section"]
          mechanic_id: string | null
          no_parts_required: boolean
          outside_services_cost: number
          parent_item_id: string | null
          part_number: string | null
          ref_code: string
          serial_number: string | null
          shipping_cost: number
          sign_off_required: boolean
          signed_off_at: string | null
          signed_off_by: string | null
          task_number: string | null
          updated_at: string
          work_order_id: string
        }
        Insert: {
          category: string
          corrective_action?: string
          created_at?: string
          customer_approval_status?: Database["public"]["Enums"]["bb_item_approval_status"]
          customer_decision_at?: string | null
          discrepancy?: string
          discrepancy_type?: string | null
          estimated_hours?: number
          id?: string
          item_number: number
          item_status?: Database["public"]["Enums"]["bb_wo_item_status"]
          labor_rate?: number
          logbook_section?: Database["public"]["Enums"]["bb_logbook_section"]
          mechanic_id?: string | null
          no_parts_required?: boolean
          outside_services_cost?: number
          parent_item_id?: string | null
          part_number?: string | null
          ref_code?: string
          serial_number?: string | null
          shipping_cost?: number
          sign_off_required?: boolean
          signed_off_at?: string | null
          signed_off_by?: string | null
          task_number?: string | null
          updated_at?: string
          work_order_id: string
        }
        Update: {
          category?: string
          corrective_action?: string
          created_at?: string
          customer_approval_status?: Database["public"]["Enums"]["bb_item_approval_status"]
          customer_decision_at?: string | null
          discrepancy?: string
          discrepancy_type?: string | null
          estimated_hours?: number
          id?: string
          item_number?: number
          item_status?: Database["public"]["Enums"]["bb_wo_item_status"]
          labor_rate?: number
          logbook_section?: Database["public"]["Enums"]["bb_logbook_section"]
          mechanic_id?: string | null
          no_parts_required?: boolean
          outside_services_cost?: number
          parent_item_id?: string | null
          part_number?: string | null
          ref_code?: string
          serial_number?: string | null
          shipping_cost?: number
          sign_off_required?: boolean
          signed_off_at?: string | null
          signed_off_by?: string | null
          task_number?: string | null
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_work_order_items_mechanic_id_fkey"
            columns: ["mechanic_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_order_items_parent_item_id_fkey"
            columns: ["parent_item_id"]
            isOneToOne: false
            referencedRelation: "bb_work_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_order_items_signed_off_by_fkey"
            columns: ["signed_off_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "bb_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_work_order_mechanics: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          profile_id: string
          work_order_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          profile_id: string
          work_order_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          profile_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_work_order_mechanics_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_order_mechanics_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_order_mechanics_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "bb_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_work_order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["bb_wo_status"] | null
          id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["bb_wo_status"]
          work_order_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["bb_wo_status"] | null
          id?: string
          notes?: string | null
          to_status: Database["public"]["Enums"]["bb_wo_status"]
          work_order_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["bb_wo_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["bb_wo_status"]
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_work_order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_order_status_history_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "bb_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_work_orders: {
        Row: {
          aircraft_id: string | null
          closed_at: string | null
          converted_to_wo_id: string | null
          created_at: string
          description: string | null
          discrepancy_ref: string | null
          guest_registration: string | null
          guest_serial: string | null
          id: string
          meter_at_close: number | null
          meter_at_open: number | null
          notes: string | null
          opened_at: string
          opened_by: string | null
          parent_wo_id: string | null
          priority: Database["public"]["Enums"]["bb_priority"]
          quote_expires_at: string | null
          quote_sent_at: string | null
          quote_status: Database["public"]["Enums"]["bb_quote_status"] | null
          source_quote_id: string | null
          status: Database["public"]["Enums"]["bb_wo_status"]
          times_snapshot: Json | null
          updated_at: string
          wo_number: string
          wo_type: string
        }
        Insert: {
          aircraft_id?: string | null
          closed_at?: string | null
          converted_to_wo_id?: string | null
          created_at?: string
          description?: string | null
          discrepancy_ref?: string | null
          guest_registration?: string | null
          guest_serial?: string | null
          id?: string
          meter_at_close?: number | null
          meter_at_open?: number | null
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          parent_wo_id?: string | null
          priority?: Database["public"]["Enums"]["bb_priority"]
          quote_expires_at?: string | null
          quote_sent_at?: string | null
          quote_status?: Database["public"]["Enums"]["bb_quote_status"] | null
          source_quote_id?: string | null
          status?: Database["public"]["Enums"]["bb_wo_status"]
          times_snapshot?: Json | null
          updated_at?: string
          wo_number: string
          wo_type?: string
        }
        Update: {
          aircraft_id?: string | null
          closed_at?: string | null
          converted_to_wo_id?: string | null
          created_at?: string
          description?: string | null
          discrepancy_ref?: string | null
          guest_registration?: string | null
          guest_serial?: string | null
          id?: string
          meter_at_close?: number | null
          meter_at_open?: number | null
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          parent_wo_id?: string | null
          priority?: Database["public"]["Enums"]["bb_priority"]
          quote_expires_at?: string | null
          quote_sent_at?: string | null
          quote_status?: Database["public"]["Enums"]["bb_quote_status"] | null
          source_quote_id?: string | null
          status?: Database["public"]["Enums"]["bb_wo_status"]
          times_snapshot?: Json | null
          updated_at?: string
          wo_number?: string
          wo_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_work_orders_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_orders_converted_to_wo_id_fkey"
            columns: ["converted_to_wo_id"]
            isOneToOne: false
            referencedRelation: "bb_work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_orders_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_orders_parent_wo_id_fkey"
            columns: ["parent_wo_id"]
            isOneToOne: false
            referencedRelation: "bb_work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_work_orders_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "bb_work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          address2: string | null
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          inactive: boolean
          legacy_id: number | null
          name: string
          notes: string | null
          phone: string | null
          phone2: string | null
          state: string | null
          tax_id: string | null
          taxable: boolean
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          address2?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inactive?: boolean
          legacy_id?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          phone2?: string | null
          state?: string | null
          tax_id?: string | null
          taxable?: boolean
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          address2?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inactive?: boolean
          legacy_id?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          phone2?: string | null
          state?: string | null
          tax_id?: string | null
          taxable?: boolean
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      discrepancies: {
        Row: {
          adf_page_reference: string | null
          aircraft_id: string
          airframe_cycles: number | null
          airframe_hours: number | null
          amm_references: string[] | null
          approved_by_email: string | null
          approved_by_name: string | null
          ata_chapter_normalized: string | null
          ata_chapter_raw: string | null
          company: string | null
          corrective_action: string | null
          created_at: string
          engine1_cycles: number | null
          engine1_hours: number | null
          engine2_cycles: number | null
          engine2_hours: number | null
          found_at: string | null
          found_by_name: string | null
          has_mel: boolean
          id: string
          import_confidence: string | null
          import_notes: string | null
          import_status: string
          jetinsight_discrepancy_id: string | null
          location_icao: string | null
          location_raw: string | null
          mel_category: string | null
          mel_due_date: string | null
          mel_item: string | null
          pilot_report: string
          raw_text: string | null
          registration_at_event: string | null
          signature_id: string | null
          signoff_date: string | null
          source_id: string | null
          status: string
          technician_credential_number: string | null
          technician_credential_type: string | null
          technician_email: string | null
          technician_name: string | null
          title: string
          updated_at: string
        }
        Insert: {
          adf_page_reference?: string | null
          aircraft_id: string
          airframe_cycles?: number | null
          airframe_hours?: number | null
          amm_references?: string[] | null
          approved_by_email?: string | null
          approved_by_name?: string | null
          ata_chapter_normalized?: string | null
          ata_chapter_raw?: string | null
          company?: string | null
          corrective_action?: string | null
          created_at?: string
          engine1_cycles?: number | null
          engine1_hours?: number | null
          engine2_cycles?: number | null
          engine2_hours?: number | null
          found_at?: string | null
          found_by_name?: string | null
          has_mel?: boolean
          id?: string
          import_confidence?: string | null
          import_notes?: string | null
          import_status?: string
          jetinsight_discrepancy_id?: string | null
          location_icao?: string | null
          location_raw?: string | null
          mel_category?: string | null
          mel_due_date?: string | null
          mel_item?: string | null
          pilot_report: string
          raw_text?: string | null
          registration_at_event?: string | null
          signature_id?: string | null
          signoff_date?: string | null
          source_id?: string | null
          status?: string
          technician_credential_number?: string | null
          technician_credential_type?: string | null
          technician_email?: string | null
          technician_name?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          adf_page_reference?: string | null
          aircraft_id?: string
          airframe_cycles?: number | null
          airframe_hours?: number | null
          amm_references?: string[] | null
          approved_by_email?: string | null
          approved_by_name?: string | null
          ata_chapter_normalized?: string | null
          ata_chapter_raw?: string | null
          company?: string | null
          corrective_action?: string | null
          created_at?: string
          engine1_cycles?: number | null
          engine1_hours?: number | null
          engine2_cycles?: number | null
          engine2_hours?: number | null
          found_at?: string | null
          found_by_name?: string | null
          has_mel?: boolean
          id?: string
          import_confidence?: string | null
          import_notes?: string | null
          import_status?: string
          jetinsight_discrepancy_id?: string | null
          location_icao?: string | null
          location_raw?: string | null
          mel_category?: string | null
          mel_due_date?: string | null
          mel_item?: string | null
          pilot_report?: string
          raw_text?: string | null
          registration_at_event?: string | null
          signature_id?: string | null
          signoff_date?: string | null
          source_id?: string | null
          status?: string
          technician_credential_number?: string | null
          technician_credential_type?: string | null
          technician_email?: string | null
          technician_name?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discrepancies_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancies_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "discrepancy_import_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      discrepancy_enrichments: {
        Row: {
          created_at: string
          discrepancy_id: string
          dom_review_notes: string | null
          enrichment_type: string
          golden_nuggets: string | null
          id: string
          interview_feedback: string | null
          interview_rating: number | null
          interviewee_name: string | null
          interviewer_id: string | null
          narrative_summary: string | null
          raw_transcript: Json | null
          reviewed_at: string | null
          reviewed_by: string | null
          session_completed_at: string | null
          session_started_at: string
          status: string
          structured_data: Json | null
          suggested_corrections: Json | null
        }
        Insert: {
          created_at?: string
          discrepancy_id: string
          dom_review_notes?: string | null
          enrichment_type: string
          golden_nuggets?: string | null
          id?: string
          interview_feedback?: string | null
          interview_rating?: number | null
          interviewee_name?: string | null
          interviewer_id?: string | null
          narrative_summary?: string | null
          raw_transcript?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_completed_at?: string | null
          session_started_at?: string
          status?: string
          structured_data?: Json | null
          suggested_corrections?: Json | null
        }
        Update: {
          created_at?: string
          discrepancy_id?: string
          dom_review_notes?: string | null
          enrichment_type?: string
          golden_nuggets?: string | null
          id?: string
          interview_feedback?: string | null
          interview_rating?: number | null
          interviewee_name?: string | null
          interviewer_id?: string | null
          narrative_summary?: string | null
          raw_transcript?: Json | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          session_completed_at?: string | null
          session_started_at?: string
          status?: string
          structured_data?: Json | null
          suggested_corrections?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "discrepancy_enrichments_discrepancy_id_fkey"
            columns: ["discrepancy_id"]
            isOneToOne: false
            referencedRelation: "discrepancies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancy_enrichments_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discrepancy_enrichments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discrepancy_import_sources: {
        Row: {
          created_at: string
          drive_file_id: string | null
          drive_folder_path: string | null
          file_hash: string | null
          file_name: string | null
          id: string
          import_batch_id: string | null
          imported_at: string
          parse_notes: string | null
          parse_status: string
          raw_text: string | null
          source_type: string
        }
        Insert: {
          created_at?: string
          drive_file_id?: string | null
          drive_folder_path?: string | null
          file_hash?: string | null
          file_name?: string | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string
          parse_notes?: string | null
          parse_status?: string
          raw_text?: string | null
          source_type: string
        }
        Update: {
          created_at?: string
          drive_file_id?: string | null
          drive_folder_path?: string | null
          file_hash?: string | null
          file_name?: string | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string
          parse_notes?: string | null
          parse_status?: string
          raw_text?: string | null
          source_type?: string
        }
        Relationships: []
      }
      dw1ght_learnings: {
        Row: {
          active: boolean
          aircraft_type: string | null
          category: string
          context: string
          created_at: string
          id: string
          inactive_until: string | null
          lesson: string
          pin_status: string
          source_id: string | null
          source_type: string
        }
        Insert: {
          active?: boolean
          aircraft_type?: string | null
          category: string
          context?: string
          created_at?: string
          id?: string
          inactive_until?: string | null
          lesson: string
          pin_status?: string
          source_id?: string | null
          source_type: string
        }
        Update: {
          active?: boolean
          aircraft_type?: string | null
          category?: string
          context?: string
          created_at?: string
          id?: string
          inactive_until?: string | null
          lesson?: string
          pin_status?: string
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dw1ght_learnings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "discrepancy_enrichments"
            referencedColumns: ["id"]
          },
        ]
      }
      external_requests: {
        Row: {
          created_at: string
          created_by: string
          delivery_channel: string
          expires_at: string | null
          field_schema: Json
          id: string
          instructions: string | null
          parent_id: string | null
          parent_label: string | null
          parent_type: string | null
          recipient_email: string
          recipient_name: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sent_at: string | null
          status: string
          submitted_at: string | null
          title: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by: string
          delivery_channel?: string
          expires_at?: string | null
          field_schema?: Json
          id?: string
          instructions?: string | null
          parent_id?: string | null
          parent_label?: string | null
          parent_type?: string | null
          recipient_email: string
          recipient_name: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          status?: string
          submitted_at?: string | null
          title: string
          token?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          delivery_channel?: string
          expires_at?: string | null
          field_schema?: Json
          id?: string
          instructions?: string | null
          parent_id?: string | null
          parent_label?: string | null
          parent_type?: string | null
          recipient_email?: string
          recipient_name?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sent_at?: string | null
          status?: string
          submitted_at?: string | null
          title?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_submission_attachments: {
        Row: {
          file_name: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          storage_path: string
          submission_id: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          submission_id: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          submission_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_submission_attachments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "external_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      external_submissions: {
        Row: {
          field_values: Json
          id: string
          notes: string | null
          request_id: string
          submitted_at: string
          submitter_ip: string | null
        }
        Insert: {
          field_values?: Json
          id?: string
          notes?: string | null
          request_id: string
          submitted_at?: string
          submitter_ip?: string | null
        }
        Update: {
          field_values?: Json
          id?: string
          notes?: string | null
          request_id?: string
          submitted_at?: string
          submitter_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_submissions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "external_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      fourteen_day_check_attachments: {
        Row: {
          field_id: string
          file_name: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          storage_path: string
          submission_id: string
          uploaded_at: string
        }
        Insert: {
          field_id: string
          file_name: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          submission_id: string
          uploaded_at?: string
        }
        Update: {
          field_id?: string
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          submission_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fourteen_day_check_attachments_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "fourteen_day_check_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      fourteen_day_check_dispatches: {
        Row: {
          aircraft_id: string
          id: string
          sent_at: string
          sent_by: string
          sent_to_email: string
          sent_to_name: string
          token_id: string
        }
        Insert: {
          aircraft_id: string
          id?: string
          sent_at?: string
          sent_by: string
          sent_to_email: string
          sent_to_name: string
          token_id: string
        }
        Update: {
          aircraft_id?: string
          id?: string
          sent_at?: string
          sent_by?: string
          sent_to_email?: string
          sent_to_name?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fourteen_day_check_dispatches_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fourteen_day_check_dispatches_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fourteen_day_check_dispatches_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "fourteen_day_check_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      fourteen_day_check_submissions: {
        Row: {
          aircraft_id: string
          field_values: Json
          id: string
          notes: string | null
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          submitted_at: string
          submitter_ip: string | null
          submitter_name: string
          token_id: string
        }
        Insert: {
          aircraft_id: string
          field_values?: Json
          id?: string
          notes?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string
          submitter_ip?: string | null
          submitter_name: string
          token_id: string
        }
        Update: {
          aircraft_id?: string
          field_values?: Json
          id?: string
          notes?: string | null
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          submitted_at?: string
          submitter_ip?: string | null
          submitter_name?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fourteen_day_check_submissions_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fourteen_day_check_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fourteen_day_check_submissions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "fourteen_day_check_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      fourteen_day_check_tokens: {
        Row: {
          aircraft_id: string
          created_at: string
          created_by: string
          field_schema: Json
          id: string
          template_id: string | null
          token: string
          traxxall_url: string | null
        }
        Insert: {
          aircraft_id: string
          created_at?: string
          created_by: string
          field_schema?: Json
          id?: string
          template_id?: string | null
          token?: string
          traxxall_url?: string | null
        }
        Update: {
          aircraft_id?: string
          created_at?: string
          created_by?: string
          field_schema?: Json
          id?: string
          template_id?: string | null
          token?: string
          traxxall_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fourteen_day_check_tokens_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: true
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fourteen_day_check_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fourteen_day_check_tokens_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "inspection_card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      group_cmms: {
        Row: {
          applicability: string
          ata_chapter: string
          created_at: string
          created_by: string | null
          doc_number: string
          drive_link: string
          groups: string[]
          id: string
          manufacturer: string
          notes: string
          revision: string
          revision_date: string
          title: string
          updated_at: string
        }
        Insert: {
          applicability?: string
          ata_chapter?: string
          created_at?: string
          created_by?: string | null
          doc_number?: string
          drive_link?: string
          groups?: string[]
          id?: string
          manufacturer?: string
          notes?: string
          revision?: string
          revision_date?: string
          title?: string
          updated_at?: string
        }
        Update: {
          applicability?: string
          ata_chapter?: string
          created_at?: string
          created_by?: string | null
          doc_number?: string
          drive_link?: string
          groups?: string[]
          id?: string
          manufacturer?: string
          notes?: string
          revision?: string
          revision_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      inspection_card_template_audit: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          details: Json | null
          id: string
          template_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          template_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_card_template_audit_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_card_template_audit_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "inspection_card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_card_templates: {
        Row: {
          aircraft_type: string | null
          created_at: string
          created_by: string | null
          field_schema: Json
          id: string
          name: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          aircraft_type?: string | null
          created_at?: string
          created_by?: string | null
          field_schema?: Json
          id?: string
          name: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          aircraft_type?: string | null
          created_at?: string
          created_by?: string | null
          field_schema?: Json
          id?: string
          name?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_card_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_card_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_assignments: {
        Row: {
          assigned_by: string
          assigned_to: string
          completed_at: string | null
          created_at: string
          discrepancy_id: string
          dom_note: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          completed_at?: string | null
          created_at?: string
          discrepancy_id: string
          dom_note?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          completed_at?: string | null
          created_at?: string
          discrepancy_id?: string
          dom_note?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_assignments_discrepancy_id_fkey"
            columns: ["discrepancy_id"]
            isOneToOne: false
            referencedRelation: "discrepancies"
            referencedColumns: ["id"]
          },
        ]
      }
      jetinsight_sync_log: {
        Row: {
          failed_count: number
          file_name: string | null
          first_error: string | null
          id: string
          inserted_count: number
          synced_at: string
          synced_by: string | null
          synced_by_name: string | null
          tails: string[]
          unchanged_count: number
          updated_count: number
        }
        Insert: {
          failed_count?: number
          file_name?: string | null
          first_error?: string | null
          id?: string
          inserted_count?: number
          synced_at?: string
          synced_by?: string | null
          synced_by_name?: string | null
          tails?: string[]
          unchanged_count?: number
          updated_count?: number
        }
        Update: {
          failed_count?: number
          file_name?: string | null
          first_error?: string | null
          id?: string
          inserted_count?: number
          synced_at?: string
          synced_by?: string | null
          synced_by_name?: string | null
          tails?: string[]
          unchanged_count?: number
          updated_count?: number
        }
        Relationships: []
      }
      journey_manager_notes: {
        Row: {
          author_profile_id: string
          created_at: string
          id: string
          note_date: string
          note_text: string
          subject_profile_id: string
          updated_at: string
        }
        Insert: {
          author_profile_id?: string
          created_at?: string
          id?: string
          note_date?: string
          note_text: string
          subject_profile_id: string
          updated_at?: string
        }
        Update: {
          author_profile_id?: string
          created_at?: string
          id?: string
          note_date?: string
          note_text?: string
          subject_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_manager_notes_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_manager_notes_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          manager_profile_id: string
          subject_profile_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          manager_profile_id: string
          subject_profile_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          manager_profile_id?: string
          subject_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_assignments_manager_profile_id_fkey"
            columns: ["manager_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_assignments_subject_profile_id_fkey"
            columns: ["subject_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mm_aircraft_documents: {
        Row: {
          aircraft_id: string
          assembly_detail: string | null
          assembly_type: string
          created_at: string
          id: string
          is_applicable: boolean
          requirement_type: string
          section: string | null
          source_document_id: string
        }
        Insert: {
          aircraft_id: string
          assembly_detail?: string | null
          assembly_type: string
          created_at?: string
          id?: string
          is_applicable?: boolean
          requirement_type: string
          section?: string | null
          source_document_id: string
        }
        Update: {
          aircraft_id?: string
          assembly_detail?: string | null
          assembly_type?: string
          created_at?: string
          id?: string
          is_applicable?: boolean
          requirement_type?: string
          section?: string | null
          source_document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mm_aircraft_documents_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mm_aircraft_documents_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "mm_source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      mm_audit_campaigns: {
        Row: {
          approved_by_admin: string | null
          approved_by_admin_at: string | null
          approved_by_super_admin: string | null
          approved_by_super_admin_at: string | null
          cancelled_at: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          period_end: string
          period_start: string
          status: string
        }
        Insert: {
          approved_by_admin?: string | null
          approved_by_admin_at?: string | null
          approved_by_super_admin?: string | null
          approved_by_super_admin_at?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          period_end: string
          period_start: string
          status?: string
        }
        Update: {
          approved_by_admin?: string | null
          approved_by_admin_at?: string | null
          approved_by_super_admin?: string | null
          approved_by_super_admin_at?: string | null
          cancelled_at?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          period_end?: string
          period_start?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mm_audit_campaigns_approved_by_admin_fkey"
            columns: ["approved_by_admin"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mm_audit_campaigns_approved_by_super_admin_fkey"
            columns: ["approved_by_super_admin"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mm_audit_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mm_audit_records: {
        Row: {
          aircraft_document_id: string
          audit_date: string
          audited_by: string | null
          audited_revision: string
          campaign_id: string | null
          created_at: string
          id: string
          next_due_date: string
          notes: string | null
        }
        Insert: {
          aircraft_document_id: string
          audit_date: string
          audited_by?: string | null
          audited_revision: string
          campaign_id?: string | null
          created_at?: string
          id?: string
          next_due_date?: string
          notes?: string | null
        }
        Update: {
          aircraft_document_id?: string
          audit_date?: string
          audited_by?: string | null
          audited_revision?: string
          campaign_id?: string | null
          created_at?: string
          id?: string
          next_due_date?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mm_audit_records_aircraft_document_id_fkey"
            columns: ["aircraft_document_id"]
            isOneToOne: false
            referencedRelation: "mm_aircraft_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mm_audit_records_audited_by_fkey"
            columns: ["audited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mm_audit_records_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mm_audit_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      mm_campaign_assignments: {
        Row: {
          aircraft_id: string | null
          assigned_by: string | null
          assigned_to: string
          campaign_id: string
          created_at: string
          id: string
          model_family: string | null
        }
        Insert: {
          aircraft_id?: string | null
          assigned_by?: string | null
          assigned_to: string
          campaign_id: string
          created_at?: string
          id?: string
          model_family?: string | null
        }
        Update: {
          aircraft_id?: string | null
          assigned_by?: string | null
          assigned_to?: string
          campaign_id?: string
          created_at?: string
          id?: string
          model_family?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mm_campaign_assignments_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mm_campaign_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mm_campaign_assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mm_campaign_assignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mm_audit_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      mm_campaign_revision_changes: {
        Row: {
          campaign_id: string
          id: string
          new_revision: string
          old_revision: string
          proposed_at: string | null
          proposed_by: string | null
          source_document_id: string
        }
        Insert: {
          campaign_id: string
          id?: string
          new_revision: string
          old_revision: string
          proposed_at?: string | null
          proposed_by?: string | null
          source_document_id: string
        }
        Update: {
          campaign_id?: string
          id?: string
          new_revision?: string
          old_revision?: string
          proposed_at?: string | null
          proposed_by?: string | null
          source_document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mm_campaign_revision_changes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "mm_audit_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mm_campaign_revision_changes_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mm_campaign_revision_changes_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "mm_source_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      mm_mel_tracking: {
        Row: {
          document_number: string
          document_type: string
          id: string
          model_family: string
          next_due_date: string | null
          review_date: string | null
          revision_date: string | null
          revision_number: string | null
          update_needed: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          document_number: string
          document_type: string
          id?: string
          model_family: string
          next_due_date?: string | null
          review_date?: string | null
          revision_date?: string | null
          revision_number?: string | null
          update_needed?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          document_number?: string
          document_type?: string
          id?: string
          model_family?: string
          next_due_date?: string | null
          review_date?: string | null
          revision_date?: string | null
          revision_number?: string | null
          update_needed?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mm_mel_tracking_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mm_source_documents: {
        Row: {
          current_rev_date: string | null
          current_revision: string
          document_name: string
          document_number: string
          document_url: string | null
          id: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          current_rev_date?: string | null
          current_revision: string
          document_name: string
          document_number: string
          document_url?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          current_rev_date?: string | null
          current_revision?: string
          document_name?: string
          document_number?: string
          document_url?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mm_source_documents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json
          read: boolean
          recipient_profile_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          read?: boolean
          recipient_profile_id: string
          title: string
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          read?: boolean
          recipient_profile_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_approvals: {
        Row: {
          approver_id: string
          comment: string | null
          created_at: string
          decision: string
          id: string
          request_id: string
        }
        Insert: {
          approver_id: string
          comment?: string | null
          created_at?: string
          decision: string
          id?: string
          request_id: string
        }
        Update: {
          approver_id?: string
          comment?: string | null
          created_at?: string
          decision?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "parts_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_catalog: {
        Row: {
          aircraft_applicability: string[] | null
          ata_chapter: string | null
          created_at: string
          description: string | null
          id: string
          is_rotable: boolean
          is_serialized: boolean
          is_shelf_life: boolean
          manufacturer: string | null
          notes: string | null
          part_number: string
          part_type: string | null
          shelf_life_months: number | null
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          aircraft_applicability?: string[] | null
          ata_chapter?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_rotable?: boolean
          is_serialized?: boolean
          is_shelf_life?: boolean
          manufacturer?: string | null
          notes?: string | null
          part_number: string
          part_type?: string | null
          shelf_life_months?: number | null
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          aircraft_applicability?: string[] | null
          ata_chapter?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_rotable?: boolean
          is_serialized?: boolean
          is_shelf_life?: boolean
          manufacturer?: string | null
          notes?: string | null
          part_number?: string
          part_type?: string | null
          shelf_life_months?: number | null
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: []
      }
      parts_catalog_vendors: {
        Row: {
          catalog_id: string
          created_at: string
          id: string
          is_preferred: boolean
          last_unit_cost: number | null
          lead_time_days: number | null
          notes: string | null
          vendor_id: string
          vendor_name: string | null
        }
        Insert: {
          catalog_id: string
          created_at?: string
          id?: string
          is_preferred?: boolean
          last_unit_cost?: number | null
          lead_time_days?: number | null
          notes?: string | null
          vendor_id: string
          vendor_name?: string | null
        }
        Update: {
          catalog_id?: string
          created_at?: string
          id?: string
          is_preferred?: boolean
          last_unit_cost?: number | null
          lead_time_days?: number | null
          notes?: string | null
          vendor_id?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_catalog_vendors_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "parts_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_catalog_vendors_supplier_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "bb_parts_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_config: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      parts_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          request_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          request_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "parts_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_relationships: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          part_a_id: string
          part_b_id: string
          relationship_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          part_a_id: string
          part_b_id: string
          relationship_type: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          part_a_id?: string
          part_b_id?: string
          relationship_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_relationships_part_a_id_fkey"
            columns: ["part_a_id"]
            isOneToOne: false
            referencedRelation: "parts_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_relationships_part_b_id_fkey"
            columns: ["part_b_id"]
            isOneToOne: false
            referencedRelation: "parts_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_request_lines: {
        Row: {
          alternate_pn: string | null
          catalog_id: string | null
          condition: string
          core_due_by: string | null
          core_status: string | null
          core_tracking: string | null
          created_at: string
          description: string | null
          id: string
          is_exchange: boolean
          line_number: number
          line_status: string
          part_number: string
          po_number: string | null
          quantity: number
          request_id: string
          tracking_eta: string | null
          tracking_events: Json | null
          tracking_last_checked: string | null
          tracking_number: string | null
          tracking_status: string | null
          unit_cost: number | null
          updated_at: string
          vendor: string | null
          wo_item_id: string | null
        }
        Insert: {
          alternate_pn?: string | null
          catalog_id?: string | null
          condition?: string
          core_due_by?: string | null
          core_status?: string | null
          core_tracking?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_exchange?: boolean
          line_number: number
          line_status?: string
          part_number: string
          po_number?: string | null
          quantity: number
          request_id: string
          tracking_eta?: string | null
          tracking_events?: Json | null
          tracking_last_checked?: string | null
          tracking_number?: string | null
          tracking_status?: string | null
          unit_cost?: number | null
          updated_at?: string
          vendor?: string | null
          wo_item_id?: string | null
        }
        Update: {
          alternate_pn?: string | null
          catalog_id?: string | null
          condition?: string
          core_due_by?: string | null
          core_status?: string | null
          core_tracking?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_exchange?: boolean
          line_number?: number
          line_status?: string
          part_number?: string
          po_number?: string | null
          quantity?: number
          request_id?: string
          tracking_eta?: string | null
          tracking_events?: Json | null
          tracking_last_checked?: string | null
          tracking_number?: string | null
          tracking_status?: string | null
          unit_cost?: number | null
          updated_at?: string
          vendor?: string | null
          wo_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_request_lines_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "parts_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_request_lines_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "parts_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_request_lines_wo_item_id_fkey"
            columns: ["wo_item_id"]
            isOneToOne: false
            referencedRelation: "bb_work_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_requests: {
        Row: {
          aircraft_id: string | null
          aircraft_tail: string | null
          all_at_once: boolean
          aog: boolean
          aog_removed_pn: string | null
          aog_removed_sn: string | null
          aog_squawk: string | null
          created_at: string
          date_needed: string
          delay_affects_rts: boolean
          ebis_service_request_id: string | null
          ebis_work_order_id: string | null
          front_link: string | null
          id: string
          item_number: string | null
          job_description: string
          notes: string | null
          order_type: string
          requested_by: string
          ship_to: string
          ship_to_address: string | null
          status: string
          stock_purpose: string | null
          updated_at: string
          work_order: string | null
        }
        Insert: {
          aircraft_id?: string | null
          aircraft_tail?: string | null
          all_at_once?: boolean
          aog?: boolean
          aog_removed_pn?: string | null
          aog_removed_sn?: string | null
          aog_squawk?: string | null
          created_at?: string
          date_needed: string
          delay_affects_rts?: boolean
          ebis_service_request_id?: string | null
          ebis_work_order_id?: string | null
          front_link?: string | null
          id?: string
          item_number?: string | null
          job_description: string
          notes?: string | null
          order_type?: string
          requested_by: string
          ship_to: string
          ship_to_address?: string | null
          status?: string
          stock_purpose?: string | null
          updated_at?: string
          work_order?: string | null
        }
        Update: {
          aircraft_id?: string | null
          aircraft_tail?: string | null
          all_at_once?: boolean
          aog?: boolean
          aog_removed_pn?: string | null
          aog_removed_sn?: string | null
          aog_squawk?: string | null
          created_at?: string
          date_needed?: string
          delay_affects_rts?: boolean
          ebis_service_request_id?: string | null
          ebis_work_order_id?: string | null
          front_link?: string | null
          id?: string
          item_number?: string | null
          job_description?: string
          notes?: string | null
          order_type?: string
          requested_by?: string
          ship_to?: string
          ship_to_address?: string | null
          status?: string
          stock_purpose?: string | null
          updated_at?: string
          work_order?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_requests_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_status_history: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          line_id: string | null
          new_status: string
          note: string | null
          old_status: string | null
          request_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          line_id?: string | null
          new_status: string
          note?: string | null
          old_status?: string | null
          request_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          line_id?: string | null
          new_status?: string
          note?: string | null
          old_status?: string | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parts_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_status_history_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "parts_request_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "parts_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_board_members: {
        Row: {
          added_at: string
          added_by: string | null
          board_id: string
          id: string
          profile_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          board_id: string
          id?: string
          profile_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          board_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_board_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "pm_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_board_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_boards: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_boards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_groups: {
        Row: {
          board_id: string
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          board_id: string
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          board_id?: string
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_groups_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "pm_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_statuses: {
        Row: {
          board_id: string
          color: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          sort_order: number
        }
        Insert: {
          board_id: string
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          board_id?: string
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "pm_statuses_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "pm_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          storage_path: string
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          storage_path: string
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          storage_path?: string
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_task_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_task_contributors: {
        Row: {
          added_at: string
          profile_id: string
          task_id: string
        }
        Insert: {
          added_at?: string
          profile_id: string
          task_id: string
        }
        Update: {
          added_at?: string
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_task_contributors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_task_contributors_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_tasks: {
        Row: {
          archived_at: string | null
          champion_id: string | null
          completion_note: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          group_id: string
          id: string
          name: string
          parent_task_id: string | null
          sort_order: number
          status_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          champion_id?: string | null
          completion_note?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          group_id: string
          id?: string
          name: string
          parent_task_id?: string | null
          sort_order?: number
          status_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          champion_id?: string | null
          completion_note?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          group_id?: string
          id?: string
          name?: string
          parent_task_id?: string | null
          sort_order?: number
          status_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_tasks_champion_id_fkey"
            columns: ["champion_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "pm_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "pm_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_color: string | null
          avatar_initials: string | null
          avatar_url: string | null
          bb_labor_eligible: boolean
          created_at: string
          display_name: string | null
          email: string
          first_name: string | null
          full_name: string | null
          id: string
          is_readonly: boolean
          last_login: string | null
          last_name: string | null
          last_seen_at: string | null
          mxlms_technician_id: number | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_color?: string | null
          avatar_initials?: string | null
          avatar_url?: string | null
          bb_labor_eligible?: boolean
          created_at?: string
          display_name?: string | null
          email: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_readonly?: boolean
          last_login?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          mxlms_technician_id?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_color?: string | null
          avatar_initials?: string | null
          avatar_url?: string | null
          bb_labor_eligible?: boolean
          created_at?: string
          display_name?: string | null
          email?: string
          first_name?: string | null
          full_name?: string | null
          id?: string
          is_readonly?: boolean
          last_login?: string | null
          last_name?: string | null
          last_seen_at?: string | null
          mxlms_technician_id?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      role_default_permissions: {
        Row: {
          permissions: Json
          role: string
          updated_at: string
        }
        Insert: {
          permissions?: Json
          role: string
          updated_at?: string
        }
        Update: {
          permissions?: Json
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      rv_components: {
        Row: {
          aircraft_id: string
          created_at: string | null
          description: string | null
          id: string
          installed_date: string | null
          installed_event_id: string | null
          installed_hours: number | null
          part_number: string
          removed_date: string | null
          removed_event_id: string | null
          removed_hours: number | null
          serial_number: string | null
          time_installed: number | null
        }
        Insert: {
          aircraft_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          installed_date?: string | null
          installed_event_id?: string | null
          installed_hours?: number | null
          part_number: string
          removed_date?: string | null
          removed_event_id?: string | null
          removed_hours?: number | null
          serial_number?: string | null
          time_installed?: number | null
        }
        Update: {
          aircraft_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          installed_date?: string | null
          installed_event_id?: string | null
          installed_hours?: number | null
          part_number?: string
          removed_date?: string | null
          removed_event_id?: string | null
          removed_hours?: number | null
          serial_number?: string | null
          time_installed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rv_components_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_components_installed_event_id_fkey"
            columns: ["installed_event_id"]
            isOneToOne: false
            referencedRelation: "rv_maintenance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_components_removed_event_id_fkey"
            columns: ["removed_event_id"]
            isOneToOne: false
            referencedRelation: "rv_maintenance_events"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_ingestion_log: {
        Row: {
          created_at: string
          id: string
          message: string | null
          page_count: number | null
          record_source_id: string
          step: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          page_count?: number | null
          record_source_id: string
          step: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          page_count?: number | null
          record_source_id?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "rv_ingestion_log_record_source_id_fkey"
            columns: ["record_source_id"]
            isOneToOne: false
            referencedRelation: "rv_record_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_maintenance_events: {
        Row: {
          ad_sb_number: string | null
          aircraft_cycles: number | null
          aircraft_id: string
          aircraft_total_time: number | null
          approved_by: string | null
          confidence: number | null
          created_at: string | null
          description: string
          event_date: string | null
          event_type: string
          extraction_model: string | null
          extraction_notes: string | null
          id: string
          page_ids: string[]
          part_numbers: string[]
          performed_by: string | null
          record_source_id: string
          search_vector: unknown
          serial_numbers: string[]
          station: string | null
          work_order_number: string | null
        }
        Insert: {
          ad_sb_number?: string | null
          aircraft_cycles?: number | null
          aircraft_id: string
          aircraft_total_time?: number | null
          approved_by?: string | null
          confidence?: number | null
          created_at?: string | null
          description: string
          event_date?: string | null
          event_type: string
          extraction_model?: string | null
          extraction_notes?: string | null
          id?: string
          page_ids?: string[]
          part_numbers?: string[]
          performed_by?: string | null
          record_source_id: string
          search_vector?: unknown
          serial_numbers?: string[]
          station?: string | null
          work_order_number?: string | null
        }
        Update: {
          ad_sb_number?: string | null
          aircraft_cycles?: number | null
          aircraft_id?: string
          aircraft_total_time?: number | null
          approved_by?: string | null
          confidence?: number | null
          created_at?: string | null
          description?: string
          event_date?: string | null
          event_type?: string
          extraction_model?: string | null
          extraction_notes?: string | null
          id?: string
          page_ids?: string[]
          part_numbers?: string[]
          performed_by?: string | null
          record_source_id?: string
          search_vector?: unknown
          serial_numbers?: string[]
          station?: string | null
          work_order_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rv_maintenance_events_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_maintenance_events_record_source_id_fkey"
            columns: ["record_source_id"]
            isOneToOne: false
            referencedRelation: "rv_record_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_page_chunks: {
        Row: {
          aircraft_id: string
          chunk_index: number
          chunk_text: string
          created_at: string | null
          embedding: string | null
          id: string
          page_id: string
          record_source_id: string
        }
        Insert: {
          aircraft_id: string
          chunk_index: number
          chunk_text: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          page_id: string
          record_source_id: string
        }
        Update: {
          aircraft_id?: string
          chunk_index?: number
          chunk_text?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          page_id?: string
          record_source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rv_page_chunks_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_page_chunks_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "rv_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_page_chunks_record_source_id_fkey"
            columns: ["record_source_id"]
            isOneToOne: false
            referencedRelation: "rv_record_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_pages: {
        Row: {
          aircraft_id: string
          checkboxes_extracted: Json | null
          created_at: string
          forms_extracted: Json | null
          id: string
          image_storage_path: string | null
          ocr_bbox_data: Json | null
          ocr_confidence: number | null
          ocr_status: string
          page_dimensions: Json | null
          page_image_path: string | null
          page_image_uploaded_at: string | null
          page_number: number
          raw_ocr_text: string | null
          record_source_id: string
          search_vector: unknown
          tables_extracted: Json | null
          word_geometry: Json | null
          word_positions: Json | null
        }
        Insert: {
          aircraft_id: string
          checkboxes_extracted?: Json | null
          created_at?: string
          forms_extracted?: Json | null
          id?: string
          image_storage_path?: string | null
          ocr_bbox_data?: Json | null
          ocr_confidence?: number | null
          ocr_status?: string
          page_dimensions?: Json | null
          page_image_path?: string | null
          page_image_uploaded_at?: string | null
          page_number: number
          raw_ocr_text?: string | null
          record_source_id: string
          search_vector?: unknown
          tables_extracted?: Json | null
          word_geometry?: Json | null
          word_positions?: Json | null
        }
        Update: {
          aircraft_id?: string
          checkboxes_extracted?: Json | null
          created_at?: string
          forms_extracted?: Json | null
          id?: string
          image_storage_path?: string | null
          ocr_bbox_data?: Json | null
          ocr_confidence?: number | null
          ocr_status?: string
          page_dimensions?: Json | null
          page_image_path?: string | null
          page_image_uploaded_at?: string | null
          page_number?: number
          raw_ocr_text?: string | null
          record_source_id?: string
          search_vector?: unknown
          tables_extracted?: Json | null
          word_geometry?: Json | null
          word_positions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rv_pages_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_pages_record_source_id_fkey"
            columns: ["record_source_id"]
            isOneToOne: false
            referencedRelation: "rv_record_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_record_sources: {
        Row: {
          aircraft_id: string
          chunk_status: string
          chunks_generated: number
          created_at: string
          date_range_end: string | null
          date_range_start: string | null
          display_label: Json | null
          events_extracted: number | null
          events_status: string
          extraction_completed_at: string | null
          extraction_error: string | null
          extraction_status: string
          file_hash: string | null
          file_size_bytes: number | null
          id: string
          import_batch: string | null
          imported_by: string | null
          ingestion_completed_at: string | null
          ingestion_error: string | null
          ingestion_started_at: string | null
          ingestion_status: string
          label_status: string
          notes: string | null
          observed_registration: string | null
          ocr_quality_score: number | null
          original_filename: string
          page_count: number | null
          page_images_stored: number | null
          pages_extracted: number | null
          pages_inserted: number | null
          rasterize_status: string
          s3_key: string | null
          source_category: string
          storage_path: string | null
          textract_handled_at: string | null
          textract_job_id: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          aircraft_id: string
          chunk_status?: string
          chunks_generated?: number
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          display_label?: Json | null
          events_extracted?: number | null
          events_status?: string
          extraction_completed_at?: string | null
          extraction_error?: string | null
          extraction_status?: string
          file_hash?: string | null
          file_size_bytes?: number | null
          id?: string
          import_batch?: string | null
          imported_by?: string | null
          ingestion_completed_at?: string | null
          ingestion_error?: string | null
          ingestion_started_at?: string | null
          ingestion_status?: string
          label_status?: string
          notes?: string | null
          observed_registration?: string | null
          ocr_quality_score?: number | null
          original_filename: string
          page_count?: number | null
          page_images_stored?: number | null
          pages_extracted?: number | null
          pages_inserted?: number | null
          rasterize_status?: string
          s3_key?: string | null
          source_category?: string
          storage_path?: string | null
          textract_handled_at?: string | null
          textract_job_id?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          aircraft_id?: string
          chunk_status?: string
          chunks_generated?: number
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          display_label?: Json | null
          events_extracted?: number | null
          events_status?: string
          extraction_completed_at?: string | null
          extraction_error?: string | null
          extraction_status?: string
          file_hash?: string | null
          file_size_bytes?: number | null
          id?: string
          import_batch?: string | null
          imported_by?: string | null
          ingestion_completed_at?: string | null
          ingestion_error?: string | null
          ingestion_started_at?: string | null
          ingestion_status?: string
          label_status?: string
          notes?: string | null
          observed_registration?: string | null
          ocr_quality_score?: number | null
          original_filename?: string
          page_count?: number | null
          page_images_stored?: number | null
          pages_extracted?: number | null
          pages_inserted?: number | null
          rasterize_status?: string
          s3_key?: string | null
          source_category?: string
          storage_path?: string | null
          textract_handled_at?: string | null
          textract_job_id?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rv_record_sources_aircraft_id_fkey"
            columns: ["aircraft_id"]
            isOneToOne: false
            referencedRelation: "aircraft"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_record_sources_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_maintenance_events: {
        Row: {
          aircraft_tail: string
          created_by_user: string | null
          end_at: string
          event_type: string
          external_uuid: string
          id: string
          notes: string | null
          raw_event: Json
          received_at: string
          start_at: string
          title: string
          webhook_log_id: string | null
        }
        Insert: {
          aircraft_tail: string
          created_by_user?: string | null
          end_at: string
          event_type?: string
          external_uuid: string
          id?: string
          notes?: string | null
          raw_event: Json
          received_at?: string
          start_at: string
          title: string
          webhook_log_id?: string | null
        }
        Update: {
          aircraft_tail?: string
          created_by_user?: string | null
          end_at?: string
          event_type?: string
          external_uuid?: string
          id?: string
          notes?: string | null
          raw_event?: Json
          received_at?: string
          start_at?: string
          title?: string
          webhook_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_maintenance_events_webhook_log_id_fkey"
            columns: ["webhook_log_id"]
            isOneToOne: false
            referencedRelation: "webhook_inbound_log"
            referencedColumns: ["id"]
          },
        ]
      }
      site_suggestions: {
        Row: {
          body: string | null
          created_at: string
          id: string
          image_url: string | null
          page_url: string
          status: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          page_url: string
          status?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          page_url?: string
          status?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suggestion_replies: {
        Row: {
          admin_reply: string
          id: string
          read_at: string | null
          reply_type: string
          sender: string
          sent_at: string
          suggestion_id: string
        }
        Insert: {
          admin_reply: string
          id?: string
          read_at?: string | null
          reply_type?: string
          sender?: string
          sent_at?: string
          suggestion_id: string
        }
        Update: {
          admin_reply?: string
          id?: string
          read_at?: string | null
          reply_type?: string
          sender?: string
          sent_at?: string
          suggestion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_replies_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "site_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          granted_at: string
          id: string
          section: Database["public"]["Enums"]["app_section"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          id?: string
          section: Database["public"]["Enums"]["app_section"]
          user_id: string
        }
        Update: {
          granted_at?: string
          id?: string
          section?: Database["public"]["Enums"]["app_section"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_contacts: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_primary: boolean
          mobile: string | null
          name: string
          phone: string | null
          role: string | null
          title: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          mobile?: string | null
          name: string
          phone?: string | null
          role?: string | null
          title?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          mobile?: string | null
          name?: string
          phone?: string | null
          role?: string | null
          title?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_documents: {
        Row: {
          document_name: string
          document_type: string
          expires_at: string | null
          file_path: string
          file_size: number | null
          id: string
          lane: string
          notes: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          vendor_id: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          document_name: string
          document_type?: string
          expires_at?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          lane?: string
          notes?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          vendor_id: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          document_name?: string
          document_type?: string
          expires_at?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          lane?: string
          notes?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          vendor_id?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_lane_nine: {
        Row: {
          ap_certificate_number: string | null
          ap_certificate_verified: boolean
          approved_at: string | null
          approved_by: string | null
          capability_scope: string | null
          id: string
          last_review_date: string | null
          next_review_due: string | null
          notes: string | null
          status: string
          updated_at: string | null
          updated_by: string | null
          vendor_id: string
          warnings: string[] | null
        }
        Insert: {
          ap_certificate_number?: string | null
          ap_certificate_verified?: boolean
          approved_at?: string | null
          approved_by?: string | null
          capability_scope?: string | null
          id?: string
          last_review_date?: string | null
          next_review_due?: string | null
          notes?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          vendor_id: string
          warnings?: string[] | null
        }
        Update: {
          ap_certificate_number?: string | null
          ap_certificate_verified?: boolean
          approved_at?: string | null
          approved_by?: string | null
          capability_scope?: string | null
          id?: string
          last_review_date?: string | null
          next_review_due?: string | null
          notes?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          vendor_id?: string
          warnings?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_lane_nine_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_lane_ten: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          argus_rating: string | null
          authorization_scope: string | null
          crs_number: string | null
          drug_abatement_verified: boolean
          gmm_form_complete: boolean
          id: string
          insurance_verified: boolean
          isbao_rating: string | null
          last_audit_date: string | null
          last_oversight_review: string | null
          next_audit_due: string | null
          next_oversight_review_due: string | null
          notes: string | null
          status: string
          updated_at: string | null
          updated_by: string | null
          vendor_id: string
          warnings: string[] | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          argus_rating?: string | null
          authorization_scope?: string | null
          crs_number?: string | null
          drug_abatement_verified?: boolean
          gmm_form_complete?: boolean
          id?: string
          insurance_verified?: boolean
          isbao_rating?: string | null
          last_audit_date?: string | null
          last_oversight_review?: string | null
          next_audit_due?: string | null
          next_oversight_review_due?: string | null
          notes?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          vendor_id: string
          warnings?: string[] | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          argus_rating?: string | null
          authorization_scope?: string | null
          crs_number?: string | null
          drug_abatement_verified?: boolean
          gmm_form_complete?: boolean
          id?: string
          insurance_verified?: boolean
          isbao_rating?: string | null
          last_audit_date?: string | null
          last_oversight_review?: string | null
          next_audit_due?: string | null
          next_oversight_review_due?: string | null
          notes?: string | null
          status?: string
          updated_at?: string | null
          updated_by?: string | null
          vendor_id?: string
          warnings?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_lane_ten_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: true
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_reports: {
        Row: {
          date_range_end: string | null
          date_range_start: string | null
          description: string | null
          file_format: string
          file_path: string | null
          file_size: number | null
          generated_at: string
          generated_by: string | null
          id: string
          lane_filter: string | null
          notes: string | null
          report_type: string
          status_filter: string | null
          title: string
        }
        Insert: {
          date_range_end?: string | null
          date_range_start?: string | null
          description?: string | null
          file_format?: string
          file_path?: string | null
          file_size?: number | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          lane_filter?: string | null
          notes?: string | null
          report_type: string
          status_filter?: string | null
          title: string
        }
        Update: {
          date_range_end?: string | null
          date_range_start?: string | null
          description?: string | null
          file_format?: string
          file_path?: string | null
          file_size?: number | null
          generated_at?: string
          generated_by?: string | null
          id?: string
          lane_filter?: string | null
          notes?: string | null
          report_type?: string
          status_filter?: string | null
          title?: string
        }
        Relationships: []
      }
      vendor_review_events: {
        Row: {
          conducted_by: string | null
          created_at: string | null
          id: string
          lane: string
          next_due: string | null
          notes: string | null
          outcome: string | null
          review_date: string
          review_type: string
          vendor_id: string
        }
        Insert: {
          conducted_by?: string | null
          created_at?: string | null
          id?: string
          lane: string
          next_due?: string | null
          notes?: string | null
          outcome?: string | null
          review_date: string
          review_type: string
          vendor_id: string
        }
        Update: {
          conducted_by?: string | null
          created_at?: string | null
          id?: string
          lane?: string
          next_due?: string | null
          notes?: string | null
          outcome?: string | null
          review_date?: string
          review_type?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_review_events_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_status_history: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          field_changed: string
          id: string
          lane: string
          new_value: string | null
          old_value: string | null
          reason: string | null
          vendor_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          field_changed: string
          id?: string
          lane: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          vendor_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          field_changed?: string
          id?: string
          lane?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_status_history_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          active: boolean
          airport_code: string | null
          ap_license_verified: boolean
          approval_status: Database["public"]["Enums"]["vendor_approval_status"]
          approval_tier: Database["public"]["Enums"]["vendor_approval_tier"]
          city: string | null
          country: string
          created_at: string
          created_by: string | null
          crs_number: string | null
          drug_abatement_verified: boolean
          email: string | null
          id: string
          is_mrt: boolean
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          operational_status: string
          phone: string | null
          preferred: boolean
          specialties: string[] | null
          state: string | null
          tags: string[] | null
          updated_at: string
          updated_by: string | null
          vendor_type: string
          website: string | null
        }
        Insert: {
          active?: boolean
          airport_code?: string | null
          ap_license_verified?: boolean
          approval_status?: Database["public"]["Enums"]["vendor_approval_status"]
          approval_tier?: Database["public"]["Enums"]["vendor_approval_tier"]
          city?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          crs_number?: string | null
          drug_abatement_verified?: boolean
          email?: string | null
          id?: string
          is_mrt?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          operational_status?: string
          phone?: string | null
          preferred?: boolean
          specialties?: string[] | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string
          updated_by?: string | null
          vendor_type?: string
          website?: string | null
        }
        Update: {
          active?: boolean
          airport_code?: string | null
          ap_license_verified?: boolean
          approval_status?: Database["public"]["Enums"]["vendor_approval_status"]
          approval_tier?: Database["public"]["Enums"]["vendor_approval_tier"]
          city?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          crs_number?: string | null
          drug_abatement_verified?: boolean
          email?: string | null
          id?: string
          is_mrt?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          operational_status?: string
          phone?: string | null
          preferred?: boolean
          specialties?: string[] | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string
          updated_by?: string | null
          vendor_type?: string
          website?: string | null
        }
        Relationships: []
      }
      webhook_inbound_log: {
        Row: {
          error_detail: string | null
          event_count: number | null
          id: string
          inserted_count: number | null
          raw_payload: Json
          received_at: string
          skipped_count: number | null
          source: string
          status: string
        }
        Insert: {
          error_detail?: string | null
          event_count?: number | null
          id?: string
          inserted_count?: number | null
          raw_payload: Json
          received_at?: string
          skipped_count?: number | null
          source?: string
          status?: string
        }
        Update: {
          error_detail?: string | null
          event_count?: number | null
          id?: string
          inserted_count?: number | null
          raw_payload?: Json
          received_at?: string
          skipped_count?: number | null
          source?: string
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      exec_readonly_sql: { Args: { query: string }; Returns: Json }
      get_discrepancy_counts_by_tail: {
        Args: never
        Returns: {
          count: number
          registration: string
        }[]
      }
      get_fleet_analytics: {
        Args: never
        Returns: {
          acq_hours: number
          active_cat_a: number
          active_cat_b: number
          avg_resolution_days: number
          current_hours: number
          deferred_count: number
          dis_count: number
          make: string
          mel_count: number
          model_family: string
          open_count: number
          ops_hours: number
          registration: string
        }[]
      }
      get_quarterly_dis_trend: {
        Args: never
        Returns: {
          count: number
          q: number
          yr: number
        }[]
      }
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission: {
        Args: {
          required_section: Database["public"]["Enums"]["app_section"]
          user_uuid: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          required_role: Database["public"]["Enums"]["app_role"]
          user_uuid: string
        }
        Returns: boolean
      }
      is_admin_or_super: { Args: { user_uuid: string }; Returns: boolean }
      is_manager_or_above: { Args: { user_uuid: string }; Returns: boolean }
      is_my_direct_report: { Args: { subject_id: string }; Returns: boolean }
      is_super_admin: { Args: { uid: string }; Returns: boolean }
      my_profile_id: { Args: never; Returns: string }
      pm_is_board_member: { Args: { board_uuid: string }; Returns: boolean }
      pm_task_board_id: { Args: { task_uuid: string }; Returns: string }
      rv_match_chunks: {
        Args: {
          p_aircraft_id?: string
          p_limit?: number
          p_threshold?: number
          query_embedding: string
        }
        Returns: {
          aircraft_id: string
          chunk_id: string
          chunk_index: number
          chunk_text: string
          original_filename: string
          page_id: string
          page_image_path: string
          page_number: number
          record_source_id: string
          similarity: number
          source_category: string
        }[]
      }
      rv_search_events: {
        Args: {
          p_aircraft_id?: string
          p_event_type?: string
          p_limit?: number
          p_offset?: number
          p_query: string
        }
        Returns: {
          ad_sb_number: string
          aircraft_id: string
          aircraft_total_time: number
          confidence: number
          description: string
          event_date: string
          event_type: string
          id: string
          original_filename: string
          page_ids: string[]
          part_numbers: string[]
          rank: number
          record_source_id: string
          serial_numbers: string[]
          work_order_number: string
        }[]
      }
      rv_search_pages: {
        Args: {
          p_aircraft_id?: string
          p_category?: string
          p_limit?: number
          p_offset?: number
          p_query: string
          p_sort_by?: string
          p_source_id?: string
        }
        Returns: {
          aircraft_id: string
          date_range_end: string
          date_range_start: string
          observed_registration: string
          ocr_excerpt: string
          original_filename: string
          page_id: string
          page_number: number
          rank: number
          record_source_id: string
          source_category: string
        }[]
      }
      set_bb_labor_eligible: {
        Args: { eligible: boolean; target_profile_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      validate_email_before_create: { Args: { event: Json }; Returns: Json }
    }
    Enums: {
      app_role: "Super Admin" | "Admin" | "Manager" | "Technician" | "Guest"
      app_section:
        | "Dashboard"
        | "Aircraft Info"
        | "AI Assistant"
        | "Aircraft Conformity"
        | "14-Day Check"
        | "Maintenance Planning"
        | "Ten or More"
        | "Terminal-OGD"
        | "Projects"
        | "Training"
        | "Docs & Links"
        | "My Journey"
        | "Vendor Map"
        | "Compliance"
        | "Safety"
        | "Discrepancy Intelligence"
        | "Parts"
        | "External Requests"
        | "Work Orders"
        | "Records Vault"
        | "My Team"
      bb_approval_kind: "quote" | "change_order"
      bb_cert_type: "A&P" | "IA" | "A&P/IA" | "Avionics" | "Other"
      bb_invoice_line_type: "part" | "labor" | "misc" | "outside_labor"
      bb_invoice_status: "draft" | "sent" | "paid" | "void"
      bb_item_approval_status: "pending" | "approved" | "declined"
      bb_logbook_entry_status: "draft" | "signed" | "exported"
      bb_logbook_section:
        | "Airframe"
        | "Engine 1"
        | "Engine 2"
        | "Propeller"
        | "APU"
        | "Other"
      bb_part_condition: "new" | "overhauled" | "serviceable" | "as_removed"
      bb_part_transaction_type:
        | "receipt"
        | "issue"
        | "return"
        | "adjustment"
        | "scrap"
      bb_po_line_status:
        | "pending"
        | "shipped"
        | "backordered"
        | "received"
        | "cancelled"
      bb_po_status:
        | "draft"
        | "sent"
        | "partial"
        | "received"
        | "closed"
        | "voided"
      bb_priority: "routine" | "urgent" | "aog"
      bb_quote_status:
        | "draft"
        | "sent"
        | "approved"
        | "declined"
        | "expired"
        | "converted"
      bb_sop_category:
        | "Work Orders"
        | "Parts & Inventory"
        | "Logbook"
        | "Invoicing"
        | "Tool Calibration"
        | "Safety"
        | "Portal Navigation"
      bb_tool_status:
        | "active"
        | "due_soon"
        | "overdue"
        | "out_of_service"
        | "retired"
      bb_training_status:
        | "current"
        | "expiring_soon"
        | "expired"
        | "not_trained"
      bb_wo_item_status:
        | "pending"
        | "in_progress"
        | "done"
        | "needs_review"
        | "cut_short"
      bb_wo_status:
        | "draft"
        | "open"
        | "waiting_on_parts"
        | "in_review"
        | "billing"
        | "completed"
        | "void"
      user_status: "Active" | "Inactive" | "Suspended" | "Pending"
      vendor_approval_status: "approved" | "pending_review" | "suspended"
      vendor_approval_tier: "nine_or_less" | "ten_or_more" | "both"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["Super Admin", "Admin", "Manager", "Technician", "Guest"],
      app_section: [
        "Dashboard",
        "Aircraft Info",
        "AI Assistant",
        "Aircraft Conformity",
        "14-Day Check",
        "Maintenance Planning",
        "Ten or More",
        "Terminal-OGD",
        "Projects",
        "Training",
        "Docs & Links",
        "My Journey",
        "Vendor Map",
        "Compliance",
        "Safety",
        "Discrepancy Intelligence",
        "Parts",
        "External Requests",
        "Work Orders",
        "Records Vault",
        "My Team",
      ],
      bb_approval_kind: ["quote", "change_order"],
      bb_cert_type: ["A&P", "IA", "A&P/IA", "Avionics", "Other"],
      bb_invoice_line_type: ["part", "labor", "misc", "outside_labor"],
      bb_invoice_status: ["draft", "sent", "paid", "void"],
      bb_item_approval_status: ["pending", "approved", "declined"],
      bb_logbook_entry_status: ["draft", "signed", "exported"],
      bb_logbook_section: [
        "Airframe",
        "Engine 1",
        "Engine 2",
        "Propeller",
        "APU",
        "Other",
      ],
      bb_part_condition: ["new", "overhauled", "serviceable", "as_removed"],
      bb_part_transaction_type: [
        "receipt",
        "issue",
        "return",
        "adjustment",
        "scrap",
      ],
      bb_po_line_status: [
        "pending",
        "shipped",
        "backordered",
        "received",
        "cancelled",
      ],
      bb_po_status: [
        "draft",
        "sent",
        "partial",
        "received",
        "closed",
        "voided",
      ],
      bb_priority: ["routine", "urgent", "aog"],
      bb_quote_status: [
        "draft",
        "sent",
        "approved",
        "declined",
        "expired",
        "converted",
      ],
      bb_sop_category: [
        "Work Orders",
        "Parts & Inventory",
        "Logbook",
        "Invoicing",
        "Tool Calibration",
        "Safety",
        "Portal Navigation",
      ],
      bb_tool_status: [
        "active",
        "due_soon",
        "overdue",
        "out_of_service",
        "retired",
      ],
      bb_training_status: [
        "current",
        "expiring_soon",
        "expired",
        "not_trained",
      ],
      bb_wo_item_status: [
        "pending",
        "in_progress",
        "done",
        "needs_review",
        "cut_short",
      ],
      bb_wo_status: [
        "draft",
        "open",
        "waiting_on_parts",
        "in_review",
        "billing",
        "completed",
        "void",
      ],
      user_status: ["Active", "Inactive", "Suspended", "Pending"],
      vendor_approval_status: ["approved", "pending_review", "suspended"],
      vendor_approval_tier: ["nine_or_less", "ten_or_more", "both"],
    },
  },
} as const
