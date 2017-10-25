var fs = require("fs");
var path = require("path");
var dataloader = require("nytg-dataloader");
var _ = require("underscore");
var yaml = require("js-yaml");
var getDownloadConfig = require("./lib/get-download-config");

var dataDir = 'data';

loadGoogleData();

function loadGoogleData() {
  var config = yaml.load(fs.readFileSync("config.yml", "utf-8"));
  var options = getDownloadConfig(config, "continuous");
  if (_.keys(options).length === 0) return console.log("Nothing to download continuously....");
  require("nytg-dataloader").load(_.extend({ meta: true }, options), function(error, results) {
    if (error) return console.error(error);
    console.log("Writing", _.map(results, function(result) { return result.slug + "." + result.ext; } ).join(" ") + "...", new Date());
    writeData(results);
    setTimeout(loadGoogleData, 10);
  });
}

function writeData(results) {
  _.each(results, function(result, slug) {
    var content = (result.ext === 'json') ? JSON.stringify(result.content, null, 4) : result.content;
    fs.writeFileSync(path.join(dataDir, slug + "." + result.ext), content);
  });
}
