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

async function getEpisodeDownload(url) {
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
  const downloads = await getEpisodeDownload(url);
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
    } else {
      result = await detailSamehadaku(url);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/episode", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });

  try {
    const result = await episodeSamehadaku(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/resolve", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });

  try {
    if (url.includes("pixeldrain.com")) {
      const direct = resolvePixeldrain(url);
      if (direct) {
        const proxyUrl = "/api/stream?url=" + encodeURIComponent(direct);
        return res.json({ type: "stream", url: proxyUrl, direct });
      }
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
