module.exports.up = function(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS network_mode (
      id   INTEGER PRIMARY KEY DEFAULT 1,
      mode TEXT    NOT NULL
    );
  `, err => {
    if (err) {
      console.error('Error creating network_mode table:', err);
      return;
    }
    console.log('network_mode table is ready');
  });
};

module.exports.down = function(db) {
  db.run(`
    DROP TABLE IF EXISTS network_mode;
  `, err => {
    if (err) console.error('Error dropping network_mode table:', err);
    else      console.log('network_mode table has been dropped');
  });
};