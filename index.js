const express = require("express");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const cors = require("cors");
const dotenv = require("dotenv");
const querystring = require("querystring");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Redirect user to Spotify authorization
app.get("/login", (req, res) => {
  const scopes = [
    "user-read-playback-state",
    "user-modify-playback-state",
    "streaming",
    "app-remote-control",
    "user-read-currently-playing",
    "user-read-private",
    "user-read-recently-played",
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-public",
    "playlist-modify-private",
    "user-read-email",
  ].join(" ");
  const redirectUri = encodeURIComponent(process.env.SPOTIFY_REDIRECT_URI);
  res.redirect(
    `https://accounts.spotify.com/authorize?response_type=code&client_id=${process.env.SPOTIFY_CLIENT_ID}&scope=${scopes}&redirect_uri=${redirectUri}`
  );
});

// Spotify callback to exchange authorization code for access token
app.get("/callback", async (req, res) => {
  const code = req.query.code || null;
  const authOptions = {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: querystring.stringify({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    }),
  };

  try {
    const response = await fetch(
      "https://accounts.spotify.com/api/token",
      authOptions
    );
    const data = await response.json();

    // Redirect back to the frontend with tokens in URL parameters
    const scopes = data.scope; // Extract scopes
    res.redirect(
      `http://localhost:5173/emotion-detection?access_token=${data.access_token}&refresh_token=${data.refresh_token}&scope=${scopes}`
    );
  } catch (error) {
    console.error("Error fetching Spotify token:", error);
    res.status(500).send("Failed to retrieve access token");
  }
});

// Endpoint to refresh the access token
app.get("/refresh_token", async (req, res) => {
  const refreshToken = req.query.refresh_token;
  const authOptions = {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: querystring.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  };

  try {
    const response = await fetch(
      "https://accounts.spotify.com/api/token",
      authOptions
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error refreshing Spotify token:", error);
    res.status(500).json({ error: "Failed to refresh access token" });
  }
});

// Endpoint to get recommendations based on emotion
app.get("/recommendations", async (req, res) => {
  const { access_token, emotion } = req.query;
  let seedArtists = [];
  let seedGenres = [];

  switch (emotion) {
    case "happy":
      seedGenres = ["bollywood", "indian"];
      seedArtists = ["3tD5dCEq52Ud27zi9iNT6L", "0LyfQWJT6nXafLPZqxe9Of"]; // Arijit Singh, Shreya Ghoshal
      break;
    case "sad":
      seedGenres = ["indian", "acoustic"];
      seedArtists = ["0LyfQWJT6nXafLPZqxe9Of", "1mYsTxnqsietFxj1OgoGbG"]; // A. R. Rahman, Lata Mangeshkar
      break;
    case "angry":
      seedGenres = ["indian", "chill"];
      seedArtists = ["7rZR0ugcLEhNrFYOrUtZii", "3tD5dCEq52Ud27zi9iNT6L"]; // Amit Trivedi, Arijit Singh
      break;
    default:
      seedGenres = ["bollywood", "indian"];
      seedArtists = ["3tD5dCEq52Ud27zi9iNT6L", "0LyfQWJT6nXafLPZqxe9Of"]; // Arijit Singh, Shreya Ghoshal
      break;
  }

  const recommendationOptions = {
    method: "GET",
    headers: {
      Authorization: "Bearer " + access_token,
    },
  };

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/recommendations?seed_genres=${seedGenres.join(
        ","
      )}&seed_artists=${seedArtists.join(",")}&limit=10`,
      recommendationOptions
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Error fetching Spotify recommendations:", error);
    res.status(500).json({ error: "Failed to retrieve recommendations" });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
