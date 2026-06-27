export interface ApiFieldError {
  field: string;
  message: string;
}

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
  age?: number;
  description?: string;
  contact_info?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 帶看 (viewing) types — see apps/api/handler/viewings.go
export type ViewingStatus =
  | "confirmed"
  | "completed"
  | "cancelled"
  | "cancelled_landlord";

export interface ViewingAvailability {
  enabled: boolean;
  slot_minutes: number;
  slot_capacity: number; // groups per slot (團體帶看); min 1
  weekly: Record<string, [string, string][]>; // "0".."6" (0=Sunday)
  booking_range_days: number;
  exceptions: string[];
}

export interface ViewingSlot {
  start: string;
  end: string;
  booked_count: number;
  capacity: number;
}

export interface Viewing {
  id: string;
  match_id: string;
  match_active: boolean;
  tenant_profile_id: string;
  listing_id: string;
  profile_name: string;
  listing_name: string;
  starts_at: string;
  ends_at: string;
  status: ViewingStatus;
  attendance: "" | "attended" | "absent";
  landlord_notes: string;
  contact_info: string;
  address: string;
  location_id: string;
  rent: number;
  room_type: string;
}

export interface Listing {
  id: string;
  landlord_id: string;
  location_id: string;
  address?: string;
  name: string;
  rent: number;
  management_fee: number;
  room_type: string;
  area_ping: number;
  num_bedrooms?: number | null;
  num_living_rooms?: number | null;
  num_bathrooms?: number | null;
  num_balconies?: number | null;
  available_from: string;
  min_lease_months: number;
  allow_pets: boolean;
  allow_subsidy: boolean;
  allow_tax_receipt: boolean;
  allow_household_registration: boolean;
  allow_cooking: boolean;
  has_parking: boolean;
  allow_smoking: boolean;
  description?: string;
  contact_info?: string;
  status: string;
  photos: string[];
  lat?: number | null;
  lng?: number | null;
  created_at: string;
  updated_at: string;
}

export interface MatchedListingCard {
  id: string;
  location_id: string;
  name: string;
  rent: number;
  management_fee: number;
  room_type: string;
  area_ping: number;
  num_bedrooms?: number | null;
  num_living_rooms?: number | null;
  num_bathrooms?: number | null;
  num_balconies?: number | null;
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
  address?: string;
  description?: string;
  lat?: number | null;
  lng?: number | null;
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
  age?: number;
  description?: string;
  interest_sent: boolean;
}

export interface MutualMatch {
  match_id: string;
  tenant_profile_id: string;
  listing_id: string;
  listing_name?: string;
  contact_info: string;
  matched_at: string;
  tenant_occupation?: string;
  tenant_age?: number;
  tenant_has_pets?: boolean;
  tenant_description?: string;
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

export interface LocationDistrict {
  id: string;
  districtLabel: string;
  label: string;
}

export interface LocationCity {
  cityCode: string;
  cityLabel: string;
  districts: LocationDistrict[];
}

export const LOCATION_GROUPS: LocationCity[] = [
  {
    cityCode: "01",
    cityLabel: "台北市",
    districts: [
      { id: "01-0101", districtLabel: "松山區", label: "台北市・松山區" },
      { id: "01-0102", districtLabel: "大安區", label: "台北市・大安區" },
      { id: "01-0109", districtLabel: "大同區", label: "台北市・大同區" },
      { id: "01-0110", districtLabel: "中山區", label: "台北市・中山區" },
      { id: "01-0111", districtLabel: "內湖區", label: "台北市・內湖區" },
      { id: "01-0112", districtLabel: "南港區", label: "台北市・南港區" },
      { id: "01-0115", districtLabel: "士林區", label: "台北市・士林區" },
      { id: "01-0116", districtLabel: "北投區", label: "台北市・北投區" },
      { id: "01-0117", districtLabel: "信義區", label: "台北市・信義區" },
      { id: "01-0118", districtLabel: "中正區", label: "台北市・中正區" },
      { id: "01-0119", districtLabel: "萬華區", label: "台北市・萬華區" },
      { id: "01-0120", districtLabel: "文山區", label: "台北市・文山區" },
    ],
  },
  {
    cityCode: "31",
    cityLabel: "新北市",
    districts: [
      { id: "31-3101", districtLabel: "板橋區", label: "新北市・板橋區" },
      { id: "31-3102", districtLabel: "三重區", label: "新北市・三重區" },
      { id: "31-3103", districtLabel: "永和區", label: "新北市・永和區" },
      { id: "31-3104", districtLabel: "中和區", label: "新北市・中和區" },
      { id: "31-3105", districtLabel: "新店區", label: "新北市・新店區" },
      { id: "31-3106", districtLabel: "新莊區", label: "新北市・新莊區" },
      { id: "31-3107", districtLabel: "樹林區", label: "新北市・樹林區" },
      { id: "31-3108", districtLabel: "鶯歌區", label: "新北市・鶯歌區" },
      { id: "31-3109", districtLabel: "三峽區", label: "新北市・三峽區" },
      { id: "31-3110", districtLabel: "淡水區", label: "新北市・淡水區" },
      { id: "31-3111", districtLabel: "汐止區", label: "新北市・汐止區" },
      { id: "31-3112", districtLabel: "瑞芳區", label: "新北市・瑞芳區" },
      { id: "31-3113", districtLabel: "土城區", label: "新北市・土城區" },
      { id: "31-3114", districtLabel: "蘆洲區", label: "新北市・蘆洲區" },
      { id: "31-3115", districtLabel: "五股區", label: "新北市・五股區" },
      { id: "31-3116", districtLabel: "泰山區", label: "新北市・泰山區" },
      { id: "31-3117", districtLabel: "林口區", label: "新北市・林口區" },
      { id: "31-3118", districtLabel: "深坑區", label: "新北市・深坑區" },
      { id: "31-3119", districtLabel: "石碇區", label: "新北市・石碇區" },
      { id: "31-3120", districtLabel: "坪林區", label: "新北市・坪林區" },
      { id: "31-3121", districtLabel: "三芝區", label: "新北市・三芝區" },
      { id: "31-3122", districtLabel: "石門區", label: "新北市・石門區" },
      { id: "31-3123", districtLabel: "八里區", label: "新北市・八里區" },
      { id: "31-3124", districtLabel: "平溪區", label: "新北市・平溪區" },
      { id: "31-3125", districtLabel: "雙溪區", label: "新北市・雙溪區" },
      { id: "31-3126", districtLabel: "貢寮區", label: "新北市・貢寮區" },
      { id: "31-3127", districtLabel: "金山區", label: "新北市・金山區" },
      { id: "31-3128", districtLabel: "萬里區", label: "新北市・萬里區" },
      { id: "31-3129", districtLabel: "烏來區", label: "新北市・烏來區" },
    ],
  },
  {
    cityCode: "32",
    cityLabel: "桃園市",
    districts: [
      { id: "32-3201", districtLabel: "桃園區", label: "桃園市・桃園區" },
      { id: "32-3202", districtLabel: "中壢區", label: "桃園市・中壢區" },
      { id: "32-3203", districtLabel: "大溪區", label: "桃園市・大溪區" },
      { id: "32-3204", districtLabel: "楊梅區", label: "桃園市・楊梅區" },
      { id: "32-3205", districtLabel: "蘆竹區", label: "桃園市・蘆竹區" },
      { id: "32-3206", districtLabel: "大園區", label: "桃園市・大園區" },
      { id: "32-3207", districtLabel: "龜山區", label: "桃園市・龜山區" },
      { id: "32-3208", districtLabel: "八德區", label: "桃園市・八德區" },
      { id: "32-3209", districtLabel: "龍潭區", label: "桃園市・龍潭區" },
      { id: "32-3210", districtLabel: "平鎮區", label: "桃園市・平鎮區" },
      { id: "32-3211", districtLabel: "新屋區", label: "桃園市・新屋區" },
      { id: "32-3212", districtLabel: "觀音區", label: "桃園市・觀音區" },
      { id: "32-3213", districtLabel: "復興區", label: "桃園市・復興區" },
    ],
  },
  {
    cityCode: "12",
    cityLabel: "新竹市",
    districts: [
      { id: "12-1201", districtLabel: "東區", label: "新竹市・東區" },
      { id: "12-1204", districtLabel: "北區", label: "新竹市・北區" },
      { id: "12-1205", districtLabel: "香山區", label: "新竹市・香山區" },
    ],
  },
  {
    cityCode: "33",
    cityLabel: "新竹縣",
    districts: [
      { id: "33-3301", districtLabel: "關西鎮", label: "新竹縣・關西鎮" },
      { id: "33-3302", districtLabel: "新埔鎮", label: "新竹縣・新埔鎮" },
      { id: "33-3303", districtLabel: "竹東鎮", label: "新竹縣・竹東鎮" },
      { id: "33-3305", districtLabel: "竹北市", label: "新竹縣・竹北市" },
      { id: "33-3306", districtLabel: "湖口鄉", label: "新竹縣・湖口鄉" },
      { id: "33-3307", districtLabel: "橫山鄉", label: "新竹縣・橫山鄉" },
      { id: "33-3308", districtLabel: "新豐鄉", label: "新竹縣・新豐鄉" },
      { id: "33-3309", districtLabel: "芎林鄉", label: "新竹縣・芎林鄉" },
      { id: "33-3310", districtLabel: "寶山鄉", label: "新竹縣・寶山鄉" },
      { id: "33-3311", districtLabel: "北埔鄉", label: "新竹縣・北埔鄉" },
      { id: "33-3312", districtLabel: "峨眉鄉", label: "新竹縣・峨眉鄉" },
      { id: "33-3313", districtLabel: "尖石鄉", label: "新竹縣・尖石鄉" },
      { id: "33-3314", districtLabel: "五峰鄉", label: "新竹縣・五峰鄉" },
    ],
  },
  {
    cityCode: "35",
    cityLabel: "苗栗縣",
    districts: [
      { id: "35-3501", districtLabel: "苗栗市", label: "苗栗縣・苗栗市" },
      { id: "35-3502", districtLabel: "苑裡鎮", label: "苗栗縣・苑裡鎮" },
      { id: "35-3503", districtLabel: "通霄鎮", label: "苗栗縣・通霄鎮" },
      { id: "35-3504", districtLabel: "竹南鎮", label: "苗栗縣・竹南鎮" },
      { id: "35-3505", districtLabel: "頭份市", label: "苗栗縣・頭份市" },
      { id: "35-3506", districtLabel: "後龍鎮", label: "苗栗縣・後龍鎮" },
      { id: "35-3507", districtLabel: "卓蘭鎮", label: "苗栗縣・卓蘭鎮" },
      { id: "35-3508", districtLabel: "大湖鄉", label: "苗栗縣・大湖鄉" },
      { id: "35-3509", districtLabel: "公館鄉", label: "苗栗縣・公館鄉" },
      { id: "35-3510", districtLabel: "銅鑼鄉", label: "苗栗縣・銅鑼鄉" },
      { id: "35-3511", districtLabel: "南庄鄉", label: "苗栗縣・南庄鄉" },
      { id: "35-3512", districtLabel: "頭屋鄉", label: "苗栗縣・頭屋鄉" },
      { id: "35-3513", districtLabel: "三義鄉", label: "苗栗縣・三義鄉" },
      { id: "35-3514", districtLabel: "西湖鄉", label: "苗栗縣・西湖鄉" },
      { id: "35-3515", districtLabel: "造橋鄉", label: "苗栗縣・造橋鄉" },
      { id: "35-3516", districtLabel: "三灣鄉", label: "苗栗縣・三灣鄉" },
      { id: "35-3517", districtLabel: "獅潭鄉", label: "苗栗縣・獅潭鄉" },
      { id: "35-3518", districtLabel: "泰安鄉", label: "苗栗縣・泰安鄉" },
    ],
  },
  {
    cityCode: "03",
    cityLabel: "台中市",
    districts: [
      { id: "03-0322", districtLabel: "中區", label: "台中市・中區" },
      { id: "03-0323", districtLabel: "東區", label: "台中市・東區" },
      { id: "03-0324", districtLabel: "西區", label: "台中市・西區" },
      { id: "03-0325", districtLabel: "南區", label: "台中市・南區" },
      { id: "03-0326", districtLabel: "北區", label: "台中市・北區" },
      { id: "03-0327", districtLabel: "西屯區", label: "台中市・西屯區" },
      { id: "03-0328", districtLabel: "南屯區", label: "台中市・南屯區" },
      { id: "03-0329", districtLabel: "北屯區", label: "台中市・北屯區" },
      { id: "03-0301", districtLabel: "豐原區", label: "台中市・豐原區" },
      { id: "03-0302", districtLabel: "東勢區", label: "台中市・東勢區" },
      { id: "03-0303", districtLabel: "大甲區", label: "台中市・大甲區" },
      { id: "03-0304", districtLabel: "清水區", label: "台中市・清水區" },
      { id: "03-0305", districtLabel: "沙鹿區", label: "台中市・沙鹿區" },
      { id: "03-0306", districtLabel: "梧棲區", label: "台中市・梧棲區" },
      { id: "03-0307", districtLabel: "后里區", label: "台中市・后里區" },
      { id: "03-0308", districtLabel: "神岡區", label: "台中市・神岡區" },
      { id: "03-0309", districtLabel: "潭子區", label: "台中市・潭子區" },
      { id: "03-0310", districtLabel: "大雅區", label: "台中市・大雅區" },
      { id: "03-0311", districtLabel: "新社區", label: "台中市・新社區" },
      { id: "03-0312", districtLabel: "石岡區", label: "台中市・石岡區" },
      { id: "03-0313", districtLabel: "外埔區", label: "台中市・外埔區" },
      { id: "03-0314", districtLabel: "大安區", label: "台中市・大安區" },
      { id: "03-0315", districtLabel: "烏日區", label: "台中市・烏日區" },
      { id: "03-0316", districtLabel: "大肚區", label: "台中市・大肚區" },
      { id: "03-0317", districtLabel: "龍井區", label: "台中市・龍井區" },
      { id: "03-0318", districtLabel: "霧峰區", label: "台中市・霧峰區" },
      { id: "03-0319", districtLabel: "太平區", label: "台中市・太平區" },
      { id: "03-0320", districtLabel: "大里區", label: "台中市・大里區" },
      { id: "03-0321", districtLabel: "和平區", label: "台中市・和平區" },
    ],
  },
  {
    cityCode: "37",
    cityLabel: "彰化縣",
    districts: [
      { id: "37-3701", districtLabel: "彰化市", label: "彰化縣・彰化市" },
      { id: "37-3702", districtLabel: "鹿港鎮", label: "彰化縣・鹿港鎮" },
      { id: "37-3703", districtLabel: "和美鎮", label: "彰化縣・和美鎮" },
      { id: "37-3704", districtLabel: "北斗鎮", label: "彰化縣・北斗鎮" },
      { id: "37-3705", districtLabel: "員林市", label: "彰化縣・員林市" },
      { id: "37-3706", districtLabel: "溪湖鎮", label: "彰化縣・溪湖鎮" },
      { id: "37-3707", districtLabel: "田中鎮", label: "彰化縣・田中鎮" },
      { id: "37-3708", districtLabel: "二林鎮", label: "彰化縣・二林鎮" },
      { id: "37-3709", districtLabel: "線西鄉", label: "彰化縣・線西鄉" },
      { id: "37-3710", districtLabel: "伸港鄉", label: "彰化縣・伸港鄉" },
      { id: "37-3711", districtLabel: "福興鄉", label: "彰化縣・福興鄉" },
      { id: "37-3712", districtLabel: "秀水鄉", label: "彰化縣・秀水鄉" },
      { id: "37-3713", districtLabel: "花壇鄉", label: "彰化縣・花壇鄉" },
      { id: "37-3714", districtLabel: "芬園鄉", label: "彰化縣・芬園鄉" },
      { id: "37-3715", districtLabel: "大村鄉", label: "彰化縣・大村鄉" },
      { id: "37-3716", districtLabel: "埔鹽鄉", label: "彰化縣・埔鹽鄉" },
      { id: "37-3717", districtLabel: "埔心鄉", label: "彰化縣・埔心鄉" },
      { id: "37-3718", districtLabel: "永靖鄉", label: "彰化縣・永靖鄉" },
      { id: "37-3719", districtLabel: "社頭鄉", label: "彰化縣・社頭鄉" },
      { id: "37-3720", districtLabel: "二水鄉", label: "彰化縣・二水鄉" },
      { id: "37-3721", districtLabel: "田尾鄉", label: "彰化縣・田尾鄉" },
      { id: "37-3722", districtLabel: "埤頭鄉", label: "彰化縣・埤頭鄉" },
      { id: "37-3723", districtLabel: "芳苑鄉", label: "彰化縣・芳苑鄉" },
      { id: "37-3724", districtLabel: "大城鄉", label: "彰化縣・大城鄉" },
      { id: "37-3725", districtLabel: "竹塘鄉", label: "彰化縣・竹塘鄉" },
      { id: "37-3726", districtLabel: "溪州鄉", label: "彰化縣・溪州鄉" },
    ],
  },
  {
    cityCode: "38",
    cityLabel: "南投縣",
    districts: [
      { id: "38-3801", districtLabel: "南投市", label: "南投縣・南投市" },
      { id: "38-3802", districtLabel: "埔里鎮", label: "南投縣・埔里鎮" },
      { id: "38-3803", districtLabel: "草屯鎮", label: "南投縣・草屯鎮" },
      { id: "38-3804", districtLabel: "竹山鎮", label: "南投縣・竹山鎮" },
      { id: "38-3805", districtLabel: "集集鎮", label: "南投縣・集集鎮" },
      { id: "38-3806", districtLabel: "名間鄉", label: "南投縣・名間鄉" },
      { id: "38-3807", districtLabel: "鹿谷鄉", label: "南投縣・鹿谷鄉" },
      { id: "38-3808", districtLabel: "中寮鄉", label: "南投縣・中寮鄉" },
      { id: "38-3809", districtLabel: "魚池鄉", label: "南投縣・魚池鄉" },
      { id: "38-3810", districtLabel: "國姓鄉", label: "南投縣・國姓鄉" },
      { id: "38-3811", districtLabel: "水里鄉", label: "南投縣・水里鄉" },
      { id: "38-3812", districtLabel: "信義鄉", label: "南投縣・信義鄉" },
      { id: "38-3813", districtLabel: "仁愛鄉", label: "南投縣・仁愛鄉" },
    ],
  },
  {
    cityCode: "39",
    cityLabel: "雲林縣",
    districts: [
      { id: "39-3901", districtLabel: "斗六市", label: "雲林縣・斗六市" },
      { id: "39-3902", districtLabel: "斗南鎮", label: "雲林縣・斗南鎮" },
      { id: "39-3903", districtLabel: "虎尾鎮", label: "雲林縣・虎尾鎮" },
      { id: "39-3904", districtLabel: "西螺鎮", label: "雲林縣・西螺鎮" },
      { id: "39-3905", districtLabel: "土庫鎮", label: "雲林縣・土庫鎮" },
      { id: "39-3906", districtLabel: "北港鎮", label: "雲林縣・北港鎮" },
      { id: "39-3907", districtLabel: "古坑鄉", label: "雲林縣・古坑鄉" },
      { id: "39-3908", districtLabel: "大埤鄉", label: "雲林縣・大埤鄉" },
      { id: "39-3909", districtLabel: "莿桐鄉", label: "雲林縣・莿桐鄉" },
      { id: "39-3910", districtLabel: "林內鄉", label: "雲林縣・林內鄉" },
      { id: "39-3911", districtLabel: "二崙鄉", label: "雲林縣・二崙鄉" },
      { id: "39-3912", districtLabel: "崙背鄉", label: "雲林縣・崙背鄉" },
      { id: "39-3913", districtLabel: "麥寮鄉", label: "雲林縣・麥寮鄉" },
      { id: "39-3914", districtLabel: "東勢鄉", label: "雲林縣・東勢鄉" },
      { id: "39-3915", districtLabel: "褒忠鄉", label: "雲林縣・褒忠鄉" },
      { id: "39-3916", districtLabel: "台西鄉", label: "雲林縣・台西鄉" },
      { id: "39-3917", districtLabel: "元長鄉", label: "雲林縣・元長鄉" },
      { id: "39-3918", districtLabel: "四湖鄉", label: "雲林縣・四湖鄉" },
      { id: "39-3919", districtLabel: "口湖鄉", label: "雲林縣・口湖鄉" },
      { id: "39-3920", districtLabel: "水林鄉", label: "雲林縣・水林鄉" },
    ],
  },
  {
    cityCode: "22",
    cityLabel: "嘉義市",
    districts: [
      { id: "22-2201", districtLabel: "東區", label: "嘉義市・東區" },
      { id: "22-2202", districtLabel: "西區", label: "嘉義市・西區" },
    ],
  },
  {
    cityCode: "40",
    cityLabel: "嘉義縣",
    districts: [
      { id: "40-4001", districtLabel: "朴子市", label: "嘉義縣・朴子市" },
      { id: "40-4002", districtLabel: "布袋鎮", label: "嘉義縣・布袋鎮" },
      { id: "40-4003", districtLabel: "大林鎮", label: "嘉義縣・大林鎮" },
      { id: "40-4004", districtLabel: "民雄鄉", label: "嘉義縣・民雄鄉" },
      { id: "40-4005", districtLabel: "溪口鄉", label: "嘉義縣・溪口鄉" },
      { id: "40-4006", districtLabel: "新港鄉", label: "嘉義縣・新港鄉" },
      { id: "40-4007", districtLabel: "六腳鄉", label: "嘉義縣・六腳鄉" },
      { id: "40-4008", districtLabel: "東石鄉", label: "嘉義縣・東石鄉" },
      { id: "40-4009", districtLabel: "義竹鄉", label: "嘉義縣・義竹鄉" },
      { id: "40-4010", districtLabel: "鹿草鄉", label: "嘉義縣・鹿草鄉" },
      { id: "40-4011", districtLabel: "太保市", label: "嘉義縣・太保市" },
      { id: "40-4012", districtLabel: "水上鄉", label: "嘉義縣・水上鄉" },
      { id: "40-4013", districtLabel: "中埔鄉", label: "嘉義縣・中埔鄉" },
      { id: "40-4014", districtLabel: "竹崎鄉", label: "嘉義縣・竹崎鄉" },
      { id: "40-4015", districtLabel: "梅山鄉", label: "嘉義縣・梅山鄉" },
      { id: "40-4016", districtLabel: "番路鄉", label: "嘉義縣・番路鄉" },
      { id: "40-4017", districtLabel: "大埔鄉", label: "嘉義縣・大埔鄉" },
      { id: "40-4018", districtLabel: "阿里山鄉", label: "嘉義縣・阿里山鄉" },
    ],
  },
  {
    cityCode: "05",
    cityLabel: "台南市",
    districts: [
      { id: "05-0532", districtLabel: "東區", label: "台南市・東區" },
      { id: "05-0533", districtLabel: "南區", label: "台南市・南區" },
      { id: "05-0534", districtLabel: "中西區", label: "台南市・中西區" },
      { id: "05-0535", districtLabel: "北區", label: "台南市・北區" },
      { id: "05-0537", districtLabel: "安南區", label: "台南市・安南區" },
      { id: "05-0538", districtLabel: "安平區", label: "台南市・安平區" },
      { id: "05-0531", districtLabel: "永康區", label: "台南市・永康區" },
      { id: "05-0527", districtLabel: "仁德區", label: "台南市・仁德區" },
      { id: "05-0528", districtLabel: "歸仁區", label: "台南市・歸仁區" },
      { id: "05-0529", districtLabel: "關廟區", label: "台南市・關廟區" },
      { id: "05-0530", districtLabel: "龍崎區", label: "台南市・龍崎區" },
      { id: "05-0501", districtLabel: "新營區", label: "台南市・新營區" },
      { id: "05-0502", districtLabel: "鹽水區", label: "台南市・鹽水區" },
      { id: "05-0503", districtLabel: "白河區", label: "台南市・白河區" },
      { id: "05-0504", districtLabel: "麻豆區", label: "台南市・麻豆區" },
      { id: "05-0505", districtLabel: "佳里區", label: "台南市・佳里區" },
      { id: "05-0506", districtLabel: "新化區", label: "台南市・新化區" },
      { id: "05-0507", districtLabel: "善化區", label: "台南市・善化區" },
      { id: "05-0508", districtLabel: "學甲區", label: "台南市・學甲區" },
      { id: "05-0509", districtLabel: "柳營區", label: "台南市・柳營區" },
      { id: "05-0510", districtLabel: "後壁區", label: "台南市・後壁區" },
      { id: "05-0511", districtLabel: "東山區", label: "台南市・東山區" },
      { id: "05-0512", districtLabel: "下營區", label: "台南市・下營區" },
      { id: "05-0513", districtLabel: "六甲區", label: "台南市・六甲區" },
      { id: "05-0514", districtLabel: "官田區", label: "台南市・官田區" },
      { id: "05-0515", districtLabel: "大內區", label: "台南市・大內區" },
      { id: "05-0516", districtLabel: "西港區", label: "台南市・西港區" },
      { id: "05-0517", districtLabel: "七股區", label: "台南市・七股區" },
      { id: "05-0518", districtLabel: "將軍區", label: "台南市・將軍區" },
      { id: "05-0519", districtLabel: "北門區", label: "台南市・北門區" },
      { id: "05-0520", districtLabel: "新市區", label: "台南市・新市區" },
      { id: "05-0521", districtLabel: "安定區", label: "台南市・安定區" },
      { id: "05-0522", districtLabel: "山上區", label: "台南市・山上區" },
      { id: "05-0523", districtLabel: "玉井區", label: "台南市・玉井區" },
      { id: "05-0524", districtLabel: "楠西區", label: "台南市・楠西區" },
      { id: "05-0525", districtLabel: "南化區", label: "台南市・南化區" },
      { id: "05-0526", districtLabel: "左鎮區", label: "台南市・左鎮區" },
    ],
  },
  {
    cityCode: "07",
    cityLabel: "高雄市",
    districts: [
      { id: "07-0728", districtLabel: "鹽埕區", label: "高雄市・鹽埕區" },
      { id: "07-0729", districtLabel: "鼓山區", label: "高雄市・鼓山區" },
      { id: "07-0730", districtLabel: "左營區", label: "高雄市・左營區" },
      { id: "07-0731", districtLabel: "楠梓區", label: "高雄市・楠梓區" },
      { id: "07-0732", districtLabel: "三民區", label: "高雄市・三民區" },
      { id: "07-0733", districtLabel: "新興區", label: "高雄市・新興區" },
      { id: "07-0734", districtLabel: "前金區", label: "高雄市・前金區" },
      { id: "07-0735", districtLabel: "苓雅區", label: "高雄市・苓雅區" },
      { id: "07-0736", districtLabel: "前鎮區", label: "高雄市・前鎮區" },
      { id: "07-0737", districtLabel: "旗津區", label: "高雄市・旗津區" },
      { id: "07-0738", districtLabel: "小港區", label: "高雄市・小港區" },
      { id: "07-0701", districtLabel: "鳳山區", label: "高雄市・鳳山區" },
      { id: "07-0702", districtLabel: "岡山區", label: "高雄市・岡山區" },
      { id: "07-0703", districtLabel: "旗山區", label: "高雄市・旗山區" },
      { id: "07-0704", districtLabel: "美濃區", label: "高雄市・美濃區" },
      { id: "07-0705", districtLabel: "林園區", label: "高雄市・林園區" },
      { id: "07-0706", districtLabel: "大寮區", label: "高雄市・大寮區" },
      { id: "07-0707", districtLabel: "大樹區", label: "高雄市・大樹區" },
      { id: "07-0708", districtLabel: "仁武區", label: "高雄市・仁武區" },
      { id: "07-0709", districtLabel: "大社區", label: "高雄市・大社區" },
      { id: "07-0710", districtLabel: "鳥松區", label: "高雄市・鳥松區" },
      { id: "07-0711", districtLabel: "橋頭區", label: "高雄市・橋頭區" },
      { id: "07-0712", districtLabel: "燕巢區", label: "高雄市・燕巢區" },
      { id: "07-0713", districtLabel: "田寮區", label: "高雄市・田寮區" },
      { id: "07-0714", districtLabel: "阿蓮區", label: "高雄市・阿蓮區" },
      { id: "07-0715", districtLabel: "路竹區", label: "高雄市・路竹區" },
      { id: "07-0716", districtLabel: "湖內區", label: "高雄市・湖內區" },
      { id: "07-0717", districtLabel: "茄萣區", label: "高雄市・茄萣區" },
      { id: "07-0718", districtLabel: "永安區", label: "高雄市・永安區" },
      { id: "07-0719", districtLabel: "彌陀區", label: "高雄市・彌陀區" },
      { id: "07-0720", districtLabel: "梓官區", label: "高雄市・梓官區" },
      { id: "07-0721", districtLabel: "六龜區", label: "高雄市・六龜區" },
      { id: "07-0722", districtLabel: "甲仙區", label: "高雄市・甲仙區" },
      { id: "07-0723", districtLabel: "杉林區", label: "高雄市・杉林區" },
      { id: "07-0724", districtLabel: "內門區", label: "高雄市・內門區" },
      { id: "07-0725", districtLabel: "茂林區", label: "高雄市・茂林區" },
      { id: "07-0726", districtLabel: "桃源區", label: "高雄市・桃源區" },
      { id: "07-0727", districtLabel: "那瑪夏區", label: "高雄市・那瑪夏區" },
    ],
  },
  {
    cityCode: "43",
    cityLabel: "屏東縣",
    districts: [
      { id: "43-4301", districtLabel: "屏東市", label: "屏東縣・屏東市" },
      { id: "43-4302", districtLabel: "潮州鎮", label: "屏東縣・潮州鎮" },
      { id: "43-4303", districtLabel: "東港鎮", label: "屏東縣・東港鎮" },
      { id: "43-4304", districtLabel: "恆春鎮", label: "屏東縣・恆春鎮" },
      { id: "43-4305", districtLabel: "萬丹鄉", label: "屏東縣・萬丹鄉" },
      { id: "43-4306", districtLabel: "長治鄉", label: "屏東縣・長治鄉" },
      { id: "43-4307", districtLabel: "麟洛鄉", label: "屏東縣・麟洛鄉" },
      { id: "43-4308", districtLabel: "九如鄉", label: "屏東縣・九如鄉" },
      { id: "43-4309", districtLabel: "里港鄉", label: "屏東縣・里港鄉" },
      { id: "43-4310", districtLabel: "鹽埔鄉", label: "屏東縣・鹽埔鄉" },
      { id: "43-4311", districtLabel: "高樹鄉", label: "屏東縣・高樹鄉" },
      { id: "43-4312", districtLabel: "萬巒鄉", label: "屏東縣・萬巒鄉" },
      { id: "43-4313", districtLabel: "內埔鄉", label: "屏東縣・內埔鄉" },
      { id: "43-4314", districtLabel: "竹田鄉", label: "屏東縣・竹田鄉" },
      { id: "43-4315", districtLabel: "新埤鄉", label: "屏東縣・新埤鄉" },
      { id: "43-4316", districtLabel: "枋寮鄉", label: "屏東縣・枋寮鄉" },
      { id: "43-4317", districtLabel: "新園鄉", label: "屏東縣・新園鄉" },
      { id: "43-4318", districtLabel: "崁頂鄉", label: "屏東縣・崁頂鄉" },
      { id: "43-4319", districtLabel: "林邊鄉", label: "屏東縣・林邊鄉" },
      { id: "43-4320", districtLabel: "南州鄉", label: "屏東縣・南州鄉" },
      { id: "43-4321", districtLabel: "佳冬鄉", label: "屏東縣・佳冬鄉" },
      { id: "43-4322", districtLabel: "琉球鄉", label: "屏東縣・琉球鄉" },
      { id: "43-4323", districtLabel: "車城鄉", label: "屏東縣・車城鄉" },
      { id: "43-4324", districtLabel: "滿州鄉", label: "屏東縣・滿州鄉" },
      { id: "43-4325", districtLabel: "枋山鄉", label: "屏東縣・枋山鄉" },
      { id: "43-4326", districtLabel: "三地門鄉", label: "屏東縣・三地門鄉" },
      { id: "43-4327", districtLabel: "霧台鄉", label: "屏東縣・霧台鄉" },
      { id: "43-4328", districtLabel: "瑪家鄉", label: "屏東縣・瑪家鄉" },
      { id: "43-4329", districtLabel: "泰武鄉", label: "屏東縣・泰武鄉" },
      { id: "43-4330", districtLabel: "來義鄉", label: "屏東縣・來義鄉" },
      { id: "43-4331", districtLabel: "春日鄉", label: "屏東縣・春日鄉" },
      { id: "43-4332", districtLabel: "獅子鄉", label: "屏東縣・獅子鄉" },
      { id: "43-4333", districtLabel: "牡丹鄉", label: "屏東縣・牡丹鄉" },
    ],
  },
  {
    cityCode: "11",
    cityLabel: "基隆市",
    districts: [
      { id: "11-1101", districtLabel: "中正區", label: "基隆市・中正區" },
      { id: "11-1102", districtLabel: "七堵區", label: "基隆市・七堵區" },
      { id: "11-1103", districtLabel: "暖暖區", label: "基隆市・暖暖區" },
      { id: "11-1104", districtLabel: "仁愛區", label: "基隆市・仁愛區" },
      { id: "11-1105", districtLabel: "中山區", label: "基隆市・中山區" },
      { id: "11-1106", districtLabel: "安樂區", label: "基隆市・安樂區" },
      { id: "11-1107", districtLabel: "信義區", label: "基隆市・信義區" },
    ],
  },
  {
    cityCode: "34",
    cityLabel: "宜蘭縣",
    districts: [
      { id: "34-3401", districtLabel: "宜蘭市", label: "宜蘭縣・宜蘭市" },
      { id: "34-3402", districtLabel: "羅東鎮", label: "宜蘭縣・羅東鎮" },
      { id: "34-3403", districtLabel: "蘇澳鎮", label: "宜蘭縣・蘇澳鎮" },
      { id: "34-3404", districtLabel: "頭城鎮", label: "宜蘭縣・頭城鎮" },
      { id: "34-3405", districtLabel: "礁溪鄉", label: "宜蘭縣・礁溪鄉" },
      { id: "34-3406", districtLabel: "壯圍鄉", label: "宜蘭縣・壯圍鄉" },
      { id: "34-3407", districtLabel: "員山鄉", label: "宜蘭縣・員山鄉" },
      { id: "34-3408", districtLabel: "冬山鄉", label: "宜蘭縣・冬山鄉" },
      { id: "34-3409", districtLabel: "五結鄉", label: "宜蘭縣・五結鄉" },
      { id: "34-3410", districtLabel: "三星鄉", label: "宜蘭縣・三星鄉" },
      { id: "34-3411", districtLabel: "大同鄉", label: "宜蘭縣・大同鄉" },
      { id: "34-3412", districtLabel: "南澳鄉", label: "宜蘭縣・南澳鄉" },
    ],
  },
  {
    cityCode: "45",
    cityLabel: "花蓮縣",
    districts: [
      { id: "45-4501", districtLabel: "花蓮市", label: "花蓮縣・花蓮市" },
      { id: "45-4502", districtLabel: "鳳林鎮", label: "花蓮縣・鳳林鎮" },
      { id: "45-4503", districtLabel: "玉里鎮", label: "花蓮縣・玉里鎮" },
      { id: "45-4504", districtLabel: "新城鄉", label: "花蓮縣・新城鄉" },
      { id: "45-4505", districtLabel: "吉安鄉", label: "花蓮縣・吉安鄉" },
      { id: "45-4506", districtLabel: "壽豐鄉", label: "花蓮縣・壽豐鄉" },
      { id: "45-4507", districtLabel: "光復鄉", label: "花蓮縣・光復鄉" },
      { id: "45-4508", districtLabel: "豐濱鄉", label: "花蓮縣・豐濱鄉" },
      { id: "45-4509", districtLabel: "瑞穗鄉", label: "花蓮縣・瑞穗鄉" },
      { id: "45-4510", districtLabel: "富里鄉", label: "花蓮縣・富里鄉" },
      { id: "45-4511", districtLabel: "秀林鄉", label: "花蓮縣・秀林鄉" },
      { id: "45-4512", districtLabel: "萬榮鄉", label: "花蓮縣・萬榮鄉" },
      { id: "45-4513", districtLabel: "卓溪鄉", label: "花蓮縣・卓溪鄉" },
    ],
  },
  {
    cityCode: "46",
    cityLabel: "台東縣",
    districts: [
      { id: "46-4601", districtLabel: "台東市", label: "台東縣・台東市" },
      { id: "46-4602", districtLabel: "成功鎮", label: "台東縣・成功鎮" },
      { id: "46-4603", districtLabel: "關山鎮", label: "台東縣・關山鎮" },
      { id: "46-4604", districtLabel: "卑南鄉", label: "台東縣・卑南鄉" },
      { id: "46-4605", districtLabel: "大武鄉", label: "台東縣・大武鄉" },
      { id: "46-4606", districtLabel: "太麻里鄉", label: "台東縣・太麻里鄉" },
      { id: "46-4607", districtLabel: "東河鄉", label: "台東縣・東河鄉" },
      { id: "46-4608", districtLabel: "長濱鄉", label: "台東縣・長濱鄉" },
      { id: "46-4609", districtLabel: "鹿野鄉", label: "台東縣・鹿野鄉" },
      { id: "46-4610", districtLabel: "池上鄉", label: "台東縣・池上鄉" },
      { id: "46-4611", districtLabel: "綠島鄉", label: "台東縣・綠島鄉" },
      { id: "46-4612", districtLabel: "延平鄉", label: "台東縣・延平鄉" },
      { id: "46-4613", districtLabel: "海端鄉", label: "台東縣・海端鄉" },
      { id: "46-4614", districtLabel: "達仁鄉", label: "台東縣・達仁鄉" },
      { id: "46-4615", districtLabel: "金峰鄉", label: "台東縣・金峰鄉" },
      { id: "46-4616", districtLabel: "蘭嶼鄉", label: "台東縣・蘭嶼鄉" },
    ],
  },
  {
    cityCode: "44",
    cityLabel: "澎湖縣",
    districts: [
      { id: "44-4401", districtLabel: "馬公市", label: "澎湖縣・馬公市" },
      { id: "44-4402", districtLabel: "湖西鄉", label: "澎湖縣・湖西鄉" },
      { id: "44-4403", districtLabel: "白沙鄉", label: "澎湖縣・白沙鄉" },
      { id: "44-4404", districtLabel: "西嶼鄉", label: "澎湖縣・西嶼鄉" },
      { id: "44-4405", districtLabel: "望安鄉", label: "澎湖縣・望安鄉" },
      { id: "44-4406", districtLabel: "七美鄉", label: "澎湖縣・七美鄉" },
    ],
  },
  {
    cityCode: "90",
    cityLabel: "金門縣",
    districts: [
      { id: "90-9001", districtLabel: "金城鎮", label: "金門縣・金城鎮" },
      { id: "90-9002", districtLabel: "金沙鎮", label: "金門縣・金沙鎮" },
      { id: "90-9003", districtLabel: "金湖鎮", label: "金門縣・金湖鎮" },
      { id: "90-9004", districtLabel: "金寧鄉", label: "金門縣・金寧鄉" },
      { id: "90-9005", districtLabel: "烈嶼鄉", label: "金門縣・烈嶼鄉" },
      { id: "90-9006", districtLabel: "烏坵鄉", label: "金門縣・烏坵鄉" },
    ],
  },
  {
    cityCode: "91",
    cityLabel: "連江縣",
    districts: [
      { id: "91-9101", districtLabel: "南竿鄉", label: "連江縣・南竿鄉" },
      { id: "91-9102", districtLabel: "北竿鄉", label: "連江縣・北竿鄉" },
      { id: "91-9103", districtLabel: "莒光鄉", label: "連江縣・莒光鄉" },
      { id: "91-9104", districtLabel: "東引鄉", label: "連江縣・東引鄉" },
    ],
  },
];

export const LOCATION_LABELS: Record<string, string> = Object.fromEntries(
  LOCATION_GROUPS.flatMap((c) => c.districts.map((d) => [d.id, d.label]))
);

export const LOCATIONS = LOCATION_GROUPS.flatMap((c) => c.districts);

export const RECOMMENDED_LOCATION_IDS = [
  "01-0102", // 台北市・大安區
  "01-0118", // 台北市・中正區
  "01-0110", // 台北市・中山區
  "01-0117", // 台北市・信義區
  "31-3101", // 新北市・板橋區
  "31-3104", // 新北市・中和區
  "31-3105", // 新北市・新店區
  "31-3102", // 新北市・三重區
];

// Maps location_id → { city, district } natural key for API requests.
// cityLabel / districtLabel in LOCATION_GROUPS match the seed's city / district columns exactly.
export const LOCATION_CITY_DISTRICT: Record<string, { city: string; district: string }> =
  Object.fromEntries(
    LOCATION_GROUPS.flatMap((c) =>
      c.districts.map((d) => [d.id, { city: c.cityLabel, district: d.districtLabel }])
    )
  );
