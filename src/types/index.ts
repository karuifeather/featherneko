// Anime Details
export interface Anime {
  id: number;
  idMal: number;
  coverImage: {
    large: string;
  };
  genres: string[];
  title: {
    english: string | null;
    romaji: string | null;
  };
  rankings: {
    rank: number;
    context: string;
    allTime: boolean;
    year: number | null;
    season: string | null;
  }[];
  meanScore: number | null;
  favourites: number;
  bannerImage: string | null;
  status: string | null;
  stats: {
    statusDistribution: StatusDistribution[];
  } | null;
  popularity: number | null;
  description: string | null;
  startDate: DateDetails | null;
  endDate: DateDetails | null;
  episodes: number | null;
  averageScore: number | null;
  nextAiringEpisode: NextAiringEpisode | null;
  reviews: {
    pageInfo: {
      hasNextPage: boolean;
      lastPage: number;
      currentPage: number;
      perPage: number;
      total: number;
    };
  };
  recommendations: {
    pageInfo: {
      hasNextPage: boolean;
      lastPage: number;
      currentPage: number;
      perPage: number;
      total: number;
    };
  };
}

// Status Distribution
export interface StatusDistribution {
  amount: number;
  status: string;
}

// Date Details
export interface DateDetails {
  day: number;
  month: number;
  year: number;
}

// Next Airing Episode Details
export interface NextAiringEpisode {
  episode: number;
  airingAt: number;
  timeUntilAiring: number;
}

/**
 * @fileoverview Type definitions Kitsu API
 */
// Root object
export interface EpisodesResponse {
  data: Episode[];
  meta: Meta;
  links: PaginationLinks;
}

// Episode object
export interface Episode {
  id: string;
  type: string;
  links: Links;
  attributes: EpisodeAttributes;
  relationships: Relationships;
}

// Pagination Links object
export interface PaginationLinks {
  first: string;
  next: string;
  last: string;
}

// Links object
export interface Links {
  self: string;
  related?: string; // Used in relationships
}

// Episode attributes
export interface EpisodeAttributes {
  createdAt: string;
  updatedAt: string;
  synopsis: string;
  description: string;
  titles: Titles;
  canonicalTitle: string;
  seasonNumber: number;
  number: number;
  relativeNumber: number;
  airdate: string;
  length: number;
  thumbnail: Thumbnail;
}

// Titles object
export interface Titles {
  en_jp?: string;
  en_us?: string;
  ja_jp?: string;
}

// Thumbnail object
export interface Thumbnail {
  original: string;
  meta: ThumbnailMeta;
}

// Thumbnail metadata
export interface ThumbnailMeta {
  dimensions: Record<string, unknown>;
}

// Relationships object
export interface Relationships {
  media: Relationship;
  videos: Relationship;
}

// Individual relationship
export interface Relationship {
  links: Links;
}

// Meta object
export interface Meta {
  count: number;
}
