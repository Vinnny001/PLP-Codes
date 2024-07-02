module.exports = {
    apps: [
      {
        name: 'my-digital-farm',
        script: 'app.js',
        watch: true,
        env: {
          NODE_ENV: 'development'
        },
        env_production: {
          NODE_ENV: 'production'
        }
      }
    ]
  };
  