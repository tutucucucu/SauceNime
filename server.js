// server.js
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// ============ SAMEHADAKU FUNCTIONS ============
async function searchSamehadaku(query) {
  const searchUrl = `https://v2.samehadaku.how/?s=${encodeURIComponent(query)}`;
  const { data } = await axios.get(searchUrl, { headers: { "User-Agent": UA } });
  const $ = cheerio.load(data);
  const results = [];

  $('a[href*="/anime/"]').each((i, el) => {
    const title = $(el).find("h2").text().trim();
    const image = $(el).find("img.anmsa").attr("src");
    const type = $(el).find(".type.TV, .type.Movie").first().text().trim();
    const status = $(el).find(".data .type").text().trim();
    const score = $(el).find(".score").text().trim().replace(/[^0-9.]/g, "");
    const url = $(el).attr("href");

    if (title && url && url.includes("/anime/")) {
      results.push({ title, image: image || "", type: type || "", status: status || "", score: score || "", url });
    }
  });

  const unique = [];
  const seen = new Set();
  for (const item of results) {
    if (!seen.has(item.title)) {
      seen.add(item.title);
      unique.push(item);
    }
  }
  return unique;
}

async function detailSamehadaku(url) {
  const { data } = await axios.get(url, { headers: { "User-Agent": UA } });
  const $ = cheerio.load(data);

  const title = $('h1').first().text().trim();
  const image = $('.thumb img, img[itemprop="image"]').attr('src') || "";

  const info = {};
  $('.spe span').each((_, el) => {
    const text = $(el).text().trim();
    const parts = text.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim().toLowerCase();
      const value = parts.slice(1).join(':').trim();
      info[key] = value;
    }
  });

  const genre = $('.genxed a').map((_, el) => $(el).text().trim()).get();

  const episodes = [];
  $('.epright, .epself, li').each((_, el) => {
    const link = $(el).find('a').attr('href');
    let titleEp = $(el).find('.lchx a, .eps a, a').text().trim();
    const date = $(el).find('.date').text().trim();

    if (link && link.includes('episode')) {
      const numberMatch = link.match(/episode-(\d+)/);
      const number = numberMatch ? parseInt(numberMatch[1]) : 0;
      titleEp = titleEp.replace(/^\d+/, '').trim();

      if (number > 0) {
        episodes.push({
          number: number,
          title: titleEp || `Episode ${number}`,
          date: date,
          url: link
        });
      }
    }
  });
  episodes.sort((a, b) => a.number - b.number);

  return {
    title: title,
    image: image,
    alternative: info.japanese || info.english || "",
    status: info.status || "",
    type: info.type || "",
    studio: info.studio || "",
    released: info.released || info.rilis || "",
    duration: info.duration || info.durasi || "",
    season: info.season || info.musim || "",
    episodes: info.episodes || info.episode || "",
    genre: genre,
    synopsis: $(".entry-content p").map((_, el) => $(el).text().trim()).get().join("\n\n"),
    score: $('.rating-value, span[itemprop="ratingValue"]').text().trim() || info.rating || "",
    rating_count: $('.hidden[itemprop="ratingCount"]').text().trim() || "",
    episodeList: episodes
  };
}

async function getEpisodeDownloadSamehadaku(url) {
  const { data } = await axios.get(url, { headers: { "User-Agent": UA } });
  const $ = cheerio.load(data);

  const downloads = { "360p": null, "480p": null, "720p": null, "1080p": null };

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim().toLowerCase();
    const parentText = $(el).closest("li, div").text().toLowerCase();

    if (href && href.includes("pixeldrain")) {
      let quality = "";
      if (parentText.includes("360p") || text.includes("360p")) quality = "360p";
      else if (parentText.includes("480p") || text.includes("480p")) quality = "480p";
      else if (parentText.includes("720p") || text.includes("720p")) quality = "720p";
      else if (parentText.includes("1080p") || text.includes("1080p")) quality = "1080p";

      if (quality) {
        const idMatch = href.match(/pixeldrain\.com\/[mu]\/([a-zA-Z0-9]+)/);
        if (idMatch) {
          downloads[quality] = {
            provider: "pixeldrain",
            stream_url: `https://pixeldrain.com/api/file/${idMatch[1]}`,
            download_url: `https://pixeldrain.com/api/file/${idMatch[1]}?download`,
            file_id: idMatch[1]
          };
        }
      }
    }
  });

  return downloads;
}

async function episodeSamehadaku(url) {
  const { data } = await axios.get(url, { headers: { "User-Agent": UA } });
  const $ = cheerio.load(data);
  const title = $("h1").first().text().trim();
  const downloads = await getEpisodeDownloadSamehadaku(url);
  return { title, url, downloads };
}

// ============ ALQANIME FUNCTIONS ============
async function searchAlqanime(query) {
  const { data } = await axios.get("https://alqanime.net/?s=" + encodeURIComponent(query), { headers: { "User-Agent": UA } });
  const $ = cheerio.load(data);
  return $("article").map((_, el) => ({
    title: $(el).find(".tt .ntitle").text().trim(),
    url: $(el).find("a.tip").attr("href"),
    image: $(el).find("img").attr("src"),
    status: $(el).find(".status").text().trim(),
    type: $(el).find(".typez").text().trim(),
    score: $(el).find(".numscore").text().trim()
  })).get();
}

async function detailAlqanime(url) {
  const { data } = await axios.get(url, { headers: { "User-Agent": UA } });
  const $ = cheerio.load(data);
  const info = {};
  $(".info-content .spe span").each((_, el) => {
    const key = $(el).find("b").text().replace(":", "").trim().toLowerCase();
    const value = $(el).clone().find("b").remove().end().text().trim();
    info[key] = value;
  });
  const episodeList = $(".soraddl").map((_, ep) => ({
    episode: $(ep).find(".sorattl h3").text().trim(),
    download: $(ep).find("tbody tr").map((_, tr) => ({
      resolution: $(tr).find(".res").text().trim(),
      providers: $(tr).find(".slink a").map((_, a) => {
        let link = $(a).attr("href") || "";
        if (link.includes("?s=")) {
          try { link = decodeURIComponent(link.split("?s=")[1]); } catch {}
        }
        return { name: $(a).text().trim(), url: link };
      }).get()
    })).get()
  })).get();
  return {
    title: $(".entry-title").text().trim(),
    alternative: $(".alter").text().trim(),
    image: $(".thumb img").attr("src"),
    score: $(".rating strong").text().replace("Score", "").trim(),
    status: info.status,
    studio: info.studio,
    released: info.dirilis,
    duration: info.durasi,
    season: info.musim,
    type: info.tipe,
    episodes: info.episode,
    subtitle: info.subtitle,
    genre: $(".genxed a").map((_, el) => $(el).text().trim()).get(),
    synopsis: $(".entry-content p").map((_, el) => $(el).text().trim()).get().join("\n\n"),
    episodeList
  };
}

// ============ NONTONANIMEX FUNCTIONS ============
const NONTON_BASE = 'https://nontonanimex.com';

async function searchNonton(query) {
  try {
    const url = `${NONTON_BASE}/search/?q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, { headers: { "User-Agent": UA } });
    const $ = cheerio.load(data);
    const results = [];

    $('.listbox .xrelated').each((_, el) => {
      const link = $(el).find('a').attr('href');
      results.push({
        title: $(el).find('.titlelist').text().trim(),
        url: link.startsWith('http') ? link : `${NONTON_BASE}${link}`,
        image: $(el).find('img').attr('src'),
        type: $(el).find('.eplist').text().trim(),
        status: $(el).find('.starlist').text().trim(),
        score: $(el).find('.starlist').text().trim()
      });
    });

    return results;
  } catch (error) {
    return [];
  }
}

async function detailNonton(url) {
  try {
    const fullUrl = url.startsWith('http') ? url : `${NONTON_BASE}${url}`;
    const { data } = await axios.get(fullUrl, { headers: { "User-Agent": UA } });
    const $ = cheerio.load(data);

    const image = $('.ifc img.imgrpv').attr('src') || "";

    const info = {};
    $('ul.infol li').each((_, el) => {
      const key = $(el).find('b').text().replace(':', '').trim().toLowerCase().replace(/\s+/g, '_');
      if (key === 'genre') {
        const genres = [];
        $(el).find('span a').each((_, a) => genres.push($(a).text().trim()));
        info.genres = genres;
      } else if (key) {
        info[key] = $(el).find('span').text().trim();
      }
    });

    const synopsis = $('.sinops p')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .join('\n\n');

    const episodes = [];
    $('#ctlist li').each((_, el) => {
      const a = $(el).find('a');
      if (a.length) {
        const rawLink = a.attr('href');
        const fullLink = rawLink.startsWith('http') ? rawLink : `${NONTON_BASE}${rawLink}`;
        episodes.push({
          number: episodes.length + 1,
          title: a.text().trim(),
          url: fullLink
        });
      }
    });

    return {
      title: $('.sctitle, .entry-title, h1').first().text().trim() || info.judul || "",
      image: image,
      alternative: info.judul || info.japanese || "",
      status: info.status || "",
      type: info.type || info.tipe || "",
      studio: info.studio || "",
      released: info.rilis || info.released || "",
      duration: info.durasi || info.duration || "",
      season: info.season || info.musim || "",
      episodes: episodes.length.toString(),
      genre: info.genres || [],
      synopsis: synopsis,
      score: info.rating || info.score || "",
      episodeList: episodes
    };
  } catch (error) {
    return { title: "Error", episodeList: [] };
  }
}

async function episodeNonton(url) {
  try {
    const fullUrl = url.startsWith('http') ? url : `${NONTON_BASE}${url}`;
    const { data } = await axios.get(fullUrl, { headers: { "User-Agent": UA } });
    const $ = cheerio.load(data);

    const title = $('.sctitle, .entry-title, h1').first().text().trim();
    const downloads = {};

    $('.dlist ul li').each((_, el) => {
      const quality = $(el).find('strong').text().trim();
      const providers = [];

      $(el).find('a[href*="/go/"]').each((_, a) => {
        const providerName = $(a).text().trim() || $(a).attr('rel') || 'Unknown';
        const goLink = $(a).attr('href');
        if (goLink) {
          providers.push({
            name: providerName,
            url: goLink.startsWith('http') ? goLink : `${NONTON_BASE}${goLink}`
          });
        }
      });

      if (providers.length > 0) {
        downloads[quality] = {
          provider: providers[0].name,
          providers: providers
        };
      }
    });

    return { title, url, downloads };
  } catch (error) {
    return { title: "Error", url, downloads: {} };
  }
}

async function resolveNonton(goUrl) {
  try {
    const url = goUrl.startsWith('http') ? goUrl : `${NONTON_BASE}${goUrl}`;
    let realUrl = url;

    try {
      const res = await axios.get(url, {
        headers: { "User-Agent": UA },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400
      });
      realUrl = res.request.res.responseUrl || res.headers.location || url;
    } catch (err) {
      if (err.response && err.response.headers.location) {
        realUrl = err.response.headers.location;
      }
    }

    // Handle Pixeldrain
    if (realUrl.includes('pixeldrain.com/u/')) {
      const fileId = realUrl.split('/u/')[1].split('?')[0];
      return {
        type: 'stream',
        provider: 'pixeldrain',
        url: `/api/stream?url=${encodeURIComponent(`https://pixeldrain.com/api/file/${fileId}`)}`,
        direct: `https://pixeldrain.com/api/file/${fileId}`,
        download_url: `https://pixeldrain.com/api/file/${fileId}?download`
      };
    }

    // Handle Mega.nz
    if (realUrl.includes('mega.nz')) {
      return {
        type: 'download',
        provider: 'mega',
        url: realUrl,
        direct: realUrl
      };
    }

    // Handle MediaFire
    if (realUrl.includes('mediafire.com')) {
      // Try to get direct link from MediaFire
      try {
        const mfRes = await axios.get(realUrl, { headers: { "User-Agent": UA } });
        const mf$ = cheerio.load(mfRes.data);
        const directLink = mf$('a[aria-label="Download file"]').attr('href');
        if (directLink) {
          return {
            type: 'stream',
            provider: 'mediafire',
            url: directLink,
            direct: directLink
          };
        }
      } catch (e) {}
      return {
        type: 'download',
        provider: 'mediafire',
        url: realUrl,
        direct: realUrl
      };
    }

    // Other
    return {
      type: 'download',
      provider: 'other',
      url: realUrl,
      direct: realUrl
    };
  } catch (error) {
    return { type: 'error', error: error.message };
  }
}

// ============ RESOLVER ============
function resolvePixeldrain(url) {
  if (url.includes("/u/")) return url.replace("/u/", "/api/file/");
  if (url.includes("/d/")) return url.replace("/d/", "/api/file/");
  return null;
}

// ============ API ENDPOINTS ============
app.get("/api/search", async (req, res) => {
  const { q, source = "samehadaku" } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query" });

  try {
    let results;
    if (source === "alqanime") {
      results = await searchAlqanime(q);
    } else if (source === "nonton") {
      results = await searchNonton(q);
    } else {
      results = await searchSamehadaku(q);
    }
    res.json({ source, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/detail", async (req, res) => {
  const { url, source = "samehadaku" } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });

  try {
    let result;
    if (source === "alqanime") {
      result = await detailAlqanime(url);
    } else if (source === "nonton") {
      result = await detailNonton(url);
    } else {
      result = await detailSamehadaku(url);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/episode", async (req, res) => {
  const { url, source = "samehadaku" } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });

  try {
    let result;
    if (source === "nonton") {
      result = await episodeNonton(url);
    } else {
      result = await episodeSamehadaku(url);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/resolve", async (req, res) => {
  const { url, source = "samehadaku" } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });

  try {
    // NontonAnimeX resolve
    if (source === "nonton" && url.includes("/go/")) {
      const result = await resolveNonton(url);
      return res.json(result);
    }

    // Pixeldrain resolve
    if (url.includes("pixeldrain.com")) {
      const direct = resolvePixeldrain(url);
      if (direct) {
        const proxyUrl = "/api/stream?url=" + encodeURIComponent(direct);
        return res.json({ type: "stream", url: proxyUrl, direct });
      }
    }

    // MediaFire resolve
    if (url.includes("mediafire.com")) {
      try {
        const mfRes = await axios.get(url, { headers: { "User-Agent": UA } });
        const mf$ = cheerio.load(mfRes.data);
        const directLink = mf$('a[aria-label="Download file"]').attr('href');
        if (directLink) {
          return res.json({ type: "stream", url: directLink, direct: directLink });
        }
      } catch (e) {}
      return res.json({ type: "download", url });
    }

    res.json({ type: "unknown", url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stream", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing url");

  try {
    const range = req.headers.range;
    const headers = { "User-Agent": UA };
    if (range) headers["Range"] = range;

    const upstream = await axios.get(url, {
      headers,
      responseType: "stream",
      validateStatus: function(s) { return s < 500; }
    });

    res.status(upstream.status);
    const ct = upstream.headers["content-type"];
    const cl = upstream.headers["content-length"];
    const cr = upstream.headers["content-range"];
    const ac = upstream.headers["accept-ranges"];

    if (ct) res.setHeader("Content-Type", ct);
    if (cl) res.setHeader("Content-Length", cl);
    if (cr) res.setHeader("Content-Range", cr);
    if (ac) res.setHeader("Accept-Ranges", ac || "bytes");
    res.setHeader("Access-Control-Allow-Origin", "*");

    upstream.data.pipe(res);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ============ FRONTEND ROUTES ============
app.get("/anime", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "anime.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`SauceNime running on port ${PORT}`);
});

module.exports = app;
