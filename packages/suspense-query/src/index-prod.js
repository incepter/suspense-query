'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./suspense-query.production.js');
} else {
  module.exports = require('./suspense-query.development.js');
}
