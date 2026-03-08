import InfiniteScrollAnime from '@/components/infinte-scroll-list';
import getSeasonsDynamic from '@/utils/getSeasonsDynamic';

const query = `
  query ($page: Int, $perPage: Int, $nextSeason: MediaSeason, $nextYear: Int) {
    Page(page: $page, perPage: $perPage) {
      media(
        season: $nextSeason, 
        seasonYear: $nextYear, 
        sort: POPULARITY_DESC, 
        type: ANIME, 
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

const UpcomingScreen = () => {
  return (
    <InfiniteScrollAnime
      query={query}
      vars={getSeasonsDynamic()}
      title={'Upcoming Next Season'}
    />
  );
};

export default UpcomingScreen;
