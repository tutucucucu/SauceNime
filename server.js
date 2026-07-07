const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

async function search(query) {
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

async function detail(url) {
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

async function resolveMediafire(url) {
  const { data } = await axios.get(url, { headers: { "User-Agent": UA } });
  const $ = cheerio.load(data);
  const link = $('a[aria-label="Download file"]').attr("href");
  return link || null;
}

function resolvePixeldrain(url) {
  if (url.includes("/u/")) return url.replace("/u/", "/api/file/");
  return null;
}

app.get("/api/search", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Missing query" });
  try { res.json(await search(q)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/detail", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });
  try { res.json(await detail(url)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/resolve", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url" });
  try {
    if (url.includes("pixeldrain.com")) {
      const direct = resolvePixeldrain(url);
      return res.json({ type: "stream", url: direct });
    }
    if (url.includes("mediafire.com")) {
      const direct = await resolveMediafire(url);
      return res.json({ type: "download", url: direct });
    }
    res.json({ type: "unknown", url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/anime", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "anime.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("SauceNime running on port " + PORT));
module.exports = app;
    
