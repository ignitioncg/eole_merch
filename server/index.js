'use strict';

const { buildApp } = require('./src/app');

const port = Number(process.env.PORT || 8080);

buildApp().then((app) => {
  app.listen(port, () => {
    console.log(`[stock-catalog] listening on :${port}`);
  });
});
