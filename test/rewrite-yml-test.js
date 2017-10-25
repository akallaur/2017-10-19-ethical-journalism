var vows = require("vows"),
    assert = require("assert"),
    fs = require("fs"),
    yaml = require("js-yaml"),
    _ = require("underscore"),
    rewriteYML = require("../lib/rewrite-yml");

var suite = vows.describe("rewriteYML");

suite.addBatch({
  "rewrite specified fields in YML": function() {
    var yml = fs.readFileSync('config.yml', 'utf-8'),
        config = yaml.load(yml),
        doc = {
          yml: {
            headline: "New Headline",
            leadin: "New Leadin",
            credit: "New Credit",
            sources: "New Sources",
            notes: "New Notes"
          }
        };

    var output = yaml.load(rewriteYML(yml, doc));

    // rewrite some fields
    assert.equal(output.headline, "New Headline");
    assert.equal(output.leadin, "New Leadin");
    assert.equal(output.credit, "New Credit");
    assert.equal(output.sources, "New Sources");
    assert.equal(output.notes, "New Notes");

    // preserve existing fields
    assert.equal(config.publish_system, output.publish_system);

  },
  "rewrite nested fields and wildcards in YML": function() {

		var yml = fs.readFileSync('config.yml', 'utf-8'),
		  config = yaml.load(yml),
		  doc = {
        yml: {
  			  headline: "New Headline",
  			  images: {
  				  standard_quality: "A",
  				  retina_quality: "B"
  			  }
        }
		  };

	  var output = yaml.load(rewriteYML(yml, doc));

	  // rewrite some fields
	  assert.equal(output.headline, "New Headline");
	  assert.equal(output.images.standard_quality, "A");
	  assert.equal(output.images.retina_quality, "B");

	  // preserve existing fields
	  assert.equal(config.video.quality, output.video.quality);

	  // preserve existing fields
	  assert.equal(config.publish_system, output.publish_system);
  },

  "uncomment top-level fields in config.yml": function() {
    var yml = fs.readFileSync('config.yml', 'utf-8'),
        config = yaml.load(yml),
        doc = {
          yml: {
            section_name: "U.S."
          }
        };

    var output = yaml.load(rewriteYML(yml, doc));

    assert.equal(output.section_name, "U.S.");
  },

  "add new nested fields not previously in config.yml": function() {
    var yml = fs.readFileSync('config.yml', 'utf-8'),
        config = yaml.load(yml),
        doc = {
          yml: {
            images: {
              nonstandard_quality: "A",
            },
            pages: {
              promo: {
                headline: "My Promo Headline",
                scoop_slug: "myslug"
              }
            },
            video: {
              other: 'value'
            },
            existing_top_level: {
              key: "value"
            }
          }
        };

    var output = yaml.load(rewriteYML(yml, doc));

    assert.equal(output.images.nonstandard_quality, doc.yml.images.nonstandard_quality);
    assert.equal(output.pages.promo.headline, doc.yml.pages.promo.headline);
    assert.equal(output.pages.promo.scoop_slug, doc.yml.pages.promo.scoop_slug);
  },

  "add new top-level structured not previously in config.yml": function() {
    var yml = fs.readFileSync('config.yml', 'utf-8'),
        config = yaml.load(yml),
        doc = {
          yml: {
            newfield: {
              nestedvalue: "A"
            }
          }
        };

    var output = yaml.load(rewriteYML(yml, doc));

    assert.equal(output.newfield.nestedvalue, doc.yml.newfield.nestedvalue);
  },

  "empty values come through as empty strings": function() {
    var yml = fs.readFileSync('config.yml', 'utf-8'),
        config = yaml.load(yml),
        doc = {
          yml: {
            "headline": "",
            "newemptyfield": ""
          }
        };

    var output = yaml.load(rewriteYML(yml, doc));

    assert.strictEqual(output.headline, "");
    assert.strictEqual(output.newemptyfield, "");
  },

  "inserts non-string data types without quotes": function() {
    var yml = fs.readFileSync('config.yml', 'utf-8'),
        config = yaml.load(yml),
        doc = {
          yml: {
            "integer-0": "0",
            "integer-1": "1",
            "integer-negative-1": "-1",
            "float-0": "0.0",
            "float-1-5": "1.5",
            "boolean-true": "true",
            "boolean-false": "false",
            "string-yes": "yes",
            "string-no": "no"
          }
        };

    var output = yaml.load(rewriteYML(yml, doc));

    assert.strictEqual(output['integer-0'], 0);
    assert.strictEqual(output['integer-1'], 1);
    assert.strictEqual(output['integer-negative-1'], -1);
    assert.strictEqual(output['float-0'], 0);
    assert.strictEqual(output['float-1-5'], 1.5);
    assert.strictEqual(output['boolean-true'], true);
    assert.strictEqual(output['boolean-false'], false);
    assert.strictEqual(output['string-yes'], "yes");
    assert.strictEqual(output['string-no'], "no");
  },

  "escape double quotes": function() {

    var yml = fs.readFileSync('config.yml', 'utf-8'),
        config = yaml.load(yml),
        doc = {
          yml: {
            leadin: 'New <a href="http://www.nytimes.com">Leadin</a>',
            sources: 'New <a href="http://www.nytimes.com">Sources</a>',
            new_key: 'New <a href="http://www.nytimes.com">New Key</a>'
          }
        };

    var output = yaml.load(rewriteYML(yml, doc));

    // rewrite some fields
    assert.equal(output.leadin, "New <a href=\"http://www.nytimes.com\">Leadin</a>");
    assert.equal(output.sources, "New <a href=\"http://www.nytimes.com\">Sources</a>");
    assert.equal(output.new_key, "New <a href=\"http://www.nytimes.com\">New Key</a>");

    // preserve existing fields
    assert.equal(config.publish_system, output.publish_system);

  }
});

suite.export(module);
