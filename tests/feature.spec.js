var _ = require('lodash');
var ObjectionFeature = require('../features/objection');
var expect = require('chai').expect;
var sinon = require('sinon');

describe('Feature initialization with static config', function () {
  var feature = null;
  var app = null;
  var staticConfig = null;

  beforeEach(function () {
    app = sinon.spy();

    staticConfig = {
      // normal knex config to describe db connection for app
      knex: {
        client: 'postgres',
        debug: false,
        connection: {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: process.env.POSTGRES_PORT || 5432,
          database: 'dodo-objection-test',
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
      populatePathPattern: path.join(serviceRootDir, 'data', 'populate', '**.js'),
      modelPaths: [
        path.join(buildRootDir, 'models/*.js'),
        path.join(buildRootDir, 'shared/models/*.js')
      ],
      // extra configuration for db utils to tell how to initialize databases etc.
      dbManager: {
        superUser: process.env.POSTGRES_SUPERUSER || 'postgres',
        superPassword: process.env.POSTGRES_SUPERUSER_PW || undefined,
        collate: ['fi_FI.UTF-8', 'Finnish_Finland.1252']
      }
    };

    feature = new ObjectionFeature(app, config);
  });

  // TODO: somthing like this:
  // var featureInstance = new ObjectionFeature(sinon.spy(), sinon.spy());

  // TODO: getDBConfig should require parameter when function
  //       passed as configuration

  // TODO: should cache DB instance if called twice with same config

  // TODO: should have knex(req?) function to get knex instance

  // TODO: should have disconnectKnex() function to destroy all databases

  // TODO: should models(req?) which returns all models bound with connection

  // TODO: should bind all models found from directory to given connection

  // TODO: should register middleware, which adds models and knex connection to request

  // TODO: should configure postgres nicely to return timestamps and dates as strings,
  //       bigintegers as numbers and json as string

  it('should run this test', function () {
  });

  it.skip('should support mysql!', function () {
    expect(false).to.be.ok; // currently initialization code stuff is postrgres only
  });
});