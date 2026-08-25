export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      academic_year: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          is_current: boolean
          label: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          is_current?: boolean
          label: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          is_current?: boolean
          label?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: []
      }
      branch: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense: {
        Row: {
          academic_year_id: string
          amount_paise: number
          branch_id: string
          category_id: string
          created_at: string
          created_by: string
          id: string
          method: string
          note: string | null
          reference: string | null
          spent_on: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academic_year_id: string
          amount_paise: number
          branch_id: string
          category_id: string
          created_at?: string
          created_by: string
          id?: string
          method: string
          note?: string | null
          reference?: string | null
          spent_on: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academic_year_id?: string
          amount_paise?: number
          branch_id?: string
          category_id?: string
          created_at?: string
          created_by?: string
          id?: string
          method?: string
          note?: string | null
          reference?: string | null
          spent_on?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "fee_account_record"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "expense_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_category_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_category: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      fee_account: {
        Row: {
          academic_year_id: string
          created_at: string
          due_date: string
          ends_on: string
          id: string
          pickup_point: string | null
          route_name: string | null
          service_type: string
          slot: string | null
          starts_on: string
          status: string
          student_id: string
          total_receivable_paise: number
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          due_date: string
          ends_on: string
          id?: string
          pickup_point?: string | null
          route_name?: string | null
          service_type: string
          slot?: string | null
          starts_on: string
          status?: string
          student_id: string
          total_receivable_paise: number
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          due_date?: string
          ends_on?: string
          id?: string
          pickup_point?: string | null
          route_name?: string | null
          service_type?: string
          slot?: string | null
          starts_on?: string
          status?: string
          student_id?: string
          total_receivable_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_account_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_account_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_account_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      payment: {
        Row: {
          amount_paise: number
          fee_account_id: string
          id: string
          method: string
          note: string | null
          paid_on: string
          recorded_by: string
          reference: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          amount_paise: number
          fee_account_id: string
          id?: string
          method: string
          note?: string | null
          paid_on: string
          recorded_by: string
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          amount_paise?: number
          fee_account_id?: string
          id?: string
          method?: string
          note?: string | null
          paid_on?: string
          recorded_by?: string
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_fee_account_id_fkey"
            columns: ["fee_account_id"]
            isOneToOne: false
            referencedRelation: "fee_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_fee_account_id_fkey"
            columns: ["fee_account_id"]
            isOneToOne: false
            referencedRelation: "fee_account_balance"
            referencedColumns: ["fee_account_id"]
          },
          {
            foreignKeyName: "payment_fee_account_id_fkey"
            columns: ["fee_account_id"]
            isOneToOne: false
            referencedRelation: "fee_account_record"
            referencedColumns: ["fee_account_id"]
          },
        ]
      }
      payment_submission: {
        Row: {
          amount_paise: number
          branch_id: string
          created_at: string
          created_payment_id: string | null
          fee_account_id: string | null
          id: string
          method: string
          note: string | null
          paid_on: string
          reference: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          amount_paise: number
          branch_id: string
          created_at?: string
          created_payment_id?: string | null
          fee_account_id?: string | null
          id?: string
          method: string
          note?: string | null
          paid_on: string
          reference?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          amount_paise?: number
          branch_id?: string
          created_at?: string
          created_payment_id?: string | null
          fee_account_id?: string | null
          id?: string
          method?: string
          note?: string | null
          paid_on?: string
          reference?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_submission_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submission_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "fee_account_record"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "payment_submission_created_payment_id_fkey"
            columns: ["created_payment_id"]
            isOneToOne: false
            referencedRelation: "payment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submission_fee_account_id_fkey"
            columns: ["fee_account_id"]
            isOneToOne: false
            referencedRelation: "fee_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submission_fee_account_id_fkey"
            columns: ["fee_account_id"]
            isOneToOne: false
            referencedRelation: "fee_account_balance"
            referencedColumns: ["fee_account_id"]
          },
          {
            foreignKeyName: "payment_submission_fee_account_id_fkey"
            columns: ["fee_account_id"]
            isOneToOne: false
            referencedRelation: "fee_account_record"
            referencedColumns: ["fee_account_id"]
          },
          {
            foreignKeyName: "payment_submission_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submission_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          branch_id: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          full_name?: string
          id: string
          is_active?: boolean
          role: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "fee_account_record"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      student: {
        Row: {
          admission_no: string
          branch_id: string
          class_section: string
          created_at: string
          full_name: string
          guardian_name: string
          id: string
          notes: string | null
          phone: string
          status: string
          updated_at: string
        }
        Insert: {
          admission_no: string
          branch_id: string
          class_section: string
          created_at?: string
          full_name: string
          guardian_name: string
          id?: string
          notes?: string | null
          phone: string
          status?: string
          updated_at?: string
        }
        Update: {
          admission_no?: string
          branch_id?: string
          class_section?: string
          created_at?: string
          full_name?: string
          guardian_name?: string
          id?: string
          notes?: string | null
          phone?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "fee_account_record"
            referencedColumns: ["branch_id"]
          },
        ]
      }
      student_delete_submission: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_admission_no: string
          student_full_name: string
          student_id: string | null
          submitted_at: string
          submitted_by: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_admission_no: string
          student_full_name: string
          student_id?: string | null
          submitted_at?: string
          submitted_by: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_admission_no?: string
          student_full_name?: string
          student_id?: string | null
          submitted_at?: string
          submitted_by?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_delete_submission_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_delete_submission_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "fee_account_record"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "student_delete_submission_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_delete_submission_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_delete_submission_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_delete_submission_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      student_edit_submission: {
        Row: {
          applied_at: string | null
          branch_id: string
          class_section: string
          created_at: string
          due_date: string
          ends_on: string
          fee_account_id: string | null
          fee_account_status: string
          full_name: string
          guardian_name: string
          id: string
          notes: string | null
          phone: string
          pickup_point: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          route_name: string | null
          slot: string | null
          starts_on: string
          status: string
          student_id: string | null
          submitted_at: string
          submitted_by: string
          total_receivable_paise: number
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          branch_id: string
          class_section: string
          created_at?: string
          due_date: string
          ends_on: string
          fee_account_id?: string | null
          fee_account_status: string
          full_name: string
          guardian_name: string
          id?: string
          notes?: string | null
          phone: string
          pickup_point?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_name?: string | null
          slot?: string | null
          starts_on: string
          status?: string
          student_id?: string | null
          submitted_at?: string
          submitted_by: string
          total_receivable_paise: number
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          branch_id?: string
          class_section?: string
          created_at?: string
          due_date?: string
          ends_on?: string
          fee_account_id?: string | null
          fee_account_status?: string
          full_name?: string
          guardian_name?: string
          id?: string
          notes?: string | null
          phone?: string
          pickup_point?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_name?: string | null
          slot?: string | null
          starts_on?: string
          status?: string
          student_id?: string | null
          submitted_at?: string
          submitted_by?: string
          total_receivable_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_edit_submission_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_edit_submission_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "fee_account_record"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "student_edit_submission_fee_account_id_fkey"
            columns: ["fee_account_id"]
            isOneToOne: false
            referencedRelation: "fee_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_edit_submission_fee_account_id_fkey"
            columns: ["fee_account_id"]
            isOneToOne: false
            referencedRelation: "fee_account_balance"
            referencedColumns: ["fee_account_id"]
          },
          {
            foreignKeyName: "student_edit_submission_fee_account_id_fkey"
            columns: ["fee_account_id"]
            isOneToOne: false
            referencedRelation: "fee_account_record"
            referencedColumns: ["fee_account_id"]
          },
          {
            foreignKeyName: "student_edit_submission_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_edit_submission_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_edit_submission_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_edit_submission_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      student_submission: {
        Row: {
          academic_year_id: string
          admission_no: string
          branch_id: string
          class_section: string
          created_at: string
          created_student_id: string | null
          due_date: string
          ends_on: string
          full_name: string
          guardian_name: string
          id: string
          notes: string | null
          phone: string
          pickup_point: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          route_name: string | null
          service_type: string
          slot: string | null
          starts_on: string
          status: string
          submitted_at: string
          submitted_by: string
          total_receivable_paise: number
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          admission_no: string
          branch_id: string
          class_section: string
          created_at?: string
          created_student_id?: string | null
          due_date: string
          ends_on: string
          full_name: string
          guardian_name: string
          id?: string
          notes?: string | null
          phone: string
          pickup_point?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_name?: string | null
          service_type: string
          slot?: string | null
          starts_on: string
          status?: string
          submitted_at?: string
          submitted_by: string
          total_receivable_paise: number
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          admission_no?: string
          branch_id?: string
          class_section?: string
          created_at?: string
          created_student_id?: string | null
          due_date?: string
          ends_on?: string
          full_name?: string
          guardian_name?: string
          id?: string
          notes?: string | null
          phone?: string
          pickup_point?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_name?: string | null
          service_type?: string
          slot?: string | null
          starts_on?: string
          status?: string
          submitted_at?: string
          submitted_by?: string
          total_receivable_paise?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_submission_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_submission_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_submission_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "fee_account_record"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "student_submission_created_student_id_fkey"
            columns: ["created_student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_submission_created_student_id_fkey"
            columns: ["created_student_id"]
            isOneToOne: false
            referencedRelation: "student_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_submission_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_submission_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      expense_category_summary: {
        Row: {
          expense_count: number | null
          id: string | null
          is_active: boolean | null
          name: string | null
          sort_order: number | null
          total_spent_paise: number | null
        }
        Relationships: []
      }
      expense_record: {
        Row: {
          academic_year_id: string | null
          amount_paise: number | null
          branch_code: string | null
          branch_id: string | null
          branch_name: string | null
          category_id: string | null
          category_name: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          id: string | null
          method: string | null
          note: string | null
          reference: string | null
          spent_on: string | null
          updated_at: string | null
          updated_by: string | null
          updated_by_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "fee_account_record"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "expense_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_category_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_account_balance: {
        Row: {
          academic_year_id: string | null
          collected_paise: number | null
          due_date: string | null
          ends_on: string | null
          fee_account_id: string | null
          last_paid_on: string | null
          pending_paise: number | null
          pickup_point: string | null
          route_name: string | null
          service_type: string | null
          slot: string | null
          starts_on: string | null
          status: string | null
          student_id: string | null
          total_receivable_paise: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_account_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_account_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_account_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_account_record: {
        Row: {
          academic_year_id: string | null
          branch_code: string | null
          branch_id: string | null
          branch_name: string | null
          class_section: string | null
          collected_paise: number | null
          due_date: string | null
          ends_on: string | null
          fee_account_id: string | null
          last_paid_on: string | null
          pending_paise: number | null
          pickup_point: string | null
          route_name: string | null
          service_type: string | null
          slot: string | null
          starts_on: string | null
          status: string | null
          student_admission_no: string | null
          student_full_name: string | null
          student_guardian_name: string | null
          student_id: string | null
          student_notes: string | null
          student_phone: string | null
          student_status: string | null
          total_receivable_paise: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_account_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_year"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_account_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_account_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "student_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      student_directory: {
        Row: {
          academic_year_ids: string[] | null
          admission_no: string | null
          branch_code: string | null
          branch_name: string | null
          class_section: string | null
          created_at: string | null
          fee_account_count: number | null
          fee_accounts: Json | null
          full_name: string | null
          guardian_name: string | null
          has_daycare: boolean | null
          has_overdue: boolean | null
          has_transport: boolean | null
          id: string | null
          phone: string | null
          status: string | null
          total_pending_paise: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_payment_submission: { Args: { p_id: string }; Returns: string }
      approve_student_delete: { Args: { p_id: string }; Returns: undefined }
      approve_student_edit: { Args: { p_id: string }; Returns: undefined }
      approve_student_submission: { Args: { p_id: string }; Returns: string }
      auth_branch_id: { Args: never; Returns: string }
      auth_is_admin: { Args: never; Returns: boolean }
      auth_role: { Args: never; Returns: string }
      dashboard_ageing_buckets: {
        Args: {
          p_academic_year_id: string
          p_branch_code?: string
          p_service_type: string
        }
        Returns: {
          account_count: number
          bucket: string
          pending_paise: number
        }[]
      }
      dashboard_breakdown_by_class: {
        Args: {
          p_academic_year_id: string
          p_branch_code?: string
          p_service_type: string
        }
        Returns: {
          class_section: string
          collected_paise: number
          pending_paise: number
          receivable_paise: number
          student_count: number
        }[]
      }
      dashboard_breakdown_by_group: {
        Args: {
          p_academic_year_id: string
          p_branch_code?: string
          p_service_type: string
        }
        Returns: {
          collected_paise: number
          group_label: string
          pending_paise: number
          receivable_paise: number
          student_count: number
        }[]
      }
      dashboard_collection_by_month: {
        Args: {
          p_academic_year_id: string
          p_branch_code?: string
          p_service_type: string
        }
        Returns: {
          collected_paise: number
          month: string
        }[]
      }
      dashboard_summary: {
        Args: {
          p_academic_year_id: string
          p_branch_code?: string
          p_service_type: string
        }
        Returns: {
          student_count: number
          total_collected_paise: number
          total_overdue_paise: number
          total_pending_paise: number
          total_receivable_paise: number
        }[]
      }
      expense_category_breakdown: {
        Args: { p_academic_year_id: string; p_branch_code?: string }
        Returns: {
          amount_paise: number
          category_id: string
          category_name: string
        }[]
      }
      profile_full_name: { Args: { p_id: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

