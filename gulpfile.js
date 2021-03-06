const gulp = require('gulp'),
      clean = require('gulp-clean'),
      sass = require('gulp-sass'),
      rev = require('gulp-rev'),
      nunjucksRender = require('gulp-nunjucks-render'),
      markdown = require('gulp-markdown'),
      concat = require('gulp-concat'),
      uglify = require('gulp-uglify'),
      sourcemaps = require('gulp-sourcemaps'),
      fs = require('fs'),
      gap = require('gulp-append-prepend'),
      htmlmin = require('gulp-htmlmin'),
      cleanCSS = require('gulp-clean-css'),
      replace = require('gulp-replace'),
      sitemap = require('gulp-sitemap'),
      srcPaths  = {
        'root': 'src/',
        'templates': 'src/templates/**/*.html',
        'pagesDir': 'src/pages/',
        'pages': 'src/pages/**/*.html',
        'postsDir': 'src/posts/',
        'assets': 'src/assets/',
        'sass': 'src/assets/scss/',
        'js': 'src/assets/js/**/*.js',
        'images': 'src/assets/images/',
        'fonts': 'src/assets/fonts/'
      },
      buildPaths = {
        'root': 'build/',
        'assets': 'build/assets/',
        'images': 'build/assets/images/',
        'fonts': 'build/assets/fonts/'
      },
      distPaths = {
        'root': 'dist/',
        'assets': 'dist/assets/',
        'images': 'dist/assets/images',
        'fonts': 'dist/assets/fonts/'

      };

//
// Lib functions
// -------------------------------------------------------------

function getAssetFileNames() {
  var jsManifest = JSON.parse(fs.readFileSync(distPaths.assets + 'js-manifest.json', 'utf8'));
  var cssManifest = JSON.parse(fs.readFileSync(distPaths.assets + 'css-manifest.json', 'utf8'));
  return {
    jsFile: jsManifest['main.js'],
    cssFile: cssManifest['main.css']
  }
}

function getPostData(cb) {
  var postData = {};
  postData.posts = [];
  postData.livePosts = [];

  fs.readdir(srcPaths.postsDir , function(err, files) {
    if (err) {
        console.error('Could not list the directory.', err);
        process.exit(1);
    }

    files.forEach(function(file, index) {
      fs.readFile(srcPaths.postsDir + file, 'utf-8', function (err, content) {
        if (err) {
          console.error(err);
          process.exit(1);
        }
        var paramStartMarker = '<!--//',
            paramEndMarker = '//-->',
            snippetMarker = '<!-- snippet -->';

        var paramsStart = content.lastIndexOf(paramStartMarker),
            paramsEnd = content.lastIndexOf(paramEndMarker),
            params = content.substring(paramsStart + paramStartMarker.length, paramsEnd),
            paramLines = params.split('\n'),
            postObj = {};

        for (var i = 0; i < paramLines.length; i++) {
          if (paramLines[i]) {
            var data = paramLines[i].split(':');
            postObj[data[0].trim()] = data[1].trim();
          }
        }

        if (postObj.live === 'true') {
          var filename = file.split('.')[0],
              snippetStart = content.lastIndexOf(snippetMarker);
          postObj.slug = filename + '.html';
          var snippet = content.substring(
            snippetStart + snippetMarker.length,
            content.length
          ).split('\n');

          postObj.snippet = snippet[0].split(' ').slice(0, 40).join(' ');
          postData.livePosts.push(srcPaths.postsDir + file);
          postData.posts.push(postObj);
        }

        cb(postData);
      });
    });
  });
}

function getNavLinks() {
  var navLinks = [];

  fs.readdir(srcPaths.pagesDir , function(err, files) {
    if (err) {
        console.error('Could not list the directory.', err);
        process.exit(1);
    }

    files.forEach(function(file, index) {
      fileParts = file.split('.');

      if (fileParts[1] !== undefined) {
        if (fileParts[1] === 'html') {
          navObj = {};

          if (file === 'index.html') {
            navLinks.splice(0, 0, {title: 'Home', link: file});
            return;
          }

          navObj.title = toTitleCase(file.split('.')[0]);
          navObj.link = file;

          navLinks.push(navObj);
        }
      }
    });
  });

  return navLinks;
}

function toTitleCase(str) {
  // per http://stackoverflow.com/a/196991
  return str.replace(/\w\S*/g, function(txt){
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

//
// Build tasks
// -------------------------------------------------------------

gulp.task('build-clean', function () {
  return gulp.src(buildPaths.root + '*', {read: false})
    .pipe(clean());
});

gulp.task('build-sass', ['build-clean'], function () {
  return gulp.src(srcPaths.sass + 'main.scss')
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(sourcemaps.write('.', {includeContent: true}))
    .pipe(gulp.dest(buildPaths.assets))
});

gulp.task('build-js', ['build-clean'], function () {
  return gulp.src(srcPaths.js)
    .pipe(sourcemaps.init())
    .pipe(concat('main.js'))
    .pipe(sourcemaps.write('.', {includeContent: true}))
    .pipe(gulp.dest(buildPaths.assets))
});

gulp.task('build-images', ['build-clean'], function () {
  return gulp.src(srcPaths.images +'*.{png,gif,jpg}')
    .pipe(gulp.dest(buildPaths.images));
});

gulp.task('build-favicon', ['build-clean'], function () {
  return gulp.src(srcPaths.images + 'favicon.ico')
    .pipe(gulp.dest(buildPaths.root));
});

gulp.task('build-fonts', ['build-clean'], function () {
  return gulp.src(srcPaths.fonts +'*.{woff,woff2,ttf,eot,svg}')
    .pipe(gulp.dest(buildPaths.fonts));
});

gulp.task('build-templates', ['build-clean'], function() {
  return getPostData(function(data) {
    data.navLinks = getNavLinks();
    gulp.src(srcPaths.pages)
      .pipe(nunjucksRender({data: data}))
      .pipe(gulp.dest(buildPaths.root));
  });
});

gulp.task('build-posts', ['build-clean'], function() {
  return getPostData(function(data) {
    data.navLinks = getNavLinks();
    gulp.src(data.livePosts)
      .pipe(markdown())
      .pipe(gap.prependText('{% extends "src/templates/post.html" %}{% block post %}'))
      .pipe(gap.appendText('{% endblock %}'))
      .pipe(nunjucksRender({data: data}))
      .pipe(gulp.dest(buildPaths.root));
  });
});

//
// Dist tasks
// -------------------------------------------------------------

gulp.task('dist-clean', function () {
  return gulp.src(distPaths.root + '*', {read: false})
    .pipe(clean());
});

gulp.task('dist-css', ['dist-clean'], function() {
  return gulp.src(buildPaths.assets + '**/*.css')
    .pipe(cleanCSS())
    .pipe(rev())
    .pipe(gulp.dest(distPaths.assets))
    .pipe(rev.manifest('css-manifest.json'))
    .pipe(gulp.dest(distPaths.assets));
});

gulp.task('dist-js', ['dist-clean'], function() {
  return gulp.src(buildPaths.assets + '**/*.js')
    .pipe(uglify())
    .pipe(rev())
    .pipe(gulp.dest(distPaths.assets))
    .pipe(rev.manifest('js-manifest.json'))
    .pipe(gulp.dest(distPaths.assets));
});

gulp.task('dist-images', ['dist-clean', 'dist-js'], function () {
  return gulp.src(buildPaths.images +'*.{png,gif,jpg}')
    .pipe(gulp.dest(distPaths.images));
});

gulp.task('dist-favicon', ['dist-clean'], function () {
  return gulp.src(buildPaths.root + 'favicon.ico')
    .pipe(gulp.dest(distPaths.root));
});

gulp.task('dist-fonts', ['dist-clean'], function () {
  return gulp.src(buildPaths.fonts +'*.{woff,woff2,ttf,eot,svg}')
    .pipe(gulp.dest(distPaths.fonts));
});

gulp.task('dist-html', ['dist-clean', 'dist-css', 'dist-js'], function() {
  var options = {
    collapseWhitespace: true,
    removeComments: true
  },
      assets = getAssetFileNames();
  return gulp.src(buildPaths.root + '*.html')
    .pipe(replace('main.js', assets.jsFile))
    .pipe(replace('main.css', assets.cssFile))
    .pipe(htmlmin(options))
    .pipe(gulp.dest(distPaths.root))
    .pipe(sitemap({
      siteUrl: 'https://www.example.com'
    }))
    .pipe(gulp.dest(distPaths.root));
});



//
// Main tasks
// -------------------------------------------------------------

gulp.task('watch', function() {
  gulp.watch(srcPaths.root + '**/*', ['build']);
});

gulp.task('build', [
  'build-templates',
  'build-posts',
  'build-favicon',
  'build-images',
  'build-js',
  'build-sass',
  'build-fonts'
]);

gulp.task('dist', [
  'dist-html',
  'dist-favicon',
  'dist-images',
  'dist-fonts'
]);
