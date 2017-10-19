'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.VALID_FILTER_OPERATORS = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _pluralize = require('pluralize');

var _lodash = require('lodash.set');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.last');

var _lodash4 = _interopRequireDefault(_lodash3);

var _lodash5 = require('lodash.isstring');

var _lodash6 = _interopRequireDefault(_lodash5);

var _lodash7 = require('lodash.isempty');

var _lodash8 = _interopRequireDefault(_lodash7);

var _lodash9 = require('lodash.negate');

var _lodash10 = _interopRequireDefault(_lodash9);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var VALID_FILTER_OPERATORS = exports.VALID_FILTER_OPERATORS = {
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

var QueryExpression = function () {
  function QueryExpression(resource, id) {
    var fragments = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {
      include: [],
      exclude: [],
      filter: [],
      sort: [],
      additionalParams: {},
      perPage: undefined
    };

    _classCallCheck(this, QueryExpression);

    this.fragments = fragments;
    this.fragments.id = id;
    this.fragments.resource = resource;
    this.fragments.resource_name_singular = (0, _pluralize.singular)(resource);
    // ^ @todo p3 refactor so resource_name is singular and resource_name_plural, to match drest
  }

  _createClass(QueryExpression, [{
    key: '_toQueryArray',
    value: function _toQueryArray(parent) {
      var _this = this;

      return function (acc, cur) {
        if ((0, _lodash6.default)(cur)) {
          if (parent) return acc.concat(parent.concat(cur));
          return acc.concat(cur);
        }
        if (Array.isArray(cur)) {
          var _parent = (0, _lodash4.default)(acc);
          return acc.concat(cur.reduce(_this._toQueryArray(_parent), []));
        }
      };
    }
  }, {
    key: 'include',
    value: function include() {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return (0, _lodash2.default)(this, 'fragments.include', this.fragments.include.concat(args.reduce(this._toQueryArray(), [])));
    }
  }, {
    key: 'exclude',
    value: function exclude() {
      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      return (0, _lodash2.default)(this, 'fragments.exclude', this.fragments.exclude.concat(args.reduce(this._toQueryArray(), [])));
    }
  }, {
    key: 'sort',
    value: function sort() {
      for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
      }

      return (0, _lodash2.default)(this, 'fragments.sort', this.fragments.sort.concat(args.reduce(this._toQueryArray(), [])));
    }
  }, {
    key: 'perPage',
    value: function perPage(n) {
      return (0, _lodash2.default)(this, 'fragments.perPage', n);
    }
  }, {
    key: 'param',
    value: function param(_param, value) {
      return (0, _lodash2.default)(this, 'fragments.additionalParams[\'' + _param + '\']', value);
    }
  }, {
    key: 'filter',
    value: function filter(entity) {
      var proxy = new Proxy(this, {
        get: function get(obj, method) {
          var symbol = VALID_FILTER_OPERATORS[method];
          return function (term) {
            if (symbol) {
              obj.fragments.filter = obj.fragments.filter.concat({
                entity: entity,
                term: term,
                symbol: symbol
              });
              return obj;
            }
          };
        }
      });
      return proxy;
    }

    // @TODO toString is looking a little long in the tooth

  }, {
    key: 'toString',
    value: function toString() {
      var root = void 0;

      if (this.fragments.id) {
        root = '/'.concat([this.fragments.resource, this.fragments.id].join('/'));
      } else {
        root = '/'.concat(this.fragments.resource);
      }

      var pagination = [].concat(this.fragments.perPage ? 'per_page='.concat(this.fragments.perPage) : []);

      var includes = this.fragments.include.map(function (str) {
        return 'include[]=' + str;
      }).join('&');

      var excludes = this.fragments.exclude.map(function (str) {
        return 'exclude[]=' + str;
      }).join('&');

      var sorts = this.fragments.sort.map(function (str) {
        return 'sort[]=' + str;
      }).join('&');

      var filters = this.fragments.filter.reduce(function (acc, cur) {
        return ('' + (acc.length ? acc.concat('&') : '')).concat(
        // for multiple filter operations in the same Query
        'filter{'.concat(cur.entity) // entity is the collection to filter over
        .concat(cur.symbol ? '.' + cur.symbol : '') // symbol is the DREST filter predicate (contains, eq, gte, etc)
        .concat('}').concat('=').concat(cur.term)); // term is the final value to filter against
      }, '');

      var additionalParams = '';
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = Object.entries(this.fragments.additionalParams)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var _ref = _step.value;

          var _ref2 = _slicedToArray(_ref, 2);

          var k = _ref2[0];
          var v = _ref2[1];

          additionalParams = additionalParams.concat(k + '=' + v + '&').slice(0, -1);
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

      var fragments = [includes, excludes, filters, pagination, sorts, additionalParams].filter((0, _lodash10.default)(_lodash8.default));

      return root.concat('?'.concat(fragments.join('&')));
    }
  }]);

  return QueryExpression;
}();

/* QUERY BUILDER */


function queryFor(resource, id) {
  // resource is a collection name, i.e. 'groups', or 'users'
  return new QueryExpression(resource, id);
}

exports.default = queryFor;