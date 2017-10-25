#!/usr/bin/env node

var _ = require("underscore"),
    fs = require("fs"),
    papi = require("papi-client"),
    controller = require("./../bin/process-data"),
    rewriteAssets = require("./rewrite-assets");

// Main function that builds PAPI and writes templates

function writePageTemplates(config, alwaysWrite) {

	var page_templates = _.pluck(config.pages, 'page_template');

	// move config.pages without parent to article.index
	_.each(config.pages, function(page, pageName) {
		var index = config.article.article;
		if (index) {
			index.pages[pageName] = index.pages[pageName] || {};
			_.extend(index.pages[pageName], page);
		}
	});

	_.each(config.article, function(article, articleName) {

		// only write templates if we're using it somewhere
		if (!_.contains(page_templates, "local:" + articleName )) return;

		// create object from downloaded PAPI data or from template text
		var asset,
				templateFile = 'page-templates/' + articleName + '.html';

		if (article.source == 'papi') {
			try {
				asset = papi.create(JSON.parse(fs.readFileSync('data/' + articleName + '.json')));
			} catch(e) { throw e; }
		} else if (article.source == 'local') {
			asset = papi.create("article");
			asset.result.article.body = config.templates[article.content]();
		}

		// include article config
		asset.addConfig(article);

		// add in interactives

		_.each(article.pages, function(page, pageName) {
			page.position = page.position || "";
			var data_type = (page.position && page.position.match(/header/i)) ? 'freeform' : 'interactivegraphics',
			    interactive = papi.create(data_type).addConfig(config.pages[pageName]);
			// make sure our interactives are embedded, not promos
			interactive.result.embedded = true;
			page.position = page.position || "embedded";
			asset.addAsset(page.position, interactive);
		});

		// modify asset if needed
		if (controller.modifyPAPI) asset = controller.modifyPAPI(articleName, asset);

		fs.writeFileSync('data/' + articleName + '-papi.json', JSON.stringify(asset.getData(), null, 4));

		asset.writeFile(templateFile, { alwaysWrite: alwaysWrite, filter: rewriteAssets });

	});

}

module.exports = {
	writePageTemplates: writePageTemplates
};
