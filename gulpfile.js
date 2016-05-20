var fs = require('fs'),
    path = require('path'),
    gulp = require('gulp'),
    browserSync = require('browser-sync');

// Load all gulp plugins automatically
// and attach them to the `plugins` object
var plugins = require('gulp-load-plugins')();

// Temporary solution until gulp 4
// https://github.com/gulpjs/gulp/issues/355
var runSequence = require('run-sequence');

var pkg = require('./package.json');
var dirs = pkg['h5bp-configs'].directories;

// ---------------------------------------------------------------------
// | Helper tasks                                                      |
// ---------------------------------------------------------------------

gulp.task('archive:create_archive_dir', function () {
    fs.mkdirSync(path.resolve(dirs.archive), '0755');
});

gulp.task('archive:zip', function (done) {

    var archiveName = path.resolve(dirs.archive, pkg.name + '_v' + pkg.version + '.zip');
    var archiver = require('archiver')('zip');
    var files = require('glob').sync('**/*.*', {
        'cwd': dirs.dist,
        'dot': true // include hidden files
    });
    var output = fs.createWriteStream(archiveName);

    archiver.on('error', function (error) {
        done();
        throw error;
    });

    output.on('close', done);

    files.forEach(function (file) {

        var filePath = path.resolve(dirs.dist, file);

        // `archiver.bulk` does not maintain the file
        // permissions, so we need to add files individually
        archiver.append(fs.createReadStream(filePath), {
            'name': file,
            'mode': fs.statSync(filePath).mode
        });

    });

    archiver.pipe(output);
    archiver.finalize();

});

gulp.task('clean', function (done) {
    require('del')([
        dirs.archive,
        dirs.dist
    ]).then(function () {
        done();
    });
});

gulp.task('copy', [
    'copy:.htaccess',
    'copy:index.html',
    'copy:jquery',
    'copy:license',
    'copy:main.css',
    'copy:misc',
    'copy:normalize'
]);

gulp.task('copy:.htaccess', function () {
    return gulp.src('node_modules/apache-server-configs/dist/.htaccess')
               .pipe(plugins.replace(/# ErrorDocument/g, 'ErrorDocument'))
               .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:index.html', function () {
    return gulp.src(dirs.src + '/index.html')
               .pipe(plugins.replace(/{{JQUERY_VERSION}}/g, pkg.devDependencies.jquery))
               .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:jquery', function () {
    return gulp.src(['node_modules/jquery/dist/jquery.min.js'])
               .pipe(plugins.rename('jquery-' + pkg.devDependencies.jquery + '.min.js'))
               .pipe(gulp.dest(dirs.dist + '/js/vendor'));
});

gulp.task('copy:license', function () {
    return gulp.src('LICENSE.txt')
               .pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:main.css', function () {

    var banner = '/*! HTML5 Boilerplate v' + pkg.version +
                    ' | ' + pkg.license.type + ' License' +
                    ' | ' + pkg.homepage + ' */\n\n';

    return gulp.src(dirs.src + '/css/main.css')
               .pipe(plugins.header(banner))
               .pipe(plugins.autoprefixer({
                   browsers: ['last 2 versions', 'ie >= 8', '> 1%'],
                   cascade: false
               }))
               .pipe(gulp.dest(dirs.dist + '/css'));
});

gulp.task('copy:misc', function () {
    return gulp.src([

        // Copy all files
        dirs.src + '/**/*',

        // Exclude the following files
        // (other tasks will handle the copying of these files)
        '!' + dirs.src + '/css/main.css',
        '!' + dirs.src + '/index.html'

    ], {

        // Include hidden files by default
        dot: true

    }).pipe(gulp.dest(dirs.dist));
});

gulp.task('copy:normalize', function () {
    return gulp.src('node_modules/normalize.css/normalize.css')
               .pipe(gulp.dest(dirs.dist + '/css'));
});

/** compile jade **/
gulp.task('compile:jade', function () {
    gulp.src(dirs.src + '/templates/*.jade')
        //.pipe(gulp.dest(dirs.dist))
        .pipe(
            plugins.jade({
                pretty: true
            })
        )
        .pipe(gulp.dest(dirs.src))
    ;
});

gulp.task('compile:stylus', function() {
    return gulp.src(dirs.src+'/styl/*.styl')
        .pipe(plugins.stylus())
        .pipe(gulp.dest(dirs.src+'/css/'));
});

gulp.task('lint:js', function () {
    return gulp.src([
        'gulpfile.js',
        dirs.src + '/js/*.js',
        dirs.test + '/*.js'
    ]).pipe(plugins.jscs())
      .pipe(plugins.jshint())
      .pipe(plugins.jshint.reporter('jshint-stylish'))
      .pipe(plugins.jshint.reporter('fail'));
});


/*********************************************************************
 *  2. HTTP SERVER FOR LOCAL DEVELOPMENT
 /********************************************************************/
// ---------------------------------------------------------------------
//  HTTP server (for local development)
//  --reload browser window on changes--
//
// *** this task reloading browser window on all connected devices and
//     sync state (scroll position, form filling, etc.)
//
//
// CONNECTION TO STAGING SERVER
//
// from current pc
// > developing page http://localhost:900*
// > session options http://localhost:300*
//
// from any device in current local network
// > developing page http://192.168.0.*:900*
// > session options http://192.168.0.*:300*
// (you can see actual ip in terminal window when sync will be started)
// ---------------------------------------------------------------------
gulp.task("serve:src", function () {
    browserSync({
        port: 9000,
        server: {
            baseDir: dirs.src
        }
    });

});

// CONNECTION TO DIST SERVER
//
// from current pc
// > developing page http://localhost:990*
// > session options http://localhost:390*
//
// from any device in current local network
// > developing page http://192.168.0.*:990*
// > session options http://192.168.0.*:390*
gulp.task("serve:dist", function () {
    browserSync({
        port: 9900,
        server: {
            baseDir: dirs.src
        }
    });
});

// ---------------------------------------------------------------------
// | Main tasks                                                        |
// ---------------------------------------------------------------------

gulp.task('watch', function () {
    gulp.watch(dirs.src+'/templates/**/*', ['build']);
    gulp.watch(dirs.src+'/styl/**/*', ['build']);
    gulp.watch([
        dirs.src+'/*.html',
        dirs.src+'/js/**/*.js',
        dirs.src+'/css/**/*.css'
    ]).on('change', browserSync.reload);
});

gulp.task('archive', function (done) {
    runSequence(
        'build',
        'archive:create_archive_dir',
        'archive:zip',
    done);
});

gulp.task('build', function (done) {
    runSequence(
        ['clean', 'lint:js', 'compile:jade', 'compile:stylus'],
        'copy',
        done);
});

gulp.task('default', ['build', 'serve:src', 'watch']);
