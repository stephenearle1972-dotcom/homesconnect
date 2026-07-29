export type Listing = {
  id: string;
  type: 'sale' | 'rent';
  status: string;
  tier: 'basic' | 'enhanced' | 'agency' | '';
  title: string;
  price: number;
  priceDisplay: string;
  bedrooms: number;
  bathrooms: number;
  garage: number;
  garden: boolean;
  pool: boolean;
  petFriendly: boolean;
  propertyType: string;
  suburb: string;
  city: string;
  province: string;
  description: string;
  imageUrl: string;
  image2: string;
  image3: string;
  agentName: string;
  agentPhone: string;
  agentAgency: string;
  featured: boolean;
  dateListed: string;
  sellerType: 'agent' | 'private';
  whatsapp: string;
  sizeSqm: number;
  address: string;
  makeAnOfferEnabled: boolean;
  // Image-moderation state: '' (grandfathered=approved) | 'approved' | 'flagged' | 'rejected'.
  moderation: string;
};

// One row per agent in the Agents tab. Joined onto listings by agent_name
// (trimmed, case-insensitive exact match — see loadAgents.ts). Optional
// fields are blank when not supplied; every consumer must treat them as
// possibly empty and degrade cleanly, never assume they're populated.
export type Agent = {
  agentName: string;
  photoUrl: string;
  agencyLogoWhiteUrl: string;
  agencyLogoColourUrl: string;
  email: string;
  jobTitle: string;
  bio: string;
};
