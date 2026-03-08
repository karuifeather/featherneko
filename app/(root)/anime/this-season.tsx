import InfiniteScrollAnime from '@/components/infinte-scroll-list';
import getSeasonsDynamic from '@/utils/getSeasonsDynamic';

const query = `
  query ($page: Int, $perPage: Int, $season: MediaSeason, $seasonYear: Int) {
    Page(page: $page, perPage: $perPage) {
      media(
        season: $season
        seasonYear: $seasonYear
        sort: POPULARITY_DESC
        type: ANIME
        isAdult: false
      ) {
        id
        idMal
        title {
          romaji
          english
        }
        coverImage {
          large
        }
      }
      pageInfo {
        currentPage
        hasNextPage
      }
    }
  }
`;

const SeasonScreen = () => {
  return (
    <InfiniteScrollAnime
      query={query}
      vars={getSeasonsDynamic()}
      title="Popular This Season"
    />
  );
};

export default SeasonScreen;
