import { requestAsync, mutateAsync } from 'redux-query';
import { schema, normalize } from 'normalizr';

import mapValues from 'lodash.mapvalues';
import merge from 'lodash.merge';
import head from 'lodash.head';
import compact from 'lodash.compact';
import flip from 'lodash.flip';
import reduce from 'lodash.reduce';
import get from 'lodash.get';
import omit from 'lodash.omit';

import pluralize from 'pluralize';
import camelize from 'voca/camel_case';

import queryBuilder from './query-builder.js';
export const queryFor = queryBuilder;

const ERR18 =
  "You're attempting to query for an invalid collection type. This means that you're attempting to fetch or mutate data on a collection that redux-query has no matching definition for in vishnu/schemas/model_definitions.js.";

/**
 * DQueryFactory: the main interface for fetching data through redux-query.
 * @param {object} modelDefinitions 
 * @param {string} api
 * @param {string} version
 */
export default function DQueryFactory(
  modelDefinitions,
  api,
  version,
  enableDebug
) {
  const schemas = _createSchemas(modelDefinitions);
  const configurations = mapValues(schemas, _toQuery);

  // For easier debugging in a CRA app.
  if (enableDebug) {
    window._defs = modelDefinitions;
    window._schemas = schemas;
    window._configurations = configurations;
  }

  function createConfigFor(query, body /*, opts*/) {
    const { fragments: { resource, include, id } } = query;
    const resourceName = camelize(resource);
    const url = query.toString();
    if (!configurations[resourceName]) throw new Error(ERR18);
    const baseQuery = configurations[resourceName](include, url);

    let optimisticUpdate = {};
    if (id) {
      optimisticUpdate = {
        [resourceName]: entities => {
          return Object.assign({}, entities, {
            [id]: Object.assign({}, entities[id], body)
          });
        }
      };
    }

    return merge({}, baseQuery, {
      url: api.concat(version || '').concat(url),
      optimisticUpdate
    });
  }

  return {
    createConfigFor,

    get schemas() {
      return schemas;
    },

    get configurations() {
      return configurations;
    },

    GET(query, body, opts) {
      const baseQuery = createConfigFor(...arguments);
      const baseOptions = { options: { method: 'GET' } };
      return requestAsync(merge({}, baseQuery, { body }, baseOptions, opts));
    },

    CREATE(query, body, opts) {
      const baseQuery = createConfigFor(...arguments);
      const baseOptions = { options: { method: 'POST' } };
      return mutateAsync(merge({}, baseQuery, { body }, baseOptions, opts));
    },

    UPDATE(query, body, opts) {
      const baseQuery = createConfigFor(...arguments);
      const baseOptions = { options: { method: 'PATCH' } };
      return mutateAsync(merge({}, baseQuery, { body }, baseOptions, opts));
    },

    DELETE(query, body, opts) {
      const baseQuery = createConfigFor(...arguments);
      const baseOptions = { options: { method: 'DELETE' } };
      return mutateAsync(merge({}, baseQuery, { body }, baseOptions, opts));
    }
  };
}

/* DYNAMIC QUERIES */

function _walkThroughSchemas(prev, cur) {
  // after reduction:
  // input: ["creator.profile"]
  // output: schema with 'profile' key (instanceof normalizr.schema.Entity)
  // >> effectively runs this: stack.schema.creator.schema.profile
  return head([].concat(prev.schema[cur]));
}

/**
 * _normalize: binds schemas to a reducing function that processes the server response
 * into a shape that redux-query (and the rest of the redux ecosystem) works with.
 * @param {*} schemas 
 */
function _normalize(schemas) {
  return (acc, cur, ...rest) => {
    let [key] = rest;
    key = camelize(pluralize(key));
    if (!schemas[key])
      throw new Error(
        `No schema exists for key "${key}". Make sure a definition exists for your resource name in model_definitions.js."`
      );
    // ^ @todo p3 write documentation for error
    return merge(
      acc,
      normalize([].concat(cur), [schemas[key]]).entities
    );
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
  return (acc, cur) => {
    const pathToSchema = compact(cur.split('.')).map(camelize);
    const rootSchema = schemas[resourceNamePlural];
    const relatedSchema = reduce(pathToSchema, _walkThroughSchemas, rootSchema);
    const relatedSchemaKey = get(head([].concat(relatedSchema)), 'key');

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
  return Object.assign({}, acc, {
    [cur]: (prev, next) => _.merge({}, prev, next)
  });
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
  return (include, url) => {
    const relatedKeys = [resourceNamePlural]
      .concat(
        reduce(
          include || {},
          _findRelatedSchemaKey(schemas, resourceNamePlural),
          []
        )
      )
      .map(camelize);

    return {
      url,
      transform: res => reduce(omit(res, 'meta'), _normalize(schemas), {}), // eslint-disable-line no-unused-vars
      update: reduce(relatedKeys, _toMergeMap, {}),
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
  let graph = Object.assign({}, baseSchemas);

  for (let modelDef of Object.values(modelDefinitions)) {
    const { resource_name_plural, properties } = modelDef;
    const resourceNamePlural = camelize(resource_name_plural);

    for (let [prop_name, prop_type] of Object.entries(properties)) {
      const { type, related_to } = prop_type;
      const relatedTo = camelize(related_to);
      const propName = camelize(prop_name);

      if (type === 'one') {
        graph[resourceNamePlural].define({
          [propName]: graph[relatedTo]
        });
      } else if (type === 'many') {
        graph[resourceNamePlural].define({
          [propName]: [graph[relatedTo]]
        });
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
  return reduce(
    modelDefinitions,
    (acc, model_def, model_key) => {
      const resource = camelize(model_def.resource_name_plural);
      const modelKey = camelize(model_key);

      return Object.assign({}, acc, {
        [modelKey]: new schema.Entity(resource)
        /*
          Using the modelKey allows us to account for aliases (the particular case that illustrates
          the need for this is building schemas for sideloaded objectives, which is returned from
          drest inside a `+objectives` key.
          
          A little bit of an escape hatch.
          @TODO P0 write documentation for this comment on gitbook.
        */
      });
    },
    {}
  );
}

/**
 * _createSchemas: private, function that takes model definitions (these
 * currently exist in app/schemas/model_definitions.js) and returns a
 * graph of schemas powered by normalizr, a popular redux library for
 * defining schemas and normalizing/denormalizing data.
 * @param {*} modelDefinitions 
 */
function _createSchemas(modelDefinitions) {
  const baseSchemas = _buildBaseSchemas(modelDefinitions);
  return _buildGraph(baseSchemas, modelDefinitions);
}
