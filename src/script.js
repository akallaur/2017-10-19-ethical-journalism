require([
  '_nytg/NYTG_SLUG/assets',
  '_nytg/NYTG_SLUG/big-assets',
  'jquery/nyt',
  'underscore/1.6',
  'foundation/views/page-manager',
  'lib/text-balancer' // uncomment to balance headlines
  // 'd3/3',
  // 'queue/1'
  // 'resizerScript'     // uncomment this line to include resizerScript
  // 'templates'         // uncomment to use src/templates
  // 'laziestloader'
  ], function(NYTG_ASSETS, NYTG_BIG_ASSETS, $, _, PageManager, balanceText) {

  // begin code for your graphic here:








  // uncomment to balance headline and leadin
  // balanceText('.interactive-headline, .interactive-leadin');

  // templates
  // var html = Templates.jst.example_template({ text: "yo" });

  // custom sharetools
  // <div class="sharetools g-sharetools" data-url="http://www.nytimes.com" data-title="Custom Title"></div>
  // require(['interactive/main'], function() {
  //   require(['shared/sharetools/views/share-tools-container'], function(ShareTools) {
  //     $(".g-sharetools").each(function() {
  //       new ShareTools({ el: $(this) });
  //     });
  //   });
  // });

}); // end require
