module.exports = function(html) {
  return html
      .replace(/(url\(|["'])_big_assets\b/g, "$1public/_big_assets")
      .replace(/(url\(|["'])_assets\b/g, "$1public/_assets")
    	.replace(new RegExp("http://a1.nyt.com/assets/", "g"), "{{path}}/assets/");
};
