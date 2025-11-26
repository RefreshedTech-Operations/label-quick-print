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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      batches: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          name: string
          notes: string | null
          package_count: number
          shipped_at: string | null
          show_date: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name: string
          notes?: string | null
          package_count?: number
          shipped_at?: string | null
          show_date?: string | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          package_count?: number
          shipped_at?: string | null
          show_date?: string | null
          status?: string
        }
        Relationships: []
      }
      bundle_locations: {
        Row: {
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          location_code: string
          sort_order: number
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_code: string
          sort_order: number
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_code?: string
          sort_order?: number
        }
        Relationships: []
      }
      column_mappings: {
        Row: {
          created_at: string | null
          id: string
          mapping: Json
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          mapping: Json
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          mapping?: Json
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      print_jobs: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          label_url: string | null
          order_id: string | null
          printer_id: string | null
          printnode_job_id: number | null
          shipment_id: string | null
          status: string | null
          uid: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id?: string
          label_url?: string | null
          order_id?: string | null
          printer_id?: string | null
          printnode_job_id?: number | null
          shipment_id?: string | null
          status?: string | null
          uid?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          label_url?: string | null
          order_id?: string | null
          printer_id?: string | null
          printnode_job_id?: number | null
          shipment_id?: string | null
          status?: string | null
          uid?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          address_full: string | null
          batch_id: string | null
          batch_scanned_at: string | null
          batch_scanned_by_user_id: string | null
          bundle: boolean | null
          buyer: string | null
          cancelled: string | null
          channel: string | null
          created_at: string | null
          group_id_printed: boolean | null
          group_id_printed_at: string | null
          group_id_printed_by_user_id: string | null
          id: string
          label_url: string | null
          location_id: string | null
          manifest_url: string | null
          order_group_id: string | null
          order_id: string
          price: string | null
          printed: boolean | null
          printed_at: string | null
          printed_by_user_id: string | null
          product_name: string | null
          quantity: number | null
          raw: Json | null
          search_vector: unknown
          show_date: string | null
          tracking: string | null
          uid: string | null
          user_id: string | null
        }
        Insert: {
          address_full?: string | null
          batch_id?: string | null
          batch_scanned_at?: string | null
          batch_scanned_by_user_id?: string | null
          bundle?: boolean | null
          buyer?: string | null
          cancelled?: string | null
          channel?: string | null
          created_at?: string | null
          group_id_printed?: boolean | null
          group_id_printed_at?: string | null
          group_id_printed_by_user_id?: string | null
          id?: string
          label_url?: string | null
          location_id?: string | null
          manifest_url?: string | null
          order_group_id?: string | null
          order_id: string
          price?: string | null
          printed?: boolean | null
          printed_at?: string | null
          printed_by_user_id?: string | null
          product_name?: string | null
          quantity?: number | null
          raw?: Json | null
          search_vector?: unknown
          show_date?: string | null
          tracking?: string | null
          uid?: string | null
          user_id?: string | null
        }
        Update: {
          address_full?: string | null
          batch_id?: string | null
          batch_scanned_at?: string | null
          batch_scanned_by_user_id?: string | null
          bundle?: boolean | null
          buyer?: string | null
          cancelled?: string | null
          channel?: string | null
          created_at?: string | null
          group_id_printed?: boolean | null
          group_id_printed_at?: string | null
          group_id_printed_by_user_id?: string | null
          id?: string
          label_url?: string | null
          location_id?: string | null
          manifest_url?: string | null
          order_group_id?: string | null
          order_id?: string
          price?: string | null
          printed?: boolean | null
          printed_at?: string | null
          printed_by_user_id?: string | null
          product_name?: string | null
          quantity?: number | null
          raw?: Json | null
          search_vector?: unknown
          show_date?: string | null
          tracking?: string | null
          uid?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          auto_print: boolean | null
          block_cancelled: boolean | null
          created_at: string
          default_printer_id: string | null
          fallback_uid_from_description: boolean | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_print?: boolean | null
          block_cancelled?: boolean | null
          created_at?: string
          default_printer_id?: string | null
          fallback_uid_from_description?: boolean | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_print?: boolean | null
          block_cancelled?: boolean | null
          created_at?: string
          default_printer_id?: string | null
          fallback_uid_from_description?: boolean | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_location_to_bundle: {
        Args: { p_location_code: string; p_order_group_id: string }
        Returns: undefined
      }
      get_analytics_kpis: {
        Args: { end_date: string; start_date: string }
        Returns: {
          bundle_orders: number
          cancelled_orders: number
          printed_orders: number
          successful_prints: number
          total_orders: number
          total_print_jobs: number
        }[]
      }
      get_batch_stats: {
        Args: { batch_uuid: string }
        Returns: {
          remaining_packages: number
          scanned_packages: number
          total_packages: number
        }[]
      }
      get_daily_analytics: {
        Args: { end_date: string; start_date: string }
        Returns: {
          bundle_orders: number
          cancelled_orders: number
          date: string
          print_jobs_count: number
          printed_orders: number
          total_orders: number
          unprinted_orders: number
        }[]
      }
      get_hourly_print_rate: {
        Args: { end_date: string; start_date: string }
        Returns: {
          hour: number
          print_count: number
        }[]
      }
      get_next_available_location: { Args: never; Returns: string }
      get_print_status_breakdown: {
        Args: { end_date: string; start_date: string }
        Returns: {
          count: number
          status: string
        }[]
      }
      get_printer_performance: {
        Args: { end_date: string; start_date: string; top_limit?: number }
        Returns: {
          job_count: number
          printer_id: string
        }[]
      }
      get_scan_eligible_shipments: {
        Args: { p_batch_id?: string; p_limit?: number; p_show_date: string }
        Returns: {
          batch_id: string
          buyer: string
          id: string
          order_id: string
          printed: boolean
          product_name: string
          tracking: string
        }[]
      }
      get_shipments_stats:
        | {
            Args: { p_show_date?: string; search_term?: string }
            Returns: {
              exceptions: number
              printed: number
              total: number
              unprinted: number
            }[]
          }
        | {
            Args: {
              p_filter?: string
              p_printed?: boolean
              p_show_date?: string
              search_term?: string
            }
            Returns: {
              exceptions: number
              printed: number
              total: number
              unprinted: number
            }[]
          }
      get_show_date_counts: {
        Args: { limit_rows?: number }
        Returns: {
          count: number
          show_date: string
          unprinted_count: number
        }[]
      }
      get_tv_dashboard_stats: { Args: { target_date?: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_batch_count: {
        Args: { batch_uuid: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      search_shipments:
        | {
            Args: {
              p_filter?: string
              p_limit?: number
              p_offset?: number
              p_printed?: boolean
              p_show_date?: string
              search_term: string
            }
            Returns: {
              address_full: string
              bundle: boolean
              buyer: string
              cancelled: string
              created_at: string
              group_id_printed: boolean
              group_id_printed_at: string
              group_id_printed_by_user_id: string
              id: string
              label_url: string
              location_id: string
              manifest_url: string
              order_group_id: string
              order_id: string
              price: string
              printed: boolean
              printed_at: string
              printed_by_user_id: string
              product_name: string
              quantity: number
              show_date: string
              tracking: string
              uid: string
              user_id: string
            }[]
          }
        | {
            Args: {
              p_limit?: number
              p_offset?: number
              p_printed?: boolean
              p_show_date?: string
              search_term: string
            }
            Returns: {
              address_full: string
              bundle: boolean
              buyer: string
              cancelled: string
              created_at: string
              group_id_printed: boolean
              group_id_printed_at: string
              group_id_printed_by_user_id: string
              id: string
              label_url: string
              location_id: string
              manifest_url: string
              order_group_id: string
              order_id: string
              price: string
              printed: boolean
              printed_at: string
              printed_by_user_id: string
              product_name: string
              quantity: number
              show_date: string
              tracking: string
              uid: string
              user_id: string
            }[]
          }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
