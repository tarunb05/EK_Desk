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
    }
    Views: {
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
        ]
      }
    }
    Functions: {
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

