/**
 * Database configuration example

 database: {
    // Possible values 'postgres', 'sqlite' and 'mysql'.
    client: 'postgres',

    // Set to true to enable DB query debugging
    // debug: true,

    // Database server address.
    host: 'localhost',

    // Database name (file path for sqlite). This can also be a function that takes a request object
    // as parameter and returns a database name. In this case the database can be selected individually
    // for each request.
    database: '<%=database%>',

    // Collation to be used. It will be set by default to 'Finnish_Finland.1252' in Windows environments
    // and otherwise to 'fi_FI.UTF-8'.
    collate: '<%=collate%>',

    // Optional username.
    user: 'postgres',

    // Optional password.
    password: undefined,

    // Username with super user rights. This is used for creating/dropping databases and for other
    // "super user" stuff mainly by different gulp tasks.
    superUser: 'postgres',

    // Optional super user password.
    superPassword: undefined,

    // Minimum size for the connection pool.
    minConnectionPoolSize: 0,

    // Maximum size for the connection pool.
    maxConnectionPoolSize: 10,

    // Function to run on newly created DB connections, before they are used for queries.
    // Can be used to further configure the DB session.
    //
    // Takes the native DB driver connection object as an argument, and a callback which
    // accepts the reconfigured connection as an argument. Example for postgres:
    //
    afterConnectionCreate: function (conn, cb) {
      conn.query('SET timezone="UTC";', function (err) {
        cb(err, conn);
      });
    },

    // Like afterConnectionCreate, but is ran before a connection is disconnected, after
    // all queries using it have finished executing.
    beforeConnectionDestroy: null,

    // Absolute file path to the migrations folder.
    migrationsDir: serviceRootDir + '/data/migrations',

    // The name of the table that stores the migration information.
    migrationsTable: 'migrations'
  }

 */

/**
 * @return {DatabaseManager}
 */
module.exports = function DatabaseManagerFactory(config) {
  // Prevent morons from invoking this as a constructor.
  if (this instanceof DatabaseManagerFactory) {
    throw new Error('this is not a constructor');
  }

  switch (config.knex.client) {
    case 'postgres': {
      var PostgresDatabaseManager = require('./PostgresDatabaseManager');
      return new PostgresDatabaseManager(config);
    }
    case 'mysql': {
      var MySqlDatabaseManager = require('./MySqlDatabaseManager');
      return new MySqlDatabaseManager(config);
    }
    case 'sqlite': {
      var SqliteDatabaseManager = require('./SqliteDatabaseManager');
      return new SqliteDatabaseManager(config);
    }
    default:
      throw new Error(config.knex.client + ' is not supported. Supported clients: postgres, mysql and sqlite');
  }
};
