export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'admin' | 'supplier' | 'customer';
export type SupplierStatus = 'pending' | 'active' | 'rejected' | 'archived';
export type ProductApprovalStatus = 'pending' | 'approved' | 'rejected' | 'update_pending';
export type ProductPublicationStatus = 'published' | 'unpublished';
export type ProductArchiveStatus = 'active' | 'archived';
export type CategoryStatus = 'active' | 'archived';
export type ProfitType = 'percentage' | 'fixed';
export type EnquiryStatus = 'new' | 'contacted' | 'converted_to_rfq' | 'converted_to_order' | 'closed';
export type RfqStatus = 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'converted_to_order';
export type OrderStatus = 'accepted' | 'packing' | 'dispatched' | 'cancelled';
export type PaymentStatus = 'payment_required' | 'payment_done';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          role: UserRole;
          full_name: string | null;
          email: string;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role?: UserRole;
          full_name?: string | null;
          email: string;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: UserRole;
          full_name?: string | null;
          email?: string;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_addresses: {
        Row: {
          id: string;
          customer_id: string;
          address_line_1: string;
          address_line_2: string | null;
          city: string;
          state: string;
          postal_code: string;
          country: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          address_line_1: string;
          address_line_2?: string | null;
          city: string;
          state: string;
          postal_code: string;
          country?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          address_line_1?: string;
          address_line_2?: string | null;
          city?: string;
          state?: string;
          postal_code?: string;
          country?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          user_id: string;
          company_name: string;
          contact_person: string;
          email: string;
          phone: string;
          address: string | null;
          country: string;
          website: string | null;
          status: SupplierStatus;
          rejection_reason: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_name: string;
          contact_person: string;
          email: string;
          phone: string;
          address?: string | null;
          country: string;
          website?: string | null;
          status?: SupplierStatus;
          rejection_reason?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company_name?: string;
          contact_person?: string;
          email?: string;
          phone?: string;
          address?: string | null;
          country?: string;
          website?: string | null;
          status?: SupplierStatus;
          rejection_reason?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          image_url: string | null;
          image_storage_path: string | null;
          status: CategoryStatus;
          archived_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          image_url?: string | null;
          image_storage_path?: string | null;
          status?: CategoryStatus;
          archived_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          image_url?: string | null;
          image_storage_path?: string | null;
          status?: CategoryStatus;
          archived_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          supplier_id: string | null;
          category_id: string;
          name: string;
          description: string | null;
          sku: string | null;
          stock_quantity: number;
          moq: number;
          suggested_moq: number | null;
          supplier_price: number;
          profit_type: ProfitType;
          profit_value: number;
          selling_price: number;
          discount: number;
          gst_rate: number;
          gst_included: boolean;
          min_order_value: number | null;
          ribbon_label: string | null;
          approval_status: ProductApprovalStatus;
          publication_status: ProductPublicationStatus;
          archive_status: ProductArchiveStatus;
          rejection_reason: string | null;
          pre_archive_publication_status: ProductPublicationStatus | null;
          view_count: number;
          is_draft: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id?: string | null;
          category_id: string;
          name: string;
          description?: string | null;
          sku?: string | null;
          stock_quantity?: number;
          moq: number;
          suggested_moq?: number | null;
          supplier_price: number;
          profit_type?: ProfitType;
          profit_value?: number;
          selling_price?: number;
          discount?: number;
          gst_rate?: number;
          gst_included?: boolean;
          min_order_value?: number | null;
          ribbon_label?: string | null;
          approval_status?: ProductApprovalStatus;
          publication_status?: ProductPublicationStatus;
          archive_status?: ProductArchiveStatus;
          rejection_reason?: string | null;
          pre_archive_publication_status?: ProductPublicationStatus | null;
          view_count?: number;
          is_draft?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          supplier_id?: string | null;
          category_id?: string;
          name?: string;
          description?: string | null;
          sku?: string | null;
          stock_quantity?: number;
          moq?: number;
          suggested_moq?: number | null;
          supplier_price?: number;
          profit_type?: ProfitType;
          profit_value?: number;
          selling_price?: number;
          discount?: number;
          gst_rate?: number;
          gst_included?: boolean;
          min_order_value?: number | null;
          ribbon_label?: string | null;
          approval_status?: ProductApprovalStatus;
          publication_status?: ProductPublicationStatus;
          archive_status?: ProductArchiveStatus;
          rejection_reason?: string | null;
          pre_archive_publication_status?: ProductPublicationStatus | null;
          view_count?: number;
          is_draft?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          image_url: string;
          storage_path: string | null;
          sort_order: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          image_url: string;
          storage_path?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          image_url?: string;
          storage_path?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      product_specifications: {
        Row: {
          id: string;
          product_id: string;
          spec_name: string;
          spec_value: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          product_id: string;
          spec_name: string;
          spec_value: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          spec_name?: string;
          spec_value?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      product_approval_requests: {
        Row: {
          id: string;
          product_id: string;
          request_type: 'new_product' | 'update';
          proposed_data: Json;
          status: ProductApprovalStatus;
          rejection_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          request_type: 'new_product' | 'update';
          proposed_data: Json;
          status?: ProductApprovalStatus;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          request_type?: 'new_product' | 'update';
          proposed_data?: Json;
          status?: ProductApprovalStatus;
          rejection_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      enquiries: {
        Row: {
          id: string;
          customer_id: string | null;
          guest_name: string;
          guest_email: string;
          guest_phone: string;
          country: string | null;
          company_name: string | null;
          enquiry_type: string;
          product_id: string | null;
          message: string;
          line_items: Json | null;
          attachment_url: string | null;
          attachment_path: string | null;
          status: EnquiryStatus;
          tracking_token: string | null;
          response_message: string | null;
          responded_at: string | null;
          responded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id?: string | null;
          guest_name: string;
          guest_email: string;
          guest_phone: string;
          country?: string | null;
          company_name?: string | null;
          enquiry_type?: string;
          product_id?: string | null;
          message: string;
          line_items?: Json | null;
          attachment_url?: string | null;
          attachment_path?: string | null;
          status?: EnquiryStatus;
          tracking_token?: string | null;
          response_message?: string | null;
          responded_at?: string | null;
          responded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string | null;
          guest_name?: string;
          guest_email?: string;
          guest_phone?: string;
          country?: string | null;
          company_name?: string | null;
          enquiry_type?: string;
          product_id?: string | null;
          message?: string;
          line_items?: Json | null;
          attachment_url?: string | null;
          attachment_path?: string | null;
          status?: EnquiryStatus;
          tracking_token?: string | null;
          response_message?: string | null;
          responded_at?: string | null;
          responded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      guest_sessions: {
        Row: {
          id: string;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          expires_at: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      guest_cart_items: {
        Row: {
          id: string;
          guest_session_id: string;
          product_id: string;
          quantity: number;
          added_at: string;
        };
        Insert: {
          id?: string;
          guest_session_id: string;
          product_id: string;
          quantity: number;
          added_at?: string;
        };
        Update: {
          id?: string;
          guest_session_id?: string;
          product_id?: string;
          quantity?: number;
          added_at?: string;
        };
        Relationships: [];
      };
      guest_wishlist_items: {
        Row: {
          id: string;
          guest_session_id: string;
          product_id: string;
          added_at: string;
        };
        Insert: {
          id?: string;
          guest_session_id: string;
          product_id: string;
          added_at?: string;
        };
        Update: {
          id?: string;
          guest_session_id?: string;
          product_id?: string;
          added_at?: string;
        };
        Relationships: [];
      };
      wishlist_items: {
        Row: {
          id: string;
          customer_id: string;
          product_id: string;
          added_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          product_id: string;
          added_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          product_id?: string;
          added_at?: string;
        };
        Relationships: [];
      };
      carts: {
        Row: {
          id: string;
          customer_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          id: string;
          cart_id: string;
          product_id: string;
          quantity: number;
          added_at: string;
        };
        Insert: {
          id?: string;
          cart_id: string;
          product_id: string;
          quantity: number;
          added_at?: string;
        };
        Update: {
          id?: string;
          cart_id?: string;
          product_id?: string;
          quantity?: number;
          added_at?: string;
        };
        Relationships: [];
      };
      rfqs: {
        Row: {
          id: string;
          rfq_number: string;
          customer_id: string;
          enquiry_id: string | null;
          status: RfqStatus;
          delivery_address_snapshot: Json;
          customer_message: string | null;
          original_total: number;
          final_total: number | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rfq_number: string;
          customer_id: string;
          enquiry_id?: string | null;
          status?: RfqStatus;
          delivery_address_snapshot: Json;
          customer_message?: string | null;
          original_total: number;
          final_total?: number | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rfq_number?: string;
          customer_id?: string;
          enquiry_id?: string | null;
          status?: RfqStatus;
          delivery_address_snapshot?: Json;
          customer_message?: string | null;
          original_total?: number;
          final_total?: number | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rfq_items: {
        Row: {
          id: string;
          rfq_id: string;
          product_id: string | null;
          product_name_snapshot: string;
          original_quantity: number;
          original_unit_price: number;
          final_quantity: number | null;
          final_unit_price: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          rfq_id: string;
          product_id?: string | null;
          product_name_snapshot: string;
          original_quantity: number;
          original_unit_price: number;
          final_quantity?: number | null;
          final_unit_price?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          rfq_id?: string;
          product_id?: string | null;
          product_name_snapshot?: string;
          original_quantity?: number;
          original_unit_price?: number;
          final_quantity?: number | null;
          final_unit_price?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string;
          rfq_id: string | null;
          enquiry_id: string | null;
          status: OrderStatus;
          payment_status: PaymentStatus;
          delivery_address_snapshot: Json;
          subtotal: number;
          total: number;
          tracking_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          customer_id: string;
          rfq_id?: string | null;
          enquiry_id?: string | null;
          status?: OrderStatus;
          payment_status?: PaymentStatus;
          delivery_address_snapshot: Json;
          subtotal: number;
          total: number;
          tracking_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          customer_id?: string;
          rfq_id?: string | null;
          enquiry_id?: string | null;
          status?: OrderStatus;
          payment_status?: PaymentStatus;
          delivery_address_snapshot?: Json;
          subtotal?: number;
          total?: number;
          tracking_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          supplier_id: string | null;
          product_name_snapshot: string;
          supplier_name_snapshot: string;
          quantity: number;
          unit_price: number;
          currency_code: string;
          gst_rate: number;
          gst_included: boolean;
          discount: number;
          subtotal: number;
          gst_amount: number;
          total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          supplier_id?: string | null;
          product_name_snapshot: string;
          supplier_name_snapshot: string;
          quantity: number;
          unit_price: number;
          currency_code?: string;
          gst_rate?: number;
          gst_included?: boolean;
          discount?: number;
          subtotal: number;
          gst_amount?: number;
          total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          supplier_id?: string | null;
          product_name_snapshot?: string;
          supplier_name_snapshot?: string;
          quantity?: number;
          unit_price?: number;
          currency_code?: string;
          gst_rate?: number;
          gst_included?: boolean;
          discount?: number;
          subtotal?: number;
          gst_amount?: number;
          total?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      business_settings: {
        Row: {
          id: string;
          company_name: string;
          logo_url: string | null;
          products_banner_url: string | null;
          business_email: string | null;
          business_phone: string | null;
          business_address: string | null;
          website: string | null;
          minimum_rfq_value: number;
          default_gst_rate: number;
          currency: string;
          max_product_images: number;
          supplier_approval_required: boolean;
          product_approval_required: boolean;
          google_login_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_name?: string;
          logo_url?: string | null;
          products_banner_url?: string | null;
          business_email?: string | null;
          business_phone?: string | null;
          business_address?: string | null;
          website?: string | null;
          minimum_rfq_value?: number;
          default_gst_rate?: number;
          currency?: string;
          max_product_images?: number;
          supplier_approval_required?: boolean;
          product_approval_required?: boolean;
          google_login_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_name?: string;
          logo_url?: string | null;
          products_banner_url?: string | null;
          business_email?: string | null;
          business_phone?: string | null;
          business_address?: string | null;
          website?: string | null;
          minimum_rfq_value?: number;
          default_gst_rate?: number;
          currency?: string;
          max_product_images?: number;
          supplier_approval_required?: boolean;
          product_approval_required?: boolean;
          google_login_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_versions: {
        Row: {
          id: string;
          product_id: string;
          snapshot: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          snapshot?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          snapshot?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      supplier_status: SupplierStatus;
      product_approval_status: ProductApprovalStatus;
      product_publication_status: ProductPublicationStatus;
      product_archive_status: ProductArchiveStatus;
      profit_type: ProfitType;
      enquiry_status: EnquiryStatus;
      rfq_status: RfqStatus;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
