import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import worker from '../dist/server/index.js';
import {sqlite} from './sqlite.mjs';

const DB=sqlite(process.env.ATLAS_SQLITE_PATH||'.atlas.sqlite');
const args=process.argv.slice(2);
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const port=Number(option('--port',process.env.PORT||3000));
const host=option('--host','127.0.0.1');
const server=createServer(async (req,res)=>{
  const origin='http://'+req.headers.host;
  const headers=new Headers(req.headers);
  headers.delete('oai-authenticated-user-id');
  headers.delete('oai-authenticated-user-email');
  const hasBody=!['GET','HEAD'].includes(req.method);
  const input=new Request(origin+req.url,{method:req.method,headers,...(hasBody?{body:Readable.toWeb(req),duplex:'half'}:{})});
  const response=await worker.fetch(input,{DB},{waitUntil:promise=>promise.catch(error=>console.error(error.message))});
  res.writeHead(response.status,Object.fromEntries(response.headers));
  if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();
});
server.listen(port,host,()=>console.log('Model Atlas http://'+host+':'+port));
