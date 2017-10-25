/* globals __dirname, process */
var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');
var sizeOf = require('image-size');
var program = require('commander');
var winston = require('winston');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var queue = require('queue-async');
var crypto = require('crypto');
var mkdirp = require('mkdirp');

var taskQueue = queue(4);
var validAssetTypes = ['video', 'image'];
var config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf-8'));
var tmpDir = path.join(__dirname, '../tmp/');
var dataDir = path.join(__dirname, '../data/');

var sourceMediaDir = {
  image: path.join(__dirname, '../assets/images/'),
  video: path.join(__dirname, '../assets/video/')
};

var relativeOutputDir = {
  image: 'public/_big_assets/images/',
  video: 'public/_big_assets/video/'
};

var validSourceExts = {
  image: ['jpg', 'png'],
  video: ['mp4', 'mov']
};

var publicDataPath = {
  image: dataDir + 'imagedata.json',
  video: dataDir + 'videodata.json'
};

var privateDataPath = {
  image: tmpDir + 'imagedata.json',
  video: tmpDir + 'videodata.json'
};

var privateData = {
  image: fs.existsSync(privateDataPath.image) ? JSON.parse(fs.readFileSync(privateDataPath.image , 'utf8')) : {},
  video: fs.existsSync(privateDataPath.video) ? JSON.parse(fs.readFileSync(privateDataPath.video , 'utf8')) : {}
};

var assetFriendlyName = {
  image: 'image',
  video: 'video'
};

var assetFriendlySourcPath = {
  image: 'assets/images',
  video: 'assets/video'
};

var defaultQualitySetting = {
  image: config.images.standard_quality || 65,
  video: config.video.quality || 3
};

var defaultSizes = {
  image: config.images.sizes,
  video: config.video.sizes
};

var getMissingPrereqs = {
  image: function(){
    var missing = [];
    
    if (!checkSystemDependency('convert')) {
      missing.push('Imagemagick required. To install, run:"brew install imagemagick"');
    }

    return missing;
  },

  video: function(){
    var missing = [];

    if (!/^20[\d]{2}\/[\d]{2}\/[\d]{2}\/[\w-]+$/.test(config.videotape_path)) {
      missing.push('Publish path has to be in this format: YYYY/MM/DD/slug, where slug is alphanumberic, underscores and hyphens');
    }

    if (!checkSystemDependency('ffprobe')) {
      missing.push('ffprobe required. To install, run:"brew install ffmpeg"');
    }

    return missing;
  }
};

var customHelpMessage = {
  image: function(){
    console.log('  At a minimum, one of -d, -j, -s or -w is required.');
    console.log('');
    console.log('  Examples:');
    console.log('');
    console.log('    Size all images according to size, quality and retina settings in config.yml and generate data/imagedata.json');
    console.log('    $ ./bin/image-sizer -d');
    console.log('');
    console.log('    Size only intro.jpg according to size, quality and retina settings in config.yml');
    console.log('    $ ./bin/image-sizer -s intro');
    console.log('');
    console.log('    Size only intro.jpg and runner.jpg to 220px and 340px wide using the quality and retina settings in config.yml');
    console.log('    $ ./bin/image-sizer -s intro -s runner -w 220 -w 340');
    console.log('');
    console.log('    Size all images to 340px wide at 70% quality for standard images and 45% quality for retina images.');
    console.log('    $ ./bin/image-sizer -w 340 -q 70 -r 45');
    console.log('');
    console.log('    Generate data/imagedata.json without sizing any images.');
    console.log('    $ ./bin/image-sizer -j');
    console.log('');
  },

  video: function(){
    console.log('  At a minimum, one of -d, -j, -s or -w is required.');
    console.log('');
    console.log('  Examples:');
    console.log('');
    console.log('    Size all vidoes according to size, and quality settings in config.yml and generate data/videodata.json');
    console.log('    $ ./bin/video-sizer -d');
    console.log('');
    console.log('    Size only intro.mp4 according to size and quality settings in config.yml');
    console.log('    $ ./bin/video-sizer -s intro');
    console.log('');
    console.log('    Size only intro.mp4 and runner.mp4 to 220px and 340px wide using the quality settings in config.yml');
    console.log('    $ ./bin/video-sizer -s intro -s runner -w 220 -w 340');
    console.log('');
    console.log('    Size all videos to 340px wide at quality 4');
    console.log('    $ ./bin/video-sizer -w 340 -q 4');
    console.log('');
    console.log('    Generate data/videodata.json without sizing any images.');
    console.log('    $ ./bin/video-sizer -j');
    console.log('');
  }
};

// The message to print afer a successful encode.
// It can be passed in, or generated from stdout.
var outputMessageFormatter = {
  image: function(stdout, message){
    return 'Generated: ' + message;
  }, 

  // Grab generated paths and the status URL
  // from videotape's CLI output
  video: function(stdout, message){
    var videoTapeoutput = stdout.split('\n');
    var displayMessage = '\n  Generated files: ';
    var statusUrl = '';
    var publishedFilePaths = [];

    // Given a line with this:
    // http://int.nyt.com/data/videotape/finished/2016/08/09/assets-size-test/hp-bay-promo-40.mp4
    // or (note 'https' and different extension)
    // https://int.nyt.com/data/videotape/finished/2016/08/09/assets-size-test/hp-bay-promo-40.webm
    // 
    // Capture:
    // int.nyt.com/data/videotape/finished/2016/08/09/assets-size-test/hp-bay-promo-40.mp4
    // int.nyt.com/data/videotape/finished/2016/08/09/assets-size-test/hp-bay-promo-40.webm

    var videoFileRe = /https?:\/\/(int.nyt.com\/data\/videotape\/finished\/20\d{2}\/\d{2}\/\d{2}\/[\sa-zA-Z0-9_-]+\/[\sa-zA-Z0-9_-]+.(?:mp4|webm))/i;

    // Given a line like this:
    // https://videotape.adm.prd.newsdev.nytimes.com/batches/2106
    // 
    // find it and return it.
    var statusRe = /(https?:\/\/videotape.adm.prd.newsdev.nytimes.com\/batches\/\d+)/i;

    videoTapeoutput.forEach(function(line){
      if (videoFileRe.exec(line)) {
        publishedFilePaths.push(videoFileRe.exec(line)[1]);
      }

      if (statusRe.exec(line)) {
        statusUrl = statusRe.exec(line)[1];
      }

    });

    return displayMessage + '\n  https://' + publishedFilePaths.join('\n  https://') + '\n\n  Track progress:\n  ' + statusUrl;
  }
};


var streamingUpdateFormatter = {
  image: function(stdout){return '';},
  video: function(stdout){
    var message = '';

    // [hp-1x1.mp4][1][upload] 100% (19478667 / 19478410 bytes)
    // 
    // to [hp-1x1.mp4, 100%]

    var uploadRe = /^\[(\S+)\]\[\d\]\[upload\] (\d+%)/i; 

    if (uploadRe.exec(stdout)) {
      message = 'Uploading:' + uploadRe.exec(stdout)[1] + ' ' + uploadRe.exec(stdout)[2];
    }

    return message;
  },
};

// check if native commands exist
function checkSystemDependency(app){
  var appFound = true;

  try{
    execSync('type ' + app, {stdio: 'pipe' });
  } catch(e){
    appFound = false;
  }
  return appFound;
}

function AssetsSizer(type){
  if (validAssetTypes.indexOf(type) < 0) {
    console.log('Must specify asset type to size. Valid types: ' + (validAssetTypes.join(', ')) );
    return;
  }

  // squash objects for given type
  sourceMediaDir = sourceMediaDir[type];
  relativeOutputDir = relativeOutputDir[type];
  validSourceExts = validSourceExts[type];
  publicDataPath = publicDataPath[type];
  privateDataPath = privateDataPath[type];
  privateData = privateData[type];
  assetFriendlyName = assetFriendlyName[type];
  assetFriendlySourcPath = assetFriendlySourcPath[type];
  outputMessageFormatter = outputMessageFormatter[type];
  streamingUpdateFormatter = streamingUpdateFormatter[type];
  defaultQualitySetting = defaultQualitySetting[type];
  defaultSizes = defaultSizes[type];
  customHelpMessage = customHelpMessage[type];
  getMissingPrereqs = getMissingPrereqs[type];

  // Any missing prereqs?
  if (getMissingPrereqs().length > 0) {
    console.log('Error:', getMissingPrereqs().join('\n'));
    return;
  }

  // Generate array of objects containing publicly useful metadata
  // about the source files, like: 
  // [{ratio: 0.666666667, slug: 'intro', ext: 'mp4', duration: 6.5344}]  
  var sourceMediaFiles = fs.readdirSync(sourceMediaDir, 'utf-8').filter(function(file){
    
    // Use constructor regex so we can form with dynamic string. same as literal: /.(jpg|png)$/ 
    var fileTypesAsRegexOr = validSourceExts.join('|');
    var re = new RegExp('.('+fileTypesAsRegexOr+')$');
    return re.test(file);
  }).map(function(fileName){
    var dimensions;
    var filePath = sourceMediaDir + fileName;
    var metaData = {
      slug: path.basename(filePath, path.extname(filePath)),
      extension: path.extname(filePath).replace('.', '')
    };

    if (type === 'image') {
      dimensions = sizeOf(filePath);
      metaData.ratio = dimensions.height / dimensions.width;
    }

    if (type === 'video') {
      // Based on:
      // https://github.com/mgmtio/get-video-dimensions/blob/master/index.js
      (function(){
        var cmd = 'ffprobe -v error -of \'flat=s=_\' -show_entries stream=width,height,bit_rate,duration "' + filePath + '"';
        var stdout = execSync(cmd, []);
        var width = /width=(\d+)/.exec(stdout);
        var height = /height=(\d+)/.exec(stdout);
        var duration = /duration=\"(\S+)\"/.exec(stdout);

        if (width && height) {
          width = parseInt(width[1], 10);
          height = parseInt(height[1], 10);
          metaData.ratio = height / width;
        }

        if (duration) {
          metaData.duration = parseFloat(duration[1]);
        }
      })();
    }
    
    return metaData;
  });

  var allAvailableSlugs = sourceMediaFiles.map(function(asset){return asset.slug;});


  function collect(val, memo) {
    memo.push(val);
    return memo;
  }


  function getAssetDataFromSlug(slug){
    return _.findWhere(sourceMediaFiles, {slug: slug});
  }

  function getAuxPublishDataForAsset(asset, width, isRetina){
    var  metaData = {};

    // path information
    if (asset) {
      metaData.srcFilePath = sourceMediaDir+asset.slug+'.'+asset.extension;
      metaData.auxFileName = (isRetina) ? '_x2' : '';
      metaData.outputWidth = (isRetina) ? (width * 2) : width;
      metaData.outputFileName = asset.slug+'-'+width+metaData.auxFileName+'.'+asset.extension;
      metaData.outputFilePath = relativeOutputDir+metaData.outputFileName;
    }

    return metaData;
  }


  function getFileHash(path){
    var md5 = execSync('openssl md5 "'+path+'" | cut -d "=" -f 2');
    return md5.toString('utf8').trim();
  }


  function updatePrivateAssetData(slug, width, quality, isRetina){
    var asset = getAssetDataFromSlug(slug);

    var srcFilePath = sourceMediaDir+slug+'.'+asset.extension;
    privateData[slug] = privateData[slug] || {};
    privateData[slug][width] = privateData[slug][width] || {};
    privateData[slug][width].srcFilePath = srcFilePath;
    privateData[slug][width].srcFileHash = getFileHash(srcFilePath);

    quality = quality || 0;

    if (isRetina) {
      privateData[slug][width].retina = quality;
    } else {
      privateData[slug][width].quality = quality;
    }
  }

  /**
   * Does this input + output combination need to be run?
   * 
   * @param  {[type]}  asset   
   * @param  {[type]}  width   
   * @param  {[type]}  quality 
   * @param  {[type]}  force   
   * @param  {Boolean} isRetina
   * @return {Boolean}          
   */
  function checkNeedsSizing(asset, width, quality, force, isRetina){
    force = !!force;
    isRetina = !!isRetina;
    
    var slug = asset.slug;
    var assetAuxPubData = getAuxPublishDataForAsset(asset, width, isRetina);

    var srcFilePath = assetAuxPubData.srcFilePath;
    var outputWidth = assetAuxPubData.outputWidth;
    var outputFileName = assetAuxPubData.outputFileName;
    var outputFilePath = assetAuxPubData.outputFilePath;
    
    // If there's a previous quality, we'll want to check that the new quality hasn't changed
    var checkQuality = isRetina ? 
      privateData[slug] && privateData[slug][width] && privateData[slug][width].retina :
      privateData[slug] && privateData[slug][width] && privateData[slug][width].quality;
    
    var previousQuality = (function(){
      var previousQuality = '';
      if (checkQuality) {
        previousQuality = isRetina ? privateData[slug][width].retina : privateData[slug][width].quality;
      }
      return previousQuality;
    })();
    
    
    // Check all the combinations that'd dictate a new output file is needed

    // 1) if user request a forced rerun, do it.
    var needsResizing = force;

    // 2) Does the ouptut file not exist?
    if (!needsResizing && type === 'image' && !fs.existsSync(outputFilePath)) {
      needsResizing = true;
    }

    // 3) Has the input image been updated? 
    if (!needsResizing && !(privateData[slug] && privateData[slug][width] && privateData[slug][width].srcFileHash && privateData[slug][width].srcFileHash === getFileHash(srcFilePath))) {
      needsResizing = true;
    }

    // 4) Has the output quality changed?
    if (!needsResizing && checkQuality && previousQuality !== quality) {
      needsResizing = true;
    }

    return needsResizing;
  }

  function runTask(cmd, onComplete, onTimeout){
    onComplete = onComplete || function(){};
    onTimeout = onTimeout || function(){};

    logger.verbose('Running:', cmd);

    taskQueue.defer(function(callback){
      var task = exec(cmd, {timeout: 1000 * 60 * 10 }); // 10 min timeout
      var stdout = '';

      // streaming updates
      task.stdout.on('data', function(data){
        stdout = stdout + data;
        logger.verbose(data);
        var message = streamingUpdateFormatter(data);
        if (message) logger.info(message);
      });

      task.stderr.on('data', function(data){
        logger.error('exec error: ' + data);
        // todo -- kill child process?
        callback();
      });

      task.on('exit', function(code){
        if (stdout) logger.verbose(stdout);

        if (code === null) {
          onTimeout();
        } else {
          onComplete(stdout);
        }

        callback();
      });
    });
  }



  // Universal CLI config options
  program
    .version('0.0.1')
    .usage('[options]')
    .option('-d, --default','size all '+assetFriendlyName+'s in '+assetFriendlySourcPath+' with settings from config.yml (current sizes: '+defaultSizes.join(',')+')')
    .option('-s, --slug <string>', assetFriendlyName + ' slug(s) to size from '+assetFriendlySourcPath+' (e.g. "' + ( sourceMediaFiles.length ? sourceMediaFiles[0].slug : 'intro' ) + '")', collect, [])
    .option('-w, --width <integer>', 'output width(s) (e.g. "640")', collect, []);

  // Media-specific config options
  if (type === 'image'){
    program
      .option('-q, --quality <integer>', 'standard image output quality between 1 (lowest) and 100 (heighest) (suggested: 65-ish)')
      .option('-r, --retina <integer>', 'retina image output quality between 1 and 100 (suggested: 30-ish)');
  }

  if (type === 'video') {
    program
      .option('-q, --quality <integer>', 'video output quality between 1 (lowest) and 5 (heighest) (suggested: 3-ish)');
  }

  // Secondary, but universal, config options
  program
    .option('-j, --json', 'Generate JSON metadata file', false)
    .option('-f, --force', 'Regenerate output files, even if the source hasn\'t changed', false)
    .option('-v, --verbose', 'Display verbose logging informatation', false)
    .parse(process.argv);

  var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({
        level: program.verbose ? 'verbose' : 'info'
      })
    ]
  });

  var settings = {
    widths: [],
    slugs: [],
    verbose: !!program.verbose,
    json: !!program.json,
    force: !!program.force,
    quality: defaultQualitySetting
  };

  if (type === 'image') {
    settings.retina = config.images.retina_quality || 0;
  }

  // Check for actionable input options. if none, show help screen
  var printHelp = program.width.length === 0 && program.slug.length === 0 && !program.json && !program.default;

  // Customize help screen
  program.on('--help', customHelpMessage);

  // Configure program settings based on user input.
  if (program.default) {
    logger.info('Secified -d/--default. Ignoring all other options.');
    settings.json = true;
    settings.slugs = allAvailableSlugs;
    settings.widths = defaultSizes;
  } else {

    // user specified quality
    if (program.quality) {
      settings.quality = program.quality;
    }

    if (program.retina) {
      settings.retina = program.retina;
    }

    // collect user specified slugs, or use defaults if 
    // they passed in custom widths but no slugs.
    if (program.slug.length > 0) {
      settings.slugs = program.slug.filter(function(slug){
        var assetFound = allAvailableSlugs.indexOf(slug) > -1;

        if (!assetFound) {
          logger.warn('Invalid ' + assetFriendlyName + ' slug:' + slug);
        }

        return assetFound;
      });
    } else if (program.width.length > 0) {
      settings.slugs = allAvailableSlugs;
      logger.info('No ' + assetFriendlyName + ' slugs specified. Using all ' + assetFriendlyName + 's in ' + assetFriendlySourcPath);
    }

    // collect user specified widths, or use defaults if 
    // they passed in slugs but no widths.
    if (program.width.length > 0) {

      // filter invalid numbers, and then map again with 
      // parseInt to ensure filtered values, which are still
      // strings, are coerced to ints.
      settings.widths = program.width.filter(function(width){
        
        // values come in as strings. test them as
        // numbers w/ Math.floor. floor also eliminates
        // floats, which would be converted to ints 
        // by parseInt if we used that method to check.
        var isInt = Math.floor(width) == width;

        if (!isInt) {
          logger.warn('Invalid width: ' + width);
        }

        return isInt;
      }).map(function(width){
        return parseInt(width, 10);
      });

    } else if (settings.slugs.length > 0) { // note: check that we have confirmed slugs, not the inputed program.slug, which could contain invalids.
      settings.widths = defaultSizes;
      logger.info('No widths specified. Using all ' + assetFriendlyName + ' sizes in config.yml');
    }
  }

  // add sizes to sourceMedia so they can be used in browser
  sourceMediaFiles = sourceMediaFiles.map(function(asset){
    asset.sizes = settings.widths;
    return asset;
  });


  //
  // START APP
  //

  if (settings.verbose) {
    _.each(settings, function(v,k){
      var value = _.isArray(v) ? v.join(', ') : v;
      logger.verbose('Setting %s: %s', k ,value);
    });
  }


  // Queue all needed sizing jobs
  if (settings.widths.length > 0 && settings.slugs.length > 0) {  
    (function(){
      var tasks = [];


      // video jobs are grouped by slug, with all sizes for a slug one the same command.
      if (type === 'video') {
        (function(){
          settings.slugs.forEach(function(slug){
            var asset = getAssetDataFromSlug(slug);
            var neededWidths = [];

            settings.widths.forEach(function(width){
              if (checkNeedsSizing(asset, width, settings.quality, settings.force)) {
                neededWidths.push(width);
              }
            });

            if (neededWidths.length > 0) {
              var assetAuxPubData = getAuxPublishDataForAsset(asset, neededWidths[0]);
              var neededWidthsFlags = '-s ' + (neededWidths.join(' -s '));              
              tasks.push({
                cmd: './node_modules/.bin/videotape -q '+neededWidthsFlags+' --webm '+settings.quality+' --mp4 '+settings.quality+' -p single --poster-offset 0 -o '+config.videotape_path+' -l "' + assetAuxPubData.srcFilePath + '"',
                onComplete: function(stdout){
                  logger.info(outputMessageFormatter(stdout, assetAuxPubData.outputFilePath));

                  neededWidths.forEach(function(width){
                    updatePrivateAssetData(asset.slug, width, settings.quality);
                  });
                },
                onTimeout: function(){
                  logger.info('Timeout generating:', assetAuxPubData.outputFileName);
                }
              });
            }
          });
        })();

      // image jobs aren't bundled. each resize is its own command.
      } else if (type === 'image'){

        function generateCovertCmd(inputPath, outputPath, fileType, width, quality) {
          var convertCmd;

          if (fileType === 'png') {
            convertCmd = 'convert "'+inputPath+'" -strip -resize ' +width+ 'x -quality '+quality+' png:- | pngquant --skip-if-larger - >' + outputPath;
          } else {
            convertCmd = 'convert "'+inputPath+'" -strip -resize ' +width+ 'x -quality '+quality+' ' + outputPath;
          }

          return convertCmd;
        }


        settings.slugs.forEach(function(slug){
          var asset = getAssetDataFromSlug(slug);          
          settings.widths.forEach(function(width){
            var assetAuxPubData = getAuxPublishDataForAsset(asset, width);
            var retinaAssetAuxPubData = getAuxPublishDataForAsset(asset, width, true);

            if (checkNeedsSizing(asset, width, settings.quality, settings.force)) {
              tasks.push({
                cmd: generateCovertCmd(assetAuxPubData.srcFilePath, assetAuxPubData.outputFilePath, asset.extension, assetAuxPubData.outputWidth, settings.quality),
                onComplete: function(stdout){
                  logger.info(outputMessageFormatter(stdout, assetAuxPubData.outputFilePath));
                  updatePrivateAssetData(asset.slug, width, settings.quality);
                },
                onTimeout: function(){
                  logger.info('Timeout generating:', assetAuxPubData.outputFileName);
                }
              });
            } else {
              logger.info('Skipping. Already exists:', assetAuxPubData.outputFileName);
            }

            if (settings.retina > 0) {
              if (checkNeedsSizing(asset, width, settings.retina, settings.force, true)) {
                tasks.push({
                  cmd: generateCovertCmd(retinaAssetAuxPubData.srcFilePath, retinaAssetAuxPubData.outputFilePath, asset.extension, retinaAssetAuxPubData.outputWidth, settings.retina),
                  onComplete: function(stdout){
                    logger.info(outputMessageFormatter(stdout, retinaAssetAuxPubData.outputFilePath));
                    updatePrivateAssetData(asset.slug, width, settings.retina, true);
                  },
                  onTimeout: function(){
                    logger.info('Timeout generating:', retinaAssetAuxPubData.outputFileName);
                  } 
                });
              } else {
                logger.info('Skipping. Already exists:', retinaAssetAuxPubData.outputFileName);
              }
            }
          });
        });
      }

      // run all the resize tasks
      tasks.forEach(function(task){
        runTask(task.cmd, task.onComplete, task.onTimeout);
      });

    })();
  } 


  // Queue public data task
  if (settings.json) {
    logger.info('Writing:', publicDataPath);
    taskQueue.defer(function(callback){
      fs.writeFileSync(publicDataPath, JSON.stringify(sourceMediaFiles, null, '\t'));
      callback();
    });
  }


  // Tasks are finished. Write private data to file and exit.
  taskQueue.await(function(err, files) {
    if (err) return console.log(err);
    fs.writeFileSync(privateDataPath, JSON.stringify(privateData, null, '\t')); 
    
    if (printHelp) {
      program.help();
    } else {
      logger.info('Complete');
    }
  });
}

module.exports = AssetsSizer;