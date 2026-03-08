import InfiniteScrollAnime from '@/components/infinte-scroll-list';

const query = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(sort: SCORE_DESC, type: ANIME, isAdult: false) {
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

const TopScreen = () => {
  return <InfiniteScrollAnime query={query} title="Top All Time" />;
};

export default TopScreen;
