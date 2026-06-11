export interface MeResponse {
  id: string;
  email: string;
  roles: string[];
  created_at: string;
}

export interface TenantProfile {
  id: string;
  tenant_id: string;
  name: string;
  budget_min: number;
  budget_max: number;
  locations: string[];
  preferred_room_types: string[];
  available_from: string;
  min_lease_months: number;
  min_area_ping?: number;
  has_pets: boolean;
  pet_description?: string;
  needs_subsidy: boolean;
  needs_tax_receipt: boolean;
  needs_household_registration: boolean;
  needs_cooking: boolean;
  needs_parking: boolean;
  smoking: boolean;
  occupation?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Listing {
  id: string;
  landlord_id: string;
  location_id: string;
  rent: number;
  room_type: string;
  area_ping: number;
  available_from: string;
  min_lease_months: number;
  allow_pets: boolean;
  allow_subsidy: boolean;
  allow_tax_receipt: boolean;
  allow_household_registration: boolean;
  allow_cooking: boolean;
  has_parking: boolean;
  allow_smoking: boolean;
  status: string;
  photos: string[];
  created_at: string;
  updated_at: string;
}

export interface MatchedListingCard {
  id: string;
  location_id: string;
  rent: number;
  room_type: string;
  area_ping: number;
  available_from: string;
  allow_pets: boolean;
  allow_subsidy: boolean;
  allow_tax_receipt: boolean;
  allow_household_registration: boolean;
  allow_cooking: boolean;
  has_parking: boolean;
  allow_smoking: boolean;
  photos: string[];
  interest_sent: boolean;
}

export interface MatchedTenantProfileCard {
  id: string;
  name: string;
  budget_min: number;
  budget_max: number;
  preferred_room_types: string[];
  available_from: string;
  min_lease_months: number;
  has_pets: boolean;
  needs_subsidy: boolean;
  needs_tax_receipt: boolean;
  needs_parking: boolean;
  smoking: boolean;
  occupation?: string;
  interest_sent: boolean;
}

export interface MutualMatch {
  match_id: string;
  tenant_profile_id: string;
  listing_id: string;
  contact_info: string;
  matched_at: string;
}

export interface Interest {
  tenant_profile_id: string;
  listing_id: string;
  created_at: string;
}

export const ROOM_TYPE_LABELS: Record<string, string> = {
  suite: "套房",
  shared: "雅房",
  whole_floor: "整層",
};

export const LOCATION_LABELS: Record<string, string> = {
  "taipei-zhongzheng": "台北・中正",
  "taipei-daan": "台北・大安",
  "taipei-zhongshan": "台北・中山",
  "taipei-songshan": "台北・松山",
  "taipei-xinyi": "台北・信義",
  "taipei-shilin": "台北・士林",
  "taipei-beitou": "台北・北投",
  "taipei-neihu": "台北・內湖",
  "taipei-nangang": "台北・南港",
  "taipei-wenshan": "台北・文山",
  "taipei-wanhua": "台北・萬華",
  "taipei-datong": "台北・大同",
  "newtaipei-banqiao": "新北・板橋",
  "newtaipei-zhonghe": "新北・中和",
  "newtaipei-yonghe": "新北・永和",
  "newtaipei-xindian": "新北・新店",
  "newtaipei-sanchong": "新北・三重",
  "newtaipei-xinzhuang": "新北・新莊",
  "newtaipei-tucheng": "新北・土城",
  "newtaipei-luzhou": "新北・蘆洲",
  "newtaipei-shulin": "新北・樹林",
  "newtaipei-xizhi": "新北・汐止",
  "newtaipei-tamsui": "新北・淡水",
};
