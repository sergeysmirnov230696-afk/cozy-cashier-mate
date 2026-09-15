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
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json
          employee_id: string | null
          employee_name: string | null
          entity: string | null
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          employee_id?: string | null
          employee_name?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          employee_id?: string | null
          employee_name?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_operations: {
        Row: {
          amount: number
          created_at: string
          employee_id: string | null
          id: string
          reason: string | null
          shift_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          employee_id?: string | null
          id?: string
          reason?: string | null
          shift_id?: string | null
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string | null
          id?: string
          reason?: string | null
          shift_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_operations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_operations_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          sort: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          sort?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          sort?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          bonus: number
          created_at: string
          id: string
          name: string
          note: string | null
          phone: string
          total_spent: number
          updated_at: string
          visits: number
        }
        Insert: {
          bonus?: number
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          phone: string
          total_spent?: number
          updated_at?: string
          visits?: number
        }
        Update: {
          bonus?: number
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          phone?: string
          total_spent?: number
          updated_at?: string
          visits?: number
        }
        Relationships: []
      }
      discounts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          value?: number
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          hired_at: string | null
          id: string
          is_active: boolean
          locked_until: string | null
          name: string
          phone: string | null
          pin: string
          pin_attempts: number
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          hired_at?: string | null
          id?: string
          is_active?: boolean
          locked_until?: string | null
          name: string
          phone?: string | null
          pin: string
          pin_attempts?: number
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          hired_at?: string | null
          id?: string
          is_active?: boolean
          locked_until?: string | null
          name?: string
          phone?: string | null
          pin?: string
          pin_attempts?: number
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      modifiers: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          modifiers: Json
          name: string
          order_id: string
          price: number
          product_id: string | null
          qty: number
          total: number
        }
        Insert: {
          id?: string
          modifiers?: Json
          name: string
          order_id: string
          price?: number
          product_id?: string | null
          qty?: number
          total?: number
        }
        Update: {
          id?: string
          modifiers?: Json
          name?: string
          order_id?: string
          price?: number
          product_id?: string | null
          qty?: number
          total?: number
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
        ]
      }
      orders: {
        Row: {
          bonus_earned: number
          bonus_used: number
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          card_amount: number
          cash_amount: number
          cash_received: number
          change_given: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          daily_no: number | null
          discount: number
          employee_id: string | null
          fiscal_check_url: string | null
          fiscal_error: string | null
          fiscal_number: string | null
          fiscal_status: string
          id: string
          kaspi_txn_id: string | null
          note: string | null
          order_no: number
          order_type: string
          payment_method: string
          shift_id: string | null
          status: string
          subtotal: number
          total: number
        }
        Insert: {
          bonus_earned?: number
          bonus_used?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          card_amount?: number
          cash_amount?: number
          cash_received?: number
          change_given?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          daily_no?: number | null
          discount?: number
          employee_id?: string | null
          fiscal_check_url?: string | null
          fiscal_error?: string | null
          fiscal_number?: string | null
          fiscal_status?: string
          id?: string
          kaspi_txn_id?: string | null
          note?: string | null
          order_no?: never
          order_type?: string
          payment_method?: string
          shift_id?: string | null
          status?: string
          subtotal?: number
          total?: number
        }
        Update: {
          bonus_earned?: number
          bonus_used?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          card_amount?: number
          cash_amount?: number
          cash_received?: number
          change_given?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          daily_no?: number | null
          discount?: number
          employee_id?: string | null
          fiscal_check_url?: string | null
          fiscal_error?: string | null
          fiscal_number?: string | null
          fiscal_status?: string
          id?: string
          kaspi_txn_id?: string | null
          note?: string | null
          order_no?: never
          order_type?: string
          payment_method?: string
          shift_id?: string | null
          status?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cost: number
          created_at: string
          emoji: string | null
          id: string
          image_url: string | null
          in_stop_list: boolean
          is_active: boolean
          name: string
          price: number
          sort: number
          stock: number
          track_stock: boolean
          unit: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cost?: number
          created_at?: string
          emoji?: string | null
          id?: string
          image_url?: string | null
          in_stop_list?: boolean
          is_active?: boolean
          name: string
          price?: number
          sort?: number
          stock?: number
          track_stock?: boolean
          unit?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cost?: number
          created_at?: string
          emoji?: string | null
          id?: string
          image_url?: string | null
          in_stop_list?: boolean
          is_active?: boolean
          name?: string
          price?: number
          sort?: number
          stock?: number
          track_stock?: boolean
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          address: string
          auto_print: boolean
          bonus_percent: number
          id: boolean
          kaspi_api_url: string
          kaspi_bin: string
          kaspi_enabled: boolean
          kaspi_terminal_id: string
          low_stock_threshold: number
          order_prefix: string
          phone: string
          print_cashier_receipt: boolean
          print_copies: number
          print_customer_receipt: boolean
          receipt_footer: string
          shift_max_hours: number
          shop_name: string
          updated_at: string
          vat_percent: number
        }
        Insert: {
          address?: string
          auto_print?: boolean
          bonus_percent?: number
          id?: boolean
          kaspi_api_url?: string
          kaspi_bin?: string
          kaspi_enabled?: boolean
          kaspi_terminal_id?: string
          low_stock_threshold?: number
          order_prefix?: string
          phone?: string
          print_cashier_receipt?: boolean
          print_copies?: number
          print_customer_receipt?: boolean
          receipt_footer?: string
          shift_max_hours?: number
          shop_name?: string
          updated_at?: string
          vat_percent?: number
        }
        Update: {
          address?: string
          auto_print?: boolean
          bonus_percent?: number
          id?: boolean
          kaspi_api_url?: string
          kaspi_bin?: string
          kaspi_enabled?: boolean
          kaspi_terminal_id?: string
          low_stock_threshold?: number
          order_prefix?: string
          phone?: string
          print_cashier_receipt?: boolean
          print_copies?: number
          print_customer_receipt?: boolean
          receipt_footer?: string
          shift_max_hours?: number
          shop_name?: string
          updated_at?: string
          vat_percent?: number
        }
        Relationships: []
      }
      shifts: {
        Row: {
          auto_closed: boolean
          cash_diff: number | null
          cash_end: number | null
          cash_start: number
          closed_at: string | null
          employee_id: string | null
          expected_cash: number | null
          id: string
          note: string | null
          opened_at: string
          opened_by: string | null
          orders_count: number
          sales_total: number
          status: string
        }
        Insert: {
          auto_closed?: boolean
          cash_diff?: number | null
          cash_end?: number | null
          cash_start?: number
          closed_at?: string | null
          employee_id?: string | null
          expected_cash?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opened_by?: string | null
          orders_count?: number
          sales_total?: number
          status?: string
        }
        Update: {
          auto_closed?: boolean
          cash_diff?: number | null
          cash_end?: number | null
          cash_start?: number
          closed_at?: string | null
          employee_id?: string | null
          expected_cash?: number | null
          id?: string
          note?: string | null
          opened_at?: string
          opened_by?: string | null
          orders_count?: number
          sales_total?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          product_id: string
          qty: number
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id: string
          qty: number
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          product_id?: string
          qty?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      close_expired_shifts: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "cashier"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "manager", "cashier"],
    },
  },
} as const
