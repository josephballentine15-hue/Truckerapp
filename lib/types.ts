export type Shipment = {
  id: string;
  driver_id: string;
  company_id: string;
  cargo_description: string;
  origin: string;
  destination: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
  };
};
