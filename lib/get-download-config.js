var _ = require("underscore");

module.exports = function(config, type) {
	var object;
	if (config.download_continuously) {
		 if (type === "continuous") {
			 object = _.pick(config, 'google_docs', 'google_spreadsheets');
			 if (_.keys(object).length) return object;
			 return {};
		 } else {
		 	 return _.omit(config, 'google_docs', 'google_spreadsheets');
		 }
	} else if (type === "continuous") {
		return {};
	}
	return config;
}