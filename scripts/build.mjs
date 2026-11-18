import {readFileSync,writeFileSync,mkdirSync,copyFileSync,readdirSync} from 'node:fs';

const webFiles=readdirSync('web').filter(name=>/\.(?:js|css)$/.test(name));
const assets=Object.fromEntries(webFiles.map(name=>[
  '/'+name,[name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8',readFileSync('web/'+name,'utf-8')]
]));
const shell=readFileSync('web/index.html','utf-8');
const lessons=Object.fromEntries(readdirSync('lessons').filter(name=>name.endsWith('.md'))
  .map(name=>[name.slice(0,-3),readFileSync('lessons/'+name,'utf-8')]));

function bundle(name) {
  const declarations=[];
  let code=readFileSync('src/'+name+'.mjs','utf-8')
    .replace(/^import (\{[^}]+\}) from '\.\/([a-z]+)\.mjs';$/gm,(_,vars,module)=>'const '+vars+' = '+module+'Module;')
    .replace(/^export ((?:async )?(?:function|const) (\w+))/gm,(_,line,key)=>{
      declarations.push(key);return line;
    });
  if (code.includes('\nexport default ')) {
    declarations.push('main');
    code=code.replace('\nexport default ','\nconst main = ');
  }
  return 'const '+name+'Module = (() => {\n'+code+'\nreturn {'+declarations.join(',')+'};\n})();\n';
}

mkdirSync('dist/server',{recursive:true});
mkdirSync('dist/.openai',{recursive:true});
copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
writeFileSync('dist/server/index.js',
  'const generatedModule = '+JSON.stringify({assets,shell,lessons})+';\n'+
  ['content','ingest','ranking','worker'].map(bundle).join('\n')+'\nexport default workerModule.main;\n');
