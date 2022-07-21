import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();
//var express = require('express');
//var fetch = require('node-fetch-commonjs');
//var bodyParser = require("body-parser");
//require('dotenv').config();
const app = express();

app.set("views", "./views");
app.set("view engine", "pug");

app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));

const redirect_uri = "http://localhost:3000/callback";
const client_id = process.env['CLIENT_ID'];
const client_secret = process.env['CLIENT_SECRET'];

global.access_token;

app.get("/", function (req, res) {
  res.render("index");
});

app.get("/authorize", (req, res) => {
  var auth_query_parameters = new URLSearchParams({
    response_type: "code",
    client_id: client_id,
    scope: "user-library-read user-top-read",
    redirect_uri: redirect_uri,
  });

  res.redirect(
    "https://accounts.spotify.com/authorize?" + auth_query_parameters.toString()
  );
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;

  var body = new URLSearchParams({
    code: code,
    redirect_uri: redirect_uri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "post",
    body: body,
    headers: {
      "Content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(client_id + ":" + client_secret).toString("base64"),
    },
  });

  const data = await response.json();
  global.access_token = data.access_token;

  res.redirect("/dashboard");
});

async function getData(endpoint) {
  const response = await fetch("https://api.spotify.com/v1" + endpoint, {
    method: "get",
    headers: {
      Authorization: "Bearer " + global.access_token
    },
  });

  const data = await response.json();
  return data;
}

app.get("/dashboard", async (req, res) => {
  const userInfo = await getData("/me");
  const tracks = await getData("/me/tracks?limit=10");

  res.render("dashboard", { user: userInfo, tracks: tracks.items });
});

app.get("/user-input-page", function(req, res){
  console.log("user input page click worked.");
  res.render("user-input-page");
});

app.post("/recommendations-for-user", async function(req, res){
  console.log("recommendations for user button worked");
  const seed_genres = req.body.seed_genres;
  const params1 = new URLSearchParams({
    limit: 20,
    offset: 0,
    time_range: "medium_term"
  })
  const track_data = await getData("/me/top/tracks?" + params1);
  const artists_data = await getData("/me/top/artists?" + params1);
  const seed_tracks = track_data.items.map(o => o.id).slice(0,3).join(',');
  const seed_artists = artists_data.items.map(o => o.id)[0];
  console.log(seed_tracks);
  console.log(seed_artists);
  const params = new URLSearchParams({
    seed_artists: seed_artists,
    seed_genres: seed_genres,
    seed_tracks: seed_tracks
  });
  const data = await getData("/recommendations?" + params);
  console.log(data);
  res.render("recommendation-for-user", {tracks: data.tracks });
})

app.get("/recommendations", async (req, res) => {
  const artist_id = req.query.artist;
  const track_id = req.query.track;

  const params = new URLSearchParams({
    seed_artists: artist_id,
    seed_genres: "rock",
    seed_tracks: track_id,
  });

  const data = await getData("/recommendations?" + params);
  res.render("recommendation", { tracks: data.tracks });
});

let listener = app.listen(3000, function () {
  console.log(
    "Your app is listening on http://localhost:" + listener.address().port
  );
});
