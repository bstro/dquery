import { singular } from 'pluralize';
import set from 'lodash.set';
import last from 'lodash.last';
import isString from 'lodash.isstring';
import isEmpty from 'lodash.isempty';
import negate from 'lodash.negate';

export const VALID_FILTER_OPERATORS = {
  // IMPORTED FROM DREST
  in: 'in',
  any: 'any',
  all: 'all',
  icontains: 'icontains',
  contains: 'contains',
  startswith: 'startswith',
  istartswith: 'istartswith',
  endswith: 'endswith',
  iendswith: 'iendswith',
  year: 'year',
  month: 'month',
  day: 'day',
  week_day: 'week_day',
  regex: 'regex',
  range: 'range',
  gt: 'gt',
  lt: 'lt',
  gte: 'gte',
  lte: 'lte',
  isnull: 'isnull',
  eq: 'eq',
  // ALIASES
  is: 'eq'
};

class QueryExpression {
  constructor(
    resource,
    id,
    fragments = {
      include: [],
      exclude: [],
      filter: [],
      sort: [],
      additionalParams: {},
      perPage: undefined
    }
  ) {
    this.fragments = fragments;
    this.fragments.id = id;
    this.fragments.resource = resource;
    this.fragments.resource_name_singular = singular(resource);
    // ^ @todo p3 refactor so resource_name is singular and resource_name_plural, to match drest
  }

  _toQueryArray(parent) {
    return (acc, cur) => {
      if (isString(cur)) {
        if (parent) return acc.concat(parent.concat(cur));
        return acc.concat(cur);
      }
      if (Array.isArray(cur)) {
        const parent = last(acc);
        return acc.concat(cur.reduce(this._toQueryArray(parent), []));
      }
    };
  }

  include(...args) {
    return set(
      this,
      'fragments.include',
      this.fragments.include.concat(args.reduce(this._toQueryArray(), []))
    );
  }

  exclude(...args) {
    return set(
      this,
      'fragments.exclude',
      this.fragments.exclude.concat(args.reduce(this._toQueryArray(), []))
    );
  }

  sort(...args) {
    return set(
      this,
      'fragments.sort',
      this.fragments.sort.concat(args.reduce(this._toQueryArray(), []))
    );
  }

  perPage(n) {
    return set(this, 'fragments.perPage', n);
  }

  param(param, value) {
    return set(this, `fragments.additionalParams['${param}']`, value);
  }

  filter(entity) {
    const proxy = new Proxy(this, {
      get(obj, method) {
        const symbol = VALID_FILTER_OPERATORS[method];
        return function(term) {
          if (symbol) {
            obj.fragments.filter = obj.fragments.filter.concat({
              entity,
              term,
              symbol
            });
            return obj;
          }
        };
      }
    });
    return proxy;
  }

  // @TODO toString is looking a little long in the tooth
  toString() {
    let root;

    if (this.fragments.id) {
      root = '/'.concat([this.fragments.resource, this.fragments.id].join('/'));
    } else {
      root = '/'.concat(this.fragments.resource);
    }

    const pagination = [].concat(
      this.fragments.perPage ? 'per_page='.concat(this.fragments.perPage) : []
    );

    const includes = this.fragments.include
      .map(str => `include[]=${str}`)
      .join('&');

    const excludes = this.fragments.exclude
      .map(str => `exclude[]=${str}`)
      .join('&');

    const sorts = this.fragments.sort.map(str => `sort[]=${str}`).join('&');

    const filters = this.fragments.filter.reduce((acc, cur) => {
      return `${acc.length ? acc.concat('&') : ''}`.concat(
        // for multiple filter operations in the same Query
        'filter{'
          .concat(cur.entity) // entity is the collection to filter over
          .concat(cur.symbol ? `.${cur.symbol}` : '') // symbol is the DREST filter predicate (contains, eq, gte, etc)
          .concat('}')
          .concat('=')
          .concat(cur.term)
      ); // term is the final value to filter against
    }, '');

    let additionalParams = '';
    for (let [k, v] of Object.entries(this.fragments.additionalParams)) {
      additionalParams = additionalParams.concat(`${k}=${v}&`).slice(0, -1);
    }

    const fragments = [
      includes,
      excludes,
      filters,
      pagination,
      sorts,
      additionalParams
    ].filter(negate(isEmpty));

    return root.concat('?'.concat(fragments.join('&')));
  }
}

/* QUERY BUILDER */
function queryFor(resource, id) {
  // resource is a collection name, i.e. 'groups', or 'users'
  return new QueryExpression(resource, id);
}

export default queryFor;
