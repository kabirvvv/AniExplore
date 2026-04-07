export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=120");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "id param required" });

  const query = `
    query ($id: Int) {
      Media(id: $id, type: MANGA) {
        id
        idMal
        title { romaji english native }
        bannerImage
        coverImage { extraLarge large medium }
        description(asHtml: false)
        genres
        tags { name rank isMediaSpoiler }
        averageScore
        meanScore
        popularity
        favourites
        status
        format
        chapters
        volumes
        startDate { year month day }
        endDate { year month day }
        season
        source
        countryOfOrigin
        isAdult

        characters(sort: ROLE, perPage: 12) {
          edges {
            role
            node {
              id
              name { full native }
              image { large medium }
              description(asHtml: false)
              gender
              age
            }
          }
        }

        staff(perPage: 8) {
          edges {
            role
            node {
              id
              name { full native }
              image { large medium }
              primaryOccupations
            }
          }
        }

        relations {
          edges {
            relationType
            node {
              id
              idMal
              title { romaji english }
              coverImage { large medium }
              type
              format
              status
              averageScore
            }
          }
        }

        recommendations(perPage: 6) {
          nodes {
            mediaRecommendation {
              id
              idMal
              title { romaji english }
              coverImage { large medium }
              averageScore
              format
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { id: parseInt(id) } }),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `AniList error: ${response.status}` });
    }

    const json = await response.json();
    const m = json.data?.Media;
    if (!m) return res.status(404).json({ error: "Manga not found" });

    // Format date helper
    const fmtDate = (d) => {
      if (!d?.year) return null;
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return d.month ? `${months[d.month - 1]} ${d.year}` : `${d.year}`;
    };

    const data = {
      anilist_id: m.id,
      mal_id: m.idMal,
      title: m.title.english || m.title.romaji,
      title_english: m.title.english,
      title_romaji: m.title.romaji,
      title_japanese: m.title.native,
      banner_image: m.bannerImage,
      images: {
        webp: { large_image_url: m.coverImage.extraLarge || m.coverImage.large },
        jpg: { large_image_url: m.coverImage.extraLarge || m.coverImage.large },
      },
      cover: {
        extraLarge: m.coverImage.extraLarge,
        large: m.coverImage.large,
        medium: m.coverImage.medium,
      },
      synopsis: m.description,
      genres: (m.genres || []).map((g, i) => ({ mal_id: i, name: g })),
      tags: (m.tags || [])
        .filter((t) => !t.isMediaSpoiler)
        .slice(0, 10)
        .map((t) => ({ name: t.name, rank: t.rank })),
      score: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
      mean_score: m.meanScore,
      popularity: m.popularity,
      favourites: m.favourites,
      status: m.status,
      format: m.format,
      chapters: m.chapters,
      volumes: m.volumes,
      start_date: fmtDate(m.startDate),
      end_date: fmtDate(m.endDate),
      source: m.source,
      country: m.countryOfOrigin,
      is_adult: m.isAdult,

      characters: (m.characters?.edges || []).map((e) => ({
        id: e.node.id,
        role: e.role,
        name: e.node.name.full,
        name_native: e.node.name.native,
        image: e.node.image.large || e.node.image.medium,
        gender: e.node.gender,
        age: e.node.age,
      })),

      staff: (m.staff?.edges || []).map((e) => ({
        id: e.node.id,
        role: e.role,
        name: e.node.name.full,
        image: e.node.image.large || e.node.image.medium,
        occupations: e.node.primaryOccupations,
      })),

      relations: (m.relations?.edges || [])
        .filter((e) => e.node.type === "MANGA" || e.relationType === "ADAPTATION")
        .map((e) => ({
          id: e.node.id,
          relation_type: e.relationType,
          title: e.node.title.english || e.node.title.romaji,
          cover: e.node.coverImage.large || e.node.coverImage.medium,
          format: e.node.format,
          status: e.node.status,
          score: e.node.averageScore ? (e.node.averageScore / 10).toFixed(1) : null,
        })),

      recommendations: (m.recommendations?.nodes || [])
        .filter((n) => n.mediaRecommendation)
        .map((n) => ({
          id: n.mediaRecommendation.id,
          title: n.mediaRecommendation.title.english || n.mediaRecommendation.title.romaji,
          cover: n.mediaRecommendation.coverImage.large || n.mediaRecommendation.coverImage.medium,
          score: n.mediaRecommendation.averageScore
            ? (n.mediaRecommendation.averageScore / 10).toFixed(1)
            : null,
          format: n.mediaRecommendation.format,
        })),
    };

    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
             }
