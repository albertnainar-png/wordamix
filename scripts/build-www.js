// Copies the web game into www/ (Capacitor's webDir). No bundler needed; the game is plain static files.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),out=path.join(root,'www');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const f of ['index.html','manifest.webmanifest','sw.js','js','data','icons'])fs.cpSync(path.join(root,f),path.join(out,f),{recursive:true});
// Licence texts stay in data/; tests, tools and original/ are intentionally not shipped in the app.
console.log('www ready:',fs.readdirSync(out).join(', '));
