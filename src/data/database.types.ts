
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "game_confirmations": {
                  Row: {
                    "game_id": string,"profile_id": string,"responded_at": string | null,"state": Database["public"]['Enums']["confirmation_state"]
                  }
                  ComputedFields: never
                  Insert: {
                    "game_id": string,"profile_id": string,"responded_at"?: string | null,"state"?: Database["public"]['Enums']["confirmation_state"]
                  }
                  Update: {
                    "game_id"?: string,"profile_id"?: string,"responded_at"?: string | null,"state"?: Database["public"]['Enums']["confirmation_state"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_confirmations_game_id_profile_id_fkey"
      columns: ["game_id","profile_id"]
isOneToOne: true
      referencedRelation: "game_participants"
      referencedColumns: ["game_id","profile_id"]
    }
                  ]
                },"game_participants": {
                  Row: {
                    "game_id": string,"profile_id": string,"side": Database["public"]['Enums']["side"]
                  }
                  ComputedFields: never
                  Insert: {
                    "game_id": string,"profile_id": string,"side": Database["public"]['Enums']["side"]
                  }
                  Update: {
                    "game_id"?: string,"profile_id"?: string,"side"?: Database["public"]['Enums']["side"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_participants_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "game_participants_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"games": {
                  Row: {
                    "created_at": string,"format": number,"id": string,"logger_id": string,"photo_path": string | null,"played_at": string,"score_a": number,"score_b": number,"status": Database["public"]['Enums']["game_status"],"void_reason": string | null,"winning_side": Database["public"]['Enums']["side"] | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"format": number,"id"?: string,"logger_id": string,"photo_path"?: string | null,"played_at"?: string,"score_a": number,"score_b": number,"status"?: Database["public"]['Enums']["game_status"],"void_reason"?: string | null,"winning_side"?: never
                  }
                  Update: {
                    "created_at"?: string,"format"?: number,"id"?: string,"logger_id"?: string,"photo_path"?: string | null,"played_at"?: string,"score_a"?: number,"score_b"?: number,"status"?: Database["public"]['Enums']["game_status"],"void_reason"?: string | null,"winning_side"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "games_logger_id_fkey"
      columns: ["logger_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "confirmation_requests": boolean,"dispute_alerts": boolean,"overtaken_on_ladder": boolean,"profile_id": string,"updated_at": string,"weekly_recap": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmation_requests"?: boolean,"dispute_alerts"?: boolean,"overtaken_on_ladder"?: boolean,"profile_id": string,"updated_at"?: string,"weekly_recap"?: boolean
                  }
                  Update: {
                    "confirmation_requests"?: boolean,"dispute_alerts"?: boolean,"overtaken_on_ladder"?: boolean,"profile_id"?: string,"updated_at"?: string,"weekly_recap"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"player_ratings": {
                  Row: {
                    "display_rating": number,"games_played": number,"in_placement": boolean,"is_active": boolean,"last_played_at": string | null,"mu": number,"profile_id": string,"sigma": number,"tier": Database["public"]['Enums']["tier"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_rating": number,"games_played": number,"in_placement": boolean,"is_active": boolean,"last_played_at"?: string | null,"mu": number,"profile_id": string,"sigma": number,"tier": Database["public"]['Enums']["tier"],"updated_at"?: string
                  }
                  Update: {
                    "display_rating"?: number,"games_played"?: number,"in_placement"?: boolean,"is_active"?: boolean,"last_played_at"?: string | null,"mu"?: number,"profile_id"?: string,"sigma"?: number,"tier"?: Database["public"]['Enums']["tier"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_ratings_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"gender": Database["public"]['Enums']["gender"],"id": string,"is_admin": boolean,"seed_tier": Database["public"]['Enums']["tier"],"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"gender": Database["public"]['Enums']["gender"],"id": string,"is_admin"?: boolean,"seed_tier": Database["public"]['Enums']["tier"],"username": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"gender"?: Database["public"]['Enums']["gender"],"id"?: string,"is_admin"?: boolean,"seed_tier"?: Database["public"]['Enums']["tier"],"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_tokens": {
                  Row: {
                    "profile_id": string,"token": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "profile_id": string,"token": string,"updated_at"?: string
                  }
                  Update: {
                    "profile_id"?: string,"token"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_tokens_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rating_history": {
                  Row: {
                    "display_after": number,"display_before": number,"game_id": string,"mu_after": number,"mu_before": number,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_after": number,"display_before": number,"game_id": string,"mu_after": number,"mu_before": number,"profile_id": string
                  }
                  Update: {
                    "display_after"?: number,"display_before"?: number,"game_id"?: string,"mu_after"?: number,"mu_before"?: number,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rating_history_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rating_history_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rating_replay_state": {
                  Row: {
                    "duration_ms": number | null,"games_replayed": number | null,"last_replay_at": string | null,"singleton": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "duration_ms"?: number | null,"games_replayed"?: number | null,"last_replay_at"?: string | null,"singleton"?: boolean
                  }
                  Update: {
                    "duration_ms"?: number | null,"games_replayed"?: number | null,"last_replay_at"?: string | null,"singleton"?: boolean
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "apply_replay":
{ Args: { "p_duration_ms": number,"p_history": Json,"p_ratings": Json }; Returns: undefined
                           },
"create_my_profile":
{ Args: { "p_display_name": string,"p_gender": Database["public"]['Enums']["gender"],"p_seed_tier": Database["public"]['Enums']["tier"],"p_username": string }; Returns: {
              "created_at": string,
"display_name": string,
"gender": Database["public"]['Enums']["gender"],
"id": string,
"is_admin": boolean,
"seed_tier": Database["public"]['Enums']["tier"],
"username": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"current_role_name":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"daily_log_cap":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_club_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"log_game":
{ Args: { "p_format": number,"p_photo_path"?: string,"p_score_a": number,"p_score_b": number,"p_side_a": (string)[],"p_side_b": (string)[] }; Returns: string
                           },
"persist_game_state":
{ Args: { "p_confirmations": Json,"p_expected_confirmations": Json,"p_expected_status": Database["public"]['Enums']["game_status"],"p_game_id": string,"p_status": Database["public"]['Enums']["game_status"],"p_void_reason"?: string }; Returns: undefined
                           },
"replay_input":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"reserved_usernames":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"username_available":
{ Args: { "p_username": string }; Returns: boolean
                           },
"username_email_domain":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"username_problem":
{ Args: { "p_username": string }; Returns: string
                           }
          }
          Enums: {
            "confirmation_state": "pending"|"confirmed"|"disputed","game_status": "pending"|"confirmed"|"disputed"|"voided","gender": "male"|"female","side": "a"|"b","tier": "newbie"|"y"|"tby"|"tb-plus"|"kha"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "confirmation_state": ["pending", "confirmed", "disputed"],"game_status": ["pending", "confirmed", "disputed", "voided"],"gender": ["male", "female"],"side": ["a", "b"],"tier": ["newbie", "y", "tby", "tb-plus", "kha"]
          }
        }
} as const
