// Hand-crafted type definitions mirroring supabase/init.sql v2 (normalized schema).
// Replace with generated types by running: npx supabase gen types typescript --linked
// IMPORTANT: Every table must include Relationships: [] or column-select narrowing returns `never`.

export type AppRole = "admin" | "buyer_default" | "buyer_30_day";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "fulfilled"
  | "cancelled";
export type PaymentMethod = "eft" | "30_day_account";
export type PaymentStatus = "pending" | "verified" | "rejected";
export type AddressType = "billing" | "shipping";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      // ----------------------------------------------------------------
      // tenant_config — singleton supplier configuration row
      // ----------------------------------------------------------------
      tenant_config: {
        Row: {
          id: number;
          business_name: string;
          trading_name: string | null;
          logo_url: string | null;
          website_url: string | null;
          vat_number: string | null;
          vat_rate: number;
          bank_name: string | null;
          bank_account_holder: string | null;
          bank_account_number: string | null;
          bank_branch_code: string | null;
          bank_account_type: string | null;
          bank_reference_prefix: string;
          email_from_name: string | null;
          email_from_address: string | null;
          email_reply_to: string | null;
          support_phone: string | null;
          support_email: string | null;
          payment_terms_days: number;
          footer_text: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          business_name?: string;
          trading_name?: string | null;
          logo_url?: string | null;
          website_url?: string | null;
          vat_number?: string | null;
          vat_rate?: number;
          bank_name?: string | null;
          bank_account_holder?: string | null;
          bank_account_number?: string | null;
          bank_branch_code?: string | null;
          bank_account_type?: string | null;
          bank_reference_prefix?: string;
          email_from_name?: string | null;
          email_from_address?: string | null;
          email_reply_to?: string | null;
          support_phone?: string | null;
          support_email?: string | null;
          payment_terms_days?: number;
          footer_text?: string | null;
          updated_at?: string;
        };
        Update: {
          business_name?: string;
          trading_name?: string | null;
          logo_url?: string | null;
          website_url?: string | null;
          vat_number?: string | null;
          vat_rate?: number;
          bank_name?: string | null;
          bank_account_holder?: string | null;
          bank_account_number?: string | null;
          bank_branch_code?: string | null;
          bank_account_type?: string | null;
          bank_reference_prefix?: string;
          email_from_name?: string | null;
          email_from_address?: string | null;
          email_reply_to?: string | null;
          support_phone?: string | null;
          support_email?: string | null;
          payment_terms_days?: number;
          footer_text?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ----------------------------------------------------------------
      // profiles — admins + buyers unified
      // ----------------------------------------------------------------
      profiles: {
        Row: {
          id: string;
          auth_user_id: string | null;
          account_number: string | null;
          role: AppRole;
          business_name: string;
          trading_name: string | null;
          vat_number: string | null;
          contact_name: string;
          contact_title: string | null;
          email: string | null;
          phone: string | null;
          mobile: string | null;
          fax: string | null;
          credit_limit: number | null;
          available_credit: number | null;
          payment_terms_days: number | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          account_number?: string | null;
          role?: AppRole;
          business_name: string;
          trading_name?: string | null;
          vat_number?: string | null;
          contact_name: string;
          contact_title?: string | null;
          email?: string | null;
          phone?: string | null;
          mobile?: string | null;
          fax?: string | null;
          credit_limit?: number | null;
          available_credit?: number | null;
          payment_terms_days?: number | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          account_number?: string | null;
          role?: AppRole;
          business_name?: string;
          trading_name?: string | null;
          vat_number?: string | null;
          contact_name?: string;
          contact_title?: string | null;
          email?: string | null;
          phone?: string | null;
          mobile?: string | null;
          fax?: string | null;
          credit_limit?: number | null;
          available_credit?: number | null;
          payment_terms_days?: number | null;
          notes?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ----------------------------------------------------------------
      // addresses — buyer address book
      // ----------------------------------------------------------------
      addresses: {
        Row: {
          id: string;
          profile_id: string;
          type: AddressType;
          label: string | null;
          line1: string;
          line2: string | null;
          suburb: string | null;
          city: string;
          province: string | null;
          postal_code: string | null;
          country: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          type?: AddressType;
          label?: string | null;
          line1: string;
          line2?: string | null;
          suburb?: string | null;
          city: string;
          province?: string | null;
          postal_code?: string | null;
          country?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          type?: AddressType;
          label?: string | null;
          line1?: string;
          line2?: string | null;
          suburb?: string | null;
          city?: string;
          province?: string | null;
          postal_code?: string | null;
          country?: string;
          is_default?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "addresses_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // ----------------------------------------------------------------
      // categories — normalized product categories
      // ----------------------------------------------------------------
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          display_order?: number;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };

      // ----------------------------------------------------------------
      // products — catalog items
      // ----------------------------------------------------------------
      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          description: string | null;
          details: string | null;
          price: number;
          category_id: string | null;
          track_stock: boolean;
          stock_qty: number;
          low_stock_alert: number | null;
          variants: Json;
          tags: string[];
          discount_type: "percentage" | "fixed" | null;
          discount_threshold: number | null;
          discount_value: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          description?: string | null;
          details?: string | null;
          price: number;
          category_id?: string | null;
          track_stock?: boolean;
          stock_qty?: number;
          low_stock_alert?: number | null;
          variants?: Json;
          tags?: string[];
          discount_type?: "percentage" | "fixed" | null;
          discount_threshold?: number | null;
          discount_value?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku?: string;
          name?: string;
          description?: string | null;
          details?: string | null;
          price?: number;
          category_id?: string | null;
          track_stock?: boolean;
          stock_qty?: number;
          low_stock_alert?: number | null;
          variants?: Json;
          tags?: string[];
          discount_type?: "percentage" | "fixed" | null;
          discount_threshold?: number | null;
          discount_value?: number | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          }
        ];
      };

      // ----------------------------------------------------------------
      // product_images — multiple images per product
      // ----------------------------------------------------------------
      product_images: {
        Row: {
          id: string;
          product_id: string;
          url: string;
          alt_text: string | null;
          display_order: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          url: string;
          alt_text?: string | null;
          display_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          url?: string;
          alt_text?: string | null;
          display_order?: number;
          is_primary?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          }
        ];
      };

      // ----------------------------------------------------------------
      // orders — order headers
      // ----------------------------------------------------------------
      orders: {
        Row: {
          id: string;
          reference_number: string;
          profile_id: string;
          status: OrderStatus;
          payment_method: PaymentMethod;
          subtotal: number;
          discount_amount: number;
          vat_amount: number;
          total_amount: number;
          shipping_address: Json | null;
          buyer_reference: string | null;
          delivery_instructions: string | null;
          notes: string | null;
          order_notes: string | null;
          confirmed_at: string | null;
          fulfilled_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reference_number?: string;
          profile_id: string;
          status?: OrderStatus;
          payment_method: PaymentMethod;
          subtotal: number;
          discount_amount?: number;
          vat_amount?: number;
          total_amount: number;
          shipping_address?: Json | null;
          buyer_reference?: string | null;
          delivery_instructions?: string | null;
          notes?: string | null;
          order_notes?: string | null;
          confirmed_at?: string | null;
          fulfilled_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reference_number?: string;
          profile_id?: string;
          status?: OrderStatus;
          payment_method?: PaymentMethod;
          subtotal?: number;
          discount_amount?: number;
          vat_amount?: number;
          total_amount?: number;
          shipping_address?: Json | null;
          buyer_reference?: string | null;
          delivery_instructions?: string | null;
          notes?: string | null;
          order_notes?: string | null;
          confirmed_at?: string | null;
          fulfilled_at?: string | null;
          cancelled_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // ----------------------------------------------------------------
      // order_items — snapshotted line items
      // ----------------------------------------------------------------
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          sku: string;
          product_name: string;
          unit_price: number;
          quantity: number;
          discount_pct: number;
          line_total: number;
          variant_info: Json | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          sku: string;
          product_name: string;
          unit_price: number;
          quantity: number;
          discount_pct?: number;
          line_total: number;
          variant_info?: Json | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          sku?: string;
          product_name?: string;
          unit_price?: number;
          quantity?: number;
          discount_pct?: number;
          line_total?: number;
          variant_info?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          }
        ];
      };

      // ----------------------------------------------------------------
      // payments — EFT payment submissions
      // ----------------------------------------------------------------
      payments: {
        Row: {
          id: string;
          order_id: string;
          payment_method: PaymentMethod;
          amount: number;
          status: PaymentStatus;
          proof_url: string | null;
          reference: string | null;
          rejection_reason: string | null;
          notes: string | null;
          submitted_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          payment_method?: PaymentMethod;
          amount: number;
          status?: PaymentStatus;
          proof_url?: string | null;
          reference?: string | null;
          rejection_reason?: string | null;
          notes?: string | null;
          submitted_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          payment_method?: PaymentMethod;
          amount?: number;
          status?: PaymentStatus;
          proof_url?: string | null;
          reference?: string | null;
          rejection_reason?: string | null;
          notes?: string | null;
          submitted_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // ----------------------------------------------------------------
      // order_status_history — immutable status audit trail
      // ----------------------------------------------------------------
      order_status_history: {
        Row: {
          id: string;
          order_id: string;
          from_status: OrderStatus | null;
          to_status: OrderStatus;
          changed_by: string | null;
          note: string | null;
          changed_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          from_status?: OrderStatus | null;
          to_status: OrderStatus;
          changed_by?: string | null;
          note?: string | null;
          changed_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          }
        ];
      };

      // ----------------------------------------------------------------
      // buyer_sessions — server-side JWT registry for revocation
      // ----------------------------------------------------------------
      buyer_sessions: {
        Row: {
          id: string;
          profile_id: string;
          issued_at: string;
          expires_at: string;
          revoked_at: string | null;
          revoked_by: string | null;
          revoke_reason: string | null;
          user_agent: string | null;
          ip_address: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          issued_at?: string;
          expires_at: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          revoke_reason?: string | null;
          user_agent?: string | null;
          ip_address?: string | null;
        };
        Update: {
          revoked_at?: string | null;
          revoked_by?: string | null;
          revoke_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "buyer_sessions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };

      // ----------------------------------------------------------------
      // audit_log — append-only change log
      // ----------------------------------------------------------------
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: "INSERT" | "UPDATE" | "DELETE";
          schema_name: string;
          table_name: string;
          record_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          changed_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };

      // ----------------------------------------------------------------
      // global_settings — singleton notification banner config
      // ----------------------------------------------------------------
      global_settings: {
        Row: {
          id: number;
          banner_message: string | null;
          is_banner_active: boolean;
          updated_at: string;
        };
        Insert: {
          id?: number;
          banner_message?: string | null;
          is_banner_active?: boolean;
          updated_at?: string;
        };
        Update: {
          banner_message?: string | null;
          is_banner_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
    };

    Views: Record<string, never>;

    Functions: {
      get_app_role: {
        Args: Record<string, never>;
        Returns: AppRole | null;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      generate_order_reference: {
        Args: Record<string, never>;
        Returns: string;
      };
    };

    Enums: {
      app_role: AppRole;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      address_type: AddressType;
    };
  };
}
