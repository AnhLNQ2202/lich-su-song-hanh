const esbuild=require('esbuild');
esbuild.buildSync({entryPoints:['web/comparison.jsx'],bundle:true,minify:true,format:'iife',target:'es2020',outfile:'comparison-native.js',define:{'process.env.NODE_ENV':'"production"'}});
