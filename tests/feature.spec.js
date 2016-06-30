var _ = require('lodash');
var ObjectionFeature = require('../features/objection');
var expect = require('chai').expect;
var sinon = require('sinon');

describe('Feature initialization', function () {

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
    expect(false).to.be.ok;
  });
});