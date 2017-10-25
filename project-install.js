
var fs = require('fs'),
    slug = __dirname.split('/').pop(),
    slugMatch = new RegExp(/NYTG_SLUG/g),
    open = require('open'),
    yml = require('js-yaml'),
    prompt = require('prompt');


updateSlugs(['src/index.jst.html', 'src/promo.jst.html', 'src/script.js']);

if (fs.existsSync('src/style.css')) {
    console.log('Found existing style.css, appending its content to style.less');
    var cssString = fs.readFileSync('src/style.css', 'utf-8');
    fs.appendFile('src/style.less', updateImports(cssString), function (err) {
        fs.unlink('src/style.css', function(){});
        finish();
    });
} else {
    finish();
}

try {
    // console.log("Making ai folder...");
    // fs.mkdirSync("ai");
    // fs.writeFileSync("ai/.gitkeep", "");
    console.log("Making promos folder...");
    fs.mkdirSync("promos");
    fs.writeFileSync("promos/.gitkeep", "");
} catch(e) {
    console.log(e);
}

function updateSlugs(files) {
    files.forEach(function(file) {
        if (fs.existsSync(file)) {
            var str = fs.readFileSync(file, 'utf-8');
            str = str.replace(slugMatch, slug);
            fs.writeFileSync(file, str);
        }
    });
}

function updateImports(string) {
  // @import url("nyt5/centered-headline.css") => @import (inline) "nyt5/centered-headline.css"
  return string.replace(/@import url\("(.+?)"\)/g, '@import (inline) "$1"');
}

function finish() {
    // remove this script
    fs.unlink(__filename, function(){});
}


var countFailures = 0;
var countTopFailures = 0;
setUpGoogleDoc(countTopFailures);

function setUpGoogleDoc(countTopFailures) {

  prompt.message = "";

  // ask if you have a google doc yet
  prompt.start();

  prompt.get(['Do you have a google doc already? (y/n)'], function(err, result){

    // check if it's yes or no answer
    if (result['Do you have a google doc already? (y/n)'] == "n" || result['Do you have a google doc already? (y/n)'] == "y") {


    // if no, then open in browser the template, and get the person to copy it, and then ask for the link
    if (result['Do you have a google doc already? (y/n)'] == "n") {
      prompt.message = "Make a copy of the google doc just opened in your browser, then move it into the Preview Docs folder. \n";
      open("https://docs.google.com/document/d/1fFe033aLmAKvBpSdLmkOMD_ly7BpIu2oYRd5aj0zxDM/edit");
    }

    // if yes, then ask for the link
    getGoogleDoc(countFailures);
    function getGoogleDoc(countFailures) {
      prompt.get(['Paste your google doc link in here'], function(err, result){

        var link = result['Paste your google doc link in here'];

        if (link.indexOf("docs.google.com") == -1) {

          console.log('\nIs this even a Google Doc link!?');
          console.log("\nOK, lets try again.  \n");

          if (countFailures < 2) {
            countFailures += 1;
            getGoogleDoc(countFailures);
          } else {
            console.log("\nOk it's not working... You're on your own now.\n");
          }
        } else {
 
          // get the key from the link
          var dockey = link.split("/").sort(function(a,b) { return b.length - a.length; })[0];

          // check if the link works
          var google = require('googleapis'),
              key = JSON.parse( fs.readFileSync( process.env.HOME + "/Development/keys/511847675586-dvu01fndl7cf8nvqhce6j9tuhbgt10rf.json", "utf-8" ) ),
              formatGoogleDoc = this.formatGoogleDoc,
              fetch = this.fetch;

          google.auth.fromJSON(key, function(err, authClient) {
              if (err === null) {
                  if (authClient.createScopedRequired && authClient.createScopedRequired()) {
                      var scopes = [
                          'https://www.googleapis.com/auth/drive.readonly',
                          'https://docs.google.com/feeds'
                      ];
                      authClient = authClient.createScoped(scopes);
                  }
                  run(authClient, dockey);
              }
          });

          function run(authClient, dockey) {
             var drive = google.drive({ version: 'v2', auth: authClient });
             drive.files.get({ fileId: dockey }, function(err, response) {

              // if not work then tell the person to move to the right folder
               if (err) {
                   console.log('\nError while loading the Google doc ('+err.code+')');
                   if (countFailures < 2) {
                    console.log('\nHave you moved the Google Doc to the Preview Docs folder?');
                    console.log('\nOK, lets try again');
                    countFailures += 1;
                    getGoogleDoc(countFailures);
                   } else {
                    console.log("\nOk it's not working... You're on your own now.\n");
                   }
               } else {
                // if everything is ok, then rewrite yml
                console.log("\nGoogle Doc is in the right folder...");
                rewriteYML(dockey);
                console.log("\nYour Google Doc is hooked up!\n");
               }

             });
           }

           function rewriteYML(dockey) {
              yml = fs.readFileSync('config.yml', 'utf-8').split("\n");
              google_doc_line = yml.indexOf("# GOOGLE DOC LOADER");
              for ( i = google_doc_line+3; i < google_doc_line+9; i++) {
                yml[i] = yml[i].replace("# ", "");
                if (yml[i].indexOf("key") > -1) {
                  yml[i] = yml[i].replace("1q2kHOIpzdNG-I6z8tNbuxUpBt-hw4HAI6uQymkIulzI", dockey);
                }
              }

              var newYML = yml.join("\n");
              if (newYML) fs.writeFileSync('config.yml', newYML);
           }

          }
      });
    }

    } else {
      console.log("\nI need a 'y' or 'n' as an answer!\nLet's try again...\n");
      if (countTopFailures < 2) {
        countTopFailures += 1;
        setUpGoogleDoc(countTopFailures);
      } else {
        console.log("\nOk it's not working... You're on your own now.\n");
      }
    }

  });

 }
