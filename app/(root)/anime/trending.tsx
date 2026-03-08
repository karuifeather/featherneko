import InfiniteScrollAnime from '@/components/infinte-scroll-list';

const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
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

const TrendingScreen = () => {
  return <InfiniteScrollAnime query={query} title="Trending" />;
};

export default TrendingScreen;
