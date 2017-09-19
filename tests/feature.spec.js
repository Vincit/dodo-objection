var _ = require('lodash');
var ObjectionFeature = require('../features/objection');
var expect = require('chai').expect;
var sinon = require('sinon');
var path = require('path');

describe('Feature initialization with static config', function () {
  var feature = null;
  var mockApp = null;
  var staticConfig = null;

  beforeEach(function () {
    mockApp = {};

    staticConfig = {
      // normal knex config to describe db connection for app
      knex: {
        client: 'postgres',
        debug: false,
        connection: {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: process.env.POSTGRES_PORT || 5432,
          database: 'dodo-objection-test-base',
          user: process.env.POSTGRES_USER || 'dodoobjtestuser',
          password: process.env.POSTGRES_USER_PW || undefined
        },
        pool: {
          min: 2,
          max: 50,
          afterCreate: function (conn, cb) {
            conn.query('SET timezone="UTC";', function (err) {
              cb(err, conn);
            });
          }
        },
        acquireConnectionTimeout: 10000,
        migrations: {
          tableName: 'migrations'
        }
      },
      modelPaths: [], // TODO: tests that works without models
      // extra configuration for db utils to tell how to initialize databases etc.
      dbManager: {
        superUser: process.env.POSTGRES_SUPERUSER || 'postgres',
        superPassword: process.env.POSTGRES_SUPERUSER_PW || undefined,
        collate: ['en_US.UTF-8', 'fi_FI.UTF-8', 'Finnish_Finland.1252']
      }
    };

    mockApp.config = staticConfig;
    mockApp.use = sinon.spy();

    feature = new ObjectionFeature(mockApp, staticConfig);
  });

  it('should have called .use once', function () {
    expect(mockApp.use.calledOnce).to.be.ok;
  });

  it('should initialize database for request by registered express middleware', function () {
    var middleware = mockApp.use.firstCall.args[0];
    var mockReq = {};
    var next = sinon.spy();
    middleware(mockReq, null, next);
    // test later that knex connection actually works (use db manager to setup DB first)
    expect(next.calledOnce).to.be.ok;
    expect(mockReq.models).to.eql({});
    expect(typeof mockReq.knex.client.makeKnex).to.equal('function'); // nasty check that it really is knex
    expect(mockReq.dbManager).to.be.ok;
  });

  it('should add knex / models / dbManager getters and should cache dbManager and knex', function () {
    var dbManager = feature.dbManager();
    var knex = feature.knex();
    var models = feature.models();

    expect(dbManager).to.be.ok;
    expect(knex).to.be.ok;
    expect(models).to.be.ok;

    expect(feature.dbManager()).to.equal(dbManager);
    expect(feature.knex()).to.equal(knex);
  });
});

describe('integration', function () {
  var feature = null;
  var mockApp = null;
  var staticConfig = null;

  beforeEach(function () {
    mockApp = {};

    configFunction = function (req) {
      return {
        // normal knex config to describe db connection for app
        knex: {
          client: 'postgres',
          debug: false,
          connection: {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: process.env.POSTGRES_PORT || 5432,
            database: req.database,
            user: process.env.POSTGRES_USER || 'dodoobjtestuser',
            password: process.env.POSTGRES_USER_PW || undefined
          },
          pool: {
            min: 2,
            max: 50,
            afterCreate: function (conn, cb) {
              conn.query('SET timezone="UTC";', function (err) {
                cb(err, conn);
              });
            }
          },
          acquireConnectionTimeout: 10000,
          migrations: {
            tableName: 'migrations',
            directory: path.join(__dirname, 'migrations')
          }
        },
        modelPaths: [ path.join(__dirname, 'models1', '*.js'), path.join(__dirname, 'models2', '*.js')],
        // extra configuration for db utils to tell how to initialize databases etc.
        dbManager: {
          superUser: process.env.POSTGRES_SUPERUSER || 'postgres',
          superPassword: process.env.POSTGRES_SUPERUSER_PW || undefined,
          collate: ['en_US.UTF-8', 'fi_FI.UTF-8', 'Finnish_Finland.1252']
        }
      };
    }

    mockApp.config = configFunction;
    mockApp.use = sinon.spy();

    feature = new ObjectionFeature(mockApp, configFunction);
  });

  it('should be able to run migrations and bind models for 2 databases', function () {
    var mockRequest1 = { database: 'dodo-objection-test-1' };
    var mockRequest2 = { database: 'dodo-objection-test-2' };
    
    var manager1 = feature.dbManager(mockRequest1);
    var manager2 = feature.dbManager(mockRequest2);

    return Promise.all([
      manager1.createDbOwnerIfNotExist()
        .then(function () {
          return manager1.dropDb().catch();
        })
        .then(function () {
          return manager1.createDb();
        })
        .then(function () {
          return manager1.migrateDb();
        })
        .then(function () {
          return feature.models(mockRequest1).Model1.query().insert({});
        }),
      manager2.createDbOwnerIfNotExist()
        .then(function () {
          return manager2.dropDb().catch();
        })
        .then(function () {
          return manager2.createDb();
        })
        .then(function () {
          return manager2.migrateDb();
        })
        .then(function () {
          return feature.models(mockRequest2).Model2.query().insert({});
        })        
    ]).then(function () {
      var db1Knex = feature.knex(mockRequest1);
      var db2Knex = feature.knex(mockRequest2);

      return Promise.all([
        db1Knex('Model1').then(function (res) {
          expect(res).to.have.length(1);
        }),
        db1Knex('Model2').then(function (res) {
          expect(res).to.have.length(0);
        }),
        db2Knex('Model1').then(function (res) {
          expect(res).to.have.length(0);
        }),
        db2Knex('Model2').then(function (res) {
          expect(res).to.have.length(1);
        }),
      ]);
    });
  });  

  it('should close all DB connections', function () {
    var mockRequest1 = { database: 'dodo-objection-test-1' };
    var mockRequest2 = { database: 'dodo-objection-test-2' };
    var knex1 = feature.knex(mockRequest1);
    var knex2 = feature.knex(mockRequest2);

    return feature.disconnectKnex()
      .then(function () {
        return knex1('Model1')
          .then(function (res) {
            expect('should fail..').to.contain('but it did not');
          })
          .catch(function (err) {
            expect(err.message).to.contain('Unable to acquire a connection');
          });
      })
      .then(function () {
        return knex2('Model2')
          .then(function (res) {
            expect('should fail..').to.contain('but it did not');
          })
          .catch(function (err) {
            expect(err.message).to.contain('Unable to acquire a connection');
          });
      });
  });

  it.skip('should support mysql!', function () {
    expect(false).to.be.ok; // currently initialization code stuff is postrgres only
  });
});

