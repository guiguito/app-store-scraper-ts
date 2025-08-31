export interface AppLite {
  id: string | number;
  appId: string;
  title: string;
  url: string;
  icon: string | undefined;
  price: number | string;
  currency: string | undefined;
  free: boolean;
  description?: string;
  developer: string;
  developerUrl?: string;
  developerId?: string | number;
  genre?: string;
  genreId?: string | number;
  released?: string;
}

export interface App extends AppLite {
  genres?: string[];
  genreIds?: string[];
  primaryGenre?: string;
  primaryGenreId?: number;
  contentRating?: string;
  languages?: string[];
  size?: string;
  requiredOsVersion?: string;
  updated?: string;
  releaseNotes?: string;
  version?: string;
  score?: number;
  reviews?: number;
  currentVersionScore?: number;
  currentVersionReviews?: number;
  screenshots?: string[];
  ipadScreenshots?: string[];
  appletvScreenshots?: string[];
  supportedDevices?: string[];
  ratings?: number;
  histogram?: Record<string, number>;
}

export interface Review {
  id: string;
  userName: string;
  userUrl: string;
  version: string;
  score: number;
  title: string;
  text: string;
  url: string;
  updated: string;
}

export interface Ratings {
  ratings: number;
  histogram: Record<string | number, number>;
}

export interface PrivacyDetails {
  managePrivacyChoicesUrl: string | null;
  privacyTypes: Array<{
    privacyType: string;
    identifier: string;
    description: string;
    dataCategories: Array<{
      dataCategory: string;
      identifier: string;
      dataTypes: string[];
    }>;
    purposes: string[];
  }>;
}

export interface VersionHistoryItem {
  versionDisplay: string;
  releaseNotes: string;
  releaseDate: string;
  releaseTimestamp: string;
}

export interface BaseOptions {
  country?: string;
  lang?: string;
  requestOptions?: { method?: string; headers?: Record<string, string>; body?: any; };
  throttle?: number; // requests per second
}

