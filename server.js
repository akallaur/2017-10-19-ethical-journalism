var fs = require('fs');

module.exports = function(req, res, next) {

  // check request url and method
  if (req.url.substr(0,6) == '/data/' && req.method == 'PUT') {
    req.setEncoding('utf8');
    // read data chunks from request stream into memory
    // for big data you might want to stream into a file directly
    var data = '';
    req.on('data', function(chunk) { data += chunk; });
    // write local file when done
    req.on('end', function() {
        fs.writeFileSync(__dirname + '/data/'+req.url.substr(6), data);
        res.writeHead(200, {"Content-Type": "text/plain; charset=utf-8"});
        res.end('ok');
    });
    return;
  }
  // call next to not keep non-matching preview requests processed
  return void next();

};
