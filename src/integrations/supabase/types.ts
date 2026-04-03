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
      customers: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone_number: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone_number?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone_number?: string | null
        }
        Relationships: []
      }
      kit_devices: {
        Row: {
          created_at: string | null
          created_by_user_id: string | null
          id: string
          product_name: string
        }
        Insert: {
          created_at?: string | null
          created_by_user_id?: string | null
          id?: string
          product_name: string
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string | null
          id?: string
          product_name?: string
        }
        Relationships: []
      }
      pack_stations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number
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
          disabled: boolean
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          disabled?: boolean
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          disabled?: boolean
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      role_page_defaults: {
        Row: {
          created_at: string | null
          id: string
          page_path: string
          role: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          page_path: string
          role: string
        }
        Update: {
          created_at?: string | null
          id?: string
          page_path?: string
          role?: string
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
          has_issue: boolean | null
          id: string
          issue_marked_at: string | null
          issue_marked_by_user_id: string | null
          label_url: string | null
          location_id: string | null
          manifest_url: string | null
          order_group_id: string | null
          order_id: string
          pack_station_id: string | null
          packed: boolean | null
          packed_at: string | null
          packed_by_user_id: string | null
          price: string | null
          printed: boolean | null
          printed_at: string | null
          printed_by_user_id: string | null
          product_name: string | null
          quantity: number | null
          raw: Json | null
          search_vector: unknown
          shipengine_label_id: string | null
          shipping_cost: number | null
          shipping_price: string | null
          shipping_provider: string | null
          show_date: string | null
          tracking: string | null
          uid: string | null
          unit_id: string | null
          upload_id: string | null
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
          has_issue?: boolean | null
          id?: string
          issue_marked_at?: string | null
          issue_marked_by_user_id?: string | null
          label_url?: string | null
          location_id?: string | null
          manifest_url?: string | null
          order_group_id?: string | null
          order_id: string
          pack_station_id?: string | null
          packed?: boolean | null
          packed_at?: string | null
          packed_by_user_id?: string | null
          price?: string | null
          printed?: boolean | null
          printed_at?: string | null
          printed_by_user_id?: string | null
          product_name?: string | null
          quantity?: number | null
          raw?: Json | null
          search_vector?: unknown
          shipengine_label_id?: string | null
          shipping_cost?: number | null
          shipping_price?: string | null
          shipping_provider?: string | null
          show_date?: string | null
          tracking?: string | null
          uid?: string | null
          unit_id?: string | null
          upload_id?: string | null
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
          has_issue?: boolean | null
          id?: string
          issue_marked_at?: string | null
          issue_marked_by_user_id?: string | null
          label_url?: string | null
          location_id?: string | null
          manifest_url?: string | null
          order_group_id?: string | null
          order_id?: string
          pack_station_id?: string | null
          packed?: boolean | null
          packed_at?: string | null
          packed_by_user_id?: string | null
          price?: string | null
          printed?: boolean | null
          printed_at?: string | null
          printed_by_user_id?: string | null
          product_name?: string | null
          quantity?: number | null
          raw?: Json | null
          search_vector?: unknown
          shipengine_label_id?: string | null
          shipping_cost?: number | null
          shipping_price?: string | null
          shipping_provider?: string | null
          show_date?: string | null
          tracking?: string | null
          uid?: string | null
          unit_id?: string | null
          upload_id?: string | null
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
          {
            foreignKeyName: "shipments_pack_station_id_fkey"
            columns: ["pack_station_id"]
            isOneToOne: false
            referencedRelation: "pack_stations"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments_archive: {
        Row: {
          address_full: string | null
          archived_at: string | null
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
          has_issue: boolean | null
          id: string
          issue_marked_at: string | null
          issue_marked_by_user_id: string | null
          label_url: string | null
          location_id: string | null
          manifest_url: string | null
          order_group_id: string | null
          order_id: string
          pack_station_id: string | null
          packed: boolean | null
          packed_at: string | null
          packed_by_user_id: string | null
          price: string | null
          printed: boolean | null
          printed_at: string | null
          printed_by_user_id: string | null
          product_name: string | null
          quantity: number | null
          raw: Json | null
          search_vector: unknown
          shipengine_label_id: string | null
          shipping_cost: number | null
          shipping_price: string | null
          shipping_provider: string | null
          show_date: string | null
          tracking: string | null
          uid: string | null
          unit_id: string | null
          user_id: string | null
        }
        Insert: {
          address_full?: string | null
          archived_at?: string | null
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
          has_issue?: boolean | null
          id?: string
          issue_marked_at?: string | null
          issue_marked_by_user_id?: string | null
          label_url?: string | null
          location_id?: string | null
          manifest_url?: string | null
          order_group_id?: string | null
          order_id: string
          pack_station_id?: string | null
          packed?: boolean | null
          packed_at?: string | null
          packed_by_user_id?: string | null
          price?: string | null
          printed?: boolean | null
          printed_at?: string | null
          printed_by_user_id?: string | null
          product_name?: string | null
          quantity?: number | null
          raw?: Json | null
          search_vector?: unknown
          shipengine_label_id?: string | null
          shipping_cost?: number | null
          shipping_price?: string | null
          shipping_provider?: string | null
          show_date?: string | null
          tracking?: string | null
          uid?: string | null
          unit_id?: string | null
          user_id?: string | null
        }
        Update: {
          address_full?: string | null
          archived_at?: string | null
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
          has_issue?: boolean | null
          id?: string
          issue_marked_at?: string | null
          issue_marked_by_user_id?: string | null
          label_url?: string | null
          location_id?: string | null
          manifest_url?: string | null
          order_group_id?: string | null
          order_id?: string
          pack_station_id?: string | null
          packed?: boolean | null
          packed_at?: string | null
          packed_by_user_id?: string | null
          price?: string | null
          printed?: boolean | null
          printed_at?: string | null
          printed_by_user_id?: string | null
          product_name?: string | null
          quantity?: number | null
          raw?: Json | null
          search_vector?: unknown
          shipengine_label_id?: string | null
          shipping_cost?: number | null
          shipping_price?: string | null
          shipping_provider?: string | null
          show_date?: string | null
          tracking?: string | null
          uid?: string | null
          unit_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sms_conversations: {
        Row: {
          contact_name: string | null
          created_at: string
          customer_id: string | null
          id: string
          last_message_at: string | null
          phone_number: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          last_message_at?: string | null
          phone_number: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          last_message_at?: string | null
          phone_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          sent_by_user_id: string | null
          status: string
          twilio_sid: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          sent_by_user_id?: string | null
          status?: string
          twilio_sid?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          sent_by_user_id?: string | null
          status?: string
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sms_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_page_permissions: {
        Row: {
          allowed: boolean
          created_at: string
          id: string
          page_path: string
          user_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string
          id?: string
          page_path: string
          user_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string
          id?: string
          page_path?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
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
      archive_shipments_batch: {
        Args: { batch_size?: number; days_to_keep: number }
        Returns: {
          batch_archived: number
          has_more: boolean
          total_remaining: number
        }[]
      }
      assign_location_to_bundle: {
        Args: { p_location_code: string; p_order_group_id: string }
        Returns: undefined
      }
      find_shipment_by_uid: {
        Args: { p_uid: string }
        Returns: {
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
          has_issue: boolean | null
          id: string
          issue_marked_at: string | null
          issue_marked_by_user_id: string | null
          label_url: string | null
          location_id: string | null
          manifest_url: string | null
          order_group_id: string | null
          order_id: string
          pack_station_id: string | null
          packed: boolean | null
          packed_at: string | null
          packed_by_user_id: string | null
          price: string | null
          printed: boolean | null
          printed_at: string | null
          printed_by_user_id: string | null
          product_name: string | null
          quantity: number | null
          raw: Json | null
          search_vector: unknown
          shipengine_label_id: string | null
          shipping_cost: number | null
          shipping_price: string | null
          shipping_provider: string | null
          show_date: string | null
          tracking: string | null
          uid: string | null
          unit_id: string | null
          upload_id: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "shipments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_analytics_kpis: {
        Args: { end_date: string; p_user_id?: string; start_date: string }
        Returns: {
          bundle_orders: number
          cancelled_orders: number
          printed_orders: number
          successful_prints: number
          total_orders: number
          total_print_jobs: number
        }[]
      }
      get_archive_stats: {
        Args: never
        Returns: {
          active_count: number
          archived_count: number
          newest_archived_date: string
          oldest_active_date: string
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
        Args: { end_date: string; p_user_id?: string; start_date: string }
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
        Args: { end_date: string; p_user_id?: string; start_date: string }
        Returns: {
          hour: number
          print_count: number
        }[]
      }
      get_incomplete_bundles_for_date: {
        Args: { p_printed_date?: string; p_show_date: string }
        Returns: {
          buyer: string
          printed_items: Json
          printed_today_count: number
          total_count: number
          tracking: string
          unprinted_count: number
          unprinted_items: Json
        }[]
      }
      get_location_occupancy: {
        Args: never
        Returns: {
          buyer: string
          category: string
          is_active: boolean
          is_occupied: boolean
          location_code: string
          order_group_id: string
          printed_count: number
          sort_order: number
          total_count: number
        }[]
      }
      get_next_available_location: { Args: never; Returns: string }
      get_print_status_breakdown: {
        Args: { end_date: string; p_user_id?: string; start_date: string }
        Returns: {
          count: number
          status: string
        }[]
      }
      get_printer_performance: {
        Args: {
          end_date: string
          p_user_id?: string
          start_date: string
          top_limit?: number
        }
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
      get_shipments_stats_with_archive:
        | {
            Args: {
              p_filter?: string
              p_include_archive?: boolean
              p_printed?: boolean
              p_show_date?: string
              search_term?: string
            }
            Returns: {
              archived: number
              exceptions: number
              printed: number
              total: number
              unprinted: number
            }[]
          }
        | {
            Args: {
              p_channel?: string
              p_filter?: string
              p_include_archive?: boolean
              p_printed?: boolean
              p_show_date?: string
              p_strict?: boolean
              search_term?: string
            }
            Returns: {
              archived: number
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
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      increment_batch_count: {
        Args: { batch_uuid: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      search_all_shipments: {
        Args: {
          p_channel?: string
          p_filter?: string
          p_include_archive?: boolean
          p_limit?: number
          p_offset?: number
          p_printed?: boolean
          p_show_date?: string
          p_strict?: boolean
          search_term?: string
        }
        Returns: {
          address_full: string
          bundle: boolean
          buyer: string
          cancelled: string
          channel: string
          created_at: string
          group_id_printed: boolean
          group_id_printed_at: string
          group_id_printed_by_email: string
          group_id_printed_by_user_id: string
          id: string
          is_archived: boolean
          label_url: string
          location_id: string
          manifest_url: string
          order_group_id: string
          order_id: string
          price: string
          printed: boolean
          printed_at: string
          printed_by_email: string
          printed_by_user_id: string
          product_name: string
          quantity: number
          shipping_cost: number
          show_date: string
          tracking: string
          uid: string
          unit_id: string
          user_id: string
        }[]
      }
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
              group_id_printed_by_email: string
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
              printed_by_email: string
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
              p_channel?: string
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
              group_id_printed_by_email: string
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
              printed_by_email: string
              printed_by_user_id: string
              product_name: string
              quantity: number
              show_date: string
              tracking: string
              uid: string
              user_id: string
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
  public: {
    Enums: {},
  },
} as const
