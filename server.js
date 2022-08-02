import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

const app = express();

app.set("views", "./views");
app.set("view engine", "pug");

app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));

const redirect_uri = "http://localhost:3000/callback";
const client_id = process.env['CLIENT_ID'];
const client_secret = process.env['CLIENT_SECRET'];

global.access_token;
global.user_id;

app.get("/", function (req, res) {
  res.render("index");
});

app.get("/authorize", (req, res) => {
  var auth_query_parameters = new URLSearchParams({
    response_type: "code",
    client_id: client_id,
    scope: "user-library-read user-top-read playlist-modify-public playlist-modify-private",
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

async function postData(endpoint, body) {
  const response = await fetch("https://api.spotify.com/v1" + endpoint, {
    method: "POST",
    body: body,
    contentType: 'application/json',
    headers: {
      'Authorization':"Bearer " + global.access_token
    },
  });

  const data = await response.json();
  return data;
}

function getAverage(arr) {
  var sum = 0;
  for (var i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum / arr.length;
}

app.get("/dashboard", async (req, res) => {
  const userInfo = await getData("/me");
  const tracks = await getData("/me/tracks?limit=10");

  global.user_id = userInfo.id;
  res.render("dashboard", { user: userInfo, tracks: tracks.items });
});

app.get("/user-input-page", async function(req, res){
  const genres = await getData("/recommendations/available-genre-seeds");
  console.log(genres);
  res.render("user-input-page", {Genres: genres.genres});
});

app.post("/recommendations-for-user", async function(req, res){
  const me_params = new URLSearchParams({
    limit: 20,
    offset: 0,
    time_range: "medium_term"
  });

  const track_data = await getData("/me/top/tracks?" + me_params);
  const artists_data = await getData("/me/top/artists?" + me_params);

  const trackIds = track_data.items.map(o => o.id).join(',');
  var audioFeatures = await getData("/audio-features?ids="+trackIds);

  var optionalParams = {
    target_danceability: getAverage(audioFeatures.audio_features.map(o=> o.danceability)),
    target_energy: getAverage(audioFeatures.audio_features.map(o=> o.energy)),
    target_acousticness: getAverage(audioFeatures.audio_features.map(o=> o.acousticness)),
    target_tempo: getAverage(audioFeatures.audio_features.map(o=> o.tempo)),
    target_valence: getAverage(audioFeatures.audio_features.map(o=> o.valence))
  }

  const seed_tracks = track_data.items.map(o => o.id).slice(0,3).join(',');
  const seed_artists = artists_data.items.map(o => o.id)[0];
  const recommend_params = new URLSearchParams({
    seed_artists: seed_artists,
    seed_genres: req.body.seed_genres,
    seed_tracks: seed_tracks,
    limit: req.body.limit || 10,
    target_danceability: req.body.target_danceability || optionalParams.target_danceability,
    target_energy:req.body.target_energy || optionalParams.target_energy,
    target_acousticness:req.body.target_acousticness || optionalParams.target_acousticness,
    target_tempo: req.body.target_tempo || optionalParams.target_tempo,
  });
  const data = await getData("/recommendations?" + recommend_params);
  const list_of_uris = data.tracks.map(o => o.uri).join(',');

  res.render("recommendation-for-user", {tracks: data.tracks, playlist_name: req.body.playlist_name });

  // var params1 = JSON.stringify({
  //   "name": req.body.playlist_name
  // });

  // var data1 = await postData("/users/"+global.user_id+"/playlists", params1);
  // console.log(data1);

  // const playlist_id = data1.id;

  // const params2 = new URLSearchParams({
  //   uris: list_of_uris
  // });

  // var data2 = await postData("/playlists/"+playlist_id+"/tracks?" + params2, "");
  // console.log(data2);
});

let listener = app.listen(3000, function () {
  console.log(
    "Your app is listening on http://localhost:" + listener.address().port
  );
});
