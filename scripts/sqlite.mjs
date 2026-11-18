import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

export function sqlite(location=':memory:') {
  const db=new DatabaseSync(location);
  if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'").get())
    db.exec(readFileSync(new URL('../drizzle/0000_atlas.sql',import.meta.url),'utf-8'));
  return {
    prepare(sql) {
      return {bind(...params) {
        return {
          async all(){return {results:db.prepare(sql).all(...params)};},
          async first(){return db.prepare(sql).get(...params)??null;},
          async run(){return {meta:db.prepare(sql).run(...params)};}
        };
      }};
    },
    async batch(queries) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const operations=queries.map(query=>query.run());
        const result=await Promise.all(operations);
        db.exec('COMMIT');
        return result;
      } catch(error) {db.exec('ROLLBACK');throw error;}
    },
    close(){db.close();}
  };
}
