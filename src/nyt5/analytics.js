define(function() {

  var canonical = document.querySelector("link[rel='canonical']").href,
      pageview = ['_trackPageview'];

  if (canonical) {
    var a = document.createElement("a");
    a.href = canonical;
    if (a.pathname != document.location.pathname) pageview.push(a.pathname);
  }

  _gaq = [['_setAccount', 'UA-9262032-1'], pageview];

  require(['https://www.google-analytics.com/ga.js']);

});
