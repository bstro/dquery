'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.queryFor = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

exports.default = DQueryFactory;

var _reduxQuery = require('redux-query');

var _normalizr = require('normalizr');

var _lodash = require('lodash.mapvalues');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.merge');

var _lodash4 = _interopRequireDefault(_lodash3);

var _lodash5 = require('lodash.head');

var _lodash6 = _interopRequireDefault(_lodash5);

var _lodash7 = require('lodash.compact');

var _lodash8 = _interopRequireDefault(_lodash7);

var _lodash9 = require('lodash.flip');

var _lodash10 = _interopRequireDefault(_lodash9);

var _lodash11 = require('lodash.reduce');

var _lodash12 = _interopRequireDefault(_lodash11);

var _lodash13 = require('lodash.get');

var _lodash14 = _interopRequireDefault(_lodash13);

var _lodash15 = require('lodash.omit');

var _lodash16 = _interopRequireDefault(_lodash15);

var _pluralize = require('pluralize');

var _pluralize2 = _interopRequireDefault(_pluralize);

var _camel_case = require('voca/camel_case');

var _camel_case2 = _interopRequireDefault(_camel_case);

var _queryBuilder = require('./query-builder.js');

var _queryBuilder2 = _interopRequireDefault(_queryBuilder);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var queryFor = exports.queryFor = _queryBuilder2.default;

var ERR18 = "You're attempting to query for an invalid collection type. This means that you're attempting to fetch or mutate data on a collection that redux-query has no matching definition for in vishnu/schemas/model_definitions.js.";

/**
 * DQueryFactory: the main interface for fetching data through redux-query.
 * @param {object} modelDefinitions 
 * @param {string} api
 * @param {string} version
 */
function DQueryFactory(modelDefinitions, api, version, enableDebug) {
  var schemas = _createSchemas(modelDefinitions);
  var configurations = (0, _lodash2.default)(schemas, _toQuery);

  // For easier debugging in a CRA app.
  if (enableDebug) {
    window._defs = modelDefinitions;
    window._schemas = schemas;
    window._configurations = configurations;
  }

  function createConfigFor(query, body /*, opts*/) {
    var _query$fragments = query.fragments,
        resource = _query$fragments.resource,
        include = _query$fragments.include,
        id = _query$fragments.id;

    var resourceName = (0, _camel_case2.default)(resource);
    var url = query.toString();
    if (!configurations[resourceName]) throw new Error(ERR18);
    var baseQuery = configurations[resourceName](include, url);

    var optimisticUpdate = {};
    if (id) {
      optimisticUpdate = _defineProperty({}, resourceName, function (entities) {
        return Object.assign({}, entities, _defineProperty({}, id, Object.assign({}, entities[id], body)));
      });
    }

    return (0, _lodash4.default)({}, baseQuery, {
      url: api.concat(version || '').concat(url),
      optimisticUpdate: optimisticUpdate
    });
  }

  return {
    createConfigFor: createConfigFor,

    get schemas() {
      return schemas;
    },

    get configurations() {
      return configurations;
    },

    GET: function GET(query, body, opts) {
      var baseQuery = createConfigFor.apply(undefined, arguments);
      var baseOptions = { options: { method: 'GET' } };
      return (0, _reduxQuery.requestAsync)((0, _lodash4.default)({}, baseQuery, { body: body }, baseOptions, opts));
    },
    CREATE: function CREATE(query, body, opts) {
      var baseQuery = createConfigFor.apply(undefined, arguments);
      var baseOptions = { options: { method: 'POST' } };
      return (0, _reduxQuery.mutateAsync)((0, _lodash4.default)({}, baseQuery, { body: body }, baseOptions, opts));
    },
    UPDATE: function UPDATE(query, body, opts) {
      var baseQuery = createConfigFor.apply(undefined, arguments);
      var baseOptions = { options: { method: 'PATCH' } };
      return (0, _reduxQuery.mutateAsync)((0, _lodash4.default)({}, baseQuery, { body: body }, baseOptions, opts));
    },
    DELETE: function DELETE(query, body, opts) {
      var baseQuery = createConfigFor.apply(undefined, arguments);
      var baseOptions = { options: { method: 'DELETE' } };
      return (0, _reduxQuery.mutateAsync)((0, _lodash4.default)({}, baseQuery, { body: body }, baseOptions, opts));
    }
  };
}

/* DYNAMIC QUERIES */

function _walkThroughSchemas(prev, cur) {
  // after reduction:
  // input: ["creator.profile"]
  // output: schema with 'profile' key (instanceof normalizr.schema.Entity)
  // >> effectively runs this: stack.schema.creator.schema.profile
  return (0, _lodash6.default)([].concat(prev.schema[cur]));
}

/**
 * _normalize: binds schemas to a reducing function that processes the server response
 * into a shape that redux-query (and the rest of the redux ecosystem) works with.
 * @param {*} schemas 
 */
function _normalize(schemas) {
  return function (acc, cur) {
    for (var _len = arguments.length, rest = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
      rest[_key - 2] = arguments[_key];
    }

    var key = rest[0];

    key = (0, _camel_case2.default)((0, _pluralize2.default)(key));
    if (!schemas[key]) throw new Error('No schema exists for key "' + key + '". Make sure a definition exists for your resource name in model_definitions.js."');
    // ^ @todo p3 write documentation for error
    return (0, _lodash4.default)(acc, (0, _normalizr.normalize)([].concat(cur), [schemas[key]]).entities);
    // ^ we concat cur to lift it into the array functor so that we can map over it later without everything breaking.
    // ^ we pluralize the key to accommodate for single objects returned by the server with a singularized key.
  };
}

/**
 * _findRelatedSchemaKey: private, binds schemas and the resourceNamePlural to a
 * reducing function that finds the ultimate base schema that a given relational
 * property resolves to. In other words, if the reducing function sees a "creator"
 * property, it resolves it to the "users" resource. It can do this because of the
 * type information stored from vishnu-api's OPTIONS endpoints.
 * @param {*} schemas 
 * @param {*} resourceNamePlural 
 */
function _findRelatedSchemaKey(schemas, resourceNamePlural) {
  return function (acc, cur) {
    var pathToSchema = (0, _lodash8.default)(cur.split('.')).map(_camel_case2.default);
    var rootSchema = schemas[resourceNamePlural];
    var relatedSchema = (0, _lodash12.default)(pathToSchema, _walkThroughSchemas, rootSchema);
    var relatedSchemaKey = (0, _lodash14.default)((0, _lodash6.default)([].concat(relatedSchema)), 'key');

    // We lift relatedSchema into the array functor ^^^ to account for many
    // relationships which are also represented as [someEntity], so we can
    // treat either argument type with the same array-oriented util functions.

    // return Object.assign({}, acc, {
    //   [relatedSchemaKey]: merge
    // });
    return acc.concat(relatedSchemaKey);
  };
}

/**
 * _toMergeMap: private, reducing function that processes
 * an array of url fragments and returns an object that tells
 * redux-query how to merge the newly fetched data with the collection
 * that may or may not already be in the redux store. This merge
 * function can be customized per request by overriding the options
 * 
 * see [@TODO link to gitbook.io] for more information.
 * @param {Array} acc
 * @param {Array} cur
 */
function _toMergeMap(acc, cur) {
  return Object.assign({}, acc, _defineProperty({}, cur, function (prev, next) {
    return _.merge({}, prev, next);
  }));
}

/**
 * _toQuery: private, factory function bound to normalizr schemas that
 * were built from the type information returned from the OPTIONS
 * endpoints of vishnu-api. It is thrice curried, as to allow it to be
 * called with a queryExpression (built from query-builder in our queries.js
 * file) and receive a request object in return that redux-query knows
 * how to process.
 * @param {*} schemas 
 */
function _toQuery(schema, resourceNamePlural, schemas) {
  return function (include, url) {
    var relatedKeys = [resourceNamePlural].concat((0, _lodash12.default)(include || {}, _findRelatedSchemaKey(schemas, resourceNamePlural), [])).map(_camel_case2.default);

    return {
      url: url,
      transform: function transform(res) {
        return (0, _lodash12.default)((0, _lodash16.default)(res, 'meta'), _normalize(schemas), {});
      }, // eslint-disable-line no-unused-vars
      update: (0, _lodash12.default)(relatedKeys, _toMergeMap, {}),
      options: {
        credentials: 'include',
        headers: {
          Accept: 'application/json'
        }
      }
    };
  };
}

/* SCHEMAS */

/**
 * _buildGraph: private, a function that takes our base schema objects (with
 * no knowledge of relational data) and sets up a graph of circular dependencies
 * between all the related objects based on the model definitions returned from
 * executing the OPTIONS method against vishnu-api's collection endpoints.
 * @param {*} schemas 
 * @param {*} modelDefinitions 
 */
function _buildGraph(baseSchemas, modelDefinitions) {
  var graph = Object.assign({}, baseSchemas);

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = Object.values(modelDefinitions)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var modelDef = _step.value;
      var resource_name_plural = modelDef.resource_name_plural,
          properties = modelDef.properties;

      var resourceNamePlural = (0, _camel_case2.default)(resource_name_plural);

      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = Object.entries(properties)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var _ref = _step2.value;

          var _ref2 = _slicedToArray(_ref, 2);

          var prop_name = _ref2[0];
          var prop_type = _ref2[1];
          var type = prop_type.type,
              related_to = prop_type.related_to;

          var relatedTo = (0, _camel_case2.default)(related_to);
          var propName = (0, _camel_case2.default)(prop_name);

          if (type === 'one') {
            graph[resourceNamePlural].define(_defineProperty({}, propName, graph[relatedTo]));
          } else if (type === 'many') {
            graph[resourceNamePlural].define(_defineProperty({}, propName, [graph[relatedTo]]));
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return graph;
}

/**
 * _buildBaseSchemas: private, a function that builds an object
 * keyed by the `resource_name_plural` field returned from the
 * server for a given model type. The value is a `normalizr.schema.Entity`
 * instance with no properties defined on it.
 * @param {*} modelDefinitions 
 */
function _buildBaseSchemas(modelDefinitions) {
  return (0, _lodash12.default)(modelDefinitions, function (acc, model_def, model_key) {
    var resource = (0, _camel_case2.default)(model_def.resource_name_plural);
    var modelKey = (0, _camel_case2.default)(model_key);

    return Object.assign({}, acc, _defineProperty({}, modelKey, new _normalizr.schema.Entity(resource)));
  }, {});
}

/**
 * _createSchemas: private, function that takes model definitions (these
 * currently exist in app/schemas/model_definitions.js) and returns a
 * graph of schemas powered by normalizr, a popular redux library for
 * defining schemas and normalizing/denormalizing data.
 * @param {*} modelDefinitions 
 */
function _createSchemas(modelDefinitions) {
  var baseSchemas = _buildBaseSchemas(modelDefinitions);
  return _buildGraph(baseSchemas, modelDefinitions);
}