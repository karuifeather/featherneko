import InfiniteScrollAnime from '@/components/infinte-scroll-list';
import getSeasonsDynamic from '@/utils/getSeasonsDynamic';

const query = `
  query ($page: Int, $perPage: Int,) {
    Page(page: $page, perPage: $perPage) {
      media(
        sort: POPULARITY_DESC, 
        type: ANIME, 
        isAdult: false, 
      ) {
        id
        idMal
        title {
          romaji
          english
        }
        coverImage {
          extraLarge
          large
          color
        }
      }
      pageInfo {
        currentPage
        hasNextPage
      }
    }
  }
`;

const PopularScreen = () => {
  return (
    <InfiniteScrollAnime
      query={query}
      vars={getSeasonsDynamic}
      title={'Popular Anime'}
    />
  );
};

export default PopularScreen;
