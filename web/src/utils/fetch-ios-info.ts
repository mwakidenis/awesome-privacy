import { fetchEnrich } from './fetch-enrich';

// Pull the id from an App Store URL's `/id123` segment, else pass it through.
const extractId = (iosUrl: string): string => {
  const match = iosUrl.match(/\/id(\d+)/);
  return match ? match[1] : iosUrl;
};

export const fetchIosInfo = (iosUrl: string): Promise<IoSApiResponse | null> =>
  fetchEnrich<IoSApiResponse>(
    'iOS',
    `/v1/enrich/ios/${extractId(iosUrl)}`,
    iosUrl,
  );

export interface IoSApiResponse {
  artistViewUrl: string;
  releaseNotes: string;
  artworkUrl60: string;
  artworkUrl100: string;
  artworkUrl512: string;
  supportedDevices: string[];
  features: string[];
  screenshotUrls: string[];
  ipadScreenshotUrls: string[];
  appletvScreenshotUrls: string[];
  advisories: string[];
  isGameCenterEnabled: boolean;
  kind: string;
  fileSizeBytes: number;
  sellerUrl: string;
  formattedPrice: string;
  userRatingCountForCurrentVersion: number;
  trackContentRating: string;
  trackCensoredName: string;
  trackViewUrl: string;
  contentAdvisoryRating: string;
  artistId: number;
  artistName: string;
  genres: string[];
  price: number;
  trackId: number;
  trackName: string;
  description: string;
  currentVersionReleaseDate: string;
  averageUserRatingForCurrentVersion: number;
  isVppDeviceBasedLicensingEnabled: boolean;
  genreIds: string[];
  sellerName: string;
  languageCodesISO2A: string[];
  releaseDate: string;
  bundleId: string;
  currency: string;
  averageUserRating: number;
  minimumOsVersion: string;
  primaryGenreName: string;
  primaryGenreId: number;
  version: string;
  wrapperType: string;
  userRatingCount: number;
}
