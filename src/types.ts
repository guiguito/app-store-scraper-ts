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
  /**
   * The short tagline under the app name on the App Store (30 characters max), e.g. "Spanish, French, Chess & Math".
   * Only set when the call passes `subtitle: true`, and only when the app has one (many don't).
   * Not the first line of `description`. iOS subtitle, or the Mac one for Mac-only apps.
   */
  subtitle?: string;
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
  /** Top in-app purchases. Only set when `app()` is called with `inAppPurchases: true`. */
  inAppPurchases?: InAppPurchase[];
}

/**
 * One of the app's top in-app purchases (Apple lists up to 10, the ones shown on the App Store page),
 * priced in the `country` storefront's currency. Returned by `inAppPurchases()`.
 */
export interface InAppPurchase {
  /** Apple's numeric id for the in-app purchase. */
  id: string;
  /** The developer's product identifier, e.g. `com.duolingo.DuolingoMobile.subscription.Premium.OneMonth`. */
  productId: string;
  /** Display name, e.g. "Super Duolingo". */
  title: string;
  /** Short description, when the developer set one (often the same as `title`). */
  description?: string;
  /** Numeric price, e.g. 9.99. */
  price: number;
  /** ISO 4217 currency code, e.g. "USD". */
  currency: string;
  /** Localized price as the store shows it, e.g. "$9.99" or "9,99 €". */
  formattedPrice: string;
  /** True for auto-renewable subscriptions. */
  subscription: boolean;
  /** Billing period of a subscription as an ISO 8601 duration (`P1W`, `P1M`, `P1Y`); undefined otherwise. */
  subscriptionPeriod?: string;
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
  /** Helpful votes minus not-helpful votes (can be negative). */
  voteSum: number;
  /** Total votes, helpful and not helpful. */
  voteCount: number;
}

export interface Ratings {
  ratings: number;
  histogram: Record<string | number, number>;
}

export interface PrivacyDetails {
  managePrivacyChoicesUrl: string | null;
  /** The developer's privacy policy link from the App Store page (iOS, or Mac for Mac-only apps), or null. */
  privacyPolicyUrl: string | null;
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

