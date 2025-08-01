module.exports.up = function(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS network_static (
      id   INTEGER PRIMARY KEY DEFAULT 1,
      static_ip TEXT    NOT NULL
    );
  `, err => {
    if (err) {
      console.error('Error creating network_static table:', err);
      return;
    }
    console.log('network_static table is ready');
  });
};

module.exports.down = function(db) {
  db.run(`
    DROP TABLE IF EXISTS network_static;
  `, err => {
    if (err) console.error('Error dropping network_static table:', err);
    else      console.log('network_static table has been dropped');
  });
};