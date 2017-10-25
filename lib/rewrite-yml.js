var fs = require("fs"),
		_ = require("underscore"),
		yaml = require("js-yaml");

// yml  = body of the config.yml file
// data = parsed body of the "doc" google doc specified in config.yml
//				(text run through nytg-dataloader's archieml parsing pipeline)
function rewriteYML(yml, documentData) {
  var current = [], commentCurrent = [];
  var lines = yml.split("\n");
  var newLines = [];
	var tracedLines = {start: 1, children: {}};

	var getIndex = function(obj,i) {return obj ? obj[i] : null}
	var getDotIndex = function(parts, data) {
		return parts.reduce(getIndex, data || {});
	};

	var formatValue = function(value) {
		value = '' + value;
		// Don't quote booleans or numbers
		if (value.match(/^(true|false)$/)) return value;
		if (value.match(/^-?\d+(\.\d+)?$/)) return value;
		return '"' + value.replace(/"/g, '\\"') + '"';
	}

	var trace = function(parts, lineNumber) {
		(function recurse(keys, data) {
			var key = keys[0];
			if (!data[key]) {
				data[key] = { start: lineNumber, end: null, children: {} };
			}
			if (keys.length > 1) recurse(keys.slice(1), data[key].children);
		})(parts, tracedLines.children);
	}

	function incrementLevels(lineNumber, level) {
		level = level || tracedLines.children;
		Object.keys(level).forEach(function(key) {
			var value = level[key];
			if (value.children) incrementLevels(lineNumber, value.children);
			if (value.start >= lineNumber) value.start++;
		});
	}

	// Replace values with an existing line in the config.yml (even commented)
	lines.forEach(function(line, idx) {
    var newLine = line;
		var parts = line.match(/^(# )?( *)([a-z0-9_-]+):/);

    if (parts && parts[2].length % 2 == 0) {
	    var depth = parts[2].length / 2;
	    var key = parts[3];

			var updatePath = parts[1] ? commentCurrent : current;
			// Truncate our address in the data structure to the level we're
			// at given our indentation. Then, record metadata about this line.
			if (updatePath.length > depth) updatePath.length = depth;
			updatePath.push(key);
			trace(updatePath, idx);

			// Keep commentCurrent in sync with current.
			if (!parts[1]) commentCurrent = current.slice();

			// For commented and uncommented lines, replace the value in config.yml
			// with new values from the google doc.

			if (!documentData.yml) {
				useDocumentData = {}
				_.each(documentData, function(x, key){
					if (key != "body") {
						useDocumentData[key] = x;
					}
				})
			} else {
				useDocumentData = documentData.yml;
			}

			var newVal = getDotIndex(commentCurrent, useDocumentData);
			if (!_.isUndefined(newVal) && !_.isNull(newVal) && !_.isArray(newVal) && !_.isObject(newVal)) { // prevent awkward wildcards
				newLine = (parts[1] || "") + (new Array(depth+1).join("  ")) + key + ': ' + formatValue(newVal);
			}
		}
    newLines.push(newLine);
	});

	// Insert new values as close to their relatives as possible.
	// For each value defined in the google doc's override yaml section,
	// check if an entry exists already in config.yml. If it's missing,
	// add it; if it's commented out, uncomment it.
	var currentYml = yaml.load(newLines.join("\n"));
	(function addMissingValues(data, prefix) {
		prefix = prefix || [];
		Object.keys(data).forEach(function(key) {
			var value = data[key];
			var nextPrefix = prefix.concat([key])

			// Recurse into child objects
			if (_.isObject(value)) return addMissingValues(value, nextPrefix);
			// Ignore arrays for now
			if (_.isArray(value)) return;

			// These should all be strings.
			// Run this section for the key we want to insert, as well as it's parents
			// to ensure that the necessary parent hierarchy also exists in config.yml
			for (i=0; i<nextPrefix.length; i++) {
				var current = nextPrefix.slice(0, i+1);
				var oldVal = getDotIndex(current, currentYml);

				if (!_.isUndefined(oldVal) && !_.isNull(oldVal)) continue;

				// Get the value within `tracedLines` for this level's parent element,
				// merging in 'children' paths between each element to match
				// `tracedLines` structure.
				var currentParent = _.flatten(_.map(current.slice(0, current.length-1), function(item) {
					return ['children', item];
				}));

				if (currentParent.length == 0) {
					var tracedParent = tracedLines;
				} else {
					var tracedParent = getDotIndex(currentParent, tracedLines);
				}
				var tracedElement = tracedParent ? tracedParent.children[_.last(current)] : null;

				// The line the parent element starts on, if it exists (including
				// commented lines). We'll use this value + 1 to add missing elements,
				// meaning new elements will come before existing elements.
				var startLine = (tracedParent ? tracedParent.start : null) || newLines.length;

				// If the line already exists for this element, simply uncomment it.
				// (The value should already have been replaced in the first step.)
				if (tracedParent && tracedElement) {
					lineNumber = tracedElement.start;
					newLines[lineNumber] = newLines[lineNumber].replace(/^# /, '');
				}

				// If the element doesn't exist yet, add it.
				if (!tracedElement) {
					var isChild = i == nextPrefix.length - 1;
					newLine = (new Array(current.length).join("  ")) + _.last(current) + ':';

					// Update references to line numbers in our metadata
					incrementLevels(startLine);

					// Add the new element to its parent in ou rmetadata
					tracedParent.children[_.last(current)] = { start: startLine + (isChild ? 0 : 1), end: null, children: {} };

					// Add a value if this is the actual element we're adding
					if (isChild) newLine += ' ' + formatValue(value);
					newLines.splice(startLine + 1, 0, newLine);
				}
			}
		});
	})(useDocumentData || {});

	var rewrittenYML = newLines.join("\n");

  try {
    // make sure our new YML is valid before writing it
    require("js-yaml").load(rewrittenYML);
    return rewrittenYML;
  } catch(e) {
    console.log("Failed to rewrite fields in YML", e);
  	return false;
  }

}

module.exports = rewriteYML;
