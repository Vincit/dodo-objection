"use strict";

var _ = require('lodash')
  , Promise = require('bluebird')
  , multiRequire = require('dodo/utils').multiRequire
  , classUtils = require('dodo/utils').classUtils
  , Model = require('objection').Model
  , knex = require('knex')
  , color = require('cli-color')
  , log = require('dodo/logger').getLogger('dodo-objection.feature')
  , moment = require('moment')
  , path = require('path')
  , fs = require('fs')
  , createDbManager = require('knex-db-manager').databaseManagerFactory;

/**
 * Registers an *Express* middleware that adds a *knex.js* database connection to each request.
 *
 * Example usage in config file:
 *
 * ```js
 * features: [
 *   ...
 *   {
 *     feature: 'objection',
 *     config: {
 *       knex: { ... },
 *       dbManager: { ... },
 *       modelPaths: []
 *     }
 *   },
 *   ...
 * ]
 * ```
 *
 * The database connection is established according to the `config.database` and stored to `req.knex` and `req.models`.
 *
 * @param {object} app
 *    express.js Application instance.
 */
module.exports = function(app, config) {
  var feature = this;

  /**
   * Check if configuration is actually `function (req)` and plain object and get configuration accordingly.
   *
   * @param {function (req)|object} objectionConfig
   * @param req
   * @return {object} Objection configuration.
   */
  function getDbConfig(objectionConfig, req) {
    if (_.isFunction(objectionConfig)) {
      if (!req) {
        throw new Error(
          'Cannot create database connection: ' +
          'database configuration is a function that expects a Request object as input ' +
          'and the request object is not available.'
        );
      }
      return objectionConfig(req);
    } else {
      return objectionConfig;
    }
  }

  var databases = {};
  function database(req) {
    var knexConfig = getDbConfig(config, req).knex;
    var dbId = knexConfig.client
      + '_' + knexConfig.connection.host
      + '_' + knexConfig.connection.database;

    if (!databases[dbId]) {
      databases[dbId] = knex(knexConfig);
    }

    return databases[dbId];
  }

  var dbManagers = {};
  function dbManagerCache(req) {
    var managerConfig = getDbConfig(config, req);
    var knexConfig = managerConfig.knex;
    var dbId = knexConfig.client
      + '_' + knexConfig.connection.host
      + '_' + knexConfig.connection.database;

    if (!dbManagers[dbId]) {
      dbManagers[dbId] = createDbManager(managerConfig);
    }

    return dbManagers[dbId];
  }

  configurePostgres();

  // database manager for handling administration stuff...
  feature.dbManager = function (fakeReq) {
    return dbManagerCache(fakeReq);
  }

  /**
   * Get database connection through app
   *
   * @param {object} fakeReq If one have given objection configuration as
   *   `function (req)` in that case one has to give compatible req object to create connection.
   */
  feature.knex = function (fakeReq) {
    // Throws if the database configuration is request specific.
    // See ConfigManager.knexConfig for more info.
    return database(fakeReq);
  };

  feature.disconnectKnex = function () {
    var dbs = databases;
    databases = {};
    // TODO: probably this should also destroy dbManager connections
    return Promise.all(_.map(dbs, function (knex) {
      return knex.destroy();
    }));
  };

  // bind models...
  var modelModules = findModelClassModules(app, getDbConfig(config, {}));

  /**
   * Get bound models through app
   *
   * @param {object} fakeReq If one have given objection configuration as
   *   `function (req)` in that case one has to give compatible req object to create connection.
   */
  feature.models = function (fakeReq) {
    // Throws if the database configuration is request specific.
    // See ConfigManager.knexConfig for more info.
    return bindModels(feature.knex(fakeReq));
  };

  app.use(function(req, res, next) {
    req.knex = feature.knex(req);
    req.models = feature.models(req);
    req.dbManager = feature.dbManager(req);
    next();
  });

  function bindModels(knex) {
    var models = {};
    // Create a bound version of each model class by binding them to the given database.
    // This allows the model classes to be used with the correct database without passing
    // the database object to each method that performs database operations.
    for (var i = 0, l = modelModules.length; i < l; ++i) {
      var ModelClass = modelModules[i].module.default || modelModules[i].module;
        models[ModelClass.name] = ModelClass.bindKnex(knex);
    }
    return models;
  }
};

module.exports.tasks = [{
  name: 'db-create',
  run: function (featureConfig, serviceConfig, servicePath) {
    const dbManager = createDbManager(featureConfig);
    return dbManager.createDb()
      .tap(res => dbManager.closeKnex())
      .tap(res => dbManager.close())
      .catch(err => {
        dbManager.closeKnex();
        dbManager.close();
        throw err;
      });
  },
  description: 'Creates database for the service (and owner user if necessary)'

}, {
  name: 'db-migrate',
  run: function (featureConfig, serviceConfig, servicePath) {
    const dbManager = createDbManager(featureConfig);
    return dbManager.migrateDb()
      .tap(res => dbManager.closeKnex())
      .tap(res => dbManager.close())
      .catch(err => {
        dbManager.closeKnex();
        dbManager.close();
        throw err;
      });
  },
  description: 'Runs migrations of the service'

}, {
  name: 'db-drop',
  run: function (featureConfig, serviceConfig, servicePath) {
    const dbManager = createDbManager(featureConfig);
    return dbManager.dropDb()
      .tap(res => dbManager.closeKnex())
      .tap(res => dbManager.close())
      .catch(err => {
        dbManager.closeKnex();
        dbManager.close();
        throw err;
      });
  },
  description: 'Drops database of the service'

}, {
  name: 'new-migration',
  run: function (featureConfig, serviceConfig, servicePath) {
    const migrationName = process.env.MIGRATION_NAME || 'new_migration';
    const currentUtc = moment().utc().format("YYYYMMDDHHmmss");

    let configuredMigrationDir = featureConfig.knex.migrations.directory || 'migrations';
    configuredMigrationDir = configuredMigrationDir.startsWith('/') ?
      configuredMigrationDir :
      path.join(servicePath, configuredMigrationDir);

    // TODO: add migration suffix + template to config
    const migrationFileName = path.join(configuredMigrationDir, currentUtc + '_' + migrationName + '.js');

    var template = [
      "'use strict';",
      "//var _ = require('lodash');",
      "",
      "// see http://knexjs.org/#Schema ",
      "exports.up = function (knex) {",
      "  return knex.schema.table('MyTable', function (table) {",
      "    table.timestamp('createTime').notNullable().defaultTo(knex.raw('now()'));",
      "  });",
      "};",
      "",
      "exports.down = function (/* knex */) {",
      "};"
    ];

    try {
      fs.writeFileSync(migrationFileName, template.join("\n"));
      log.debug(`Created new migration script: ${migrationFileName}`);
    } catch (err) {
      log.error({ error: err }, 'Could not write migration file.');
      throw err;
    }

    return {
      createdFile: migrationFileName
    };
  },
  description: 'Creates new migration for the service, pass name is MIGRATION_NAME environment variable'

}];

/**
 * @private
 */
var configurePostgres = _.once(function () {
  var pgTypes = require('pg').types;
  var MaxSafeInteger = Math.pow(2, 53) - 1;

  // Convert big integers to numbers.
  pgTypes.setTypeParser(20, function (val) {
    if (val === null) {
      return null;
    }
    var number = parseInt(val, 10);
    if (number > MaxSafeInteger) {
      throw new Error('node-pg: bigint overflow: ' + number);
    }
    return number;
  });

  // Don't parse dates to js Date() objects
  pgTypes.setTypeParser(1082, 'text');

  // Don't parse timestamps to js Date() objects, but just ISO8601 strings
  pgTypes.setTypeParser(1184, function (val) {
    if (val === null) {
      return null;
    }

    // supports following formats:
    //
    // 2014-09-23 15:29:18.37788+03,
    // 2014-09-23 15:29:18.37788+03
    // 2014-09-23 15:29:18-03
    // 2014-09-23 15:29:18.38+03:30
    // 2014-09-23 15:29:18+00
    // 2014-09-23 15:29:18.38

    var parsedDateTime = val.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(\.(\d+))?(([+-])(\d{2})(:(\d{2}))?)?/);

    // output is
    // [
    //   "2014-09-23 15:29:18.38+03:30",
    //   "2014-09-23",
    //   "15:29:18",
    //   ".38",
    //   "38",
    //   "+03:30",
    //   "+","03",":30","30"
    // ]

    var parsedSubSecond = parsedDateTime[4];
    var milliseconds = ".000";
    if (parsedSubSecond) {
      milliseconds = parseFloat(parsedDateTime[3]).toFixed(3).substring(1);
    }

    var parsedTimeZone = parsedDateTime[5];
    var isoTimeZone = "Z";
    if (parsedTimeZone) {
      var sign = parsedDateTime[6];
      var hours = parsedDateTime[7];
      var minutes = parsedDateTime[9] || "00";
      isoTimeZone = sign + hours + ":" + minutes;
    }

    return parsedDateTime[1] + "T" + parsedDateTime[2] + milliseconds + isoTimeZone;
  });

  // Don't convert json into object. Return as string.
  pgTypes.setTypeParser(114, function (val) {
    return val;
  });
});

/**
 * @returns {Array.<RequireResult>}
 * @private
 */
function findModelClassModules(app, config) {
  return _.reduce(config.modelPaths, function(allModules, modelPath) {
    var modules = multiRequire(modelPath)
      .filterModule(function(module) {
        var moduleDefault = module.default || module;
        var isSubModel = classUtils.isSubclassOf(moduleDefault, Model) && moduleDefault !== Model;
        return isSubModel;
      })
      .require(function(module) {
        var moduleDefault = module.module.default || module.module;
        if (_.isEmpty(moduleDefault.name)) {
          throw new Error(
            'invalid Model in path ' +
            '"' + module.filePath + '": ' +
            'Constructor doesn\'t have a name.'
          );
        }
        if (app.config.profile !== 'testing') {
          logModelClassFound(module);
        }
      });
    return allModules.concat(modules);
  }, []);
}

/**
 * @param {RequireResult} module
 * @private
 */
function logModelClassFound(module) {
  log.info('  '
    + color.white('registering model class ')
    + color.cyan(module.fileName) + ' '
    + color.white('for database binding'));
}
