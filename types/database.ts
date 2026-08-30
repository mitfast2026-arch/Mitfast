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
    PostgrestVersion: "14.5"
  }
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
      api_rate_limit_log: {
        Row: {
          created_at: string
          id: number
          rate_key: string
          scope: string
        }
        Insert: {
          created_at?: string
          id?: number
          rate_key: string
          scope: string
        }
        Update: {
          created_at?: string
          id?: number
          rate_key?: string
          scope?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          business_address: string | null
          business_email: string | null
          business_phone: string | null
          company_name: string
          created_at: string
          currency: string
          google_login_enabled: boolean
          id: string
          logo_url: string | null
          max_product_images: number
          minimum_rfq_value: number
          product_approval_required: boolean
          products_banner_url: string | null
          supplier_approval_required: boolean
          updated_at: string
          website: string | null
        }
        Insert: {
          business_address?: string | null
          business_email?: string | null
          business_phone?: string | null
          company_name?: string
          created_at?: string
          currency?: string
          google_login_enabled?: boolean
          id?: string
          logo_url?: string | null
          max_product_images?: number
          minimum_rfq_value?: number
          product_approval_required?: boolean
          products_banner_url?: string | null
          supplier_approval_required?: boolean
          updated_at?: string
          website?: string | null
        }
        Update: {
          business_address?: string | null
          business_email?: string | null
          business_phone?: string | null
          company_name?: string
          created_at?: string
          currency?: string
          google_login_enabled?: boolean
          id?: string
          logo_url?: string | null
          max_product_images?: number
          minimum_rfq_value?: number
          product_approval_required?: boolean
          products_banner_url?: string | null
          supplier_approval_required?: boolean
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          added_at: string
          cart_id: string
          id: string
          product_id: string
          quantity: number
        }
        Insert: {
          added_at?: string
          cart_id: string
          id?: string
          product_id: string
          quantity: number
        }
        Update: {
          added_at?: string
          cart_id?: string
          id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          image_storage_path: string | null
          image_url: string | null
          name: string
          status: Database["public"]["Enums"]["category_status"]
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          image_storage_path?: string | null
          image_url?: string | null
          name: string
          status?: Database["public"]["Enums"]["category_status"]
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          image_storage_path?: string | null
          image_url?: string | null
          name?: string
          status?: Database["public"]["Enums"]["category_status"]
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          city: string
          country: string
          created_at: string
          customer_id: string
          id: string
          postal_code: string
          state: string
          updated_at: string
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          city: string
          country?: string
          created_at?: string
          customer_id: string
          id?: string
          postal_code: string
          state: string
          updated_at?: string
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          city?: string
          country?: string
          created_at?: string
          customer_id?: string
          id?: string
          postal_code?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiries: {
        Row: {
          attachment_path: string | null
          attachment_url: string | null
          company_name: string | null
          country: string | null
          created_at: string
          customer_id: string | null
          enquiry_type: string
          guest_email: string
          guest_name: string
          guest_phone: string
          id: string
          line_items: Json | null
          message: string
          product_id: string | null
          responded_at: string | null
          responded_by: string | null
          response_message: string | null
          status: Database["public"]["Enums"]["enquiry_status"]
          tracking_token: string | null
          updated_at: string
        }
        Insert: {
          attachment_path?: string | null
          attachment_url?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string | null
          enquiry_type?: string
          guest_email: string
          guest_name: string
          guest_phone: string
          id?: string
          line_items?: Json | null
          message: string
          product_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response_message?: string | null
          status?: Database["public"]["Enums"]["enquiry_status"]
          tracking_token?: string | null
          updated_at?: string
        }
        Update: {
          attachment_path?: string | null
          attachment_url?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string | null
          enquiry_type?: string
          guest_email?: string
          guest_name?: string
          guest_phone?: string
          id?: string
          line_items?: Json | null
          message?: string
          product_id?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response_message?: string | null
          status?: Database["public"]["Enums"]["enquiry_status"]
          tracking_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_cart_items: {
        Row: {
          added_at: string
          guest_session_id: string
          id: string
          product_id: string
          quantity: number
        }
        Insert: {
          added_at?: string
          guest_session_id: string
          id?: string
          product_id: string
          quantity: number
        }
        Update: {
          added_at?: string
          guest_session_id?: string
          id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "guest_cart_items_guest_session_id_fkey"
            columns: ["guest_session_id"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
      guest_wishlist_items: {
        Row: {
          added_at: string
          guest_session_id: string
          id: string
          product_id: string
        }
        Insert: {
          added_at?: string
          guest_session_id: string
          id?: string
          product_id: string
        }
        Update: {
          added_at?: string
          guest_session_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_wishlist_items_guest_session_id_fkey"
            columns: ["guest_session_id"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_assets: {
        Row: {
          containers_image_url: string | null
          containers_storage_path: string | null
          id: number
          updated_at: string
        }
        Insert: {
          containers_image_url?: string | null
          containers_storage_path?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          containers_image_url?: string | null
          containers_storage_path?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      homepage_carousel_products: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          override_image_url: string | null
          override_storage_path: string | null
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          override_image_url?: string | null
          override_storage_path?: string | null
          product_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          override_image_url?: string | null
          override_storage_path?: string | null
          product_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homepage_carousel_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_hero_slides: {
        Row: {
          created_at: string
          cta1_href: string
          cta1_label: string
          cta2_href: string
          cta2_label: string
          eyebrow: string
          id: string
          image_url: string
          is_active: boolean
          sort_order: number
          storage_path: string | null
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta1_href?: string
          cta1_label?: string
          cta2_href?: string
          cta2_label?: string
          eyebrow?: string
          id?: string
          image_url: string
          is_active?: boolean
          sort_order?: number
          storage_path?: string | null
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta1_href?: string
          cta1_label?: string
          cta2_href?: string
          cta2_label?: string
          eyebrow?: string
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          storage_path?: string | null
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          key: string
          response: Json | null
          scope: string
          status: string
        }
        Insert: {
          created_at?: string
          key: string
          response?: Json | null
          scope: string
          status?: string
        }
        Update: {
          created_at?: string
          key?: string
          response?: Json | null
          scope?: string
          status?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          currency_code: string
          discount: number
          gst_amount: number
          gst_included: boolean
          gst_rate: number
          id: string
          order_id: string
          product_id: string | null
          product_name_snapshot: string
          quantity: number
          subtotal: number
          supplier_id: string | null
          supplier_name_snapshot: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          currency_code?: string
          discount?: number
          gst_amount?: number
          gst_included?: boolean
          gst_rate?: number
          id?: string
          order_id: string
          product_id?: string | null
          product_name_snapshot: string
          quantity: number
          subtotal: number
          supplier_id?: string | null
          supplier_name_snapshot: string
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          currency_code?: string
          discount?: number
          gst_amount?: number
          gst_included?: boolean
          gst_rate?: number
          id?: string
          order_id?: string
          product_id?: string | null
          product_name_snapshot?: string
          quantity?: number
          subtotal?: number
          supplier_id?: string | null
          supplier_name_snapshot?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          delivery_address_snapshot: Json
          enquiry_id: string | null
          id: string
          order_number: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          rfq_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          tracking_token: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_address_snapshot: Json
          enquiry_id?: string | null
          id?: string
          order_number: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          rfq_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          tracking_token?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_address_snapshot?: Json
          enquiry_id?: string | null
          id?: string
          order_number?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          rfq_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          tracking_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_send_log: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      product_approval_requests: {
        Row: {
          base_product_updated_at: string | null
          created_at: string
          id: string
          product_id: string
          proposed_data: Json
          rejection_reason: string | null
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["product_approval_status"]
        }
        Insert: {
          base_product_updated_at?: string | null
          created_at?: string
          id?: string
          product_id: string
          proposed_data: Json
          rejection_reason?: string | null
          request_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["product_approval_status"]
        }
        Update: {
          base_product_updated_at?: string | null
          created_at?: string
          id?: string
          product_id?: string
          proposed_data?: Json
          rejection_reason?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["product_approval_status"]
        }
        Relationships: [
          {
            foreignKeyName: "product_approval_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_primary: boolean
          product_id: string
          sort_order: number
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_specifications: {
        Row: {
          id: string
          product_id: string
          sort_order: number
          spec_name: string
          spec_value: string
        }
        Insert: {
          id?: string
          product_id: string
          sort_order?: number
          spec_name: string
          spec_value: string
        }
        Update: {
          id?: string
          product_id?: string
          sort_order?: number
          spec_name?: string
          spec_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_versions: {
        Row: {
          created_at: string
          id: string
          product_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          snapshot?: Json
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "product_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          approval_status: Database["public"]["Enums"]["product_approval_status"]
          archive_status: Database["public"]["Enums"]["product_archive_status"]
          category_id: string
          created_at: string
          description: string | null
          discount: number
          gst_included: boolean
          gst_rate: number
          id: string
          is_draft: boolean
          min_order_value: number | null
          moq: number
          name: string
          pre_archive_publication_status:
            | Database["public"]["Enums"]["product_publication_status"]
            | null
          profit_type: Database["public"]["Enums"]["profit_type"]
          profit_value: number
          publication_status: Database["public"]["Enums"]["product_publication_status"]
          rejection_reason: string | null
          ribbon_label: string | null
          selling_price: number
          sku: string | null
          stock_quantity: number
          suggested_moq: number | null
          supplier_id: string | null
          supplier_price: number
          updated_at: string
          view_count: number
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["product_approval_status"]
          archive_status?: Database["public"]["Enums"]["product_archive_status"]
          category_id: string
          created_at?: string
          description?: string | null
          discount?: number
          gst_included?: boolean
          gst_rate?: number
          id?: string
          is_draft?: boolean
          min_order_value?: number | null
          moq: number
          name: string
          pre_archive_publication_status?:
            | Database["public"]["Enums"]["product_publication_status"]
            | null
          profit_type?: Database["public"]["Enums"]["profit_type"]
          profit_value?: number
          publication_status?: Database["public"]["Enums"]["product_publication_status"]
          rejection_reason?: string | null
          ribbon_label?: string | null
          selling_price?: number
          sku?: string | null
          stock_quantity?: number
          suggested_moq?: number | null
          supplier_id?: string | null
          supplier_price: number
          updated_at?: string
          view_count?: number
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["product_approval_status"]
          archive_status?: Database["public"]["Enums"]["product_archive_status"]
          category_id?: string
          created_at?: string
          description?: string | null
          discount?: number
          gst_included?: boolean
          gst_rate?: number
          id?: string
          is_draft?: boolean
          min_order_value?: number | null
          moq?: number
          name?: string
          pre_archive_publication_status?:
            | Database["public"]["Enums"]["product_publication_status"]
            | null
          profit_type?: Database["public"]["Enums"]["profit_type"]
          profit_value?: number
          publication_status?: Database["public"]["Enums"]["product_publication_status"]
          rejection_reason?: string | null
          ribbon_label?: string | null
          selling_price?: number
          sku?: string | null
          stock_quantity?: number
          suggested_moq?: number | null
          supplier_id?: string | null
          supplier_price?: number
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rfq_items: {
        Row: {
          created_at: string
          final_quantity: number | null
          final_unit_price: number | null
          gst_included: boolean
          gst_rate: number
          id: string
          original_quantity: number
          original_unit_price: number
          product_id: string | null
          product_name_snapshot: string
          rfq_id: string
        }
        Insert: {
          created_at?: string
          final_quantity?: number | null
          final_unit_price?: number | null
          gst_included?: boolean
          gst_rate?: number
          id?: string
          original_quantity: number
          original_unit_price: number
          product_id?: string | null
          product_name_snapshot: string
          rfq_id: string
        }
        Update: {
          created_at?: string
          final_quantity?: number | null
          final_unit_price?: number | null
          gst_included?: boolean
          gst_rate?: number
          id?: string
          original_quantity?: number
          original_unit_price?: number
          product_id?: string | null
          product_name_snapshot?: string
          rfq_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_items_rfq_id_fkey"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          created_at: string
          customer_id: string
          customer_message: string | null
          delivery_address_snapshot: Json
          enquiry_id: string | null
          final_total: number | null
          id: string
          original_total: number
          rejection_reason: string | null
          rfq_number: string
          status: Database["public"]["Enums"]["rfq_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_message?: string | null
          delivery_address_snapshot: Json
          enquiry_id?: string | null
          final_total?: number | null
          id?: string
          original_total: number
          rejection_reason?: string | null
          rfq_number: string
          status?: Database["public"]["Enums"]["rfq_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_message?: string | null
          delivery_address_snapshot?: Json
          enquiry_id?: string | null
          final_total?: number | null
          id?: string
          original_total?: number
          rejection_reason?: string | null
          rfq_number?: string
          status?: Database["public"]["Enums"]["rfq_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          archived_at: string | null
          company_name: string
          contact_person: string
          country: string
          created_at: string
          email: string
          id: string
          notification_preferences: Json
          phone: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["supplier_status"]
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          company_name: string
          contact_person: string
          country: string
          created_at?: string
          email: string
          id?: string
          notification_preferences?: Json
          phone: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["supplier_status"]
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          company_name?: string
          contact_person?: string
          country?: string
          created_at?: string
          email?: string
          id?: string
          notification_preferences?: Json
          phone?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["supplier_status"]
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          added_at: string
          customer_id: string
          id: string
          product_id: string
        }
        Insert: {
          added_at?: string
          customer_id: string
          id?: string
          product_id: string
        }
        Update: {
          added_at?: string
          customer_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_dashboard_metrics: { Args: never; Returns: Json }
      approve_product_core_atomic: {
        Args: {
          p_admin_user_id: string
          p_product_update: Json
          p_request_id: string
        }
        Returns: boolean
      }
      category_product_counts: {
        Args: never
        Returns: {
          category_id: string
          product_count: number
        }[]
      }
      claim_guest_session_for_merge: {
        Args: { p_guest_session_id: string }
        Returns: {
          cart_product_id: string
          cart_quantity: number
          wishlist_product_id: string
        }[]
      }
      convert_enquiry_to_order_atomic: {
        Args: {
          p_currency_code: string
          p_customer_id: string
          p_delivery_address: Json
          p_discount: number
          p_enquiry_id: string
          p_gst_amount: number
          p_gst_included: boolean
          p_gst_rate: number
          p_line_subtotal: number
          p_line_total: number
          p_order_number: string
          p_product_id: string
          p_product_name_snapshot: string
          p_quantity: number
          p_subtotal: number
          p_supplier_id: string
          p_supplier_name_snapshot: string
          p_total: number
          p_tracking_token: string
          p_unit_price: number
        }
        Returns: {
          order_id: string
          order_number: string
          tracking_token: string
        }[]
      }
      convert_rfq_to_order: {
        Args: { p_admin_id: string; p_rfq_id: string }
        Returns: string
      }
      convert_rfq_to_order_atomic: {
        Args: {
          p_order_items: Json
          p_order_number: string
          p_rfq_id: string
          p_subtotal: number
          p_total: number
          p_tracking_token: string
        }
        Returns: {
          order_id: string
          order_number: string
          tracking_token: string
        }[]
      }
      create_manual_order_atomic: {
        Args: {
          p_customer_id: string
          p_delivery_address: Json
          p_order_items: Json
          p_order_number: string
          p_subtotal: number
          p_total: number
          p_tracking_token: string
        }
        Returns: {
          order_id: string
          order_number: string
          tracking_token: string
        }[]
      }
      create_rfq_from_enquiry_atomic: {
        Args: {
          p_customer_id: string
          p_customer_message: string
          p_delivery_address: Json
          p_enquiry_id: string
          p_items: Json
          p_original_total: number
          p_rfq_number: string
        }
        Returns: {
          rfq_id: string
          rfq_number: string
        }[]
      }
      create_supplier_product_atomic: {
        Args: { p_payload: Json; p_supplier_id: string }
        Returns: string
      }
      edit_order_atomic: {
        Args: { p_delivery_address?: Json; p_items: Json; p_order_id: string }
        Returns: boolean
      }
      edit_rfq_atomic: {
        Args: {
          p_customer_message?: string
          p_delivery_address?: Json
          p_items: Json
          p_rfq_id: string
        }
        Returns: {
          final_total: number
          original_total: number
          rfq_id: string
        }[]
      }
      generate_order_number: { Args: never; Returns: string }
      generate_rfq_number: { Args: never; Returns: string }
      increment_cart_item_quantity: {
        Args: {
          p_cart_id: string
          p_delta: number
          p_moq?: number
          p_product_id: string
        }
        Returns: number
      }
      increment_guest_cart_item_quantity: {
        Args: {
          p_delta: number
          p_guest_session_id: string
          p_moq?: number
          p_product_id: string
        }
        Returns: number
      }
      increment_product_view: { Args: { p_id: string }; Returns: undefined }
      increment_product_view_sampled: {
        Args: { p_id: string; p_sample_key?: string; p_window_seconds?: number }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      negotiate_rfq_items_atomic: {
        Args: { p_items: Json; p_rfq_id: string }
        Returns: boolean
      }
      prune_api_rate_limit_log: {
        Args: { p_older_than?: string }
        Returns: number
      }
      reorder_product_images_atomic: {
        Args: { p_ordered_ids: string[]; p_product_id: string }
        Returns: boolean
      }
      reserve_product_image_slot: {
        Args: { p_max: number; p_product_id: string }
        Returns: {
          image_id: string
          sort_order: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_rfq_from_cart_atomic: {
        Args: {
          p_customer_id: string
          p_customer_message: string
          p_delivery_address: Json
          p_items: Json
          p_original_total: number
          p_rfq_number: string
        }
        Returns: {
          rfq_id: string
          rfq_number: string
        }[]
      }
      submit_rfqs_from_cart_atomic: {
        Args: {
          p_customer_id: string
          p_customer_message: string
          p_delivery_address: Json
          p_groups: Json
        }
        Returns: {
          rfq_id: string
          rfq_number: string
          supplier_key: string
        }[]
      }
      submit_supplier_update_atomic: {
        Args: {
          p_base_updated_at?: string
          p_product_id: string
          p_proposed: Json
          p_supplier_id: string
        }
        Returns: string
      }
      supplier_admin_summary_stats: {
        Args: { p_supplier_ids: string[] }
        Returns: {
          product_count: number
          supplier_id: string
          total_enquiries: number
          total_orders: number
          total_rfqs: number
          total_views: number
        }[]
      }
      supplier_product_demand_stats: {
        Args: { p_supplier_id: string }
        Returns: {
          enquiries: number
          orders: number
          product_id: string
          product_name: string
          rfqs: number
          views: number
        }[]
      }
      try_record_otp_send: {
        Args: {
          p_email: string
          p_max_sends?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      try_record_rate_limit: {
        Args: {
          p_key: string
          p_max_hits: number
          p_scope: string
          p_window_seconds: number
        }
        Returns: boolean
      }
    }
    Enums: {
      category_status: "active" | "archived"
      enquiry_status:
        | "new"
        | "contacted"
        | "converted_to_order"
        | "closed"
        | "converted_to_rfq"
      order_status: "accepted" | "packing" | "dispatched" | "cancelled"
      payment_status: "payment_required" | "payment_done"
      product_approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "update_pending"
      product_archive_status: "active" | "archived"
      product_publication_status: "published" | "unpublished"
      profit_type: "percentage" | "fixed"
      rfq_status:
        | "submitted"
        | "under_review"
        | "accepted"
        | "rejected"
        | "converted_to_order"
      supplier_status: "pending" | "active" | "rejected" | "archived"
      user_role: "admin" | "supplier" | "customer"
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
    Enums: {
      category_status: ["active", "archived"],
      enquiry_status: [
        "new",
        "contacted",
        "converted_to_order",
        "closed",
        "converted_to_rfq",
      ],
      order_status: ["accepted", "packing", "dispatched", "cancelled"],
      payment_status: ["payment_required", "payment_done"],
      product_approval_status: [
        "pending",
        "approved",
        "rejected",
        "update_pending",
      ],
      product_archive_status: ["active", "archived"],
      product_publication_status: ["published", "unpublished"],
      profit_type: ["percentage", "fixed"],
      rfq_status: [
        "submitted",
        "under_review",
        "accepted",
        "rejected",
        "converted_to_order",
      ],
      supplier_status: ["pending", "active", "rejected", "archived"],
      user_role: ["admin", "supplier", "customer"],
    },
  },
} as const
// Convenience aliases (preserved across types:gen — see scripts/append-database-enums.ts)
export type UserRole = Enums<'user_role'>;
export type SupplierStatus = Enums<'supplier_status'>;
export type ProductApprovalStatus = Enums<'product_approval_status'>;
export type ProductPublicationStatus = Enums<'product_publication_status'>;
export type ProductArchiveStatus = Enums<'product_archive_status'>;
export type CategoryStatus = Enums<'category_status'>;
export type ProfitType = Enums<'profit_type'>;
export type EnquiryStatus = Enums<'enquiry_status'>;
export type RfqStatus = Enums<'rfq_status'>;
export type OrderStatus = Enums<'order_status'>;
export type PaymentStatus = Enums<'payment_status'>;
