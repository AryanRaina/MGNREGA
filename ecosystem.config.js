// PM2 configuration for Azure App Service
module.exports = {
  apps: [{
    name: 'mgnrega-visualizer',
    script: 'node_modules/.bin/next',
    args: 'start -p 8080',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    }
  }]
};
