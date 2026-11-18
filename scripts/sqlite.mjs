import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';

export function sqlite(location=':memory:') {
  const db=new DatabaseSync(location);
  const migrations=new URL('../drizzle/',import.meta.url);
  db.exec('CREATE TABLE IF NOT EXISTS local_migrations (filename TEXT PRIMARY KEY)');
  for(const file of readdirSync(migrations).filter(name=>name.endsWith('.sql')).sort()) {
    if(db.prepare('SELECT filename FROM local_migrations WHERE filename=?').get(file))continue;
    db.exec('BEGIN');
    try {
      const existed=file==='0000_atlas.sql'&&db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'").get();
      if(!existed)db.exec(readFileSync(new URL(file,migrations),'utf-8'));
      db.prepare('INSERT INTO local_migrations VALUES(?)').run(file);
      db.exec('COMMIT');
    } catch(error) {db.exec('ROLLBACK');throw error;}
  }
  return {
    prepare(sql) {
      return {bind(...params) {
        return {
          async all(){return {results:db.prepare(sql).all(...params)};},
          async first(){return db.prepare(sql).get(...params)??null;},
          run(){return {meta:db.prepare(sql).run(...params)};}
        };
      }};
    },
    async batch(queries) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result=queries.map(query=>query.run());
        db.exec('COMMIT');
        return result;
      } catch(error) {db.exec('ROLLBACK');throw error;}
    },
    close(){db.close();}
  };
}
