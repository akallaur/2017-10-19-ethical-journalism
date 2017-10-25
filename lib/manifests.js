var fs = require("fs"),
    request = require("request"),
    queue = require("queue-async"),
    path = require("path"),
    _ = require("underscore"),
    crypto = require("crypto"),
    urlParser = require("url");

var manifests = [],
    manifestFolder = "data/manifests",
    base64regex = /^data:image\/[a-z]*;base64,/;

// will download all manifests and write the contents for each file
function download(callback) {
  var tasks = queue();
  _.each(manifests, function(manifest) {
    tasks.defer(downloadManifest, manifest);
  });
  tasks.awaitAll(function(err, contents) {
    writeManifests(err, contents);
    callback(err);
  });
}

function downloadManifest(manifest, callback) {
  var file = path.join(manifestFolder, manifest.name),
      headers = {};
  try {
    var data = JSON.parse(fs.readFileSync(file));
    if (data._lastModified) headers['last-modified'] = data._lastModified;
  } catch(e) {}
  console.log("Downloading external asset:", manifest.url);
  request(manifest.url, { json: true, headers: headers, gzip: true }, function(err, response, contents) {
    if (err) return console.log("Error downloading manifests:", err);
    // locally cache our manifest
    try{ fs.mkdirSync(manifestFolder); } catch(e) { }
    if (response.headers['last-modified']) contents._lastModified = response.headers['last-modified'];
    fs.writeFileSync(file, JSON.stringify(contents, null, 4));
    callback(err, contents);
  });
}

function writeManifests(err, contents) {
  if (err) return console.log("Error writing manifest contents:", err);
  _.each(contents, writeManifest);
}

function writeManifest(content) {
   _.each(content.files, function(file) {
    // base64 images need to be written slightly differently
    var isBase64 = file.contents.match(base64regex);
    if (isBase64) {
      fs.writeFileSync(file.file, file.contents.replace(base64regex, ""), 'base64');
    } else {
      fs.writeFileSync(file.file, file.contents);
    }
  });
}

function addUrl(url) {
  // generate a unique filename for this URL
  var address = urlParser.parse(url, true);
  delete address.search;
  address.query.export = true;
  var manifest = {
    url: urlParser.format(address),
    name: sha(url) + "-" + path.basename(url)
  };
  manifests.push(manifest);
  return manifest;
}

function sha(text){
  return crypto.createHash('sha1').update(text).digest('hex');
}

module.exports = {
  addUrl: addUrl,
  download: download,
  writeManifest: writeManifest
};
