import { calculateRoadDistanceKm } from './distanceCalculator';
import { getApiUrl } from './apiUrl';

export interface GeocodedAddressResult {
  fullAddress: string;
  placeName?: string;
  street?: string;
  locality?: string;
  city?: string;
  postalCode?: string;
  isFallback?: boolean;
}

const geocodeCache = new Map<string, GeocodedAddressResult>();

// Google Maps API Key from environment or provisioned Maps key
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyB9pAU6h7_1zk9j7hEWdhcwmwQA80Ep0ZE';

// Comprehensive Tricity POI spatial index (Hotels, Hospitals, Markets, Homes/Societies, Gardens, Institutions, Buildings)
export const KNOWN_LANDMARKS = [
  // --- HOTELS & RESORTS ---
  { name: 'JW Marriott Hotel, Sector 35, Chandigarh', lat: 30.724514, lng: 76.764124, type: 'hotel' },
  { name: 'Hotel Mountview, Sector 10, Chandigarh', lat: 30.751514, lng: 76.789124, type: 'hotel' },
  { name: 'Taj Chandigarh, Sector 17, Chandigarh', lat: 30.741214, lng: 76.783514, type: 'hotel' },
  { name: 'Hyatt Regency, Industrial Area Phase 1, Chandigarh', lat: 30.707514, lng: 76.802514, type: 'hotel' },
  { name: 'Radisson RED, Sector 66, Mohali', lat: 30.689514, lng: 76.738514, type: 'hotel' },
  { name: 'The Lalit, Rajiv Gandhi IT Park, Chandigarh', lat: 30.728514, lng: 76.845514, type: 'hotel' },
  { name: 'Hotel Shivalikview, Sector 17, Chandigarh', lat: 30.738514, lng: 76.780514, type: 'hotel' },
  { name: 'Hotel Maya, Sector 35B, Chandigarh', lat: 30.723514, lng: 76.765514, type: 'hotel' },
  { name: 'Hotel Aroma, Sector 22C, Chandigarh', lat: 30.732814, lng: 76.772514, type: 'hotel' },
  { name: 'Hotel Western Court, Sector 43, Chandigarh', lat: 30.721514, lng: 76.746514, type: 'hotel' },
  { name: 'Hotel Suraj & Restaurant, Sector 22, Chandigarh', lat: 30.732814, lng: 76.772514, type: 'hotel' },
  { name: 'Hotel Paradise, Sector 7C, Chandigarh', lat: 30.732514, lng: 76.804514, type: 'hotel' },
  { name: 'Hotel Paradise, Sector 22, Chandigarh', lat: 30.731514, lng: 76.772124, type: 'hotel' },
  { name: 'Hotel Paradise, Sector 52, Chandigarh', lat: 30.718514, lng: 76.726514, type: 'hotel' },
  { name: 'Holiday Inn, Sector 3, Panchkula', lat: 30.701514, lng: 76.842514, type: 'hotel' },
  { name: 'The Bella Vista, Sector 5, Panchkula', lat: 30.698514, lng: 76.854514, type: 'hotel' },
  { name: 'Park Plaza, Ambala-Chandigarh Highway, Zirakpur', lat: 30.642514, lng: 76.822514, type: 'hotel' },
  { name: 'Ramada Plaza, VIP Road, Zirakpur', lat: 30.645514, lng: 76.818514, type: 'hotel' },
  { name: 'Country Inn & Suites, Zirakpur', lat: 30.641514, lng: 76.824514, type: 'hotel' },
  { name: 'Glades Hotel, Sector 55, Phase 5, Mohali', lat: 30.723124, lng: 76.719514, type: 'hotel' },
  { name: 'The Altius Hotel, Industrial Area Phase 2, Chandigarh', lat: 30.698514, lng: 76.792514, type: 'hotel' },
  { name: 'Lemon Tree Hotel, Industrial Area Phase 1, Chandigarh', lat: 30.704514, lng: 76.801514, type: 'hotel' },
  { name: 'Hotel Aquamarine, Sector 22, Chandigarh', lat: 30.731214, lng: 76.773514, type: 'hotel' },
  { name: 'The Fern Residency, Industrial Area Phase 2, Chandigarh', lat: 30.697514, lng: 76.791514, type: 'hotel' },
  { name: 'Hotel Sunbeam, Sector 22B, Chandigarh', lat: 30.733514, lng: 76.775514, type: 'hotel' },
  { name: 'Hotel Grand Plaza, Sector 42, Chandigarh', lat: 30.726514, lng: 76.741514, type: 'hotel' },
  { name: 'Hotel Diamond, Sector 22, Chandigarh', lat: 30.732114, lng: 76.774514, type: 'hotel' },
  { name: 'Hotel City Plaza 17, Sector 17, Chandigarh', lat: 30.742514, lng: 76.781514, type: 'hotel' },
  { name: 'Hotel City Heart Premium, Sector 17, Chandigarh', lat: 30.739514, lng: 76.781214, type: 'hotel' },
  { name: 'Hotel Rajshree, Industrial Area Phase 1, Chandigarh', lat: 30.709514, lng: 76.805514, type: 'hotel' },
  { name: 'Hometel Chandigarh, Industrial Area Phase 1, Chandigarh', lat: 30.706514, lng: 76.803514, type: 'hotel' },
  { name: 'Regenta Central Cassia, Zirakpur', lat: 30.643814, lng: 76.821114, type: 'hotel' },
  { name: 'Velvet Clarks Exotica, Zirakpur', lat: 30.640514, lng: 76.826514, type: 'hotel' },

  // --- HOSPITALS & MEDICAL INSTITUTES ---
  { name: 'Fortis Hospital, Phase 8, Mohali', lat: 30.712514, lng: 76.734124, type: 'hospital' },
  { name: 'Max Super Speciality Hospital, Phase 6, Mohali', lat: 30.732145, lng: 76.708234, type: 'hospital' },
  { name: 'PGIMER (Post Graduate Institute), Sector 12, Chandigarh', lat: 30.763514, lng: 76.776514, type: 'hospital' },
  { name: 'GMSH (Govt Multi Speciality Hospital), Sector 16, Chandigarh', lat: 30.748514, lng: 76.782514, type: 'hospital' },
  { name: 'GMCH-32 (Govt Medical College Hospital), Sector 32, Chandigarh', lat: 30.712514, lng: 76.778514, type: 'hospital' },
  { name: 'Civil Hospital, Sector 6, Panchkula', lat: 30.712214, lng: 76.852514, type: 'hospital' },
  { name: 'Ivy Hospital, Sector 71, Mohali', lat: 30.708914, lng: 76.709214, type: 'hospital' },
  { name: 'Sohana Eye & Super Speciality Hospital, Sector 77, Mohali', lat: 30.682514, lng: 76.714514, type: 'hospital' },
  { name: 'Alchemist Hospital, Sector 21, Panchkula', lat: 30.665514, lng: 76.872514, type: 'hospital' },
  { name: 'Ojas Hospital, Sector 26, Panchkula', lat: 30.661514, lng: 76.878514, type: 'hospital' },
  { name: 'Grecian Super Speciality Hospital, Sector 69, Mohali', lat: 30.704214, lng: 76.710514, type: 'hospital' },
  { name: 'Paras Hospital, Sector 22, Panchkula', lat: 30.668514, lng: 76.874514, type: 'hospital' },
  { name: 'Amar Hospital, Sector 70, Mohali', lat: 30.703514, lng: 76.716514, type: 'hospital' },
  { name: 'Cloudnine Hospital, Sector 43, Chandigarh', lat: 30.723514, lng: 76.744514, type: 'hospital' },
  { name: 'Eden Hospital, Industrial Area Phase 1, Chandigarh', lat: 30.708514, lng: 76.804514, type: 'hospital' },
  { name: 'Dhawan Hospital, Sector 7, Panchkula', lat: 30.706433, lng: 76.845153, type: 'hospital' },
  { name: 'Healing Hospital, Sector 34, Chandigarh', lat: 30.721514, lng: 76.769514, type: 'hospital' },
  { name: 'Mukat Hospital, Sector 34, Chandigarh', lat: 30.722514, lng: 76.768514, type: 'hospital' },
  { name: 'Landmark Hospital, Sector 33, Chandigarh', lat: 30.719514, lng: 76.765514, type: 'hospital' },
  { name: 'Cosmo Hospital, Sector 62, Phase 8, Mohali', lat: 30.711514, lng: 76.732514, type: 'hospital' },
  { name: 'Indus Super Speciality Hospital, Phase 1, Mohali', lat: 30.729514, lng: 76.721514, type: 'hospital' },
  { name: 'JP Hospital, Zirakpur-Patiala Highway, Zirakpur', lat: 30.638514, lng: 76.815514, type: 'hospital' },
  { name: 'Trinity Hospital & Medical Research, Zirakpur', lat: 30.645514, lng: 76.828514, type: 'hospital' },
  { name: 'Mehar Hospital, VIP Road, Zirakpur', lat: 30.644114, lng: 76.819514, type: 'hospital' },
  { name: 'Dhakoli Community Health Centre (CHC), Dhakoli', lat: 30.637514, lng: 76.845514, type: 'hospital' },

  // --- RESIDENTIAL SOCIETIES, BUILDINGS & ENCLAVES ---
  { name: 'Apple Heights, Dhakoli, Zirakpur', lat: 30.635814, lng: 76.848214, type: 'society' },
  { name: 'Cozy Homes, Dhakoli, Zirakpur', lat: 30.636814, lng: 76.844514, type: 'society' },
  { name: 'Cozy Homes, Sector 126 Kharar Road, Mohali', lat: 30.749124, lng: 76.654124, type: 'society' },
  { name: 'Motia City, Dhakoli, Zirakpur', lat: 30.637214, lng: 76.843114, type: 'society' },
  { name: 'Motia Blue Ridge, Dhakoli, Zirakpur', lat: 30.638914, lng: 76.845814, type: 'society' },
  { name: 'Motia Guild, Dhakoli, Zirakpur', lat: 30.636114, lng: 76.842214, type: 'society' },
  { name: 'Motia Harmony Greens, Kishanpura, Zirakpur', lat: 30.631514, lng: 76.848514, type: 'society' },
  { name: 'Savitri Greens, Gazipur Road, Zirakpur', lat: 30.632514, lng: 76.834124, type: 'society' },
  { name: 'Savitri Greens 2, Gazipur Road, Zirakpur', lat: 30.628514, lng: 76.836514, type: 'society' },
  { name: 'Maya Garden City, Gazipur Road, Zirakpur', lat: 30.635514, lng: 76.838514, type: 'society' },
  { name: 'Maya Garden Phase 1, Dhakoli, Zirakpur', lat: 30.634814, lng: 76.840214, type: 'society' },
  { name: 'Maya Garden Phase 2, Dhakoli, Zirakpur', lat: 30.633914, lng: 76.841114, type: 'society' },
  { name: 'Maya Garden Avenue, Dhakoli, Zirakpur', lat: 30.634124, lng: 76.839124, type: 'society' },
  { name: 'Maya Garden Magnesia, Dhakoli, Zirakpur', lat: 30.631214, lng: 76.841514, type: 'society' },
  { name: 'Green Valley Enclave, Dhakoli, Zirakpur', lat: 30.639514, lng: 76.844214, type: 'society' },
  { name: 'Green Enclave, Dhakoli, Zirakpur', lat: 30.641514, lng: 76.839514, type: 'society' },
  { name: 'Gulmohar City, Dhakoli, Zirakpur', lat: 30.638214, lng: 76.847514, type: 'society' },
  { name: 'Gulmohar City Heights, Dhakoli, Zirakpur', lat: 30.637514, lng: 76.848114, type: 'society' },
  { name: 'Gulmohar Trends, Dhakoli, Zirakpur', lat: 30.639114, lng: 76.846514, type: 'society' },
  { name: 'MS Enclave, Dhakoli, Zirakpur', lat: 30.640214, lng: 76.841214, type: 'society' },
  { name: 'Platinum Homes, Old Ambala Road, Zirakpur', lat: 30.651514, lng: 76.848514, type: 'society' },
  { name: 'Sanskriti Enclave, Dhakoli, Zirakpur', lat: 30.639514, lng: 76.848514, type: 'society' },
  { name: 'Anand Complex, Dhakoli, Zirakpur', lat: 30.638514, lng: 76.844114, type: 'society' },
  { name: 'Panchkula Heights, Dhakoli, Zirakpur', lat: 30.633114, lng: 76.850514, type: 'society' },
  { name: 'Ghuman Nagar, Dhakoli, Zirakpur', lat: 30.639214, lng: 76.841514, type: 'society' },
  { name: 'Maple Apartments, Dhakoli, Zirakpur', lat: 30.636514, lng: 76.846214, type: 'society' },
  { name: 'Fortune Classic, Dhakoli, Zirakpur', lat: 30.638814, lng: 76.843514, type: 'society' },
  { name: 'Hermitage Park, Dhakoli, Zirakpur', lat: 30.641214, lng: 76.845214, type: 'society' },
  { name: 'Shri Balaji Enclave, Dhakoli, Zirakpur', lat: 30.639814, lng: 76.842814, type: 'society' },
  { name: 'Penta Homes, Dhakoli, Zirakpur', lat: 30.642114, lng: 76.838914, type: 'society' },
  { name: 'Sushma Urban Views, Dhakoli, Zirakpur', lat: 30.635214, lng: 76.845514, type: 'society' },
  { name: 'Sushma Crescent, Dhakoli, Zirakpur', lat: 30.633514, lng: 76.847214, type: 'society' },
  { name: 'Sushma Grande, Chandigarh-Ambala Highway, Zirakpur', lat: 30.642814, lng: 76.825514, type: 'society' },
  { name: 'Sushma Joynest, Airport Road, Zirakpur', lat: 30.648514, lng: 76.812514, type: 'society' },
  { name: 'Sushma Belleza, Sector 124, Mohali', lat: 30.742514, lng: 76.668514, type: 'society' },
  { name: 'Highland Park, Dhakoli, Zirakpur', lat: 30.643214, lng: 76.846114, type: 'society' },
  { name: 'Royal Mansion, Dhakoli, Zirakpur', lat: 30.640814, lng: 76.847814, type: 'society' },
  { name: 'Victoria Heights, Dhakoli, Zirakpur', lat: 30.634214, lng: 76.852114, type: 'society' },
  { name: 'Aastha Apartments, Dhakoli, Zirakpur', lat: 30.637814, lng: 76.841914, type: 'society' },
  { name: 'Paras Panorama, Dhakoli, Zirakpur', lat: 30.642514, lng: 76.843814, type: 'society' },
  { name: 'Shree Vardhman Green Space, Dhakoli, Zirakpur', lat: 30.631814, lng: 76.846514, type: 'society' },
  { name: 'Golden Sand Apartments, Dhakoli, Zirakpur', lat: 30.636214, lng: 76.849514, type: 'society' },
  { name: 'Skynet Enclave, Dhakoli, Zirakpur', lat: 30.641814, lng: 76.840514, type: 'society' },
  { name: 'Imperial Apartments, Dhakoli, Zirakpur', lat: 30.638514, lng: 76.849814, type: 'society' },
  { name: 'Modern Housing Complex (MHC), Mani Majra, Chandigarh', lat: 30.718514, lng: 76.838514, type: 'society' },
  { name: 'Homeland Heights, Sector 70, Mohali', lat: 30.702514, lng: 76.719514, type: 'society' },
  { name: 'Jal Vayu Vihar, Sector 67, Mohali', lat: 30.697514, lng: 76.721514, type: 'society' },
  { name: 'JLPL Falcon View, Sector 66, Mohali', lat: 30.688514, lng: 76.734514, type: 'society' },
  { name: 'Wave Estate, Sector 85, Mohali', lat: 30.672514, lng: 76.715514, type: 'society' },
  { name: 'Marbella Grand, Sector 82, IT City, Mohali', lat: 30.661214, lng: 76.734514, type: 'society' },
  { name: 'Beverly Golf Avenue, Sector 65, Mohali', lat: 30.691514, lng: 76.741514, type: 'society' },
  { name: 'Hero Homes, Sector 88, Mohali', lat: 30.684514, lng: 76.702514, type: 'society' },
  { name: 'ATS Casa Espana, Sector 121, Mohali', lat: 30.728514, lng: 76.698514, type: 'society' },
  { name: 'TDI City, Sector 118, Mohali', lat: 30.718514, lng: 76.685514, type: 'society' },
  { name: 'Sunny Enclave, Kharar, Mohali', lat: 30.752514, lng: 76.662514, type: 'society' },
  { name: 'Gillco Valley, Kharar, Mohali', lat: 30.758514, lng: 76.658514, type: 'society' },
  { name: 'Gillco Heights, Sector 127, Mohali', lat: 30.751514, lng: 76.659514, type: 'society' },
  { name: 'Gillco Parkhills, Sector 126, Mohali', lat: 30.748514, lng: 76.661514, type: 'society' },
  { name: 'SBP City of Dreams, Landran Road, Kharar', lat: 30.738514, lng: 76.645514, type: 'society' },
  { name: 'SBP South City, VIP Road, Zirakpur', lat: 30.646514, lng: 76.816514, type: 'society' },
  { name: 'SBP Housing Park, Derabassi Road, Zirakpur', lat: 30.625514, lng: 76.832514, type: 'society' },
  { name: 'Palm Village, Sector 126, Mohali', lat: 30.747514, lng: 76.655514, type: 'society' },
  { name: 'Mona Greens, Gazipur Road, Zirakpur', lat: 30.633514, lng: 76.832514, type: 'society' },
  { name: 'Hollywood Heights, VIP Road, Zirakpur', lat: 30.643514, lng: 76.817514, type: 'society' },
  { name: 'Sigma City, Zirakpur', lat: 30.639514, lng: 76.821514, type: 'society' },

  // --- INSTITUTES, UNIVERSITIES & COLLEGES ---
  { name: 'Panjab University (PU Campus), Sector 14, Chandigarh', lat: 30.759514, lng: 76.768124, type: 'institute' },
  { name: 'PEC University of Technology, Sector 12, Chandigarh', lat: 30.766514, lng: 76.778514, type: 'institute' },
  { name: 'PGGC (Post Graduate Govt College), Sector 11, Chandigarh', lat: 30.756514, lng: 76.781514, type: 'institute' },
  { name: 'PGGCG (Govt College for Girls), Sector 11, Chandigarh', lat: 30.754514, lng: 76.784514, type: 'institute' },
  { name: 'PGGC (Post Graduate Govt College), Sector 46, Chandigarh', lat: 30.701514, lng: 76.758514, type: 'institute' },
  { name: 'PGGCG (Govt College for Girls), Sector 42, Chandigarh', lat: 30.725514, lng: 76.745514, type: 'institute' },
  { name: 'MCM DAV College for Women, Sector 36, Chandigarh', lat: 30.731514, lng: 76.751514, type: 'institute' },
  { name: 'DAV College, Sector 10, Chandigarh', lat: 30.752514, lng: 76.787514, type: 'institute' },
  { name: 'GGDSD College, Sector 32, Chandigarh', lat: 30.715514, lng: 76.776514, type: 'institute' },
  { name: 'Indian School of Business (ISB), Sector 81, Mohali', lat: 30.655514, lng: 76.728514, type: 'institute' },
  { name: 'IISER (Indian Institute of Science Education), Sector 81, Mohali', lat: 30.659514, lng: 76.732514, type: 'institute' },
  { name: 'NIPER, Sector 67, Mohali', lat: 30.691514, lng: 76.724514, type: 'institute' },
  { name: 'NABI (National Agri-Food Biotechnology Inst.), Sector 81, Mohali', lat: 30.662514, lng: 76.735514, type: 'institute' },
  { name: 'Plaksha University, Sector 101 IT City, Mohali', lat: 30.642514, lng: 76.748514, type: 'institute' },
  { name: 'Amity University, Sector 82A, Mohali', lat: 30.651514, lng: 76.741514, type: 'institute' },
  { name: 'Chandigarh University (CU), NH 21, Gharuan', lat: 30.768514, lng: 76.575514, type: 'institute' },
  { name: 'Chitkara University, Chandigarh-Patiala National Highway', lat: 30.516514, lng: 76.659514, type: 'institute' },
  { name: 'CGC Landran (Chandigarh Group of Colleges), Mohali', lat: 30.686514, lng: 76.665514, type: 'institute' },
  { name: 'CGC Jhanjeri, Mohali', lat: 30.648514, lng: 76.635514, type: 'institute' },
  { name: 'Rayat Bahra University, Kharar-Kurali Highway', lat: 30.791514, lng: 76.638514, type: 'institute' },
  { name: 'CCET (Chandigarh College of Engg. & Tech.), Sector 26, Chandigarh', lat: 30.727514, lng: 76.806514, type: 'institute' },
  { name: 'NITTTR (Technical Teachers Training Inst.), Sector 26, Chandigarh', lat: 30.729514, lng: 76.804514, type: 'institute' },
  { name: 'UIET (University Institute of Engg. & Tech.), Sector 25, PU, Chandigarh', lat: 30.748514, lng: 76.758514, type: 'institute' },
  { name: 'Army Institute of Law (AIL), Sector 68, Mohali', lat: 30.701514, lng: 76.721514, type: 'institute' },
  { name: 'Govt Home Science College, Sector 10, Chandigarh', lat: 30.753514, lng: 76.786514, type: 'institute' },
  { name: 'Govt College of Art, Sector 10, Chandigarh', lat: 30.755514, lng: 76.788514, type: 'institute' },
  { name: 'Chandigarh College of Architecture, Sector 12, Chandigarh', lat: 30.761514, lng: 76.780514, type: 'institute' },

  // --- SHOPPING MALLS & COMMERCIAL CENTERS ---
  { name: 'Elante Mall, Industrial Area Phase 1, Chandigarh', lat: 30.705514, lng: 76.801124, type: 'mall' },
  { name: 'VR Punjab Mall, Kharar Road, Mohali', lat: 30.748231, lng: 76.689241, type: 'mall' },
  { name: 'CP67 Mall, Sector 67, Mohali', lat: 30.695214, lng: 76.718912, type: 'mall' },
  { name: 'Bestech Square Mall, Sector 66, Mohali', lat: 30.690514, lng: 76.736124, type: 'mall' },
  { name: 'Cosmo Mall, Ambala-Chandigarh Highway, Zirakpur', lat: 30.645514, lng: 76.822124, type: 'mall' },
  { name: 'DLF City Centre Mall, Rajiv Gandhi IT Park, Chandigarh', lat: 30.725514, lng: 76.842514, type: 'mall' },
  { name: 'Sector 17 Plaza & Shopping Arcade, Chandigarh', lat: 30.739834, lng: 76.782702, type: 'market' },
  { name: 'Phase 3B2 Market & Food Hub, Mohali', lat: 30.718912, lng: 76.711245, type: 'market' },
  { name: 'Phase 7 Food Street & Main Market, Mohali', lat: 30.710412, lng: 76.721415, type: 'market' },
  { name: 'Sector 22 Shastri Market, Chandigarh', lat: 30.731514, lng: 76.772124, type: 'market' },
  { name: 'Sector 35 Commercial Market, Chandigarh', lat: 30.724514, lng: 76.764124, type: 'market' },
  { name: 'Sector 70 Main Market, Mohali', lat: 30.704649, lng: 76.717873, type: 'market' },
  { name: 'VIP Road Commercial Hub, Zirakpur', lat: 30.642514, lng: 76.818124, type: 'market' },
  { name: 'Dhakoli Main Market, Zirakpur', lat: 30.638514, lng: 76.842514, type: 'market' },
  { name: 'Sector 7 Market, Panchkula', lat: 30.706433, lng: 76.845153, type: 'market' },
  { name: 'Sector 8 Market, Panchkula', lat: 30.699814, lng: 76.848814, type: 'market' },
  { name: 'Sector 9 Market, Panchkula', lat: 30.708814, lng: 76.859814, type: 'market' },
  { name: 'Sector 11 Market, Panchkula', lat: 30.689514, lng: 76.861124, type: 'market' },
  { name: 'Sector 20 Market, Panchkula', lat: 30.672514, lng: 76.864514, type: 'market' },
  { name: 'QuarkCity IT Special Economic Zone, Mohali', lat: 30.715514, lng: 76.702514, type: 'building' },
  { name: 'Bestech Business Towers, Sector 66, Mohali', lat: 30.689514, lng: 76.735514, type: 'building' },
  { name: 'World Trade Center (WTC), Sector 106, Mohali', lat: 30.655514, lng: 76.712514, type: 'building' },

  // --- TRANSIT & STADIUMS ---
  { name: 'Chandigarh Railway Station, Daria', lat: 30.702514, lng: 76.822514, type: 'transit' },
  { name: 'Mohali Railway Station, Sector 104', lat: 30.672514, lng: 76.732514, type: 'transit' },
  { name: 'Shaheed Bhagat Singh International Airport (IXC), Mohali', lat: 30.673514, lng: 76.788514, type: 'transit' },
  { name: 'ISBT Sector 43 Bus Stand, Chandigarh', lat: 30.722514, lng: 76.745514, type: 'transit' },
  { name: 'ISBT Sector 17 Bus Stand, Chandigarh', lat: 30.738514, lng: 76.778514, type: 'transit' },
  { name: 'ISBT Phase 8 Mohali Bus Stand', lat: 30.715514, lng: 76.731514, type: 'transit' },
  { name: 'PCA Cricket Stadium (IS Bindra Stadium), Sector 63, Phase 9, Mohali', lat: 30.690514, lng: 76.737514, type: 'stadium' },
  { name: 'Tau Devi Lal Sports Complex & Stadium, Sector 3, Panchkula', lat: 30.698514, lng: 76.839514, type: 'stadium' },
  { name: 'Punjab & Haryana High Court, Sector 1, Chandigarh', lat: 30.758514, lng: 76.804514, type: 'building' },
  { name: 'Punjab Secretariat, Sector 1, Chandigarh', lat: 30.756514, lng: 76.801514, type: 'building' },
];

/**
 * Finds the closest known POI / Hotel / Building / Society / Institute from our spatial index.
 */
export function findClosestKnownLandmark(lat: number, lng: number, maxMeters = 380): { name: string; dist: number } | null {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;

  let closest: { name: string; dist: number } | null = null;
  for (const loc of KNOWN_LANDMARKS) {
    const distMeters = calculateRoadDistanceKm(lat, lng, loc.lat, loc.lng) * 1000;
    if (!closest || distMeters < closest.dist) {
      closest = { name: loc.name, dist: distMeters };
    }
  }

  if (closest && closest.dist <= maxMeters) {
    return closest;
  }
  return null;
}

/**
 * Fast synchronous exact location resolver (used immediately on marker drag in map picker modal)
 */
export function findInstantExactLocationName(lat: number, lng: number): string {
  if (!lat || !lng || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return 'Selected Location';

  // 1. Check cache first
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.fullAddress) return cached.fullAddress;

  // 2. Check closest high-density landmark/society/hotel/building within 380m
  const landmark = findClosestKnownLandmark(lat, lng, 380);
  if (landmark) {
    return landmark.name;
  }

  // 3. Fallback to closest named sector or locality centroid
  return findNearestTricityArea(lat, lng);
}

/**
 * Parses Google Geocoding API response into a rich human-readable place description.
 */
function parseGoogleGeocodeResult(data: any): GeocodedAddressResult | null {
  if (!data || data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
    return null;
  }

  const establishmentResult = data.results.find((r: any) =>
    r.types?.some((t: string) =>
      [
        'establishment',
        'point_of_interest',
        'premise',
        'subpremise',
        'shopping_mall',
        'hospital',
        'lodging',
        'hotel',
        'school',
        'university',
        'college',
        'park',
        'market',
        'stadium',
        'museum',
        'place_of_worship',
        'transit_station',
      ].includes(t)
    )
  );

  const sublocalityResult = data.results.find((r: any) =>
    r.types?.some((t: string) => ['sublocality_level_1', 'sublocality_level_2', 'neighborhood', 'route'].includes(t))
  );

  const bestResult = establishmentResult || sublocalityResult || data.results[0];

  let placeName = '';
  let streetNumber = '';
  let route = '';
  let sublocality = '';
  let locality = '';
  let city = '';
  let postalCode = '';

  if (establishmentResult && Array.isArray(establishmentResult.address_components)) {
    for (const comp of establishmentResult.address_components) {
      const types = comp.types || [];
      if (types.includes('point_of_interest') || types.includes('establishment') || types.includes('premise') || types.includes('hospital') || types.includes('lodging') || types.includes('school')) {
        if (!placeName) placeName = comp.long_name;
      }
    }
  }

  if (Array.isArray(bestResult.address_components)) {
    for (const comp of bestResult.address_components) {
      const types = comp.types || [];
      if (!placeName && (types.includes('point_of_interest') || types.includes('establishment') || types.includes('premise') || types.includes('hospital') || types.includes('lodging') || types.includes('school'))) {
        placeName = comp.long_name;
      }
      if (types.includes('street_number')) streetNumber = comp.long_name;
      if (types.includes('route')) route = comp.long_name;
      if (types.includes('sublocality_level_1') || types.includes('sublocality') || types.includes('neighborhood')) {
        if (!sublocality) sublocality = comp.long_name;
      }
      if (types.includes('locality')) locality = comp.long_name;
      if (types.includes('administrative_area_level_2')) city = comp.long_name;
      if (types.includes('postal_code')) postalCode = comp.long_name;
    }
  }

  const rawFormatted = (bestResult.formatted_address || '').replace(/, India$/, '').trim();
  const firstSegment = rawFormatted.split(',')[0]?.trim() || '';
  if (!placeName && firstSegment && !/^\d+/.test(firstSegment) && firstSegment.length > 2) {
    placeName = firstSegment;
  }

  const street = [streetNumber, route].filter(Boolean).join(' ');
  const finalCity = locality || city || 'Chandigarh';

  const parts: string[] = [];
  if (placeName && !parts.includes(placeName)) {
    parts.push(placeName);
  }
  if (street && !parts.some((p) => p.toLowerCase().includes(street.toLowerCase()))) {
    parts.push(street);
  }
  if (sublocality && !parts.some((p) => p.toLowerCase().includes(sublocality.toLowerCase()))) {
    parts.push(sublocality);
  }
  if (finalCity && !parts.some((p) => p.toLowerCase().includes(finalCity.toLowerCase()))) {
    parts.push(finalCity);
  }
  if (postalCode && !parts.some((p) => p.includes(postalCode))) {
    parts.push(postalCode);
  }

  let fullAddress = parts.join(', ');
  if (!fullAddress || fullAddress.length < 5) {
    fullAddress = rawFormatted;
  }

  return {
    fullAddress: fullAddress || rawFormatted || 'Selected Location',
    placeName: placeName || firstSegment || undefined,
    street: street || undefined,
    locality: sublocality || undefined,
    city: finalCity || undefined,
    postalCode: postalCode || undefined,
  };
}

/**
 * Reverse geocodes latitude/longitude coordinates into exact location name (Hotel, Building, Society, Institute, Landmark).
 * Prioritizes high-precision POI discovery with multi-source fallback.
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<GeocodedAddressResult> {
  if (!lat || !lng || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
    return { fullAddress: 'Selected Location', isFallback: true };
  }

  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 1. High-Precision Local POI Match (< 320m) for instant exact Hotel / Society / Building / Institute identification
  const exactLandmark = findClosestKnownLandmark(lat, lng, 320);
  if (exactLandmark) {
    const cleanName = exactLandmark.name.replace(/,\s*(Chandigarh|Mohali|Panchkula|Zirakpur|Kharar).*/i, '');
    const parts = exactLandmark.name.split(',').map((p) => p.trim());
    const result: GeocodedAddressResult = {
      fullAddress: exactLandmark.name,
      placeName: parts[0],
      locality: parts[1] || undefined,
      city: parts[2] || 'Chandigarh Tricity',
    };
    geocodeCache.set(cacheKey, result);
    return result;
  }

  // 2. OpenStreetMap / Nominatim High-Resolution POI Query with timeout (zoom=18 gets exact building/hotel/amenity/society)
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&extratags=1&namedetails=1`;
    const osmRes = await fetch(osmUrl, {
      signal: signal || AbortSignal.timeout(2800),
      headers: { 'Accept-Language': 'en' },
    });

    if (osmRes.ok) {
      const osmData = await osmRes.json();
      if (osmData && (osmData.name || osmData.address || osmData.display_name)) {
        const addr = osmData.address || {};
        const namedetails = osmData.namedetails || {};
        const extratags = osmData.extratags || {};

        // Extract most specific place name (hotel, building, society, amenity, institute, hospital, shop)
        const candidateName =
          osmData.name ||
          namedetails.name ||
          namedetails['name:en'] ||
          addr.hotel ||
          addr.building ||
          addr.residential ||
          addr.society ||
          addr.amenity ||
          addr.leisure ||
          addr.tourism ||
          addr.hospital ||
          addr.university ||
          addr.college ||
          addr.school ||
          addr.shop ||
          addr.commercial ||
          addr.office ||
          addr.house_name ||
          extratags.building ||
          extratags.operator;

        const street = addr.road || addr.street || '';
        const sectorOrNeighbourhood = addr.neighbourhood || addr.suburb || addr.city_district || addr.subdivision || '';
        const city = addr.city || addr.town || addr.village || addr.county || 'Chandigarh';
        const postcode = addr.postcode || '';

        const nameParts: string[] = [];
        if (candidateName && !nameParts.includes(candidateName)) {
          nameParts.push(candidateName);
        }
        if (street && !nameParts.some((p) => p.toLowerCase().includes(street.toLowerCase()))) {
          nameParts.push(street);
        }
        if (sectorOrNeighbourhood && !nameParts.some((p) => p.toLowerCase().includes(sectorOrNeighbourhood.toLowerCase()))) {
          nameParts.push(sectorOrNeighbourhood);
        }
        if (city && !nameParts.some((p) => p.toLowerCase().includes(city.toLowerCase()))) {
          nameParts.push(city);
        }
        if (postcode && !nameParts.some((p) => p.includes(postcode))) {
          nameParts.push(postcode);
        }

        const fullAddress = nameParts.length > 0 ? nameParts.join(', ') : (osmData.display_name || '').split(',').slice(0, 4).join(', ').trim();

        if (fullAddress && fullAddress.length > 3) {
          const result: GeocodedAddressResult = {
            fullAddress,
            placeName: candidateName || nameParts[0] || undefined,
            street: street || undefined,
            locality: sectorOrNeighbourhood || undefined,
            city: city || undefined,
            postalCode: postcode || undefined,
          };
          geocodeCache.set(cacheKey, result);
          return result;
        }
      }
    }
  } catch {}

  // 3. Photon Reverse Geocoding API (Fast OSM POI Engine)
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const pRes = await fetch(photonUrl, { signal: signal || AbortSignal.timeout(2400) });
    if (pRes.ok) {
      const pData = await pRes.json();
      if (pData?.features && pData.features.length > 0) {
        const props = pData.features[0].properties || {};
        const pName = props.name || props.housename || props.street || '';
        const pCity = props.city || props.district || 'Chandigarh';
        const pStreet = props.street || '';
        const pPostcode = props.postcode || '';

        const pParts: string[] = [];
        if (pName && !pParts.includes(pName)) pParts.push(pName);
        if (pStreet && pStreet !== pName && !pParts.includes(pStreet)) pParts.push(pStreet);
        if (props.district && !pParts.includes(props.district)) pParts.push(props.district);
        if (pCity && !pParts.includes(pCity)) pParts.push(pCity);
        if (pPostcode) pParts.push(pPostcode);

        const fullAddr = pParts.join(', ');
        if (fullAddr && fullAddr.length > 4) {
          const result: GeocodedAddressResult = {
            fullAddress: fullAddr,
            placeName: pName || undefined,
            street: pStreet || undefined,
            city: pCity || undefined,
            postalCode: pPostcode || undefined,
          };
          geocodeCache.set(cacheKey, result);
          return result;
        }
      }
    }
  } catch {}

  // 4. Google Maps Geocoding API Client Direct
  if (GOOGLE_MAPS_KEY) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}&region=in&language=en`;
      const gResponse = await fetch(gUrl, { signal: signal || AbortSignal.timeout(2800) });
      if (gResponse.status === 429) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      }
      if (gResponse.ok) {
        const gData = await gResponse.json();
        if (
          gData.status === 'OVER_QUERY_LIMIT' ||
          gData.status === 'RESOURCE_EXHAUSTED' ||
          (gData.error_message && /quota/i.test(gData.error_message))
        ) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
        }
        const parsed = parseGoogleGeocodeResult(gData);
        if (parsed && parsed.fullAddress) {
          geocodeCache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch {}
  }

  // 5. Backend Reverse Geocoding Proxy Route (if server is reachable)
  try {
    const serverUrl = getApiUrl(`/api/motoride/geocode/reverse?lat=${lat}&lng=${lng}`);
    const res = await fetch(serverUrl, { signal: signal || AbortSignal.timeout(2500) });
    if (res.ok) {
      const text = await res.text();
      if (text && !text.trim().startsWith('<') && !text.trim().startsWith('The page')) {
        const data = JSON.parse(text);
        if (data && (data.address || data.name)) {
          const rawAddress = (data.address || data.name || '').replace(/^near\s+/i, '').trim();
          if (
            rawAddress &&
            !rawAddress.toLowerCase().includes('pin point') &&
            !rawAddress.startsWith('Location (') &&
            !/^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/.test(rawAddress)
          ) {
            const rawPlace = (data.name || rawAddress.split(',')[0] || '').replace(/^near\s+/i, '').trim();
            const result: GeocodedAddressResult = {
              fullAddress: rawAddress,
              placeName: rawPlace || undefined,
              locality: data.locality || undefined,
              city: data.city || undefined,
              postalCode: data.postal_code || undefined,
            };
            geocodeCache.set(cacheKey, result);
            return result;
          }
        }
      }
    }
  } catch {}

  // 6. Closest Landmark / Sector / Society / Institute within 1200m
  const nearestLandmark = findClosestKnownLandmark(lat, lng, 1200);
  if (nearestLandmark) {
    const cleanName = nearestLandmark.dist <= 350 ? nearestLandmark.name : `Near ${nearestLandmark.name}`;
    const result: GeocodedAddressResult = {
      fullAddress: cleanName,
      placeName: cleanName.split(',')[0].trim(),
      city: 'Chandigarh Tricity',
    };
    geocodeCache.set(cacheKey, result);
    return result;
  }

  // 7. Graceful Fallback to nearest Tricity area centroid
  const nearest = findNearestTricityArea(lat, lng);
  const fallbackResult: GeocodedAddressResult = {
    fullAddress: nearest,
    locality: nearest,
    isFallback: true,
  };
  geocodeCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

function findNearestTricityArea(lat: number, lng: number): string {
  let closest: { name: string; dist: number } | null = null;
  for (const loc of KNOWN_LANDMARKS) {
    const dist = calculateRoadDistanceKm(lat, lng, loc.lat, loc.lng) * 1000;
    if (!closest || dist < closest.dist) {
      closest = { name: loc.name, dist };
    }
  }

  if (closest) {
    const cleanName = closest.name.replace(/^near\s+/i, '').trim();
    if (closest.dist <= 450) {
      return cleanName;
    }
    return `Near ${cleanName}`;
  }

  return 'Chandigarh Tricity Area';
}
