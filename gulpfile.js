var gulp = require('gulp');
var ts = require('gulp-typescript');

gulp.task('default', function() {
    var tsResult = gulp.src('*.ts')
                   .pipe(ts({
                       declarationFiles: false,
                       noExternalResolve: true,
                       module: 'amd',
                       target: 'ES5'
                   }));
    return tsResult.js.pipe(gulp.dest('\js'));
});