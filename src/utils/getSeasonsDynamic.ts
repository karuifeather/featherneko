export default () => {
  const seasons = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const currentYear = new Date().getFullYear();

  let currentSeasonIndex;

  const month = new Date().getMonth();

  if (month >= 0 && month <= 2) {
    currentSeasonIndex = 0; // WINTER: January, February, March
  } else if (month >= 3 && month <= 5) {
    currentSeasonIndex = 1; // SPRING: April, May, June
  } else if (month >= 6 && month <= 8) {
    currentSeasonIndex = 2; // SUMMER: July, August, September
  } else {
    currentSeasonIndex = 3; // FALL: October, November, December
  }

  const season = seasons[currentSeasonIndex];
  const seasonYear = currentSeasonIndex === 0 ? currentYear + 1 : currentYear;

  const nextSeasonIndex = (currentSeasonIndex + 1) % seasons.length;
  const nextSeason = seasons[nextSeasonIndex];
  const nextYear = nextSeasonIndex === 0 ? currentYear + 1 : currentYear;

  return {
    type: 'ANIME',
    season,
    seasonYear,
    nextSeason,
    nextYear,
  };
};
