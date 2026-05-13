export const queryKeys = {
  series: {
    all: () => ["series"],
    detail: (id) => ["series", id],
    seasons: (id) => ["seasons", id],
    watched: (id) => ["series", id, "watched"],
  },
  episodes: {
    bySeason: (seasonId) => ["episodes", seasonId],
    streams: (episodeId) => ["episodes", episodeId, "streams"],
    allBySeries: (seriesId) => ["episodes", "series", seriesId],
  },
  lists: {
    mine: () => ["lists", "mine"],
  },
};
