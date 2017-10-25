({
    baseUrl: "src",
    name: "script",
    // comment this out to minify
    optimize: "none",
    paths: {

        // frameworks provided by NYT5
        "foundation": "empty:",
        "interactive": "empty:",
        "article": "empty:",
        "shared": "empty:",
        "jquery/nyt": "empty:",
        "underscore": "empty:",
        "backbone/nyt": "empty:",
        "d3": "empty:",
        "topojson": "empty:",
        "queue": "empty:",
        "vhs": "empty:",

        // node_modules have a simplified path
        "node_modules": "../node_modules",
        "resizerScript": "../node_modules/nytg-resizer/resizerScript",
        "laziestloader": "../src/lib/jquery.laziestloader",
        "templates": "../build/templates",

        // if you're loading from _assets, do it client-side
        "_assets": "empty:",

        // ignore everything in _nytg
        "_nytg": "empty:"

    },
    rawText: {
        'jquery': 'define(["jquery/nyt"], function ($) { return $ });'
    }
})
