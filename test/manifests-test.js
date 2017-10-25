var vows = require("vows"),
    assert = require("assert"),
    fs = require("fs"),
    manifests = require("../lib/manifests");

var suite = vows.describe("manifests");

suite.addBatch({
  "download a sample manifest": function() {

    var dir =  __dirname + "/../";

    manifests.writeManifest({
      files: [{
        file: dir + "test.txt",
        contents: "Lorem ipsum."
      },{
        file: dir + "test.gif",
        contents: "data:image/gif;base64,R0lGODlhCgAKAIAAAB8fHwAAACH5BAEAAAAALAAAAAAKAAoAAAIIhI+py+0PYysAOw=="
      }]
    });

    // test file contents
    assert.equal(fs.readFileSync(dir + "test.txt", "utf-8"), "Lorem ipsum.");
    assert.equal(fs.readFileSync(dir + "test.gif", "base64"), "R0lGODlhCgAKAIAAAB8fHwAAACH5BAEAAAAALAAAAAAKAAoAAAIIhI+py+0PYysAOw==");

    // clean up files
    fs.unlinkSync(dir + "test.txt");
    fs.unlinkSync(dir + "test.gif");

  },
  "append a export=true flag to URLs": function() {
    var manifest = manifests.addUrl("http://chartmaker.stg.nytimes.com/edit/10000012345");
    assert.equal(manifest.url, "http://chartmaker.stg.nytimes.com/edit/10000012345?export=true");
  },
  "append a export=true flag to URLs with a querystring": function() {
    var manifest = manifests.addUrl("http://chartmaker.stg.nytimes.com/edit/10000012345?myvar=value&mrvar2=value2");
    assert.equal(manifest.url, "http://chartmaker.stg.nytimes.com/edit/10000012345?myvar=value&mrvar2=value2&export=true");
  }
});

suite.export(module);



